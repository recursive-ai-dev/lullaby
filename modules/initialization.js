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
     * Orthogonal Initialization using Gram-Schmidt Process
     * 
     * Mathematical Foundation:
     * ========================
     * Orthogonal matrices have the property: Q^T Q = I
     * This means columns are orthonormal (perpendicular unit vectors).
     * 
     * Benefits for deep learning:
     * - Preserves gradient norms during backpropagation
     * - Prevents vanishing/exploding gradients in RNNs
     * - Enables training of very deep networks
     * 
     * Gram-Schmidt Algorithm:
     * -----------------------
     * For vectors v₁, v₂, ..., vₙ:
     * 
     * u₁ = v₁ / ||v₁||
     * 
     * For i = 2 to n:
     *   u_i = v_i - Σ_{j=1}^{i-1} (v_i · u_j) u_j
     *   u_i = u_i / ||u_i||
     * 
     * Mathematical Proof of Orthonormality:
     * ------------------------------------
     * After Gram-Schmidt, we have:
     * - u_i · u_j = 0 for i ≠ j (orthogonal)
     * - ||u_i|| = 1 for all i (normalized)
     * 
     * Therefore: U^T U = I (orthonormal matrix)
     * 
     * @param {Array<number>} shape - Shape [rows, cols] (must be 2D)
     * @param {number} gain - Scaling factor (default: 1.0)
     * @returns {Tensor} - Orthogonal weight matrix
     */
    static orthogonal(shape, gain = 1.0) {
        // Validation
        if (!Array.isArray(shape) || shape.length !== 2) {
            throw new Error(`Orthogonal initialization requires 2D shape, got ${shape}`);
        }
        if (!(gain > 0) || !Number.isFinite(gain)) {
            throw new Error(`gain must be positive and finite, got ${gain}`);
        }

        const rows = shape[0];
        const cols = shape[1];
        
        if (rows <= 0 || cols <= 0 || !Number.isInteger(rows) || !Number.isInteger(cols)) {
            throw new Error(`Invalid shape dimensions: [${rows}, ${cols}]`);
        }
        
        const flatSize = rows * cols;
        
        // Step 1: Generate random matrix with Gaussian entries
        // Using Box-Muller transform for proper normal distribution
        const data = new Float32Array(flatSize);
        for (let i = 0; i < flatSize; i += 2) {
            let u1, u2;
            do {
                u1 = Math.random();
                u2 = Math.random();
            } while (u1 <= 1e-10); // Ensure u1 > 0 for log(u1)
            
            const mag = Math.sqrt(-2.0 * Math.log(u1));
            data[i] = mag * Math.cos(2.0 * Math.PI * u2);
            if (i + 1 < flatSize) {
                data[i + 1] = mag * Math.sin(2.0 * Math.PI * u2);
            }
        }
        
        // Step 2: Apply Gram-Schmidt orthogonalization
        // Process columns to create orthonormal basis
        for (let col = 0; col < cols; col++) {
            // Orthogonalize against all previous columns
            for (let prevCol = 0; prevCol < col; prevCol++) {
                // Compute dot product: projection = v_col · u_prevCol
                let dotProduct = 0;
                for (let row = 0; row < rows; row++) {
                    dotProduct += data[row * cols + col] * data[row * cols + prevCol];
                }
                
                // Subtract projection: v_col -= (v_col · u_prevCol) * u_prevCol
                for (let row = 0; row < rows; row++) {
                    data[row * cols + col] -= dotProduct * data[row * cols + prevCol];
                }
            }
            
            // Normalize the column: ||v_col|| → 1
            let norm = 0;
            for (let row = 0; row < rows; row++) {
                const val = data[row * cols + col];
                norm += val * val;
            }
            norm = Math.sqrt(norm);
            
            // Handle near-zero norm (should be rare with random initialization)
            if (norm < 1e-10) {
                // Reinitialize this column with a standard basis vector
                for (let row = 0; row < rows; row++) {
                    data[row * cols + col] = (row === col % rows) ? 1.0 : 0.0;
                }
                norm = 1.0;
            }
            
            // Normalize and apply gain
            const scale = gain / norm;
            for (let row = 0; row < rows; row++) {
                data[row * cols + col] *= scale;
            }
        }
        
        return new Tensor(data, shape);
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
     * Mathematical Definition:
     * ========================
     * - fan_in: Number of input units/neurons
     * - fan_out: Number of output units/neurons
     * 
     * For different layer types:
     * 
     * 1. Linear/Dense Layer [fan_in, fan_out]:
     *    - fan_in = shape[0]
     *    - fan_out = shape[1]
     * 
     * 2. Convolutional Layer [out_channels, in_channels, kernel_h, kernel_w]:
     *    - receptive_field_size = kernel_h × kernel_w
     *    - fan_in = in_channels × receptive_field_size
     *    - fan_out = out_channels × receptive_field_size
     * 
     * 3. Other layers (default):
     *    - fan_in = product of all dimensions except last
     *    - fan_out = last dimension
     * 
     * Mathematical Justification:
     * ---------------------------
     * fan_in and fan_out are used to compute initialization variances.
     * 
     * For Xavier/Glorot:
     * Var(W) = 2 / (fan_in + fan_out)
     * 
     * This ensures:
     * - Var(output) ≈ Var(input) during forward pass
     * - Var(gradient) ≈ constant during backward pass
     * 
     * Proof for linear layer:
     * y = Wx where W ∈ ℝ^{fan_out × fan_in}, x ∈ ℝ^{fan_in}
     * 
     * If E[W_ij] = 0 and Var(W_ij) = σ²:
     * Var(y_i) = Σ_j Var(W_ij x_j) = fan_in × σ² × Var(x)
     * 
     * For Var(y) ≈ Var(x), we need:
     * fan_in × σ² = 1 → σ² = 1/fan_in
     * 
     * Xavier initialization balances forward and backward:
     * σ² = 2/(fan_in + fan_out)
     * 
     * @param {Array<number>} shape - Shape of the weight tensor
     * @returns {Object} {fanIn, fanOut}
     */
    static calculateFan(shape) {
        // Validation
        if (!Array.isArray(shape)) {
            throw new Error(`shape must be an array, got ${typeof shape}`);
        }
        if (shape.length < 1) {
            throw new Error('Shape must have at least 1 dimension');
        }
        if (!shape.every(d => Number.isInteger(d) && d > 0)) {
            throw new Error(`All shape dimensions must be positive integers, got [${shape}]`);
        }
        
        if (shape.length === 1) {
            // 1D tensor (e.g., bias): fan_in = fan_out = dimension
            return { fanIn: shape[0], fanOut: shape[0] };
        } else if (shape.length === 2) {
            // 2D tensor (linear layer): [fan_in, fan_out]
            return { fanIn: shape[0], fanOut: shape[1] };
        } else if (shape.length === 4) {
            // 4D tensor (convolutional layer): [out_channels, in_channels, height, width]
            const outChannels = shape[0];
            const inChannels = shape[1];
            const kernelHeight = shape[2];
            const kernelWidth = shape[3];
            
            const receptiveFieldSize = kernelHeight * kernelWidth;
            const fanIn = inChannels * receptiveFieldSize;
            const fanOut = outChannels * receptiveFieldSize;
            
            return { fanIn, fanOut };
        } else {
            // General case: fan_in = product of all dims except last
            //               fan_out = last dim
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
