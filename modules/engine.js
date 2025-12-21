import { Tensor } from './tensor.js';
import { NanoTransformer } from './model.js';
import { AdamOptimizer } from './optimizer.js';
import { BayesianLinear } from './layers.js';
import { Tokenizer } from './tokenizer.js';
import { PrioritizedReplayBuffer } from './memory.js';
import { ConsolidationEngine } from './consolidation.js';
import { generateSeedLines } from './seed.js';

// ==========================================
// 5. RESONANCE ENGINE (With Experience Replay)
// ==========================================
export class ResonanceEngine {
    constructor() {
        this.tokenizer = new Tokenizer();
        // Map old properties to new tokenizer for compatibility if needed, 
        // but preferably we just use this.tokenizer everywhere.
        this.vocabSize = this.tokenizer.vocabSize;

        // Primary model (trained)
        this.model = new NanoTransformer(this.vocabSize, 64, 4);
        // Secondary model (EMA shadow) for smoother inference.
        // This is what you asked for as a "second nanotensor".
        this.emaModel = new NanoTransformer(this.vocabSize, 64, 4);
        this.emaTau = 0.02; // higher = faster tracking, lower = smoother
        this.useEmaForGenerate = true;

        // Internal “vibe trigger” for generation (not shown to user; only conditions the model).
        // Matches the emma-bot spec doc.
        this.useVibeTriggerForGenerate = true;
        this.vibeTriggerText = "[Name]: Thin, sharp-tongued, fiercely loyal, lifelong friend. Attitude: Protective/Sarcastic. Passion: High.";
        this.syncEmaFromModel();

        this.optimizer = new AdamOptimizer(this.model.parameters(), 0.001);
        this.consolidation = new ConsolidationEngine(this.model);

        // PRIORITIZED REPLAY BUFFER
        this.replayBuffer = new PrioritizedReplayBuffer(100);

        // TD-ERROR TRACKING (what it doesn't know)
        this.tdErrors = new Map(); // text -> tdError
        this.alpha = 0.6; // Priority exponent
        this.beta = 0.4; // Importance sampling exponent

        // KL DIVERGENCE TRACKING (identity protection)
        this.klLoss = 0;

        // Checkpoint profile key (IndexedDB key)
        this.profileKey = 'latest';
    }

    setProfileKey(profileKey) {
        const key = String(profileKey || '').trim();
        this.profileKey = key || 'latest';
        return this.profileKey;
    }

    seedFromName(name, { count = 60, overrides = {}, templates = null, train = true } = {}) {
        const { vars, lines } = generateSeedLines({ name, count, overrides, templates: templates || undefined });

        // Fill the replay buffer and optionally train lightly.
        // This is intentionally small and fast: one pass over lines.
        for (let i = 0; i < lines.length; i++) {
            const text = lines[i];
            this.addToReplay(text);
            if (train) {
                this.trainStep(text, i, lines.length, true);
            }
        }

        return { vars, count: lines.length };
    }

    // Copy weights from primary model into EMA model.
    syncEmaFromModel() {
        const src = this.model.parameters();
        const dst = this.emaModel.parameters();
        const n = Math.min(src.length, dst.length);
        for (let i = 0; i < n; i++) {
            dst[i].data.set(src[i].data);
        }
    }

    // EMA update: ema = (1-tau)*ema + tau*model
    updateEma() {
        const tau = this.emaTau;
        if (!(tau > 0 && tau <= 1)) return;

        const src = this.model.parameters();
        const dst = this.emaModel.parameters();
        const n = Math.min(src.length, dst.length);
        for (let i = 0; i < n; i++) {
            const s = src[i].data;
            const d = dst[i].data;
            for (let j = 0; j < d.length; j++) {
                d[j] = d[j] * (1 - tau) + s[j] * tau;
            }
        }
    }

