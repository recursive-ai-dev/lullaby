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
        const MAX_EXP_INPUT = 88.0;  // exp(88) ≈ 1.65e38, safely within Float32
        const MIN_EXP_INPUT = -88.0; // exp(-88) ≈ 6e-39, safely non-zero

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
 * 
 * Mathematical Foundation:
 * ========================
 * Gradient checking validates analytical gradients against numerical approximations.
 * 
 * Finite Difference Methods:
 * 
 * 1. Forward Difference (first-order accurate, O(h)):
 *    f'(x) ≈ [f(x + h) - f(x)] / h
 *    Error: O(h) + rounding error
 * 
 * 2. Central Difference (second-order accurate, O(h²)):
 *    f'(x) ≈ [f(x + h) - f(x - h)] / (2h)
 *    Error: O(h²) + rounding error
 * 
 * Optimal epsilon (h):
 * - Too small: dominated by rounding error
 * - Too large: truncation error dominates
 * - Optimal: h ≈ ε^(1/3) for central difference (where ε is machine epsilon)
 * - For Float64: h ≈ 1e-5 is typically good
 * 
 * Mathematical Proof of Central Difference Accuracy:
 * --------------------------------------------------
 * Taylor expansion around x:
 * f(x+h) = f(x) + hf'(x) + (h²/2)f''(x) + (h³/6)f'''(x) + O(h⁴)
 * f(x-h) = f(x) - hf'(x) + (h²/2)f''(x) - (h³/6)f'''(x) + O(h⁴)
 * 
 * Subtracting:
 * f(x+h) - f(x-h) = 2hf'(x) + 2(h³/6)f'''(x) + O(h⁵)
 * 
 * Therefore:
 * [f(x+h) - f(x-h)] / (2h) = f'(x) + (h²/3)f'''(x) + O(h⁴)
 * 
 * Error is O(h²), compared to O(h) for forward difference.
 */
export class GradientChecker {
    /**
     * Compute numerical gradient using central finite differences
     * 
     * This is the gold standard for gradient checking because:
     * - Second-order accuracy (O(h²) error)
     * - Symmetric perturbation reduces bias
     * - More reliable than forward/backward differences
     * 
     * @param {Function} fn - Function to compute gradient for (must return scalar)
     * @param {Tensor} tensor - Input tensor
     * @param {number} epsilon - Perturbation size (default: 1e-5)
     * @returns {Tensor} - Numerical gradient
     */
    static numericalGradient(fn, tensor, epsilon = 1e-5) {
        // Validation
        if (typeof fn !== 'function') {
            throw new Error('fn must be a function');
        }
        if (!tensor || !tensor.data) {
            throw new Error('tensor must be a valid Tensor');
        }
        if (!(epsilon > 0) || !Number.isFinite(epsilon)) {
            throw new Error(`epsilon must be positive and finite, got ${epsilon}`);
        }
        
        const grad = new Float32Array(tensor.data.length);

        for (let i = 0; i < tensor.data.length; i++) {
            // Store original value
            const original = tensor.data[i];
            
            // Compute f(x + epsilon)
            tensor.data[i] = original + epsilon;
            const fPlus = fn(tensor);
            
            if (!Number.isFinite(fPlus)) {
                throw new Error(`fn returned non-finite value at index ${i} (forward): ${fPlus}`);
            }

            // Compute f(x - epsilon)
            tensor.data[i] = original - epsilon;
            const fMinus = fn(tensor);
            
            if (!Number.isFinite(fMinus)) {
                throw new Error(`fn returned non-finite value at index ${i} (backward): ${fMinus}`);
            }

            // Restore original value
            tensor.data[i] = original;

            // Central difference: [f(x+h) - f(x-h)] / (2h)
            grad[i] = (fPlus - fMinus) / (2.0 * epsilon);
        }

        return new Tensor(grad, [...tensor.shape]);
    }

