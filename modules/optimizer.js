/**
 * @fileoverview LULLABY OPTIMIZERS
 * Production-grade optimization algorithms for deep learning.
 *
 * Features:
 * - Adam: Adaptive Moment Estimation with bias correction and weight decay.
 * - SGD: Stochastic Gradient Descent with Nesterov momentum.
 * - Schedulers: Cosine decay with linear warmup.
 */

/**
 * Adam Optimizer (Adaptive Moment Estimation)
 * Implements Adam with weight decay (AdamW style) and numerical stability guards.
 */
export class AdamOptimizer {
    /**
     * @param {Tensor[]} params - List of tensors to optimize.
     * @param {number} lr - Base learning rate.
     * @param {number} beta1 - Decay rate for first moment.
     * @param {number} beta2 - Decay rate for second moment.
     * @param {number} eps - Epsilon for numerical stability.
     * @param {number} weightDecay - L2 regularization factor.
     */
    constructor(params, lr = 0.001, beta1 = 0.9, beta2 = 0.999, eps = 1e-8, weightDecay = 0.01) {
        this.params = params;
        this.baseLR = lr;
        this.beta1 = beta1;
        this.beta2 = beta2;
        this.eps = eps;
        this.weightDecay = weightDecay;
        this.t = 0;

        // Moment buffers
        this.m = params.map(p => new Float32Array(p.data.length));
        this.v = params.map(p => new Float32Array(p.data.length));
    }

    /**
     * Learning rate scheduler: Linear warmup followed by Cosine Decay.
     */
    getLearningRate(step, totalSteps = 10000) {
        const warmup = 100;
        if (step < warmup) return this.baseLR * (step / warmup);

        const progress = Math.min(1.0, (step - warmup) / (totalSteps - warmup));
        return this.baseLR * 0.5 * (1.0 + Math.cos(Math.PI * progress));
    }

    /**
     * Perform a single optimization step.
     */
    step(epoch, totalEpochs, manualLr = null) {
        this.t++;
        const lr = manualLr !== null ? manualLr : this.getLearningRate(this.t, totalEpochs * 100);

        for (let i = 0; i < this.params.length; i++) {
            const p = this.params[i];
            const grad = p.grad;
            if (!grad) continue;

            const m = this.m[i];
            const v = this.v[i];
            const data = p.data;

            for (let j = 0; j < data.length; j++) {
                let g = grad[j];

                // Weight Decay (AdamW)
                if (this.weightDecay > 0) {
                    data[j] -= lr * this.weightDecay * data[j];
                }

                // Update biased moment estimates
                m[j] = this.beta1 * m[j] + (1.0 - this.beta1) * g;
                v[j] = this.beta2 * v[j] + (1.0 - this.beta2) * g * g;

                // Bias correction
                const mHat = m[j] / (1.0 - Math.pow(this.beta1, this.t));
                const vHat = v[j] / (1.0 - Math.pow(this.beta2, this.t));

                // Update parameters
                data[j] -= lr * mHat / (Math.sqrt(vHat) + this.eps);
            }
        }
    }

    zeroGrad() {
        for (const p of this.params) p.zeroGrad();
    }

    serialize() {
        return {
            t: this.t,
            m: this.m.map(arr => Array.from(arr)),
            v: this.v.map(arr => Array.from(arr))
        };
    }

    loadState(state) {
        if (!state) return;
        this.t = state.t || 0;
        if (state.m) state.m.forEach((arr, i) => { if (this.m[i]) this.m[i].set(arr); });
        if (state.v) state.v.forEach((arr, i) => { if (this.v[i]) this.v[i].set(arr); });
    }
}

/**
 * SGD Optimizer with Momentum
 */
export class SGDOptimizer {
    constructor(params, lr = 0.01, momentum = 0.9, nesterov = true) {
        this.params = params;
        this.lr = lr;
        this.momentum = momentum;
        this.nesterov = nesterov;
        this.v = params.map(p => new Float32Array(p.data.length));
    }

    step() {
        for (let i = 0; i < this.params.length; i++) {
            const p = this.params[i];
            if (!p.grad) continue;

            const v = this.v[i];
            const data = p.data;
            const grad = p.grad;

            for (let j = 0; j < data.length; j++) {
                v[j] = this.momentum * v[j] + grad[j];
                if (this.nesterov) {
                    data[j] -= this.lr * (grad[j] + this.momentum * v[j]);
                } else {
                    data[j] -= this.lr * v[j];
                }
            }
        }
    }

    zeroGrad() {
        for (const p of this.params) p.zeroGrad();
    }
}