    // Parameter naming must be stable across export/import.
    // If you change model architecture, update this list accordingly.
    getSafetensorsParamNames() {
        return [
            "token_emb.weight",
            // pos_emb removed
            "ln1.gamma", "ln1.beta",
            // MHA
            "mha.wQ.factorA", "mha.wQ.coreG", "mha.wQ.factorB", "mha.wQ.bias",
            "mha.wK.factorA", "mha.wK.coreG", "mha.wK.factorB", "mha.wK.bias",
            "mha.wV.factorA", "mha.wV.coreG", "mha.wV.factorB", "mha.wV.bias",
            "mha.wO.weight", "mha.wO.bias",
            // LN2
            "ln2.gamma", "ln2.beta",
            // FF1 (Bayesian)
            "ff1.w_mu", "ff1.w_rho", "ff1.bias_mu", "ff1.bias_rho",
            // FF2
            "ff2.weight", "ff2.bias",
            // Final Norm
            "final_norm.gamma", "final_norm.beta",
            // LM Head
            "lm_head.weight", "lm_head.bias"
        ];
    }

    tokenize(text) {
        return this.tokenizer.tokenize(text);
    }

    detokenize(ids) {
        return this.tokenizer.detokenize(ids);
    }

    generate(seedText, steps = 10, temperature = 0.5) {
        // Clamp temperature to safe range (CRITICAL FIX #21)
        const safeTemp = Math.max(temperature, 0.01);

        const conditionedSeed = (this.useVibeTriggerForGenerate && this.vibeTriggerText)
            ? `${this.vibeTriggerText}\n${seedText}`
            : seedText;

        let currentIds = this.tokenize(conditionedSeed);
        if (currentIds.length === 0) currentIds = [this.tokenizer.charToId["<START>"]];
        if (currentIds.length > 32) currentIds = currentIds.slice(-32);

        let outputIds = [];

        const activeModel = (this.useEmaForGenerate && this.emaModel) ? this.emaModel : this.model;

        for (let i = 0; i < steps; i++) {
            const logits = activeModel.forward(currentIds);
            const seqLen = logits.shape[1];
            const vocabSize = logits.shape[2];
            const lastLogitOffset = (seqLen - 1) * vocabSize;

            for (let v = 0; v < vocabSize; v++) {
                if (currentIds.includes(v)) logits.data[lastLogitOffset + v] -= 2.0;
            }

            let maxVal = -Infinity;
            for (let v = 0; v < vocabSize; v++) {
                const val = logits.data[lastLogitOffset + v];
                if (val > maxVal) maxVal = val;
            }

            const probs = [];
            let sumExp = 0;
            for (let v = 0; v < vocabSize; v++) {
                const val = logits.data[lastLogitOffset + v];
                const e = Math.exp((val - maxVal) / safeTemp);
                probs.push(e);
                sumExp += e;
            }

            const r = Math.random() * sumExp;
            let accumulated = 0;
            let bestId = 0;
            for (let v = 0; v < vocabSize; v++) {
                accumulated += probs[v];
                if (accumulated >= r) { bestId = v; break; }
            }

            outputIds.push(bestId);
            currentIds.push(bestId);

            if (currentIds.length > 32) currentIds.shift();

            const dotId = this.tokenizer.charToId["."];
            const qId = this.tokenizer.charToId["?"];
            const exId = this.tokenizer.charToId["!"];
            if (bestId === dotId || bestId === qId || bestId === exId) {
                break;
            }
        }

        return {
            text: this.detokenize(outputIds),
            attention: activeModel.mha.lastAttnWeights, // UPGRADE #14: Attention Visualization
            klLoss: this.klLoss
        };
    }

    // NEW: Calculate TD-error for prioritization
    calculateTDError(text) {
        const tokens = this.tokenize(text);
        if (tokens.length < 2) return 0;

        const inputIds = tokens.slice(0, -1);
        const targetIds = tokens.slice(1);

        const logits = this.model.forward(inputIds);
        const seqLen = logits.shape[1];
        const vocabSize = logits.shape[2];

        let loss = 0;
        for (let t = 0; t < seqLen; t++) {
            const offset = t * vocabSize;
            const target = targetIds[t];

            let maxVal = -Infinity;
            for (let v = 0; v < vocabSize; v++) {
                if (logits.data[offset + v] > maxVal) maxVal = logits.data[offset + v];
            }

            let sumExp = 0;
            for (let v = 0; v < vocabSize; v++) {
                sumExp += Math.exp(logits.data[offset + v] - maxVal);
            }

            const logSumExp = Math.log(sumExp);
            loss -= (logits.data[offset + target] - maxVal - logSumExp);
        }

        return Math.abs(loss / seqLen); // TD-error is magnitude of surprise
    }

