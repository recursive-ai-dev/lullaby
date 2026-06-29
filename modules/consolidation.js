/**
 * LULLABY CONSOLIDATION ENGINE (VERSION 3.0)
 * Implements Elastic Weight Consolidation (EWC) for continual learning.
 *
 * This engine tracks Fisher Information to identify which parameters
 * are critical for previous knowledge and penalizes their modification.
 */

export class ConsolidationEngine {
    /**
     * @param {NanoTransformer} model - Model to consolidate
     */
    constructor(model) {
        this.model = model;
        this.fisher = [];
        this.optimalParams = [];
        this.lambda = 15.0; // Consolidation strength

        const params = this.model.parameters();
        for (const p of params) {
            this.fisher.push(new Float32Array(p.data.length));
            const optimal = new Float32Array(p.data.length);
            optimal.set(p.data);
            this.optimalParams.push(optimal);
        }
    }

    /**
     * Updates the diagonal Fisher Information estimate using gradients.
     * F = E[ (dL/dtheta)^2 ]
     */
    updateFisher() {
        const params = this.model.parameters();
        for (let i = 0; i < params.length; i++) {
            const p = params[i];
            if (!p.grad) continue;

            const f = this.fisher[i];
            const g = p.grad;

            // Numerical stability: online estimation with momentum
            for (let j = 0; j < f.length; j++) {
                f[j] = 0.95 * f[j] + 0.05 * (g[j] * g[j]);
            }
        }
    }

    /**
     * Computes the EWC consolidation loss.
     * Loss = sum_i (lambda/2 * Fisher_i * (theta_i - theta_optimal_i)^2)
     */
    computeConsolidationLoss() {
        let totalLoss = 0;
        const params = this.model.parameters();
        for (let i = 0; i < params.length; i++) {
            const p = params[i];
            const f = this.fisher[i];
            const opt = this.optimalParams[i];

            for (let j = 0; j < p.data.length; j++) {
                const diff = p.data[j] - opt[j];
                const penalty = this.lambda * f[j] * diff;
                totalLoss += 0.5 * penalty * diff;
                
                // Add penalty directly to gradient if gradient buffer exists
                if (p.grad) p.grad[j] += penalty;
            }
        }
        return totalLoss;
    }

    /** Finalize current parameters as the new 'optimal' state */
    consolidate() {
        const params = this.model.parameters();
        for (let i = 0; i < params.length; i++) {
            this.optimalParams[i].set(params[i].data);
        }
    }

    serialize() {
        return {
            fisher: this.fisher.map(f => Array.from(f)),
            optimalParams: this.optimalParams.map(o => Array.from(o)),
            lambda: this.lambda
        };
    }

    loadState(state) {
        if (!state) return;
        this.lambda = state.lambda || 15.0;
        if (state.fisher) {
            state.fisher.forEach((f, i) => {
                if (this.fisher[i] && f.length === this.fisher[i].length) this.fisher[i].set(f);
            });
        }
        if (state.optimalParams) {
            state.optimalParams.forEach((o, i) => {
                if (this.optimalParams[i] && o.length === this.optimalParams[i].length) this.optimalParams[i].set(o);
            });
        }
    }
}
