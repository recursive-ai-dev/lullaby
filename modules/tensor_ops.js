import { Tensor } from './tensor.js';

/**
 * Advanced Tensor Operations
 * Collection of mathematical operations that extend the base Tensor class
 */

export class TensorOps {
    /**
     * Concatenate tensors along a specified axis
     * @param {Array<Tensor>} tensors - Array of tensors to concatenate
     * @param {number} axis - Axis along which to concatenate (default: 0)
     */
    static concat(tensors, axis = 0) {
        if (tensors.length === 0) {
            throw new Error("Cannot concatenate empty array of tensors");
        }
        
        if (tensors.length === 1) {
            return tensors[0];
        }
        
        // Validate shapes are compatible
        const firstShape = tensors[0].shape;
        for (let i = 1; i < tensors.length; i++) {
            if (tensors[i].shape.length !== firstShape.length) {
                throw new Error("All tensors must have same number of dimensions");
            }
            for (let dim = 0; dim < firstShape.length; dim++) {
                if (dim !== axis && tensors[i].shape[dim] !== firstShape[dim]) {
                    throw new Error(`Shape mismatch at dimension ${dim}`);
                }
            }
        }
        
        // Calculate output shape
        const outputShape = [...firstShape];
        for (let i = 1; i < tensors.length; i++) {
            outputShape[axis] += tensors[i].shape[axis];
        }
        
        // Allocate output
        const outputSize = outputShape.reduce((a, b) => a * b, 1);
        const outputData = new Float32Array(outputSize);
        
        // Simple concatenation for 2D case along axis 0
        if (firstShape.length === 2 && axis === 0) {
            let offset = 0;
            for (const tensor of tensors) {
                const size = tensor.data.length;
                outputData.set(tensor.data, offset);
                offset += size;
            }
        } else {
            throw new Error("Concatenation only implemented for 2D tensors along axis 0");
        }
        
        return new Tensor(outputData, outputShape);
    }
    
    /**
     * Split tensor into multiple tensors along specified axis
     * @param {Tensor} tensor - Tensor to split
     * @param {Array<number>} sizes - Size of each split
     * @param {number} axis - Axis along which to split
     */
    static split(tensor, sizes, axis = 0) {
        const totalSize = sizes.reduce((a, b) => a + b, 0);
        if (totalSize !== tensor.shape[axis]) {
            throw new Error(`Split sizes sum to ${totalSize}, but tensor has size ${tensor.shape[axis]} on axis ${axis}`);
        }
        
        const results = [];
        
        // Simple split for 2D along axis 0
        if (tensor.shape.length === 2 && axis === 0) {
            let offset = 0;
            for (const size of sizes) {
                const splitShape = [size, tensor.shape[1]];
                const splitSize = size * tensor.shape[1];
                const splitData = new Float32Array(tensor.data.buffer, 
                    tensor.data.byteOffset + offset * 4, splitSize);
                results.push(new Tensor(splitData.slice(), splitShape));
                offset += splitSize;
            }
        } else {
            throw new Error("Split only implemented for 2D tensors along axis 0");
        }
        
        return results;
    }
    
    /**
     * Stack tensors along a new dimension
     * @param {Array<Tensor>} tensors - Array of tensors to stack
     * @param {number} axis - Axis along which to stack
     */
    static stack(tensors, axis = 0) {
        if (tensors.length === 0) {
            throw new Error("Cannot stack empty array of tensors");
        }
        
        // All tensors must have same shape
        const firstShape = tensors[0].shape;
        for (let i = 1; i < tensors.length; i++) {
            if (tensors[i].shape.length !== firstShape.length) {
                throw new Error("All tensors must have same shape");
            }
            for (let dim = 0; dim < firstShape.length; dim++) {
                if (tensors[i].shape[dim] !== firstShape[dim]) {
                    throw new Error("All tensors must have same shape");
                }
            }
        }
        
        // Output shape adds new dimension
        const outputShape = [...firstShape];
        outputShape.splice(axis, 0, tensors.length);
        
        const outputSize = outputShape.reduce((a, b) => a * b, 1);
        const outputData = new Float32Array(outputSize);
        
        // Simple stacking
        let offset = 0;
        for (const tensor of tensors) {
            outputData.set(tensor.data, offset);
            offset += tensor.data.length;
        }
        
        return new Tensor(outputData, outputShape);
    }
    
