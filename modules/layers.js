import { Tensor } from './tensor.js';

// ==========================================
// 2. NEURAL LAYERS
// ==========================================
export class Linear {
    constructor(inFeat, outFeat) {
        this.weights = Tensor.randn([inFeat, outFeat], 0.0, 0.05);
        this.bias = Tensor.zeros([outFeat]);
        this.lastInput = null;
    }
    parameters() { return [this.weights, this.bias]; }

    forward(x) {
        this.lastInput = x;
        let out = x.matmul(this.weights);
        return out.addBroadcast(this.bias);
    }

    backward(gradOutput) {
        const gradInput = gradOutput.matmul(this.weights.transpose());
        const gradWeights = this.lastInput.transpose().matmul(gradOutput);

        this.weights.zeroGrad();
        this.bias.zeroGrad();

        const len = this.weights.grad.length;
        const totalLen = gradWeights.data.length;
        for (let i = 0; i < totalLen; i++) this.weights.grad[i % len] += gradWeights.data[i];

        const outDim = this.bias.shape[0];
        const rows = gradOutput.data.length / outDim;
        for (let r = 0; r < rows; r++) {
            const offset = r * outDim;
            for (let i = 0; i < outDim; i++) {
                this.bias.grad[i] += gradOutput.data[offset + i];
            }
        }
        return gradInput;
    }
}

export class LayerNorm {
    constructor(dim, eps = 1e-5) {
        // Validation: ensure dimension is positive integer
        if (!Number.isInteger(dim) || dim <= 0) {
            throw new Error(`LayerNorm dimension must be a positive integer, got ${dim}`);
        }
        // Validation: ensure epsilon is positive for numerical stability
        if (!(eps > 0) || !Number.isFinite(eps)) {
            throw new Error(`LayerNorm epsilon must be positive and finite, got ${eps}`);
        }
        
        this.gamma = Tensor.zeros([dim]);
        for (let i = 0; i < dim; i++) this.gamma.data[i] = 1.0;
        this.beta = Tensor.zeros([dim]);
        this.eps = eps;
        this.dim = dim;
        this.lastXHat = null;
        this.lastInvStd = null;
    }

    parameters() { return [this.gamma, this.beta]; }

    forward(x) {
        // Validation: check input is not null/undefined
        if (!x || !x.data) {
            throw new Error('LayerNorm.forward: input tensor is null or invalid');
        }
        
        // Validation: check input length is divisible by dimension
        if (x.data.length % this.dim !== 0) {
            throw new Error(`LayerNorm.forward: input size ${x.data.length} not divisible by dimension ${this.dim}`);
        }
        
        const res = new Float32Array(x.data.length);
        const rows = x.data.length / this.dim;
        this.lastXHat = new Float32Array(x.data.length);
        this.lastInvStd = new Float32Array(rows);

        for (let r = 0; r < rows; r++) {
            const offset = r * this.dim;
            
            // Compute mean with Kahan summation for numerical accuracy
            let mean = 0;
            let compensation = 0;
            for (let i = 0; i < this.dim; i++) {
                const y = x.data[offset + i] - compensation;
                const t = mean + y;
                compensation = (t - mean) - y;
                mean = t;
            }
            mean /= this.dim;
            
            // Compute variance with numerical stability
            let sqSum = 0;
            for (let i = 0; i < this.dim; i++) {
                const d = x.data[offset + i] - mean;
                sqSum += d * d;
            }
            
            // Add epsilon before sqrt for numerical stability (prevents division by zero)
            const variance = (sqSum / this.dim) + this.eps;
            const invStd = 1.0 / Math.sqrt(variance);
            
            // Validate invStd is finite (detects NaN/Inf propagation early)
            if (!Number.isFinite(invStd)) {
                throw new Error(`LayerNorm: non-finite invStd detected at row ${r}. Variance: ${variance}, sqSum: ${sqSum}`);
            }
            
            this.lastInvStd[r] = invStd;
            for (let i = 0; i < this.dim; i++) {
                const norm = (x.data[offset + i] - mean) * invStd;
                this.lastXHat[offset + i] = norm;
                res[offset + i] = norm * this.gamma.data[i] + this.beta.data[i];
            }
        }
        return new Tensor(res, [...x.shape]);
    }

