// chat-worker/src/index.ts
//
// Standalone Worker hosting the ChatRoom Durable Object.
//
// The Pages project (cloudflare-demo-shop) binds to the ChatRoom class
// declared here and calls it via RPC + WebSocket. This Worker's own
// fetch() handler is only a thin guard so the script is deployable on
// its own; all real traffic arrives through the Pages Functions binding.
//
// ChatRoom responsibilities:
//   - Store the last messages in SQLite (transactional, survives restarts)
//   - Fan out new messages to every connected WebSocket (hibernation API)
//   - Clear all messages once per day at 17:00 UTC (12:00 PM EST) via alarm
//
// Single global room: the Pages layer always addresses getByName("global").

import { DurableObject } from "cloudflare:workers";

export interface Env {
  CHAT_ROOM: DurableObjectNamespace<ChatRoom>;
}

// Max messages retained / returned. Older rows are trimmed on insert.
const MAX_MESSAGES = 25;

// Daily reset time, in UTC hours. 17:00 UTC == 12:00 PM EST (UTC-5).
const RESET_HOUR_UTC = 17;

export interface ChatMessage {
  id: number;
  username: string;
  text: string;
  timestamp: number;
}

// Envelope broadcast to every connected client over WebSocket.
type Broadcast =
  | { type: "message"; data: ChatMessage }
  | { type: "clear" };

export class ChatRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Schema setup only — keep constructor cheap because hibernation
    // re-runs it on wake.
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          username  TEXT    NOT NULL,
          text      TEXT    NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);

      // Ensure the daily-clear alarm is always scheduled.
      const existing = await this.ctx.storage.getAlarm();
      if (existing === null) {
        await this.ctx.storage.setAlarm(nextResetTime());
      }
    });
  }

  // ── RPC: read last N messages + next reset timestamp ─────────
  getState(): { messages: ChatMessage[]; nextReset: number } {
    const rows = this.ctx.storage.sql
      .exec<ChatMessage>(
        "SELECT id, username, text, timestamp FROM messages ORDER BY id ASC"
      )
      .toArray();
    return { messages: rows, nextReset: nextResetTime() };
  }

  // ── RPC: store a message, trim history, broadcast to all WS ──
  sendMessage(username: string, text: string): ChatMessage {
    const timestamp = Date.now();

    this.ctx.storage.sql.exec(
      "INSERT INTO messages (username, text, timestamp) VALUES (?, ?, ?)",
      username,
      text,
      timestamp
    );

    // Capture the new row id immediately, before any further exec() can
    // invalidate the cursor, and build a plain object to broadcast.
    const id = Number(
      this.ctx.storage.sql.exec("SELECT last_insert_rowid() AS id").one().id
    );
    const message: ChatMessage = { id, username, text, timestamp };

    // Trim to the most recent MAX_MESSAGES rows.
    this.ctx.storage.sql.exec(
      `DELETE FROM messages WHERE id NOT IN (
         SELECT id FROM messages ORDER BY id DESC LIMIT ?
       )`,
      MAX_MESSAGES
    );

    this.broadcast({ type: "message", data: message });
    return message;
  }

  // ── RPC: wipe all messages, broadcast clear ──────────────────
  clearMessages(): void {
    this.ctx.storage.sql.exec("DELETE FROM messages");
    this.broadcast({ type: "clear" });
  }

  // ── WebSocket upgrade (clients connect here via Pages proxy) ─
  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get("Upgrade");
    if (upgrade !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernation: accept on the DO state, not server.accept(). The DO
    // can be evicted while sockets stay connected; messages wake it.
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // Clients are receive-only over WS (they POST to send), so just keep
  // the connection healthy. Reply to pings; ignore data frames.
  async webSocketMessage(ws: WebSocket, _message: string | ArrayBuffer) {
    // no-op: sending happens over REST, broadcast happens server-side
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason);
    } catch {
      // already closing
    }
  }

  // ── Alarm: daily clear, then reschedule for next 17:00 UTC ───
  async alarm(): Promise<void> {
    this.clearMessages();
    await this.ctx.storage.setAlarm(nextResetTime());
  }

  // Fan a payload out to every connected socket.
  private broadcast(payload: Broadcast): void {
    const json = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(json);
      } catch {
        // socket is gone; runtime will clean it up
      }
    }
  }
}

// Next occurrence of RESET_HOUR_UTC:00:00 UTC, as epoch ms.
function nextResetTime(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      RESET_HOUR_UTC,
      0,
      0,
      0
    )
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime();
}

// Minimal fetch handler so this script is independently deployable.
// Real traffic reaches ChatRoom through the Pages Functions binding.
export default {
  async fetch(): Promise<Response> {
    return new Response("ChatRoom DO worker. Bound to via Pages.", {
      status: 200,
    });
  },
} satisfies ExportedHandler<Env>;
