/* eslint-disable no-restricted-globals */

/**
 * LULLABY TENSOR ENGINE (VERSION 3.3)
 * Production-grade mathematical engine with N-dimensional broadcasting support.
 */
export class Tensor {
    constructor(data, shape) {
        if (!(data instanceof Float32Array)) {
            data = new Float32Array(data);
        }
        this.data = data;
        this.shape = shape;
        this.grad = null;
        this.strides = this.computeStrides(shape);
    }

    computeStrides(shape) {
        const rank = shape.length;
        const strides = new Array(rank).fill(0);
        let stride = 1;
        for (let i = rank - 1; i >= 0; i--) {
            strides[i] = stride;
            stride *= shape[i];
        }
        return strides;
    }

    static zeros(shape) {
        const size = shape.reduce((a, b) => a * b, 1);
        return new Tensor(new Float32Array(size), shape);
    }

    static ones(shape) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        data.fill(1.0);
        return new Tensor(data, shape);
    }

    static randn(shape, mean = 0.0, std = 1.0) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        const MIN_UNIFORM = 1e-10;
        for (let i = 0; i < size; i += 2) {
            let u1, u2;
            do { u1 = Math.random(); u2 = Math.random(); } while (u1 <= MIN_UNIFORM);
            const mag = std * Math.sqrt(-2.0 * Math.log(u1));
            data[i] = mean + mag * Math.cos(2.0 * Math.PI * u2);
            if (i + 1 < size) data[i + 1] = mean + mag * Math.sin(2.0 * Math.PI * u2);
        }
        return new Tensor(data, shape);
    }

    static fromArray(arr) {
        const shape = [];
        let curr = arr;
        while (Array.isArray(curr)) {
            shape.push(curr.length);
            curr = curr[0];
        }
        const flatSize = shape.reduce((a, b) => a * b, 1);
        const flat = new Float32Array(flatSize);
        let idx = 0;
        const flatten = (a) => {
            for (let i = 0; i < a.length; i++) {
                if (Array.isArray(a[i])) flatten(a[i]);
                else flat[idx++] = a[i];
            }
        };
        flatten(arr);
        return new Tensor(flat, shape);
    }

    clone() {
        return new Tensor(new Float32Array(this.data), [...this.shape]);
    }

    reshape(newShape) {
        const targetShape = [...newShape];
        const oldSize = this.data.length;
        const negIdx = targetShape.indexOf(-1);
        if (negIdx !== -1) {
            let others = 1;
            for (let i = 0; i < targetShape.length; i++) if (i !== negIdx) others *= targetShape[i];
            targetShape[negIdx] = Math.floor(oldSize / others);
        }
        const newSize = targetShape.reduce((a, b) => a * b, 1);
        if (oldSize !== newSize) throw new Error(`Shape mismatch in reshape: ${this.shape} to ${targetShape}`);
        return new Tensor(this.data, targetShape);
    }

    zeroGrad() {
        if (!this.grad) this.grad = new Float32Array(this.data.length);
        else this.grad.fill(0);
    }

    matmul(other) {
        const A = this, B = other;
        const dimA = A.shape.length, dimB = B.shape.length;
        const M = A.shape[dimA - 2], K = A.shape[dimA - 1], K_B = B.shape[dimB - 2], N = B.shape[dimB - 1];
        if (K !== K_B) throw new Error(`Matmul mismatch: ${K} vs ${K_B}`);
        const batchShapeA = A.shape.slice(0, -2), batchShapeB = B.shape.slice(0, -2);
        const batchRank = Math.max(batchShapeA.length, batchShapeB.length);
        const broadcastBatchShape = [], virtualStridesA = [], virtualStridesB = [];
        const paddedBatchA = Array(batchRank - batchShapeA.length).fill(1).concat(batchShapeA);
        const paddedBatchB = Array(batchRank - batchShapeB.length).fill(1).concat(batchShapeB);
        const stridesA = A.strides.slice(0, -2), paddedStridesA = Array(batchRank - stridesA.length).fill(0).concat(stridesA);
        const stridesB = B.strides.slice(0, -2), paddedStridesB = Array(batchRank - stridesB.length).fill(0).concat(stridesB);
        for (let i = 0; i < batchRank; i++) {
            const dA = paddedBatchA[i], dB = paddedBatchB[i];
            if (dA === dB) { broadcastBatchShape.push(dA); virtualStridesA.push(paddedStridesA[i]); virtualStridesB.push(paddedStridesB[i]); }
            else if (dA === 1) { broadcastBatchShape.push(dB); virtualStridesA.push(0); virtualStridesB.push(paddedStridesB[i]); }
            else if (dB === 1) { broadcastBatchShape.push(dA); virtualStridesA.push(paddedStridesA[i]); virtualStridesB.push(0); }
            else throw new Error("Broadcasting mismatch");
        }
        const resultShape = [...broadcastBatchShape, M, N];
        const C = Tensor.zeros(resultShape);
        const totalBatches = broadcastBatchShape.reduce((p, c) => p * c, 1);
        for (let b = 0; b < totalBatches; b++) {
            let offsetA = 0, offsetB = 0, rem = b;
            for (let i = batchRank - 1; i >= 0; i--) {
                const idx = rem % broadcastBatchShape[i];
                rem = Math.floor(rem / broadcastBatchShape[i]);
                offsetA += idx * virtualStridesA[i];
                offsetB += idx * virtualStridesB[i];
            }
            const offsetC = b * M * N;
            for (let m = 0; m < M; m++) {
                const rowAOffset = offsetA + m * K, rowCOffset = offsetC + m * N;
                for (let k = 0; k < K; k++) {
                    const valA = A.data[rowAOffset + k];
                    if (valA === 0) continue;
                    const rowBOffset = offsetB + k * N;
                    for (let n = 0; n < N; n++) C.data[rowCOffset + n] += valA * B.data[rowBOffset + n];
                }
            }
        }
        return C;
    }

    add(other) {
        const [a, b] = this._broadcast(this, other);
        const res = new Float32Array(a.data.length);
        for (let i = 0; i < a.data.length; i++) res[i] = a.data[i] + b.data[i];
        return new Tensor(res, a.shape);
    }

    sub(other) {
        const [a, b] = this._broadcast(this, other);
        const res = new Float32Array(a.data.length);
        for (let i = 0; i < a.data.length; i++) res[i] = a.data[i] - b.data[i];
        return new Tensor(res, a.shape);
    }

    mul(other) {
        const [a, b] = this._broadcast(this, other);
        const res = new Float32Array(a.data.length);
        for (let i = 0; i < a.data.length; i++) res[i] = a.data[i] * b.data[i];
        return new Tensor(res, a.shape);
    }

    addBroadcast(vector) {
        const N = vector.data.length;
        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) res[i] = this.data[i] + vector.data[i % N];
        return new Tensor(res, [...this.shape]);
    }

    scale(s) {
        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) res[i] = this.data[i] * s;
        return new Tensor(res, [...this.shape]);
    }

    transpose() {
        const rank = this.shape.length;
        const M = this.shape[rank - 2], N = this.shape[rank - 1];
        const newShape = [...this.shape];
        newShape[rank - 2] = N; newShape[rank - 1] = M;
        const res = Tensor.zeros(newShape);
        const batchSize = this.data.length / (M * N);
        for (let b = 0; b < batchSize; b++) {
            const off = b * M * N;
            for (let i = 0; i < M; i++) {
                for (let j = 0; j < N; j++) res.data[off + j * M + i] = this.data[off + i * N + j];
            }
        }
        return res;
    }

    softmax() {
        const K = this.shape[this.shape.length - 1], rows = this.data.length / K, res = new Float32Array(this.data.length);
        for (let r = 0; r < rows; r++) {
            const off = r * K;
            let maxVal = -Infinity;
            for (let i = 0; i < K; i++) if (this.data[off + i] > maxVal) maxVal = this.data[off + i];
            let sum = 0;
            if (!Number.isFinite(maxVal)) { for (let i = 0; i < K; i++) res[off + i] = 1 / K; }
            else {
                for (let i = 0; i < K; i++) { res[off + i] = Math.exp(this.data[off + i] - maxVal); sum += res[off + i]; }
                const nf = 1.0 / (sum + 1e-12);
                for (let i = 0; i < K; i++) res[off + i] *= nf;
            }
        }
        return new Tensor(res, [...this.shape]);
    }

    softmaxBackward(gradOutput) {
        const K = this.shape[this.shape.length - 1], rows = this.data.length / K, res = new Float32Array(this.data.length);
        for (let r = 0; r < rows; r++) {
            const off = r * K;
            let sumSdOut = 0;
            for (let k = 0; k < K; k++) sumSdOut += this.data[off + k] * gradOutput.data[off + k];
            for (let i = 0; i < K; i++) res[off + i] = this.data[off + i] * (gradOutput.data[off + i] - sumSdOut);
        }
        return new Tensor(res, [...this.shape]);
    }

    _broadcast(t1, t2) {
        const s1 = t1.shape, s2 = t2.shape;
        if (s1.length === s2.length && s1.every((v, i) => v === s2[i])) return [t1, t2];

        const outShape = [];
        const rank = Math.max(s1.length, s2.length);
        for (let i = 0; i < rank; i++) {
            const d1 = s1[s1.length - 1 - i] || 1;
            const d2 = s2[s2.length - 1 - i] || 1;
            if (d1 !== d2 && d1 !== 1 && d2 !== 1) throw new Error(`Broadcasting failed: ${s1} and ${s2}`);
            outShape.unshift(Math.max(d1, d2));
        }

        const expand = (t, targetShape) => {
            if (t.data.length === targetShape.reduce((a,b)=>a*b, 1)) return t;
            const newData = new Float32Array(targetShape.reduce((a,b)=>a*b, 1));
            const tPadded = Array(targetShape.length - t.shape.length).fill(1).concat(t.shape);
            const tStrides = this.computeStrides(tPadded);
            const outStrides = this.computeStrides(targetShape);
            
            for (let i = 0; i < newData.length; i++) {
                let rem = i, inIdx = 0;
                for (let d = 0; d < targetShape.length; d++) {
                    const coord = Math.floor(rem / outStrides[d]);
                    rem %= outStrides[d];
                    if (tPadded[d] > 1) inIdx += coord * tStrides[d];
                }
                newData[i] = t.data[inIdx];
            }
            return new Tensor(newData, targetShape);
        };

        return [expand(t1, outShape), expand(t2, outShape)];
    }
}
