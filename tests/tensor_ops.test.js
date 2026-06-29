import { describe, it, expect } from 'vitest';
import { Tensor } from '../modules/tensor.js';
import { TensorOps } from '../modules/tensor_ops.js';

describe('TensorOps', () => {
    it('should concat tensors along axis 0', () => {
        const a = Tensor.fromArray([[1, 2]]);
        const b = Tensor.fromArray([[3, 4]]);
        const c = TensorOps.concat([a, b], 0);
        expect(c.shape).toEqual([2, 2]);
        expect(Array.from(c.data)).toEqual([1, 2, 3, 4]);
    });

    it('should split tensors', () => {
        const t = Tensor.fromArray([[1, 2], [3, 4]]);
        const parts = TensorOps.split(t, 2, 0); // Split into 2 parts along axis 0
        expect(parts.length).toBe(2);
        expect(parts[0].shape).toEqual([1, 2]);
        expect(Array.from(parts[0].data)).toEqual([1, 2]);
        expect(parts[1].shape).toEqual([1, 2]);
        expect(Array.from(parts[1].data)).toEqual([3, 4]);
    });

    it('should calculate sum', () => {
        const t = Tensor.fromArray([[1, 2], [3, 4]]);
        // Sum all elements
        expect(TensorOps.sum(t)).toBe(10);

        // Sum along axis 0
        const sumAxis0 = TensorOps.sum(t, 0);
        expect(sumAxis0.shape).toEqual([2]);
        expect(Array.from(sumAxis0.data)).toEqual([4, 6]);

        // Sum along axis 1
        const sumAxis1 = TensorOps.sum(t, 1);
        expect(sumAxis1.shape).toEqual([2]);
        expect(Array.from(sumAxis1.data)).toEqual([3, 7]);
    });

    it('should calculate max and min', () => {
        const t = Tensor.fromArray([1, 5, 2, 9, 3]);
        expect(TensorOps.max(t)).toBe(9);
        expect(TensorOps.min(t)).toBe(1);
    });

    it('should calculate variance', () => {
        const t = Tensor.fromArray([2, 4, 4, 4, 5, 5, 7, 9]); // 8 elements
        // Mean = 40 / 8 = 5
        // Variance (population) = ((2-5)^2 + (4-5)^2*3 + (5-5)^2*2 + (7-5)^2 + (9-5)^2) / 8
        // = (9 + 3 + 0 + 4 + 16) / 8 = 32 / 8 = 4
        // With ddof = 0
        expect(TensorOps.variance(t, null, false, 0)).toBeCloseTo(4, 5);

        // With ddof = 1 (sample variance) = 32 / 7
        expect(TensorOps.variance(t, null, false, 1)).toBeCloseTo(32/7, 5);
    });
});
