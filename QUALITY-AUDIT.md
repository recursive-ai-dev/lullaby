# Quality Audit Report

This report contains concrete, non-breaking improvements ranked by impact.

### 1. Unawaited Training Promise Causes DataCloneError Crashes
* **File:** `lullaby.worker.js` (Line 79)
* **Problem:** In the `'TRAIN'` message handler, `engine.trainStep` (which is an `async` function) is called synchronously without `await`. The resulting unresolved Promise is passed directly into `postMessage()`.
* **Why it matters:** `postMessage` cannot serialize Promises. This throws a `DataCloneError`, crashes the worker, prevents the main thread from receiving the `'TRAIN_COMPLETE'` signal, and allows subsequent concurrent messages to mutate state while training is still processing in the background.
* **Proposed Fix:** Add `await` to the assignment: `const loss = await engine.trainStep(payload.text, payload.epoch, payload.totalEpochs, payload.isGameplay);`.
* **Overlap:** None.

### 2. Safetensors Export Uses Platform-Dependent Endianness
* **File:** `modules/engine.js` (Lines 197-200)
* **Problem:** `exportSafetensors` encodes the binary buffer length using a `BigUint64Array`, which uses the hardware's native endianness instead of strict little-endian.
* **Why it matters:** The Safetensors specification strictly requires a little-endian 8-byte unsigned integer. Exporting this on a big-endian architecture will produce a corrupted file unreadable by standard ML ecosystems.
* **Proposed Fix:** Replace `const lenBuffer = new BigUint64Array(1); lenBuffer[0] = BigInt(padLen);` with a `DataView` to force little-endian alignment:
  `const lenBuffer = new ArrayBuffer(8); new DataView(lenBuffer).setBigUint64(0, BigInt(padLen), true);` and pass `lenBuffer` instead of the typed array.
* **Overlap:** None.

### 3. Missing State-Lock on Worker Initialization (Async Singleton Collision)
* **File:** `lullaby.worker.js` (Lines 44-52)
* **Problem:** The `'INIT'` handler creates a new `ResonanceEngine` and calls the asynchronous `loadCheckpoint` without locking the block against concurrent executions.
* **Why it matters:** If the UI sends multiple rapid `'INIT'` signals, overlapping instances of `loadCheckpoint` will resolve out of order, double-initializing neural weights and permanently desyncing the global `engine` reference.
* **Proposed Fix:** Introduce a file-scoped `let isInitializing = false;` lock. At the start of the `'INIT'` case, add `if (isInitializing) return; isInitializing = true;` and wrap the remainder of the case block in a `try...finally { isInitializing = false; }`.
* **Overlap:** None.

### 4. Asynchronous Training Lock Acquired Too Late
* **File:** `modules/engine.js` (Lines 114-137)
* **Problem:** In `trainStep`, `this.utsTrainingLock` is evaluated at the top of the function but is not set to `true` until line 132, *after* the entire neural network forward and backward passes execute.
* **Why it matters:** The lock fails to sequence concurrent calls. Multiple threads can simultaneously enter `trainStep`, resulting in overlapping gradient accumulation, corrupted weights, and conflicting IndexedDB transactions.
* **Proposed Fix:** Move `this.utsTrainingLock = true;` to line 115, immediately after the early return guard. Wrap lines 116-135 in a `try` block, and move `this.utsTrainingLock = false;` into a `finally` block at the end of the method.
* **Overlap:** None.