    addToReplay(text) {
        if (text.length > 2) { // Changed from split(' ').length > 2 for char-level
            // Calculate priority based on surprise (what it doesn't know)
            const tdError = this.calculateTDError(text);

            // “Passion hack”: boost replay priority for emotionally charged phrases.
            // We map this into the `uncertainty` channel used in the hybrid priority metric.
            const lower = String(text).toLowerCase();
            const emotionalKeywords = ["always", "never", "remember", "love"]; // from spec
            const hasEmotionalKeyword = emotionalKeywords.some((k) => lower.includes(k));
            const emotionBoost = hasEmotionalKeyword ? 1.0 : 0.0;

            this.replayBuffer.add(text, tdError, emotionBoost);
            this.tdErrors.set(text, tdError);
        }
    }

    rehearse() {
        const memory = this.replayBuffer.sample();
        if (!memory) return 0;

        // Calculate importance weight with bounds checking (CRITICAL FIX #5)
        const buffer = this.replayBuffer.buffer;
        const totalPriority = buffer.reduce((sum, item) => sum + item.priority, 0);

        // Guard against zero priority
        const prob = Math.max(memory.priority / (totalPriority + 1e-10), 1e-10);
        const rawWeight = Math.pow(buffer.length * prob, -this.beta);
        // Clamp to prevent extreme values that cause NaN propagation
        const importanceWeight = Math.min(rawWeight, 100.0);

        return this.trainStep(memory.text, 0, 1, true, importanceWeight);
    }

    // MODIFIED: Include KL divergence and consolidation
    trainStep(text, epoch = 0, totalEpochs = 1, isGameplay = false, importanceWeight = 1.0) {
        const tokens = this.tokenize(text);
        // Validate sequence length before processing (CRITICAL FIX #20)
        if (tokens.length < 2) {
            // Don't update optimizer state for invalid inputs
            return 0;
        }

        this.optimizer.zeroGrad();

        const inputIds = tokens.slice(0, -1);
        const targetIds = tokens.slice(1);

        const logits = this.model.forward(inputIds);
        const gradLogits = Tensor.zeros(logits.shape);
        let totalLoss = 0;

        const seqLen = logits.shape[1];
        const vocabSize = logits.shape[2];
        const scale = 1.0 / seqLen;

        for (let t = 0; t < seqLen; t++) {
            const offset = t * vocabSize;
            const target = targetIds[t];

            let maxVal = -Infinity;
            for (let v = 0; v < vocabSize; v++) {
                if (logits.data[offset + v] > maxVal) maxVal = logits.data[offset + v];
            }

            let sumExp = 0;
            for (let v = 0; v < vocabSize; v++) {
                sumExp += Math.exp(logits.data[offset + v] - maxVal);
            }

            const logSumExp = Math.log(sumExp);
            totalLoss -= (logits.data[offset + target] - maxVal - logSumExp);

            for (let v = 0; v < vocabSize; v++) {
                const prob = Math.exp(logits.data[offset + v] - maxVal) / sumExp;
                const grad = (v === target) ? (prob - 1.0) : prob;
                gradLogits.data[offset + v] = grad * scale * importanceWeight;
            }
        }

        this.model.backward(gradLogits);

        // KL DIVERGENCE for Bayesian layers (identity protection)
        this.klLoss = this.calculateKLDivergence();
        // Apply KL gradient would go here

        // CONSOLIDATION LOSS for important memories
        const consolidationLoss = this.consolidation.computeConsolidationLoss();

        const manualLr = isGameplay ? 0.1 : null;
        this.optimizer.step(epoch, totalEpochs, manualLr);

        // Keep shadow model updated for inference.
        this.updateEma();

        return (totalLoss / seqLen) + this.klLoss + consolidationLoss;
    }

    // NEW: Calculate KL divergence for Bayesian layers
    calculateKLDivergence() {
        // Note: `model.parameters()` returns Tensors, not layer instances.
        // So we explicitly query Bayesian layers on the model.
        let kl = 0;

        const maybeLayers = [this.model?.ff1];
        for (const layer of maybeLayers) {
            if (layer && typeof layer.klDivergence === 'function') {
                kl += layer.klDivergence();
            }
        }

        return kl;
    }

