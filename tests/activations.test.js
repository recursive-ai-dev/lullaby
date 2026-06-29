import { describe, it, expect } from 'vitest';
import { Tensor } from '../modules/tensor.js';
import { GELU, Swish, Mish, ReLU, LeakyReLU, Sigmoid, Tanh } from '../modules/activations.js';

describe('Activations', () => {
    it('should calculate GELU correctly', () => {
        const gelu = new GELU();
        const t = Tensor.fromArray([-1.0, 0.0, 1.0]);
        const res = gelu.forward(t);
        // Approximation formula test: 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
        const expectedFor1 = 0.5 * 1.0 * (1 + Math.tanh(Math.sqrt(2/Math.PI) * (1.0 + 0.044715 * 1.0)));
        expect(res.data[2]).toBeCloseTo(expectedFor1, 5);
        expect(res.data[1]).toBeCloseTo(0.0, 5); // 0.0
    });

    it('should calculate Swish correctly', () => {
        const swish = new Swish();
        const t = Tensor.fromArray([-1.0, 0.0, 1.0]);
        const res = swish.forward(t);
        // Formula: x * sigmoid(x)
        const expectedFor1 = 1.0 * (1.0 / (1.0 + Math.exp(-1.0)));
        expect(res.data[2]).toBeCloseTo(expectedFor1, 5);
        expect(res.data[1]).toBeCloseTo(0.0, 5); // 0.0
    });

    it('should calculate Mish correctly', () => {
        const mish = new Mish();
        const t = Tensor.fromArray([-1.0, 0.0, 1.0]);
        const res = mish.forward(t);
        // Formula: x * tanh(softplus(x))
        const softplus1 = Math.log(1 + Math.exp(1.0));
        const expectedFor1 = 1.0 * Math.tanh(softplus1);
        expect(res.data[2]).toBeCloseTo(expectedFor1, 5);
        expect(res.data[1]).toBeCloseTo(0.0, 5); // 0.0
    });

    it('should calculate ReLU correctly', () => {
        const relu = new ReLU();
        const t = Tensor.fromArray([-1.0, 0.0, 1.0]);
        const res = relu.forward(t);
        expect(res.data[0]).toBe(0.0);
        expect(res.data[1]).toBe(0.0);
        expect(res.data[2]).toBe(1.0);
    });

    it('should calculate LeakyReLU correctly', () => {
        const leakyRelu = new LeakyReLU(0.01);
        const t = Tensor.fromArray([-1.0, 0.0, 1.0]);
        const res = leakyRelu.forward(t);
        expect(res.data[0]).toBeCloseTo(-0.01, 5);
        expect(res.data[1]).toBe(0.0);
        expect(res.data[2]).toBe(1.0);
    });

    it('should calculate Sigmoid correctly', () => {
        const sigmoid = new Sigmoid();
        const t = Tensor.fromArray([-1.0, 0.0, 1.0]);
        const res = sigmoid.forward(t);
        expect(res.data[0]).toBeCloseTo(1.0 / (1.0 + Math.exp(1.0)), 5);
        expect(res.data[1]).toBeCloseTo(0.5, 5);
        expect(res.data[2]).toBeCloseTo(1.0 / (1.0 + Math.exp(-1.0)), 5);
    });

    it('should calculate Tanh correctly', () => {
        const tanh = new Tanh();
        const t = Tensor.fromArray([-1.0, 0.0, 1.0]);
        const res = tanh.forward(t);
        expect(res.data[0]).toBeCloseTo(Math.tanh(-1.0), 5);
        expect(res.data[1]).toBeCloseTo(0.0, 5);
        expect(res.data[2]).toBeCloseTo(Math.tanh(1.0), 5);
    });
});
