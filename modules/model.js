import { Embedding, LayerNorm, MultiHeadAttention, BayesianLinear, Linear } from './layers.js';
import { LeakyReLU } from './activations.js';

/**
 * NANOTRANSFORMER (VERSION 3.1)
 * Hybrid Neural Architecture combining Bayesian Inference with Deterministic RoPE.
 *
 * DESIGN:
 * - Embedding: Discrete token projections
 * - LayerNorm: Pre-norm architecture for numerical stability
 * - MultiHeadAttention: RoPE-enabled causal attention
 * - Bayesian MLP: Uncertainty-aware feed-forward network
 * - Linear LM Head: Final logit projection
 */
export class NanoTransformer {
    constructor(vocabSize, dModel = 128, numHeads = 4) {
        this.tokenEmb = new Embedding(vocabSize, dModel);

        // Transformer Block
        this.ln1 = new LayerNorm(dModel);
        this.mha = new MultiHeadAttention(dModel, numHeads);

        this.ln2 = new LayerNorm(dModel);
        this.ff1 = new BayesianLinear(dModel, dModel * 4);
        this.act = new LeakyReLU(0.01);
        this.ff2 = new Linear(dModel * 4, dModel);

        // Output Head
        this.finalNorm = new LayerNorm(dModel);
        this.lmHead = new Linear(dModel, vocabSize);
    }

    /** Returns all trainable parameters for the optimizer */
    parameters() {
        return [
            ...this.tokenEmb.parameters(),
            ...this.ln1.parameters(),
            ...this.mha.parameters(),
            ...this.ln2.parameters(),
            ...this.ff1.parameters(),
            ...this.ff2.parameters(),
            ...this.finalNorm.parameters(),
            ...this.lmHead.parameters()
        ];
    }

    /**
     * Autoregressive forward pass
     * @param {Tensor} indices - Sequence of token IDs
     */
    forward(indices) {
        const x_emb = this.tokenEmb.forwardIndices(indices);
        let x = x_emb;

        // Block 1: Attention with Pre-Norm
        const norm1 = this.ln1.forward(x);
        const attn = this.mha.forward(norm1);
        x = x.add(attn); // Residual connection

        // Feed Forward Block: Bayesian MLP with Pre-Norm
        const norm2 = this.ln2.forward(x);
        let ff = this.ff1.forward(norm2);
        ff = this.act.forward(ff);
        ff = this.ff2.forward(ff);
        x = x.add(ff); // Residual connection

        // Final LayerNorm and Logit Projection
        x = this.finalNorm.forward(x);
        return this.lmHead.forward(x);
    }

    /**
     * Full-sequence backpropagation
     * @param {Tensor} gradLogits - dLoss/dLogits
     */
    backward(gradLogits) {
        // Output path
        let dx = this.lmHead.backward(gradLogits);
        dx = this.finalNorm.backward(dx);

        // MLP path
        const dRes2 = dx;
        let dFF = dx;
        dFF = this.ff2.backward(dFF);
        dFF = this.act.backward(dFF);
        dFF = this.ff1.backward(dFF);
        const dLn2 = this.ln2.backward(dFF);
        dx = dRes2.add(dLn2);

        // Attention path
        const dRes1 = dx;
        const dAttn = this.mha.backward(dx);
        const dLn1 = this.ln1.backward(dAttn);
        dx = dRes1.add(dLn1);

        // Embedding path
        this.tokenEmb.backward(dx);
        return dx;
    }
}
