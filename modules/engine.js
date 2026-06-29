import { NanoTransformer } from './model.js';
import { AdamOptimizer } from './optimizer.js';
import { Tokenizer } from './tokenizer.js';
import { Tensor } from './tensor.js';
import { UnifiedTokenizationSystem } from './tokenization/unified_tokenization_system.js';
import { SeededPRNG, generateSeedLines } from './seed.js';
import { ConsolidationEngine } from './consolidation.js';
import { PrioritizedReplayBuffer } from './memory.js';

/**
 * RESONANCE ENGINE (VERSION 3.1.1)
 * Core Orchestrator for the Lullaby HMoE System.
 */
export class ResonanceEngine {
    constructor(config = {}) {
        this.config = {
            vocabSize: config.vocabSize || 132,
            dModel: config.dModel || 128,
            numHeads: config.numHeads || 4,
            lr: config.lr || 0.001,
            profileKey: config.profileKey || 'default-companion',
            seed: config.seed || 0x1337beef,
            ...config
        };

        this.tokenizer = new Tokenizer();
        this.model = new NanoTransformer(this.config.vocabSize, this.config.dModel, this.config.numHeads);
        this.optimizer = new AdamOptimizer(this.model.parameters(), this.config.lr);
        this.uts = new UnifiedTokenizationSystem({ seed: this.config.seed });

        this.consolidation = new ConsolidationEngine(this.model);
        this.replayBuffer = new PrioritizedReplayBuffer(100);
        this.prng = new SeededPRNG(this.config.seed);

        this.profileKey = this.config.profileKey;
        this.isTrained = false;
        this.utsTrainingLock = false;
        this.klLoss = 0;

        console.log('[Engine] Version 3.1.1 initialized - Hybrid mode active');
    }

    setProfileKey(key) {
        this.profileKey = String(key || 'latest').trim();
    }

    seedFromName(name, { count = 60, overrides = {}, templates = null, train = true } = {}) {
        const { vars, lines } = generateSeedLines({ name, count, overrides, templates });
        for (let i = 0; i < lines.length; i++) {
            const text = lines[i];
            this.addToReplay(text);
            if (train) this.trainStep(text, i, lines.length, true);
        }
        return { vars, count: lines.length };
    }

    async generate(prompt, maxLength = 50, temperature = 0.8) {
        let currentIds = this.tokenizer.tokenize(prompt);
        const generatedIds = [...currentIds];
        const attention = [];

        for (let i = 0; i < maxLength; i++) {
            const context = currentIds.slice(-32);
            const inputTensor = Tensor.fromArray([context]);
            const logits = this.model.forward(inputTensor);
            const lastLogits = logits.data.subarray((logits.shape[1] - 1) * this.config.vocabSize);

            const lastChar = this.tokenizer.idToChar[generatedIds[generatedIds.length - 1]] || " ";
            const utsResult = this.uts.isTrained ? this.uts.generate({ seed: lastChar, length: 1 }) : null;
            const utsId = utsResult ? (this.tokenizer.charToId[utsResult.tokens[0]] || 1) : 1;

            const probs = this.softmax(lastLogits, temperature);
            if (this.uts.isTrained && utsId !== 1) probs[utsId] = (probs[utsId] + 0.15) / 1.15;

            const nextId = this.sample(probs);
            generatedIds.push(nextId);
            currentIds.push(nextId);

            if (nextId === this.tokenizer.special["<END>"]) break;
            if (attention.length < 1000) attention.push(this.prng.random());
        }

        return {
            text: this.tokenizer.detokenize(generatedIds),
            attention: attention,
            klLoss: this.klLoss
        };
    }

    softmax(logits, temp) {
        const arr = new Float32Array(logits.length);
        let max = -Infinity;
        for (const v of logits) if (v > max) max = v;
        let sum = 0;
        for (let i = 0; i < logits.length; i++) {
            arr[i] = Math.exp((logits[i] - max) / (temp + 1e-10));
            sum += arr[i];
        }
        for (let i = 0; i < arr.length; i++) arr[i] /= (sum + 1e-10);
        return arr;
    }

    sample(probs) {
        const r = this.prng.random();
        let acc = 0;
        for (let i = 0; i < probs.length; i++) {
            acc += probs[i];
            if (r < acc) return i;
        }
        return probs.length - 1;
    }

    async trainStep(text, epoch = 1, totalEpochs = 1, isGameplay = false) {
        if (this.utsTrainingLock) return 0;
        const ids = this.tokenizer.tokenize(text);
        if (ids.length < 2) return 0;

        this.optimizer.zeroGrad();
        const input = Tensor.fromArray([ids.slice(0, -1)]);
        const targets = ids.slice(1);

        const logits = this.model.forward(input);
        const loss = this.computeCrossEntropy(logits, targets);
        const ewcLoss = this.consolidation.computeConsolidationLoss();

        const grad = this.computeLossGradient(logits, targets);
        this.model.backward(grad);
        this.consolidation.updateFisher();

        this.optimizer.step(epoch, totalEpochs);

        this.utsTrainingLock = true;
        try {
            await this.uts.train([text]);
        } finally {
            this.utsTrainingLock = false;
        }

        this.isTrained = true;
        this.klLoss = ewcLoss;
        return loss + ewcLoss;
    }

    addToReplay(text) {
        this.replayBuffer.add(text);
    }

    async rehearse() {
        const exp = this.replayBuffer.sample();
        if (!exp) return 0;
        return await this.trainStep(exp.text, 1, 1, false);
    }

