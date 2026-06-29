const DEBUG_MODE = false;
// Conversation persistence (optional): localStorage or IndexedDB.
// UI-only module.

const DB_NAME = 'lullaby-conversations';
const DB_VERSION = 3;
const STORE_SCHEMA_VERSION = 3;

const LOCAL_INDEX_KEY = 'lullaby.conversations.index';

function nowMs() {
    return Date.now();
}

function safeJsonParse(str, fallback) {
    try {
        return JSON.parse(str);
    } catch (e) { if (DEBUG_MODE) console.warn(e);
        return fallback;
    }
}

function makeId(prefix = 'id') {
    return `${prefix}_${nowMs()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeConversationMeta(convo) {
    const id = typeof convo?.id === 'string' ? convo.id : makeId('convo');
    const createdAt = Number.isFinite(convo?.createdAt) ? convo.createdAt : nowMs();
    const updatedAt = Number.isFinite(convo?.updatedAt) ? convo.updatedAt : createdAt;
    const title = (typeof convo?.title === 'string' && convo.title.trim()) ? convo.title.trim() : 'Conversation';
    return {
        id,
        title,
        createdAt,
        updatedAt,
        schemaVersion: STORE_SCHEMA_VERSION,
    };
}

function normalizeMessage(conversationId, msg) {
    const role = (typeof msg?.role === 'string' && msg.role) ? msg.role : (typeof msg?.source === 'string' ? msg.source : null);
    const text = (typeof msg?.text === 'string') ? msg.text : (typeof msg?.content === 'string' ? msg.content : '');

    const createdAt = Number.isFinite(msg?.createdAt)
        ? msg.createdAt
        : (Number.isFinite(msg?.timestamp) ? msg.timestamp : nowMs());

    const id = (typeof msg?.id === 'string' && msg.id)
        ? msg.id
        : `${String(conversationId || 'convo')}:${createdAt}:${Math.random().toString(16).slice(2)}`;

    // Stored/app-level message schema (v3): {id, role, text, createdAt}
    return {
        id,
        role,
        text,
        createdAt,
    };
}

function normalizeStoredMessages(conversationId, raw) {
    // v1 legacy: array of messages {id, conversationId, role, text, timestamp}
    // v2: { v: 2, messages: [...] }
    // v3: { v: 3, messages: [{id, role, text, createdAt}] }
    if (Array.isArray(raw)) {
        return {
            v: STORE_SCHEMA_VERSION,
            messages: raw
                .filter(Boolean)
                .map((m) => normalizeMessage(conversationId, { ...m, createdAt: m?.createdAt ?? m?.timestamp })),
        };
    }

    if (raw && typeof raw === 'object') {
        const v = Number.isFinite(raw.v) ? raw.v : 1;
        const arr = Array.isArray(raw.messages) ? raw.messages : [];
        return {
            v: STORE_SCHEMA_VERSION,
            messages: arr
                .filter(Boolean)
                .map((m) => normalizeMessage(conversationId, { ...m, createdAt: m?.createdAt ?? m?.timestamp })),
        };
    }

    return { v: STORE_SCHEMA_VERSION, messages: [] };
}

function openIdb() {
    if (!globalThis.indexedDB) {
        return Promise.reject(new Error('IndexedDB not available'));
    }

    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (ev) => {
            const db = ev.target.result;

            if (!db.objectStoreNames.contains('conversations')) {
                db.createObjectStore('conversations', { keyPath: 'id' });
            }

            if (!db.objectStoreNames.contains('messages')) {
                const store = db.createObjectStore('messages', { keyPath: 'id' });
                store.createIndex('byConversation', 'conversationId', { unique: false });
                store.createIndex('byConversationTime', ['conversationId', 'timestamp'], { unique: false });
                store.createIndex('byConversationCreatedAt', ['conversationId', 'createdAt'], { unique: false });
            } else {
                // v2 adds a createdAt index (messages will also keep timestamp for compatibility).
                try {
                    const store = ev.target.transaction.objectStore('messages');
                    if (store && !store.indexNames.contains('byConversationCreatedAt')) {
                        store.createIndex('byConversationCreatedAt', ['conversationId', 'createdAt'], { unique: false });
                    }
                } catch (e) { if (DEBUG_MODE) console.warn(e);
                    // Best-effort: if the store isn't available here, ignore.
                }
            }

            if (!db.objectStoreNames.contains('meta')) {
                db.createObjectStore('meta', { keyPath: 'key' });
            }

            // Best-effort schema version marker.
            try {
                const meta = ev.target.transaction.objectStore('meta');
                meta.put({ key: 'schemaVersion', value: STORE_SCHEMA_VERSION, updatedAt: nowMs() });
            } catch (e) { if (DEBUG_MODE) console.warn(e);
                // ignore
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
    });
}

async function idbEnsureConversationOnDb(db, { conversationId, title }) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['conversations'], 'readwrite');
        const store = tx.objectStore('conversations');

        const id = conversationId || makeId('convo');
        const getReq = store.get(id);

        getReq.onsuccess = () => {
            if (getReq.result) {
                resolve({ db, conversationId: id });
                return;
            }

            store.put(normalizeConversationMeta({ id, title }));
            resolve({ db, conversationId: id });
        };

        getReq.onerror = () => reject(getReq.error || new Error('Failed to ensure conversation'));
    });
}

async function idbEnsureConversation({ conversationId, title, db } = {}) {
    const dbConn = db || await openIdb();
    return idbEnsureConversationOnDb(dbConn, { conversationId, title });
}

async function idbListConversations(db, { limit = 50 } = {}) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['conversations'], 'readonly');
        const store = tx.objectStore('conversations');
        const out = [];

        store.openCursor().onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (!cursor) {
                out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                resolve(out.slice(0, Math.max(0, limit)));
                return;
            }
            out.push(normalizeConversationMeta(cursor.value));
            cursor.continue();
        };

        tx.onerror = () => reject(tx.error || new Error('Failed to list conversations'));
        tx.onabort = () => reject(tx.error || new Error('Failed to list conversations'));
    });
}

async function idbRenameConversation(db, conversationId, title) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['conversations'], 'readwrite');
        const store = tx.objectStore('conversations');
        const req = store.get(conversationId);

        req.onsuccess = () => {
            const existing = req.result;
            const next = normalizeConversationMeta({
                ...(existing || {}),
                id: conversationId,
                title: String(title || '').trim() || (existing?.title || 'Conversation'),
                updatedAt: nowMs(),
            });
            store.put(next);
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Failed to rename conversation'));
        tx.onabort = () => reject(tx.error || new Error('Failed to rename conversation'));
    });
}

async function idbDeleteConversation(db, conversationId) {
    // Deletes conversation record + all messages in it.
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['messages', 'conversations'], 'readwrite');
        const messages = tx.objectStore('messages');
        const conversations = tx.objectStore('conversations');

        try {
            const idx = messages.index('byConversation');
            const range = IDBKeyRange.only(conversationId);
            idx.openCursor(range).onsuccess = (ev) => {
                const cursor = ev.target.result;
                if (!cursor) return;
                cursor.delete();
                cursor.continue();
            };
        } catch (e) { if (DEBUG_MODE) console.warn(e);
            // ignore
        }

        conversations.delete(conversationId);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Failed to delete conversation'));
        tx.onabort = () => reject(tx.error || new Error('Failed to delete conversation'));
    });
}

async function idbAppendMessage(db, conversationId, { role, text, timestamp, createdAt }) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['messages', 'conversations'], 'readwrite');
        const messages = tx.objectStore('messages');
        const conversations = tx.objectStore('conversations');

        const ts = Number.isFinite(createdAt)
            ? createdAt
            : (Number.isFinite(timestamp) ? timestamp : nowMs());

        const normalized = normalizeMessage(conversationId, { role, text, createdAt: ts });

        // Keep conversationId/timestamp for indexing, but keep the message payload schema stable.
        messages.put({
            ...normalized,
            conversationId,
            timestamp: normalized.createdAt,
            schemaVersion: STORE_SCHEMA_VERSION,
        });

        // Best-effort conversation updatedAt
        const convoGet = conversations.get(conversationId);
        convoGet.onsuccess = () => {
            const convo = convoGet.result;
            if (convo) {
                convo.updatedAt = ts;
                convo.schemaVersion = STORE_SCHEMA_VERSION;
                conversations.put(convo);
            }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Failed to append message'));
        tx.onabort = () => reject(tx.error || new Error('Failed to append message'));
    });
}

async function idbLoadMessages(db, conversationId, { limit = 500 } = {}) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['messages'], 'readonly');
        const store = tx.objectStore('messages');

        // Prefer createdAt index if present; fallback to timestamp index.
        const idx = store.indexNames.contains('byConversationCreatedAt')
            ? store.index('byConversationCreatedAt')
            : store.index('byConversationTime');

        const range = IDBKeyRange.bound([conversationId, 0], [conversationId, Number.MAX_SAFE_INTEGER]);
        const out = [];

        idx.openCursor(range, 'next').onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (!cursor) {
                // keep last `limit` messages
                resolve(out.slice(Math.max(0, out.length - limit)));
                return;
            }

            out.push(cursor.value);
            cursor.continue();
        };

        tx.onerror = () => reject(tx.error || new Error('Failed to load messages'));
    });
}

function localEnsureConversation({ conversationId } = {}) {
    const id = conversationId || localStorage.getItem('lullaby.convo.active') || makeId('convo');
    localStorage.setItem('lullaby.convo.active', id);

    const key = `lullaby.convo.${id}`;
    if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify({ v: STORE_SCHEMA_VERSION, messages: [] }));
    } else {
        // Best-effort migration.
        try {
            const parsed = safeJsonParse(localStorage.getItem(key) || 'null', null);
            const normalized = normalizeStoredMessages(id, parsed);
            localStorage.setItem(key, JSON.stringify(normalized));
        } catch (e) { if (DEBUG_MODE) console.warn(e);
            // ignore
        }
    }

    // Best-effort: ensure this convo exists in the local index.
    try {
        const idxRaw = localStorage.getItem(LOCAL_INDEX_KEY);
        const idxParsed = safeJsonParse(idxRaw || 'null', null);
        const index = (idxParsed && typeof idxParsed === 'object' && Array.isArray(idxParsed.conversations))
            ? idxParsed
            : { v: STORE_SCHEMA_VERSION, conversations: [] };
        index.v = STORE_SCHEMA_VERSION;
        const existing = index.conversations.find((c) => c && c.id === id);
        if (!existing) {
            index.conversations.unshift(normalizeConversationMeta({ id }));
        }
        localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify(index));
    } catch (e) { if (DEBUG_MODE) console.warn(e);
        // ignore
    }

    return { conversationId: id };
}

function localLoadConversationIndex() {
    const parsed = safeJsonParse(localStorage.getItem(LOCAL_INDEX_KEY) || 'null', null);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.conversations)) {
        return {
            v: STORE_SCHEMA_VERSION,
            conversations: parsed.conversations
                .filter(Boolean)
                .map(normalizeConversationMeta),
        };
    }
    return { v: STORE_SCHEMA_VERSION, conversations: [] };
}

function localSaveConversationIndex(index) {
    localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify({
        v: STORE_SCHEMA_VERSION,
        conversations: Array.isArray(index?.conversations) ? index.conversations.map(normalizeConversationMeta) : [],
    }));
}

function localUpsertConversationMeta(meta) {
    const m = normalizeConversationMeta(meta);
    const index = localLoadConversationIndex();
    const without = index.conversations.filter((c) => c && c.id !== m.id);
    without.unshift(m);
    localSaveConversationIndex({ conversations: without.slice(0, 100) });
    return m;
}

function localRenameConversation(conversationId, title) {
    const id = String(conversationId || '').trim();
    if (!id) throw new Error('conversationId required');
    const nextTitle = String(title || '').trim();
    if (!nextTitle) throw new Error('title required');
    localUpsertConversationMeta({ id, title: nextTitle, updatedAt: nowMs() });
}

function localDeleteConversation(conversationId) {
    const id = String(conversationId || '').trim();
    if (!id) throw new Error('conversationId required');

    // Remove message payload.
    try {
        localStorage.removeItem(`lullaby.convo.${id}`);
    } catch (e) { if (DEBUG_MODE) console.warn(e);
        // ignore
    }

    // Remove from index.
    try {
        const index = localLoadConversationIndex();
        const filtered = index.conversations.filter((c) => c && c.id !== id);
        localSaveConversationIndex({ conversations: filtered });
    } catch (e) { if (DEBUG_MODE) console.warn(e);
        // ignore
    }

    const active = localStorage.getItem('lullaby.convo.active') || '';
    if (active === id) {
        // Select another conversation or create a new one.
        const remaining = localListConversations({ limit: 1 });
        if (remaining.length) {
            localSetActiveConversation(remaining[0].id);
        } else {
            localCreateConversation({ title: 'Conversation' });
        }
    }
}

function localListConversations({ limit = 50 } = {}) {
    const index = localLoadConversationIndex();
    const out = index.conversations.slice();
    out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return out.slice(0, Math.max(0, limit));
}

function localCreateConversation({ title } = {}) {
    const id = makeId('convo');
    localStorage.setItem('lullaby.convo.active', id);
    const key = `lullaby.convo.${id}`;
    localStorage.setItem(key, JSON.stringify({ v: STORE_SCHEMA_VERSION, messages: [] }));
    const now = nowMs();
    localUpsertConversationMeta({ id, title: title || 'Conversation', createdAt: now, updatedAt: now });
    return { conversationId: id };
}

function localSetActiveConversation(conversationId) {
    const id = String(conversationId || '').trim();
    if (!id) throw new Error('conversationId required');
    localEnsureConversation({ conversationId: id });
    localStorage.setItem('lullaby.convo.active', id);
    return { conversationId: id };
}

function localAppendMessage(conversationId, { role, text, timestamp, createdAt }) {
    const key = `lullaby.convo.${conversationId}`;
    const parsed = safeJsonParse(localStorage.getItem(key) || 'null', null);
    const normalizedStore = normalizeStoredMessages(conversationId, parsed);

    const ts = Number.isFinite(createdAt)
        ? createdAt
        : (Number.isFinite(timestamp) ? timestamp : nowMs());
    const msg = normalizeMessage(conversationId, { role, text, createdAt: ts });
    normalizedStore.messages.push(msg);

    // Keep a reasonable size.
    if (normalizedStore.messages.length > 1000) {
        normalizedStore.messages.splice(0, normalizedStore.messages.length - 1000);
    }
    localStorage.setItem(key, JSON.stringify(normalizedStore));

    // Update index updatedAt.
    try {
        localUpsertConversationMeta({ id: conversationId, updatedAt: msg.createdAt });
    } catch (e) { if (DEBUG_MODE) console.warn(e);
        // ignore
    }
}

function localLoadMessages(conversationId, { limit = 500 } = {}) {
    const key = `lullaby.convo.${conversationId}`;
    const parsed = safeJsonParse(localStorage.getItem(key) || 'null', null);
    const normalizedStore = normalizeStoredMessages(conversationId, parsed);
    // Best-effort migration to latest schema.
    try {
        const needsMigration =
            !parsed ||
            Array.isArray(parsed) ||
            (parsed && typeof parsed === 'object' && parsed.v !== STORE_SCHEMA_VERSION) ||
            normalizedStore.messages.some((m) => m && typeof m === 'object' && 'conversationId' in m);

        if (needsMigration) {
            localStorage.setItem(key, JSON.stringify(normalizedStore));
        }
    } catch (e) { if (DEBUG_MODE) console.warn(e);
        // ignore
    }
    const msgs = normalizedStore.messages;
    return msgs.slice(Math.max(0, msgs.length - limit));
}

export function createConversationStore(mode) {
    // Supports:
    // - createConversationStore('off' | 'local' | 'idb')
    // - createConversationStore(customAdapter)
    // - createConversationStore('custom', customAdapter)
    const customAdapter = arguments.length >= 2 ? arguments[1] : null;

    const normalizeAdapter = (adapter) => {
        if (!adapter || typeof adapter !== 'object') return null;

        const init = typeof adapter.init === 'function' ? adapter.init.bind(adapter) : async () => {};
        const ensureActiveConversation = typeof adapter.ensureActiveConversation === 'function'
            ? adapter.ensureActiveConversation.bind(adapter)
            : null;
        const loadMessages = typeof adapter.loadMessages === 'function' ? adapter.loadMessages.bind(adapter) : null;
        const appendMessage = typeof adapter.appendMessage === 'function' ? adapter.appendMessage.bind(adapter) : null;

        const listConversations = typeof adapter.listConversations === 'function'
            ? adapter.listConversations.bind(adapter)
            : null;
        const createConversation = typeof adapter.createConversation === 'function'
            ? adapter.createConversation.bind(adapter)
            : null;
        const setActiveConversation = typeof adapter.setActiveConversation === 'function'
            ? adapter.setActiveConversation.bind(adapter)
            : null;

        if (!ensureActiveConversation || !loadMessages || !appendMessage) return null;

        return {
            mode: adapter.mode ? String(adapter.mode) : 'custom',
            init,
            ensureActiveConversation,
            loadMessages,
            appendMessage,
            ...(listConversations ? { listConversations } : {}),
            ...(createConversation ? { createConversation } : {}),
            ...(setActiveConversation ? { setActiveConversation } : {}),
        };
    };

    // If you pass an adapter directly, use it.
    if (mode && typeof mode === 'object') {
        const normalized = normalizeAdapter(mode);
        if (normalized) return normalized;
    }

    const m = String(mode || 'off').toLowerCase();

    // If you pass mode='custom' with an adapter, use it.
    if (m === 'custom') {
        const normalized = normalizeAdapter(customAdapter);
        if (normalized) return normalized;
        return {
            mode: 'off',
            async init() {},
            async ensureActiveConversation() {
                return { db: null, conversationId: null };
            },
            async loadMessages() {
                return [];
            },
            async appendMessage() {},
        };
    }

    if (m === 'idb') {
        return {
            mode: 'idb',
            async init() {
                // Open once to ensure schema exists.
                const db = await openIdb();
                db.close();
            },
            async ensureActiveConversation() {
                const existing = localStorage.getItem('lullaby.convo.active') || null;
                const { db, conversationId } = await idbEnsureConversation({ conversationId: existing || undefined });
                localStorage.setItem('lullaby.convo.active', conversationId);
                return { db, conversationId };
            },
            async listConversations(db, opts) {
                const dbConn = db || await openIdb();
                return idbListConversations(dbConn, opts);
            },
            async createConversation(db, { title } = {}) {
                const dbConn = db || await openIdb();
                const { conversationId } = await idbEnsureConversation({ db: dbConn, conversationId: undefined, title: title || 'Conversation' });
                localStorage.setItem('lullaby.convo.active', conversationId);
                return { db: dbConn, conversationId };
            },
            async setActiveConversation(db, conversationId) {
                const dbConn = db || await openIdb();
                const { conversationId: ensuredId } = await idbEnsureConversation({ db: dbConn, conversationId });
                localStorage.setItem('lullaby.convo.active', ensuredId);
                return { db: dbConn, conversationId: ensuredId };
            },
            async renameConversation(db, conversationId, title) {
                const dbConn = db || await openIdb();
                await idbRenameConversation(dbConn, conversationId, title);
            },
            async deleteConversation(db, conversationId) {
                const dbConn = db || await openIdb();
                await idbDeleteConversation(dbConn, conversationId);

                const active = localStorage.getItem('lullaby.convo.active') || null;
                if (active === conversationId) {
                    const remaining = await idbListConversations(dbConn, { limit: 1 });
                    if (remaining.length) {
                        localStorage.setItem('lullaby.convo.active', remaining[0].id);
                        return { db: dbConn, conversationId: remaining[0].id };
                    }

                    const created = await idbEnsureConversation({ db: dbConn, conversationId: undefined, title: 'Conversation' });
                    localStorage.setItem('lullaby.convo.active', created.conversationId);
                    return { db: dbConn, conversationId: created.conversationId };
                }

                return { db: dbConn, conversationId: active };
            },
            async loadMessages(db, conversationId, opts) {
                const raw = await idbLoadMessages(db, conversationId, opts);
                return raw
                    .filter(Boolean)
                    .map((m) => normalizeMessage(conversationId, { ...m, createdAt: m?.createdAt ?? m?.timestamp }));
            },
            async appendMessage(db, conversationId, msg) {
                return idbAppendMessage(db, conversationId, msg);
            },
        };
    }

    if (m === 'local') {
        return {
            mode: 'local',
            async init() {},
            async ensureActiveConversation() {
                const { conversationId } = localEnsureConversation({});
                return { db: null, conversationId };
            },
            async listConversations(_db, opts) {
                return localListConversations(opts);
            },
            async createConversation(_db, { title } = {}) {
                const { conversationId } = localCreateConversation({ title: title || 'Conversation' });
                return { db: null, conversationId };
            },
            async setActiveConversation(_db, conversationId) {
                const { conversationId: id } = localSetActiveConversation(conversationId);
                return { db: null, conversationId: id };
            },
            async renameConversation(_db, conversationId, title) {
                return localRenameConversation(conversationId, title);
            },
            async deleteConversation(_db, conversationId) {
                const activeBefore = localStorage.getItem('lullaby.convo.active') || null;
                localDeleteConversation(conversationId);
                const activeAfter = localStorage.getItem('lullaby.convo.active') || null;
                if (activeBefore === conversationId) {
                    return { db: null, conversationId: activeAfter };
                }
                return { db: null, conversationId: activeAfter };
            },
            async loadMessages(_db, conversationId, opts) {
                return localLoadMessages(conversationId, opts);
            },
            async appendMessage(_db, conversationId, msg) {
                return localAppendMessage(conversationId, msg);
            },
        };
    }

    return {
        mode: 'off',
        async init() {},
        async ensureActiveConversation() {
            return { db: null, conversationId: null };
        },
        async loadMessages() {
            return [];
        },
        async appendMessage() {},
    };
}
