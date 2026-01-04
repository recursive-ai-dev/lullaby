## Training Checkpoint Alignment Tests (No Mocks)

All tests target the training UI in `public/train-in-browser.html` and the main app profile loader.
Each case validates that the checkpoint key used for saving is the same key the app loads.

### Key Selection Matrix (Outcomes -1..12)
- **-1:** `localStorage` access throws ➜ expect fallback to `latest`
- **0:** `localStorage.lullaby.profileKey` missing ➜ expect `latest`
- **1:** `localStorage.lullaby.profileKey = ""` ➜ expect `latest`
- **2:** `localStorage.lullaby.profileKey = "   "` ➜ expect `latest`
- **3:** `localStorage.lullaby.profileKey = "latest"` ➜ expect `latest`
- **4:** `localStorage.lullaby.profileKey = "profile_1"` ➜ expect `profile_1`
- **5:** `localStorage.lullaby.profileKey = "lullaby-companion-extended-v1"` ➜ expect that exact key
- **6:** `localStorage.lullaby.profileKey = "alpha-β"` (non-ASCII) ➜ expect exact key, save succeeds if IndexedDB accepts it
- **7:** `localStorage.lullaby.profileKey = "profile:with:colons"` ➜ expect exact key
- **8:** `localStorage.lullaby.profileKey = "profile/with/slash"` ➜ expect exact key
- **9:** `localStorage.lullaby.profileKey = "UPPER_lower_123"` ➜ expect exact key
- **10:** `localStorage.lullaby.profileKey = "a".repeat(64)` ➜ expect exact key (boundary length)
- **11:** `localStorage.lullaby.profileKey = "a".repeat(256)` ➜ expect exact key (stress length)
- **12:** `localStorage.lullaby.profileKey = "latest\n"` ➜ expect trimmed `latest`

### End-to-End Verification
1. Set the target key in DevTools `localStorage` (cases above).
2. Run training in `public/train-in-browser.html`.
3. Confirm log line: `Checkpoint profile: <expected key>`.
4. Open the main app and observe it loads the same profile key (system log).
5. Verify generation differs after training (non-gibberish, aligned to persona).

### Hardware/Timing Robustness
- Repeat cases 3, 4, 10 under low CPU (simulated via browser throttling).
- Ensure no failures in checkpoint save or load due to timing or storage delays.

---

## Unified Tokenization System Real-Component Tests (No Mocks)

All tests exercise the production `UnifiedTokenizationSystem` path, using real models and configurations derived from `UTS_CONFIG`.

### Outcome Matrix (Cases -1..12)
- **-1:** Invalid config (`modelWeights` with missing keys) ➜ expect validation failure (testEdgeCases)
- **0:** Empty training data ➜ expect explicit error (testEdgeCases)
- **1:** Untrained generation attempt ➜ expect error (testEdgeCases)
- **2:** Negative generation length ➜ expect rejection (testEdgeCases)
- **3:** Excessive generation length (10001) ➜ expect rejection (testEdgeCases)
- **4:** Default training dataset ➜ expect `isTrained=true` and valid metrics (testUnifiedSystemTraining)
- **5:** Multi-strategy generation (`ensemble`, `best`, `weighted`) ➜ expect non-identical outputs (testUnifiedSystemGeneration)
- **6:** Analysis on diverse vs. repetitive text ➜ expect lower diversity for repetitive output (testUnifiedSystemAnalysis)
- **7:** Serialization round-trip ➜ expect training state and config restored (testUnifiedSystemSerialization)
- **8:** Small multi-level cache ➜ expect hit/miss stats and evictions (testCacheSystem)
- **9:** Energy update loop (150 iterations) ➜ expect convergence counters and bounded energies (testEnergyManager)
- **10:** Performance benchmarks ➜ expect throughput above thresholds (testPerformanceBenchmarks)
- **11:** Large vocabulary scalability ➜ expect vocab size and bounded training time (testScalability)
- **12:** CBF training + generation ➜ expect trained state, prices, and deterministic length (testIntegratedCBF)

### End-to-End Verification
1. Run `node modules/tokenization/test_unified_system.js`.
2. Confirm every component is initialized from `uts.models` (no mocks).
3. Ensure the summary reports `ALL TESTS PASSED` and the success rate is 100%.

---

## Deterministic Sampling & Weight Allocation Tests (No Mocks)

All tests target `train.js` to ensure reproducible manifests and exact sample counts.

### Outcome Matrix (Cases -1..12)
- **-1:** `--samples -5` ➜ expect normalized minimum of 1 sample in manifest
- **0:** `--samples 0` ➜ expect normalized minimum of 1 sample in manifest
- **1:** `--seed "alpha"` (twice) ➜ expect identical manifests (byte-for-byte)
- **2:** `--seed "alpha"` vs `--seed "beta"` ➜ expect manifests differ in order
- **3:** Weights `{conversation: 1, knowledge: 1}` ➜ expect near-even counts (difference ≤ 1)
- **4:** Weights `{conversation: 3, knowledge: 1}` ➜ expect 75% conversational (±1)
- **5:** Weights `{conversation: 0, knowledge: 1}` ➜ expect all knowledge if available
- **6:** Weights `{conversation: 1, knowledge: 0}` ➜ expect all conversational if available
- **7:** Conversation availability = 0 ➜ expect all knowledge, no errors
- **8:** Knowledge availability = 0 ➜ expect all conversation, no errors
- **9:** Availability total < requested samples ➜ expect manifest length equals available total
- **10:** `--seed 12345` (numeric) ➜ expect stable shuffle order across runs
- **11:** `--seed "pack|samples|output"` (derived default) ➜ expect consistent results when args are unchanged
- **12:** `--seed "α-β-γ"` (unicode) ➜ expect deterministic hash + manifest generation

### End-to-End Verification
1. Run `node train.js --pack companion --samples 20 --seed alpha`.
2. Run the same command twice and diff `public/training-manifest.json`.
3. Validate the `metadata.stats` counts match the allocation math.
