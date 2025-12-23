/**
 * Prioritized Experience Replay Buffer
 * 
 * Mathematical Foundation:
 * ========================
 * Prioritized replay samples experiences based on their "priority" which
 * reflects how much the agent can learn from them.
 * 
 * Priority Metric:
 * p_i = |TD-error| + uncertainty + ε
 * 
 * where:
 * - TD-error: Temporal Difference error (prediction error)
 * - uncertainty: Model uncertainty (from Bayesian layers)
 * - ε: small constant to ensure non-zero probability
 * 
 * Sampling Probability:
 * P(i) = p_i^α / Σ_k p_k^α
 * 
 * where α controls how much prioritization affects sampling:
 * - α = 0: uniform sampling
 * - α = 1: proportional to priority
 * - α > 1: more aggressive prioritization
 * 
 * Importance Sampling Weight:
 * w_i = (1 / (N * P(i)))^β
 * 
 * where β ∈ [0,1] controls bias correction:
 * - β = 0: no correction (biased)
 * - β = 1: full correction (unbiased)
 * 
 * Mathematical Justification:
 * ---------------------------
 * Prioritized replay introduces bias because we sample non-uniformly.
 * Importance sampling weights correct this bias by downweighting
 * frequently sampled experiences.
 * 
 * Expected gradient under prioritized sampling:
 * E_prioritized[w_i * ∇L_i] ≈ E_uniform[∇L_i]
 * 
 * This ensures the learning remains unbiased in expectation.
 */
export class PrioritizedReplayBuffer {
    constructor(maxSize = 50, alpha = 0.6, beta = 0.4, epsilon = 1e-6) {
        // Validation
        if (!Number.isInteger(maxSize) || maxSize <= 0) {
            throw new Error(`maxSize must be a positive integer, got ${maxSize}`);
        }
        if (!(alpha >= 0 && alpha <= 2)) {
            throw new Error(`alpha must be in [0, 2], got ${alpha}`);
        }
        if (!(beta >= 0 && beta <= 1)) {
            throw new Error(`beta must be in [0, 1], got ${beta}`);
        }
        if (!(epsilon > 0)) {
            throw new Error(`epsilon must be positive, got ${epsilon}`);
        }
        
        this.maxSize = maxSize;
        this.alpha = alpha; // Priority exponent
        this.beta = beta; // Importance sampling exponent
        this.epsilon = epsilon; // Small constant for numerical stability
        this.buffer = []; // Stores {text, priority, loss, uncertainty, timestamp}
    }

    /**
     * Add a new experience to the replay buffer
     * 
     * @param {string} text - The experience text
     * @param {number} loss - TD-error or prediction loss
     * @param {number} uncertainty - Model uncertainty estimate
     */
    add(text, loss = 0, uncertainty = 0) {
        // Validate inputs
        if (typeof text !== 'string' || text.length === 0) {
            throw new Error('text must be a non-empty string');
        }
        
        const validLoss = Number.isFinite(loss) ? Math.abs(loss) : 0;
        const validUncertainty = Number.isFinite(uncertainty) ? Math.abs(uncertainty) : 0;
        
        // Priority = |TD-error| + uncertainty + ε
        // Using absolute value ensures priority is always positive
        const priority = validLoss + validUncertainty + this.epsilon;

        this.buffer.push({ 
            text, 
            priority, 
            loss: validLoss, 
            uncertainty: validUncertainty,
            timestamp: Date.now() // Track when added for potential time-based prioritization
        });

        // Keep buffer sorted by priority (highest first) for efficient sampling
        this.buffer.sort((a, b) => b.priority - a.priority);

        // Maintain max size by removing lowest priority item
        if (this.buffer.length > this.maxSize) {
            this.buffer.pop(); // Remove lowest priority (last in sorted array)
        }
    }

    /**
     * Sample an experience using prioritized sampling
     * 
     * Mathematical Process:
     * 1. Compute sampling probabilities: P(i) = p_i^α / Σ p_k^α
     * 2. Sample index using these probabilities
     * 3. Return experience with importance sampling weight
     * 
     * @returns {Object|null} - Sampled memory with importance weight, or null if buffer empty
     */
    sample() {
        if (this.buffer.length === 0) {
            return null;
        }

        // Compute total priority: Σ p_i^α
        let totalPriority = 0;
        const priorities = [];
        
        for (const memory of this.buffer) {
            // Apply priority exponent: p_i^α
            const poweredPriority = Math.pow(Math.max(memory.priority, this.epsilon), this.alpha);
            priorities.push(poweredPriority);
            totalPriority += poweredPriority;
        }

        // Guard against zero total priority (should not happen with epsilon, but defensive)
        if (totalPriority <= this.epsilon) {
            // Fallback to uniform sampling
            const idx = Math.floor(Math.random() * this.buffer.length);
            return {
                ...this.buffer[idx],
                importanceWeight: 1.0 // No bias correction needed for uniform sampling
            };
        }

        // Proportional sampling: select experience with probability P(i) = p_i^α / Σ p_k^α
        let r = Math.random() * totalPriority;
        
        for (let i = 0; i < this.buffer.length; i++) {
            r -= priorities[i];
            if (r <= 0) {
                // Compute importance sampling weight: w_i = (N * P(i))^(-β)
                const samplingProb = priorities[i] / totalPriority;
                const importanceWeight = Math.pow(this.buffer.length * samplingProb, -this.beta);
                
                // Normalize importance weights to prevent gradient explosion
                // In full implementation, we'd track max weight and normalize by it
                // For now, we clamp to reasonable bounds
                const clampedWeight = Math.min(importanceWeight, 10.0);
                
                return {
                    ...this.buffer[i],
                    importanceWeight: clampedWeight
                };
            }
        }

        // Fallback (should not reach here, but defensive programming)
        return {
            ...this.buffer[0],
            importanceWeight: 1.0
        };
    }

    /**
     * Update priority of an existing experience
     * 
     * This is called after training on an experience to update its priority
     * based on the new TD-error.
     * 
     * @param {string} text - Text to identify the experience
     * @param {number} newLoss - Updated TD-error
     * @param {number} newUncertainty - Updated uncertainty
     */
    updatePriority(text, newLoss, newUncertainty) {
        const memory = this.buffer.find(m => m.text === text);
        
        if (memory) {
            const validLoss = Number.isFinite(newLoss) ? Math.abs(newLoss) : memory.loss;
            const validUncertainty = Number.isFinite(newUncertainty) ? Math.abs(newUncertainty) : memory.uncertainty;
            
            memory.loss = validLoss;
            memory.uncertainty = validUncertainty;
            memory.priority = validLoss + validUncertainty + this.epsilon;
            
            // Re-sort buffer to maintain priority order
            this.buffer.sort((a, b) => b.priority - a.priority);
        }
    }
    
    /**
     * Get buffer statistics for monitoring
     * 
     * @returns {Object} - Statistics about the buffer
     */
    getStats() {
        if (this.buffer.length === 0) {
            return {
                size: 0,
                avgPriority: 0,
                maxPriority: 0,
                minPriority: 0
            };
        }
        
        const priorities = this.buffer.map(m => m.priority);
        const sum = priorities.reduce((a, b) => a + b, 0);
        
        return {
            size: this.buffer.length,
            avgPriority: sum / this.buffer.length,
            maxPriority: Math.max(...priorities),
            minPriority: Math.min(...priorities)
        };
    }
    
    /**
     * Clear all experiences from buffer
     */
    clear() {
        this.buffer = [];
    }
}
