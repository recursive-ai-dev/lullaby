import { Embedding, LayerNorm, MultiHeadAttention, BayesianLinear, Linear } from './layers.js'; // MultiHeadAttention uses RoPE internally
import { LeakyReLU } from './activations.js';

// ==========================================
// 3. TRANSFORMER BLOCKS
// ==========================================
export class NanoTransformer {
    constructor(vocabSize, dModel = 96, numHeads = 4) {
        this.tokenEmb = new Embedding(vocabSize, dModel);
        // Removed absolute posEmb in favor of RoPE in MHA
        this.ln1 = new LayerNorm(dModel);
        this.mha = new MultiHeadAttention(dModel, numHeads);
        this.ln2 = new LayerNorm(dModel);
        this.ff1 = new BayesianLinear(dModel, dModel * 4);
        this.act = new LeakyReLU(0.01); // Explicit activation layer
        this.ff2 = new Linear(dModel * 4, dModel);
        this.finalNorm = new LayerNorm(dModel);
        this.lmHead = new Linear(dModel, vocabSize);
    }

    parameters() {
        return [
            ...this.tokenEmb.parameters(),
            // posEmb removed
            ...this.ln1.parameters(), ...this.mha.parameters(), ...this.ln2.parameters(),
            ...this.ff1.parameters(), ...this.ff2.parameters(),
            ...this.finalNorm.parameters(), ...this.lmHead.parameters()
        ];
    }

    forward(indices) {
        const tok = this.tokenEmb.forwardIndices(indices);
        // No absolute positional embeddings addition; MHA uses RoPE
        let x = tok;

        // Block 1
        let norm1 = this.ln1.forward(x);
        let attn = this.mha.forward(norm1);
        x = x.add(attn);

        // Feed Forward Block
        let norm2 = this.ln2.forward(x);
        let ff = this.ff1.forward(norm2);
        ff = this.act.forward(ff); // Proper activation forward
        ff = this.ff2.forward(ff);
        x = x.add(ff);

        x = this.finalNorm.forward(x);
        return this.lmHead.forward(x);
    }

    backward(gradLogits) {
        let dx = this.lmHead.backward(gradLogits);
        dx = this.finalNorm.backward(dx);

        // Feed Forward Block Backward
        let dRes2 = dx; // Residual connection gradient
        let dFF = dx;
        dFF = this.ff2.backward(dFF);
        dFF = this.act.backward(dFF); // Proper activation gradient!
        dFF = this.ff1.backward(dFF);
        let dLn2 = this.ln2.backward(dFF);
        dx = dRes2.add(dLn2);

        // Attention Block Backward
        let dRes1 = dx;
        let dAttn = this.mha.backward(dx);
        let dLn1 = this.ln1.backward(dAttn);
        dx = dRes1.add(dLn1);

        this.tokenEmb.backward(dx);
    }
}
