export class ConsolidationEngine {
    constructor(model) {
        this.model = model;
        this.fisherMatrix = [];
        this.starParams = []; // Consolidated parameters (theta*)
        this.lambda = 1000; // Consolidation strength

        this.initFisherAndStar();
    }

    initFisherAndStar() {
        const params = this.model.parameters();
        for (const p of params) {
            // Initialize diagonal Fisher information
            this.fisherMatrix.push(new Float32Array(p.data.length));

            // Store consolidated parameters (initial values)
            this.starParams.push(new Float32Array(p.data));
        }
    }

    // Update Fisher Information after each task
    updateFisher(gradients) {
        for (let pi = 0; pi < this.fisherMatrix.length; pi++) {
            for (let i = 0; i < this.fisherMatrix[pi].length; i++) {
                // Approximate Fisher diagonal: E[(grad)^2]
                this.fisherMatrix[pi][i] += gradients[pi][i] * gradients[pi][i];
            }
        }
    }

    // Compute consolidation loss (EWC)
    computeConsolidationLoss() {
        let loss = 0;
        const params = this.model.parameters();

        for (let pi = 0; pi < params.length; pi++) {
            const p = params[pi];
            for (let i = 0; i < p.data.length; i++) {
                const diff = p.data[i] - this.starParams[pi][i];
                loss += (this.lambda * this.fisherMatrix[pi][i] * diff * diff) / 2;
            }
        }
        return loss;
    }

    // Normalize Fisher after training period
    normalizeFisher(samplesCount) {
        for (let pi = 0; pi < this.fisherMatrix.length; pi++) {
            for (let i = 0; i < this.fisherMatrix[pi].length; i++) {
                this.fisherMatrix[pi][i] = this.fisherMatrix[pi][i] / samplesCount;
            }
        }
    }
}
