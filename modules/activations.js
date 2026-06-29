import { Tensor } from './tensor.js';

/**
 * ADVANCED ACTIVATION FUNCTIONS (VERSION 3.0)
 * Numerically stable implementations with support for autograd backward pass.
 */

/**
 * GELU (Gaussian Error Linear Unit)
 * Approximation: 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
 */
export class GELU {
    constructor() {
        this.lastInput = null;
        this.GELU_COEFF = 0.044715;
    }

    forward(x) {
        this.lastInput = x;
        const res = new Float32Array(x.data.length);
        const sqrt2OverPi = Math.sqrt(2.0 / Math.PI);
        
        for (let i = 0; i < x.data.length; i++) {
            const val = x.data[i];
            const inner = sqrt2OverPi * (val + this.GELU_COEFF * Math.pow(val, 3));
            res[i] = 0.5 * val * (1.0 + Math.tanh(inner));
        }
        return new Tensor(res, [...x.shape]);
    }

    backward(gradOutput) {
        const res = new Float32Array(this.lastInput.data.length);
        const sqrt2OverPi = Math.sqrt(2.0 / Math.PI);
        
        for (let i = 0; i < this.lastInput.data.length; i++) {
            const x = this.lastInput.data[i];
            const inner = sqrt2OverPi * (x + this.GELU_COEFF * Math.pow(x, 3));
            const tanhInner = Math.tanh(inner);
            const sech2Inner = 1.0 - tanhInner * tanhInner;
            
            const dInner = sqrt2OverPi * (1.0 + 3.0 * this.GELU_COEFF * x * x);
            const deriv = 0.5 * (1.0 + tanhInner) + 0.5 * x * sech2Inner * dInner;
            
            res[i] = gradOutput.data[i] * deriv;
        }
        return new Tensor(res, [...this.lastInput.shape]);
    }
}

/**
 * SiLU / Swish
 * Formula: x * sigmoid(x)
 */
export class Swish {
    constructor() {
        this.lastInput = null;
        this.lastSigmoid = null;
    }

    forward(x) {
        this.lastInput = x;
        const res = new Float32Array(x.data.length);
        const sig = new Float32Array(x.data.length);
        for (let i = 0; i < x.data.length; i++) {
            sig[i] = 1.0 / (1.0 + Math.exp(-x.data[i]));
            res[i] = x.data[i] * sig[i];
        }
        this.lastSigmoid = sig;
        return new Tensor(res, [...x.shape]);
    }

    backward(gradOutput) {
        const res = new Float32Array(this.lastInput.data.length);
        for (let i = 0; i < this.lastInput.data.length; i++) {
            const s = this.lastSigmoid[i];
            const x = this.lastInput.data[i];
            // deriv = sigmoid(x) + x * sigmoid(x) * (1 - sigmoid(x))
            //       = sigmoid(x) * (1 + x * (1 - sigmoid(x)))
            const deriv = s * (1.0 + x * (1.0 - s));
            res[i] = gradOutput.data[i] * deriv;
        }
        return new Tensor(res, [...this.lastInput.shape]);
    }
}

/**
 * Mish Activation
 * Formula: x * tanh(softplus(x))
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
            // Softplus with stability
            const sp = (val > 20) ? val : Math.log(1 + Math.exp(val));
            res[i] = val * Math.tanh(sp);
        }
        return new Tensor(res, [...x.shape]);
    }

    backward(gradOutput) {
        const res = new Float32Array(this.lastInput.data.length);
        for (let i = 0; i < this.lastInput.data.length; i++) {
            const x = this.lastInput.data[i];
            const e = Math.exp(x);
            const delta = 1 + 2 * e + e * e; // (1+e)^2
            const omega = 4 * (x + 1) + 4 * Math.exp(2 * x) + Math.exp(3 * x) + e * (4 * x + 6);
            const deriv = e * omega / Math.pow(delta + e, 2);
            // Simplified approximation for derivative
            const sp = (x > 20) ? x : Math.log(1 + Math.exp(x));
            const tsp = Math.tanh(sp);
            const sig = 1.0 / (1.0 + Math.exp(-x));
            const d = tsp + x * sig * (1.0 - tsp * tsp);
            res[i] = gradOutput.data[i] * d;
        }
        return new Tensor(res, [...this.lastInput.shape]);
    }
}

/**
 * ReLU
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

/**
 * LeakyReLU (Configurable slope)
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
            const deriv = this.lastInput.data[i] > 0 ? 1.0 : this.negativeSlope;
            res[i] = gradOutput.data[i] * deriv;
        }
        return new Tensor(res, [...this.lastInput.shape]);
    }
}

/**
 * Dropout
 */
export class Dropout {
    constructor(p = 0.5) {
        this.p = p;
        this.mask = null;
        this.training = true;
    }

    setTraining(t) { this.training = t; }

    forward(x) {
        if (!this.training || this.p === 0) return x;
        this.mask = new Float32Array(x.data.length);
        const res = new Float32Array(x.data.length);
        const scale = 1.0 / (1.0 - this.p);
        for (let i = 0; i < x.data.length; i++) {
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
        if (!this.training || this.p === 0) return gradOutput;
        const res = new Float32Array(gradOutput.data.length);
        const scale = 1.0 / (1.0 - this.p);
        for (let i = 0; i < gradOutput.data.length; i++) {
            res[i] = gradOutput.data[i] * this.mask[i] * scale;
        }
        return new Tensor(res, [...gradOutput.shape]);
    }
}

/**
 * Sigmoid
 */
export class Sigmoid {
    constructor() {
        this.lastOutput = null;
    }

    forward(x) {
        const res = new Float32Array(x.data.length);
        for (let i = 0; i < x.data.length; i++) {
            res[i] = 1.0 / (1.0 + Math.exp(-x.data[i]));
        }
        this.lastOutput = new Tensor(res, [...x.shape]);
        return this.lastOutput;
    }

    backward(gradOutput) {
        const res = new Float32Array(this.lastOutput.data.length);
        for (let i = 0; i < this.lastOutput.data.length; i++) {
            const s = this.lastOutput.data[i];
            res[i] = gradOutput.data[i] * s * (1.0 - s);
        }
        return new Tensor(res, [...this.lastOutput.shape]);
    }
}

/**
 * Tanh
 */
export class Tanh {
    constructor() {
        this.lastOutput = null;
    }

    forward(x) {
        const res = new Float32Array(x.data.length);
        for (let i = 0; i < x.data.length; i++) {
            res[i] = Math.tanh(x.data[i]);
        }
        this.lastOutput = new Tensor(res, [...x.shape]);
        return this.lastOutput;
    }

    backward(gradOutput) {
        const res = new Float32Array(this.lastOutput.data.length);
        for (let i = 0; i < this.lastOutput.data.length; i++) {
            const t = this.lastOutput.data[i];
            res[i] = gradOutput.data[i] * (1.0 - t * t);
        }
        return new Tensor(res, [...this.lastOutput.shape]);
    }
}