    // UPGRADE #20: Model Export (Safetensors)
    exportSafetensors() {
        const params = this.model.parameters();
        const paramNames = this.getSafetensorsParamNames();

        // Calculate total size and create header
        let dataOffset = 0;
        const header = {};
        const buffers = [];

        for (let i = 0; i < params.length; i++) {
            const name = paramNames[i] || `param_${i}`;
            const tensor = params[i];
            const buffer = tensor.data.buffer; // Float32Array buffer
            const length = buffer.byteLength;

            header[name] = {
                dtype: "F32",
                shape: tensor.shape,
                data_offsets: [dataOffset, dataOffset + length]
            };

            buffers.push(new Uint8Array(buffer));
            dataOffset += length;
        }

        // Create header JSON
        // Safetensors header is an 8-byte length (uint64) followed by JSON string
        // But for browser download, we can just construct the binary blob manually.
        // The standard format:
        // 8 bytes: N (size of header)
        // N bytes: JSON header
        // Rest: Data

        const jsonHeader = JSON.stringify(header);
        const jsonBytes = new TextEncoder().encode(jsonHeader);

        // Safetensors expects the header section to be padded so the data section starts on an 8-byte boundary.
        // We pad with spaces (0x20) and store the padded header length.
        const paddedHeaderLen = (jsonBytes.length + 7) & ~7;
        const paddedHeaderBytes = new Uint8Array(paddedHeaderLen);
        paddedHeaderBytes.fill(0x20);
        paddedHeaderBytes.set(jsonBytes);

        // Prefix with the length of the (padded) JSON header (u64, little-endian)
        const headerLengthBuffer = new BigUint64Array(1);
        headerLengthBuffer[0] = BigInt(paddedHeaderBytes.length);

        return new Blob([headerLengthBuffer, paddedHeaderBytes, ...buffers], { type: 'application/octet-stream' });
    }

    // NEW: Import weights from a safetensors file (ArrayBuffer)
    // Supports files exported by exportSafetensors() and most standard safetensors writers.
    importSafetensors(arrayBuffer) {
        if (!(arrayBuffer instanceof ArrayBuffer)) {
            throw new Error('importSafetensors expects an ArrayBuffer');
        }
        if (arrayBuffer.byteLength < 16) {
            throw new Error('Invalid safetensors: file too small');
        }

        const view = new DataView(arrayBuffer);
        let headerLen;
        if (typeof view.getBigUint64 === 'function') {
            headerLen = Number(view.getBigUint64(0, true));
        } else if (typeof view.getBigInt64 === 'function') {
            headerLen = Number(view.getBigInt64(0, true));
        } else {
            // Very old runtimes only. Interpret as two u32 little-endian.
            const lo = view.getUint32(0, true);
            const hi = view.getUint32(4, true);
            headerLen = lo + hi * 2 ** 32;
        }

        const headerStart = 8;
        const headerEnd = headerStart + headerLen;
        if (headerEnd > arrayBuffer.byteLength) {
            throw new Error('Invalid safetensors: header extends past end of file');
        }

        const headerBytes = new Uint8Array(arrayBuffer, headerStart, headerLen);
        const headerJson = new TextDecoder().decode(headerBytes);
        const header = JSON.parse(headerJson);

        const entries = Object.entries(header)
            .filter(([k]) => k !== '__metadata__')
            .map(([name, info]) => ({ name, info }));

        // Sort by data_offsets so we can fall back to positional loading if names don't match.
        const sortedByOffset = [...entries].sort((a, b) => {
            const ao = a.info?.data_offsets?.[0] ?? 0;
            const bo = b.info?.data_offsets?.[0] ?? 0;
            return ao - bo;
        });

        const params = this.model.parameters();
        const paramNames = this.getSafetensorsParamNames();
        const dataStart = headerEnd;

        let loaded = 0;
        for (let i = 0; i < params.length; i++) {
            const target = params[i];
            const expectedBytes = target.data.byteLength;

            const preferredName = paramNames[i];
            const byName = preferredName ? header[preferredName] : null;
            const byLegacy = header[`param_${i}`] || null;
            const byOrder = sortedByOffset[i]?.info || null;
            const info = byName || byLegacy || byOrder;

            if (!info || !info.data_offsets) continue;
            if (info.dtype && info.dtype !== 'F32') {
                // Currently we only support float32 weights.
                continue;
            }

            const start = dataStart + info.data_offsets[0];
            const end = dataStart + info.data_offsets[1];
            const length = end - start;
            if (length !== expectedBytes) {
                // Shape mismatch or different model layout; skip safely.
                continue;
            }
            if (start < 0 || end > arrayBuffer.byteLength) {
                continue;
            }

            if (start % 4 === 0) {
                const src = new Float32Array(arrayBuffer, start, length / 4);
                target.data.set(src);
            } else {
                // If the tensor starts at a non-4-byte-aligned offset (possible with non-padded headers),
                // copy to a fresh buffer so TypedArray alignment requirements are satisfied.
                const bytes = new Uint8Array(arrayBuffer, start, length);
                const copied = bytes.slice().buffer;
                const src = new Float32Array(copied);
                target.data.set(src);
            }
            loaded++;
        }

        // Keep EMA in sync after import.
        this.syncEmaFromModel();

        return { loaded, total: params.length };
    }

