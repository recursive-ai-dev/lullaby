import { Tensor } from './tensor.js';
import { TensorOps } from './tensor_ops.js';

/**
 * LULLABY NEURAL LAYERS (VERSION 3.1)
 * High-performance, production-grade implementations of transformer components.
 */

export class Linear {
    constructor(inDim, outDim) {
        this.inDim = inDim;
        this.outDim = outDim;
        // Kaiming initialization
        this.weight = Tensor.randn([inDim, outDim]).scale(Math.sqrt(2 / inDim));
        this.bias = Tensor.zeros([outDim]);
        this.lastInput = null;
    }

    parameters() {
        return [this.weight, this.bias];
    }

    forward(x) {
        this.lastInput = x;
        // Supports [..., inDim] @ [inDim, outDim]
        return x.matmul(this.weight).addBroadcast(this.bias);
    }

    backward(gradOutput) {
        // dL/dW = Input^T * gradOutput
        // Reshape input to 2D [Batch*Seq, inDim] for clean matmul
        const flatX = this.lastInput.reshape([-1, this.inDim]);
        const flatGrad = gradOutput.reshape([-1, this.outDim]);
        
        const gradWeight = flatX.transpose().matmul(flatGrad);
        
        // dL/dB = sum over all dimensions except the last one
        const gradBias = TensorOps.sum(flatGrad, 0);

        if (!this.weight.grad) this.weight.grad = new Float32Array(gradWeight.data.length);
        for (let i = 0; i < gradWeight.data.length; i++) this.weight.grad[i] += gradWeight.data[i];

        if (!this.bias.grad) this.bias.grad = new Float32Array(gradBias.data.length);
        for (let i = 0; i < gradBias.data.length; i++) this.bias.grad[i] += gradBias.data[i];

        // dL/dX = gradOutput * W^T
        const dX = gradOutput.matmul(this.weight.transpose());
        return dX;
    }
}

export class Embedding {
    constructor(vocabSize, dModel) {
        this.vocabSize = vocabSize;
        this.dModel = dModel;
        this.weight = Tensor.randn([vocabSize, dModel]).scale(0.02);
        this.lastIndices = null;
    }

    parameters() {
        return [this.weight];
    }

    forwardIndices(indices) {
        // indices can be [batch, seq] or [seq]
        const data = indices.data || indices;
        const shape = indices.shape || [data.length];

        this.lastIndices = data;
        this.lastShape = shape;

        const outData = new Float32Array(data.length * this.dModel);
        for (let i = 0; i < data.length; i++) {
            const idx = Math.floor(data[i]);
            if (idx < 0 || idx >= this.vocabSize) {
                // Safety: out of bounds indices set to zero
                continue;
            }
            outData.set(this.weight.data.subarray(idx * this.dModel, (idx + 1) * this.dModel), i * this.dModel);
        }

        return new Tensor(outData, [...shape, this.dModel]);
    }

    backward(gradOutput) {
        if (!this.weight.grad) this.weight.zeroGrad();

        const flatGrad = gradOutput.data;
        for (let i = 0; i < this.lastIndices.length; i++) {
            const vocabIdx = Math.floor(this.lastIndices[i]);
            if (vocabIdx < 0 || vocabIdx >= this.vocabSize) continue;

            const gradRow = flatGrad.subarray(i * this.dModel, (i + 1) * this.dModel);
            for (let j = 0; j < this.dModel; j++) {
                this.weight.grad[vocabIdx * this.dModel + j] += gradRow[j];
            }
        }
    }
}

export class LayerNorm {
    constructor(dModel, eps = 1e-5) {
        this.dModel = dModel;
        this.eps = eps;
        this.gamma = Tensor.ones([dModel]);
        this.beta = Tensor.zeros([dModel]);
        this.lastX = null;
        this.lastMean = null;
        this.lastInvVar = null;
    }

    parameters() {
        return [this.gamma, this.beta];
    }

    forward(x) {
        this.lastX = x;
        const shape = x.shape;
        const lastDim = shape[shape.length - 1];
        const flatX = x.reshape([-1, lastDim]);
        const n = flatX.shape[0];

        const mean = TensorOps.sum(flatX, 1, true).scale(1 / lastDim);
        const diff = flatX.sub(mean);
        const var_ = TensorOps.sum(diff.mul(diff), 1, true).scale(1 / lastDim);
        const invVar = TensorOps.map(var_, v => 1.0 / Math.sqrt(v + this.eps));

        this.lastMean = mean;
        this.lastInvVar = invVar;

        const xHat = diff.mul(invVar);
        const out = xHat.mul(this.gamma.reshape([1, lastDim])).addBroadcast(this.beta);

        return out.reshape(shape);
    }

