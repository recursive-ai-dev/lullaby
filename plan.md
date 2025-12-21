# Lullaby: Plan to Evolve Into a Significant AI Companion App

This repo is already a working prototype: a React chat UI that talks to a module Web Worker running a tiny on-device character-level model that *learns from the user’s messages* and generates responses. It supports optional conversation persistence (localStorage / IndexedDB) and model checkpoint persistence (IndexedDB, worker-side).

This plan turns that prototype into a “significant application” for an AI girlfriend/boyfriend companion by hardening foundations first (data model, protocol, reliability), then adding product pillars (persona, memory, voice, presence), and finally platform + growth concerns (privacy, safety, packaging, observability).

---

## 0) Guiding Principles

### Product principles
- **Transparent**: Always disclose the assistant is AI.
- **User-controlled**: Clear controls for memory, data export/delete, and relationship tone.
- **Safety-first**: Boundaries against coercion/manipulation and crisis escalation.
- **Private-by-default**: Local storage is the default; online features are opt-in and explicitly labeled.
- **Cross-platform**: Web (Vite), Desktop (Electron), Mobile (Capacitor) remain first-class targets.

### Engineering principles
- **Version everything**: message schemas, storage schemas, and migrations.
- **Never block the UI thread**: keep inference and heavy work in workers.
- **Backwards compatible protocol**: UI can talk to older worker versions if needed.
- **Fail safe**: errors become user-safe messages and don’t break the session.

---

## 1) Current Architecture (Ground Truth)

### Runtime components
- **UI**: React chat interface and “memory sets” tooling in [lullaby.jsx](lullaby.jsx)
- **Worker**: message router + engine lifecycle in [lullaby.worker.js](lullaby.worker.js)
- **Engine**: training + generation + checkpoint I/O in [modules/engine.js](modules/engine.js)
- **Conversation persistence** (UI-only): localStorage/IndexedDB in [modules/conversation_store.js](modules/conversation_store.js)
- **Model**: tiny transformer-ish stack in [modules/model.js](modules/model.js), ops in [modules/tensor.js](modules/tensor.js) + [modules/tensor_ops.js](modules/tensor_ops.js)

### Today’s end-to-end flow
1. UI starts worker and sends `INIT`.
2. User message → UI sends `TRAIN` then `GENERATE`.
3. Worker runs engine compute and returns `*_COMPLETE`.
4. UI appends logs and optionally persists messages.

### Storage today
- **Chat history**: `lullaby-conversations` (IndexedDB) or localStorage keys `lullaby.convo.*` via [modules/conversation_store.js](modules/conversation_store.js)
- **Model checkpoints**: `lullaby-memory` (IndexedDB) in the worker via [modules/engine.js](modules/engine.js)

---

## 2) Target Product Definition (What “Significant” Means)

### Core pillars
1. **Companion chat that feels alive**
	- fast, reliable, and responsive
	- coherent multi-turn context
	- consistent persona (“who they are”)

2. **Persona + relationship boundaries**
	- user selects relationship tone (sweet / friendly / supportive, etc.)
	- explicit safety boundaries and “no manipulation” rules

3. **Controllable memory**
	- user can view/edit/delete memories
	- clear separation between “facts I told you” and “your style/persona”
	- retrieval of relevant memories (not just training drift)

4. **Voice + presence**
	- optional TTS (assistant voice) and STT (dictation)
	- lightweight check-ins/reminders via notifications

5. **Hybrid offline/online**
	- offline-lite (current engine) for privacy/availability
	- online mode for higher quality, opt-in

---

## 3) Safety, Privacy, and Trust (Non-Negotiables)

### Safety policy scope (must be written and enforced in product)
- **AI disclosure**: assistant must not claim to be a real human.
- **Boundaries**: no coercive, controlling, or manipulative messaging.
- **Crisis handling**: if the user expresses self-harm intent, the app should respond with supportive language and encourage real-world help.
- **Age considerations**: define whether the app is 18+ or has age gating.

### Privacy requirements
- **Data controls**: export and delete conversation + memory.
- **Local-first**: keep sensitive data on device unless user opts into online.
- **Encryption-at-rest (phase 2+)**: especially for mobile and desktop.

### Security posture
- Electron currently uses secure defaults; keep IPC surfaces minimal and allowlisted in [electron/preload.cjs](electron/preload.cjs).
- Avoid storing secrets or tokens in localStorage.

---

## 4) Milestones (Implementation Roadmap)

Each milestone is designed to be shippable and to reduce risk before adding features.

### Milestone 1 — Foundations: versioned protocol + stable storage
**Goal**: make the current app reliable, debuggable, and migration-safe.

