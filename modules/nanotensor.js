import { Tensor } from './tensor.js';

/**
 * NANOTENSOR UTILITIES (VERSION 3.0)
 * Production-grade gradient management and debugging tools.
 */

/** Gradient Checking: Numerical vs Analytical Verification */
export class GradientChecker {
    /**
     * @param {Function} func - Forward function returning loss
     * @param {Tensor[]} params - Tensors to check
     * @param {number} epsilon - Perturbation step
     */
    static check(func, params, epsilon = 1e-4) {
        console.log("[GradCheck] Starting numerical verification...");
        
        for (let pIdx = 0; pIdx < params.length; pIdx++) {
            const p = params[pIdx];
            if (!p.grad) continue;

            const analytical = p.grad;
            const numerical = new Float32Array(p.data.length);

            for (let i = 0; i < p.data.length; i++) {
                const orig = p.data[i];

                // Loss at +eps
                p.data[i] = orig + epsilon;
                const lossPlus = func();

                // Loss at -eps
                p.data[i] = orig - epsilon;
                const lossMinus = func();

                p.data[i] = orig; // Restore

                numerical[i] = (lossPlus - lossMinus) / (2 * epsilon);
            }

            // Calculate relative error: |a - n| / max(|a|, |n|)
            let maxRelError = 0;
            for (let i = 0; i < p.data.length; i++) {
                const diff = Math.abs(analytical[i] - numerical[i]);
                const denom = Math.max(Math.abs(analytical[i]), Math.abs(numerical[i])) + 1e-10;
                maxRelError = Math.max(maxRelError, diff / denom);
            }

            if (maxRelError > 1e-2) {
                console.warn(`[GradCheck] FAILED for Param ${pIdx}. Max relative error: ${maxRelError.toExponential(4)}`);
            } else {
                console.log(`[GradCheck] PASSED for Param ${pIdx}. Error: ${maxRelError.toExponential(4)}`);
            }
        }
    }
}

/** Gradient Clipping: Exploding Gradient Protection */
export class GradientClipper {
    /**
     * Global Norm Clipping
     * scale = min(1, threshold / ||grad||)
     */
    static clipByGlobalNorm(params, threshold = 1.0) {
        let sumSq = 0;
        for (const p of params) {
            if (!p.grad) continue;
            for (let i = 0; i < p.grad.length; i++) sumSq += p.grad[i] * p.grad[i];
        }
        
        const norm = Math.sqrt(sumSq);
        if (norm > threshold) {
            const scale = threshold / (norm + 1e-10);
            for (const p of params) {
                if (!p.grad) continue;
                for (let i = 0; i < p.grad.length; i++) p.grad[i] *= scale;
            }
        }
        return norm;
    }

    /** Simple Element-wise Clipping */
    static clipByValue(params, limit = 5.0) {
        for (const p of params) {
            if (!p.grad) continue;
            for (let i = 0; i < p.grad.length; i++) {
                p.grad[i] = Math.max(-limit, Math.min(limit, p.grad[i]));
            }
        }
    }
}
