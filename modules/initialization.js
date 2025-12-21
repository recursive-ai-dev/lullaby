import { Tensor } from './tensor.js';

/**
 * Weight Initialization Strategies
 * Proper initialization is crucial for deep learning model training
 */

export class Initializer {
    /**
     * Xavier/Glorot Uniform Initialization
     * Uniform(-√(6/(fan_in + fan_out)), √(6/(fan_in + fan_out)))
     * Good for: Sigmoid, Tanh activations
     * 
     * @param {Array<number>} shape - Shape of the weight tensor
     * @param {number} fanIn - Number of input units
     * @param {number} fanOut - Number of output units
     */
    static xavierUniform(shape, fanIn, fanOut) {
        const limit = Math.sqrt(6.0 / (fanIn + fanOut));
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        
        for (let i = 0; i < size; i++) {
            data[i] = (Math.random() * 2 - 1) * limit;
        }
        
        return new Tensor(data, shape);
    }

    /**
     * Xavier/Glorot Normal Initialization
     * Normal(0, √(2/(fan_in + fan_out)))
     * Good for: Sigmoid, Tanh activations
     * 
     * @param {Array<number>} shape - Shape of the weight tensor
     * @param {number} fanIn - Number of input units
     * @param {number} fanOut - Number of output units
     */
    static xavierNormal(shape, fanIn, fanOut) {
        const std = Math.sqrt(2.0 / (fanIn + fanOut));
        return Tensor.randn(shape, 0, std);
    }

    /**
     * He/Kaiming Uniform Initialization
     * Uniform(-√(6/fan_in), √(6/fan_in))
     * Good for: ReLU and its variants
     * 
     * @param {Array<number>} shape - Shape of the weight tensor
     * @param {number} fanIn - Number of input units
     */
    static heUniform(shape, fanIn) {
        const limit = Math.sqrt(6.0 / fanIn);
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        
        for (let i = 0; i < size; i++) {
            data[i] = (Math.random() * 2 - 1) * limit;
        }
        
        return new Tensor(data, shape);
    }

    /**
     * He/Kaiming Normal Initialization
     * Normal(0, √(2/fan_in))
     * Good for: ReLU and its variants
     * 
     * @param {Array<number>} shape - Shape of the weight tensor
     * @param {number} fanIn - Number of input units
     */
    static heNormal(shape, fanIn) {
        const std = Math.sqrt(2.0 / fanIn);
        return Tensor.randn(shape, 0, std);
    }

    /**
     * LeCun Uniform Initialization
     * Uniform(-√(3/fan_in), √(3/fan_in))
     * Good for: SELU activation
     * 
     * @param {Array<number>} shape - Shape of the weight tensor
     * @param {number} fanIn - Number of input units
     */
    static lecunUniform(shape, fanIn) {
        const limit = Math.sqrt(3.0 / fanIn);
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        
        for (let i = 0; i < size; i++) {
            data[i] = (Math.random() * 2 - 1) * limit;
        }
        
        return new Tensor(data, shape);
    }

    /**
     * LeCun Normal Initialization
     * Normal(0, √(1/fan_in))
     * Good for: SELU activation
     * 
     * @param {Array<number>} shape - Shape of the weight tensor
     * @param {number} fanIn - Number of input units
     */
    static lecunNormal(shape, fanIn) {
        const std = Math.sqrt(1.0 / fanIn);
        return Tensor.randn(shape, 0, std);
    }

    /**
     * Orthogonal Initialization
     * Initialize weights as an orthogonal matrix
     * Good for: RNNs, deep networks
     * 
     * @param {Array<number>} shape - Shape of the weight tensor [rows, cols]
     * @param {number} gain - Scaling factor (default: 1.0)
     */
    static orthogonal(shape, gain = 1.0) {
        if (shape.length !== 2) {
            throw new Error("Orthogonal initialization requires 2D shape");
        }

        const rows = shape[0];
        const cols = shape[1];
        const flatSize = rows * cols;
        
        // Generate random matrix
        const data = new Float32Array(flatSize);
        for (let i = 0; i < flatSize; i++) {
            // Use normal distribution
            let u1, u2;
            do {
                u1 = Math.random();
                u2 = Math.random();
            } while (u1 <= 1e-10);
            
            const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            data[i] = z;
        }
        
        // QR decomposition (simplified for square or tall matrices)
        // For a full implementation, we would use Gram-Schmidt or Householder reflections
        // Here we use a simplified approach
        
        const result = new Tensor(data, shape);
        
        // Normalize columns (simplified orthogonalization)
        for (let col = 0; col < cols; col++) {
            // Compute norm of column
            let norm = 0;
            for (let row = 0; row < rows; row++) {
                const val = result.data[row * cols + col];
                norm += val * val;
            }
            norm = Math.sqrt(norm);
            
            // Normalize column
            if (norm > 1e-10) {
                for (let row = 0; row < rows; row++) {
                    result.data[row * cols + col] *= gain / norm;
                }
            }
        }
        
        return result;
    }

