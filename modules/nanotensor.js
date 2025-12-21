import { Tensor } from './tensor.js';

/**
 * NanoTensor: A lightweight tensor wrapper for specialized operations
 * Provides additional mathematical utilities and validation helpers
 */
export class NanoTensor extends Tensor {
    constructor(data, shape) {
        super(data, shape);
        this.requiresGrad = false;
        this.gradFn = null;
    }

    /**
     * Enable gradient computation for this tensor
     */
    enableGrad() {
        this.requiresGrad = true;
        return this;
    }

    /**
     * Clamp values to a specified range
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     */
    clamp(min = -Infinity, max = Infinity) {
        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) {
            res[i] = Math.max(min, Math.min(max, this.data[i]));
        }
        return new NanoTensor(res, [...this.shape]);
    }

    /**
     * Apply element-wise square root
     * Note: Clamps negative values to 0 for numerical safety. 
     * For mathematical correctness with negative values, use complex numbers.
     */
    sqrt() {
        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) {
            // Clamp to prevent NaN from negative values due to floating-point errors
            res[i] = Math.sqrt(Math.max(0, this.data[i]));
        }
        return new NanoTensor(res, [...this.shape]);
    }

    /**
     * Apply element-wise square
     */
    square() {
        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) {
            res[i] = this.data[i] * this.data[i];
        }
        return new NanoTensor(res, [...this.shape]);
    }

    /**
     * Compute L2 norm (Frobenius norm for matrices)
     */
    norm() {
        let sum = 0.0;
        for (let i = 0; i < this.data.length; i++) {
            sum += this.data[i] * this.data[i];
        }
        return Math.sqrt(sum);
    }

    /**
     * Apply element-wise absolute value
     */
    abs() {
        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) {
            res[i] = Math.abs(this.data[i]);
        }
        return new NanoTensor(res, [...this.shape]);
    }

    /**
     * Apply element-wise exponential with numerical stability
     * 
     * Mathematical bounds for IEEE 754 double-precision:
     * - exp(709.78) ≈ 1.79e308 (max finite float64)
     * - exp(-745.13) ≈ 5e-324 (min subnormal)
     * 
     * Using conservative bounds [-700, 700] to prevent:
     * - Overflow to Infinity (which causes NaN when multiplied by 0)
     * - Underflow to 0 (which can cause division by zero)
     */
    exp() {
        const MAX_EXP_INPUT = 700;  // exp(700) ≈ 1e304, safely finite
        const MIN_EXP_INPUT = -700; // exp(-700) ≈ 1e-304, safely non-zero

        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) {
            // Clamp input to prevent overflow/underflow
            const clamped = Math.max(MIN_EXP_INPUT, Math.min(MAX_EXP_INPUT, this.data[i]));
            res[i] = Math.exp(clamped);
        }
        return new NanoTensor(res, [...this.shape]);
    }

    /**
     * Apply element-wise logarithm (natural log)
     */
    log() {
        const res = new Float32Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) {
            res[i] = Math.log(Math.max(1e-10, this.data[i])); // Prevent log(0)
        }
        return new NanoTensor(res, [...this.shape]);
    }

    /**
     * Compute mean across all elements
     */
    mean() {
        let sum = 0.0;
        for (let i = 0; i < this.data.length; i++) {
            sum += this.data[i];
        }
        return sum / this.data.length;
    }

    /**
     * Compute standard deviation across all elements
     */
    std() {
        const m = this.mean();
        let sum = 0.0;
        for (let i = 0; i < this.data.length; i++) {
            const diff = this.data[i] - m;
            sum += diff * diff;
        }
        return Math.sqrt(sum / this.data.length);
    }

    /**
     * Create a NanoTensor from a regular Tensor
     */
    static fromTensor(tensor) {
        return new NanoTensor(new Float32Array(tensor.data), [...tensor.shape]);
    }

    /**
     * Create NanoTensor with zeros
     */
    static zeros(shape) {
        const size = shape.reduce((a, b) => a * b, 1);
        return new NanoTensor(new Float32Array(size), shape);
    }

    /**
     * Create NanoTensor with ones
     */
    static ones(shape) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        data.fill(1.0);
        return new NanoTensor(data, shape);
    }

    /**
     * Create NanoTensor with random normal distribution
     * Uses improved Box-Muller transform with validation
     */
    static randn(shape, mean = 0.0, std = 0.02) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);

        for (let i = 0; i < size; i += 2) {
            // Box-Muller transform - generate two independent normal samples
            let u1, u2;
            do {
                u1 = Math.random();
                u2 = Math.random();
            } while (u1 <= 1e-10); // Ensure u1 > 0 to avoid log(0)

            const mag = std * Math.sqrt(-2.0 * Math.log(u1));
            const z0 = mag * Math.cos(2.0 * Math.PI * u2) + mean;
            const z1 = mag * Math.sin(2.0 * Math.PI * u2) + mean;

            data[i] = z0;
            if (i + 1 < size) {
                data[i + 1] = z1;
            }
        }

        return new NanoTensor(data, shape);
    }

    /**
     * Create NanoTensor with uniform random distribution
     */
    static uniform(shape, min = 0.0, max = 1.0) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        const range = max - min;
        for (let i = 0; i < size; i++) {
            data[i] = min + Math.random() * range;
        }
        return new NanoTensor(data, shape);
    }
}

