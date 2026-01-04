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
