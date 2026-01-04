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