### 5. MultiLevelCache L2-to-L1 Promotion Duplicates Entries
* **File:** `modules/tokenization/unified_tokenization_system.js` (Lines 109-113)
* **Problem:** In `MultiLevelCache.get()`, when a cache hit occurs in L2, the entry is promoted to L1 via `this.set()`, but is never deleted from L2.
* **Why it matters:** Fails the atomic promotion requirement. The same key occupies space in both L1 and L2 simultaneously, creating a race condition during concurrent generation tasks and permanently leaking memory capacity.
* **Proposed Fix:** Inside the `if (this.l2.has(key))` block, explicitly remove the entry from L2 before setting it in L1 by inserting `this.l2.delete(key);` right before `this.set(key, val);`.
* **Overlap:** Touches `MultiLevelCache` (same region as #6).

### 6. MultiLevelCache L1-to-L2 Eviction Violates Atomic Ordering
* **File:** `modules/tokenization/unified_tokenization_system.js` (Lines 119-121)
* **Problem:** During `set()`, when L1 reaches capacity, it copies the oldest entry to L2 *before* deleting it from L1 (`this.l2.set()` followed by `this.l1.delete()`).
* **Why it matters:** Violates the memory stricture requiring "delete followed immediately by set". Reversing this order during high concurrency can lead to edge cases where asynchronous reads fetch stale state.
* **Proposed Fix:** Swap the order of operations in the eviction block to strictly follow the required pattern: `this.l1.delete(firstKey);` followed immediately by `this.l2.set(firstKey, entry);`.
* **Overlap:** Touches `MultiLevelCache` (same region as #5).

### 7. IntegratedRCW Fails Silently on Array Context Keys
* **File:** `modules/tokenization/unified_tokenization_system.js` (Lines 226-227)
* **Problem:** `IntegratedRCW.predict(ctx)` uses the raw `ctx` variable directly to query `this.memory.get(ctx)`. If `ctx` is passed as an array, the Map executes a reference-based lookup and fails silently.
* **Why it matters:** Arrays representing identical sequence states point to different memory addresses, resulting in 100% cache misses and effectively disabling the RCW expert when called dynamically.
* **Proposed Fix:** Force stringification prior to lookup: `const key = Array.isArray(ctx) ? ctx.join('') : String(ctx);` and change the retrieval to `const counts = this.memory.get(key);`.
* **Overlap:** None.

### 8. Exponential String Growth in Standalone Generative Experts
* **File:** `modules/tokenization/unified_tokenization_system.js` (Lines 233-240 and 280-287)
* **Problem:** `IntegratedRCW.generate` and `IntegratedMAR.generate` append their newly predicted tokens directly to the original `seed` and return the combined string.
* **Why it matters:** If these experts are polled in continuous feedback loops (where the output becomes the next input), the returned payload size grows exponentially rather than linearly, leading to catastrophic V8 OOM crashes.
* **Proposed Fix:** Within each method's `for` loop, initialize a `let generated = "";` variable. Append `res.token` to both `out` and `generated`, and update the method to `return generated;` instead of `out`.
* **Overlap:** None.

### 9. Math.random() Breaks Deterministic Reproducibility in Replay Buffer
* **File:** `modules/memory.js` (Line 41)
* **Problem:** `PrioritizedReplayBuffer.sample()` relies on the non-deterministic native `Math.random()` to perform importance sampling.
* **Why it matters:** The architecture strictly requires a synchronized deterministic PRNG to ensure reproducibility. Native random calls permanently desync profile-bound training sessions.
* **Proposed Fix:** Modify the constructor to accept the engine's PRNG instance (`constructor(maxSize = 100, alpha = 0.6, beta = 0.4, prng) { ... this.prng = prng; }`). Inject `this.prng` from `engine.js` upon initialization, and replace `Math.random()` with `this.prng.random()`.
* **Overlap:** None.

### 10. Linear Layers Silently Destroy Accumulated Gradients
* **File:** `modules/layers.js` (Line 29 and 225)
* **Problem:** `Linear.backward` and `BayesianLinear.backward` assign calculated gradients directly using the `=` operator (e.g., `this.weight.grad = gradWeight.data`) instead of accumulating them.
* **Why it matters:** If a layer is executed multiple times within a single forward pass (like recurrent architectures or weight tying), the direct assignment silently obliterates all previously accumulated gradients, fundamentally breaking backpropagation.
* **Proposed Fix:** Change assignments to iterative accumulations:
  `if (!this.weight.grad) this.weight.grad = new Float32Array(gradWeight.data.length);`
  `for (let i = 0; i < gradWeight.data.length; i++) this.weight.grad[i] += gradWeight.data[i];`
* **Overlap:** None.

### 11. Tensor.reshape In-Place Array Mutation Corrupts Callers
* **File:** `modules/tensor.js` (Lines 79-81)
* **Problem:** `reshape(newShape)` mutates the provided `newShape` array in-place when calculating inferred (`-1`) dimensions.
* **Why it matters:** If a static layout array (e.g., `const target = [-1, 10];`) is defined outside a loop and reused, the `-1` is permanently overwritten with a static integer on the first pass, crashing all subsequent iterations with dimension mismatches.
* **Proposed Fix:** Deep clone the input array immediately upon method entry: `const targetShape = [...newShape];` and mutate/return `targetShape` instead.
* **Overlap:** None.

### 12. Floating-Point Edge Case Causes Out-Of-Bounds Array Access
* **File:** `modules/tokenization/unified_tokenization_system.js` (Line 277)
* **Problem:** `IntegratedMAR.predict` uses `Math.floor(this.prng.random() * c.length)` to access character arrays. While mathematically rare, rounding errors or custom seed combinations can produce a value exactly equal to the array length.
* **Why it matters:** An exact-length evaluation results in an `undefined` character being appended to the sequence string. Once `"undefined"` enters the training buffer, it poisons the vocabulary state indefinitely.
* **Proposed Fix:** Add a safety clamp to the array index calculation:
  `Math.min(c.length - 1, Math.floor(this.prng.random() * c.length))`
* **Overlap:** None.
