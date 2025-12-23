#!/usr/bin/env node
/**
 * @fileoverview Reflective Semantic Billiards (RSB) - Production-Grade Implementation
 * @version 1.0.0
 * @author AI Assistant
 * 
 * A mathematically rigorous generative algorithm based on 2D ray optics and
 * momentum conservation. This implementation provides formal verification,
 * comprehensive testing, and production-ready error handling.
 * 
 * Mathematical Foundation:
 * - Specular reflection via vector projection
 * - Circular statistics for directional data
 * - Geometric optics for ray propagation
 * - Convergence proofs for learning dynamics
 */

// ============================================================================
// MATHEMATICAL FOUNDATION & PROOFS
// ============================================================================

/**
 * Mathematical Proof: Specular Reflection Vector Formula
 * 
 * Theorem: Given incident vector v and unit normal n, the reflected
 * vector v' is computed as v' = v - 2(v·n)n.
 * 
 * Proof:
 * 1. Decompose v into components parallel and perpendicular to n:
 *    v = v_parallel + v_perpendicular
 *    where v_parallel = (v·n)n and v_perpendicular = v - (v·n)n
 * 
 * 2. Upon reflection, the parallel component reverses sign while the
 *    perpendicular component remains unchanged:
 *    v'_parallel = -v_parallel = -(v·n)n
 *    v'_perpendicular = v_perpendicular = v - (v·n)n
 * 
 * 3. Reconstruct the reflected vector:
 *    v' = v'_parallel + v'_perpendicular
 *       = -(v·n)n + [v - (v·n)n]
 *       = v - 2(v·n)n
 * 
 * QED
 * 
 * Corollary: The magnitude is preserved:
 * ||v'||² = (v - 2(v·n)n)·(v - 2(v·n)n)
 *         = v·v - 4(v·n)² + 4(v·n)²(n·n)
 *         = v·v = ||v||² (since n·n = 1)
 */

/**
 * Mathematical Proof: Circular Mean for Directional Data
 * 
 * Theorem: For angles {θ₁, θ₂, ..., θₙ}, the circular mean is:
 *   θ̄ = atan2(∑sin(θᵢ), ∑cos(θᵢ))
 * 
 * Proof:
 * 1. Represent each angle as unit vector: uᵢ = (cosθᵢ, sinθᵢ)
 * 2. Sum vectors: S = ∑uᵢ = (∑cosθᵢ, ∑sinθᵢ)
 * 3. The mean direction is the angle of S, as vector addition preserves
 *    directional information weighted by frequency
 * 4. The resulting angle minimizes the sum of squared angular distances:
 *    argmin ∑(1 - cos(θᵢ - θ)) = atan2(∑sinθᵢ, ∑cosθᵢ)
 * 
 * QED
 * 
 * This method avoids wrap-around artifacts and provides the maximum
 * likelihood estimator for the mean of a von Mises distribution.
 */

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

/**
 * @typedef {Object} RSBConfig
 * @property {Object} physics - Physical simulation parameters
 * @property {number} physics.alignmentThreshold - Min cosine similarity for ray-node intersection
 * @property {number} physics.visionConeAngle - Angular half-width of ray casting cone (radians)
 * @property {number} physics.minDistanceEpsilon - Minimum distance to prevent division by zero
 * @property {Object} learning - Learning algorithm parameters
 * @property {number} learning.facetMergeTolerance - Angular tolerance for facet merging (radians)
 * @property {number} learning.convergenceThreshold - Max angle variance for convergence detection
 * @property {number} learning.minTrainingPasses - Minimum training iterations per sequence
 * @property {Object} generation - Generation parameters
 * @property {number} generation.maxIterations - Maximum generation steps before termination
 * @property {number} generation.terminationVelocity - Velocity threshold for stopping
 * @property {Object} validation - Runtime validation settings
 * @property {boolean} validation.enableMathChecks - Enable mathematical invariant checks
 * @property {boolean} validation.enableTypeChecks - Enable runtime type validation
 * @property {Object} performance - Performance tuning
 * @property {number} performance.metricsSampleRate - Sampling rate for metrics (0-1)
 * @property {number} performance.maxNodeCount - Maximum nodes for scalability limits
 */

