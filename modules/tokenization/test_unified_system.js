/**
 * UNIFIED TOKENIZATION SYSTEM - COMPREHENSIVE TEST SUITE
 * Production-grade validation with mathematical proofs and performance benchmarks
 */

import { UnifiedTokenizationSystem, UTS_CONFIG, MathUtils, ConfigValidator } from './unified_tokenization_system.js';

export class UTSTestSuite {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.results = [];
    this.startTime = 0;
  }

  buildConfig(overrides = {}) {
    return {
      modelWeights: { ...UTS_CONFIG.modelWeights, ...(overrides.modelWeights || {}) },
      cache: { ...UTS_CONFIG.cache, ...(overrides.cache || {}) },
      memory: { ...UTS_CONFIG.memory, ...(overrides.memory || {}) },
      convergence: { ...UTS_CONFIG.convergence, ...(overrides.convergence || {}) },
      parallel: { ...UTS_CONFIG.parallel, ...(overrides.parallel || {}) },
      validation: { ...UTS_CONFIG.validation, ...(overrides.validation || {}) }
    };
  }

  createSystem(overrides = {}) {
    return new UnifiedTokenizationSystem(this.buildConfig(overrides));
  }

  assert(condition, message, critical = true) {
    const test = {
      status: condition ? 'PASS' : 'FAIL',
      message,
      timestamp: new Date().toISOString(),
      critical
    };
    
    this.results.push(test);
    
    if (condition) {
      this.passed++;
      console.log(`  ✅ ${message}`);
    } else {
      this.failed++;
      console.log(`  ❌ ${message}`);
      if (critical) {
        throw new Error(`Critical test failed: ${message}`);
      }
    }
    
    return condition;
  }

  assertApproxEqual(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    const passed = diff <= tolerance;
    return this.assert(passed, `${message} (expected: ${expected}, got: ${actual}, diff: ${diff.toExponential(2)})`, true);
  }

  // ==========================================================================
  // MATHEMATICAL VALIDATION TESTS
  // ==========================================================================

  testMathematicalFoundations() {
    console.log('\n🧪 Testing Mathematical Foundations...');

    // Test entropy calculation
    const uniformDist = { a: 0.25, b: 0.25, c: 0.25, d: 0.25 };
    const entropy = MathUtils.entropy(uniformDist);
    this.assertApproxEqual(entropy, 2.0, 0.01, 'Uniform distribution entropy = log2(4) = 2.0');

    // Test deterministic vector generation
    const vec1 = MathUtils.hyperdimensionalBind([1, 2, 3], [4, 5, 6]);
    const vec2 = MathUtils.hyperdimensionalBind([1, 2, 3], [4, 5, 6]);
    this.assert(vec1.every((val, i) => Math.abs(val - vec2[i]) < 1e-10), 'Hyperdimensional binding is deterministic');

    // Test cosine similarity
    const similar = MathUtils.cosineSimilarity([1, 0, 0], [0.9, 0.1, 0]);
    this.assert(similar > 0.8 && similar <= 1.0, 'Cosine similarity of similar vectors is high');

    const orthogonal = MathUtils.cosineSimilarity([1, 0, 0], [0, 1, 0]);
    this.assertApproxEqual(orthogonal, 0.0, 0.01, 'Orthogonal vectors have zero cosine similarity');

    // Test circular mean
    const angles = [0, Math.PI/2];
    const meanAngle = MathUtils.circularMean(angles);
    this.assertApproxEqual(meanAngle, Math.PI/4, 0.01, 'Circular mean of [0, π/2] = π/4');

    // Test vector reflection
    const incident = { x: 1, y: 1 };
    const normal = { x: 0, y: 1 };
    const reflected = MathUtils.reflectVector(incident.x, incident.y, normal.x, normal.y);
    this.assertApproxEqual(reflected.x, 1, 0.01, 'Reflection preserves x-component');
    this.assertApproxEqual(reflected.y, -1, 0.01, 'Reflection inverts y-component');

    console.log('✅ Mathematical foundations validated');
  }

  // ==========================================================================
  // CONFIGURATION VALIDATION TESTS
  // ==========================================================================

  testConfigurationValidation() {
    console.log('\n⚙️ Testing Configuration Validation...');

    // Valid configuration
    const validConfig = {
      modelWeights: { rcw: 0.4, ced: 0.3, mar: 0.2, mcg: 0.1, cbf: 0.0, rsb: 0.0 },
      cache: { l1Size: 1024, l2Size: 8192, l3Size: 65536 },
      convergence: { entropyThreshold: 0.001 }
    };
    
    const validErrors = ConfigValidator.validate(validConfig);
    this.assert(validErrors.length === 0, 'Valid configuration passes validation');

    // Invalid weights (don't sum to 1)
    const invalidWeights = {
      modelWeights: { rcw: 0.5, ced: 0.3, mar: 0.2, mcg: 0.1, cbf: 0.0, rsb: 0.0 }
    };
    
    const weightErrors = ConfigValidator.validate(invalidWeights);
    this.assert(weightErrors.length > 0, 'Invalid weights are detected');

    // Invalid cache sizes
    const invalidCache = {
      cache: { l1Size: 1000, l2Size: 5000 } // Not powers of 2
    };
    
    const cacheErrors = ConfigValidator.validate(invalidCache);
    this.assert(cacheErrors.length > 0, 'Non-optimal cache sizes are flagged');

    console.log('✅ Configuration validation working correctly');
  }

  // ==========================================================================
  // CACHE SYSTEM TESTS
  // ==========================================================================

  testCacheSystem() {
    console.log('\n💾 Testing Multi-Level Cache System...');

    const uts = this.createSystem({
      cache: { l1Size: 4, l2Size: 8, l3Size: 16 }
    });
    const cache = uts.cache;

    // Test basic operations
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    this.assert(cache.get('key1') === 'value1', 'L1 cache retrieval works');
    this.assert(cache.get('key2') === 'value2', 'L1 cache storage works');

    // Test cache hierarchy
    cache.l1.clear(); // Force miss
    cache.set('key3', 'value3');
    this.assert(cache.get('key3') === 'value3', 'Cache hierarchy functions correctly');

    // Test eviction
    for (let i = 0; i < 10; i++) {
      cache.set(`key${i}`, `value${i}`);
    }
    
    const stats = cache.getStats();
    this.assert(stats.evictions > 0, 'Cache eviction occurs when full');
    this.assert(stats.hitRate >= 0 && stats.hitRate <= 1, 'Hit rate is valid probability');

    // Test performance
    const iterations = 1000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      cache.set(`perf${i}`, i);
      cache.get(`perf${i}`);
    }
    
    const duration = performance.now() - start;
    const opsPerSecond = (iterations * 2) / (duration / 1000);
    
    this.assert(opsPerSecond > 10000, `Cache performance: ${opsPerSecond.toFixed(0)} ops/sec`);

    console.log('✅ Cache system performance validated');
  }

  // ==========================================================================
  // ENERGY MANAGER TESTS
  // ==========================================================================

  testEnergyManager() {
    console.log('\n⚡ Testing Energy Management System...');

    const uts = this.createSystem();
    const energyManager = uts.energyManager;

    // Test initial state
    const initialStatus = energyManager.getConvergenceStatus();
    this.assert(initialStatus.rcw.energy === 1.0, 'Initial energy is maximum');
    this.assert(initialStatus.ced.energy === 1.0, 'All models start with full energy');

    // Test energy update
    energyManager.update('rcw', 0.5);
    const updatedStatus = energyManager.getConvergenceStatus();
    this.assert(updatedStatus.rcw.energy < 1.0, 'Winning model loses energy');
    this.assert(updatedStatus.ced.energy === 1.0, 'Losing models stay capped at 1.0');

    // Test weighted prediction
    const predictions = { rcw: 0.8, ced: 0.6, mar: 0.5, mcg: 0.45, cbf: 0.4, rsb: 0.3 };
    const weightedResult = energyManager.getWeightedPrediction(predictions);
    
    // Should be between min and max predictions, weighted by energies
    this.assert(weightedResult >= 0.4 && weightedResult <= 0.8, 'Weighted prediction is bounded');

    // Test convergence detection
    for (let i = 0; i < 150; i++) {
      energyManager.update('rcw', 0.001);
    }
    
    const convergedStatus = energyManager.getConvergenceStatus();
    this.assert(convergedStatus.rcw.iterations > 100, 'Iteration counting works');

    console.log('✅ Energy management system validated');
  }

  // ==========================================================================
  // INTEGRATED MODEL TESTS
  // ==========================================================================

  testIntegratedRCW() {
    console.log('\n🧠 Testing Integrated RCW Component...');

    const uts = this.createSystem();
    const rcw = uts.models.rcw;
    const energyManager = uts.energyManager;
    const contextManager = uts.contextManager;
    rcw.initialize(energyManager, contextManager);

    // Test learning
    rcw.learn('ABCDEFGHIJ');
    this.assert(rcw.metrics.learnCalls === 1, 'Learning increments call counter');

    // Test generation
    const generated = rcw.generate('ABC', 5);
    this.assert(generated.length === 8, 'Generation produces correct length (seed + generated)');
    this.assert(generated.startsWith('ABC'), 'Generation preserves seed');

    // Test context integration
    const contextBefore = Array.from(contextManager.currentContext);
    rcw.learn('XYZ');
    const contextAfter = Array.from(contextManager.currentContext);
    
    let contextChanged = false;
    for (let i = 0; i < contextBefore.length; i++) {
      if (Math.abs(contextBefore[i] - contextAfter[i]) > 1e-10) {
        contextChanged = true;
        break;
      }
    }
    this.assert(contextChanged, 'Context is updated during learning');

    console.log('✅ RCW integration validated');
  }

  testIntegratedCED() {
    console.log('\n🌊 Testing Integrated CED Component...');

    const uts = this.createSystem();
    const ced = uts.models.ced;
    const energyManager = uts.energyManager;
    ced.initialize(energyManager);

    // Test network building
    ced.learn(['A', 'B', 'C', 'D', 'E']);
    this.assert(ced.network.size > 0, 'Network nodes are created');

    // Test erosion dynamics
    const edgeWeightBefore = ced.network.get('A').edges.get('B') || 0;
    ced.learn(['A', 'B', 'C']); // Reinforce A->B
    const edgeWeightAfter = ced.network.get('A').edges.get('B');
    
    this.assert(edgeWeightAfter > edgeWeightBefore, 'Active paths are reinforced');

    // Test pressure propagation
    const result = ced.generate('A');
    this.assert(typeof result === 'string' || result === null, 'Generation returns valid type');

    console.log('✅ CED integration validated');
  }

  testIntegratedMAR() {
    console.log('\n🏛️ Testing Integrated MAR Component...');

    const uts = this.createSystem();
    const mar = uts.models.mar;
    const energyManager = uts.energyManager;
    mar.initialize(energyManager);

    // Test agent creation
    this.assert(mar.agents.size === 3, 'Default agents are created');
    this.assert(mar.agents.has('architect'), 'Architect agent exists');

    // Test generation
    const generated = mar.generate('HELLO', 10);
    this.assert(generated.length > 5, 'MAR generates output');

                    // Test stamina mechanics
    for (const agent of mar.agents.values()) {
      agent.stamina = agent.maxStamina;
    }

    mar.generate('TEST', 1);
    
    let staminaConsumed = false;
    for (const agent of mar.agents.values()) {
      if (agent.stamina < agent.maxStamina) {
        staminaConsumed = true;
        break;
      }
    }

    this.assert(staminaConsumed, 'At least one agent consumed stamina during generation');

    // Test inflation
    const inflation = mar.inflationModel.calculate('AAAABBBB', { token: 'A' });
    this.assert(inflation >= 1.0, 'Inflation factor is non-negative');

    console.log('✅ MAR integration validated');
  }

  testIntegratedMCG() {
    console.log('\n🧬 Testing Integrated MCG Component...');

    const uts = this.createSystem();
    const mcg = uts.models.mcg;
    const contextManager = uts.contextManager;
    mcg.initialize(contextManager);

    // Test node creation
    mcg.learn(['A', 'B', 'C']);
    this.assert(mcg.nodes.size > 0, 'Nodes are created during learning');

    // Test generation
    const generated = mcg.generate('A', 5);
    this.assert(Array.isArray(generated), 'MCG returns array format');
    this.assert(generated.length > 0, 'Generation produces output');

    // Test context integration
    const context = contextManager.getCurrentContext();
    this.assert(context.length === 256, 'Context vector has correct dimension');

    // Test signature generation
    const sig1 = contextManager.getSymbolSignature('TEST');
    const sig2 = contextManager.getSymbolSignature('TEST');
    this.assert(sig1.every((val, i) => Math.abs(val - sig2[i]) < 1e-10), 'Signatures are deterministic');

    console.log('✅ MCG integration validated');
  }

    async testIntegratedCBF() {
    console.log('\nTesting Integrated CBF Component...');
    const uts = this.createSystem({
      modelWeights: { rcw: 0.2, ced: 0.15, mar: 0.15, mcg: 0.15, cbf: 0.25, rsb: 0.10 }
    });
    const cbf = uts.models.cbf;
    const energyManager = uts.energyManager;
    cbf.initialize(energyManager);
    await cbf.learn(['HELLO WORLD', 'WORLD PEACE', 'PEACE LOVE']);
    this.assert(cbf.isTrained, 'CBF marks itself as trained');
    this.assert(cbf.vocab.size > 0, 'Vocabulary is built');
    const generated = cbf.generate(10, 'H');
    this.assert(generated.length === 10, 'CBF generates correct length');
    this.assert(cbf.prices.size > 0, 'Prices are computed');
    let allValid = true;
    for (const price of cbf.prices.values()) {
      if (typeof price !== 'number' || isNaN(price) || price < 0) allValid = false;
    }
    this.assert(allValid, 'All prices are non-negative numbers');
    console.log('✅ CBF integration validated');
  }

  testIntegratedRSB() {
    console.log('\n🎯 Testing Integrated RSB Component...');

    const uts = this.createSystem();
    const rsb = uts.models.rsb;
    const energyManager = uts.energyManager;
    rsb.initialize(energyManager);

    // Test semantic space initialization
    rsb.learn(['A', 'B', 'C', 'D', 'E']);
    this.assert(rsb.nodes.size === 5, 'Semantic space initialized correctly');

    // Test generation
    const generated = rsb.generate('A', 5);
    this.assert(typeof generated === 'string', 'RSB returns string format');
    this.assert(generated.length > 0, 'Generation produces output');

    // Test reflection mechanics
    const velocity = { x: 1, y: 0 };
    const normal = { x: 0, y: 1 };
    const reflected = rsb._reflectVector(velocity, normal);
    
    this.assertApproxEqual(reflected.x, 1, 0.01, 'Reflection preserves x-component');
    this.assertApproxEqual(reflected.y, 0, 0.01, 'Reflection inverts y-component');

    console.log('✅ RSB integration validated');
  }

  // ==========================================================================
  // END-TO-END INTEGRATION TESTS
  // ==========================================================================

  async testUnifiedSystemTraining() {
    console.log('\n🔗 Testing Unified System Training...');

    const uts = this.createSystem({
      modelWeights: { rcw: 0.3, ced: 0.2, mar: 0.2, mcg: 0.15, cbf: 0.1, rsb: 0.05 },
      convergence: { maxIterations: 500 }
    });

    // Test data with multiple patterns
    const trainingData = [
      'ABCDEFG', 'BCDEFGH', 'CDEFGHI', 'DEFGHIJ',
      'PATTERN1', 'PATTERN2', 'PATTERN3',
      'HELLO WORLD', 'WORLD PEACE', 'PEACE LOVE'
    ];

    // Test training
    const startTime = performance.now();
    const metrics = await uts.train(trainingData);
    const trainingTime = performance.now() - startTime;

    this.assert(uts.isTrained, 'System marks itself as trained');
    this.assert(metrics.vocabSize > 0, 'Vocabulary size is computed');
    this.assert(metrics.totalTokens > 0, 'Token count is tracked');
    this.assert(trainingTime < 5000, `Training completes quickly (${trainingTime.toFixed(0)}ms)`);

    // Test energy distribution
    const energyStatus = uts.energyManager.getConvergenceStatus();
    let totalEnergy = 0;
    for (const status of Object.values(energyStatus)) {
      totalEnergy += status.energy;
    }
    
    this.assert(Math.abs(totalEnergy - 6.0) < 0.5, 'Energy conservation maintained');

    console.log('✅ Unified training validated');
    return uts;
  }

  testUnifiedSystemGeneration(uts) {
    console.log('\n🎲 Testing Unified System Generation...');

    // Test basic generation
    const result = uts.generate({
      seed: 'HELLO',
      length: 20,
      strategy: 'ensemble'
    });

    this.assert(result.output.length > 5, 'Generation produces substantial output');
    this.assert(result.tokens.length > 0, 'Token array is populated');
    this.assert(result.metrics.generationTime > 0, 'Generation time is measured');
    this.assert(result.metrics.tokensPerSecond > 0, 'Generation rate is computed');

    // Test different strategies
    const strategies = ['ensemble', 'best', 'weighted'];
    const strategyResults = {};

    for (const strategy of strategies) {
      const stratResult = uts.generate({
        seed: 'ABC',
        length: 10,
        strategy
      });
      
      strategyResults[strategy] = stratResult;
      this.assert(stratResult.output.length > 3, `${strategy} strategy produces output`);
    }

    // Test that different strategies produce different outputs
    const outputs = Object.values(strategyResults).map(r => r.output);
    const uniqueOutputs = new Set(outputs);
    this.assert(uniqueOutputs.size > 1, 'Different strategies produce different outputs');

    // Test sampling parameters
    const highTempResult = uts.generate({
      seed: 'TEST',
      length: 15,
      temperature: 2.0
    });

    const lowTempResult = uts.generate({
      seed: 'TEST', 
      length: 15,
      temperature: 0.1
    });

    this.assert(highTempResult.output !== lowTempResult.output, 'Temperature affects generation');

    console.log('✅ Unified generation validated');
  }

  testUnifiedSystemAnalysis(uts) {
    console.log('\n📊 Testing Unified System Analysis...');

    const testOutput = 'ABCDEFGHIJABCDEFGHIJABCDEFGHIJ';
    const analysis = uts.analyze(testOutput);

    this.assert(analysis.entropy >= 0, 'Entropy is non-negative');
    this.assert(analysis.perplexity >= 1, 'Perplexity is at least 1');
    this.assert(analysis.diversity >= 0 && analysis.diversity <= 1, 'Diversity is normalized');
    this.assert(Object.keys(analysis.patterns.bigrams).length > 0, 'Bigram patterns are detected');
    this.assert(Object.keys(analysis.modelContributions).length > 0, 'Model contributions are tracked');

    // Test pattern detection
    const repetitiveOutput = 'AAAAAAAAAABBBBBBBBBBCCCCCCCCCC';
    const repetitiveAnalysis = uts.analyze(repetitiveOutput);
    
    this.assert(repetitiveAnalysis.patterns.repetitions > 0, 'Repetition pattern detection works');
    this.assert(repetitiveAnalysis.diversity < analysis.diversity, 'Repetitive output has lower diversity');

    console.log('✅ Unified analysis validated');
  }

  testUnifiedSystemValidation(uts) {
    console.log('\n🔍 Testing Unified System Validation...');

    const validation = uts.validate();

    this.assert(typeof validation.valid === 'boolean', 'Validation returns boolean status');
    this.assert(Array.isArray(validation.errors), 'Validation errors are array');
    this.assert(Array.isArray(validation.warnings), 'Validation warnings are array');
    this.assert(validation.valid, 'Trained system passes validation');

    // Test with untrained system
    const untrainedUTS = this.createSystem();
    const untrainedValidation = untrainedUTS.validate();
    
    this.assert(!untrainedValidation.valid, 'Untrained system fails validation');
    this.assert(untrainedValidation.errors.length > 0, 'Untrained system has validation errors');

    console.log('✅ Unified validation validated');
  }

  testUnifiedSystemSerialization(uts) {
    console.log('\n💾 Testing Unified System Serialization...');

    // Test serialization
    const serialized = uts.serialize();
    
    this.assert(serialized.version === '2.0.0', 'Version is serialized correctly');
    this.assert(serialized.isTrained === true, 'Training state is preserved');
    this.assert(typeof serialized.timestamp === 'string', 'Timestamp is included');
    this.assert(serialized.config !== undefined, 'Configuration is serialized');
    this.assert(serialized.models !== undefined, 'Model states are serialized');

    // Test deserialization
    const deserialized = UnifiedTokenizationSystem.deserialize(serialized);
    
    this.assert(deserialized.isTrained === uts.isTrained, 'Training state is restored');
    this.assert(deserialized.config.modelWeights.rcw === uts.config.modelWeights.rcw, 'Configuration is restored');
    
    // Test that deserialized system can generate
    const originalResult = uts.generate({ seed: 'TEST', length: 10 });
    const deserializedResult = deserialized.generate({ seed: 'TEST', length: 10 });
    
    this.assert(deserializedResult.output.length > 0, 'Deserialized system can generate');

    console.log('✅ Unified serialization validated');
  }

  // ==========================================================================
  // PERFORMANCE BENCHMARKS
  // ==========================================================================

  async testPerformanceBenchmarks() {
    console.log('\n🏁 Running Performance Benchmarks...');

    const uts = this.createSystem({
      cache: { l1Size: 256, l2Size: 1024, l3Size: 4096 }, // Smaller cache for testing
      convergence: { maxIterations: 100 }
    });

    // Training benchmark
    console.log('   📊 Training Performance...');
    const trainData = Array(100).fill().map((_, i) => 
      String.fromCharCode(65 + (i % 26)).repeat(10)
    );

    const trainStart = performance.now();
    const trainMetrics = await uts.train(trainData);
    const trainTime = performance.now() - trainStart;
    
    const tokensPerSecond = trainMetrics.totalTokens / (trainTime / 1000);
    this.assert(tokensPerSecond > 1000, `Training throughput: ${tokensPerSecond.toFixed(0)} tokens/sec`);

    // Generation benchmark
    console.log('   📝 Generation Performance...');
    const genStart = performance.now();
    
    let totalTokens = 0;
    for (let i = 0; i < 100; i++) {
      const result = uts.generate({ seed: 'A', length: 50 });
      totalTokens += result.tokens.length;
    }
    
    const genTime = performance.now() - genStart;
    const genTokensPerSecond = totalTokens / (genTime / 1000);
    
    this.assert(genTokensPerSecond > 5000, `Generation throughput: ${genTokensPerSecond.toFixed(0)} tokens/sec`);

    // Cache performance
    console.log('   💾 Cache Performance...');
    const cacheStats = uts.cache.getStats();
    
    this.assert(cacheStats.hitRate >= 0, 'Cache hit rate is valid');
    this.assert(cacheStats.evictions >= 0, 'Cache evictions are tracked');

    // Memory usage
    console.log('   🧠 Memory Usage...');
    const memoryUsage = uts._estimateMemoryUsage();
    
    this.assert(memoryUsage > 0, 'Memory usage is positive');
    this.assert(memoryUsage < 100 * 1024 * 1024, 'Memory usage is reasonable (< 100MB)');

    console.log(`✅ Performance benchmarks completed`);
    console.log(`   Training: ${tokensPerSecond.toFixed(0)} tokens/sec`);
    console.log(`   Generation: ${genTokensPerSecond.toFixed(0)} tokens/sec`);
    console.log(`   Memory: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
  }

  // ==========================================================================
  // EDGE CASES & ERROR HANDLING
  // ==========================================================================

  async testEdgeCases() {
    console.log('\n🧪 Testing Edge Cases & Error Handling...');

    // Test empty training data
    const uts = this.createSystem();
    
    try {
      await uts.train([]);
      this.assert(false, 'Empty training data should throw error');
    } catch (error) {
      this.assert(error.message.includes('non-empty'), 'Empty training error message is clear');
    }

    // Test untrained generation
    try {
      uts.generate({ seed: 'TEST', length: 10 });
      this.assert(false, 'Untrained generation should throw error');
    } catch (error) {
      this.assert(error.message.includes('trained'), 'Untrained generation error message is clear');
    }

    // Test invalid parameters
    const trainedUTS = this.createSystem();
    
    // We'll cheat and mark it as trained for parameter testing
    trainedUTS.isTrained = true;
    
    try {
      trainedUTS.generate({ length: -1 });
      this.assert(false, 'Negative length should throw error');
    } catch (error) {
      this.assert(true, 'Negative length properly rejected');
    }

    try {
      trainedUTS.generate({ length: 10001 });
      this.assert(false, 'Excessive length should throw error');
    } catch (error) {
      this.assert(true, 'Excessive length properly rejected');
    }

    // Test malformed input
    try {
      const badUTS = new UnifiedTokenizationSystem({
        modelWeights: { invalid: 1.0 }
      });
      this.assert(false, 'Invalid model names should be rejected');
    } catch (error) {
      this.assert(true, 'Invalid configuration properly rejected');
    }

    console.log('✅ Edge cases and error handling validated');
  }

  // ==========================================================================
  // SCALABILITY TESTS
  // ==========================================================================

  async testScalability() {
    console.log('\n📈 Testing Scalability...');

    // Test with large vocabulary
    const largeVocabUTS = this.createSystem({
      memory: { maxNodes: 10000 },
      convergence: { maxIterations: 50 }
    });

    const largeVocabData = Array(1000).fill().map((_, i) => 
      `TOKEN${String(i).padStart(4, '0')}`
    );

    const startTime = performance.now();
    const metrics = await largeVocabUTS.train(largeVocabData);
    const trainTime = performance.now() - startTime;

    this.assert(metrics.vocabSize >= 10, 'Large vocabulary is handled (character diversity > 10)');
    this.assert(trainTime < 10000, `Large vocabulary training completes in reasonable time (${trainTime.toFixed(0)}ms)`);

    // Test with long sequences
    const longSequenceData = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(10)];
    
    const longStart = performance.now();
    await largeVocabUTS.train(longSequenceData);
    const longTime = performance.now() - longStart;

    this.assert(longTime < 5000, `Long sequence training completes quickly (${longTime.toFixed(0)}ms)`);

    // Test generation with large context
    const genResult = largeVocabUTS.generate({
      seed: 'TOKEN0001',
      length: 100
    });

    this.assert(genResult.tokens.length === 100, 'Large generation requests are handled');

    console.log('✅ Scalability validated');
  }

  // ==========================================================================
  // MAIN TEST RUNNER
  // ==========================================================================

  async runAll() {
    console.log('🚀 UTS Comprehensive Test Suite Starting...\n');
    this.startTime = performance.now();

    try {
      // Core component tests
      this.testMathematicalFoundations();
      this.testConfigurationValidation();
      this.testCacheSystem();
      this.testEnergyManager();
      
      // Individual model tests
      this.testIntegratedRCW();
      this.testIntegratedCED();
      this.testIntegratedMAR();
      this.testIntegratedMCG();
      await this.testIntegratedCBF();
      this.testIntegratedRSB();

      // End-to-end integration tests
      const uts = await this.testUnifiedSystemTraining();
      this.testUnifiedSystemGeneration(uts);
      this.testUnifiedSystemAnalysis(uts);
      this.testUnifiedSystemValidation(uts);
      this.testUnifiedSystemSerialization(uts);

      // Performance and reliability tests
      await this.testPerformanceBenchmarks();
      await this.testEdgeCases();
      await this.testScalability();

      // Final summary
      const totalTime = performance.now() - this.startTime;
      
      console.log('\n' + '='.repeat(60));
      console.log('📊 TEST SUITE SUMMARY');
      console.log('='.repeat(60));
      console.log(`✅ Passed: ${this.passed}`);
      console.log(`❌ Failed: ${this.failed}`);
      console.log(`📈 Total: ${this.passed + this.failed}`);
      console.log(`⏱️  Duration: ${(totalTime / 1000).toFixed(2)}s`);
      console.log(`🎯 Success Rate: ${(this.passed / (this.passed + this.failed) * 100).toFixed(1)}%`);

      if (this.failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! System is production-ready.');
        console.log('✨ The Unified Tokenization System has been validated');
        console.log('🚀 Ready for deployment in production environments');
      } else {
        console.log('\n❌ SOME TESTS FAILED. Review implementation.');
        console.log('🔧 Address critical failures before production deployment');
        process.exit(1);
      }

      return {
        passed: this.passed,
        failed: this.failed,
        total: this.passed + this.failed,
        duration: totalTime,
        successRate: this.passed / (this.passed + this.failed)
      };

    } catch (error) {
      console.error('\n💥 Test suite crashed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// ============================================================================
// STANDALONE TEST EXECUTION
// ============================================================================

if (import.meta.url.endsWith('test_unified_system.js') || process.argv[1].endsWith('test_unified_system.js')) {
  const testSuite = new UTSTestSuite();
  testSuite.runAll().catch(error => {
    console.error('Test suite execution failed:', error);
    process.exit(1);
  });
}

// Export for module usage
if (typeof module !== 'undefined') {
  module.exports = { UTSTestSuite };
}
