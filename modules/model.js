import { Embedding, LayerNorm, MultiHeadAttention, BayesianLinear, Linear } from './layers.js';

// ==========================================
// 3. TRANSFORMER BLOCKS
// ==========================================
export class NanoTransformer {
    constructor(vocabSize, dModel = 96, numHeads = 4) {
        this.tokenEmb = new Embedding(vocabSize, dModel);
        this.posEmb = new Embedding(64, dModel);
        this.ln1 = new LayerNorm(dModel);
        this.mha = new MultiHeadAttention(dModel, numHeads);
        this.ln2 = new LayerNorm(dModel);
        this.ff1 = new BayesianLinear(dModel, dModel * 4);
        this.ff2 = new Linear(dModel * 4, dModel);
        this.finalNorm = new LayerNorm(dModel);
        this.lmHead = new Linear(dModel, vocabSize);
    }

    parameters() {
        return [
            ...this.tokenEmb.parameters(), ...this.posEmb.parameters(),
            ...this.ln1.parameters(), ...this.mha.parameters(), ...this.ln2.parameters(),
            ...this.ff1.parameters(), ...this.ff2.parameters(),
            ...this.finalNorm.parameters(), ...this.lmHead.parameters()
        ];
    }

    forward(indices) {
        const seqLen = indices.length;
        const tok = this.tokenEmb.forwardIndices(indices);
        const positions = Array.from({ length: seqLen }, (_, i) => i);
        const pos = this.posEmb.forwardIndices(positions);
        let x = tok.add(pos);

        // Block 1
        let norm1 = this.ln1.forward(x);
        let attn = this.mha.forward(norm1);
        x = x.add(attn);
        let norm2 = this.ln2.forward(x);
        let ff = this.ff1.forward(norm2);
        for (let i = 0; i < ff.data.length; i++) if (ff.data[i] < 0) ff.data[i] *= 0.01; // LeakyReLU
        ff = this.ff2.forward(ff);
        x = x.add(ff);
        x = this.finalNorm.forward(x);
        return this.lmHead.forward(x);
    }

    backward(gradLogits) {
        let dx = this.lmHead.backward(gradLogits);
        dx = this.finalNorm.backward(dx);
        let dRes2 = dx;
        let dFF = dx;
        dFF = this.ff2.backward(dFF);
        dFF = this.ff1.backward(dFF);
        let dLn2 = this.ln2.backward(dFF);
        dx = dRes2.add(dLn2);
        let dRes1 = dx;
        let dAttn = this.mha.backward(dx);
        let dLn1 = this.ln1.backward(dAttn);
        dx = dRes1.add(dLn1);
        this.tokenEmb.backward(dx);
        this.posEmb.backward(dx);
    }
}