    backward(gradOutput) {
        // dL/dgamma = sum(dL/dy * x_hat)
        // dL/dbeta = sum(dL/dy)
        this.gamma.zeroGrad();
        this.beta.zeroGrad();
        const rows = gradOutput.data.length / this.dim;
        const gradInput = Tensor.zeros(gradOutput.shape);

        // N = dim
        const N = this.dim;

        for (let r = 0; r < rows; r++) {
            const offset = r * this.dim;
            const invStd = this.lastInvStd[r];

            let sumDxHat = 0.0;
            let sumDxHatXHat = 0.0;

            // 1. Compute gradients for Gamma/Beta and intermediate sums
            for (let i = 0; i < this.dim; i++) {
                const dout = gradOutput.data[offset + i];
                // Accumulate parameter gradients
                this.gamma.grad[i] += dout * this.lastXHat[offset + i];
                this.beta.grad[i] += dout;

                // dx_hat = dout * gamma
                const dxHat = dout * this.gamma.data[i];
                sumDxHat += dxHat;
                sumDxHatXHat += dxHat * this.lastXHat[offset + i];
            }

            // 2. Compute gradient wrt Input X
            // Formula: dx = (1/N) * invStd * (N * dxHat - sum(dxHat) - xHat * sum(dxHat * xHat))
            for (let i = 0; i < this.dim; i++) {
                const dout = gradOutput.data[offset + i];
                const dxHat = dout * this.gamma.data[i];
                const xHat = this.lastXHat[offset + i];

                const term = (N * dxHat - sumDxHat - xHat * sumDxHatXHat);
                gradInput.data[offset + i] = (1.0 / N) * invStd * term;
            }
        }
        return gradInput;
    }
}

export class Embedding {
    constructor(vocabSize, dModel) {
        this.weights = Tensor.randn([vocabSize, dModel], 0.0, 0.1);
        this.dModel = dModel;
        this.lastIndices = null;
    }
    parameters() { return [this.weights]; }

    forwardIndices(indices) {
        this.lastIndices = indices;
        const count = indices.length;
        const res = Tensor.zeros([1, count, this.dModel]);
        for (let i = 0; i < count; i++) {
            const idx = indices[i] % this.weights.shape[0];
            const wOffset = idx * this.dModel;
            const rOffset = i * this.dModel;
            for (let j = 0; j < this.dModel; j++) {
                res.data[rOffset + j] = this.weights.data[wOffset + j];
            }
        }
        return res;
    }

    backward(gradOutput) {
        this.weights.zeroGrad();
        const count = this.lastIndices.length;
        for (let i = 0; i < count; i++) {
            const idx = this.lastIndices[i] % this.weights.shape[0];
            const rOffset = i * this.dModel;
            const wOffset = idx * this.dModel;
            for (let j = 0; j < this.dModel; j++) {
                this.weights.grad[wOffset + j] += gradOutput.data[rOffset + j];
            }
        }
        return null;
    }
}

export class BayesianLinear {
    constructor(inFeat, outFeat) {
        // We learn parameters for the distribution: Mu (mean) and Rho (uncertainty)
        this.w_mu = Tensor.randn([inFeat, outFeat], 0.0, 0.05);
        this.w_rho = Tensor.randn([inFeat, outFeat], -3.0, 0.1); // Init rho small for low initial variance

        this.bias_mu = Tensor.zeros([outFeat]);
        this.bias_rho = Tensor.randn([outFeat], -3.0, 0.1);

        this.lastInput = null;
        this.lastEpsilonW = null;
        this.lastEpsilonB = null;
        this.lastSigmaW = null;
    }

    parameters() {
        // Returns variational parameters to be optimized
        return [this.w_mu, this.w_rho, this.bias_mu, this.bias_rho];
    }

