import { describe, it, expect } from 'vitest';
import { Tensor } from '../modules/tensor.js';
import { Linear, LayerNorm, BayesianLinear, MultiHeadAttention } from '../modules/layers.js';

describe('Layers', () => {
    it('should create and forward Linear layer', () => {
        const linear = new Linear(10, 5);
        const input = Tensor.zeros([2, 10]); // batch 2, inDim 10
        const output = linear.forward(input);
        expect(output.shape).toEqual([2, 5]);

        // Since input is zeros, output should be just biases which are initialized to 0
        const allZeros = Array.from(output.data).every(val => val === 0);
        expect(allZeros).toBe(true);
    });

    it('should create and forward LayerNorm layer', () => {
        const layerNorm = new LayerNorm(4);
        const input = Tensor.fromArray([[1.0, 2.0, 3.0, 4.0]]);
        const output = layerNorm.forward(input);

        expect(output.shape).toEqual([1, 4]);

        // Mean is 2.5, variance is 1.25. (1-2.5)/sqrt(1.25+eps) = -1.5/1.118 = -1.3416
        expect(output.data[0]).toBeCloseTo(-1.3416, 3);
        expect(output.data[3]).toBeCloseTo(1.3416, 3);
    });

    it('should create and forward BayesianLinear layer', () => {
        const bayesianLinear = new BayesianLinear(10, 5);
        const input = Tensor.zeros([2, 10]);
        const output = bayesianLinear.forward(input);

        expect(output.shape).toEqual([2, 5]);
        // Because of the random epsilon and non-zero bias_rho, the bias is added, which has non-zero random component
    });

    it('should create and forward MultiHeadAttention layer', () => {
        const mha = new MultiHeadAttention(16, 4); // dModel=16, numHeads=4 -> dHead=4
        const input = Tensor.randn([2, 5, 16]); // batch=2, seqLen=5, dModel=16
        const output = mha.forward(input);

        expect(output.shape).toEqual([2, 5, 16]);
    });
});