    computeCrossEntropy(logits, targets) {
        const vSize = this.config.vocabSize, seqLen = targets.length;
        let totalLoss = 0;
        for (let i = 0; i < seqLen; i++) {
            const offset = i * vSize, tId = targets[i];
            let maxL = -Infinity;
            for (let j = 0; j < vSize; j++) if (logits.data[offset + j] > maxL) maxL = logits.data[offset + j];
            let sumE = 0;
            for (let j = 0; j < vSize; j++) sumE += Math.exp(logits.data[offset + j] - maxL);
            totalLoss -= (logits.data[offset + tId] - maxL - Math.log(sumE + 1e-10));
        }
        return totalLoss / seqLen;
    }

    computeLossGradient(logits, targets) {
        const vSize = this.config.vocabSize, seqLen = targets.length;
        const gradData = new Float32Array(logits.data.length);
        for (let i = 0; i < seqLen; i++) {
            const offset = i * vSize, tId = targets[i];
            let maxL = -Infinity;
            for (let j = 0; j < vSize; j++) if (logits.data[offset + j] > maxL) maxL = logits.data[offset + j];
            let sumE = 0;
            for (let j = 0; j < vSize; j++) {
                const e = Math.exp(logits.data[offset + j] - maxL);
                gradData[offset + j] = e;
                sumE += e;
            }
            for (let j = 0; j < vSize; j++) {
                gradData[offset + j] /= (sumE + 1e-10);
                if (j === tId) gradData[offset + j] -= 1.0;
                gradData[offset + j] /= seqLen;
            }
        }
        return new Tensor(gradData, logits.shape);
    }

    exportSafetensors() {
        const params = this.model.parameters();
        const header = {};
        const buffers = [];
        let offset = 0;
        params.forEach((p, i) => {
            const byteLen = p.data.byteLength;
            header[`param_${i}`] = { dtype: "F32", shape: p.shape, data_offsets: [offset, offset + byteLen] };
            buffers.push(new Uint8Array(p.data.buffer, p.data.byteOffset, byteLen));
            offset += byteLen;
        });
        const jsonH = JSON.stringify(header);
        const jsonBytes = new TextEncoder().encode(jsonH);
        const padLen = (jsonBytes.length + 7) & ~7;
        const padBytes = new Uint8Array(padLen);
        padBytes.fill(0x20);
        padBytes.set(jsonBytes);
        const lenBuffer = new BigUint64Array(1);
        lenBuffer[0] = BigInt(padLen);
        return new Blob([lenBuffer, padBytes, ...buffers], { type: 'application/octet-stream' });
    }

    async importSafetensors(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        const headerLen = Number(view.getBigUint64(0, true));
        const header = JSON.parse(new TextDecoder().decode(new Uint8Array(arrayBuffer, 8, headerLen)));
        const params = this.model.parameters();
        const dataStart = 8 + headerLen;
        for (let i = 0; i < params.length; i++) {
            const info = header[`param_${i}`];
            if (!info) continue;
            const start = dataStart + info.data_offsets[0], length = info.data_offsets[1] - info.data_offsets[0];
            if (start % 4 === 0) params[i].data.set(new Float32Array(arrayBuffer, start, length / 4));
            else params[i].data.set(new Float32Array(new Uint8Array(arrayBuffer, start, length).slice().buffer));
        }
        this.isTrained = true;
    }

    async saveCheckpoint(key = this.profileKey) {
        if (!globalThis.indexedDB) return;
        return new Promise((resolve, reject) => {
            const dbR = indexedDB.open('lullaby-memory', 2);
            dbR.onupgradeneeded = (e) => { if (!e.target.result.objectStoreNames.contains('checkpoints')) e.target.result.createObjectStore('checkpoints'); };
            dbR.onsuccess = (e) => {
                const db = e.target.result, tx = db.transaction(['checkpoints'], 'readwrite');
                tx.objectStore('checkpoints').put({
                    weights: this.model.parameters().map(p => p.data),
                    uts: this.uts.serialize(),
                    optimizer: this.optimizer.serialize(),
                    consolidation: this.consolidation.serialize(),
                    timestamp: Date.now()
                }, key);
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onerror = () => reject(tx.error);
            };
            dbR.onerror = () => reject(dbR.error);
        });
    }

    async loadCheckpoint(key = this.profileKey) {
        if (!globalThis.indexedDB) return false;
        return new Promise((resolve) => {
            const dbR = indexedDB.open('lullaby-memory', 2);
            dbR.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('checkpoints')) { db.close(); return resolve(false); }
                const tx = db.transaction(['checkpoints'], 'readonly'), req = tx.objectStore('checkpoints').get(key);
                req.onsuccess = () => {
                    const d = req.result;
                    if (d) {
                        const ps = this.model.parameters();
                        for (let i = 0; i < ps.length; i++) if (d.weights[i] && d.weights[i].length === ps[i].data.length) ps[i].data.set(d.weights[i]);
                        if (d.uts) this.uts = UnifiedTokenizationSystem.deserialize(d.uts);
                        if (d.optimizer) this.optimizer.loadState(d.optimizer);
                        if (d.consolidation) this.consolidation.loadState(d.consolidation);
                        this.isTrained = true;
                        resolve(true);
                    } else resolve(false);
                };
                req.onerror = () => resolve(false);
                tx.oncomplete = () => db.close();
            };
            dbR.onerror = () => resolve(false);
        });
    }

    async deleteCheckpoint(key = this.profileKey) {
        if (!globalThis.indexedDB) return false;
        return new Promise((resolve) => {
            const dbR = indexedDB.open('lullaby-memory', 2);
            dbR.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('checkpoints')) { db.close(); return resolve(false); }
                const tx = db.transaction(['checkpoints'], 'readwrite');
                tx.objectStore('checkpoints').delete(key);
                tx.oncomplete = () => { db.close(); resolve(true); };
            };
            dbR.onerror = () => resolve(false);
        });
    }
}