    /**
     * Check if analytical and numerical gradients match
     * 
     * Uses relative error metric:
     * relative_error = |analytical - numerical| / (|analytical| + |numerical| + ε)
     * 
     * This is more robust than absolute error because:
     * - Scale-invariant (works for both large and small gradients)
     * - Bounded in [0, 1]
     * - Gracefully handles near-zero gradients (via epsilon)
     * 
     * Mathematical justification:
     * ---------------------------
     * For gradients with different magnitudes, absolute error is misleading.
     * Example:
     * - grad_1: analytical=1000, numerical=1001, abs_error=1 (seems bad)
     * - grad_2: analytical=0.001, numerical=0.002, abs_error=0.001 (seems good)
     * 
     * But relative errors are:
     * - grad_1: rel_error ≈ 0.0005 (0.05%, actually good!)
     * - grad_2: rel_error ≈ 0.33 (33%, actually bad!)
     * 
     * @param {Tensor} analytical - Analytically computed gradient
     * @param {Tensor} numerical - Numerically computed gradient
     * @param {number} threshold - Maximum relative error allowed (default: 1e-4)
     * @param {boolean} verbose - Whether to print detailed error information
     * @returns {Object} - Test results including pass/fail and error statistics
     */
    static checkGradient(analytical, numerical, threshold = 1e-4, verbose = false) {
        // Validation
        if (!analytical || !analytical.data || !numerical || !numerical.data) {
            throw new Error('Both gradients must be valid Tensors');
        }
        
        if (analytical.data.length !== numerical.data.length) {
            return { 
                passed: false, 
                error: `Shape mismatch: analytical has ${analytical.data.length} elements, numerical has ${numerical.data.length}`
            };
        }
        
        if (!(threshold > 0) || !Number.isFinite(threshold)) {
            throw new Error(`threshold must be positive and finite, got ${threshold}`);
        }

        let maxRelativeError = 0.0;
        let maxAbsoluteError = 0.0;
        let errorCount = 0;
        const errors = [];
        
        // Small constant for numerical stability in relative error computation
        const epsilon = 1e-8;

        for (let i = 0; i < analytical.data.length; i++) {
            const a = analytical.data[i];
            const n = numerical.data[i];
            
            // Check for non-finite values
            if (!Number.isFinite(a) || !Number.isFinite(n)) {
                errorCount++;
                errors.push({
                    index: i,
                    analytical: a,
                    numerical: n,
                    error: 'Non-finite value detected'
                });
                continue;
            }

            // Compute absolute error
            const absoluteError = Math.abs(a - n);
            maxAbsoluteError = Math.max(maxAbsoluteError, absoluteError);
            
            // Compute relative error: |a - n| / (|a| + |n| + ε)
            const denominator = Math.abs(a) + Math.abs(n) + epsilon;
            const relativeError = absoluteError / denominator;
            
            maxRelativeError = Math.max(maxRelativeError, relativeError);

            if (relativeError > threshold) {
                errorCount++;
                errors.push({
                    index: i,
                    analytical: a,
                    numerical: n,
                    absoluteError: absoluteError,
                    relativeError: relativeError
                });
            }
        }

        const totalElements = analytical.data.length;
        const errorRate = errorCount / totalElements;
        
        // Consider test passed if:
        // 1. Less than 1% of elements have errors above threshold
        // 2. Max relative error is less than 10x threshold (allows some outliers)
        const passed = errorRate < 0.01 && maxRelativeError < threshold * 10;
        
        const result = {
            passed,
            maxRelativeError,
            maxAbsoluteError,
            errorRate,
            errorCount,
            totalElements,
            threshold
        };
        
        // Optionally include detailed errors (only if requested or test failed)
        if (verbose || !passed) {
            result.errors = errors.slice(0, 10); // Limit to first 10 errors
        }

        return result;
    }
    
    /**
     * Helper method to format gradient check results for logging
     * 
     * @param {Object} result - Result from checkGradient
     * @returns {string} - Formatted message
     */
    static formatCheckResult(result) {
        if (!result) {
            return 'No result to format';
        }
        
        const status = result.passed ? '✓ PASSED' : '✗ FAILED';
        const lines = [
            `Gradient Check: ${status}`,
            `Max Relative Error: ${result.maxRelativeError.toExponential(3)} (threshold: ${result.threshold.toExponential(3)})`,
            `Max Absolute Error: ${result.maxAbsoluteError.toExponential(3)}`,
            `Error Rate: ${(result.errorRate * 100).toFixed(2)}% (${result.errorCount}/${result.totalElements} elements)`
        ];
        
        if (result.errors && result.errors.length > 0) {
            lines.push('\nSample Errors:');
            result.errors.slice(0, 5).forEach(err => {
                if (err.error) {
                    lines.push(`  [${err.index}] ${err.error}`);
                } else {
                    lines.push(`  [${err.index}] analytical=${err.analytical.toExponential(3)}, numerical=${err.numerical.toExponential(3)}, rel_err=${err.relativeError.toExponential(3)}`);
                }
            });
        }
        
        return lines.join('\n');
    }
}