    forward(x) {
        this.lastInput = x;

        // 1. Sample Epsilon ~ N(0, 1)
        this.lastEpsilonW = Tensor.randn(this.w_mu.shape, 0, 1);
        this.lastEpsilonB = Tensor.randn(this.bias_mu.shape, 0, 1);

        // 2. Calculate Sigma = log(1 + exp(rho)) (Softplus approximation)
        const sigmaW = this.computeSoftplus(this.w_rho);
        const sigmaB = this.computeSoftplus(this.bias_rho);
        this.lastSigmaW = sigmaW; // Cache for backward

        // 3. Reparameterization: w = mu + sigma * epsilon
        // We manually implement element-wise ops here for the specific sampling
        const weightsSample = this.sample(this.w_mu, sigmaW, this.lastEpsilonW);
        const biasSample = this.sample(this.bias_mu, sigmaB, this.lastEpsilonB);

        // 4. Standard Forward with sampled weights
        let out = x.matmul(weightsSample);
        return out.addBroadcast(biasSample);
    }

    /**
     * Softplus: log(1 + exp(x)) with numerical stability
     * 
     * Mathematical properties:
     * - softplus(x) ≈ x for large x (x > 20)
     * - softplus(x) ≈ exp(x) for very negative x (x < -20)
     * - Smooth approximation to ReLU: lim(x→∞) softplus(x) = x
     * 
     * Numerical stability bounds:
     * - For x > 20: exp(x) >> 1, so log(1 + exp(x)) ≈ x
     * - For x < -20: exp(x) ≈ 0, so log(1 + exp(x)) ≈ log(1) = 0
     * - For -20 <= x <= 20: use standard formula
     */
    computeSoftplus(tensor) {
        const res = new Float32Array(tensor.data.length);
        for (let i = 0; i < tensor.data.length; i++) {
            const x = tensor.data[i];
            // Numerical stability: softplus(x) ≈ x for x > 20
            if (x > 20) {
                res[i] = x;
            } else if (x < -20) {
                res[i] = Math.exp(x); // softplus(x) ≈ e^x for x < -20
            } else {
                // Use log1p for better numerical stability (HIGH FIX #6)
                res[i] = Math.log1p(Math.exp(x)); // log1p(y) = log(1 + y)
            }
        }
        return new Tensor(res, tensor.shape);
    }

    // Helper: w = mu + sigma * eps
    sample(mu, sigma, eps) {
        const res = new Float32Array(mu.data.length);
        for (let i = 0; i < mu.data.length; i++) {
            res[i] = mu.data[i] + (sigma.data[i] * eps.data[i]);
        }
        return new Tensor(res, mu.shape);
    }

    klDivergence() {
        // KL[q(w)||p(w)] where q(w) ~ N(μ_q, σ_q²) and p(w) ~ N(0, 1)
        // Formula: KL = 0.5 * (σ_q² + μ_q² - 1 - log(σ_q²))
        //         = 0.5 * (σ_q² + μ_q² - 1 - 2*log(σ_q))
        const sigmaW = this.computeSoftplus(this.w_rho);
        const sigmaB = this.computeSoftplus(this.bias_rho);

        let kl = 0.0;
        // For weights (HIGH FIX #7: Improved numerical stability)
        for (let i = 0; i < this.w_mu.data.length; i++) {
            const mu = this.w_mu.data[i];
            const sigma = Math.max(sigmaW.data[i], 1e-6); // Increased epsilon
            const logSigma = Math.log(sigma); // Compute once
            const mu2 = mu * mu;
            // KL = 0.5 * (σ² + μ² - 1 - 2*log(σ))
            kl += 0.5 * (sigma * sigma + mu2 - 1.0 - 2.0 * logSigma);
        }
        // For bias
        for (let i = 0; i < this.bias_mu.data.length; i++) {
            const mu = this.bias_mu.data[i];
            const sigma = Math.max(sigmaB.data[i], 1e-6); // Increased epsilon
            const logSigma = Math.log(sigma);
            const mu2 = mu * mu;
            kl += 0.5 * (sigma * sigma + mu2 - 1.0 - 2.0 * logSigma);
        }
        return kl;
    }

