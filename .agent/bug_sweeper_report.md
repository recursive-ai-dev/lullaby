🧹 BUG-SWEEPER REPORT
═══════════════════════════════════════
Scope: /home/chencebrensen/lullaby
Recursion Depth: 1 (Surface & Logic Scan)
Scan Time: 2025-12-21T03:26:00

[CRITICAL] Logic/React Anti-Pattern
  → Location: lullaby.jsx:134
  → Description: `new Array(20).fill({ val: 5.0 })` creates an array where every element references the exact same object instance. Modifying one element (even if intended to be immutable replacement) can lead to subtle bugs if shallow copies aren't perfect, and definitely bugs if mutation occurs.
  → Fix Recommendation: Use `Array.from({ length: 20 }, () => ({ val: 5.0 }))` to ensure unique instances.
  → Confidence: HIGH

[HIGH] Architecture/Persistence Flaw
  → Location: modules/engine.js (ResonanceEngine)
  → Description: The `ResonanceEngine` persists model weights and replay buffer but fails to persist the `optimizer` state (steps `t`, momentum `m`, `v`).
  → Impact: On every page reload/component re-mount, the optimizer resets. The learning rate schedule restarts from the beginning (warmup), and momentum is lost. This severely hampers "lifelong learning" behavior as the model constantly resets its training dynamics.
  → Fix Recommendation: Add `optimizer` state serialization to `saveCheckpoint` and `loadCheckpoint`.
  → Confidence: HIGH

[MEDIUM] Logic/Optimizer Imprecision
  → Location: modules/optimizer.js:116
  → Description: `AdamOptimizer.step(epoch, totalEpochs)` accepts epoch info but `getLearningRate` relies solely on internal `this.t` counter and a hardcoded `totalSteps=10000`.
  → Impact: The learning rate schedule is detached from the actual requested training duration (e.g. dataset training).
  → Fix Recommendation: Respect `totalEpochs` for the LR schedule calculation if provided, or synchronize `this.t` with persistence (see above).
  → Confidence: MEDIUM

[MEDIUM] Logic/Tensor Operation
  → Location: modules/tensor.js:100
  → Description: `matmul` assumes `B.shape[0]` matches `A.shape[0]` (batch size) when `dimB > 2`, without explicit validation.
  → Impact: Potential crash or silent data corruption if broadcasting is attempted or mismatched batch sizes are passed.
  → Fix Recommendation: Add explicit batch dimension compatibility check.
  → Confidence: MEDIUM

[LOW] Syntax/Style
  → Location: lullaby.jsx (General)
  → Description: "God Component" anti-pattern (1700+ lines).
  → Recommended Action: Refactor `NeuralTerminal` into smaller sub-components (e.g., `TerminalOutput`, `TrainingStatus`, `DatasetManager`).
  → Confidence: HIGH

Recursive Sub-scan Results:
  - modules/engine.js: Clean class structure, potentially unsafe tensor mutation in `generate` (perf trade-off).
  - modules/nanotensor.js: Good numerical stability guards in `exp`, `sqrt`.
  - modules/conversation_store.js: Robust IDB handling, theoretically minor race condition on delete (acceptable for client-side).

Statistics:
  Total Issues: 5 (CRITICAL: 1, HIGH: 1, MEDIUM: 2, LOW: 1)
  Coverage: ~25% (Key Core Files)
