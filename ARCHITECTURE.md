# 🏛️ Architecture & System Design Deep Dive

This document outlines the architectural decisions, data flow protocols, concurrency considerations, and failure recovery mechanisms implemented in the Signal Messenger Clone. It is designed to prepare you for any technical deep-dive questions during an SDE interview at **Scaler Lab AI**.

---

## 1. High-Level System Architecture

```text
+-----------------------------------------------------------------------------------+
|                                Next.js Frontend                                   |
|                                                                                   |
|  +--------------------+   +---------------------+   +--------------------------+  |
|  |    AuthContext     |   |     ChatContext     |   |     WebSocketContext     |  |
|  | (Session & Tokens) |   | (Optimistic UI & DB)|   | (Heartbeat & Reconnect)  |  |
|  +--------------------+   +---------------------+   +--------------------------+  |
|            |                         |                           |                |
+------------|-------------------------|---------------------------|----------------+
             | REST                    | REST                      | WebSocket
             v                         v                           v
+-----------------------------------------------------------------------------------+
|                                FastAPI Backend                                    |
|                                                                                   |
|  +--------------------+   +---------------------+   +--------------------------+  |
|  |   Routers / API    |   |  WebSocket Gateway  |   |    ConnectionManager     |  |
|  |  (Auth, Chats, etc)|   |     (/ws?token=)    |   | (Dict[user_id, Set[ws]]) |  |
|  +--------------------+   +---------------------+   +--------------------------+  |
|            |                         |                           |                |
|            +------------+------------+---------------------------+                |
|                         |                                                         |
|                         v                                                         |
|             +-------------------------+                                           |
|             |  SQLAlchemy 2.0 Engine  |                                           |
|             | (PRAGMA foreign_keys=ON)|                                           |
|             +-------------------------+                                           |
|                         |                                                         |
|                         v                                                         |
|             +-------------------------+                                           |
|             |     SQLite Database     |                                           |
|             |      (signal.db)        |                                           |
|             +-------------------------+                                           |
+-----------------------------------------------------------------------------------+
```

---

## 2. Real-Time Communication & Concurrency

### 2.1 Multi-Tab / Multi-Device Multiplexing
In production chat applications, a single user often has multiple tabs or devices active simultaneously.
- **Naïve Approach**: Storing `active_connections: Dict[str, WebSocket]` overwrites earlier sockets when a user opens a second tab, causing older tabs to freeze or drop messages.
- **Our Implementation**:
  ```python
  class ConnectionManager:
      def __init__(self):
          self.active_connections: Dict[str, Set[WebSocket]] = {}
          self.lock = asyncio.Lock()
  ```
  Every user maps to a `Set[WebSocket]`. Outgoing messages are delivered to *all* active sockets belonging to the recipient. When one tab closes, only that specific socket is discarded. Only when the set becomes empty is the user marked offline in the database.

### 2.2 Graceful Dead-Socket Pruning (Failure Isolation)
During broadcasts across large group chats, a single client may encounter network drops, high packet loss, or a forced tab closure:
- In `send_to_user`, if `ws.send_text(...)` raises `RuntimeError` or `WebSocketDisconnect`, the exception is caught, logged, and the socket is scheduled for pruning.
- Transmission to remaining peers continues uninterrupted without crashing the ASGI worker thread.

### 2.3 Heartbeat Ping-Pong & Half-Open TCP Socket Detection
- WebSockets can silently enter a "half-open" state where the underlying TCP connection dies without an explicit `FIN/RST` packet (e.g. Wi-Fi drop or laptop lid close).
- The client dispatches `{"action": "ping"}` every 25 seconds. The server replies with `{"event": "pong"}`.
- If the socket fails to send or receive frames, the browser triggers `socket.onclose`, initiating exponential backoff reconnection.

### 2.4 Exponential Backoff with Jitter
```typescript
const baseDelay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 15000);
const jitter = Math.random() * 500;
const delay = baseDelay + jitter;
```
Adding random jitter prevents the "thundering herd" problem where hundreds of disconnected clients reconnect simultaneously and overwhelm the server after a transient network blip.

---

## 3. Frontend State Management & Optimistic UI