    klGradient(scale = 1.0) {
        // Calculate gradients for KL divergence term:
        // dKL/dMu = mu * scale
        // dKL/dRho = (sigma - 1/sigma) * sigmoid(rho) * scale

        const sigmaW = this.computeSoftplus(this.w_rho);
        const sigmaB = this.computeSoftplus(this.bias_rho);

        // For weights
        for (let i = 0; i < this.w_mu.data.length; i++) {
            const mu = this.w_mu.data[i];
            const rho = this.w_rho.data[i];
            const sigma = Math.max(sigmaW.data[i], 1e-6);

            // dKL/dMu = mu
            this.w_mu.grad[i] += mu * scale;

            // dKL/dRho = (sigma - 1/sigma) * sigmoid(rho)
            const dKL_dSigma = sigma - (1.0 / sigma);
            const sigmoid = 1.0 / (1.0 + Math.exp(-rho));
            this.w_rho.grad[i] += dKL_dSigma * sigmoid * scale;
        }

        // For bias
        for (let i = 0; i < this.bias_mu.data.length; i++) {
            const mu = this.bias_mu.data[i];
            const rho = this.bias_rho.data[i];
            const sigma = Math.max(sigmaB.data[i], 1e-6);

            // dKL/dMu = mu
            this.bias_mu.grad[i] += mu * scale;

            // dKL/dRho = (sigma - 1/sigma) * sigmoid(rho)
            const dKL_dSigma = sigma - (1.0 / sigma);
            const sigmoid = 1.0 / (1.0 + Math.exp(-rho));
            this.bias_rho.grad[i] += dKL_dSigma * sigmoid * scale;
        }
    }

    backward(gradOutput) {
        // Backward pass for Bayesian Linear Layer
        // dLoss/dMu = dLoss/dW (direct gradient)
        // dLoss/dRho = dLoss/dW * epsilon * d(softplus)/dRho
        // where d(softplus)/dRho = sigmoid(rho) = 1/(1 + e^(-rho))

        // 1. Get gradient wrt the sampled weights (standard backprop)
        const sigmaW = this.computeSoftplus(this.w_rho);
        const sigmaB = this.computeSoftplus(this.bias_rho);
        const wSample = this.sample(this.w_mu, sigmaW, this.lastEpsilonW);

        const gradInput = gradOutput.matmul(wSample.transpose());
        const gradWeightsSample = this.lastInput.transpose().matmul(gradOutput);

        this.w_mu.zeroGrad();
        this.w_rho.zeroGrad();
        this.bias_mu.zeroGrad();
        this.bias_rho.zeroGrad();

        // 2. Distribute gradients to weight parameters (Mu and Rho)
        // 2. Distribute gradients to weight parameters (Mu and Rho)
        // BUG FIX: Handle batched gradients by accumulating over total length
        const paramLen = this.w_mu.data.length;
        const totalLen = gradWeightsSample.data.length;

        for (let i = 0; i < totalLen; i++) {
            const idx = i % paramLen;
            const dW = gradWeightsSample.data[i];

            // Gradient wrt Mu: ∂L/∂μ = ∂L/∂w
            this.w_mu.grad[idx] += dW;

            // Gradient wrt Rho: ∂L/∂ρ = ∂L/∂w * ε * ∂σ/∂ρ
            // where ∂σ/∂ρ = sigmoid(ρ) for softplus
            const rho = this.w_rho.data[idx];
            const sigmoid = 1.0 / (1.0 + Math.exp(-rho));
            this.w_rho.grad[idx] += dW * this.lastEpsilonW.data[idx] * sigmoid;
        }

        // 3. Distribute gradients to bias parameters (Mu and Rho)
        const outDim = this.bias_mu.shape[0];
        const rows = gradOutput.data.length / outDim;

        for (let r = 0; r < rows; r++) {
            const offset = r * outDim;
            for (let i = 0; i < outDim; i++) {
                const dB = gradOutput.data[offset + i];

                // Gradient wrt bias Mu
                this.bias_mu.grad[i] += dB;

                // Gradient wrt bias Rho
                const rho = this.bias_rho.data[i];
                const sigmoid = 1.0 / (1.0 + Math.exp(-rho));
                this.bias_rho.grad[i] += dB * this.lastEpsilonB.data[i] * sigmoid;
            }
        }

        return gradInput;
    }
}



