import { Tensor } from './tensor.js';

/**
 * LULLABY WEIGHT INITIALIZATION (VERSION 3.0)
 * Production-grade weight initialization strategies for deep neural networks.
 *
 * Strategies included:
 * - Xavier (Glorot) Normal/Uniform: Optimized for Tanh/Sigmoid.
 * - He (Kaiming) Normal/Uniform: Optimized for ReLU/LeakyReLU/GELU.
 * - Orthogonal: Preserves norm, prevents vanishing/exploding gradients.
 * - Sparse: High-entropy initial states for RNNs/Transformers.
 */
export class Initializer {
    /** Xavier/Glorot Initialization (Balanced variance for forward/backward) */
    static xavierNormal(shape) {
        const { fanIn, fanOut } = this.calculateFan(shape);
        const std = Math.sqrt(2.0 / (fanIn + fanOut));
        return Tensor.randn(shape, 0.0, std);
    }

    static xavierUniform(shape) {
        const { fanIn, fanOut } = this.calculateFan(shape);
        const limit = Math.sqrt(6.0 / (fanIn + fanOut));
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * limit;
        return new Tensor(data, shape);
    }

    /** He/Kaiming Initialization (Optimized for ReLU-like activations) */
    static heNormal(shape) {
        const { fanIn } = this.calculateFan(shape);
        const std = Math.sqrt(2.0 / fanIn);
        return Tensor.randn(shape, 0.0, std);
    }

    static heUniform(shape) {
        const { fanIn } = this.calculateFan(shape);
        const limit = Math.sqrt(6.0 / fanIn);
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * limit;
        return new Tensor(data, shape);
    }

    /**
     * Orthogonal Initialization
     * Uses Gram-Schmidt process to create an orthonormal basis.
     */
    static orthogonal(shape, gain = 1.0) {
        if (shape.length !== 2) throw new Error("Orthogonal init requires 2D shape [rows, cols]");
        const [rows, cols] = shape;
        const flat = Tensor.randn(shape, 0, 1).data;
        
        // Gram-Schmidt
        for (let j = 0; j < cols; j++) {
            for (let k = 0; k < j; k++) {
                let dot = 0;
                for (let i = 0; i < rows; i++) dot += flat[i * cols + j] * flat[i * cols + k];
                for (let i = 0; i < rows; i++) flat[i * cols + j] -= dot * flat[i * cols + k];
            }
            let norm = 0;
            for (let i = 0; i < rows; i++) norm += Math.pow(flat[i * cols + j], 2);
            norm = Math.sqrt(norm);
            const scale = gain / (norm + 1e-10);
            for (let i = 0; i < rows; i++) flat[i * cols + j] *= scale;
        }
        return new Tensor(flat, shape);
    }

    /** Sparse Initialization (e.g., for RNN hidden states) */
    static sparse(shape, sparsity = 0.1, std = 0.01) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            if (Math.random() < sparsity) {
                // Box-Muller
                let u1 = Math.random(), u2 = Math.random();
                data[i] = Math.sqrt(-2.0 * Math.log(u1 + 1e-10)) * Math.cos(2.0 * Math.PI * u2) * std;
            }
        }
        return new Tensor(data, shape);
    }

    /** Helper to calculate fan-in and fan-out */
    static calculateFan(shape) {
        if (shape.length < 2) return { fanIn: shape[0] || 1, fanOut: shape[0] || 1 };
        if (shape.length === 2) return { fanIn: shape[0], fanOut: shape[1] };
        
        // Higher dimension logic (Convolutional/Attention)
        const fanIn = shape.slice(0, -1).reduce((a, b) => a * b, 1);
        const fanOut = shape[shape.length - 1];
        return { fanIn, fanOut };
    }
}
