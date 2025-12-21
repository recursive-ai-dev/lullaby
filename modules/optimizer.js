// ==========================================
// 4. OPTIMIZERS
// ==========================================

/**
 * SGD Optimizer with Momentum
 */
export class SGDOptimizer {
    constructor(params, lr = 0.01, momentum = 0.9, weightDecay = 0.0) {
        this.params = params;
        this.lr = lr;
        this.baseLR = lr;
        this.momentum = momentum;
        this.weightDecay = weightDecay;
        this.t = 0;

        // Momentum buffers
        this.velocities = [];
        for (const p of params) {
            this.velocities.push(new Float32Array(p.data.length));
        }
    }

    /**
     * Learning rate scheduling (same as Adam)
     */
    getLearningRate(step, totalSteps = 10000) {
        const warmupSteps = 100;

        if (step < warmupSteps) {
            return this.baseLR * (step / warmupSteps);
        }

        const progress = (step - warmupSteps) / (totalSteps - warmupSteps);
        const clampedProgress = Math.max(0, Math.min(1, progress));
        return this.baseLR * 0.5 * (1 + Math.cos(Math.PI * clampedProgress));
    }

    step(epoch, totalEpochs, manualLr = null) {
        this.t++;

        let currentLr;
        if (manualLr !== null) {
            currentLr = manualLr;
        } else {
            currentLr = this.getLearningRate(this.t);
        }

        for (let pi = 0; pi < this.params.length; pi++) {
            const p = this.params[pi];
            if (!p.grad) continue;

            for (let i = 0; i < p.data.length; i++) {
                let g = p.grad[i];

                // Weight decay (L2 regularization)
                if (this.weightDecay !== 0) {
                    g += this.weightDecay * p.data[i];
                }

                // Update velocity: v = momentum * v + g
                this.velocities[pi][i] = this.momentum * this.velocities[pi][i] + g;

                // Update parameters: θ = θ - lr * v
                p.data[i] -= currentLr * this.velocities[pi][i];
            }
        }
    }

    zeroGrad() {
        for (const p of this.params) p.zeroGrad();
    }
}

/**
 * Adam Optimizer
 */
export class AdamOptimizer {
    constructor(params, lr = 0.001, beta1 = 0.9, beta2 = 0.999, epsilon = 1e-8) {
        this.params = params;
        this.lr = lr;
        this.baseLR = lr; // Store base LR for scheduling
        this.beta1 = beta1;
        this.beta2 = beta2;
        this.epsilon = epsilon;
        this.t = 0;

        // Momentum and RMSprop estimates
        this.m = []; // First moment (velocity)
        this.v = []; // Second moment (uncertainty)
        this.mHat = []; // Bias-corrected first moment
        this.vHat = []; // Bias-corrected second moment

        for (const p of params) {
            this.m.push(new Float32Array(p.data.length));
            this.v.push(new Float32Array(p.data.length));
            this.mHat.push(new Float32Array(p.data.length));
            this.vHat.push(new Float32Array(p.data.length));
        }
    }

    // UPGRADE #11: Learning Rate Warmup & Cosine Decay
    getLearningRate(step, totalSteps = 10000) {
        const warmupSteps = 100;

        if (step < warmupSteps) {
            return this.baseLR * (step / warmupSteps);
        }

        const progress = (step - warmupSteps) / (totalSteps - warmupSteps);
        // Ensure progress is between 0 and 1
        const clampedProgress = Math.max(0, Math.min(1, progress));
        return this.baseLR * 0.5 * (1 + Math.cos(Math.PI * clampedProgress));
    }

    step(epoch, totalEpochs, manualLr = null) {
        this.t++;

        // Use manual LR if provided, otherwise use scheduler
        let currentLr;
        if (manualLr !== null) {
            currentLr = manualLr;
        } else {
            // Use t (total steps) for scheduling instead of just epoch
            currentLr = this.getLearningRate(this.t);
        }

        for (let pi = 0; pi < this.params.length; pi++) {
            const p = this.params[pi];
            if (!p.grad) continue;

            for (let i = 0; i < p.data.length; i++) {
                const g = p.grad[i];

                // Update biased first moment estimate
                this.m[pi][i] = this.beta1 * this.m[pi][i] + (1 - this.beta1) * g;

                // Update biased second raw moment estimate
                this.v[pi][i] = this.beta2 * this.v[pi][i] + (1 - this.beta2) * g * g;

                // Compute bias-corrected first moment estimate
                this.mHat[pi][i] = this.m[pi][i] / (1 - Math.pow(this.beta1, this.t));

                // Compute bias-corrected second raw moment estimate
                this.vHat[pi][i] = this.v[pi][i] / (1 - Math.pow(this.beta2, this.t));

                // Update parameters
                p.data[i] -= currentLr * this.mHat[pi][i] / (Math.sqrt(this.vHat[pi][i]) + this.epsilon);
            }
        }
    }

    zeroGrad() {
        for (const p of this.params) p.zeroGrad();
    }

    serialize() {
        return {
            t: this.t,
            m: this.m.map(arr => arr.slice()), // Copy to ensure detached buffer
            v: this.v.map(arr => arr.slice())
        };
    }

    loadState(state) {
        if (!state) return;
        if (Number.isFinite(state.t)) this.t = state.t;

        if (Array.isArray(state.m)) {
            for (let i = 0; i < Math.min(this.m.length, state.m.length); i++) {
                // Validate array lengths match before copying
                if (state.m[i] && state.m[i].length === this.m[i].length) {
                    this.m[i].set(state.m[i]);
                }
            }
        }

        if (Array.isArray(state.v)) {
            for (let i = 0; i < Math.min(this.v.length, state.v.length); i++) {
                // Validate array lengths match before copying
                if (state.v[i] && state.v[i].length === this.v[i].length) {
                    this.v[i].set(state.v[i]);
                }
            }
        }
    }
}