    /**
     * Reshape tensor to new shape
     * @param {Tensor} tensor - Tensor to reshape
     * @param {Array<number>} newShape - New shape
     */
    static reshape(tensor, newShape) {
        const oldSize = tensor.data.length;
        const newSize = newShape.reduce((a, b) => a * b, 1);
        
        if (oldSize !== newSize) {
            throw new Error(`Cannot reshape tensor of size ${oldSize} to size ${newSize}`);
        }
        
        return new Tensor(new Float32Array(tensor.data), newShape);
    }
    
    /**
     * Compute sum of tensor elements along specified axis
     * @param {Tensor} tensor - Input tensor
     * @param {number} axis - Axis along which to sum (null for all elements)
     * @param {boolean} keepDims - Whether to keep reduced dimension
     */
    static sum(tensor, axis = null, keepDims = false) {
        if (axis === null) {
            // Sum all elements
            let sum = 0;
            for (let i = 0; i < tensor.data.length; i++) {
                sum += tensor.data[i];
            }
            return sum;
        }
        
        if (tensor.shape.length === 2 && axis === 1) {
            // Sum along last dimension
            const rows = tensor.shape[0];
            const cols = tensor.shape[1];
            const result = new Float32Array(rows);
            
            for (let r = 0; r < rows; r++) {
                let sum = 0;
                for (let c = 0; c < cols; c++) {
                    sum += tensor.data[r * cols + c];
                }
                result[r] = sum;
            }
            
            const shape = keepDims ? [rows, 1] : [rows];
            return new Tensor(result, shape);
        }
        
        throw new Error("Sum only implemented for 2D tensors along axis 1");
    }
    
    /**
     * Compute mean of tensor elements along specified axis
     * @param {Tensor} tensor - Input tensor
     * @param {number} axis - Axis along which to compute mean
     * @param {boolean} keepDims - Whether to keep reduced dimension
     */
    static mean(tensor, axis = null, keepDims = false) {
        if (axis === null) {
            // Mean of all elements
            let sum = 0;
            for (let i = 0; i < tensor.data.length; i++) {
                sum += tensor.data[i];
            }
            return sum / tensor.data.length;
        }
        
        const sumTensor = TensorOps.sum(tensor, axis, keepDims);
        if (typeof sumTensor === 'number') {
            return sumTensor / tensor.shape[axis];
        }
        
        // Divide by size along axis
        const divisor = tensor.shape[axis];
        const result = new Float32Array(sumTensor.data.length);
        for (let i = 0; i < result.length; i++) {
            result[i] = sumTensor.data[i] / divisor;
        }
        
        return new Tensor(result, sumTensor.shape);
    }
    