    backward(gradOutput) {
        const shape = gradOutput.shape;
        const D = shape[shape.length - 1];
        const flatGrad = gradOutput.reshape([-1, D]);
        const flatX = this.lastX.reshape([-1, D]);
        const N = flatGrad.shape[0];

        const xHat = flatX.sub(this.lastMean).mul(this.lastInvVar);

        // Gamma and Beta gradients
        const dGamma = TensorOps.sum(flatGrad.mul(xHat), 0);
        const dBeta = TensorOps.sum(flatGrad, 0);

        this.gamma.grad = dGamma.data;
        this.beta.grad = dBeta.data;

        // Input gradient
        // dL/dx = (1/D) * gamma * invVar * [D * dL/dy - sum(dL/dy) - xHat * sum(dL/dy * xHat)]
        const term1 = flatGrad.mul(this.gamma.reshape([1, D]));
        const sum_dy = TensorOps.sum(term1, 1, true);
        const sum_dy_xhat = TensorOps.sum(term1.mul(xHat), 1, true);

        const dxHat = term1.scale(D).sub(sum_dy).sub(xHat.mul(sum_dy_xhat));
        const dX = dxHat.mul(this.lastInvVar).scale(1.0 / D);

        return dX.reshape(shape);
    }
}

export class BayesianLinear {
    constructor(inDim, outDim) {
        this.inDim = inDim;
        this.outDim = outDim;
        // Mu: Weights, Rho: Parametrizes variance via softplus
        this.w_mu = Tensor.randn([inDim, outDim]).scale(Math.sqrt(2 / inDim));
        this.w_rho = Tensor.ones([inDim, outDim]).scale(-3.0);
        this.bias_mu = Tensor.zeros([outDim]);
        this.bias_rho = Tensor.ones([outDim]).scale(-3.0);

        this.lastInput = null;
        this.lastEpsilonW = null;
        this.lastEpsilonB = null;
    }

    parameters() {
        return [this.w_mu, this.w_rho, this.bias_mu, this.bias_rho];
    }

    softplus(x) {
        return TensorOps.map(x, v => (v > 20) ? v : Math.log(1 + Math.exp(v)));
    }

    forward(x) {
        this.lastInput = x;
        const sigmaW = this.softplus(this.w_rho);
        const sigmaB = this.softplus(this.bias_rho);

        this.lastEpsilonW = Tensor.randn(this.w_mu.shape);
        this.lastEpsilonB = Tensor.randn(this.bias_mu.shape);

        const W = this.w_mu.add(sigmaW.mul(this.lastEpsilonW));
        const B = this.bias_mu.add(sigmaB.mul(this.lastEpsilonB));

        return x.matmul(W).addBroadcast(B);
    }

    backward(gradOutput) {
        const sigmaW = this.softplus(this.w_rho);
        const sigmaB = this.softplus(this.bias_rho);
        const W = this.w_mu.add(sigmaW.mul(this.lastEpsilonW));

        const flatX = this.lastInput.reshape([-1, this.inDim]);
        const flatGrad = gradOutput.reshape([-1, this.outDim]);

        const gradW = flatX.transpose().matmul(flatGrad);
        const gradB = TensorOps.sum(flatGrad, 0);

        // Mu gradients
        if (!this.w_mu.grad) this.w_mu.grad = new Float32Array(gradW.data.length);
        for (let i = 0; i < gradW.data.length; i++) this.w_mu.grad[i] += gradW.data[i];

        if (!this.bias_mu.grad) this.bias_mu.grad = new Float32Array(gradB.data.length);
        for (let i = 0; i < gradB.data.length; i++) this.bias_mu.grad[i] += gradB.data[i];

        // Rho gradients: dL/drho = dL/dw * epsilon * sigmoid(rho)
        const sigmoid = (v) => 1.0 / (1.0 + Math.exp(-v));

        const gradRhoW = gradW.mul(this.lastEpsilonW).mul(TensorOps.map(this.w_rho, sigmoid));
        if (!this.w_rho.grad) this.w_rho.grad = new Float32Array(gradRhoW.data.length);
        for (let i = 0; i < gradRhoW.data.length; i++) this.w_rho.grad[i] += gradRhoW.data[i];

        const gradRhoB = gradB.mul(this.lastEpsilonB).mul(TensorOps.map(this.bias_rho, sigmoid));
        if (!this.bias_rho.grad) this.bias_rho.grad = new Float32Array(gradRhoB.data.length);
        for (let i = 0; i < gradRhoB.data.length; i++) this.bias_rho.grad[i] += gradRhoB.data[i];

        return gradOutput.matmul(W.transpose());
    }
}

export class MultiHeadAttention {
    constructor(dModel, numHeads) {
        this.dModel = dModel;
        this.numHeads = numHeads;
        this.dHead = Math.floor(dModel / numHeads);
        this.scale = 1.0 / Math.sqrt(this.dHead);

        this.wQ = new Linear(dModel, dModel);
        this.wK = new Linear(dModel, dModel);
        this.wV = new Linear(dModel, dModel);
        this.wO = new Linear(dModel, dModel);

        this.cacheTheta = new Float32Array(this.dHead / 2);
        for (let i = 0; i < this.dHead / 2; i++) {
            this.cacheTheta[i] = 1.0 / Math.pow(10000, (2.0 * i) / this.dHead);
        }

        this.lastQRot = null;
        this.lastKRot = null;
        this.lastVHeads = null;
        this.lastAttn = null;
    }