/**
 * Gradient Clipping Utilities
 * 
 * Mathematical Foundation:
 * ========================
 * Gradient clipping prevents exploding gradients in deep networks.
 * 
 * Two main approaches:
 * 
 * 1. Clipping by Global Norm:
 *    If ||g||_2 > max_norm, then g ← (max_norm / ||g||_2) * g
 *    
 *    Mathematical justification:
 *    - Preserves gradient direction (only scales magnitude)
 *    - Ensures ||g||_2 ≤ max_norm
 *    - Smooth operation (differentiable at all points except g=0)
 * 
 * 2. Clipping by Value:
 *    g_i ← clamp(g_i, -clip_value, clip_value)
 *    
 *    Mathematical justification:
 *    - Bounds individual gradient components
 *    - Can change gradient direction (less principled than norm clipping)
 *    - Simpler, but may be too aggressive
 * 
 * Proof that norm clipping preserves direction:
 * ----------------------------------------------
 * Let g' = (c/||g||) * g where c = max_norm
 * Then g'/||g'|| = g/||g|| (same unit vector)
 * And ||g'|| = c (desired norm)
 */
export class GradientClipper {
    /**
     * Clip gradients by global L2 norm
     * 
     * Algorithm:
     * 1. Compute global norm: ||g||_2 = √(Σ_i Σ_j g_{i,j}²)
     * 2. If ||g||_2 > max_norm:
     *    - scale = max_norm / (||g||_2 + ε)
     *    - g ← scale * g
     * 
     * @param {Array<Tensor>} parameters - Array of parameters with gradients
     * @param {number} maxNorm - Maximum allowed gradient norm
     * @returns {number} - The computed global norm (before clipping)
     */
    static clipByGlobalNorm(parameters, maxNorm) {
        // Validation
        if (!Array.isArray(parameters)) {
            throw new Error('clipByGlobalNorm requires an array of parameters');
        }
        if (!(maxNorm > 0) || !Number.isFinite(maxNorm)) {
            throw new Error(`maxNorm must be positive and finite, got ${maxNorm}`);
        }
        
        // Compute global norm: ||g||_2 = √(Σ g_i²)
        let globalNormSquared = 0.0;
        let validGradCount = 0;
        
        for (const param of parameters) {
            if (param && param.grad) {
                for (let i = 0; i < param.grad.length; i++) {
                    const g = param.grad[i];
                    if (Number.isFinite(g)) {
                        globalNormSquared += g * g;
                        validGradCount++;
                    }
                }
            }
        }
        
        const globalNorm = Math.sqrt(globalNormSquared);
        
        // Validation: Check for NaN/Inf in global norm
        if (!Number.isFinite(globalNorm)) {
            console.warn('Non-finite global norm detected. Gradients may contain NaN/Inf.');
            // Reset gradients to zero as a safety measure
            for (const param of parameters) {
                if (param && param.grad) {
                    param.grad.fill(0);
                }
            }
            return NaN;
        }
        
        // Clip if necessary
        if (globalNorm > maxNorm) {
            // Compute scaling factor: scale = max_norm / (||g|| + ε)
            // Adding epsilon prevents division by zero (though we already checked)
            const clipCoef = maxNorm / (globalNorm + 1e-6);
            
            // Apply clipping: g ← scale * g
            for (const param of parameters) {
                if (param && param.grad) {
                    for (let i = 0; i < param.grad.length; i++) {
                        if (Number.isFinite(param.grad[i])) {
                            param.grad[i] *= clipCoef;
                        } else {
                            param.grad[i] = 0; // Reset non-finite gradients
                        }
                    }
                }
            }
        }

        return globalNorm;
    }