Deliverables
- **Versioned UI↔Worker protocol**
  - every message includes `{ v, requestId, type, payload }`
  - worker responds with the same `requestId`
  - structured error event type (e.g. `WORKER_ERROR`) with a safe message
- **Race-safe generation**
  - UI ignores stale `GENERATE_COMPLETE` responses
- **Conversation message schema**
  - normalize stored messages to `{id, role, text, createdAt}`
  - add schema version to persistence

Acceptance criteria
- If the worker crashes or throws, the UI stays usable and shows a friendly error.
- Sending messages quickly cannot lead to out-of-order assistant replies.
- Existing persisted conversations still load (migration runs automatically).

Primary files
- [lullaby.jsx](lullaby.jsx)
- [lullaby.worker.js](lullaby.worker.js)
- [modules/conversation_store.js](modules/conversation_store.js)

---

### Milestone 2 — Persona: explicit companion identity + tone controls
**Goal**: consistent personality without relying on unstable online training drift.

Deliverables
- Profile-scoped persona record (name, pronouns, tone, boundaries)
- UI settings (minimal) to choose tone + reset persona
- Persona injected as a stable “system/persona” prefix for generation

Acceptance criteria
- Persona remains stable across sessions and checkpoint reloads.
- User can reset persona without wiping conversations.

Primary files
- [modules/engine.js](modules/engine.js)
- [lullaby.jsx](lullaby.jsx)

---

### Milestone 3 — Memory: user-visible, editable, and retrieval-based
**Goal**: long-term memory becomes controllable and explainable.

Deliverables
- Long-term memory store separate from training replay
- Memory UI: list + edit + delete
- Retrieval hooks: “select relevant memories to include in context”

Acceptance criteria
- User can remove a memory and see behavior change.
- Assistant can cite “I remember you said …” only when the memory exists.

Primary files
- [modules/memory.js](modules/memory.js)
- [modules/engine.js](modules/engine.js)
- [modules/conversation_store.js](modules/conversation_store.js) (if memory attaches to conversations)
- [lullaby.jsx](lullaby.jsx)

---

### Milestone 4 — Hybrid inference: offline-lite + online opt-in
**Goal**: reach companion-quality responses while keeping an offline mode.

Deliverables
- Online inference adapter (HTTP API) gated by a clear toggle
- Privacy disclosure and data selection (what gets sent)
- Failover: if online fails, fall back to offline-lite

Acceptance criteria
- User can run entirely offline.
- Online mode clearly indicates when data is transmitted.

Primary files
- [lullaby.jsx](lullaby.jsx)
- (new) `modules/inference_client.js` (suggested)

---

### Milestone 5 — Voice + presence
**Goal**: make the companion feel present beyond typing.

Deliverables
- TTS output (web SpeechSynthesis for web; native options later)
- STT input (web SpeechRecognition where available)
- Notifications for gentle check-ins (Capacitor + Electron)

Acceptance criteria
- Voice features can be fully disabled.
- Notifications are opt-in and configurable.

Primary files
- [capacitor.config.ts](capacitor.config.ts)
- [electron/main.cjs](electron/main.cjs)
- [lullaby.jsx](lullaby.jsx)

---

### Milestone 6 — Production hardening
**Goal**: stability, diagnostics, and release readiness.

Deliverables
- Crash reporting strategy (platform-appropriate)
- Performance profiling and guardrails (limit training frequency, battery-friendly defaults)
- Release pipeline documentation (desktop + mobile)
- Data lifecycle docs (export/delete)

Acceptance criteria
- App continues working after long sessions.
- Clear bug reports can be captured without leaking sensitive content.

---

## 5) Implementation Notes (Repo-Specific)

### Worker protocol: why versioning matters here
Today the worker and UI use ad-hoc `type/payload` messages. As features expand (streaming, cancellation, online inference), the protocol becomes a real API and needs:
- request IDs (avoid race conditions)
- structured error events
- schema versioning

### The model: realistic expectations
The current on-device model is intentionally tiny and character-level. It’s excellent for a “private offline-lite companion,” but a “significant AI girlfriend/boyfriend” experience typically needs:
- stronger inference (online model) or significant acceleration (WebGPU/WASM) + better tokenization
- controlled memory retrieval instead of “learn everything by gradient updates”

---

## 6) Definition of Done (for each milestone)
- User-visible feature works across: Web (Vite) + Desktop (Electron) + Mobile (Capacitor) where applicable.
- Privacy controls are explicit and discoverable.
- Storage and protocol changes include versioning/migration.
- Errors are user-safe and non-destructive.
