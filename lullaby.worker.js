const DEBUG_MODE = false;
import { ResonanceEngine } from './modules/engine.js';

// ==========================================
// 6. WORKER MESSAGE HANDLING
// ==========================================
let engine = null;
let profileKey = 'latest';
let persistenceEnabled = true;

const PROTOCOL_VERSION = 1;
const canceledRequestIds = new Set();

function normalizeIncomingMessage(data) {
    // Supports legacy: { type, payload }
    // Supports v1+: { v, requestId, type, payload }
    if (!data || typeof data !== 'object') {
        return { v: 0, requestId: null, type: null, payload: null };
    }
    return {
        v: Number.isFinite(data.v) ? data.v : 0,
        requestId: (typeof data.requestId === 'string' && data.requestId) ? data.requestId : null,
        type: typeof data.type === 'string' ? data.type : null,
        payload: data.payload ?? null,
    };
}

function post(type, payload, requestId, v) {
    self.postMessage({
        v: Number.isFinite(v) ? v : PROTOCOL_VERSION,
        requestId: (typeof requestId === 'string' && requestId) ? requestId : null,
        type,
        payload: payload ?? null,
    });
}

function postError(message, { requestId, v, originalType } = {}) {
    // Always emit a user-safe message. Avoid leaking internal details.
    const safeMessage = 'AI core error. Please try again.';
    post(
        'WORKER_ERROR',
        {
            message: safeMessage,
            originalType: originalType || null,
        },
        requestId || null,
        v
    );
}

function isCanceled(requestId) {
    return Boolean(requestId) && canceledRequestIds.has(requestId);
}

self.onmessage = async (e) => {
    const { v, requestId, type, payload } = normalizeIncomingMessage(e.data);

    try {
        switch (type) {
            case 'CANCEL': {
                const cancelId = typeof payload?.requestId === 'string' ? payload.requestId : requestId;
                if (cancelId) {
                    canceledRequestIds.add(cancelId);
                    // Best-effort cleanup to avoid unbounded growth.
                    setTimeout(() => canceledRequestIds.delete(cancelId), 30_000);
                }
                post('CANCELLED', { requestId: cancelId || null }, requestId, v);
                break;
            }

            case 'INIT': {
                engine = new ResonanceEngine();
                profileKey = String(payload?.profileKey || 'latest');
                persistenceEnabled = Boolean(payload?.persistenceEnabled ?? true);
                engine.setProfileKey(profileKey);
                const loaded = persistenceEnabled ? await engine.loadCheckpoint(profileKey) : false;
                post('INIT_COMPLETE', { loaded, profileKey, persistenceEnabled }, requestId, v);
                break;
            }

            case 'SET_PERSISTENCE': {
                persistenceEnabled = Boolean(payload?.enabled);
                if (!engine) engine = new ResonanceEngine();
                profileKey = String(payload?.profileKey || profileKey || 'latest');
                engine.setProfileKey(profileKey);
                const loaded = persistenceEnabled ? await engine.loadCheckpoint(profileKey) : false;
                post('PERSISTENCE_SET', { enabled: persistenceEnabled, loaded, profileKey }, requestId, v);
                break;
            }

            case 'SET_PROFILE': {
                if (!engine) engine = new ResonanceEngine();
                profileKey = String(payload?.profileKey || 'latest');
                engine.setProfileKey(profileKey);
                const loaded = persistenceEnabled ? await engine.loadCheckpoint(profileKey) : false;
                post('PROFILE_SET', { loaded, profileKey }, requestId, v);
                break;
            }

            case 'RESET_PROFILE': {
                if (!engine) engine = new ResonanceEngine();
                profileKey = String(payload?.profileKey || profileKey || 'latest');
                engine.setProfileKey(profileKey);
                const deleted = persistenceEnabled ? await engine.deleteCheckpoint(profileKey) : false;
                engine = new ResonanceEngine();
                engine.setProfileKey(profileKey);
                post('PROFILE_RESET', { deleted, profileKey }, requestId, v);
                break;
            }

            case 'SEED': {
                if (!engine) return;
                if (isCanceled(requestId)) return;
                const name = payload?.name;
                const count = payload?.count;
                const templates = Array.isArray(payload?.templates) ? payload.templates : null;
                const result = engine.seedFromName(name, { count, train: true, overrides: payload?.overrides || {}, templates });
                if (persistenceEnabled) await engine.saveCheckpoint(profileKey);
                if (isCanceled(requestId)) return;
                post('SEED_COMPLETE', { ...result, profileKey, klLoss: engine.klLoss }, requestId, v);
                break;
            }

            case 'TRAIN': {
                if (!engine) return;
                if (isCanceled(requestId)) return;
                const loss = engine.trainStep(payload.text, payload.epoch, payload.totalEpochs, payload.isGameplay);
                engine.addToReplay(payload.text);

                // HIGH FIX #14: Properly handle checkpoint save errors
                if (persistenceEnabled && Math.random() < 0.1) {
                    engine.saveCheckpoint().catch((err) => {
                        // Report error to main thread instead of silently ignoring
                        post('SAVE_ERROR', {
                            message: err?.message || 'Checkpoint save failed',
                            context: 'background_save'
                        }, null, v);
                    });
                }

                if (isCanceled(requestId)) return;
                post('TRAIN_COMPLETE', { loss, klLoss: engine.klLoss }, requestId, v);
                break;
            }

            case 'GENERATE': {
                if (!engine) return;
                if (isCanceled(requestId)) return;
                const result = engine.generate(payload.seed, payload.steps, payload.temperature);
                if (isCanceled(requestId)) return;
                post('GENERATE_COMPLETE', result, requestId, v);
                break;
            }

            case 'REHEARSE': {
                if (!engine) return;
                if (isCanceled(requestId)) return;
                const replayLoss = engine.rehearse();
                if (isCanceled(requestId)) return;
                post('REHEARSE_COMPLETE', { loss: replayLoss }, requestId, v);
                break;
            }

            case 'SAVE': {
                if (!engine) return;
                if (persistenceEnabled) await engine.saveCheckpoint(profileKey);
                post('SAVE_COMPLETE', null, requestId, v);
                break;
            }

            case 'EXPORT': {
                if (!engine) return;
                const blob = engine.exportSafetensors();
                post('EXPORT_COMPLETE', blob, requestId, v);
                break;
            }

            case 'IMPORT': {
                if (!engine) return;
                const result = engine.importSafetensors(payload.buffer);
                if (persistenceEnabled) await engine.saveCheckpoint(profileKey);
                post('IMPORT_COMPLETE', result, requestId, v);
                break;
            }

            default: {
                postError('Unknown worker message type', { requestId, v, originalType: type || null });
                break;
            }
        }
    } catch (err) {
        postError(err?.message || String(err), { requestId, v, originalType: type || null });
    }
};

// Best-effort global error reporting so the UI can stay usable even if something
// throws outside the message handler.
self.addEventListener('error', (ev) => {
    try {
        postError(ev?.message || 'Worker error', { requestId: null, v: PROTOCOL_VERSION, originalType: null });
    } catch (e) { if (DEBUG_MODE) console.warn(e);
        // ignore
    }
});

self.addEventListener('unhandledrejection', (ev) => {
    try {
        const reason = ev?.reason;
        const msg = (reason && typeof reason === 'object' && 'message' in reason) ? reason.message : String(reason || 'Unhandled rejection');
        postError(msg, { requestId: null, v: PROTOCOL_VERSION, originalType: null });
    } catch (e) { if (DEBUG_MODE) console.warn(e);
        // ignore
    }
});
