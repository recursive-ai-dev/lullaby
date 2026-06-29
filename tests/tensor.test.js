import { describe, it, expect } from 'vitest';
import { Tensor } from '../modules/tensor.js';

describe('Tensor', () => {
    it('should create zeros tensor', () => {
        const t = Tensor.zeros([2, 3]);
        expect(t.shape).toEqual([2, 3]);
        expect(t.data.length).toBe(6);
        expect(Array.from(t.data)).toEqual([0, 0, 0, 0, 0, 0]);
    });

    it('should create ones tensor', () => {
        const t = Tensor.ones([2, 2]);
        expect(t.shape).toEqual([2, 2]);
        expect(Array.from(t.data)).toEqual([1, 1, 1, 1]);
    });

    it('should create randn tensor with approximate mean and std', () => {
        const t = Tensor.randn([1000]);
        let sum = 0;
        for (let i = 0; i < t.data.length; i++) {
            sum += t.data[i];
        }
        const mean = sum / t.data.length;

        let sumSq = 0;
        for (let i = 0; i < t.data.length; i++) {
            sumSq += Math.pow(t.data[i] - mean, 2);
        }
        const std = Math.sqrt(sumSq / t.data.length);

        expect(mean).toBeCloseTo(0, 1);
        expect(std).toBeCloseTo(1, 1);
    });

    it('should create tensor from array', () => {
        const arr = [[1, 2], [3, 4]];
        const t = Tensor.fromArray(arr);
        expect(t.shape).toEqual([2, 2]);
        expect(Array.from(t.data)).toEqual([1, 2, 3, 4]);
    });

    it('should perform matmul correctly', () => {
        const a = Tensor.fromArray([[1, 2], [3, 4]]); // 2x2
        const b = Tensor.fromArray([[5, 6], [7, 8]]); // 2x2
        const c = a.matmul(b);
        // [1*5+2*7, 1*6+2*8] -> [19, 22]
        // [3*5+4*7, 3*6+4*8] -> [43, 50]
        expect(c.shape).toEqual([2, 2]);
        expect(Array.from(c.data)).toEqual([19, 22, 43, 50]);
    });

    it('should add tensors', () => {
        const a = Tensor.fromArray([1, 2, 3]);
        const b = Tensor.fromArray([4, 5, 6]);
        const c = a.add(b);
        expect(Array.from(c.data)).toEqual([5, 7, 9]);
    });

    it('should subtract tensors', () => {
        const a = Tensor.fromArray([4, 5, 6]);
        const b = Tensor.fromArray([1, 2, 3]);
        const c = a.sub(b);
        expect(Array.from(c.data)).toEqual([3, 3, 3]);
    });

    it('should calculate softmax', () => {
        // [1, 2, 3] -> exp(1), exp(2), exp(3) -> approx 0.09, 0.24, 0.66
        const a = Tensor.fromArray([1, 2, 3]);
        const b = a.softmax();

        const sum = Array.from(b.data).reduce((acc, val) => acc + val, 0);
        expect(sum).toBeCloseTo(1, 5); // Sum should be 1
        expect(b.data[0]).toBeCloseTo(Math.exp(1) / (Math.exp(1) + Math.exp(2) + Math.exp(3)), 4);
    });
});
