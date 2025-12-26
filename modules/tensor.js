/* eslint-disable no-restricted-globals */

// ==========================================
// 1. MATH ENGINE (TensorJS + Autograd)
// ==========================================
export class Tensor {
    constructor(data, shape) {
        this.data = data;
        this.shape = shape;
        this.grad = null;
        this.strides = this.computeStrides(shape);
    }

    computeStrides(shape) {
        const strides = new Array(shape.length).fill(0);
        let stride = 1;
        for (let i = shape.length - 1; i >= 0; i--) {
            strides[i] = stride;
            stride *= shape[i];
        }
        return strides;
    }

    static zeros(shape) {
        const size = shape.reduce((a, b) => a * b, 1);
        return new Tensor(new Float32Array(size), shape);
    }

    static randn(shape, mean = 0.0, std = 0.02) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);

        // Numerical stability threshold for Box-Muller transform
        const MIN_UNIFORM_VALUE = 1e-10;

        // Improved Box-Muller transform - generates two samples per iteration
        for (let i = 0; i < size; i += 2) {
            let u1, u2;
            // Ensure u1 > 0 to avoid log(0)
            do {
                u1 = Math.random();
                u2 = Math.random();
            } while (u1 <= MIN_UNIFORM_VALUE);

            // Box-Muller transform: generates two independent standard normal samples
            const mag = Math.sqrt(-2.0 * Math.log(u1));
            const z0 = mag * Math.cos(2.0 * Math.PI * u2);
            const z1 = mag * Math.sin(2.0 * Math.PI * u2);

            // Apply mean and std
            data[i] = mean + z0 * std;
            if (i + 1 < size) {
                data[i + 1] = mean + z1 * std;
            }
        }
        return new Tensor(data, shape);
    }

    zeroGrad() {
        if (!this.grad) {
            this.grad = new Float32Array(this.data.length);
        } else {
            this.grad.fill(0);
        }
    }

    matmul(other) {
        const A = this;
        const B = other;
        const dimA = A.shape.length;
        const dimB = B.shape.length;
        const M = A.shape[dimA - 2];
        const K = A.shape[dimA - 1];
        const K_B = B.shape[dimB - 2];
        const N = B.shape[dimB - 1];

        // Validate dimension compatibility (CRITICAL FIX #5)
        if (K !== K_B) {
            throw new Error(`Matmul dimension mismatch: A[..., ${M}, ${K}] @ B[..., ${K_B}, ${N}]`);
        }

        // N-D Broadcasting Logic
        const batchShapeA = A.shape.slice(0, -2);
        const batchShapeB = B.shape.slice(0, -2);
        const batchRank = Math.max(batchShapeA.length, batchShapeB.length);

        const broadcastBatchShape = [];
        const virtualStridesA = [];
        const virtualStridesB = [];

        // Align shapes and strides (pad with 1s on left)
        const paddedBatchA = Array(batchRank - batchShapeA.length).fill(1).concat(batchShapeA);
        const paddedBatchB = Array(batchRank - batchShapeB.length).fill(1).concat(batchShapeB);

        // Strides for A (exclude last 2 dims)
        const stridesA = A.strides.slice(0, -2);
        const paddedStridesA = Array(batchRank - stridesA.length).fill(0).concat(stridesA);

        // Strides for B (exclude last 2 dims)
        const stridesB = B.strides.slice(0, -2);
        const paddedStridesB = Array(batchRank - stridesB.length).fill(0).concat(stridesB);

        for (let i = 0; i < batchRank; i++) {
            const dA = paddedBatchA[i];
            const dB = paddedBatchB[i];

            if (dA === dB) {
                broadcastBatchShape.push(dA);
                virtualStridesA.push(paddedStridesA[i]);
                virtualStridesB.push(paddedStridesB[i]);
            } else if (dA === 1) {
                broadcastBatchShape.push(dB);
                virtualStridesA.push(0); // Broadcast A
                virtualStridesB.push(paddedStridesB[i]);
            } else if (dB === 1) {
                broadcastBatchShape.push(dA);
                virtualStridesA.push(paddedStridesA[i]);
                virtualStridesB.push(0); // Broadcast B
            } else {
                throw new Error(`Matmul broadcasting mismatch: A shape ${A.shape} vs B shape ${B.shape}`);
            }
        }

        const resultShape = [...broadcastBatchShape, M, N];
        const C = Tensor.zeros(resultShape);
        const totalBatches = broadcastBatchShape.reduce((p, c) => p * c, 1);

        for (let b = 0; b < totalBatches; b++) {
            // Compute offsets for this batch index
            let offsetA = 0;
            let offsetB = 0;
            let remainder = b;

            for (let i = batchRank - 1; i >= 0; i--) {
                const dim = broadcastBatchShape[i];
                const idx = remainder % dim;
                remainder = Math.floor(remainder / dim);

                offsetA += idx * virtualStridesA[i];
                offsetB += idx * virtualStridesB[i];
            }

            const offsetC = b * M * N;

            // Inner Matrix Multiplication Loop (Optimized)
            for (let m = 0; m < M; m++) {
                const rowAOffset = offsetA + m * K;
                const rowCOffset = offsetC + m * N;

                for (let k = 0; k < K; k++) {
                    const valA = A.data[rowAOffset + k];

                    // Optimization: Skip if valA is 0 (Sparsity)
                    // This is very effective for ReLU outputs (~50% zeros)
                    if (valA === 0) continue;

                    const rowBOffset = offsetB + k * N;

                    // Loop Unrolling (Factor 4)
                    let n = 0;
                    const N_limit = N - 3;
                    for (; n < N_limit; n += 4) {
                        C.data[rowCOffset + n] += valA * B.data[rowBOffset + n];
                        C.data[rowCOffset + n + 1] += valA * B.data[rowBOffset + n + 1];
                        C.data[rowCOffset + n + 2] += valA * B.data[rowBOffset + n + 2];
                        C.data[rowCOffset + n + 3] += valA * B.data[rowBOffset + n + 3];
                    }

                    // Handle remainder
                    for (; n < N; n++) {
                        C.data[rowCOffset + n] += valA * B.data[rowBOffset + n];
                    }
                }
            }
        }
        return C;
    }

    add(other) {
        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) res[i] = this.data[i] + other.data[i];
        return new Tensor(res, [...this.shape]);
    }

    addBroadcast(vector) {
        const N = vector.shape[0];
        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) {
            res[i] = this.data[i] + vector.data[i % N];
        }
        return new Tensor(res, [...this.shape]);
    }

    transpose() {
        const dim = this.shape.length;
        const M = this.shape[dim - 2];
        const N = this.shape[dim - 1];
        const newShape = [...this.shape];
        newShape[dim - 2] = N;
        newShape[dim - 1] = M;
        const res = Tensor.zeros(newShape);
        const batchSize = this.data.length / (M * N);

        for (let b = 0; b < batchSize; b++) {
            const offset = b * M * N;
            for (let i = 0; i < M; i++) {
                for (let j = 0; j < N; j++) {
                    res.data[offset + j * M + i] = this.data[offset + i * N + j];
                }
            }
        }
        return res;
    }

    scale(scalar) {
        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) res[i] = this.data[i] * scalar;
        return new Tensor(res, [...this.shape]);
    }

    sub(other) {
        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) res[i] = this.data[i] - other.data[i];
        return new Tensor(res, [...this.shape]);
    }

    mul(other) {
        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) res[i] = this.data[i] * other.data[i];
        return new Tensor(res, [...this.shape]);
    }

    /**
     * Numerically stable softmax implementation
     * 
     * Mathematical formula: softmax(x_i) = exp(x_i) / Σ exp(x_j)
     * 
     * Numerical stability technique:
     * 1. Subtract max value before exp to prevent overflow
     *    softmax(x - max) = exp(x - max) / Σ exp(x - max)
     * 2. Add epsilon to denominator to prevent division by zero
     * 
     * Proof of equivalence:
     * softmax(x_i - c) = exp(x_i - c) / Σ exp(x_j - c)
     *                  = [exp(x_i) * exp(-c)] / [Σ exp(x_j) * exp(-c)]
     *                  = exp(x_i) / Σ exp(x_j) = softmax(x_i)
     * 
     * Where c = max(x) ensures all exponents are ≤ 0, preventing overflow
     */
    softmax() {
        const K = this.shape[this.shape.length - 1];
        const rows = this.data.length / K;
        const res = new Float32Array(this.data.length);
        
        // Numerical stability constants
        const epsilon = 1e-10; // Prevent division by zero
        const MIN_EXP_INPUT = -88; // Underflow threshold for Float32

        for (let r = 0; r < rows; r++) {
            const offset = r * K;
            
            // Step 1: Find maximum value for numerical stability
            let maxVal = -Infinity;
            for (let i = 0; i < K; i++) {
                const val = this.data[offset + i];
                if (Number.isFinite(val) && val > maxVal) {
                    maxVal = val;
                }
            }
            
            // Handle edge case where all values are -Infinity or NaN
            if (!Number.isFinite(maxVal)) {
                // Uniform distribution fallback
                const uniform = 1.0 / K;
                for (let i = 0; i < K; i++) {
                    res[offset + i] = uniform;
                }
                continue;
            }
            
            // Step 2: Compute exp(x - max) and sum
            let sum = 0.0;
            for (let i = 0; i < K; i++) {
                const val = this.data[offset + i];
                // Clamp to prevent underflow (exp(-88) ≈ 0 in Float32)
                const shifted = Math.max(val - maxVal, MIN_EXP_INPUT);
                const e = Math.exp(shifted);
                res[offset + i] = e;
                sum += e;
            }
            
            // Step 3: Normalize (with epsilon guard)
            // Validation: sum should be positive
            if (!(sum > 0)) {
                // Fallback to uniform distribution if sum is invalid
                const uniform = 1.0 / K;
                for (let i = 0; i < K; i++) {
                    res[offset + i] = uniform;
                }
            } else {
                const normFactor = 1.0 / (sum + epsilon);
                for (let i = 0; i < K; i++) {
                    res[offset + i] *= normFactor;
                }
            }
        }
        return new Tensor(res, [...this.shape]);
    }

    /**
     * Softmax backward pass
     * 
     * Mathematical derivation:
     * For softmax output S = softmax(x), Jacobian is:
     * ∂S_i/∂x_j = S_i(δ_ij - S_j)
     * 
     * Chain rule gives:
     * ∂L/∂x_i = Σ_k (∂L/∂S_k)(∂S_k/∂x_i)
     *         = Σ_k (∂L/∂S_k) * S_k(δ_ki - S_i)
     *         = S_i * Σ_k [(∂L/∂S_k)δ_ki - (∂L/∂S_k)S_k]
     *         = S_i * [(∂L/∂S_i) - Σ_k (∂L/∂S_k)S_k]
     *         = S_i * (dOut_i - Σ_k S_k*dOut_k)
     * 
     * @param {Tensor} gradOutput - Gradient from next layer (dL/dS)
     * @returns {Tensor} - Gradient wrt input (dL/dx)
     */
    softmaxBackward(gradOutput) {
        const K = this.shape[this.shape.length - 1];
        const rows = this.data.length / K;
        const res = new Float32Array(this.data.length);

        // "this" is the output of softmax (S)
        for (let r = 0; r < rows; r++) {
            const offset = r * K;
            
            // Calculate sum(S_k * dOut_k) with numerical stability
            let sumSdOut = 0.0;
            for (let k = 0; k < K; k++) {
                const s = this.data[offset + k];
                const dOut = gradOutput.data[offset + k];
                // Validate both values are finite
                if (Number.isFinite(s) && Number.isFinite(dOut)) {
                    sumSdOut += s * dOut;
                }
            }

            // Calculate gradient: dS_i = S_i * (dOut_i - sumSdOut)
            for (let i = 0; i < K; i++) {
                const s = this.data[offset + i];
                const dOut = gradOutput.data[offset + i];
                
                // Validate inputs and compute gradient
                if (Number.isFinite(s) && Number.isFinite(dOut) && Number.isFinite(sumSdOut)) {
                    res[offset + i] = s * (dOut - sumSdOut);
                } else {
                    res[offset + i] = 0.0; // Safe fallback for invalid gradients
                }
            }
        }
        return new Tensor(res, [...this.shape]);
    }
}
