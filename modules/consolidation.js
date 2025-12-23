/**
 * Elastic Weight Consolidation (EWC) Engine
 * 
 * Mathematical Foundation:
 * ========================
 * EWC prevents catastrophic forgetting by penalizing changes to important parameters.
 * 
 * Total Loss = Task Loss + λ * EWC Penalty
 * 
 * EWC Penalty = (λ/2) * Σ_i F_i(θ_i - θ*_i)²
 * 
 * where:
 * - θ*: consolidated parameters (from previous task)
 * - θ: current parameters
 * - F_i: Fisher Information (importance weight)
 * - λ: consolidation strength (hyperparameter)
 * 
 * Fisher Information (diagonal approximation):
 * F_i ≈ E[(∂L/∂θ_i)²]
 * 
 * This measures how much the loss would change if we perturb θ_i,
 * approximating parameter importance without computing the full Hessian.
 * 
 * Mathematical Proof of Fisher Information:
 * -----------------------------------------
 * For a probabilistic model p(y|x,θ), the Fisher Information Matrix is:
 * F = E[(∂log p/∂θ)(∂log p/∂θ)ᵀ]
 * 
 * For classification with cross-entropy loss L = -log p(y|x,θ):
 * ∂L/∂θ = -∂log p/∂θ
 * 
 * Therefore: F ≈ E[(∂L/∂θ)²] (diagonal approximation)
 */
export class ConsolidationEngine {
    constructor(model) {
        if (!model) {
            throw new Error('ConsolidationEngine requires a valid model');
        }
        
        this.model = model;
        this.fisherMatrix = [];
        this.starParams = []; // Consolidated parameters (θ*)
        this.lambda = 1000; // Consolidation strength (λ)
        this.sampleCount = 0; // Track number of samples used for Fisher estimation

        this.initFisherAndStar();
    }

    initFisherAndStar() {
        const params = this.model.parameters();
        
        for (const p of params) {
            if (!p || !p.data) {
                throw new Error('Invalid parameter in model.parameters()');
            }
            
            // Initialize diagonal Fisher information (all zeros initially)
            this.fisherMatrix.push(new Float32Array(p.data.length));

            // Store consolidated parameters (copy initial values)
            this.starParams.push(new Float32Array(p.data));
        }
    }

    /**
     * Update Fisher Information after each gradient computation
     * 
     * Mathematical Update:
     * F_i ← F_i + (∂L/∂θ_i)²
     * 
     * This accumulates squared gradients, which approximates E[(∂L/∂θ)²]
     * after normalization by sample count.
     * 
     * @param {Array<Float32Array>} gradients - Current gradients (must match parameter structure)
     */
    updateFisher(gradients) {
        if (!gradients || !Array.isArray(gradients)) {
            throw new Error('updateFisher requires an array of gradients');
        }
        
        if (gradients.length !== this.fisherMatrix.length) {
            throw new Error(`Gradient length mismatch: expected ${this.fisherMatrix.length}, got ${gradients.length}`);
        }
        
        for (let pi = 0; pi < this.fisherMatrix.length; pi++) {
            if (!gradients[pi]) {
                continue; // Skip null gradients
            }
            
            if (gradients[pi].length !== this.fisherMatrix[pi].length) {
                throw new Error(`Gradient size mismatch at parameter ${pi}: expected ${this.fisherMatrix[pi].length}, got ${gradients[pi].length}`);
            }
            
            for (let i = 0; i < this.fisherMatrix[pi].length; i++) {
                const grad = gradients[pi][i];
                
                // Validate gradient is finite
                if (Number.isFinite(grad)) {
                    // Accumulate squared gradient: F_i += g_i²
                    this.fisherMatrix[pi][i] += grad * grad;
                }
            }
        }
        
        this.sampleCount++;
    }

    /**
     * Compute EWC consolidation loss
     * 
     * Mathematical Formula:
     * L_EWC = (λ/2) * Σ_i F_i(θ_i - θ*_i)²
     * 
     * Where:
     * - λ: consolidation strength
     * - F_i: Fisher information (importance of parameter i)
     * - θ_i: current parameter value
     * - θ*_i: consolidated parameter value (from previous task)
     * 
     * Intuition:
     * - Large F_i → parameter is important for previous task
     * - Large (θ_i - θ*_i)² → parameter has changed significantly
     * - Product penalizes changes to important parameters
     * 
     * @returns {number} - EWC penalty term
     */
    computeConsolidationLoss() {
        let loss = 0;
        const params = this.model.parameters();

        if (params.length !== this.fisherMatrix.length) {
            throw new Error('Parameter count changed since initialization');
        }

        for (let pi = 0; pi < params.length; pi++) {
            const p = params[pi];
            
            if (!p || !p.data) {
                continue; // Skip invalid parameters
            }
            
            for (let i = 0; i < p.data.length; i++) {
                const currentParam = p.data[i];
                const consolidatedParam = this.starParams[pi][i];
                const fisher = this.fisherMatrix[pi][i];
                
                // Validate all values are finite
                if (Number.isFinite(currentParam) && Number.isFinite(consolidatedParam) && Number.isFinite(fisher)) {
                    // L_EWC += (λ/2) * F_i * (θ_i - θ*_i)²
                    const diff = currentParam - consolidatedParam;
                    loss += (this.lambda * fisher * diff * diff) / 2.0;
                }
            }
        }
        
        return loss;
    }

    /**
     * Normalize Fisher Information by sample count
     * 
     * Mathematical Operation:
     * F_i ← F_i / N
     * 
     * where N is the number of samples used for estimation.
     * 
     * This converts accumulated squared gradients into their expectation:
     * E[(∂L/∂θ)²] ≈ (Σ(∂L/∂θ)²) / N
     * 
     * Should be called after completing a task, before starting a new one.
     * 
     * @param {number} samplesCount - Number of samples used (optional, uses internal count if not provided)
     */
    normalizeFisher(samplesCount = null) {
        const count = samplesCount !== null ? samplesCount : this.sampleCount;
        
        if (count <= 0) {
            throw new Error(`Invalid sample count for Fisher normalization: ${count}`);
        }
        
        for (let pi = 0; pi < this.fisherMatrix.length; pi++) {
            for (let i = 0; i < this.fisherMatrix[pi].length; i++) {
                // Normalize: F_i ← F_i / N
                this.fisherMatrix[pi][i] = this.fisherMatrix[pi][i] / count;
                
                // Optional: Add small epsilon to prevent division by zero in gradient computation
                // F_i ← max(F_i, ε) where ε = 1e-8
                this.fisherMatrix[pi][i] = Math.max(this.fisherMatrix[pi][i], 1e-8);
            }
        }
    }
    
    /**
     * Consolidate current parameters as reference for future tasks
     * 
     * Call this after completing a task to "lock in" the current parameters.
     * Future EWC penalties will be computed relative to these values.
     */
    consolidate() {
        const params = this.model.parameters();
        
        for (let pi = 0; pi < params.length; pi++) {
            const p = params[pi];
            if (p && p.data) {
                // Copy current parameters to consolidated reference
                this.starParams[pi].set(p.data);
            }
        }
    }
}
