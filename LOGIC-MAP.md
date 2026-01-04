## Logic Map: Training Checkpoint Alignment

### Issue
Training appeared to have no effect because the training UI saved checkpoints under a fixed key that the main app never loads.

### Logic Chain (Steps 1–3)
1. **Observation ➜ Non-overlapping checkpoint keys**
   - Training page saves to a constant key (`lullaby-companion-extended-v1`).
   - Main app loads from `localStorage.lullaby.profileKey` (default `latest`).
2. **Causal Link ➜ Zero-probability retrieval**
   - If `K_train ≠ K_app`, then the checkpoint lookup function returns no data for the app.
   - Therefore the trained weights are not loaded, and generation remains untrained.
3. **Correction ➜ Shared key derivation**
   - Define `K = localStorage.lullaby.profileKey` when present, else `latest`.
   - Save checkpoints using `K` so the app and training use the same key.

### Proof of Correctness (Minimal)
Let `Load(K)` be the app’s checkpoint fetch and `Save(K)` be the training checkpoint write.
If `K_train = K_app`, then `Load(K_app)` retrieves the data written by `Save(K_train)`.
If `K_train ≠ K_app`, then `Load(K_app)` retrieves nothing (or a different profile).
Therefore, aligning keys is necessary and sufficient for the training checkpoint to be visible to the app.

---

## Logic Map: UTS Test Suite Real-Component Validation

### Issue
The UTS test suite instantiated mock models and referenced non-exported internals, producing brittle coverage and runtime failures that did not reflect production behavior.

### Logic Chain (Steps 1–3)
1. **Observation ➜ Mock scaffolding masked real system state**
   - Energy manager tests used `mockModels`, while other tests referenced internal classes not exported by the module.
   - This bypassed the real UnifiedTokenizationSystem wiring and could not validate actual model dependencies.
2. **Causal Link ➜ Invalid or incomplete coverage**
   - If tests do not construct the production system (`UTS`), energy distribution, cache behavior, and component initialization are unverified.
   - Missing exports lead to `ReferenceError` failures, hiding defects in the integration path.
3. **Correction ➜ Build tests from the production system**
   - Create UTS instances with full configuration derived from `UTS_CONFIG`.
   - Drive cache, energy manager, and component tests through `uts.models`, `uts.cache`, and `uts.energyManager`.

### Proof of Correctness (Minimal)
Let `S` be the production system initialization and `T` be the test suite.  
If `T` constructs `S`, then every test exercises the same dependency graph used in runtime.  
If `T` uses mocks or undefined internals, then coverage is neither complete nor representative.  
Therefore, initializing tests through `S` is necessary and sufficient for valid integration coverage.