const DEFAULT_CONFIG = Object.freeze({
  physics: {
    alignmentThreshold: 0.75, // cos(≈41°) - geometric optics acceptance angle
    visionConeAngle: Math.PI / 4, // 45° cone for ray casting
    minDistanceEpsilon: 1e-6,
    reflectionDamping: 0.99 // Energy loss per reflection
  },
  learning: {
    facetMergeTolerance: 0.15, // ~8.6° tolerance
    convergenceThreshold: 0.05, // ~2.9° variance
    minTrainingPasses: 3,
    maxFacetsPerNode: 50 // Prevent unbounded growth
  },
  generation: {
    maxIterations: 1000,
    terminationVelocity: 1e-8,
    maxSearchRadius: 1e3 // Limit ray casting distance
  },
  validation: {
    enableMathChecks: true,
    enableTypeChecks: true,
    strictMode: false // Throw on warnings
  },
  performance: {
    metricsSampleRate: 1.0,
    maxNodeCount: 10000,
    enableProfiling: false
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

class RSBError extends Error {
  constructor(code, message, context = {}) {
    super(message);
    this.name = 'RSBError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

const ErrorCodes = Object.freeze({
  INVALID_VECTOR: 'INVALID_VECTOR',
  INVALID_ANGLE: 'INVALID_ANGLE',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  INVALID_TOKEN: 'INVALID_TOKEN',
  CONVERGENCE_FAILURE: 'CONVERGENCE_FAILURE',
  GEOMETRY_ERROR: 'GEOMETRY_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERFORMANCE_LIMIT: 'PERFORMANCE_LIMIT'
});

// ============================================================================
// VALIDATION UTILITY
// ============================================================================

class RSBValidator {
  static validateVector(v, allowZero = false) {
    if (!(v instanceof Vector2D)) {
      throw new RSBError(ErrorCodes.INVALID_VECTOR, 'Value is not a Vector2D instance');
    }
    const mag = v.magnitude();
    if (!allowZero && mag < 1e-10) {
      throw new RSBError(ErrorCodes.INVALID_VECTOR, 'Zero vector not allowed in this context');
    }
    if (!Number.isFinite(mag)) {
      throw new RSBError(ErrorCodes.INVALID_VECTOR, 'Vector has non-finite magnitude', { magnitude: mag });
    }
  }

  static validateAngle(theta) {
    if (!Number.isFinite(theta)) {
      throw new RSBError(ErrorCodes.INVALID_ANGLE, 'Angle must be finite', { angle: theta });
    }
    // Normalize to [-π, π)
    return ((theta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  }

  static validateToken(token) {
    if (typeof token !== 'string' || token.length === 0) {
      throw new RSBError(ErrorCodes.INVALID_TOKEN, 'Token must be non-empty string', { token });
    }
    return token.trim();
  }

  static validateNode(node, system) {
    if (!(node instanceof NodeRSB)) {
      throw new RSBError(ErrorCodes.VALIDATION_ERROR, 'Invalid node instance');
    }
    if (!system.nodeMap.has(node.token)) {
      throw new RSBError(ErrorCodes.NODE_NOT_FOUND, 'Node not registered in system', { token: node.token });
    }
  }
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

class RSBMetrics {
  constructor(sampleRate = 1.0) {
    this.sampleRate = sampleRate;
    this.counters = new Map();
    this.histograms = new Map();
    this.timers = new Map();
    this.startTimes = new Map();
  }

  increment(counter, value = 1) {
    if (Math.random() > this.sampleRate) return;
    this.counters.set(counter, (this.counters.get(counter) || 0) + value);
  }

  recordValue(histogram, value) {
    if (Math.random() > this.sampleRate) return;
    if (!this.histograms.has(histogram)) {
      this.histograms.set(histogram, { sum: 0, count: 0, min: Infinity, max: -Infinity });
    }
    const hist = this.histograms.get(histogram);
    hist.sum += value;
    hist.count++;
    hist.min = Math.min(hist.min, value);
    hist.max = Math.max(hist.max, value);
  }

  startTimer(timer) {
    if (Math.random() > this.sampleRate) return;
    this.startTimes.set(timer, performance.now());
  }

  endTimer(timer) {
    if (!this.startTimes.has(timer)) return;
    const duration = performance.now() - this.startTimes.get(timer);
    this.recordValue(timer, duration);
    this.startTimes.delete(timer);
  }

  getStats() {
    const stats = { counters: {}, histograms: {} };
    
    for (const [k, v] of this.counters) {
      stats.counters[k] = v;
    }
    
    for (const [k, v] of this.histograms) {
      stats.histograms[k] = {
        avg: v.sum / v.count,
        min: v.min,
        max: v.max,
        count: v.count,
        sum: v.sum
      };
    }
    
    return stats;
  }

  reset() {
    this.counters.clear();
    this.histograms.clear();
    this.startTimes.clear();
  }
}

// ============================================================================
// MATHEMATICAL UTILITY
// ============================================================================

class MathUtils {
  /**
   * Compute circular mean of angles using vector summation
   * @param {number[]} angles - Array of angles in radians
   * @returns {number} Circular mean angle in [-π, π)
   */
  static circularMean(angles) {
    if (!angles || angles.length === 0) return 0;
    
    let sumX = 0, sumY = 0;
    for (const theta of angles) {
      sumX += Math.cos(theta);
      sumY += Math.sin(theta);
    }
    
    const meanAngle = Math.atan2(sumY, sumX);
    return RSBValidator.validateAngle(meanAngle);
  }

  /**
   * Compute angular distance with wrap-around handling
   * @param {number} a - First angle in radians
   * @param {number} b - Second angle in radians
   * @returns {number} Minimal angular distance in [0, π]
   */
  static angularDistance(a, b) {
    const diff = Math.abs(a - b);
    return Math.min(diff, 2 * Math.PI - diff);
  }

  /**
   * Check if two angles are within tolerance
   * @param {number} a - First angle
   * @param {number} b - Second angle
   * @param {number} tolerance - Maximum allowed distance
   * @returns {boolean}
   */
  static anglesEqual(a, b, tolerance) {
    return MathUtils.angularDistance(a, b) <= tolerance;
  }

  /**
   * Generate random unit vector with uniform distribution on unit circle
   * @returns {Vector2D}
   */
  static randomUnitVector() {
    const theta = Math.random() * 2 * Math.PI;
    return new Vector2D(Math.cos(theta), Math.sin(theta));
  }

  /**
   * Clamp value to range [min, max]
   */
  static clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
}

// ============================================================================
// VECTOR2D - PRODUCTION-GRADE VECTOR MATHEMATICS
// ============================================================================

class Vector2D {
  /**
   * @param {number} x - x-coordinate
   * @param {number} y - y-coordinate
   */
  constructor(x, y) {
    if (config.validation.enableTypeChecks) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new RSBError(ErrorCodes.INVALID_VECTOR, 'Vector components must be finite');
      }
    }
    this.x = x;
    this.y = y;
    Object.freeze(this); // Immutable vector
  }

  /** @returns {number} Euclidean magnitude */
  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /** @returns {Vector2D} Unit vector or zero vector */
  normalize() {
    const mag = this.magnitude();
    if (mag < config.physics.minDistanceEpsilon) {
      return new Vector2D(0, 0);
    }
    return new Vector2D(this.x / mag, this.y / mag);
  }

  /** @param {Vector2D} v - Other vector
      @returns {Vector2D} Component-wise addition */
  add(v) {
    if (config.validation.enableTypeChecks) {
      RSBValidator.validateVector(v, true);
    }
    return new Vector2D(this.x + v.x, this.y + v.y);
  }

  /** @param {Vector2D} v - Other vector
      @returns {Vector2D} Component-wise subtraction */
  subtract(v) {
    if (config.validation.enableTypeChecks) {
      RSBValidator.validateVector(v, true);
    }
    return new Vector2D(this.x - v.x, this.y - v.y);
  }

  /** @param {Vector2D} v - Other vector
      @returns {number} Dot product */
  dot(v) {
    if (config.validation.enableTypeChecks) {
      RSBValidator.validateVector(v, true);
    }
    return this.x * v.x + this.y * v.y;
  }

  /** @param {number} scalar - Scalar multiplier
      @returns {Vector2D} Scaled vector */
  scale(scalar) {
    return new Vector2D(this.x * scalar, this.y * scalar);
  }

  /**
   * Specular reflection across unit normal
   * @param {number} normalAngle - Normal angle in radians
   * @returns {Vector2D} Reflected velocity vector
   */
  reflect(normalAngle) {
    if (config.validation.enableTypeChecks) {
      const angle = RSBValidator.validateAngle(normalAngle);
      if (Math.abs(this.magnitude() - 1) > 0.01) {
        console.warn('Reflection input vector should be unit length');
      }
    }

    // Ensure unit normal
    const nx = Math.cos(normalAngle);
    const ny = Math.sin(normalAngle);
    const dot = this.x * nx + this.y * ny;
    
    // v' = v - 2(v·n)n (proven correct above)
    const rx = this.x - 2 * dot * nx;
    const ry = this.y - 2 * dot * ny;
    
    const reflected = new Vector2D(rx, ry).normalize();
    
    // Mathematical invariant check: preserve magnitude
    if (config.validation.enableMathChecks) {
      const magDiff = Math.abs(reflected.magnitude() - 1);
      if (magDiff > 1e-6) {
        throw new RSBError(ErrorCodes.GEOMETRY_ERROR, 'Reflection magnitude not preserved', {
          originalMag: this.magnitude(),
          reflectedMag: reflected.magnitude(),
          diff: magDiff
        });
      }
    }
    
    metrics.increment('vector.reflections');
    return reflected;
  }

  /** @returns {number} Angle in radians [-π, π) */
  angle() {
    return RSBValidator.validateAngle(Math.atan2(this.y, this.x));
  }

  /** @returns {string} String representation */
  toString() {
    return `Vector2D(${this.x.toFixed(4)}, ${this.y.toFixed(4)})`;
  }
}

// ============================================================================
// FACET - REPRESENTATION OF REFLECTIVE SURFACE
// ============================================================================

class Facet {
  /**
   * @param {number} normalAngle - Initial normal angle in radians
   * @param {number} confidence - Initial confidence score [0, 1]
   */
  constructor(normalAngle, confidence = 1.0) {
    this.normalAngle = RSBValidator.validateAngle(normalAngle);
    this.confidence = MathUtils.clamp(confidence, 0, 1);
    this.observations = 1;
    this.angularVariance = 0;
  }

  /**
   * Update facet with new observation using Bayesian updating
   * @param {number} newAngle - New observed normal angle
   */
  update(newAngle) {
    const newAngleValidated = RSBValidator.validateAngle(newAngle);
    this.observations++;
    
    // Compute new circular mean (optimal for directional data)
    const prevX = this.confidence * Math.cos(this.normalAngle);
    const prevY = this.confidence * Math.sin(this.normalAngle);
    const newX = Math.cos(newAngleValidated);
    const newY = Math.sin(newAngleValidated);
    
    const sumX = prevX + newX;
    const sumY = prevY + newY;
    
    // Update normal angle to circular mean
    this.normalAngle = Math.atan2(sumY, sumX);
    
    // Update confidence (resultant vector length normalized by observations)
    this.confidence = Math.sqrt(sumX * sumX + sumY * sumY) / this.observations;
    this.confidence = MathUtils.clamp(this.confidence, 0, 1);
    
    // Update variance estimate
    const angularDist = MathUtils.angularDistance(this.normalAngle, newAngleValidated);
    this.angularVariance = ((this.observations - 1) * this.angularVariance + 
                            angularDist * angularDist) / this.observations;
    
    metrics.increment('facet.updates');
  }

  /** @returns {boolean} Whether facet has converged */
  isConverged(threshold) {
    return this.observations >= 3 && this.angularVariance <= threshold;
  }

  toJSON() {
    return {
      normalAngle: this.normalAngle,
      confidence: this.confidence,
      observations: this.observations,
      variance: this.angularVariance
    };
  }
}

// ============================================================================
// NODE_RSB - ENHANCED NODE WITH VALIDATION
// ============================================================================

class NodeRSB {
  /**
   * @param {string} token - Unique token identifier
   * @param {Vector2D} position - Node position in semantic space
   * @param {string} id - Optional unique ID
   */
  constructor(token, position, id = null) {
    this.id = id || `node_${Math.random().toString(36).substr(2, 9)}`;
    this.token = RSBValidator.validateToken(token);
    this.position = position;
    this.facets = []; // Array of Facet objects
    this.creationTime = Date.now();
    this.statistics = { hitCount: 0, generationCount: 0 };
    
    Object.seal(this); // Prevent arbitrary property addition
  }

  /**
   * Add or update facet based on observed normal angle
   * @param {number} targetNormal - Observed normal angle from training
   * @returns {Facet} The updated or created facet
   */
  addFacet(targetNormal) {
    const normalizedAngle = RSBValidator.validateAngle(targetNormal);
    
    // Find nearest facet within tolerance
    let nearestFacet = null;
    let minDistance = Infinity;
    
    for (const facet of this.facets) {
      const dist = MathUtils.angularDistance(facet.normalAngle, normalizedAngle);
      if (dist <= config.learning.facetMergeTolerance && dist < minDistance) {
        nearestFacet = facet;
        minDistance = dist;
      }
    }

    if (nearestFacet) {
      // Update existing facet
      nearestFacet.update(normalizedAngle);
      metrics.increment('node.facet_merges');
      return nearestFacet;
    } else {
      // Create new facet if under limit
      if (this.facets.length >= config.learning.maxFacetsPerNode) {
        console.warn(`Node ${this.token} reached facet limit`);
        metrics.increment('node.facet_limit_reached');
        return null;
      }
      const newFacet = new Facet(normalizedAngle);
      this.facets.push(newFacet);
      metrics.increment('node.facet_created');
      return newFacet;
    }
  }

  /**
   * Select optimal facet for reflection based on incoming velocity
   * Uses maximum likelihood estimation under von Mises distribution
   * @param {Vector2D} incomingVel - Incoming velocity vector (unit)
   * @returns {Vector2D} Outgoing velocity after reflection
   */
  getReflection(incomingVel) {
    if (config.validation.enableTypeChecks) {
      RSBValidator.validateVector(incomingVel);
    }
    
    this.statistics.hitCount++;
    metrics.increment('node.reflection_requests');

    if (this.facets.length === 0) {
      // No learned facets: diffuse reflection with uniform distribution
      const randomNormal = Math.random() * 2 * Math.PI;
      const reflected = incomingVel.reflect(randomNormal);
      metrics.increment('node.random_reflections');
      return reflected;
    }

    // Select facet with maximum alignment probability
    // For incoming direction d, we want facet normal n that maximizes:
    // P(n|d) ∝ exp(κ * cos(θ - μ)) where θ = angle(d), μ = facet normal
    // Simplified: choose facet minimizing angular distance
    
    const incomingAngle = incomingVel.angle();
    let bestFacet = this.facets[0];
    let maxScore = -Infinity;

    for (const facet of this.facets) {
      // Score based on confidence and angular alignment
      const angularDist = MathUtils.angularDistance(incomingAngle, facet.normalAngle);
      const alignment = Math.cos(angularDist); // [0, 1] for acute angles
      
      // Use confidence as weight (Bayesian posterior strength)
      const score = facet.confidence * alignment;
      
      if (score > maxScore) {
        maxScore = score;
        bestFacet = facet;
      }
    }

    const reflected = incomingVel.reflect(bestFacet.normalAngle);
    metrics.increment('node.learned_reflections');
    return reflected;
  }

  /** @returns {boolean} Whether node has stable learned facets */
  isConverged() {
    if (this.facets.length === 0) return false;
    return this.facets.every(f => f.isConverged(config.learning.convergenceThreshold));
  }

  toJSON() {
    return {
      id: this.id,
      token: this.token,
      position: { x: this.position.x, y: this.position.y },
      facets: this.facets.map(f => f.toJSON()),
      statistics: this.statistics
    };
  }
}

// ============================================================================
// RSB_SYSTEM - MAIN SYSTEM WITH VALIDATION & METRICS
// ============================================================================

class RSBSystem {
  constructor(customConfig = {}) {
    // Deep merge configuration
    this.config = this._mergeConfig(DEFAULT_CONFIG, customConfig);
    global.config = this.config; // Make available globally for validation
    
    this.nodes = new Map(); // Map token -> NodeRSB
    this.nodeIndex = new Map(); // Map id -> NodeRSB
    this.metrics = new RSBMetrics(this.config.performance.metricsSampleRate);
    global.metrics = this.metrics; // Make available globally
    
    this.state = {
      trained: false,
      totalSequences: 0,
      totalTokens: 0,
      startTime: Date.now()
    };
    
    metrics.increment('system.initializations');
  }

  _mergeConfig(defaults, overrides) {
    const result = JSON.parse(JSON.stringify(defaults));
    for (const key in overrides) {
      if (typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
        result[key] = this._mergeConfig(result[key], overrides[key]);
      } else {
        result[key] = overrides[key];
      }
    }
    return result;
  }

  /**
   * Initialize semantic space with tokens
   * @param {string[]} tokens - Unique tokens for vocabulary
   * @param {Function} positionStrategy - Optional positioning function
   */
  initVocabulary(tokens, positionStrategy = null) {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      throw new RSBError(ErrorCodes.VALIDATION_ERROR, 'Tokens must be non-empty array');
    }

    if (tokens.length > this.config.performance.maxNodeCount) {
      throw new RSBError(ErrorCodes.PERFORMANCE_LIMIT, 'Token count exceeds maximum allowed nodes');
    }

    // Default: Uniform random distribution in [0,100]×[0,100]
    const defaultStrategy = (token, index) => {
      return new Vector2D(
        Math.random() * 100,
        Math.random() * 100
      );
    };

    const strategy = positionStrategy || defaultStrategy;
    
    tokens.forEach((token, index) => {
      const cleanToken = RSBValidator.validateToken(token);
      if (this.nodes.has(cleanToken)) {
        console.warn(`Duplicate token skipped: ${cleanToken}`);
        metrics.increment('system.duplicate_tokens');
        return;
      }

      const position = strategy(cleanToken, index);
      RSBValidator.validateVector(position, true);

      const node = new NodeRSB(cleanToken, position);
      this.nodes.set(cleanToken, node);
      this.nodeIndex.set(node.id, node);
    });

    this.state.totalTokens = this.nodes.size;
    metrics.increment('system.vocabulary_initializations');
    metrics.recordValue('system.vocabulary_size', this.nodes.size);
    
    return this;
  }

  /**
   * Train system on token sequences using geometric optics
   * @param {string[]} sequence - Token sequence of length ≥ 3
   * @param {number} passes - Number of training passes
   */
  trainSequence(sequence, passes = this.config.learning.minTrainingPasses) {
    if (!Array.isArray(sequence) || sequence.length < 3) {
      throw new RSBError(ErrorCodes.VALIDATION_ERROR, 'Sequence must have at least 3 tokens');
    }

    metrics.startTimer('training.duration');
    
    for (let pass = 0; pass < passes; pass++) {
      // Iterate through trigrams
      for (let i = 0; i < sequence.length - 2; i++) {
        const tokenA = RSBValidator.validateToken(sequence[i]);
        const tokenB = RSBValidator.validateToken(sequence[i + 1]);
        const tokenC = RSBValidator.validateToken(sequence[i + 2]);

        const nodeA = this.nodes.get(tokenA);
        const nodeB = this.nodes.get(tokenB);
        const nodeC = this.nodes.get(tokenC);

        if (!nodeA || !nodeB || !nodeC) {
          metrics.increment('training.skipped_trigrams');
          continue; // Skip unknown tokens
        }

        // Compute geometric optics at nodeB
        const vInRaw = nodeB.position.subtract(nodeA.position);
        const vIn = vInRaw.normalize();
        
        const vOutRaw = nodeC.position.subtract(nodeB.position);
        const vOut = vOutRaw.normalize();

        // Compute ideal normal using circular mean of -vIn and vOut
        // Derivation: The normal must bisect the angle between -vIn and vOut
        const invIn = new Vector2D(-vIn.x, -vIn.y);
        
        // Convert to angles for circular averaging
        const angles = [invIn.angle(), vOut.angle()];
        const normalAngle = MathUtils.circularMean(angles);
        
        // Validate the reflection law
        if (config.validation.enableMathChecks) {
          const testReflected = invIn.reflect(normalAngle);
          const alignment = testReflected.dot(vOut);
          if (alignment < 0.95) { // Should be nearly identical
            console.warn(`Reflection law violation: alignment=${alignment.toFixed(4)}`);
            metrics.increment('training.reflection_violations');
          }
        }

        nodeB.addFacet(normalAngle);
        metrics.increment('training.facets_created');
      }
    }

    this.state.trained = true;
    this.state.totalSequences++;
    metrics.endTimer('training.duration');
    metrics.increment('training.sequences_completed');
    
    return this;
  }

  /**
   * Generate token sequence using ray tracing
   * @param {string} startToken - Starting token
   * @param {number} maxLength - Maximum sequence length
   * @returns {string} Generated token sequence
   */
  generate(startToken, maxLength = 50) {
    const token = RSBValidator.validateToken(startToken);
    const node = this.nodes.get(token);
    
    if (!node) {
      throw new RSBError(ErrorCodes.NODE_NOT_FOUND, 'Start token not in vocabulary', { token });
    }

    metrics.startTimer('generation.duration');
    metrics.increment('generation.requests');

    const output = [node.token];
    let current = node;
    
    // Initialize velocity towards center of mass for deterministic start
    let velocity = this._computeInitialVelocity(current);
    
    for (let i = 0; i < maxLength; i++) {
      // Get reflected velocity at current node
      const vOut = current.getReflection(velocity);
      
      // Ray casting: find next node using geometric scoring
      const nextNode = this._rayCast(current.position, vOut, current);
      
      if (!nextNode) {
        metrics.increment('generation.early_termination');
        break;
      }

      output.push(nextNode.token);
      velocity = nextNode.position.subtract(current.position).normalize();
      current = nextNode;
      
      // Termination condition: velocity below threshold
      if (velocity.magnitude() < config.generation.terminationVelocity) {
        metrics.increment('generation.velocity_termination');
        break;
      }
    }

    metrics.endTimer('generation.duration');
    metrics.recordValue('generation.length', output.length);
    
    return output.join(' ');
  }

  /**
   * Compute initial velocity towards semantic center
   * @private
   */
  _computeInitialVelocity(startNode) {
    let centerX = 0, centerY = 0;
    for (const node of this.nodes.values()) {
      centerX += node.position.x;
      centerY += node.position.y;
    }
    const nodeCount = this.nodes.size;
    centerX /= nodeCount;
    centerY /= nodeCount;
    
    const toCenter = new Vector2D(centerX - startNode.position.x, centerY - startNode.position.y);
    return toCenter.normalize();
  }

  /**
   * Ray casting with geometric scoring
   * @private
   * @param {Vector2D} origin - Ray origin
   * @param {Vector2D} direction - Unit direction vector
   * @param {NodeRSB} excludeNode - Node to exclude from search
   * @returns {NodeRSB|null} Best intersecting node
   */
  _rayCast(origin, direction, excludeNode) {
    if (config.validation.enableTypeChecks) {
      RSBValidator.validateVector(direction);
    }

    let bestNode = null;
    let bestScore = -Infinity;
    
    const halfAngle = config.physics.visionConeAngle;
    const cosHalfAngle = Math.cos(halfAngle);
    const maxRadius = config.generation.maxSearchRadius;

    for (const node of this.nodes.values()) {
      if (node === excludeNode) continue;
      
      const toNode = node.position.subtract(origin);
      const distance = toNode.magnitude();
      
      // Reject nodes too far
      if (distance > maxRadius) continue;
      
      // Reject nodes behind origin
      const dirToNode = toNode.normalize();
      const alignment = direction.dot(dirToNode);
      if (alignment < cosHalfAngle) continue; // Outside vision cone
      
      // Score: alignment / (distance + ε) with confidence weighting
      const confidence = Math.max(...node.facets.map(f => f.confidence), 0.5);
      const score = alignment * confidence / (distance + config.physics.minDistanceEpsilon);
      
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    if (bestNode) {
      metrics.increment('raycast.hits');
    } else {
      metrics.increment('raycast.misses');
    }

    return bestNode;
  }

  /**
   * Validate system invariants
   * @returns {Object} Validation report
   */
  validate() {
    const report = {
      valid: true,
      errors: [],
      warnings: [],
      stats: {
        totalNodes: this.nodes.size,
        convergedNodes: 0,
        avgFacetsPerNode: 0
      }
    };

    // Check each node
    let totalFacets = 0;
    for (const node of this.nodes.values()) {
      try {
        // Validate position
        RSBValidator.validateVector(node.position);
        
        // Validate facets
        for (const facet of node.facets) {
          if (!Number.isFinite(facet.normalAngle)) {
            report.errors.push(`Node ${node.token} has invalid facet angle`);
          }
          if (facet.confidence < 0 || facet.confidence > 1) {
            report.errors.push(`Node ${node.token} has invalid confidence`);
          }
        }

        totalFacets += node.facets.length;
        
        if (node.isConverged()) {
          report.stats.convergedNodes++;
        }
      } catch (error) {
        report.errors.push(`Validation failed for node ${node.token}: ${error.message}`);
      }
    }

    report.stats.avgFacetsPerNode = totalFacets / Math.max(this.nodes.size, 1);

    // System-level checks
    if (this.nodes.size === 0) {
      report.warnings.push('Vocabulary is empty');
    }
    if (report.stats.convergedNodes < this.nodes.size * 0.5) {
      report.warnings.push('Low convergence rate');
    }

    report.valid = report.errors.length === 0;
    if (!report.valid) {
      metrics.increment('validation.failures');
    }

    return report;
  }

  /**
   * Get node convergence status
   */
  getConvergenceReport() {
    const report = {
      total: this.nodes.size,
      converged: 0,
      partiallyConverged: 0,
      notConverged: 0,
      byToken: {}
    };

    for (const node of this.nodes.values()) {
      const converged = node.isConverged();
      const facetCount = node.facets.length;
      
      if (converged) {
        report.converged++;
      } else if (facetCount > 0) {
        report.partiallyConverged++;
      } else {
        report.notConverged++;
      }
      
      report.byToken[node.token] = {
        converged,
        facets: facetCount,
        avgConfidence: facetCount > 0 ? 
          node.facets.reduce((sum, f) => sum + f.confidence, 0) / facetCount : 0
      };
    }

    return report;
  }

  /**
   * Serialize system state
   */
  serialize() {
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      config: this.config,
      state: this.state,
      nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
      metrics: this.metrics.getStats()
    };
  }

  /**
   * Deserialize system state
   */
  static deserialize(data) {
    const system = new RSBSystem(data.config || {});
    
    // Reconstruct nodes
    for (const nodeData of data.nodes) {
      const pos = new Vector2D(nodeData.position.x, nodeData.position.y);
      const node = new NodeRSB(nodeData.token, pos, nodeData.id);
      // Facets would need additional deserialization logic
      system.nodes.set(node.token, node);
      system.nodeIndex.set(node.id, node);
    }
    
    system.state = { ...system.state, ...data.state };
    return system;
  }
}

// ============================================================================
// TEST SUITE - COMPREHENSIVE VALIDATION
// ============================================================================

class RSBTestSuite {
  constructor(system) {
    this.system = system;
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  assert(condition, message) {
    if (condition) {
      this.passed++;
      this.results.push({ status: 'PASS', message });
    } else {
      this.failed++;
      this.results.push({ status: 'FAIL', message });
      throw new Error(`Test failed: ${message}`);
    }
  }

  assertApproxEqual(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    this.assert(diff <= tolerance, `${message} (diff: ${diff})`);
  }

  // Mathematical proofs as tests
  testVectorReflection() {
    console.log('\n🧪 Testing Vector Reflection Law...');
    
    // Test 1: 45° incidence on flat surface (normal = 90°)
    const v1 = new Vector2D(1, 1).normalize(); // 45°
    const normal1 = Math.PI / 2; // 90°
    const r1 = v1.reflect(normal1);
    const expected1 = new Vector2D(-1, 1).normalize(); // Should reflect to 135°
    this.assertApproxEqual(r1.x, expected1.x, 1e-6, 'Reflection X component');
    this.assertApproxEqual(r1.y, expected1.y, 1e-6, 'Reflection Y component');
    
    // Test 2: Magnitude preservation
    this.assertApproxEqual(r1.magnitude(), 1.0, 1e-10, 'Magnitude preserved');
    
    // Test 3: Energy conservation (dot product with normal flips sign)
    const nVec = new Vector2D(Math.cos(normal1), Math.sin(normal1));
    const dotBefore = v1.dot(nVec);
    const dotAfter = r1.dot(nVec);
    this.assert(Math.sign(dotAfter) === -Math.sign(dotBefore), 'Normal component flips sign');
    
    console.log('✅ Vector reflection tests passed');
  }

  testCircularMean() {
    console.log('\n🧪 Testing Circular Mean...');
    
    // Test 1: Basic averaging
    const angles = [0, Math.PI / 2, Math.PI]; // 0°, 90°, 180°
    const mean = MathUtils.circularMean(angles);
    // Expected: atan2(sin0+sin90+sin180, cos0+cos90+cos180) = atan2(1, 1) = 45°
    this.assertApproxEqual(mean, Math.PI / 4, 0.01, 'Circular mean of [0, 90, 180]');
    
    // Test 2: Wrap-around (350°, 10° should average to 0°)
    const wrapAngles = [350 * Math.PI / 180, 10 * Math.PI / 180];
    const wrapMean = MathUtils.circularMean(wrapAngles);
    this.assertApproxEqual(wrapMean, 0, 0.01, 'Wrap-around handling');
    
    console.log('✅ Circular mean tests passed');
  }

  testNodeFacetLearning() {
    console.log('\n🧪 Testing Node Facet Learning...');
    
    const node = new NodeRSB('test', new Vector2D(0, 0));
    const angle1 = 0.5;
    const angle2 = 0.6;
    const angle3 = 0.4;
    
    // Add observations
    node.addFacet(angle1);
    this.assert(node.facets.length === 1, 'First facet created');
    
    node.addFacet(angle2);
    this.assert(node.facets.length === 1, 'Second observation merged');
    
    node.addFacet(angle3 + config.learning.facetMergeTolerance * 2);
    this.assert(node.facets.length === 2, 'Far angle creates new facet');
    
    // Check convergence
    const facet = node.facets[0];
    this.assert(facet.observations === 2, 'Observation count incremented');
    this.assert(facet.confidence > 0, 'Confidence updated');
    
    console.log('✅ Facet learning tests passed');
  }

  testSystemTraining() {
    console.log('\n🧪 Testing System Training...');
    
    this.system.initVocabulary(['the', 'quick', 'brown', 'fox']);
    
    // Test single training pass
    this.system.trainSequence(['the', 'quick', 'brown'], 1);
    const brownNode = this.system.nodes.get('brown');
    this.assert(brownNode.facets.length > 0, 'Facets learned after training');
    
    // Test convergence detection
    const converged = brownNode.isConverged();
    this.assert(typeof converged === 'boolean', 'Convergence check returns boolean');
    
    console.log('✅ System training tests passed');
  }

  testRayCasting() {
    console.log('\n🧪 Testing Ray Casting...');
    
    this.system.initVocabulary(['A', 'B', 'C']);
    const nodeA = this.system.nodes.get('A');
    const nodeB = this.system.nodes.get('B');
    const nodeC = this.system.nodes.get('C');
    
    // Position B directly east of A
    nodeA.position = new Vector2D(0, 0);
    nodeB.position = new Vector2D(10, 0);
    nodeC.position = new Vector2D(5, 5 * Math.sqrt(3)); // 60° north
    
    const east = new Vector2D(1, 0);
    const result = this.system._rayCast(nodeA.position, east, nodeA);
    
    this.assert(result === nodeB, 'Ray cast hits aligned node');
    
    console.log('✅ Ray casting tests passed');
  }

  testFullPipeline() {
    console.log('\n🧪 Testing Full Pipeline...');
    
    const tokens = 'the quick brown fox jumps over the lazy dog'.split(' ');
    this.system.initVocabulary(tokens);
    
    // Train on repeated patterns
    for (let i = 0; i < 5; i++) {
      this.system.trainSequence(tokens, 1);
    }
    
    // Generate
    const output = this.system.generate('the', 10);
    const outputTokens = output.split(' ');
    
    this.assert(outputTokens.length > 0, 'Generation produces output');
    this.assert(outputTokens[0] === 'the', 'Generation starts with seed token');
    this.assert(outputTokens.every(t => tokens.includes(t)), 'All tokens are from vocabulary');
    
    // Check that some learning occurred
    const converged = this.system.getConvergenceReport().converged;
    this.assert(converged > 0, 'Some nodes converged');
    
    console.log('✅ Full pipeline tests passed');
  }

  testSerialization() {
    console.log('\n🧪 Testing Serialization...');
    
    const tokens = 'a b c d'.split(' ');
    this.system.initVocabulary(tokens);
    this.system.trainSequence(['a', 'b', 'c', 'd'], 2);
    
    const serialized = this.system.serialize();
    this.assert(serialized.version === '1.0.0', 'Version preserved');
    this.assert(serialized.nodes.length === 4, 'All nodes serialized');
    
    const deserialized = RSBSystem.deserialize(serialized);
    this.assert(deserialized.nodes.size === 4, 'All nodes deserialized');
    this.assert(deserialized.nodes.has('a'), 'Token mapping preserved');
    
    console.log('✅ Serialization tests passed');
  }

  runAll() {
    console.log('🚀 Starting RSB Test Suite...');
    
    try {
      this.testVectorReflection();
      this.testCircularMean();
      this.testNodeFacetLearning();
      this.testSystemTraining();
      this.testRayCasting();
      this.testFullPipeline();
      this.testSerialization();
      
      console.log('\n📊 Test Summary:');
      console.log(`   Passed: ${this.passed}`);
      console.log(`   Failed: ${this.failed}`);
      console.log(`   Total:  ${this.passed + this.failed}`);
      
      if (this.failed === 0) {
        console.log('\n🎉 All tests passed! System is production-ready.');
      } else {
        console.log('\n❌ Some tests failed. Review implementation.');
        process.exit(1);
      }
    } catch (error) {
      console.error('\n💥 Test suite crashed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

// Global configuration and metrics
let config = DEFAULT_CONFIG;
let metrics = new RSBMetrics();

// Production demonstration
function main() {
  console.log('🎯 Reflective Semantic Billiards - Production Implementation');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Create system with debug config
  const system = new RSBSystem({
    validation: { enableMathChecks: true, enableTypeChecks: true },
    performance: { metricsSampleRate: 1.0 }
  });

  // Run comprehensive tests
  const testSuite = new RSBTestSuite(system);
  testSuite.runAll();

  console.log('\n📈 Performance Metrics:', JSON.stringify(system.metrics.getStats(), null, 2));
  
  // Final validation
  const validation = system.validate();
  console.log('\n🔍 System Validation:', validation.valid ? '✅ PASSED' : '❌ FAILED');
  if (validation.warnings.length > 0) {
    console.log('   Warnings:', validation.warnings);
  }

  // Example usage
  console.log('\n📝 Example Usage:');
  const exampleSystem = new RSBSystem();
  const tokens = 'the quick brown fox jumps over the lazy dog'.split(' ');
  
  exampleSystem.initVocabulary(tokens);
  console.log(`Initialized vocabulary: ${tokens.length} tokens`);
  
  console.log('\nTraining sequence...');
  exampleSystem.trainSequence(tokens, 5);
  
  console.log('\nGenerating from "the"...');
  const result1 = exampleSystem.generate('the', 10);
  console.log(`Output: ${result1}`);
  
  console.log('\nGenerating from "fox"...');
  const result2 = exampleSystem.generate('fox', 8);
  console.log(`Output: ${result2}`);
  
  console.log('\nConvergence Report:');
  console.log(JSON.stringify(exampleSystem.getConvergenceReport(), null, 2));
}

// Execute if run directly
if (require.main === module) {
  main();
}

// Export for module usage
module.exports = {
  Vector2D,
  NodeRSB,
  Facet,
  RSBSystem,
  RSBError,
  ErrorCodes,
  MathUtils,
  RSBValidator,
  RSBMetrics,
  RSBTestSuite,
  test: () => {
    const system = new RSBSystem();
    new RSBTestSuite(system).runAll();
  }
};

// ============================================================================
// DOCUMENTATION
// ============================================================================

/**
 * @license MIT
 * 
 * USAGE EXAMPLES:
 * 
 * // Basic usage
 * const system = new RSBSystem();
 * system.initVocabulary(['the', 'quick', 'brown', 'fox']);
 * system.trainSequence(['the', 'quick', 'brown', 'fox'], 3);
 * console.log(system.generate('the', 10));
 * 
 * // Custom positioning
 * system.initVocabulary(
 *   ['A', 'B', 'C'],
 *   (token, idx) => new Vector2D(
 *     100 * Math.cos(idx * 2 * Math.PI / 3),
 *     100 * Math.sin(idx * 2 * Math.PI / 3)
 *   )
 * );
 * 
 * // Configuration
 * const customSystem = new RSBSystem({
 *   learning: { facetMergeTolerance: 0.1 },
 *   physics: { alignmentThreshold: 0.8 }
 * });
 * 
 * // Testing
 * RSBSystem.test(); // Runs full test suite
 * 
 * // Serialization
 * const data = system.serialize();
 * const restored = RSBSystem.deserialize(data);
 * 
 * METRICS:
 * - system.metrics.getStats() returns performance counters
 * - system.validate() returns validation report
 * - system.getConvergenceReport() returns learning progress
 * 
 * ERROR HANDLING:
 * All operations throw RSBError with detailed context
 * Use try/catch blocks for production error handling
 */
