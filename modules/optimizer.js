/**
 * LULLABY OPTIMIZERS (VERSION 3.0)
 * Production-grade optimization algorithms for neural networks.
 *
 * Implements AdamW (Adam with decoupled weight decay) and SGDM (Stochastic
 * Gradient Descent with Momentum).
 */

export class AdamOptimizer {
    /**
     * @param {Tensor[]} params - Tensors to optimize
     * @param {number} lr - Base learning rate
     * @param {number} beta1 - First moment decay
     * @param {number} beta2 - Second moment decay
     * @param {number} eps - Numerical stability constant
     * @param {number} weightDecay - L2 regularization (AdamW style)
     */
    constructor(params, lr = 0.001, beta1 = 0.9, beta2 = 0.999, eps = 1e-8, weightDecay = 0.01) {
        this.params = params;
        this.baseLR = lr;
        this.beta1 = beta1;
        this.beta2 = beta2;
        this.eps = eps;
        this.weightDecay = weightDecay;
        this.t = 0;

        // Exponentially weighted moving averages
        this.m = params.map(p => new Float32Array(p.data.length));
        this.v = params.map(p => new Float32Array(p.data.length));
    }

    /** Warmup + Cosine Decay Scheduler */
    getLearningRate(step, totalSteps = 10000) {
        const warmup = 100;
        if (step < warmup) return this.baseLR * (step / warmup);

        const progress = Math.min(1.0, (step - warmup) / Math.max(1, totalSteps - warmup));
        return this.baseLR * 0.5 * (1.0 + Math.cos(Math.PI * progress));
    }

    /**
     * Perform optimization step
     * @param {number} epoch - Current epoch for scheduler
     * @param {number} totalEpochs - Target epochs for scheduler
     */
    step(epoch, totalEpochs) {
        this.t++;
        const lr = this.getLearningRate(this.t, totalEpochs * 100);

        const mBiasCorr = 1.0 - Math.pow(this.beta1, this.t);
        const vBiasCorr = 1.0 - Math.pow(this.beta2, this.t);

        for (let i = 0; i < this.params.length; i++) {
            const p = this.params[i];
            const grad = p.grad;
            if (!grad) continue;

            const m = this.m[i];
            const v = this.v[i];
            const data = p.data;

            for (let j = 0; j < data.length; j++) {
                const g = grad[j];

                // 1. Weight Decay (Decoupled from moments)
                if (this.weightDecay > 0) {
                    data[j] -= lr * this.weightDecay * data[j];
                }

                // 2. Momentum updates
                m[j] = this.beta1 * m[j] + (1.0 - this.beta1) * g;
                v[j] = this.beta2 * v[j] + (1.0 - this.beta2) * g * g;

                // 3. Bias correction and parameter update
                const mHat = m[j] / mBiasCorr;
                const vHat = v[j] / vBiasCorr;
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
        if (state.m) state.m.forEach((arr, i) => {
            if (this.m[i] && arr.length === this.m[i].length) this.m[i].set(arr);
        });
        if (state.v) state.v.forEach((arr, i) => {
            if (this.v[i] && arr.length === this.v[i].length) this.v[i].set(arr);
        });
    }
}

export class SGDOptimizer {
    constructor(params, lr = 0.01, momentum = 0.9, weightDecay = 0.0) {
        this.params = params;
        this.lr = lr;
        this.momentum = momentum;
        this.weightDecay = weightDecay;
        this.v = params.map(p => new Float32Array(p.data.length));
    }

    step() {
        for (let i = 0; i < this.params.length; i++) {
            const p = this.params[i];
            const grad = p.grad;
            if (!grad) continue;

            const v = this.v[i];
            const data = p.data;

            for (let j = 0; j < data.length; j++) {
                let g = grad[j];
                if (this.weightDecay > 0) g += this.weightDecay * data[j];

                v[j] = this.momentum * v[j] + g;
                data[j] -= this.lr * v[j];
            }
        }
    }

    zeroGrad() {
        for (const p of this.params) p.zeroGrad();
    }
}
