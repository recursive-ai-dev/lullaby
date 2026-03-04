import { UTSTestSuite } from './test_unified_system.js';

const testSuite = new UTSTestSuite();
testSuite.runAll().then(results => {
    console.log('Results:', results);
}).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