/**
 * Gradient Utilities for numerical validation
 */
export class GradientChecker {
    /**
     * Compute numerical gradient using finite differences
     * @param {Function} fn - Function to compute gradient for
     * @param {Tensor} tensor - Input tensor
     * @param {number} epsilon - Small perturbation for finite differences
     */
    static numericalGradient(fn, tensor, epsilon = 1e-5) {
        const grad = new Float32Array(tensor.data.length);

        for (let i = 0; i < tensor.data.length; i++) {
            // f(x + epsilon)
            const original = tensor.data[i];
            tensor.data[i] = original + epsilon;
            const fPlus = fn(tensor);

            // f(x - epsilon)
            tensor.data[i] = original - epsilon;
            const fMinus = fn(tensor);

            // Restore original value
            tensor.data[i] = original;

            // Central difference: (f(x+h) - f(x-h)) / (2h)
            grad[i] = (fPlus - fMinus) / (2.0 * epsilon);
        }

        return new Tensor(grad, [...tensor.shape]);
    }

    /**
     * Check if analytical and numerical gradients match
     * @param {Tensor} analytical - Analytically computed gradient
     * @param {Tensor} numerical - Numerically computed gradient
     * @param {number} threshold - Maximum relative error allowed
     */
    static checkGradient(analytical, numerical, threshold = 1e-4) {
        if (analytical.data.length !== numerical.data.length) {
            return { passed: false, error: 'Shape mismatch' };
        }

        let maxRelativeError = 0.0;
        let errorCount = 0;

        for (let i = 0; i < analytical.data.length; i++) {
            const a = analytical.data[i];
            const n = numerical.data[i];

            // Relative error: |a - n| / (|a| + |n| + epsilon)
            const relativeError = Math.abs(a - n) / (Math.abs(a) + Math.abs(n) + 1e-8);

            if (relativeError > threshold) {
                errorCount++;
            }

            maxRelativeError = Math.max(maxRelativeError, relativeError);
        }

        const errorRate = errorCount / analytical.data.length;
        const passed = errorRate < 0.01 && maxRelativeError < threshold * 10;

        return {
            passed,
            maxRelativeError,
            errorRate,
            errorCount
        };
    }
}

/**
 * Gradient Clipping Utilities
 */
export class GradientClipper {
    /**
     * Clip gradients by global norm
     * @param {Array<Tensor>} parameters - Array of parameters with gradients
     * @param {number} maxNorm - Maximum allowed gradient norm
     */
    static clipByGlobalNorm(parameters, maxNorm) {
        // Compute global norm
        let globalNorm = 0.0;
        for (const param of parameters) {
            if (param.grad) {
                for (let i = 0; i < param.grad.length; i++) {
                    globalNorm += param.grad[i] * param.grad[i];
                }
            }
        }
        globalNorm = Math.sqrt(globalNorm);

        // Clip if necessary
        if (globalNorm > maxNorm) {
            const clipCoef = maxNorm / (globalNorm + 1e-6);
            for (const param of parameters) {
                if (param.grad) {
                    for (let i = 0; i < param.grad.length; i++) {
                        param.grad[i] *= clipCoef;
                    }
                }
            }
        }

        return globalNorm;
    }

    /**
     * Clip gradients by value
     * @param {Array<Tensor>} parameters - Array of parameters with gradients
     * @param {number} clipValue - Maximum absolute value for gradients
     */
    static clipByValue(parameters, clipValue) {
        for (const param of parameters) {
            if (param.grad) {
                for (let i = 0; i < param.grad.length; i++) {
                    param.grad[i] = Math.max(-clipValue, Math.min(clipValue, param.grad[i]));
                }
            }
        }
    }
}