    /**
     * Clip gradients by value (element-wise)
     * 
     * Algorithm:
     * For each gradient element g_i:
     *   g_i ← clamp(g_i, -clip_value, clip_value)
     * 
     * Mathematical note:
     * This can change the gradient direction, unlike norm clipping.
     * Use when you want to bound individual gradient magnitudes.
     * 
     * @param {Array<Tensor>} parameters - Array of parameters with gradients
     * @param {number} clipValue - Maximum absolute value for gradients
     * @returns {number} - Count of clipped gradient elements
     */
    static clipByValue(parameters, clipValue) {
        // Validation
        if (!Array.isArray(parameters)) {
            throw new Error('clipByValue requires an array of parameters');
        }
        if (!(clipValue > 0) || !Number.isFinite(clipValue)) {
            throw new Error(`clipValue must be positive and finite, got ${clipValue}`);
        }
        
        let clippedCount = 0;
        
        for (const param of parameters) {
            if (param && param.grad) {
                for (let i = 0; i < param.grad.length; i++) {
                    const g = param.grad[i];
                    
                    if (!Number.isFinite(g)) {
                        // Reset non-finite gradients
                        param.grad[i] = 0;
                        clippedCount++;
                    } else if (Math.abs(g) > clipValue) {
                        // Clip to [-clipValue, clipValue]
                        param.grad[i] = Math.max(-clipValue, Math.min(clipValue, g));
                        clippedCount++;
                    }
                }
            }
        }
        
        return clippedCount;
    }
    
    /**
     * Adaptive gradient clipping (AGC)
     * 
     * Clips gradients based on the ratio of gradient norm to parameter norm.
     * This is more adaptive than fixed clipping.
     * 
     * Algorithm:
     * For each parameter p with gradient g:
     *   clip_norm = lambda * ||p|| / (||g|| + ε)
     *   if clip_norm < 1:
     *     g ← clip_norm * g
     * 
     * Mathematical justification:
     * - Prevents gradients from being too large relative to parameters
     * - Adaptive to parameter scale
     * - Used in modern architectures (NFNets, etc.)
     * 
     * @param {Array<Tensor>} parameters - Array of parameters with gradients
     * @param {number} lambda - Clipping factor (typically 0.01 - 0.1)
     * @param {number} epsilon - Small constant for numerical stability
     * @returns {number} - Number of parameters that were clipped
     */
    static adaptiveGradientClipping(parameters, lambda = 0.01, epsilon = 1e-3) {
        // Validation
        if (!Array.isArray(parameters)) {
            throw new Error('adaptiveGradientClipping requires an array of parameters');
        }
        if (!(lambda > 0) || !Number.isFinite(lambda)) {
            throw new Error(`lambda must be positive and finite, got ${lambda}`);
        }
        
        let clippedCount = 0;
        
        for (const param of parameters) {
            if (!param || !param.grad || !param.data) {
                continue;
            }
            
            // Compute parameter norm: ||p||_2
            let paramNormSquared = 0;
            for (let i = 0; i < param.data.length; i++) {
                const p = param.data[i];
                if (Number.isFinite(p)) {
                    paramNormSquared += p * p;
                }
            }
            const paramNorm = Math.sqrt(paramNormSquared);
            
            // Compute gradient norm: ||g||_2
            let gradNormSquared = 0;
            for (let i = 0; i < param.grad.length; i++) {
                const g = param.grad[i];
                if (Number.isFinite(g)) {
                    gradNormSquared += g * g;
                }
            }
            const gradNorm = Math.sqrt(gradNormSquared);
            
            // Skip if either norm is invalid or zero
            if (!Number.isFinite(paramNorm) || !Number.isFinite(gradNorm) || gradNorm < epsilon) {
                continue;
            }
            
            // Compute adaptive clipping coefficient
            const clipNorm = (lambda * paramNorm) / (gradNorm + epsilon);
            
            // Clip if coefficient < 1
            if (clipNorm < 1.0) {
                for (let i = 0; i < param.grad.length; i++) {
                    if (Number.isFinite(param.grad[i])) {
                        param.grad[i] *= clipNorm;
                    }
                }
                clippedCount++;
            }
        }
        
        return clippedCount;
    }
}
