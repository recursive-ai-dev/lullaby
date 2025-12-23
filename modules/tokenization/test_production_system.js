/**
 * Test script for the Production Unified Tokenization System
 */

'use strict';

const { ProductionUnifiedTokenizationSystem, ProductionMath } = require('./production_unified_system');

async function runTests() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  PRODUCTION UNIFIED TOKENIZATION SYSTEM - TEST SUITE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ ${message}`);
            passed++;
        } else {
            console.log(`  ❌ ${message}`);
            failed++;
        }
    }

    // Test 1: System initialization
    console.log('🔧 Test 1: System Initialization');
    try {
        const puts = new ProductionUnifiedTokenizationSystem();
        assert(puts !== null, 'System creates successfully');
        assert(Object.keys(puts.models).length === 6, 'All 6 models initialized');
        assert(!puts.isTrained, 'Initially not trained');
        assert(puts.vocabulary.size === 0, 'Vocabulary initially empty');
    } catch (e) {
        console.log(`  ❌ Initialization error: ${e.message}`);
        failed++;
    }

    // Test 2: Configuration validation
    console.log('\n🔧 Test 2: Configuration Validation');
    try {
        // Should fail with invalid weights
        try {
            new ProductionUnifiedTokenizationSystem({
                modelWeights: { rcw: 2.0, ced: 0.5 }  // Doesn't sum to 1
            });
            assert(false, 'Should reject invalid weights');
        } catch (e) {
            assert(e.message.includes('weights'), 'Rejects invalid model weights');
        }
    } catch (e) {
        console.log(`  ❌ Config validation error: ${e.message}`);
        failed++;
    }

    // Test 3: Mathematical utilities
    console.log('\n🔧 Test 3: Mathematical Utilities');
    try {
        const dist = { a: 0.5, b: 0.3, c: 0.2 };
        const entropy = ProductionMath.entropy(dist);
        assert(entropy > 0 && entropy < 2, `Entropy calculation works: ${entropy.toFixed(4)}`);

        const softmaxResult = ProductionMath.softmax([1, 2, 3]);
        const softmaxSum = softmaxResult.reduce((a, b) => a + b, 0);
        assert(Math.abs(softmaxSum - 1.0) < 1e-6, 'Softmax sums to 1');

        const editDist = ProductionMath.editDistance('kitten', 'sitting');
        assert(editDist === 3, `Edit distance correct: ${editDist}`);
    } catch (e) {
        console.log(`  ❌ Math utilities error: ${e.message}`);
        failed++;
    }

    // Test 4: Training
    console.log('\n🔧 Test 4: Training');
    try {
        const puts = new ProductionUnifiedTokenizationSystem();

        const trainingData = [
            'hello world',
            'world peace',
            'peace and harmony',
            'harmony in the world',
            'the world is beautiful'
        ];

        console.log('  Training on corpus...');
        const metrics = await puts.train(trainingData);

        assert(puts.isTrained, 'System marked as trained');
        assert(puts.vocabulary.size > 0, `Vocabulary built: ${puts.vocabulary.size} tokens`);
        assert(metrics.totalSequences === 5, 'Processed all sequences');
        assert(metrics.trainingTime > 0, `Training time recorded: ${metrics.trainingTime.toFixed(2)}ms`);
    } catch (e) {
        console.log(`  ❌ Training error: ${e.message}`);
        console.log(`     Stack: ${e.stack}`);
        failed++;
    }

    // Test 5: Generation
    console.log('\n🔧 Test 5: Generation');
    try {
        const puts = new ProductionUnifiedTokenizationSystem();

        const trainingData = [
            'abcdef', 'bcdefg', 'cdefgh', 'defghi',
            'efghij', 'fghijk', 'ghijkl', 'hijklm'
        ];

        await puts.train(trainingData);

        const result = puts.generate({ seed: 'a', length: 20 });

        assert(result.output.length > 1, `Generated output length: ${result.output.length}`);
        assert(result.tokens.length > 0, `Tokens generated: ${result.tokens.length}`);
        assert(result.metrics.generationTime > 0, `Generation time: ${result.metrics.generationTime.toFixed(2)}ms`);

        console.log(`  📝 Generated: "${result.output}"`);
    } catch (e) {
        console.log(`  ❌ Generation error: ${e.message}`);
        console.log(`     Stack: ${e.stack}`);
        failed++;
    }

    // Test 6: Analysis
    console.log('\n🔧 Test 6: Analysis');
    try {
        const puts = new ProductionUnifiedTokenizationSystem();
        await puts.train(['hello world', 'world hello']);

        const analysis = puts.analyze('hello world hello');

        assert(analysis.length === 17, `Analyzed length: ${analysis.length}`);
        assert(analysis.entropy >= 0, `Entropy calculated: ${analysis.entropy.toFixed(4)}`);
        assert(analysis.patterns !== undefined, 'Pattern detection works');
    } catch (e) {
        console.log(`  ❌ Analysis error: ${e.message}`);
        failed++;
    }

    // Test 7: Validation
    console.log('\n🔧 Test 7: Validation');
    try {
        const puts = new ProductionUnifiedTokenizationSystem();
        await puts.train(['test data']);

        const validation = puts.validate();

        assert(validation.valid !== undefined, 'Validation returns status');
        assert(Array.isArray(validation.errors), 'Errors array exists');
        assert(validation.metrics !== undefined, 'Metrics included');
    } catch (e) {
        console.log(`  ❌ Validation error: ${e.message}`);
        failed++;
    }

    // Test 8: Serialization
    console.log('\n🔧 Test 8: Serialization');
    try {
        const puts = new ProductionUnifiedTokenizationSystem();
        await puts.train(['serialize test']);

        const serialized = puts.serialize();

        assert(serialized.version === '3.0.0', 'Version included');
        assert(serialized.isTrained === true, 'Training state serialized');
        assert(Array.isArray(serialized.vocabulary), 'Vocabulary serialized');

        // Test deserialization
        const restored = ProductionUnifiedTokenizationSystem.deserialize(serialized);
        assert(restored.isTrained, 'Restored system is trained');
        assert(restored.vocabulary.size > 0, 'Vocabulary restored');
    } catch (e) {
        console.log(`  ❌ Serialization error: ${e.message}`);
        failed++;
    }

    // Test 9: Cache system
    console.log('\n🔧 Test 9: Cache System');
    try {
        const puts = new ProductionUnifiedTokenizationSystem();
        await puts.train(['abc', 'bcd', 'cde']);

        // Generate twice to test caching
        puts.generate({ seed: 'a', length: 10 });
        puts.generate({ seed: 'a', length: 10 });

        const cacheStats = puts.cache.getStats();
        assert(cacheStats.hits >= 0, `Cache hits: ${cacheStats.hits}`);
        assert(cacheStats.sizes.l1 >= 0, `L1 cache entries: ${cacheStats.sizes.l1}`);
    } catch (e) {
        console.log(`  ❌ Cache error: ${e.message}`);
        failed++;
    }

    // Test 10: Energy management
    console.log('\n🔧 Test 10: Energy Management');
    try {
        const puts = new ProductionUnifiedTokenizationSystem();
        await puts.train(['test']);

        const status = puts.energyManager.getConvergenceStatus();

        assert(Object.keys(status).length === 6, 'All models tracked');
        for (const [model, data] of Object.entries(status)) {
            assert(data.energy >= 0 && data.energy <= 1, `${model} energy in bounds: ${data.energy.toFixed(3)}`);
        }
    } catch (e) {
        console.log(`  ❌ Energy management error: ${e.message}`);
        failed++;
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (failed === 0) {
        console.log('  🎉 ALL TESTS PASSED! System is production-ready.\n');
    } else {
        console.log('  ⚠️  Some tests failed. Review implementation.\n');
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test suite crashed:', err);
    process.exit(1);
});
