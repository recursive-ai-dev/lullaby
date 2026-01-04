import fs from 'fs';
import path from 'path';

// Minimal IndexedDB Polyfill backed by filesystem
// This allows ResonanceEngine to run in Node.js without modification
// Data is stored in ./.checkpoints/lullaby-memory.json

const CHECKPOINT_DIR = path.join(process.cwd(), '.checkpoints');
const DB_FILE = path.join(CHECKPOINT_DIR, 'lullaby-memory.json');

if (!fs.existsSync(CHECKPOINT_DIR)) {
    fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
}

class IDBRequest {
    constructor() {
        this.onsuccess = null;
        this.onerror = null;
        this.result = null;
        this.error = null;
        this.transaction = null;
    }

    triggerSuccess(result) {
        this.result = result;
        if (this.onsuccess) {
            this.onsuccess({ target: this });
        }
    }

    triggerError(error) {
        this.error = error;
        if (this.onerror) {
            this.onerror({ target: this });
        }
    }
}

class IDBTransaction {
    constructor(db, mode) {
        this.db = db;
        this.mode = mode;
        this.objectStoreNames = db.objectStoreNames;
        this.oncomplete = null;
        this.onerror = null;
    }

    objectStore(name) {
        return new IDBObjectStore(this.db, name, this);
    }
}

class IDBObjectStore {
    constructor(db, name, transaction) {
        this.db = db;
        this.name = name;
        this.transaction = transaction;
    }

    put(value, key) {
        const req = new IDBRequest();
        setTimeout(() => {
            try {
                this.db._data[this.name][key] = value;
                this.db._save();
                req.triggerSuccess(key);
                if (this.transaction.oncomplete) this.transaction.oncomplete();
            } catch (e) {
                req.triggerError(e);
            }
        }, 10);
        return req;
    }

    get(key) {
        const req = new IDBRequest();
        setTimeout(() => {
            try {
                const val = this.db._data[this.name][key];
                req.triggerSuccess(val);
            } catch (e) {
                req.triggerError(e);
            }
        }, 10);
        return req;
    }

    delete(key) {
        const req = new IDBRequest();
        setTimeout(() => {
            try {
                delete this.db._data[this.name][key];
                this.db._save();
                req.triggerSuccess();
            } catch (e) {
                req.triggerError(e);
            }
        }, 10);
        return req;
    }
}

class IDBDatabase {
    constructor(name) {
        this.name = name;
        this.objectStoreNames = {
            contains: (n) => !!this._data[n],
            _list: []
        };
        this._data = {};
        this._load();
    }

    _load() {
        try {
            if (fs.existsSync(DB_FILE)) {
                const raw = fs.readFileSync(DB_FILE, 'utf-8');
                // We need to handle Float32Array deserialization if we were storing JSON
                // But IDB stores structured clones.
                // For this polyfill, we will assume simple JSON for metadata,
                // but weights need special handling if we want them to persist properly.
                // However, JSON.stringify converts TypedArrays to objects or arrays.
                // Let's rely on the fact that `weights` in ResonanceEngine is an array of Float32Arrays.
                // We need to revive them.
                const parsed = JSON.parse(raw);
                this._data = parsed;

                // Revive TypedArrays in checkpoints
                if (this._data['checkpoints']) {
                    for (const key in this._data['checkpoints']) {
                        const checkpoint = this._data['checkpoints'][key];
                        if (checkpoint.weights) {
                            checkpoint.weights = checkpoint.weights.map(w => {
                                // if it's an object with keys like '0': 1, etc.
                                return new Float32Array(Object.values(w));
                            });
                        }
                    }
                }
                this.objectStoreNames._list = Object.keys(this._data);
            }
        } catch (e) {
            console.error('Failed to load DB:', e);
            this._data = {};
        }
    }

    _save() {
        try {
            // Serialize
            // JSON.stringify will convert Float32Array to standard object/array
            fs.writeFileSync(DB_FILE, JSON.stringify(this._data, null, 2));
        } catch (e) {
            console.error('Failed to save DB:', e);
        }
    }

    createObjectStore(name) {
        if (!this._data[name]) {
            this._data[name] = {};
            this.objectStoreNames._list.push(name);
        }
        return new IDBObjectStore(this, name, null);
    }

    transaction(names, mode) {
        return new IDBTransaction(this, mode);
    }
}

const indexedDB = {
    open: (name, version) => {
        const req = new IDBRequest();
        setTimeout(() => {
            const db = new IDBDatabase(name);
            const event = { target: { result: db } };

            // Simulate upgradeneeded if stores don't exist
            if (!db._data['checkpoints']) {
               if(req.onupgradeneeded) {
                   req.onupgradeneeded(event);
               }
            }

            req.triggerSuccess(db);
        }, 10);
        return req;
    }
};

export default indexedDB;
