import { Tensor } from './tensor.js';

/**
 * Advanced Activation Functions with Backward Pass
 */

/**
 * GELU (Gaussian Error Linear Unit)
 * GELU(x) = x * Φ(x) where Φ(x) is the cumulative distribution function of the standard normal
 * Approximation: GELU(x) ≈ 0.5 * x * (1 + tanh(√(2/π) * (x + 0.044715 * x³)))
 */
export class GELU {
    constructor() {
        this.lastInput = null;
        // Coefficient for GELU tanh approximation (from the original paper)
        this.GELU_COEFF = 0.044715;
    }

    forward(x) {
        this.lastInput = x;
        const res = new Float32Array(x.data.length);
        
        for (let i = 0; i < x.data.length; i++) {
            const val = x.data[i];
            // GELU approximation using tanh
            const inner = Math.sqrt(2.0 / Math.PI) * (val + this.GELU_COEFF * val * val * val);
            res[i] = 0.5 * val * (1.0 + Math.tanh(inner));
        }
        
        return new Tensor(res, [...x.shape]);
    }

    backward(gradOutput) {
        const res = new Float32Array(this.lastInput.data.length);
        
        for (let i = 0; i < this.lastInput.data.length; i++) {
            const x = this.lastInput.data[i];
            
            // Derivative of GELU approximation
            const sqrt2OverPi = Math.sqrt(2.0 / Math.PI);
            const xCubed = x * x * x;
            const inner = sqrt2OverPi * (x + this.GELU_COEFF * xCubed);
            const tanhInner = Math.tanh(inner);
            const sechInner2 = 1.0 - tanhInner * tanhInner; // sech²(x) = 1 - tanh²(x)
            
            // d(GELU)/dx = 0.5 * (1 + tanh(inner)) + 0.5 * x * sech²(inner) * d(inner)/dx
            const dInner = sqrt2OverPi * (1.0 + this.GELU_COEFF * 3.0 * x * x);
            const derivative = 0.5 * (1.0 + tanhInner) + 0.5 * x * sechInner2 * dInner;
            
            res[i] = gradOutput.data[i] * derivative;
        }
        
        return new Tensor(res, [...this.lastInput.shape]);
    }
}

/**
 * Swish (SiLU - Sigmoid Linear Unit)
 * Swish(x) = x * sigmoid(x)
 */
export class Swish {
    constructor() {
        this.lastInput = null;
        this.lastSigmoid = null;
    }

    forward(x) {
        this.lastInput = x;
        const res = new Float32Array(x.data.length);
        this.lastSigmoid = new Float32Array(x.data.length);
        
        for (let i = 0; i < x.data.length; i++) {
            const val = x.data[i];
            const sigmoid = 1.0 / (1.0 + Math.exp(-val));
            this.lastSigmoid[i] = sigmoid;
            res[i] = val * sigmoid;
        }
        
        return new Tensor(res, [...x.shape]);
    }

    backward(gradOutput) {
        const res = new Float32Array(this.lastInput.data.length);
        
        for (let i = 0; i < this.lastInput.data.length; i++) {
            const x = this.lastInput.data[i];
            const sigmoid = this.lastSigmoid[i];
            
            // d(Swish)/dx = sigmoid + x * sigmoid * (1 - sigmoid)
            const derivative = sigmoid + x * sigmoid * (1.0 - sigmoid);
            
            res[i] = gradOutput.data[i] * derivative;
        }
        
        return new Tensor(res, [...this.lastInput.shape]);
    }
}

/**
 * Mish Activation
 * Mish(x) = x * tanh(softplus(x)) = x * tanh(ln(1 + e^x))
 */
export class Mish {
    constructor() {
        this.lastInput = null;
    }

    forward(x) {
        this.lastInput = x;
        const res = new Float32Array(x.data.length);
        
        for (let i = 0; i < x.data.length; i++) {
            const val = x.data[i];
            // Softplus with numerical stability
            let softplus;
            if (val > 20) {
                softplus = val;
            } else if (val < -20) {
                softplus = Math.exp(val);
            } else {
                softplus = Math.log(1.0 + Math.exp(val));
            }
            res[i] = val * Math.tanh(softplus);
        }
        
        return new Tensor(res, [...x.shape]);
    }

