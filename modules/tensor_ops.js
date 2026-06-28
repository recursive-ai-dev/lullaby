import { Tensor } from './tensor.js';

/**
 * HIGH-PERFORMANCE TENSOR OPERATIONS (VERSION 3.0)
 * Optimized for 1D and 2D operations with robust fallback for N-dimensional tensors.
 */
export class TensorOps {
    static getStrides(shape) {
        const rank = shape.length;
        const strides = new Array(rank).fill(0);
        let stride = 1;
        for (let i = rank - 1; i >= 0; i--) {
            strides[i] = stride;
            stride *= shape[i];
        }
        return strides;
    }

    static concat(tensors, axis = 0) {
        if (!tensors.length) throw new Error("Empty tensor list");
        const rank = tensors[0].shape.length;
        const normAxis = axis < 0 ? axis + rank : axis;
        
        const outShape = [...tensors[0].shape];
        outShape[normAxis] = tensors.reduce((s, t) => s + t.shape[normAxis], 0);
        
        const outData = new Float32Array(outShape.reduce((a, b) => a * b, 1));
        const outStrides = this.getStrides(outShape);
        let offset = 0;

        for (const t of tensors) {
            const tStrides = this.getStrides(t.shape);
            for (let i = 0; i < t.data.length; i++) {
                let rem = i, outIdx = 0;
                for (let d = 0; d < rank; d++) {
                    const coord = Math.floor(rem / tStrides[d]);
                    rem %= tStrides[d];
                    outIdx += (d === normAxis ? coord + offset : coord) * outStrides[d];
                }
                outData[outIdx] = t.data[i];
            }
            offset += t.shape[normAxis];
        }
        return new Tensor(outData, outShape);
    }

    static split(tensor, parts, axis = 0) {
        const rank = tensor.shape.length;
        const normAxis = axis < 0 ? axis + rank : axis;
        const dimSize = tensor.shape[normAxis];
        const sizes = typeof parts === 'number' ? new Array(parts).fill(dimSize / parts) : parts;
        
        const results = [];
        let offset = 0;
        const inStrides = this.getStrides(tensor.shape);

        for (const s of sizes) {
            const outShape = [...tensor.shape];
            outShape[normAxis] = s;
            const outData = new Float32Array(outShape.reduce((a, b) => a * b, 1));
            const outStrides = this.getStrides(outShape);

            for (let i = 0; i < outData.length; i++) {
                let rem = i, inIdx = 0;
                for (let d = 0; d < rank; d++) {
                    const coord = Math.floor(rem / outStrides[d]);
                    rem %= outStrides[d];
                    inIdx += (d === normAxis ? coord + offset : coord) * inStrides[d];
                }
                outData[i] = tensor.data[inIdx];
            }
            results.push(new Tensor(outData, outShape));
            offset += s;
        }
        return results;
    }

    static sum(tensor, axis = null, keepDims = false) {
        if (axis === null) return tensor.data.reduce((a, b) => a + b, 0);

        const rank = tensor.shape.length;
        const normAxis = axis < 0 ? axis + rank : axis;
        const outShape = [];
        for (let i = 0; i < rank; i++) {
            if (i === normAxis) { if (keepDims) outShape.push(1); }
            else outShape.push(tensor.shape[i]);
        }

        const outData = new Float32Array(outShape.reduce((a, b) => a * b, 1) || 1);
        const inStrides = this.getStrides(tensor.shape);
        const outStrides = this.getStrides(outShape);

        for (let i = 0; i < tensor.data.length; i++) {
            let rem = i, outIdx = 0, outD = 0;
            for (let d = 0; d < rank; d++) {
                const coord = Math.floor(rem / inStrides[d]);
                rem %= inStrides[d];
                if (d !== normAxis) {
                    outIdx += coord * outStrides[outD++];
                } else if (keepDims) {
                    outD++;
                }
            }
            outData[outIdx] += tensor.data[i];
        }
        return new Tensor(outData, outShape);
    }

