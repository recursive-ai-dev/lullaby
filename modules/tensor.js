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
        const N = B.shape[dimB - 1];
        const batchSize = dimA > 2 ? A.shape[0] : 1;
        const resultShape = dimA > 2 ? [batchSize, M, N] : [M, N];
        const C = Tensor.zeros(resultShape);

        // Optimization: Transpose B effectively by creating a temporary transposed view or copy
        // For small matrices, the overhead might not be worth it, but for >64 it usually is.
        // We'll do an explicit transpose of the last two dimensions of B for the batch.

        // However, our transpose() method returns a new Tensor. 
        // Let's do a "virtual" transpose or just transpose B once if it's not batched.
        // If batched, we need to be careful.

        // Let's implement the loop with B transposed.
        // We can use the existing transpose() method.
        const BT = B.transpose(); // [..., N, K]

        for (let b = 0; b < batchSize; b++) {
            const offsetA = b * M * K;
            const offsetBT = dimB > 2 ? b * N * K : 0; // BT has shape [..., N, K]
            const offsetC = b * M * N;

            for (let m = 0; m < M; m++) {
                const rowAOffset = offsetA + m * K;
                for (let n = 0; n < N; n++) {
                    const rowBTOffset = offsetBT + n * K; // Contiguous row in BT is column in B
                    let sum = 0.0;

                    // Loop Unrolling (Factor 4)
                    let k = 0;
                    const K_limit = K - 3;

                    for (; k < K_limit; k += 4) {
                        sum += A.data[rowAOffset + k] * BT.data[rowBTOffset + k];
                        sum += A.data[rowAOffset + k + 1] * BT.data[rowBTOffset + k + 1];
                        sum += A.data[rowAOffset + k + 2] * BT.data[rowBTOffset + k + 2];
                        sum += A.data[rowAOffset + k + 3] * BT.data[rowBTOffset + k + 3];
                    }

                    // Handle remainder
                    for (; k < K; k++) {
                        sum += A.data[rowAOffset + k] * BT.data[rowBTOffset + k];
                    }

                    C.data[offsetC + m * N + n] = sum;
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
            for (let i = 0; i < K; i++) res[offset + i] /= sum;
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
