/**
 * @fileoverview LULLABY CONSOLIDATION ENGINE
 * Implements Elastic Weight Consolidation (EWC) to prevent catastrophic forgetting.
 */

export class ConsolidationEngine {
    /**
     * @param {NanoTransformer} model - The model to manage retention for.
     */
    constructor(model) {
        this.model = model;
        this.fisher = []; // Diagonal Fisher Information Matrix
        this.optimalParams = []; // Optimal parameters from previous tasks
        this.lambda = 10.0; // Consolidation strength

        const params = this.model.parameters();
        for (const p of params) {
            this.fisher.push(new Float32Array(p.data.length));
            const optimal = new Float32Array(p.data.length);
            optimal.set(p.data);
            this.optimalParams.push(optimal);
        }
    }

    /**
     * Updates the diagonal Fisher Information estimate using current gradients.
     * F = E[ (dL/dtheta)^2 ]
     * @param {Float32Array[]} grads
     */
    updateFisher(grads) {
        for (let i = 0; i < grads.length; i++) {
            if (!grads[i]) continue;
            const f = this.fisher[i];
            const g = grads[i];
            if (g.length !== f.length) {
                throw new Error(`Gradient shape mismatch at index ${i}: expected ${f.length}, got ${g.length}`);
            }
            for (let j = 0; j < f.length; j++) {
                // Online estimate with decay (0.99 momentum)
                f[j] = 0.99 * f[j] + 0.01 * (g[j] * g[j]);
            }
        }
    }

    /**
     * Computes the consolidation loss (EWC penalty).
     * Loss = sum_i (lambda/2 * Fisher_i * (theta_i - theta_optimal_i)^2)
     */
    computeConsolidationLoss() {
        let totalLoss = 0;
        const params = this.model.parameters();
        for (let i = 0; i < params.length; i++) {
            const p = params[i].data;
            const f = this.fisher[i];
            const opt = this.optimalParams[i];
            const grad = params[i].grad;

            for (let j = 0; j < p.length; j++) {
                const diff = p[j] - opt[j];
                const penalty = this.lambda * f[j] * diff;
                totalLoss += 0.5 * penalty * diff;
                
                // Add penalty directly to gradient during training
                if (grad) grad[j] += penalty;
            }
        }
        return totalLoss;
    }

    /**
     * Finalize current task parameters as optimal for future tasks.
     */
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
        this.lambda = (state.lambda !== undefined && state.lambda !== null) ? state.lambda : 10.0;
        if (state.fisher) {
            state.fisher.forEach((f, i) => {
                if (this.fisher[i] && f.length === this.fisher[i].length) {
                    this.fisher[i].set(f);
                }
            });
        }
        if (state.optimalParams) {
            state.optimalParams.forEach((o, i) => {
                if (this.optimalParams[i] && o.length === this.optimalParams[i].length) {
                    this.optimalParams[i].set(o);
                }
            });
        }
    }
}