    /**
     * Compute maximum value along specified axis
     * 
     * @param {Tensor} tensor - Input tensor
     * @param {number} axis - Axis along which to compute max (null for global max)
     * @param {boolean} keepDims - Whether to keep reduced dimension
     * @returns {number|Tensor} - Maximum value(s)
     */
    static max(tensor, axis = null, keepDims = false) {
        if (axis === null) {
            // Max of all elements
            let max = -Infinity;
            for (let i = 0; i < tensor.data.length; i++) {
                if (Number.isFinite(tensor.data[i]) && tensor.data[i] > max) {
                    max = tensor.data[i];
                }
            }
            // Handle case where all values are non-finite
            if (!Number.isFinite(max)) {
                return NaN;
            }
            return max;
        }
        
        // Axis-specific max for 2D tensors
        if (tensor.shape.length === 2) {
            if (axis === 0) {
                // Max along rows (output: [cols])
                const [rows, cols] = tensor.shape;
                const result = new Float32Array(cols);
                result.fill(-Infinity);
                
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const val = tensor.data[r * cols + c];
                        if (Number.isFinite(val) && val > result[c]) {
                            result[c] = val;
                        }
                    }
                }
                
                const shape = keepDims ? [1, cols] : [cols];
                return new Tensor(result, shape);
            } else if (axis === 1) {
                // Max along columns (output: [rows])
                const [rows, cols] = tensor.shape;
                const result = new Float32Array(rows);
                
                for (let r = 0; r < rows; r++) {
                    let max = -Infinity;
                    for (let c = 0; c < cols; c++) {
                        const val = tensor.data[r * cols + c];
                        if (Number.isFinite(val) && val > max) {
                            max = val;
                        }
                    }
                    result[r] = Number.isFinite(max) ? max : NaN;
                }
                
                const shape = keepDims ? [rows, 1] : [rows];
                return new Tensor(result, shape);
            }
        }
        
        throw new Error(`Max with axis=${axis} not yet implemented for ${tensor.shape.length}D tensors`);
    }
    
    /**
     * Compute minimum value along specified axis
     * 
     * @param {Tensor} tensor - Input tensor
     * @param {number} axis - Axis along which to compute min (null for global min)
     * @param {boolean} keepDims - Whether to keep reduced dimension
     * @returns {number|Tensor} - Minimum value(s)
     */
    static min(tensor, axis = null, keepDims = false) {
        if (axis === null) {
            // Min of all elements
            let min = Infinity;
            for (let i = 0; i < tensor.data.length; i++) {
                if (Number.isFinite(tensor.data[i]) && tensor.data[i] < min) {
                    min = tensor.data[i];
                }
            }
            // Handle case where all values are non-finite
            if (!Number.isFinite(min)) {
                return NaN;
            }
            return min;
        }
        
        // Axis-specific min for 2D tensors
        if (tensor.shape.length === 2) {
            if (axis === 0) {
                // Min along rows (output: [cols])
                const [rows, cols] = tensor.shape;
                const result = new Float32Array(cols);
                result.fill(Infinity);
                
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const val = tensor.data[r * cols + c];
                        if (Number.isFinite(val) && val < result[c]) {
                            result[c] = val;
                        }
                    }
                }
                
                const shape = keepDims ? [1, cols] : [cols];
                return new Tensor(result, shape);
            } else if (axis === 1) {
                // Min along columns (output: [rows])
                const [rows, cols] = tensor.shape;
                const result = new Float32Array(rows);
                
                for (let r = 0; r < rows; r++) {
                    let min = Infinity;
                    for (let c = 0; c < cols; c++) {
                        const val = tensor.data[r * cols + c];
                        if (Number.isFinite(val) && val < min) {
                            min = val;
                        }
                    }
                    result[r] = Number.isFinite(min) ? min : NaN;
                }
                
                const shape = keepDims ? [rows, 1] : [rows];
                return new Tensor(result, shape);
            }
        }
        
        throw new Error(`Min with axis=${axis} not yet implemented for ${tensor.shape.length}D tensors`);
    }
    
    /**
     * Compute variance along specified axis
     * 
     * Mathematical formula:
     * Var(X) = E[(X - μ)²] = E[X²] - E[X]²
     * 
     * Using the computational formula for numerical stability:
     * Var = (Σx²)/n - ((Σx)/n)²
     * 
     * @param {Tensor} tensor - Input tensor
     * @param {number} axis - Axis along which to compute variance (null for global)
     * @param {boolean} keepDims - Whether to keep reduced dimension
     * @param {number} ddof - Delta degrees of freedom (0 for population, 1 for sample)
     * @returns {number|Tensor} - Variance value(s)
     */
    static variance(tensor, axis = null, keepDims = false, ddof = 0) {
        if (axis === null) {
            // Variance of all elements
            const n = tensor.data.length;
            if (n <= ddof) {
                throw new Error(`Insufficient data points (${n}) for variance with ddof=${ddof}`);
            }
            
            // Use Welford's online algorithm for numerical stability
            let mean = 0;
            let M2 = 0;
            let count = 0;
            
            for (let i = 0; i < n; i++) {
                const val = tensor.data[i];
                if (Number.isFinite(val)) {
                    count++;
                    const delta = val - mean;
                    mean += delta / count;
                    const delta2 = val - mean;
                    M2 += delta * delta2;
                }
            }
            
            if (count <= ddof) {
                return NaN;
            }
            
            return M2 / (count - ddof);
        }
        
        // Axis-specific variance for 2D tensors
        if (tensor.shape.length === 2 && axis === 1) {
            const [rows, cols] = tensor.shape;
            const result = new Float32Array(rows);
            
            for (let r = 0; r < rows; r++) {
                if (cols <= ddof) {
                    result[r] = NaN;
                    continue;
                }
                
                // Use Welford's algorithm for each row
                let mean = 0;
                let M2 = 0;
                let count = 0;
                
                for (let c = 0; c < cols; c++) {
                    const val = tensor.data[r * cols + c];
                    if (Number.isFinite(val)) {
                        count++;
                        const delta = val - mean;
                        mean += delta / count;
                        const delta2 = val - mean;
                        M2 += delta * delta2;
                    }
                }
                
                result[r] = (count > ddof) ? M2 / (count - ddof) : NaN;
            }
            
            const shape = keepDims ? [rows, 1] : [rows];
            return new Tensor(result, shape);
        }
        
        throw new Error(`Variance with axis=${axis} not yet implemented for ${tensor.shape.length}D tensors`);
    }
    
    /**
     * Apply function element-wise to tensor
     * @param {Tensor} tensor - Input tensor
     * @param {Function} fn - Function to apply
     */
    static map(tensor, fn) {
        const result = new Float32Array(tensor.data.length);
        for (let i = 0; i < tensor.data.length; i++) {
            result[i] = fn(tensor.data[i], i);
        }
        return new Tensor(result, [...tensor.shape]);
    }
    
    /**
     * Element-wise maximum of two tensors
     * @param {Tensor} a - First tensor
     * @param {Tensor} b - Second tensor
     */
    static maximum(a, b) {
        if (a.data.length !== b.data.length) {
            throw new Error("Tensors must have same size");
        }
        
        const result = new Float32Array(a.data.length);
        for (let i = 0; i < a.data.length; i++) {
            result[i] = Math.max(a.data[i], b.data[i]);
        }
        return new Tensor(result, [...a.shape]);
    }
    
    /**
     * Element-wise minimum of two tensors
     * @param {Tensor} a - First tensor
     * @param {Tensor} b - Second tensor
     */
    static minimum(a, b) {
        if (a.data.length !== b.data.length) {
            throw new Error("Tensors must have same size");
        }
        
        const result = new Float32Array(a.data.length);
        for (let i = 0; i < a.data.length; i++) {
            result[i] = Math.min(a.data[i], b.data[i]);
        }
        return new Tensor(result, [...a.shape]);
    }
    
    /**
     * Pad tensor with constant value
     * @param {Tensor} tensor - Input tensor
     * @param {Array<Array<number>>} padding - Padding for each dimension [[before, after], ...]
     * @param {number} value - Value to pad with
     */
    static pad(tensor, padding, value = 0) {
        if (padding.length !== tensor.shape.length) {
            throw new Error("Padding must be specified for each dimension");
        }
        
        // Calculate output shape
        const outputShape = tensor.shape.map((size, i) => 
            size + padding[i][0] + padding[i][1]
        );
        
        const outputSize = outputShape.reduce((a, b) => a * b, 1);
        const outputData = new Float32Array(outputSize);
        outputData.fill(value);
        
        // Simple 2D case
        if (tensor.shape.length === 2) {
            const [rows, cols] = tensor.shape;
            const [padTop, padBottom] = padding[0];
            const [padLeft, padRight] = padding[1];
            const [outRows, outCols] = outputShape;
            
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const inIdx = r * cols + c;
                    const outIdx = (r + padTop) * outCols + (c + padLeft);
                    outputData[outIdx] = tensor.data[inIdx];
                }
            }
        } else {
            throw new Error("Padding only implemented for 2D tensors");
        }
        
        return new Tensor(outputData, outputShape);
    }
}
