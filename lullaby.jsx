import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { MessageCircle, Activity, Cpu, Database, Wifi, Zap, Heart, Sparkles, Lock, Unlock, Eye, Moon, Save, Layers, Download, Upload, Star, Flame, ChevronDown, ChevronUp, Eraser, Fingerprint, X } from 'lucide-react';
import { createConversationStore } from './modules/conversation_store.js';

// Immersive environment components
import NightSky from './src/components/NightSky';
import Mountains from './src/components/Mountains';
import Campfire from './src/components/Campfire';
import Evergreen from './src/components/Evergreen';

/**
 * LULLABY CORE - 3AM CAMPFIRE EDITION ✨
 * Like meeting your girlfriend at a campfire in Jasper at 3am
 * 
 * Now featuring:
 * - Dancing aurora borealis
 * - Rare shooting stars (dopamine triggers)
 * - Floating campfire embers
 * - Multi-layer mountain depth
 * - Atmospheric moon and mist
 */

export default function NeuralTerminal() {
    const SHOW_SYSTEM_MESSAGES = false;

    const [logs, setLogs] = useState([]);
    const [inputVal, setInputVal] = useState('');
    const [isBooting, setIsBooting] = useState(true);
    const [isComputing, setIsComputing] = useState(false);
    const [stats, setStats] = useState({ loss: 5.0, klLoss: 0.0, bootProgress: 0, currentPhase: 'INIT', epochs: 0 });
    const [lossHistory, setLossHistory] = useState(() => Array.from({ length: 20 }, () => ({ val: 5.0 })));
    const [isRehearsing, setIsRehearsing] = useState(false);
    const [attentionWeights, setAttentionWeights] = useState(null); // UPGRADE #14: Attention Visualization
    const [workerStatus, setWorkerStatus] = useState('OFFLINE');

    // Non-blocking toast notifications (errors, status).
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);
    const pushToast = (kind, text, { ms = 4500 } = {}) => {
        const message = String(text || '').trim();
        if (!message) return;
        const id = `${Date.now()}_${toastIdRef.current++}`;
        setToasts((prev) => [...prev, { id, kind: kind || 'info', text: message }].slice(-4));
        window.setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, Math.max(1200, Number(ms) || 0));
    };

    // Conversation threads (only when dbMode is local/idb)
    const [threadsOpen, setThreadsOpen] = useState(false);
    const [threads, setThreads] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [renamingThreadId, setRenamingThreadId] = useState(null);
    const [renameDraft, setRenameDraft] = useState('');

    // DB mode:
    // - off: no persistence
    // - local: conversation history in localStorage
    // - idb: conversation history in IndexedDB
    // - checkpoints: model checkpoint persistence (worker IndexedDB)
    const [dbMode, setDbMode] = useState(() => {
        try {
            return localStorage.getItem('lullaby.dbMode') || 'checkpoints';
        } catch {
            return 'checkpoints';
        }
    });

    // Training is always-on for a simpler, more natural experience.
    const trainingMode = 'train';
    const [profileKey, setProfileKey] = useState(() => {
        try {
            return localStorage.getItem('lullaby.profileKey') || 'latest';
        } catch {
            return 'latest';
        }
    });

    const [avatarFailed, setAvatarFailed] = useState(false);

    // Custom datasets (template sets) stored locally.
    const [customDatasets, setCustomDatasets] = useState(() => {
        try {
            const raw = localStorage.getItem('lullaby.customDatasets');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    });
    const [selectedDatasetId, setSelectedDatasetId] = useState(() => {
        try {
            return localStorage.getItem('lullaby.selectedDatasetId') || '';
        } catch {
            return '';
        }
    });
    const [datasetDraftName, setDatasetDraftName] = useState('');
    const [datasetDraftText, setDatasetDraftText] = useState('');
    const [seedTargetName, setSeedTargetName] = useState(() => {
        try {
            return localStorage.getItem('lullaby.seedTargetName') || 'Emma';
        } catch {
            return 'Emma';
        }
    });
    const [datasetsPanelOpen, setDatasetsPanelOpen] = useState(() => {
        try {
            const raw = localStorage.getItem('lullaby.datasetsPanelOpen');
            if (raw === null) return false; // default minimized
            return raw === 'true';
        } catch {
            return false;
        }
    });

    const datasetTrainingRef = useRef({ active: false });
    const datasetTrainQueueRef = useRef([]);
    const datasetTrainEpochRef = useRef(0);
    const datasetTrainTotalRef = useRef(0);
    const [datasetTraining, setDatasetTraining] = useState({ active: false, name: '', done: 0, total: 0 });
    const [showDevTools, setShowDevTools] = useState(false);
    const [devTrainText, setDevTrainText] = useState('');

    const [memoriesStatus, setMemoriesStatus] = useState('');
    const setMemoriesStatusTransient = (text, ms = 3500) => {
        const msg = String(text || '').trim();
        setMemoriesStatus(msg);
        if (!msg) return;
        window.setTimeout(() => setMemoriesStatus(''), ms);
    };

    const workerRef = useRef(null);
    const protocolRef = useRef({ v: 1 });
    const lastGenerateRequestIdRef = useRef(null);
    const lastTrainRequestIdRef = useRef(null);
    const importFileRef = useRef(null);
    const datasetImportFileRef = useRef(null);
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    const conversationRef = useRef({ store: createConversationStore('off'), db: null, conversationId: null });

    const refreshThreads = async () => {
        const { store, db, conversationId } = conversationRef.current;
        if (!store || !(dbMode === 'local' || dbMode === 'idb')) {
            setThreads([]);
            setActiveConversationId(null);
            return;
        }

        if (typeof store.listConversations !== 'function') {
            setThreads([]);
            setActiveConversationId(conversationId || null);
            return;
        }

        try {
            const list = await store.listConversations(db, { limit: 50 });
            setThreads(Array.isArray(list) ? list : []);
            setActiveConversationId(conversationId || null);
        } catch {
            setThreads([]);
            setActiveConversationId(conversationId || null);
        }
    };

    const startRenameConversation = (thread) => {
        if (!thread?.id) return;
        setRenamingThreadId(thread.id);
        setRenameDraft(String(thread.title || 'Conversation'));
    };

    const cancelRenameConversation = () => {
        setRenamingThreadId(null);
        setRenameDraft('');
    };

    const commitRenameConversation = async () => {
        const { store, db } = conversationRef.current;
        const id = String(renamingThreadId || '').trim();
        const title = String(renameDraft || '').trim();
        if (!id || !title) {
            cancelRenameConversation();
            return;
        }

        if (!store || typeof store.renameConversation !== 'function') {
            cancelRenameConversation();
            return;
        }

        try {
            await store.renameConversation(db, id, title);
            cancelRenameConversation();
            await refreshThreads();
        } catch {
            addLog('sys', 'FAILED TO RENAME CONVERSATION.');
            pushToast('error', 'Failed to rename conversation.');
        }
    };

    const deleteConversationById = async (id) => {
        const { store, db } = conversationRef.current;
        if (!store || typeof store.deleteConversation !== 'function') return;
        const convoId = String(id || '').trim();
        if (!convoId) return;

        const ok = window.confirm('Delete this conversation?');
        if (!ok) return;

        try {
            const result = await store.deleteConversation(db, convoId);

            // If the deleted convo was active, store returns a new active convoId.
            const nextId = result?.conversationId || conversationRef.current.conversationId;
            conversationRef.current.db = result?.db ?? conversationRef.current.db;
            conversationRef.current.conversationId = nextId || null;
            setActiveConversationId(nextId || null);

            if (nextId) {
                const persisted = await store.loadMessages(conversationRef.current.db, nextId, { limit: 500 });
                setLogs((persisted || []).map(m => ({
                    source: m.role,
                    text: m.text,
                    timestamp: new Date(m.createdAt ?? m.timestamp ?? Date.now()).toLocaleTimeString()
                })));
            } else {
                setLogs([]);
            }

            cancelRenameConversation();
            await refreshThreads();
        } catch {
            addLog('sys', 'FAILED TO DELETE CONVERSATION.');
            pushToast('error', 'Failed to delete conversation.');
        }
    };

    const switchConversation = async (nextId) => {
        const { store, db } = conversationRef.current;
        if (!store || typeof store.setActiveConversation !== 'function') return;
        const id = String(nextId || '').trim();
        if (!id) return;

        try {
            const { db: nextDb, conversationId } = await store.setActiveConversation(db, id);
            conversationRef.current.db = nextDb;
            conversationRef.current.conversationId = conversationId;
            setActiveConversationId(conversationId);

            const persisted = await store.loadMessages(nextDb, conversationId, { limit: 500 });
            setLogs((persisted || []).map(m => ({
                source: m.role,
                text: m.text,
                timestamp: new Date(m.createdAt ?? m.timestamp ?? Date.now()).toLocaleTimeString()
            })));

            setThreadsOpen(false);
            await refreshThreads();
        } catch {
            addLog('sys', 'FAILED TO SWITCH CONVERSATIONS.');
            pushToast('error', 'Failed to switch conversations.');
        }
    };

    const createNewConversation = async () => {
        const { store, db } = conversationRef.current;
        if (!store || typeof store.createConversation !== 'function') return;

        try {
            const { db: nextDb, conversationId } = await store.createConversation(db, { title: 'Conversation' });
            conversationRef.current.db = nextDb;
            conversationRef.current.conversationId = conversationId;
            setActiveConversationId(conversationId);
            setLogs([]);
            setThreadsOpen(false);
            await refreshThreads();
        } catch {
            addLog('sys', 'FAILED TO CREATE CONVERSATION.');
            pushToast('error', 'Failed to create conversation.');
        }
    };

    const makeRequestId = (prefix = 'req') => {
        return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    };

    const postToWorker = (type, payload, opts = {}) => {
        const worker = workerRef.current;
        if (!worker) return null;
        const requestId = typeof opts.requestId === 'string' && opts.requestId ? opts.requestId : makeRequestId(type.toLowerCase());
        worker.postMessage({ v: protocolRef.current.v, requestId, type, payload });
        return requestId;
    };

    const createAndWireWorker = () => {
        // Initialize Web Worker as module so ESM imports load correctly.
        const worker = new Worker(new URL('./lullaby.worker.js', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        setWorkerStatus('CONNECTING');

        worker.onerror = () => {
            setWorkerStatus('ERROR');
            setIsBooting(false);
            setIsComputing(false);
            pushToast('error', 'AI core crashed. Click “restart core” to recover.');
            addLog('sys', 'AI CORE CRASHED. CLICK “RESTART CORE” TO RECOVER.');
        };

        worker.onmessageerror = () => {
            setWorkerStatus('ERROR');
            setIsBooting(false);
            setIsComputing(false);
            pushToast('error', 'AI core sent an invalid message. Click “restart core” to recover.');
            addLog('sys', 'AI CORE MESSAGE ERROR. CLICK “RESTART CORE” TO RECOVER.');
        };

        worker.onmessage = (e) => {
            const { type, payload, requestId } = e.data || {};

            switch (type) {
                case 'WORKER_ERROR':
                    setWorkerStatus('ERROR');
                    setIsBooting(false);
                    setIsComputing(false);
                    pushToast('error', payload?.message || 'AI core error. Please try again.');
                    addLog('sys', `${payload?.message || 'AI core error. Please try again.'}`);
                    break;

                case 'INIT_COMPLETE':
                    setWorkerStatus('ONLINE');
                    setIsBooting(false);
                    if (payload?.profileKey) setProfileKey(payload.profileKey);
                    addLog('sys', `CORE ONLINE. PROFILE: ${payload?.profileKey || 'latest'}. PERSISTENCE: ${payload?.persistenceEnabled ? (payload.loaded ? 'RESTORED' : 'NEW') : 'OFF'}`);
                    break;

                case 'PERSISTENCE_SET':
                    addLog('sys', `CORE PERSISTENCE: ${payload?.enabled ? (payload?.loaded ? 'ON (LOADED)' : 'ON (EMPTY)') : 'OFF'}`);
                    break;

                case 'PROFILE_SET':
                    if (payload?.profileKey) {
                        setProfileKey(payload.profileKey);
                        try { localStorage.setItem('lullaby.profileKey', payload.profileKey); } catch { }
                    }
                    addLog('sys', `PROFILE SET: ${payload?.profileKey || 'latest'} (${payload?.loaded ? 'LOADED' : 'EMPTY'})`);
                    break;

                case 'PROFILE_RESET':
                    if (payload?.profileKey) {
                        setProfileKey(payload.profileKey);
                        try { localStorage.setItem('lullaby.profileKey', payload.profileKey); } catch { }
                    }
                    addLog('sys', `PROFILE RESET: ${payload?.profileKey || 'latest'} (${payload?.deleted ? 'CLEARED' : 'NOOP'})`);
                    break;

                case 'SEED_COMPLETE':
                    if (typeof payload?.klLoss === 'number') {
                        setStats(prev => ({ ...prev, klLoss: payload.klLoss }));
                    }
                    addLog('sys', `SEEDED ${payload?.count ?? 0} LINES FOR: ${payload?.vars?.name || 'UNKNOWN'} (PROFILE: ${payload?.profileKey || 'latest'})`);
                    setMemoriesStatusTransient(`memories added (${payload?.count ?? 0})`, 4500);
                    break;

                case 'TRAIN_COMPLETE':
                    // Ignore stale training completions if multiple are in-flight.
                    if (lastTrainRequestIdRef.current && requestId && requestId !== lastTrainRequestIdRef.current) break;
                    updateStats(payload.loss, payload.klLoss);
                    if (datasetTrainingRef.current?.active) {
                        const next = datasetTrainQueueRef.current.shift();
                        const done = datasetTrainTotalRef.current - datasetTrainQueueRef.current.length;
                        setDatasetTraining((prev) => ({ ...prev, done, total: datasetTrainTotalRef.current }));

                        if (next) {
                            datasetTrainEpochRef.current = done;
                            const reqId = postToWorker('TRAIN', { text: next, epoch: datasetTrainEpochRef.current, totalEpochs: datasetTrainTotalRef.current, isGameplay: false });
                            lastTrainRequestIdRef.current = reqId;
                        } else {
                            datasetTrainingRef.current = { active: false };
                            setDatasetTraining({ active: false, name: '', done: 0, total: 0 });
                            setIsComputing(false);
                            addLog('sys', 'MEMORIES SETTLED.');
                        }
                    } else {
                        setIsComputing(false);
                    }
                    break;

                case 'GENERATE_COMPLETE':
                    // Ignore stale generation results.
                    if (lastGenerateRequestIdRef.current && requestId && requestId !== lastGenerateRequestIdRef.current) break;
                    addLog('ai', payload.text);
                    if (payload.attention) {
                        setAttentionWeights(payload.attention);
                    }
                    if (typeof payload.klLoss === 'number') {
                        setStats(prev => ({ ...prev, klLoss: payload.klLoss }));
                    }
                    setIsComputing(false);
                    break;

                case 'REHEARSE_COMPLETE':
                    setIsRehearsing(false);
                    break;

                case 'SAVE_COMPLETE':
                    addLog('sys', 'MEMORY SAVED TO DISK.');
                    setMemoriesStatusTransient('saved');
                    break;

                case 'EXPORT_COMPLETE':
                    // Create download link
                    {
                        const blob = payload;
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `lullaby_model_${Date.now()}.safetensors`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        addLog('sys', 'MODEL EXPORTED SUCCESSFULLY.');
                    }
                    break;

                case 'IMPORT_COMPLETE':
                    addLog('sys', `MODEL IMPORTED. LOADED: ${payload.loaded}/${payload.total}`);
                    setMemoriesStatusTransient('model loaded');
                    break;

                case 'IMPORT_ERROR':
                    pushToast('error', payload?.message || 'Import failed');
                    addLog('sys', `IMPORT FAILED: ${payload.message}`);
                    break;
            }
        };

        return worker;
    };

    const restartCore = () => {
        pushToast('info', 'Restarting AI core…', { ms: 1800 });
        try { workerRef.current?.terminate(); } catch { }
        setIsBooting(true);
        setIsComputing(false);
        lastGenerateRequestIdRef.current = null;
        lastTrainRequestIdRef.current = null;
        createAndWireWorker();

        // Re-init core without reloading conversations.
        postToWorker('INIT', { profileKey, persistenceEnabled: dbMode === 'checkpoints' }, { requestId: makeRequestId('init') });
    };

    useEffect(() => {
        try { localStorage.setItem('lullaby.customDatasets', JSON.stringify(customDatasets)); } catch { }
    }, [customDatasets]);

    useEffect(() => {
        try { localStorage.setItem('lullaby.selectedDatasetId', selectedDatasetId || ''); } catch { }
    }, [selectedDatasetId]);

    useEffect(() => {
        try { localStorage.setItem('lullaby.seedTargetName', seedTargetName || ''); } catch { }
    }, [seedTargetName]);

    useEffect(() => {
        try { localStorage.setItem('lullaby.datasetsPanelOpen', String(Boolean(datasetsPanelOpen))); } catch { }
    }, [datasetsPanelOpen]);

    const parseDatasetLines = (text) => {
        const lines = String(text || '')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 200)
            .map((l) => l.slice(0, 200));
        return lines;
    };

    const parseJsonlToLines = (jsonlText) => {
        const rawLines = String(jsonlText || '')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);

        const out = [];
        for (const line of rawLines) {
            if (out.length >= 200) break;
            try {
                const obj = JSON.parse(line);
                if (typeof obj === 'string') {
                    const s = obj.trim();
                    if (s) out.push(s.slice(0, 200));
                    continue;
                }
                if (obj && typeof obj === 'object') {
                    // Support common JSONL formats:
                    // - {text}
                    // - {prompt, completion}
                    // - {instruction, input, output}
                    // - {messages:[{role, content}]}
                    // - {conversations:[{from,value}]}
                    const msgLines = Array.isArray(obj.messages)
                        ? obj.messages
                            .map((m) => (typeof m?.content === 'string' ? m.content : (typeof m?.text === 'string' ? m.text : '')))
                            .map((s) => String(s || '').trim())
                            .filter(Boolean)
                        : [];

                    const convoLines = Array.isArray(obj.conversations)
                        ? obj.conversations
                            .map((m) => (typeof m?.value === 'string' ? m.value : ''))
                            .map((s) => String(s || '').trim())
                            .filter(Boolean)
                        : [];

                    let candidate = '';
                    if (msgLines.length) {
                        candidate = msgLines.join('\n');
                    } else if (convoLines.length) {
                        candidate = convoLines.join('\n');
                    } else {
                        const prompt = (typeof obj.prompt === 'string' && obj.prompt) || '';
                        const completion = (typeof obj.completion === 'string' && obj.completion) || '';
                        const instruction = (typeof obj.instruction === 'string' && obj.instruction) || '';
                        const input = (typeof obj.input === 'string' && obj.input) || '';
                        const output = (typeof obj.output === 'string' && obj.output) || '';

                        candidate =
                            (typeof obj.text === 'string' && obj.text) ||
                            (typeof obj.template === 'string' && obj.template) ||
                            (typeof obj.content === 'string' && obj.content) ||
                            ((prompt || completion) ? `${prompt}${completion ? `\n${completion}` : ''}` : '') ||
                            ((instruction || input || output)
                                ? `${instruction}${input ? `\n${input}` : ''}${output ? `\n${output}` : ''}`
                                : '');
                    }

                    const s = String(candidate || '').trim();
                    if (s) out.push(s.slice(0, 200));
                }
            } catch {
                // Ignore invalid JSON line.
            }
        }
        return out;
    };

    const datasetNameFromFilename = (filename) => {
        const base = String(filename || 'dataset').split(/[/\\]/).pop() || 'dataset';
        return base.replace(/\.(jsonl|json)$/i, '').trim() || 'dataset';
    };

    const handleDatasetImportClick = () => {
        datasetImportFileRef.current?.click();
    };

    const handleDatasetImportFile = async (e) => {
        const file = e.target.files?.[0];
        // Allow importing the same file twice.
        try { e.target.value = ''; } catch { }
        if (!file) return;

        try {
            const text = await file.text();
            const templates = parseJsonlToLines(text);
            if (!templates.length) {
                addLog('sys', `DATASET IMPORT FAILED: no usable lines found in ${file.name}`);
                setMemoriesStatusTransient('nothing usable in that file');
                pushToast('error', `No usable lines found in “${file.name}”.`);
                return;
            }
            const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
            const name = datasetNameFromFilename(file.name);
            setCustomDatasets((prev) => [{ id, name, templates }, ...prev]);
            setSelectedDatasetId(id);
            addLog('sys', `DATASET IMPORTED: ${name} (${templates.length} LINES)`);
            setMemoriesStatusTransient(`imported “${name}” (${templates.length})`, 4500);
        } catch (err) {
            const msg = err?.message || String(err);
            addLog('sys', `DATASET IMPORT FAILED: ${msg}`);
            setMemoriesStatusTransient('import failed');
            pushToast('error', `Dataset import failed: ${msg}`);
        }
    };

    const addCustomDataset = () => {
        const name = String(datasetDraftName || '').trim();
        const templates = parseDatasetLines(datasetDraftText);

        if (!name) {
            addLog('sys', 'DATASET NAME REQUIRED.');
            setMemoriesStatusTransient('add a title first');
            return;
        }
        if (!templates.length) {
            addLog('sys', 'DATASET NEEDS AT LEAST 1 LINE.');
            setMemoriesStatusTransient('add at least one line');
            return;
        }

        const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const next = [{ id, name, templates }, ...customDatasets];
        setCustomDatasets(next);
        setSelectedDatasetId(id);
        setDatasetDraftName('');
        setDatasetDraftText('');
        addLog('sys', `DATASET ADDED: ${name} (${templates.length} LINES)`);
        setMemoriesStatusTransient(`saved “${name}” (${templates.length})`, 4500);
    };

    const removeCustomDataset = (id) => {
        const removed = customDatasets.find((d) => d.id === id);
        setCustomDatasets((prev) => prev.filter((d) => d.id !== id));
        if (selectedDatasetId === id) setSelectedDatasetId('');
        if (removed?.name) addLog('sys', `DATASET REMOVED: ${removed.name}`);
        if (removed?.name) setMemoriesStatusTransient(`removed “${removed.name}”`);
    };

    const seedFromSelectedDataset = () => {
        const dataset = customDatasets.find((d) => d.id === selectedDatasetId);
        if (!dataset) {
            addLog('sys', 'SELECT A DATASET FIRST.');
            setMemoriesStatusTransient('choose a memory set');
            return;
        }
        const name = String(seedTargetName || '').trim() || 'Emma';
        const templates = Array.isArray(dataset.templates) ? dataset.templates : [];
        if (!templates.length) {
            addLog('sys', 'SELECTED DATASET IS EMPTY.');
            setMemoriesStatusTransient('that memory set is empty');
            return;
        }

        const count = templates.length;
        addLog('sys', `SEEDING DATASET: ${dataset.name} → ${name} (${count} LINES)...`);
        setMemoriesStatusTransient('listening…', 8000);
        postToWorker('SEED', { name, count, templates });
    };

    const startTeachingSelectedDataset = () => {
        const dataset = customDatasets.find((d) => d.id === selectedDatasetId);
        if (!dataset) {
            addLog('sys', 'SELECT A MEMORY SET FIRST.');
            setMemoriesStatusTransient('choose a memory set');
            return;
        }
        const lines = Array.isArray(dataset.templates) ? dataset.templates.filter(Boolean) : [];
        if (!lines.length) {
            addLog('sys', 'SELECTED MEMORY SET IS EMPTY.');
            setMemoriesStatusTransient('that memory set is empty');
            return;
        }
        if (!workerRef.current) return;

        datasetTrainQueueRef.current = [...lines];
        datasetTrainEpochRef.current = 0;
        datasetTrainTotalRef.current = lines.length;
        datasetTrainingRef.current = { active: true };
        setDatasetTraining({ active: true, name: dataset.name || 'memories', done: 0, total: lines.length });
        setIsComputing(true);
        addLog('sys', `LISTENING: ${dataset.name || 'memories'} (${lines.length} LINES)...`);
        setMemoriesStatusTransient('teaching…', 12000);

        const first = datasetTrainQueueRef.current.shift();
        if (!first) {
            datasetTrainingRef.current = { active: false };
            setDatasetTraining({ active: false, name: '', done: 0, total: 0 });
            setIsComputing(false);
            return;
        }
        workerRef.current.postMessage({
            v: protocolRef.current.v,
            requestId: makeRequestId('train_dataset'),
            type: 'TRAIN',
            payload: { text: first, epoch: 0, totalEpochs: datasetTrainTotalRef.current, isGameplay: false }
        });
    };

    // --- WORKER INITIALIZATION ---
    useEffect(() => {
        createAndWireWorker();

        // Start Boot Sequence
        const bootSequence = async () => {
            // Initialize optional conversation store first (so chat can restore before sys logs).
            const store = createConversationStore(dbMode);
            conversationRef.current.store = store;
            conversationRef.current.db = null;
            conversationRef.current.conversationId = null;

            if (dbMode === 'local' || dbMode === 'idb') {
                try {
                    await store.init();
                    const { db, conversationId } = await store.ensureActiveConversation();
                    conversationRef.current.db = db;
                    conversationRef.current.conversationId = conversationId;
                    setActiveConversationId(conversationId);

                    const persisted = await store.loadMessages(db, conversationId, { limit: 500 });
                    if (persisted?.length) {
                        setLogs(persisted.map(m => ({
                            source: m.role,
                            text: m.text,
                            timestamp: new Date(m.createdAt ?? m.timestamp ?? Date.now()).toLocaleTimeString()
                        })));
                    }

                    await refreshThreads();
                } catch {
                    // If convo store fails, keep running raw.
                }
            }

            addLog('sys', 'INITIALIZING WORKER THREAD...');
            await new Promise(r => setTimeout(r, 500));

            if (dbMode === 'idb' || dbMode === 'checkpoints') {
                addLog('sys', 'MOUNTING INDEXEDDB...');
            } else if (dbMode === 'local') {
                addLog('sys', 'MOUNTING LOCAL STORAGE...');
            } else {
                addLog('sys', 'RUNNING RAW (NO DATABASE)...');
            }

            // Tell worker to init (checkpoint persistence only in checkpoints mode)
            postToWorker('INIT', { profileKey, persistenceEnabled: dbMode === 'checkpoints' }, { requestId: makeRequestId('init') });
        };

        bootSequence();

        return () => {
            workerRef.current.terminate();
        };
    }, []);

    // Persist UI settings
    useEffect(() => {
        try { localStorage.setItem('lullaby.dbMode', dbMode); } catch { }
    }, [dbMode]);

    // --- AUTO-SCROLL ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    // --- IDLE DREAMING / REHEARSAL ---
    useEffect(() => {
        if (isBooting || isComputing) return;

        const dreamInterval = setInterval(() => {
            if (Math.random() > 0.7) {
                setIsRehearsing(true);
                postToWorker('REHEARSE', null);

                // Visual flicker
                setTimeout(() => setIsRehearsing(false), 500);
            }
        }, 5000); // Every 5 seconds try to dream

        return () => clearInterval(dreamInterval);
    }, [isBooting, isComputing]);


    const addLog = (source, text) => {
        const ts = Date.now();

        // Persist only user/ai messages when conversation store enabled.
        if ((source === 'user' || source === 'ai') && (dbMode === 'local' || dbMode === 'idb')) {
            const { store, db, conversationId } = conversationRef.current;
            if (store && conversationId) {
                store.appendMessage(db, conversationId, { role: source, text, createdAt: ts }).catch(() => { });
            }
        }

        setLogs(prev => [...prev, { source, text, timestamp: new Date(ts).toLocaleTimeString() }]);
    };

    const cycleDbMode = async () => {
        const order = ['off', 'local', 'idb', 'checkpoints'];
        const idx = Math.max(0, order.indexOf(dbMode));
        const next = order[(idx + 1) % order.length];

        setDbMode(next);
        addLog('sys', `DB MODE: ${next.toUpperCase()}`);

        // Apply conversation persistence immediately.
        if (next === 'local' || next === 'idb') {
            try {
                const store = createConversationStore(next);
                conversationRef.current.store = store;
                await store.init();
                const { db, conversationId } = await store.ensureActiveConversation();
                conversationRef.current.db = db;
                conversationRef.current.conversationId = conversationId;
                setActiveConversationId(conversationId);
                await refreshThreads();
            } catch {
                addLog('sys', 'CONVERSATION STORE INIT FAILED. FALLING BACK TO RAW.');
                setDbMode('off');
                setThreads([]);
                setActiveConversationId(null);
                setThreadsOpen(false);
            }
        } else {
            conversationRef.current.store = createConversationStore('off');
            conversationRef.current.db = null;
            conversationRef.current.conversationId = null;
            setThreads([]);
            setActiveConversationId(null);
            setThreadsOpen(false);
        }

        // Apply core checkpoint persistence immediately.
        if (workerRef.current) {
            postToWorker('SET_PERSISTENCE', { enabled: next === 'checkpoints', profileKey });
        }
    };

    const handleWipe = () => {
        const nextKey = profileKey || 'latest';

        // Reset the model/profile in the worker (and delete persisted checkpoint if enabled).
        postToWorker('RESET_PROFILE', { profileKey: nextKey });
        // Cancel any pending generate/train.
        if (lastGenerateRequestIdRef.current) postToWorker('CANCEL', { requestId: lastGenerateRequestIdRef.current });
        if (lastTrainRequestIdRef.current) postToWorker('CANCEL', { requestId: lastTrainRequestIdRef.current });

        // Clear local UI state so it feels like a fresh start.
        setLogs([]);
        setAttentionWeights(null);
        setIsComputing(false);
        setIsRehearsing(false);
        setStats({ loss: 5.0, klLoss: 0.0, bootProgress: 0, currentPhase: 'INIT', epochs: 0 });
        setLossHistory(new Array(20).fill({ val: 5.0 }));

        // Visible feedback (system logs are hidden by default).
        addLog('ai', 'fresh start.');
    };

    const updateStats = (newLoss, newKlLoss) => {
        setStats(prev => ({
            ...prev,
            loss: newLoss,
            klLoss: (typeof newKlLoss === 'number') ? newKlLoss : prev.klLoss,
            epochs: prev.epochs + 1
        }));
        setLossHistory(prev => [...prev.slice(1), { val: newLoss }]);
    };

    const runLocalCommand = (raw) => {
        const parts = String(raw).trim().split(/\s+/);
        const cmd = (parts[0] || '').toLowerCase();
        const args = parts.slice(1);

        if (cmd === '/help') {
            addLog('sys', [
                'COMMANDS:',
                '/seed <name> [count]  -> fills memory bank from templates',
                '/new <profile>        -> clears + starts fresh profile',
                '/load <profile>       -> loads existing profile (or creates empty)',
                '/help                 -> show this list',
            ].join('\n'));
            return true;
        }

        if (cmd === '/seed') {
            const name = args[0] || 'Emma';
            const count = args[1] ? Number(args[1]) : undefined;
            addLog('sys', `SEEDING: ${name}${count ? ` (x${count})` : ''}...`);
            postToWorker('SEED', { name, count });
            return true;
        }

        if (cmd === '/load') {
            if (dbMode !== 'checkpoints') {
                addLog('sys', 'CHECKPOINT PERSISTENCE IS OFF. (Switch DB mode to CHECKPOINTS to enable /load.)');
                return true;
            }
            const nextKey = args[0] || 'latest';
            addLog('sys', `LOADING PROFILE: ${nextKey}...`);
            postToWorker('SET_PROFILE', { profileKey: nextKey });
            return true;
        }

        if (cmd === '/new') {
            if (dbMode !== 'checkpoints') {
                addLog('sys', 'CHECKPOINT PERSISTENCE IS OFF. (Switch DB mode to CHECKPOINTS to enable /new.)');
                return true;
            }
            const nextKey = args[0] || `profile_${Date.now()}`;
            addLog('sys', `NEW PROFILE: ${nextKey} (clearing any existing checkpoint)...`);
            postToWorker('RESET_PROFILE', { profileKey: nextKey });
            return true;
        }

        return false;
    };

    const handleCommand = async (e) => {
        if (isBooting || isComputing || workerStatus !== 'ONLINE') return;
        if (e.key === 'Enter' && inputVal.trim()) {
            const text = inputVal.trim();
            setInputVal('');

            // Terminal-style commands (minimal UX addition)
            if (text.startsWith('/')) {
                const handled = runLocalCommand(text);
                if (!handled) addLog('sys', `UNKNOWN COMMAND: ${text} (try /help)`);
                return;
            }

            setIsComputing(true);
            addLog('user', text);

            // 1. Train on input (One-shot learning)
            {
                const reqId = postToWorker('TRAIN', { text, epoch: stats.epochs, totalEpochs: 10000, isGameplay: true });
                lastTrainRequestIdRef.current = reqId;
            }

            // 2. Generate response
            // Small delay to allow training to process
            setTimeout(() => {
                // Cancel previous generation so only the latest matters.
                if (lastGenerateRequestIdRef.current) {
                    postToWorker('CANCEL', { requestId: lastGenerateRequestIdRef.current });
                }
                const reqId = postToWorker('GENERATE', { seed: text, steps: 20, temperature: 0.75 });
                lastGenerateRequestIdRef.current = reqId;
            }, 100);
        }
    };

    const attentionPeak = attentionWeights?.length ? Math.max(...attentionWeights) : 0;
    const avatarVariant = isRehearsing
        ? 'dream'
        : (attentionPeak > 0.6 ? 'intense' : (attentionPeak > 0.35 ? 'focused' : 'idle'));
    const avatarSrc = `/emma/${avatarVariant}.png`;

    // Map KL loss to a 0..1 “stress” meter (smooth + bounded).
    const klLoss = Number.isFinite(stats.klLoss) ? stats.klLoss : 0;
    const stress01 = 1 - Math.exp(-Math.max(0, klLoss) / 750);

    const handleManualSave = () => {
        if (dbMode !== 'checkpoints') {
            addLog('sys', 'CHECKPOINT PERSISTENCE IS OFF. (Switch DB mode to CHECKPOINTS to enable.)');
            return;
        }
        postToWorker('SAVE', null);
    };

    const handleExport = () => {
        addLog('sys', 'PREPARING SAFETENSORS EXPORT...');
        postToWorker('EXPORT', null);
    };

    const handleImportClick = () => {
        importFileRef.current?.click();
    };

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        // Allow importing the same file twice by clearing the input value.
        e.target.value = '';
        if (!file) return;

        try {
            addLog('sys', `IMPORTING: ${file.name} (${Math.round(file.size / 1024)} KB)`);
            const buffer = await file.arrayBuffer();
            // Transfer the ArrayBuffer to the worker to avoid copying.
            workerRef.current.postMessage({ v: protocolRef.current.v, requestId: makeRequestId('import'), type: 'IMPORT', payload: { buffer } }, [buffer]);
        } catch (err) {
            const msg = err?.message || String(err);
            addLog('sys', `IMPORT FAILED: ${msg}`);
            pushToast('error', `Import failed: ${msg}`);
        }
    };

    const visibleLogs = SHOW_SYSTEM_MESSAGES ? logs : logs.filter(l => l.source !== 'sys');

    const inputDisabled = isBooting || isComputing || workerStatus !== 'ONLINE';

    const trainingIsOn = true;
    const dbIsOn = dbMode !== 'off';
    const dbIsOff = dbMode === 'off';
    const dbIsLocal = dbMode === 'local';
    const dbIsIdb = dbMode === 'idb';
    const dbIsCheckpoints = dbMode === 'checkpoints';
    const threadsEnabled = dbIsLocal || dbIsIdb;

    return (
        <div className="min-h-screen text-amber-100 font-sans p-4 overflow-hidden flex flex-col relative"
            style={{ background: 'linear-gradient(to bottom, #050810 0%, #0a0f1a 20%, #0d1526 50%, #1a1a2e 80%, #16213e 100%)' }}>

            {/* IMMERSIVE NIGHT SKY - Stars, Aurora, Shooting Stars, Moon, Embers */}
            <NightSky isActive={isComputing || isRehearsing} />

            {/* MOUNTAIN SILHOUETTES - Multi-layer depth */}
            <Mountains />

            {/* EVERGREEN FOREST FRAMING */}
            <Evergreen />

            {/* CAMPFIRE GLOW - Dynamic flickering */}
            <Campfire isActive={isComputing || isRehearsing} intensity={isComputing ? 1.3 : 1} />

            {/* DREAMING OVERLAY - Subtle purple wash during rehearsal */}
            {isRehearsing && (
                <div className="absolute inset-0 pointer-events-none z-40"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
                        animation: 'dreamPulse 3s ease-in-out infinite'
                    }} />
            )}

            {/* TOASTS (non-blocking) */}
            {toasts.length ? (
                <div className="fixed top-4 right-4 z-[70] space-y-2 pointer-events-none">
                    {toasts.map((t) => (
                        <div
                            key={t.id}
                            className={`max-w-[min(24rem,90vw)] px-4 py-3 rounded-2xl border backdrop-blur-md shadow-lg shadow-black/30 ${t.kind === 'error'
                                ? 'bg-black/45 border-amber-400/30 ring-1 ring-amber-400/30'
                                : 'bg-black/35 border-amber-200/10 ring-1 ring-amber-400/10'
                                }`}
                        >
                            <div className="text-sm text-amber-100/90 font-light whitespace-pre-wrap">{t.text}</div>
                        </div>
                    ))}
                </div>
            ) : null}

            {/* HEADER - Cozy minimal */}
            <header className="pb-4 mb-4 flex flex-col sm:flex-row sm:justify-between items-start gap-3 z-50 relative">
                <div className="flex items-start gap-3">
                    {!avatarFailed ? (
                        <img
                            src={avatarSrc}
                            alt="avatar"
                            className={`w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-full border-2 border-amber-400/30 shadow-lg shadow-amber-500/20 ${isComputing ? 'animate-pulse' : ''}`}
                            style={{ boxShadow: isComputing ? '0 0 20px rgba(251, 191, 36, 0.4)' : '0 0 10px rgba(251, 191, 36, 0.2)' }}
                            onError={() => setAvatarFailed(true)}
                        />
                    ) : (
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center ${isComputing ? 'animate-pulse' : ''}`}>
                            <Heart className="w-6 h-6 text-amber-400" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl sm:text-2xl font-light tracking-wide text-amber-100">
                            <span className="text-amber-300">lullaby</span>
                            <Moon className="inline w-4 h-4 ml-2 text-amber-400/60" />
                        </h1>
                        <p className="text-xs text-amber-200/40 font-light">3am · jasper, alberta</p>
                    </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 text-xs text-amber-200/50">
                    <div
                        title="Learning is always on"
                        className="relative flex items-center gap-2 p-2 rounded-full ring-1 ring-amber-400/40 bg-amber-500/10 shadow-sm shadow-amber-500/10"
                    >
                        <Zap className="w-4 h-4 text-amber-300" />
                        <span className="text-[11px] text-amber-200/70 font-light tracking-wide">learn</span>
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400/80" />
                    </div>
                    <button
                        onClick={handleWipe}
                        title="Wipe (fresh start)"
                        className="flex items-center gap-1 hover:text-amber-300 transition-colors cursor-pointer p-2 rounded-full hover:bg-amber-900/20"
                    >
                        <Eraser className="w-4 h-4" />
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setThreadsOpen((v) => !v)}
                            disabled={!threadsEnabled}
                            title={threadsEnabled ? 'Threads' : 'Threads require LOCAL or IDB mode'}
                            className={`flex items-center gap-1 transition-colors p-2 rounded-full ${threadsEnabled
                                ? 'hover:text-amber-300 cursor-pointer hover:bg-amber-900/20'
                                : 'text-amber-200/20 cursor-not-allowed'
                                }`}
                            aria-expanded={threadsOpen}
                        >
                            <MessageCircle className="w-4 h-4" />
                        </button>

                        {threadsOpen && threadsEnabled ? (
                            <div className="absolute right-0 mt-2 w-72 max-w-[85vw] rounded-2xl border border-amber-200/10 bg-black/40 backdrop-blur-xl shadow-lg shadow-black/30 p-2">
                                <div className="flex items-center justify-between px-2 py-2">
                                    <div className="text-xs text-amber-200/40">threads</div>
                                    <button
                                        onClick={createNewConversation}
                                        className="px-3 py-1 rounded-full ring-1 ring-amber-400/30 bg-black/10 text-xs text-amber-200 hover:bg-white/5 hover:ring-amber-400/50 transition-all"
                                        title="New conversation"
                                    >
                                        new
                                    </button>
                                </div>

                                <div className="max-h-72 overflow-y-auto">
                                    {threads.length ? threads.map((t) => {
                                        const isActive = t.id === activeConversationId;
                                        const ts = new Date(t.updatedAt || t.createdAt || Date.now()).toLocaleString();

                                        const isRenaming = renamingThreadId === t.id;
                                        return (
                                            <div
                                                key={t.id}
                                                className={`w-full px-3 py-2 rounded-xl ring-1 transition-all ${isActive
                                                    ? 'ring-amber-400/50 bg-amber-500/10 text-amber-100'
                                                    : 'ring-amber-400/10 bg-black/10 text-amber-200/70'
                                                    }`}
                                                title={t.id}
                                            >
                                                {isRenaming ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            value={renameDraft}
                                                            onChange={(e) => setRenameDraft(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') commitRenameConversation();
                                                                if (e.key === 'Escape') cancelRenameConversation();
                                                            }}
                                                            className="flex-1 bg-black/10 ring-1 ring-amber-400/10 rounded-xl px-3 py-2 text-sm text-amber-100 placeholder-amber-200/20 outline-none focus:ring-amber-400/30"
                                                            placeholder="title"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={commitRenameConversation}
                                                            className="px-2 py-1 rounded-full ring-1 ring-amber-400/30 bg-black/10 text-xs text-amber-200 hover:bg-white/5 hover:ring-amber-400/50 transition-all"
                                                        >
                                                            ok
                                                        </button>
                                                        <button
                                                            onClick={cancelRenameConversation}
                                                            className="px-2 py-1 rounded-full ring-1 ring-amber-400/10 bg-black/10 text-xs text-amber-200/50 hover:text-amber-200 hover:ring-amber-400/30 transition-all"
                                                        >
                                                            cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start justify-between gap-2">
                                                        <button
                                                            onClick={() => switchConversation(t.id)}
                                                            className={`flex-1 text-left ${isActive ? '' : 'hover:text-amber-200'} transition-colors`}
                                                        >
                                                            <div className="text-sm font-light truncate">{t.title || 'Conversation'}</div>
                                                            <div className="text-[11px] text-amber-200/30 truncate">{ts}</div>
                                                        </button>
                                                        <div className="flex items-center gap-2 pt-0.5">
                                                            <button
                                                                onClick={() => startRenameConversation(t)}
                                                                className="text-[11px] text-amber-200/35 hover:text-amber-200/70 transition-colors"
                                                                title="rename"
                                                            >
                                                                rename
                                                            </button>
                                                            <button
                                                                onClick={() => deleteConversationById(t.id)}
                                                                className="text-[11px] text-amber-200/35 hover:text-amber-200/70 transition-colors"
                                                                title="delete"
                                                            >
                                                                delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }) : (
                                        <div className="px-3 py-4 text-xs text-amber-200/25">no conversations yet</div>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>


                    <button
                        onClick={() => setShowDevTools(!showDevTools)}
                        title="Dev Console"
                        className={`flex items-center gap-1 cursor-pointer p-2 rounded-full transition-all hover:bg-amber-900/20 hover:ring-amber-400/30 ${showDevTools
                            ? 'text-amber-200 ring-1 ring-amber-400/50 bg-amber-500/15'
                            : 'text-amber-200/40 ring-1 ring-amber-400/10 bg-black/10'
                            }`}
                    >
                        <Layers className="w-4 h-4" />
                    </button>

                    <button
                        onClick={cycleDbMode}
                        title={`DB: ${dbMode.toUpperCase()} (click to cycle: OFF → LOCAL → IDB → CHECKPOINTS)`}
                        aria-pressed={dbIsOn}
                        className={`relative flex items-center gap-1 cursor-pointer p-2 rounded-full transition-all hover:bg-amber-900/20 hover:ring-amber-400/30 ${dbIsOff
                            ? 'text-amber-200/40 ring-1 ring-amber-400/10 bg-black/10'
                            : 'text-amber-200 ring-1 ring-amber-400/50 bg-amber-500/15 shadow-sm shadow-amber-500/10'
                            }`}
                    >
                        <Database className={`w-4 h-4 ${dbIsOff ? 'text-amber-100/45' : 'text-amber-300'}`} />
                        <span
                            className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${dbIsOff
                                ? 'bg-amber-200/15'
                                : dbIsLocal
                                    ? 'bg-amber-400/45'
                                    : dbIsIdb
                                        ? 'bg-amber-400/60'
                                        : dbIsCheckpoints
                                            ? 'bg-amber-400/75'
                                            : 'bg-amber-400/60'
                                }`}
                        />
                    </button>
                    <button onClick={handleManualSave} className="flex items-center gap-1 hover:text-amber-300 transition-colors cursor-pointer p-2 rounded-full hover:bg-amber-900/20">
                        <Save className="w-4 h-4" />
                    </button>
                    <button onClick={handleImportClick} className="flex items-center gap-1 hover:text-amber-300 transition-colors cursor-pointer p-2 rounded-full hover:bg-amber-900/20">
                        <Upload className="w-4 h-4" />
                    </button>
                    <button onClick={handleExport} className="flex items-center gap-1 hover:text-amber-300 transition-colors cursor-pointer p-2 rounded-full hover:bg-amber-900/20">
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* CORE OFFLINE/ERROR BANNER */}
            {workerStatus !== 'ONLINE' ? (
                <div className="max-w-3xl mx-auto w-full mb-4 z-50 relative">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-amber-200/10 bg-black/35 backdrop-blur-md">
                        <div className="text-xs text-amber-200/70 font-light">
                            AI core is {isBooting || workerStatus === 'CONNECTING' ? 'starting…' : 'offline.'}
                        </div>
                        <button
                            onClick={restartCore}
                            className="px-4 py-2 rounded-full ring-1 ring-amber-400/30 bg-black/10 text-xs text-amber-200 hover:bg-white/5 hover:ring-amber-400/50 transition-all"
                        >
                            restart core
                        </button>
                    </div>
                </div>
            ) : null}

            {/* Hidden file input for import */}
            <input
                ref={importFileRef}
                type="file"
                accept=".safetensors,application/octet-stream"
                onChange={handleImportFile}
                style={{ display: 'none' }}
            />

            {/* Hidden file input for dataset JSONL import */}
            <input
                ref={datasetImportFileRef}
                type="file"
                accept=".jsonl,application/json,text/plain"
                onChange={handleDatasetImportFile}
                style={{ display: 'none' }}
            />

            {/* MAIN CHAT AREA - Cozy conversation */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto mb-4 space-y-2 scrollbar-hide z-10 pr-2 pb-8 max-w-3xl mx-auto w-full"
            >
                {visibleLogs.map((log, i) => (
                    <div
                        key={i}
                        className={`w-full flex ${log.source === 'sys'
                            ? 'justify-center'
                            : log.source === 'user'
                                ? 'justify-end'
                                : 'justify-start'
                            }`}
                    >
                        {log.source === 'sys' ? (
                            SHOW_SYSTEM_MESSAGES ? (
                                <div className="text-amber-500/30 text-xs italic px-4 py-1 text-center">
                                    <span className="opacity-60">{log.timestamp}</span> · {log.text}
                                </div>
                            ) : null
                        ) : (
                            <div className={`max-w-[75%] px-4 py-3 rounded-3xl backdrop-blur-sm border ${log.source === 'user'
                                ? 'bg-amber-500/10 text-amber-100 rounded-br-xl border-amber-200/[0.06]'
                                : 'bg-white/[0.035] text-amber-50 rounded-bl-xl border-amber-200/[0.06]'
                                }`}
                                style={log.source === 'ai' ? { boxShadow: '0 0 20px rgba(251, 191, 36, 0.05)' } : {}}>
                                <span className="whitespace-pre-wrap leading-relaxed font-light text-[15px] text-amber-50/95">{log.text}</span>
                            </div>
                        )}
                    </div>
                ))}
                {isComputing && (
                    <div className="flex justify-start w-full">
                        <div className="bg-white/[0.035] backdrop-blur-sm border border-amber-200/[0.06] px-4 py-3 rounded-3xl rounded-bl-xl">
                            <div className="flex items-center gap-2 text-amber-300/60">
                                <Flame className="w-4 h-4 animate-pulse" />
                                <span className="animate-pulse">thinking by the fire...</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* ATTENTION VISUALIZATION - Subtle warmth bars */}
            {attentionWeights && (
                <div className="h-12 mb-4 flex items-end gap-0.5 opacity-60 px-4 z-20 relative">
                    {attentionWeights.map((w, i) => (
                        <div
                            key={i}
                            className="flex-1 rounded-t-sm transition-all duration-300"
                            style={{
                                height: `${w * 100}%`,
                                background: `linear-gradient(to top, rgba(251, 191, 36, ${w * 0.8}), rgba(249, 115, 22, ${w * 0.4}))`,
                                boxShadow: w > 0.5 ? '0 0 10px rgba(251, 191, 36, 0.3)' : 'none'
                            }}
                            title={`${w.toFixed(3)}`}
                        />
                    ))}
                </div>
            )}

            {/* FOOTER / INPUT - Cozy input area */}
            <div className="pt-4 z-50 relative">
                {/* Custom datasets */}
                <div className="mb-4 px-1">
                    <div className="flex items-center justify-between text-xs text-amber-200/40 mb-2">
                        <button
                            onClick={() => setDatasetsPanelOpen((v) => !v)}
                            className="flex items-center gap-2 hover:text-amber-200/60 transition-colors"
                            aria-expanded={datasetsPanelOpen}
                            title={datasetsPanelOpen ? 'hide memories' : 'show memories'}
                        >
                            <span className="tracking-wide">memories</span>
                            <span className="text-amber-200/30">({customDatasets.length})</span>
                            {datasetsPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <div className="text-amber-200/25">
                            {selectedDatasetId
                                ? (customDatasets.find((d) => d.id === selectedDatasetId)?.name || 'selected')
                                : 'quiet'}
                        </div>
                    </div>

                    {datasetsPanelOpen ? (
                        <div className="flex flex-col gap-2 bg-white/5 backdrop-blur-md p-3 rounded-2xl border border-amber-200/10">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-xs text-amber-200/25">
                                    {datasetTraining.active
                                        ? `listening… ${datasetTraining.done}/${datasetTraining.total}`
                                        : (memoriesStatus || 'add a few lines that feel like you')}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleDatasetImportClick}
                                        disabled={isBooting}
                                        className={`px-3 py-1 rounded-full ring-1 transition-all ${isBooting
                                            ? 'text-amber-200/20 ring-amber-400/10 bg-black/10 cursor-not-allowed'
                                            : 'text-amber-200 ring-amber-400/30 bg-black/10 hover:bg-white/5 hover:ring-amber-400/50'
                                            }`}
                                        title="Import a .jsonl file"
                                    >
                                        import
                                    </button>
                                    <button
                                        onClick={startTeachingSelectedDataset}
                                        disabled={!selectedDatasetId || isBooting || datasetTraining.active}
                                        className={`px-3 py-1 rounded-full ring-1 transition-all ${(!selectedDatasetId || isBooting || datasetTraining.active)
                                            ? 'text-amber-200/20 ring-amber-400/10 bg-black/10 cursor-not-allowed'
                                            : 'text-amber-200 ring-amber-400/40 bg-amber-500/10 hover:bg-amber-500/15 hover:ring-amber-400/60'
                                            }`}
                                        title="Teach from selected memories"
                                    >
                                        teach
                                    </button>
                                    <button
                                        onClick={seedFromSelectedDataset}
                                        disabled={!selectedDatasetId || isBooting}
                                        className={`px-3 py-1 rounded-full ring-1 transition-all ${(!selectedDatasetId || isBooting)
                                            ? 'text-amber-200/20 ring-amber-400/10 bg-black/10 cursor-not-allowed'
                                            : 'text-amber-200 ring-amber-400/40 bg-amber-500/10 hover:bg-amber-500/15 hover:ring-amber-400/60'
                                            }`}
                                        title="Use selected memories"
                                    >
                                        use
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    value={seedTargetName}
                                    onChange={(e) => setSeedTargetName(e.target.value)}
                                    className="flex-1 bg-black/10 ring-1 ring-amber-400/10 rounded-xl px-3 py-2 text-sm text-amber-100 placeholder-amber-200/20 outline-none focus:ring-amber-400/30"
                                    placeholder="name"
                                    disabled={isBooting}
                                />
                                <select
                                    value={selectedDatasetId}
                                    onChange={(e) => setSelectedDatasetId(e.target.value)}
                                    className="bg-black/10 ring-1 ring-amber-400/10 rounded-xl px-3 py-2 text-sm text-amber-100 outline-none focus:ring-amber-400/30"
                                    disabled={isBooting}
                                >
                                    <option value="">choose…</option>
                                    {customDatasets.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input
                                    value={datasetDraftName}
                                    onChange={(e) => setDatasetDraftName(e.target.value)}
                                    className="bg-black/10 ring-1 ring-amber-400/10 rounded-xl px-3 py-2 text-sm text-amber-100 placeholder-amber-200/20 outline-none focus:ring-amber-400/30"
                                    placeholder="title"
                                    disabled={isBooting}
                                />
                                <button
                                    onClick={addCustomDataset}
                                    disabled={isBooting}
                                    className={`px-3 py-2 rounded-xl ring-1 text-sm transition-all ${isBooting
                                        ? 'text-amber-200/20 ring-amber-400/10 bg-black/10 cursor-not-allowed'
                                        : 'text-amber-200 ring-amber-400/40 bg-amber-500/10 hover:bg-amber-500/15 hover:ring-amber-400/60'
                                        }`}
                                >
                                    save
                                </button>
                            </div>

                            <textarea
                                value={datasetDraftText}
                                onChange={(e) => setDatasetDraftText(e.target.value)}
                                className="bg-black/10 ring-1 ring-amber-400/10 rounded-xl px-3 py-2 text-sm text-amber-100 placeholder-amber-200/20 outline-none focus:ring-amber-400/30 min-h-[90px]"
                                placeholder="one line per thought"
                                disabled={isBooting}
                            />

                            {customDatasets.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {customDatasets.slice(0, 12).map((d) => (
                                        <div
                                            key={d.id}
                                            className={`flex items-center gap-2 px-3 py-1 rounded-full ring-1 text-xs ${selectedDatasetId === d.id
                                                ? 'text-amber-200 ring-amber-400/50 bg-amber-500/10'
                                                : 'text-amber-200/40 ring-amber-400/10 bg-black/10'
                                                }`}
                                        >
                                            <button
                                                className="hover:text-amber-200"
                                                onClick={() => setSelectedDatasetId(d.id)}
                                                disabled={isBooting}
                                                title={`${d.templates?.length || 0} lines`}
                                            >
                                                {d.name}
                                            </button>
                                            <button
                                                className="text-amber-200/30 hover:text-amber-200/60"
                                                onClick={() => removeCustomDataset(d.id)}
                                                disabled={isBooting}
                                                title="remove"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white/5 backdrop-blur-md p-3 rounded-2xl border border-amber-200/10">
                            <div className="flex items-center justify-between text-xs text-amber-200/30">
                                <span>{memoriesStatus || 'tap “memories” when you want to add something'}</span>
                                {selectedDatasetId ? (
                                    <button
                                        onClick={seedFromSelectedDataset}
                                        disabled={isBooting}
                                        className={`px-3 py-1 rounded-full ring-1 transition-all ${(isBooting)
                                            ? 'text-amber-200/20 ring-amber-400/10 bg-black/10 cursor-not-allowed'
                                            : 'text-amber-200 ring-amber-400/30 bg-black/10 hover:bg-white/5 hover:ring-amber-400/50'
                                            }`}
                                        title="Use selected memories"
                                    >
                                        use
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>

                {/* Small loss indicator */}
                <div className="flex items-center justify-center gap-4 mb-3 text-xs text-amber-300/30">
                    <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        <span>loss: {stats.loss.toFixed(4)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        <span>epoch: {stats.epochs}</span>
                    </span>
                    <span className="flex items-center gap-1" title="KL Divergence (Identity retention)">
                        <Fingerprint className="w-3 h-3" />
                        <span>kl: {Math.max(0, stats.klLoss).toFixed(4)}</span>
                    </span>
                </div>

                {/* MAIN INPUT */}
                <div className="relative max-w-3xl mx-auto w-full">
                    <input
                        type="text"
                        value={inputVal}
                        onChange={(e) => setInputVal(e.target.value)}
                        onKeyDown={handleCommand}
                        placeholder={
                            isBooting
                                ? "waking up..."
                                : isComputing
                                    ? "listening..."
                                    : "say something..."
                        }
                        disabled={inputDisabled}
                        className={`w-full bg-white/5 backdrop-blur-xl border border-amber-200/10 rounded-br-2xl rounded-bl-2xl rounded-t-2xl px-6 py-4 text-amber-100 placeholder-amber-200/20 outline-none transition-all shadow-lg shadow-black/20 ${isComputing ? 'ring-1 ring-amber-400/30' : 'focus:ring-1 focus:ring-amber-400/30'
                            }`}
                        style={{ fontSize: '16px' }}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-50">
                        {isComputing && <Star className="w-4 h-4 text-amber-400 animate-spin" />}
                        {isRehearsing && !isComputing && <Star className="w-4 h-4 text-amber-400 animate-pulse" />}
                    </div>
                </div>

                {/* Subtle profile indicator */}
                <div className="text-center mt-3 text-xs text-amber-300/20">
                    {profileKey !== 'latest' && <span>~ {profileKey} ~</span>}
                </div>
            </div>

            {/* DEV TOOLS MODAL */}
            {showDevTools && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#0f172a] border border-amber-500/20 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/10 bg-black/20">
                            <div className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-amber-400" />
                                <h2 className="text-lg font-light text-amber-100">Dev Console</h2>
                            </div>
                            <button
                                onClick={() => setShowDevTools(false)}
                                className="p-2 hover:bg-white/5 rounded-full text-amber-200/50 hover:text-amber-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* STATUS PANEL */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-black/20 rounded-xl p-3 border border-amber-500/10">
                                    <div className="text-[10px] uppercase tracking-wider text-amber-500/50 mb-1">Loss</div>
                                    <div className="text-xl font-mono text-amber-100">{stats.loss.toFixed(6)}</div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-3 border border-amber-500/10">
                                    <div className="text-[10px] uppercase tracking-wider text-amber-500/50 mb-1">KL Div</div>
                                    <div className="text-xl font-mono text-amber-100">{Math.max(0, stats.klLoss).toFixed(6)}</div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-3 border border-amber-500/10">
                                    <div className="text-[10px] uppercase tracking-wider text-amber-500/50 mb-1">Epochs</div>
                                    <div className="text-xl font-mono text-amber-100">{stats.epochs}</div>
                                </div>
                            </div>

                            {/* RAW TRAINING */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-amber-200/70">Raw Training Data</h3>
                                    <div className="text-xs text-amber-500/40">Paste text to train model directly</div>
                                </div>
                                <textarea
                                    value={devTrainText}
                                    onChange={(e) => setDevTrainText(e.target.value)}
                                    className="w-full h-40 bg-black/30 border border-amber-500/10 rounded-xl p-4 text-sm font-mono text-amber-100/80 resize-none focus:outline-none focus:border-amber-500/30"
                                    placeholder="Enter raw text here...&#10;Line 1&#10;Line 2"
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            if (!devTrainText.trim()) return;
                                            addLog('sys', 'DEV: SINGLE SHOT TRAIN START');
                                            postToWorker('TRAIN', { text: devTrainText, epoch: 0, totalEpochs: 1, isGameplay: false });
                                        }}
                                        className="flex-1 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-sm font-medium transition-colors border border-amber-500/10"
                                    >
                                        Train Single Block
                                    </button>
                                    <button
                                        onClick={() => {
                                            const lines = devTrainText.split('\n').filter(l => l.trim());
                                            if (!lines.length) return;

                                            addLog('sys', `DEV: BATCH TRAIN START (${lines.length} lines)`);

                                            // Hack: Inject into existing queue system
                                            datasetTrainQueueRef.current = [...lines];
                                            datasetTrainEpochRef.current = 0;
                                            datasetTrainTotalRef.current = lines.length;

                                            if (!datasetTrainingRef.current.active) {
                                                datasetTrainingRef.current = { active: true };
                                                setDatasetTraining({ active: true, name: 'dev-batch', done: 0, total: lines.length });
                                                setIsComputing(true);

                                                const first = datasetTrainQueueRef.current.shift();
                                                if (first) {
                                                    postToWorker('TRAIN', { text: first, epoch: 0, totalEpochs: lines.length, isGameplay: false });
                                                }
                                            }
                                        }}
                                        className="flex-1 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-sm font-medium transition-colors border border-amber-500/10"
                                    >
                                        Train Line-by-Line
                                    </button>
                                </div>
                            </div>

                            {/* ADVANCED CONTROLS */}
                            <div className="pt-4 border-t border-amber-500/10 space-y-3">
                                <h3 className="text-sm font-medium text-amber-200/70">Danger Zone</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            handleManualSave();
                                            pushToast('info', 'Checkpoint saved');
                                        }}
                                        className="py-2 px-4 rounded-lg bg-emerald-900/20 hover:bg-emerald-900/30 text-emerald-200/80 border border-emerald-500/20 text-xs font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-3 h-3" /> Force Save Status
                                    </button>
                                    <button
                                        onClick={handleWipe}
                                        className="py-2 px-4 rounded-lg bg-red-900/20 hover:bg-red-900/30 text-red-200/80 border border-red-500/20 text-xs font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Eraser className="w-3 h-3" /> Reset Profile
                                    </button>
                                    <button
                                        onClick={handleExport}
                                        className="py-2 px-4 rounded-lg bg-blue-900/20 hover:bg-blue-900/30 text-blue-200/80 border border-blue-500/20 text-xs font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-3 h-3" /> Export Safetensors
                                    </button>
                                    <button
                                        onClick={handleImportClick}
                                        className="py-2 px-4 rounded-lg bg-blue-900/20 hover:bg-blue-900/30 text-blue-200/80 border border-blue-500/20 text-xs font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Upload className="w-3 h-3" /> Import Safetensors
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOM ANIMATIONS */}
            <style>{`
                @keyframes dreamPulse {
                    0%, 100% { opacity: 0.6; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.02); }
                }
            `}</style>
        </div>
    );
}