### 3.1 Eliminating Perceived Latency
When a user presses "Send", waiting for a server roundtrip before rendering the message bubble introduces sluggishness (especially on mobile networks).
- **Optimistic Insert**: The client generates a unique `temp_id = "temp_" + Date.now()` and immediately renders the message in the chat with a `status: "sending"` clock icon.
- **Server Dispatch**: The WebSocket frame transmits `{ content, conversation_id, temp_id }`.
- **Reconciliation**: When the server broadcasts `new_message` containing the persistent DB `id` and the original `temp_id`, the client finds the matching optimistic item and swaps it in place:
  ```typescript
  const index = existing.findIndex((m) => m.temp_id === temp_id || m.id === message.id);
  if (index !== -1) {
    const next = [...existing];
    next[index] = message; // status updated to "sent" / "delivered"
    return { ...prev, [convId]: next };
  }
  ```
  This delivers instant visual responsiveness with zero layout shift or duplicate messages.

---

## 4. Database Schema & Storage Engineering

### 4.1 SQLite Foreign Key Enforcement
SQLite disables foreign key enforcement by default for backwards compatibility with SQLite 2. Without explicit configuration, deleting a conversation would leave dangling `messages` and `participants` rows.
- We attach an event listener to SQLAlchemy's engine:
  ```python
  @event.listens_for(Engine, "connect")
  def set_sqlite_pragma(dbapi_connection, connection_record):
      cursor = dbapi_connection.cursor()
      cursor.execute("PRAGMA foreign_keys=ON")
      cursor.close()
  ```
  This guarantees that all `cascade="all, delete-orphan"` and `ondelete="CASCADE"` constraints are enforced at the C-level SQLite engine.

### 4.2 Composite Unique Constraints
- `uq_user_contact`: `(user_id, contact_user_id)` ensures a user cannot add the same contact multiple times.
- `uq_conversation_participant`: `(conversation_id, user_id)` ensures a user cannot be added twice to the same group.
- `uq_message_user_emoji`: `(message_id, user_id, emoji)` ensures a user cannot react with duplicate emoji on the same message.

### 4.3 Composite Query Indexing
Messages are frequently queried by `conversation_id` sorted chronologically:
```python
Index("ix_messages_conv_created", "conversation_id", "created_at")
```
This compound B-Tree index provides $O(\log N)$ lookups without performing table scans or runtime file sorts.

---

## 5. Disappearing Messages Architecture

### 5.1 Expiration Calculation
When a conversation has `disappearing_messages_timer > 0`:
$$\text{expires\_at} = \text{created\_at} + \Delta t$$
The exact expiration timestamp is stored in the database.

### 5.2 Two-Tiered Cleanup Strategy
1. **Passive Cleanup on Read**: Whenever messages are fetched via `GET /conversations/{id}/messages`, an inline query prunes expired records:
   ```python
   DELETE FROM messages WHERE conversation_id = :id AND expires_at <= :now
   ```
2. **Background Cron / Task (Production)**: In a high-traffic production system, a background worker runs every 60 seconds executing:
   ```sql
   DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP;
   ```

---

## 6. How to Scale This Architecture to 1M+ Users

If asked in the interview how you would take this architecture from a single-node prototype to 1,000,000 concurrent users:

1. **Distributed WebSocket Gateway (Redis Pub/Sub)**:
   - Currently, `ConnectionManager` is in-memory on one server instance.
   - For horizontal scaling, deploy multiple FastAPI nodes behind an AWS ALB (Application Load Balancer) with sticky sessions or WebSocket upgrading.
   - Use **Redis Pub/Sub** or **Redis Streams** as the distributed message bus: when User A sends a message on Node 1 to User B connected on Node 3, Node 1 publishes to channel `chat:{conv_id}`, and Node 3 receives and pushes the frame to User B.
2. **Relational Database Migration**:
   - Seamlessly switch SQLAlchemy's connection string from `sqlite:///signal.db` to **PostgreSQL** with connection pooling (e.g., PgBouncer).
   - Use read replicas for historical message queries and master for writes.
3. **Media Storage**:
   - Replace `/uploads` local filesystem with **AWS S3 / Google Cloud Storage** with presigned upload URLs.
4. **End-to-End Encryption**:
   - Implement the **Signal Protocol (Double Ratchet + X3DH Key Exchange)** using `libsignal-client` on the frontend, treating the server as an untrusted blind relay.