    backward(gradOutput) {
        const res = new Float32Array(this.lastInput.data.length);
        
        for (let i = 0; i < this.lastInput.data.length; i++) {
            const x = this.lastInput.data[i];
            
            // Compute softplus and its derivative
            let softplus, sigmoidX;
            if (x > 20) {
                softplus = x;
                sigmoidX = 1.0;
            } else if (x < -20) {
                softplus = Math.exp(x);
                sigmoidX = Math.exp(x);
            } else {
                softplus = Math.log(1.0 + Math.exp(x));
                sigmoidX = 1.0 / (1.0 + Math.exp(-x));
            }
            
            const tanhSoftplus = Math.tanh(softplus);
            const sech2Softplus = 1.0 - tanhSoftplus * tanhSoftplus;
            
            // d(Mish)/dx = tanh(softplus) + x * sech²(softplus) * sigmoid(x)
            const derivative = tanhSoftplus + x * sech2Softplus * sigmoidX;
            
            res[i] = gradOutput.data[i] * derivative;
        }
        
        return new Tensor(res, [...this.lastInput.shape]);
    }
}

/**
 * LeakyReLU with configurable slope
 */
export class LeakyReLU {
    constructor(negativeSlope = 0.01) {
        this.negativeSlope = negativeSlope;
        this.lastInput = null;
    }

    forward(x) {
        this.lastInput = x;
        const res = new Float32Array(x.data.length);
        
        for (let i = 0; i < x.data.length; i++) {
            res[i] = x.data[i] > 0 ? x.data[i] : this.negativeSlope * x.data[i];
        }
        
        return new Tensor(res, [...x.shape]);
    }

    backward(gradOutput) {
        const res = new Float32Array(this.lastInput.data.length);
        
        for (let i = 0; i < this.lastInput.data.length; i++) {
            const derivative = this.lastInput.data[i] > 0 ? 1.0 : this.negativeSlope;
            res[i] = gradOutput.data[i] * derivative;
        }
        
        return new Tensor(res, [...this.lastInput.shape]);
    }
}

/**
 * Dropout Layer for regularization
 */
export class Dropout {
    constructor(p = 0.5) {
        this.p = p; // Dropout probability
        this.mask = null;
        this.training = true;
    }

    setTraining(training) {
        this.training = training;
    }

    forward(x) {
        if (!this.training || this.p === 0) {
            return x;
        }

        this.mask = new Float32Array(x.data.length);
        const res = new Float32Array(x.data.length);
        const scale = 1.0 / (1.0 - this.p); // Inverted dropout

        for (let i = 0; i < x.data.length; i++) {
            // Generate random mask
            if (Math.random() > this.p) {
                this.mask[i] = 1.0;
                res[i] = x.data[i] * scale;
            } else {
                this.mask[i] = 0.0;
                res[i] = 0.0;
            }
        }

        return new Tensor(res, [...x.shape]);
    }

    backward(gradOutput) {
        if (!this.training || this.p === 0) {
            return gradOutput;
        }

        const res = new Float32Array(gradOutput.data.length);
        const scale = 1.0 / (1.0 - this.p);

        for (let i = 0; i < gradOutput.data.length; i++) {
            res[i] = gradOutput.data[i] * this.mask[i] * scale;
        }

        return new Tensor(res, [...gradOutput.shape]);
    }
}

/**
 * ReLU Activation
 */
export class ReLU {
    constructor() {
        this.lastInput = null;
    }

    forward(x) {
        this.lastInput = x;
        const res = new Float32Array(x.data.length);
        
        for (let i = 0; i < x.data.length; i++) {
            res[i] = Math.max(0, x.data[i]);
        }
        
        return new Tensor(res, [...x.shape]);
    }

    backward(gradOutput) {
        const res = new Float32Array(this.lastInput.data.length);
        
        for (let i = 0; i < this.lastInput.data.length; i++) {
            res[i] = this.lastInput.data[i] > 0 ? gradOutput.data[i] : 0;
        }
        
        return new Tensor(res, [...this.lastInput.shape]);
    }
}
