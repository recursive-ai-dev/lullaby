## Three-Perspective Planning (CEO / Junior Dev / End Customer)

### CEO Perspective (Outcome & Risk)
- **Goal:** Ensure training visibly affects production behavior without introducing new UI complexity.
- **Risk Check:** Avoid breaking existing profile workflows or forcing a new profile key.
- **Choice:** Reuse the same persisted profile key as the app (safe, minimal, reversible).

### Junior Dev Perspective (Implementation Clarity)
- **Goal:** A small, understandable change that can be reasoned about locally.
- **Decision:** Read `localStorage.lullaby.profileKey` with a fallback to `latest`.
- **Why:** Matches app behavior; no new dependencies; localized to training UI script.

### End Customer Perspective (User Experience)
- **Goal:** “Train in browser” actually changes responses in the main app without extra steps.
- **Decision:** Save checkpoints to the same profile the app loads automatically.
- **Outcome:** Training results appear immediately after returning to the main UI.

### Final Selection (Mapped to Logic Chain)
We selected **shared checkpoint key derivation** because it directly resolves the mismatch in the logic chain (LOGIC-MAP.md Step 3) while minimizing risk and complexity.

---

## UTS Test Suite Real-Component Validation (CEO / Junior Dev / End Customer)

### CEO Perspective (Outcome & Risk)
- **Goal:** Tests must validate production wiring, not isolated fragments.
- **Risk Check:** Avoid hidden regressions caused by mock-only coverage or undefined internals.
- **Choice:** Instantiate `UnifiedTokenizationSystem` for every component test and derive config from `UTS_CONFIG`.

### Junior Dev Perspective (Implementation Clarity)
- **Goal:** Make the test suite deterministic and self-contained.
- **Decision:** Add `buildConfig()` and `createSystem()` helpers that deep-merge overrides into `UTS_CONFIG`.
- **Why:** This preserves required configuration fields while allowing small overrides without breaking validation.

### End Customer Perspective (User Experience)
- **Goal:** Reliable quality signals that reflect the shipping system.
- **Decision:** Test cache, energy manager, and model components through real `uts.models` instances.
- **Outcome:** Failures now correspond to true production issues instead of mock-induced artifacts.

### Final Selection (Mapped to Logic Chain)
We selected **real-system construction for every test** to align with LOGIC-MAP “UTS Test Suite Real-Component Validation” Step 3, ensuring integration coverage mirrors production behavior.

---

## Deterministic Sampling & Weight Allocation (CEO / Junior Dev / End Customer)

### CEO Perspective (Outcome & Risk)
- **Goal:** Reproducible training manifests with provable adherence to pack weights.
- **Risk Check:** Avoid opaque randomness that can invalidate training comparisons or audits.
- **Choice:** Seeded randomness with uniform shuffling and explicit allocation math.

### Junior Dev Perspective (Implementation Clarity)
- **Goal:** Clear, testable flow with minimal moving parts.
- **Decision:** Add `makeRng`, `shuffleInPlace`, and `allocateCounts` helpers.
- **Why:** Encapsulated math makes it easy to reason about counts and sample stability.

### End Customer Perspective (User Experience)
- **Goal:** Consistent behavior across repeated training runs.
- **Decision:** Derive a stable seed from pack and sample inputs (or accept a user seed).
- **Outcome:** The same inputs yield identical manifests and predictable model behavior.

### Final Selection (Mapped to Logic Chain)
We selected **seeded Fisher–Yates shuffling with largest-remainder allocation** to align with LOGIC-MAP “Deterministic Sampling & Weight Allocation” Step 3, ensuring reproducible, weight-accurate manifests.