    static max(tensor, axis = null, keepDims = false) {
        if (axis === null) return Math.max(...tensor.data);
        const rank = tensor.shape.length;
        const normAxis = axis < 0 ? axis + rank : axis;
        const outShape = [];
        for (let i = 0; i < rank; i++) {
            if (i === normAxis) { if (keepDims) outShape.push(1); }
            else outShape.push(tensor.shape[i]);
        }
        const outData = new Float32Array(outShape.reduce((a, b) => a * b, 1) || 1).fill(-Infinity);
        const inStrides = this.getStrides(tensor.shape);
        const outStrides = this.getStrides(outShape);

        for (let i = 0; i < tensor.data.length; i++) {
            let rem = i, outIdx = 0, outD = 0;
            for (let d = 0; d < rank; d++) {
                const coord = Math.floor(rem / inStrides[d]);
                rem %= inStrides[d];
                if (d !== normAxis) outIdx += coord * outStrides[outD++];
                else if (keepDims) outD++;
            }
            if (tensor.data[i] > outData[outIdx]) outData[outIdx] = tensor.data[i];
        }
        return new Tensor(outData, outShape);
    }

    static min(tensor, axis = null, keepDims = false) {
        if (axis === null) return Math.min(...tensor.data);
        const rank = tensor.shape.length;
        const normAxis = axis < 0 ? axis + rank : axis;
        const outShape = [];
        for (let i = 0; i < rank; i++) {
            if (i === normAxis) { if (keepDims) outShape.push(1); }
            else outShape.push(tensor.shape[i]);
        }
        const outData = new Float32Array(outShape.reduce((a, b) => a * b, 1) || 1).fill(Infinity);
        const inStrides = this.getStrides(tensor.shape);
        const outStrides = this.getStrides(outShape);

        for (let i = 0; i < tensor.data.length; i++) {
            let rem = i, outIdx = 0, outD = 0;
            for (let d = 0; d < rank; d++) {
                const coord = Math.floor(rem / inStrides[d]);
                rem %= inStrides[d];
                if (d !== normAxis) outIdx += coord * outStrides[outD++];
                else if (keepDims) outD++;
            }
            if (tensor.data[i] < outData[outIdx]) outData[outIdx] = tensor.data[i];
        }
        return new Tensor(outData, outShape);
    }

    static variance(tensor, axis = null, keepDims = false, ddof = 0) {
        const mean = this.sum(tensor, axis, true).scale(1 / (axis === null ? tensor.data.length : tensor.shape[axis < 0 ? axis + tensor.shape.length : axis]));
        const diff = tensor.sub(mean);
        const sqDiff = diff.mul(diff);
        const sumSqDiff = this.sum(sqDiff, axis, keepDims);
        const n = (axis === null ? tensor.data.length : tensor.shape[axis < 0 ? axis + tensor.shape.length : axis]);
        return sumSqDiff.scale(1 / (n - ddof));
    }

    static map(tensor, fn) {
        const res = new Float32Array(tensor.data.length);
        for (let i = 0; i < tensor.data.length; i++) res[i] = fn(tensor.data[i], i);
        return new Tensor(res, [...tensor.shape]);
    }

    static pad(tensor, padding, value = 0) {
        const outShape = tensor.shape.map((s, i) => s + padding[i][0] + padding[i][1]);
        const outData = new Float32Array(outShape.reduce((a, b) => a * b, 1)).fill(value);
        const rank = tensor.shape.length;
        const inStrides = this.getStrides(tensor.shape);
        const outStrides = this.getStrides(outShape);

        for (let i = 0; i < tensor.data.length; i++) {
            let rem = i, outIdx = 0;
            for (let d = 0; d < rank; d++) {
                const coord = Math.floor(rem / inStrides[d]);
                rem %= inStrides[d];
                outIdx += (coord + padding[d][0]) * outStrides[d];
            }
            outData[outIdx] = tensor.data[i];
        }
        return new Tensor(outData, outShape);
    }
}