    // UPGRADE #5: Persistent Memory with IndexedDB
    async saveCheckpoint(profileKey = this.profileKey) {
        if (!globalThis.indexedDB) return;

        const key = String(profileKey || '').trim() || 'latest';

        return new Promise((resolve, reject) => {
            const dbRequest = indexedDB.open('lullaby-memory', 1);

            dbRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('checkpoints')) {
                    db.createObjectStore('checkpoints');
                }
            };

            dbRequest.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['checkpoints'], 'readwrite');
                const store = transaction.objectStore('checkpoints');

                // Serialize weights
                const weights = this.model.parameters().map(p => p.data);

                const putRequest = store.put({
                    weights: weights,
                    buffer: this.replayBuffer.buffer, // Save the inner array
                    optimizer: this.optimizer.serialize(),
                    timestamp: Date.now()
                }, key);

                // HIGH FIX #13: Properly await transaction completion
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };

            dbRequest.onerror = () => reject(dbRequest.error);
        });
    }

    async loadCheckpoint(profileKey = this.profileKey) {
        if (!globalThis.indexedDB) return false;

        const key = String(profileKey || '').trim() || 'latest';

        return new Promise((resolve) => {
            const dbRequest = indexedDB.open('lullaby-memory', 1);

            dbRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('checkpoints')) {
                    db.createObjectStore('checkpoints');
                }
            };

            dbRequest.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['checkpoints'], 'readonly');
                const store = transaction.objectStore('checkpoints');
                const request = store.get(key);

                request.onsuccess = () => {
                    const data = request.result;
                    if (data) {
                        // Restore weights
                        const params = this.model.parameters();
                        for (let i = 0; i < params.length; i++) {
                            if (data.weights[i]) {
                                params[i].data.set(data.weights[i]);
                            }
                        }

                        // Keep EMA in sync with restored model.
                        this.syncEmaFromModel();

                        // Restore buffer
                        if (data.buffer) {
                            this.replayBuffer.buffer = data.buffer; // Restore the inner array
                        }

                        // Restore optimizer state
                        if (data.optimizer && this.optimizer) {
                            this.optimizer.loadState(data.optimizer);
                        }
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                };

                request.onerror = () => resolve(false);
            };

            dbRequest.onerror = () => resolve(false);
        });
    }

    async deleteCheckpoint(profileKey = this.profileKey) {
        if (!globalThis.indexedDB) return false;

        const key = String(profileKey || '').trim() || 'latest';
        return new Promise((resolve) => {
            const dbRequest = indexedDB.open('lullaby-memory', 1);

            dbRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('checkpoints')) {
                    db.createObjectStore('checkpoints');
                }
            };

            dbRequest.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['checkpoints'], 'readwrite');
                const store = transaction.objectStore('checkpoints');
                const req = store.delete(key);
                req.onsuccess = () => resolve(true);
                req.onerror = () => resolve(false);
            };

            dbRequest.onerror = () => resolve(false);
        });
    }
}