export class MultiHeadAttention {
    constructor(dModel, numHeads) {
        this.dModel = dModel;
        this.numHeads = numHeads;
        this.dHead = Math.floor(dModel / numHeads);

        this.wQ = new Linear(dModel, dModel);
        this.wK = new Linear(dModel, dModel);
        this.wV = new Linear(dModel, dModel);
        this.wO = new Linear(dModel, dModel);
        this.scale = 1.0 / Math.sqrt(this.dHead);

        // Precompute RoPE frequencies
        this.cacheTheta = new Float32Array(this.dHead / 2);
        for (let i = 0; i < this.dHead / 2; i++) {
            this.cacheTheta[i] = 1.0 / Math.pow(10000, (2.0 * i) / this.dHead);
        }

        // Cache for backward pass
        this.lastAttnWeights = null;
        this.lastQRotated = null;
        this.lastKRotated = null;
        this.lastVHeads = null;
        this.lastScores = null; // Pre-softmax
        this.lastAttn = null;   // Post-softmax
    }

    parameters() {
        return [...this.wQ.parameters(), ...this.wK.parameters(), ...this.wV.parameters(), ...this.wO.parameters()];
    }

    forward(x) {
        const Q = this.wQ.forward(x);
        const K = this.wK.forward(x);
        const V = this.wV.forward(x);
        const seqLen = x.shape[1];

        // Prepare storage for backward pass
        this.lastQRotated = [];
        this.lastKRotated = [];
        this.lastVHeads = [];
        this.lastAttn = [];

        const batchOut = Tensor.zeros([1, seqLen, this.dModel]);

        // Store attention weights for visualization (first head)
        this.lastAttnWeights = null;

        for (let h = 0; h < this.numHeads; h++) {
            let qH = this.extractHead(Q, h, seqLen);
            let kH = this.extractHead(K, h, seqLen);
            const vH = this.extractHead(V, h, seqLen);

            // UPGRADE #9: Apply RoPE to Q and K
            qH = this.applyRoPE(qH, seqLen, false);
            kH = this.applyRoPE(kH, seqLen, false);

            // Cache for backward
            this.lastQRotated.push(qH);
            this.lastKRotated.push(kH);
            this.lastVHeads.push(vH);

            // Attention Scores
            let scores = qH.matmul(kH.transpose());
            scores = scores.scale(this.scale);
            this.applyMask(scores, seqLen);

            const attn = scores.softmax();
            this.lastAttn.push(attn);

            if (h === 0) {
                this.lastAttnWeights = Array.from(attn.data);
            }

            const headOut = attn.matmul(vH);
            this.insertHead(batchOut, headOut, h, seqLen);
        }
        return this.wO.forward(batchOut);
    }

    backward(gradOutput) {
        // 1. Backprop through Output Projection
        const dHeads = this.wO.backward(gradOutput);
        const seqLen = gradOutput.shape[1];

        // Gradients for Q, K, V (accumulated across heads)
        const dQTotal = Tensor.zeros([1, seqLen, this.dModel]);
        const dKTotal = Tensor.zeros([1, seqLen, this.dModel]);
        const dVTotal = Tensor.zeros([1, seqLen, this.dModel]);

        for (let h = 0; h < this.numHeads; h++) {
            const dHeadOut = this.extractHead(dHeads, h, seqLen);
            const vH = this.lastVHeads[h];
            const attn = this.lastAttn[h];
            const qRotated = this.lastQRotated[h];
            const kRotated = this.lastKRotated[h];

            // dV = Attn^T @ dHeadOut
            const dV_H = attn.transpose().matmul(dHeadOut);
            this.insertHead(dVTotal, dV_H, h, seqLen);

            // dAttn = dHeadOut @ V^T
            const dAttn = dHeadOut.matmul(vH.transpose());

            // dScores = dSoftmax(dAttn) * scale
            // We use the new softmaxBackward method on the Softmax Output (attn)
            const dScores = attn.softmaxBackward(dAttn).scale(this.scale);

            // dQ_rotated = dScores @ K_rotated
            let dQ_rot = dScores.matmul(kRotated);

            // dK_rotated = dScores^T @ Q_rotated
            let dK_rot = dScores.transpose().matmul(qRotated);

            // Backprop through RoPE (Inverse Rotation)
            const dQ_H = this.applyRoPE(dQ_rot, seqLen, true);
            const dK_H = this.applyRoPE(dK_rot, seqLen, true);

            this.insertHead(dQTotal, dQ_H, h, seqLen);
            this.insertHead(dKTotal, dK_H, h, seqLen);
        }

        // 2. Backprop through Projections
        // We must sum the gradients flowing back to the input from Q, K, and V paths
        const dInputQ = this.wQ.backward(dQTotal);
        const dInputK = this.wK.backward(dKTotal);
        const dInputV = this.wV.backward(dVTotal);

        // dInput = dInputQ + dInputK + dInputV
        return dInputQ.add(dInputK).add(dInputV);
    }