    parameters() {
        return [...this.wQ.parameters(), ...this.wK.parameters(), ...this.wV.parameters(), ...this.wO.parameters()];
    }

    applyRoPE(tensor, inverse = false) {
        // tensor: [seqLen, dHead]
        const [seqLen, d] = tensor.shape;
        const out = Tensor.zeros(tensor.shape);
        const halfD = Math.floor(d / 2);

        for (let t = 0; t < seqLen; t++) {
            const off = t * d;
            for (let i = 0; i < halfD; i++) {
                const theta = this.cacheTheta[i];
                const angle = inverse ? -(t * theta) : (t * theta);
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                const v1 = tensor.data[off + 2 * i];
                const v2 = tensor.data[off + 2 * i + 1];

                out.data[off + 2 * i] = v1 * cos - v2 * sin;
                out.data[off + 2 * i + 1] = v1 * sin + v2 * cos;
            }
            if (d % 2 === 1) out.data[off + d - 1] = tensor.data[off + d - 1];
        }
        return out;
    }

    forward(x) {
        const [batch, seqLen, dModel] = x.shape;
        const Q = this.wQ.forward(x);
        const K = this.wK.forward(x);
        const V = this.wV.forward(x);

        this.lastQRot = [];
        this.lastKRot = [];
        this.lastVHeads = [];
        this.lastAttn = [];

        const batchOut = Tensor.zeros([batch, seqLen, dModel]);

        for (let b = 0; b < batch; b++) {
            for (let h = 0; h < this.numHeads; h++) {
                let qH = this.extractHead(Q, b, h, seqLen);
                let kH = this.extractHead(K, b, h, seqLen);
                const vH = this.extractHead(V, b, h, seqLen);

                qH = this.applyRoPE(qH);
                kH = this.applyRoPE(kH);

                this.lastQRot.push(qH);
                this.lastKRot.push(kH);
                this.lastVHeads.push(vH);

                let scores = qH.matmul(kH.transpose()).scale(this.scale);
                // Causal mask
                for (let r = 0; r < seqLen; r++) {
                    for (let c = r + 1; c < seqLen; c++) {
                        scores.data[r * seqLen + c] = -1e9;
                    }
                }

                const attn = scores.softmax();
                this.lastAttn.push(attn);

                const headOut = attn.matmul(vH);
                this.insertHead(batchOut, headOut, b, h, seqLen);
            }
        }
        return this.wO.forward(batchOut);
    }

    backward(gradOutput) {
        const [batch, seqLen, dModel] = gradOutput.shape;
        const dHeads = this.wO.backward(gradOutput);

        const dQTotal = Tensor.zeros([batch, seqLen, dModel]);
        const dKTotal = Tensor.zeros([batch, seqLen, dModel]);
        const dVTotal = Tensor.zeros([batch, seqLen, dModel]);

        let idx = 0;
        for (let b = 0; b < batch; b++) {
            for (let h = 0; h < this.numHeads; h++) {
                const dHeadOut = this.extractHead(dHeads, b, h, seqLen);
                const vH = this.lastVHeads[idx];
                const attn = this.lastAttn[idx];
                const qRot = this.lastQRot[idx];
                const kRot = this.lastKRot[idx];

                // dV = Attn^T * dHeadOut
                const dV_H = attn.transpose().matmul(dHeadOut);
                this.insertHead(dVTotal, dV_H, b, h, seqLen);

                // dAttn = dHeadOut * V^T
                const dAttn = dHeadOut.matmul(vH.transpose());
                const dScores = attn.softmaxBackward(dAttn).scale(this.scale);

                // dQRot = dScores * kRot
                let dQ_rot = dScores.matmul(kRot);
                // dKRot = dScores^T * qRot
                let dK_rot = dScores.transpose().matmul(qRot);

                const dQ_H = this.applyRoPE(dQ_rot, true);
                const dK_H = this.applyRoPE(dK_rot, true);

                this.insertHead(dQTotal, dQ_H, b, h, seqLen);
                this.insertHead(dKTotal, dK_H, b, h, seqLen);

                idx++;
            }
        }

        return this.wQ.backward(dQTotal)
            .add(this.wK.backward(dKTotal))
            .add(this.wV.backward(dVTotal));
    }

    extractHead(tensor, batchIdx, headIdx, seqLen) {
        const out = Tensor.zeros([seqLen, this.dHead]);
        const bOff = batchIdx * seqLen * this.dModel;
        const hOff = headIdx * this.dHead;
        for (let s = 0; s < seqLen; s++) {
            const rowOff = bOff + s * this.dModel + hOff;
            out.data.set(tensor.data.subarray(rowOff, rowOff + this.dHead), s * this.dHead);
        }
        return out;
    }

    insertHead(target, source, batchIdx, headIdx, seqLen) {
        const bOff = batchIdx * seqLen * this.dModel;
        const hOff = headIdx * this.dHead;
        for (let s = 0; s < seqLen; s++) {
            const rowOff = bOff + s * this.dModel + hOff;
            target.data.set(source.data.subarray(s * this.dHead, (s + 1) * this.dHead), rowOff);
        }
    }
}
