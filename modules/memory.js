export class PrioritizedReplayBuffer {
    constructor(maxSize = 50) {
        this.maxSize = maxSize;
        this.buffer = []; // Stores {text, priority, loss, uncertainty}
    }

    add(text, loss = 0, uncertainty = 0) {
        const priority = Math.abs(loss) + uncertainty; // Hybrid metric

        this.buffer.push({ text, priority, loss, uncertainty });

        // Keep buffer sorted by priority (highest first)
        this.buffer.sort((a, b) => b.priority - a.priority);

        if (this.buffer.length > this.maxSize) {
            // Forget lowest priority memory
            this.buffer.pop();
        }
    }

    sample() {
        if (this.buffer.length === 0) return null;

        // Proportional sampling based on priority
        const totalPriority = this.buffer.reduce((sum, m) => sum + m.priority, 0);

        // Guard against zero priority (CRITICAL FIX #4)
        if (totalPriority <= 1e-10) {
            // Uniform sampling fallback when all priorities are zero
            const idx = Math.floor(Math.random() * this.buffer.length);
            return this.buffer[idx];
        }

        let r = Math.random() * totalPriority;

        for (const memory of this.buffer) {
            r -= memory.priority;
            if (r <= 0) return memory;
        }

        return this.buffer[0]; // Fallback
    }

    updatePriority(text, newLoss, newUncertainty) {
        const memory = this.buffer.find(m => m.text === text);
        if (memory) {
            memory.loss = newLoss;
            memory.uncertainty = newUncertainty;
            memory.priority = Math.abs(newLoss) + newUncertainty;
            this.buffer.sort((a, b) => b.priority - a.priority);
        }
    }
}
