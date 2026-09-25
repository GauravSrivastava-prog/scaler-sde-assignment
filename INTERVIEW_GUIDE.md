# 🎯 Scaler Lab AI SDE Interview Preparation Guide

This guide is tailored specifically for your evaluation interview at **Scaler Lab AI**. It provides crisp, high-impact talking points and direct answers to expected technical questions.

---

## 1. 60-Second Project Elevator Pitch

> *"For this assignment, I built a production-grade Signal Messenger clone designed to mirror the exact Signal Desktop UX and real-time messaging workflows.*
>
> *On the frontend, I chose **Next.js 16 with TypeScript and React 19**, implementing optimistic UI updates, custom Web Audio synthesis for Signal tones, and a modular architecture split across Auth, Chat, and WebSocket contexts.*
>
> *On the backend, I used **FastAPI with an asynchronous ASGI architecture**. Real-time messaging runs over a robust **WebSocket Gateway** with multi-tab connection multiplexing, heartbeat keepalives, exponential backoff reconnection, and instant delivery/read receipt transitions.*
>
> *For storage, I designed a **normalized SQLite schema** enforcing relational integrity via explicit PRAGMA foreign keys, compound indexes on conversation timestamps, and automatic disappearing message expiration. The entire system is covered by automated pytest integration tests and seeds with realistic demo data out of the box."*

---

## 2. Technical Q&A Cheat Sheet

### Q1: "Why did you choose FastAPI over Django or Node.js/Express?"
**Answer:**
- **Asynchronous Concurrency**: FastAPI is built on top of Starlette and AnyIO/uvicorn. For a chat platform with thousands of persistent, concurrent WebSocket connections, FastAPI’s async event loop handles I/O multiplexing with minimal memory overhead compared to thread-per-request frameworks like traditional Django.
- **Type Safety & Auto-Documentation**: Pydantic V2 provides strict request validation and serialization with native TypeScript-like guarantees, while automatically generating interactive OpenAPI (Swagger) specs at `/docs`.
- **Clean Dependency Injection**: FastAPI's `Depends()` allows modular, testable dependencies for authentication, database session lifecycles, and user verification.

---

### Q2: "How do your WebSockets handle multiple open tabs for the same user?"
**Answer:**
- *"A common bug in chat systems is mapping a user to a single WebSocket. If User A opens two tabs, the second tab overwrites the first, breaking the earlier session.*
- *In my `ConnectionManager`, I designed an in-memory dictionary mapping `user_id -> Set[WebSocket]`:*
  ```python
  self.active_connections: Dict[str, Set[WebSocket]] = {}
  ```
- *When a message or receipt arrives, it fans out to all active sockets for that user.*
- *Disconnects only remove the specific socket that closed; only when the set becomes empty is the user marked offline in the database."*

---

### Q3: "How do delivery and read receipts work under the hood?"
**Answer:**
- **Sent (`status: "sent"`)**: The message has been persisted to the database, but recipient clients are currently offline. Displayed as a single white/grey check.
- **Delivered (`status: "delivered"`)**: When the message is sent, the server queries active connections. If any recipient is online, the message status is immediately set to `"delivered"`, and a `message_status_updated` event is dispatched. Displayed as a double grey check.
- **Read (`status: "read"`)**: When a recipient views the conversation, the client emits a `mark_read` action (or POST `/conversations/{id}/read`). The server updates the recipient's `last_read_at`, updates unread message records to `"read"`, and broadcasts read receipts back to the sender. Displayed as a double bright Signal blue check.

---

### Q4: "What precautions did you take with SQLite in a concurrent application?"
**Answer:**
1. **Foreign Key Enforcement**: *"By default, SQLite turns foreign key enforcement OFF for historical backwards compatibility. I attached an event listener to SQLAlchemy’s Engine that executes `PRAGMA foreign_keys=ON` on every new connection to guarantee referential integrity and cascading deletes."*
2. **Thread Safety**: `connect_args={"check_same_thread": False}` was configured so SQLAlchemy's scoped sessions can be utilized across FastAPI’s async request threads safely.
3. **Compound Indexing**: *"To ensure fast message retrieval, I added a composite index on `(conversation_id, created_at)` so queries are indexed B-Tree lookups rather than table scans."*

---

### Q5: "How does your optimistic UI work on the frontend?"
**Answer:**
- *"When the user hits send, waiting for the server roundtrip creates perceived latency.*
- *In `ChatContext.tsx`, the client generates an optimistic message with a temporary `temp_id` and `status: 'sending'`, immediately appending it to the active message list.*
- *The WebSocket dispatches `{ temp_id, content, ... }`.*
- *When the server replies with `new_message` carrying the canonical database `id` and the matching `temp_id`, the client reconciles the message in place.*
- *This eliminates flickering, guarantees instant feedback, and handles offline transitions gracefully."*

---

### Q6: "How are disappearing messages handled?"
**Answer:**
- *"Each conversation stores a `disappearing_messages_timer` in seconds (e.g., 300 for 5 minutes).*
- *When a message is sent in that conversation, the server calculates `expires_at = datetime.utcnow() + timedelta(seconds=timer)`.*
- *During retrieval via `GET /conversations/{id}/messages`, an inline pruning query deletes all expired messages before returning results.*
- *In a production cloud environment, this is complemented by a lightweight cron worker running every minute."*

---

### Q7: "How would you transition this from simulated encryption to real Signal Protocol?"
**Answer:**
- *"To implement genuine end-to-end encryption:*
  1. *Integrate `@signalapp/libsignal-client` in the Next.js frontend.*
  2. *During registration, generate a master Identity Key Pair, Signed Prekey, and a pool of One-Time Prekeys, uploading the public keys to the server.*
  3. *To initiate a chat, the sender performs the Extended Triple Diffie-Hellman (**X3DH**) key agreement to establish a shared master secret.*
  4. *Messages are encrypted using the **Double Ratchet Algorithm** (combining symmetric key ratchet and DH ratchet for forward secrecy and post-compromise security).*
  5. *The server becomes a blind encrypted blob relay and has zero visibility into plaintext content."*

---

### Q8: "What are you most proud of in this codebase?"
**Answer:**
- *"The attention to detail:
  1. Zero warnings in both Python (Pydantic V2 ConfigDict) and Next.js builds.
  2. The multi-device WebSocket connection manager that isolates socket errors and handles multi-tab presence.
  3. Pure code Web Audio synthesis of Signal's authentic sound effects without needing external mp3 files.
  4. The 1-click evaluator persona switcher that allows immediate multi-user testing without tedious re-registration."*
