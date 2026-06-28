/**
 * Prioritized Experience Replay Buffer
 * 
 * DESIGN:
 * Samples experiences based on "priority" (TD-error + Uncertainty).
 * Uses Importance Sampling weights to correct for distribution bias.
 */
export class PrioritizedReplayBuffer {
    /**
     * @param {number} maxSize
     * @param {number} alpha - Priority exponent (0=uniform, 1=proportional)
     * @param {number} beta - Importance sampling exponent
     */
    constructor(maxSize = 100, alpha = 0.6, beta = 0.4) {
        this.maxSize = maxSize;
        this.alpha = alpha;
        this.beta = beta;
        this.buffer = []; // {text, priority}
        this.epsilon = 1e-6;
    }

    /**
     * Adds an experience to the buffer.
     * @param {string} text
     * @param {number} loss - magnitude of TD-error
     * @param {number} uncertainty - Bayesian uncertainty boost
     */
    add(text, loss = 1.0, uncertainty = 0.0) {
        const priority = Math.pow(Math.abs(loss) + uncertainty + this.epsilon, this.alpha);
        this.buffer.push({ text, priority });
        
        // Maintenance: sort and prune
        this.buffer.sort((a, b) => b.priority - a.priority);
        if (this.buffer.length > this.maxSize) {
            this.buffer.pop();
        }
    }

    /**
     * Proportional sampling using importance weights.
     */
    sample() {
        if (this.buffer.length === 0) return null;
        
        const total = this.buffer.reduce((s, x) => s + x.priority, 0);
        let r = Math.random() * total;
        
        for (let i = 0; i < this.buffer.length; i++) {
            r -= this.buffer[i].priority;
            if (r <= 0) {
                const prob = this.buffer[i].priority / total;
                const weight = Math.pow(this.buffer.length * prob, -this.beta);
                return {
                    text: this.buffer[i].text,
                    importanceWeight: Math.min(weight, 10.0) // Clamp weight
                };
            }
        }
        return this.buffer[0];
    }
}
