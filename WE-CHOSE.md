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