    /**
     * Constant Initialization
     * Initialize all weights to a constant value
     * 
     * @param {Array<number>} shape - Shape of the weight tensor
     * @param {number} value - Constant value
     */
    static constant(shape, value = 0.0) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        data.fill(value);
        return new Tensor(data, shape);
    }

    /**
     * Uniform Initialization
     * Uniform(a, b)
     * 
     * @param {Array<number>} shape - Shape of the weight tensor
     * @param {number} a - Lower bound
     * @param {number} b - Upper bound
     */
    static uniform(shape, a = -0.1, b = 0.1) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        const range = b - a;
        
        for (let i = 0; i < size; i++) {
            data[i] = a + Math.random() * range;
        }
        
        return new Tensor(data, shape);
    }

    /**
     * Sparse Initialization
     * Initialize a fraction of weights with normal distribution, rest as zero
     * 
     * @param {Array<number>} shape - Shape of the weight tensor
     * @param {number} sparsity - Fraction of weights to keep non-zero (0 to 1)
     * @param {number} std - Standard deviation of non-zero weights
     */
    static sparse(shape, sparsity = 0.1, std = 0.01) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        
        for (let i = 0; i < size; i++) {
            if (Math.random() < sparsity) {
                // Generate normal random value
                let u1, u2;
                do {
                    u1 = Math.random();
                    u2 = Math.random();
                } while (u1 <= 1e-10);
                
                const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
                data[i] = z * std;
            } else {
                data[i] = 0;
            }
        }
        
        return new Tensor(data, shape);
    }

    /**
     * Calculate fan_in and fan_out for a weight tensor
     * 
     * @param {Array<number>} shape - Shape of the weight tensor
     * @returns {Object} {fanIn, fanOut}
     */
    static calculateFan(shape) {
        if (shape.length < 2) {
            throw new Error("Shape must have at least 2 dimensions");
        }
        
        if (shape.length === 2) {
            // Standard linear layer: [fan_in, fan_out]
            return { fanIn: shape[0], fanOut: shape[1] };
        } else if (shape.length === 4) {
            // Convolutional layer: [out_channels, in_channels, height, width]
            const receptiveFieldSize = shape[2] * shape[3];
            const fanIn = shape[1] * receptiveFieldSize;
            const fanOut = shape[0] * receptiveFieldSize;
            return { fanIn, fanOut };
        } else {
            // Default: product of all dims except last for fan_in, last dim for fan_out
            const fanIn = shape.slice(0, -1).reduce((a, b) => a * b, 1);
            const fanOut = shape[shape.length - 1];
            return { fanIn, fanOut };
        }
    }

    /**
     * Auto-select initialization based on activation type
     * 
     * @param {Array<number>} shape - Shape of the weight tensor
     * @param {string} activation - Activation function name
     * @returns {Tensor} Initialized tensor
     */
    static auto(shape, activation = 'relu') {
        const { fanIn, fanOut } = Initializer.calculateFan(shape);
        
        switch (activation.toLowerCase()) {
            case 'relu':
            case 'leakyrelu':
            case 'gelu':
                return Initializer.heNormal(shape, fanIn);
            
            case 'selu':
                return Initializer.lecunNormal(shape, fanIn);
            
            case 'sigmoid':
            case 'tanh':
                return Initializer.xavierNormal(shape, fanIn, fanOut);
            
            case 'linear':
            case 'none':
                return Initializer.xavierUniform(shape, fanIn, fanOut);
            
            default:
                console.warn(`Unknown activation '${activation}', using Xavier normal`);
                return Initializer.xavierNormal(shape, fanIn, fanOut);
        }
    }
}
