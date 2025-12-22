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
        const virtualStridesBT = []; // For Transposed B

        // Align shapes and strides (pad with 1s on left)
        const paddedBatchA = Array(batchRank - batchShapeA.length).fill(1).concat(batchShapeA);
        const paddedBatchB = Array(batchRank - batchShapeB.length).fill(1).concat(batchShapeB);

        // Strides for A (exclude last 2 dims)
        const stridesA = A.strides.slice(0, -2);
        const paddedStridesA = Array(batchRank - stridesA.length).fill(0).concat(stridesA);

        // Pre-compute BT (B Transposed) for optimized access
        // BT shape: [..., N, K]
        const BT = B.transpose();
        const stridesBT = BT.strides.slice(0, -2);
        const paddedStridesBT = Array(batchRank - stridesBT.length).fill(0).concat(stridesBT);

        for (let i = 0; i < batchRank; i++) {
            const dA = paddedBatchA[i];
            const dB = paddedBatchB[i];

            if (dA === dB) {
                broadcastBatchShape.push(dA);
                virtualStridesA.push(paddedStridesA[i]);
                virtualStridesBT.push(paddedStridesBT[i]);
            } else if (dA === 1) {
                broadcastBatchShape.push(dB);
                virtualStridesA.push(0); // Broadcast A
                virtualStridesBT.push(paddedStridesBT[i]);
            } else if (dB === 1) {
                broadcastBatchShape.push(dA);
                virtualStridesA.push(paddedStridesA[i]);
                virtualStridesBT.push(0); // Broadcast B
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
            let offsetBT = 0;
            let remainder = b;

            for (let i = batchRank - 1; i >= 0; i--) {
                const dim = broadcastBatchShape[i];
                const idx = remainder % dim;
                remainder = Math.floor(remainder / dim);

                offsetA += idx * virtualStridesA[i];
                offsetBT += idx * virtualStridesBT[i];
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

    softmax() {
        const K = this.shape[this.shape.length - 1];
        const rows = this.data.length / K;
        const res = new Float32Array(this.data.length);
        const epsilon = 1e-10; // Numerical stability guard

        for (let r = 0; r < rows; r++) {
            const offset = r * K;
            let maxVal = -Infinity;
            for (let i = 0; i < K; i++) if (this.data[offset + i] > maxVal) maxVal = this.data[offset + i];
            let sum = 0.0;
            for (let i = 0; i < K; i++) {
                const e = Math.exp(this.data[offset + i] - maxVal);
                res[offset + i] = e;
                sum += e;
            }
            // Guard against division by zero
            for (let i = 0; i < K; i++) res[offset + i] /= (sum + epsilon);
        }
        return new Tensor(res, [...this.shape]);
    }

    // Gradient of Softmax: dS_i = S_i * (dOut_i - sum(S_k * dOut_k))
    softmaxBackward(gradOutput) {
        const K = this.shape[this.shape.length - 1];
        const rows = this.data.length / K;
        const res = new Float32Array(this.data.length);

        // "this" is the output of softmax (S)
        for (let r = 0; r < rows; r++) {
            const offset = r * K;
            let sumSdOut = 0.0;

            // Calculate sum(S_k * dOut_k)
            for (let k = 0; k < K; k++) {
                sumSdOut += this.data[offset + k] * gradOutput.data[offset + k];
            }

            // Calculate dS_i
            for (let i = 0; i < K; i++) {
                const s = this.data[offset + i];
                const dOut = gradOutput.data[offset + i];
                res[offset + i] = s * (dOut - sumSdOut);
            }
        }
        return new Tensor(res, [...this.shape]);
    }
}