    extractHead(tensor, headIdx, seqLen) {
        const out = Tensor.zeros([seqLen, this.dHead]);
        const offset = headIdx * this.dHead;
        for (let s = 0; s < seqLen; s++) {
            for (let d = 0; d < this.dHead; d++) {
                out.data[s * this.dHead + d] = tensor.data[s * this.dModel + (offset + d)];
            }
        }
        return out;
    }

    insertHead(target, source, headIdx, seqLen) {
        const offset = headIdx * this.dHead;
        for (let s = 0; s < seqLen; s++) {
            for (let d = 0; d < this.dHead; d++) {
                target.data[s * this.dModel + (offset + d)] = source.data[s * this.dHead + d];
            }
        }
    }

    /**
     * Apply causal attention mask
     * 
     * Mathematical purpose: Prevent attention from future tokens in autoregressive models
     * Sets scores[i][j] = -∞ for j > i (future positions)
     * 
     * Implementation uses -1e9 instead of -Infinity because:
     * 1. exp(-1e9) ≈ 0 in float32 precision
     * 2. Avoids NaN propagation that can occur with -Infinity
     * 3. Maintains numerical stability in softmax computation
     */
    applyMask(scores, seqLen) {
        // Large negative value that softmax will treat as ~0 probability
        // Using -1e9 instead of -Infinity for numerical stability
        const MASK_VALUE = -1e9;
        
        for (let r = 0; r < seqLen; r++) {
            for (let c = 0; c < seqLen; c++) {
                if (c > r) {
                    scores.data[r * seqLen + c] = MASK_VALUE;
                }
            }
        }
    }

    // UPGRADE #9: Rotary Position Embeddings (RoPE)
    // Formula: theta_i = 10000^(-2i/d) where i ∈ [0, d/2)
    // Rotation matrix: [[cos(m*theta), -sin(m*theta)], [sin(m*theta), cos(m*theta)]]
    applyRoPE(tensor, seqLen, inverse = false) {
        const out = Tensor.zeros(tensor.shape);
        const d = this.dHead;
        const halfD = Math.floor(d / 2);

        // Validate tensor size
        const expectedSize = seqLen * d;
        if (tensor.data.length !== expectedSize) {
            throw new Error(`RoPE: Expected tensor size ${expectedSize}, got ${tensor.data.length}`);
        }

        for (let t = 0; t < seqLen; t++) {
            const offset = t * d;
            for (let i = 0; i < halfD; i++) {
                // Use cached theta
                const theta = this.cacheTheta[i];
                const angle = t * theta;
                const finalAngle = inverse ? -angle : angle;

                const cos = Math.cos(finalAngle);
                const sin = Math.sin(finalAngle);

                const idx1 = offset + 2 * i;
                const idx2 = offset + 2 * i + 1;

                const val1 = tensor.data[idx1];
                const val2 = tensor.data[idx2];

                // Apply 2D rotation matrix
                out.data[idx1] = val1 * cos - val2 * sin;
                out.data[idx2] = val1 * sin + val2 * cos;
            }

            // Handle odd dimensions
            if (d % 2 === 1) {
                out.data[offset + d - 1] = tensor.data[offset + d - 1];
            }
        }
        return out;
    }
}
