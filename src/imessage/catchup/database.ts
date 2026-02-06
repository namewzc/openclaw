import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { IMessagePayload } from "../monitor/types.js";
import { requireNodeSqlite } from "../../memory/sqlite.js";

/**
 * macOS epoch offset: seconds between Unix epoch (1970-01-01) and macOS epoch (2001-01-01).
 * Used in SQL queries to convert macOS nanosecond timestamps to Unix seconds.
 * Formula: unix_seconds = (macos_nanos / 1e9) + 978307200
 */
const MACOS_EPOCH_OFFSET_SECONDS = 978307200;

export type MessageRow = {
  id: number;
  text: string | null;
  timestamp_unix: number;
  is_from_me: number;
  chat_id: number;
  chat_identifier: string | null;
  chat_name: string | null;
  sender: string | null;
  is_group: number;
  attributedBody: Buffer | null;
};

export type QueryMessagesOptions = {
  /** Path to chat.db (defaults to ~/Library/Messages/chat.db) */
  dbPath?: string;
  /** Unix timestamp (seconds) to query messages after */
  sinceTimestamp: number;
  /** Maximum number of messages to return */
  limit?: number;
  /** Busy timeout in milliseconds (default 5000) */
  busyTimeoutMs?: number;
};

/**
 * Resolve the database path, expanding ~ if needed
 */
export function resolveDbPath(dbPath?: string): string {
  const resolved = dbPath?.trim() || "~/Library/Messages/chat.db";
  if (resolved.startsWith("~/")) {
    return path.join(os.homedir(), resolved.slice(2));
  }
  return resolved;
}

/**
 * Check if the Messages database exists and is readable
 */
export function isDatabaseAccessible(dbPath?: string): boolean {
  const resolved = resolveDbPath(dbPath);
  try {
    fs.accessSync(resolved, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract text from attributedBody blob if text is empty.
 * The attributedBody is a binary plist containing NSAttributedString data.
 * This is a simplified extraction that looks for the UTF-8 text within.
 */
function extractTextFromAttributedBody(blob: Buffer | null): string | null {
  if (!blob || blob.length === 0) {
    return null;
  }
  // Look for NSString marker and extract UTF-8 text after it
  // This is a heuristic approach; the blob is a serialized NSAttributedString
  try {
    const str = blob.toString("utf-8");
    // Find text between common markers - simplified extraction
    const match = str.match(/NSString[^\x00-\x1f]*?([\x20-\x7e\u0080-\uffff]+)/);
    if (match?.[1]) {
      return match[1].trim() || null;
    }
    // Fallback: try to find any readable text
    const readable = str.replace(/[^\x20-\x7e\u0080-\uffff]+/g, " ").trim();
    return readable.length > 0 ? readable : null;
  } catch {
    return null;
  }
}

/**
 * Query messages from the Messages database since a given timestamp.
 *
 * Requires Full Disk Access permission for the process.
 */
export function queryMessagesSince(opts: QueryMessagesOptions): IMessagePayload[] {
  const dbPath = resolveDbPath(opts.dbPath);
  const limit = opts.limit ?? 100;
  const busyTimeoutMs = opts.busyTimeoutMs ?? 5000;

  if (!isDatabaseAccessible(opts.dbPath)) {
    return [];
  }

  const sqlite = requireNodeSqlite();
  const db = new sqlite.DatabaseSync(dbPath, { open: true, readOnly: true });

  try {
    // Set busy timeout for when Messages.app has the DB locked
    db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);

    // Query messages since the given timestamp
    // Note: We use LEFT JOINs because some messages may not have all relations
    // Date conversion is done in SQL to avoid JavaScript number precision issues
    // (macOS stores dates as nanoseconds which exceed Number.MAX_SAFE_INTEGER)
    const query = `
      SELECT 
        m.ROWID as id,
        m.text,
        CAST(m.date / 1000000000 + ${MACOS_EPOCH_OFFSET_SECONDS} AS INTEGER) as timestamp_unix,
        m.is_from_me,
        m.attributedBody,
        c.ROWID as chat_id,
        c.chat_identifier,
        c.display_name as chat_name,
        c.group_id,
        h.id as sender
      FROM message m
      JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
      JOIN chat c ON cmj.chat_id = c.ROWID
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE m.date / 1000000000 + ${MACOS_EPOCH_OFFSET_SECONDS} > ?
      ORDER BY m.date ASC
      LIMIT ?
    `;

    const stmt = db.prepare(query);
    // Pass sinceTimestamp directly (Unix seconds) since conversion now happens in SQL
    const rows = stmt.all(opts.sinceTimestamp, limit) as Array<{
      id: number;
      text: string | null;
      timestamp_unix: number;
      is_from_me: number;
      attributedBody: Buffer | null;
      chat_id: number;
      chat_identifier: string | null;
      chat_name: string | null;
      group_id: string | null;
      sender: string | null;
    }>;

    return rows.map((row) => {
      // Try to get text from text field, fall back to attributedBody
      let messageText = row.text;
      if (!messageText && row.attributedBody) {
        messageText = extractTextFromAttributedBody(row.attributedBody);
      }

      const isGroup = row.group_id != null && row.group_id.length > 0;

      return {
        id: row.id,
        chat_id: row.chat_id,
        sender: row.is_from_me ? null : row.sender,
        is_from_me: row.is_from_me === 1,
        text: messageText,
        created_at: new Date(row.timestamp_unix * 1000).toISOString(),
        chat_identifier: row.chat_identifier,
        chat_name: row.chat_name,
        is_group: isGroup,
      } satisfies IMessagePayload;
    });
  } finally {
    db.close();
  }
}

/**
 * Get the timestamp of the most recent message in the database.
 * Used to initialize the offset state on first run.
 */
export function getLatestMessageTimestamp(dbPath?: string): number | null {
  const resolved = resolveDbPath(dbPath);

  if (!isDatabaseAccessible(dbPath)) {
    return null;
  }

  const sqlite = requireNodeSqlite();
  const db = new sqlite.DatabaseSync(resolved, { open: true, readOnly: true });

  try {
    db.exec("PRAGMA busy_timeout = 5000");

    // Do date conversion in SQL to avoid JavaScript number precision issues
    const query = `SELECT CAST(MAX(date) / 1000000000 + ${MACOS_EPOCH_OFFSET_SECONDS} AS INTEGER) as max_timestamp FROM message`;
    const stmt = db.prepare(query);
    const row = stmt.get() as { max_timestamp: number | null } | undefined;

    return row?.max_timestamp ?? null;
  } finally {
    db.close();
  }
}
