import type { IMessagePayload } from "../monitor/types.js";
import { readIMessageOffset, writeIMessageOffset } from "../message-offset-store.js";
import {
  getLatestMessageTimestamp,
  isDatabaseAccessible,
  queryMessagesSince,
  resolveDbPath,
} from "./database.js";

export type CatchupConfig = {
  /** Whether catch-up is enabled (default: true) */
  enabled?: boolean;
  /** Maximum messages to process per catch-up (default: 100) */
  maxMessages?: number;
  /** Ignore messages older than N hours (default: 24) */
  maxAgeHours?: number;
};

export type PerformCatchupOptions = {
  /** Path to Messages database */
  dbPath?: string;
  /** Account ID for state persistence */
  accountId?: string;
  /** Handler to process each caught-up message */
  handleMessage: (payload: IMessagePayload) => Promise<void>;
  /** Catch-up configuration */
  config?: CatchupConfig;
  /** Log function (default: console.log) */
  log?: (message: string) => void;
};

export type CatchupResult = {
  /** Number of messages processed */
  processed: number;
  /** Whether catch-up was skipped (first run, disabled, or no access) */
  skipped: boolean;
  /** Reason for skipping if applicable */
  skipReason?: string;
};

/**
 * Perform catch-up by reading missed messages from the Messages database.
 *
 * On first run, initializes the offset to the current latest message and skips catch-up.
 * On subsequent runs, queries messages since the last processed timestamp.
 */
export async function performIMessageCatchup(opts: PerformCatchupOptions): Promise<CatchupResult> {
  const log = opts.log ?? ((msg: string) => console.log(msg));
  const config = opts.config ?? {};
  const enabled = config.enabled !== false;
  const maxMessages = config.maxMessages ?? 100;
  const maxAgeHours = config.maxAgeHours ?? 24;

  // Check if catch-up is enabled
  if (!enabled) {
    return { processed: 0, skipped: true, skipReason: "disabled" };
  }

  // Check database accessibility
  const dbPath = resolveDbPath(opts.dbPath);
  if (!isDatabaseAccessible(opts.dbPath)) {
    log(`[imessage] Catch-up skipped: database not accessible at ${dbPath}`);
    return { processed: 0, skipped: true, skipReason: "database_not_accessible" };
  }

  // Read current offset state
  const offsetState = await readIMessageOffset({ accountId: opts.accountId });
  const now = Math.floor(Date.now() / 1000);
  const maxAgeSeconds = maxAgeHours * 60 * 60;
  const minTimestamp = now - maxAgeSeconds;

  // Determine effective timestamp for catch-up query
  let effectiveTimestamp: number;
  let isFirstRun = false;

  if (!offsetState || offsetState.lastProcessedAt == null) {
    // First run: catch up messages from the last maxAgeHours
    isFirstRun = true;
    effectiveTimestamp = minTimestamp;
    log(
      `[imessage] First run: catching up messages since ${new Date(minTimestamp * 1000).toLocaleString()}`,
    );
  } else {
    // Use the more recent of lastProcessedAt or minTimestamp
    effectiveTimestamp = Math.max(offsetState.lastProcessedAt, minTimestamp);
    if (effectiveTimestamp > offsetState.lastProcessedAt) {
      log(
        `[imessage] Catch-up: limiting to last ${maxAgeHours}h (${now - offsetState.lastProcessedAt}s since last process)`,
      );
    }
  }

  // Query missed messages
  const messages = queryMessagesSince({
    dbPath: opts.dbPath,
    sinceTimestamp: effectiveTimestamp,
    limit: maxMessages,
  });

  if (messages.length === 0) {
    // On first run with no messages, initialize the offset to now
    if (isFirstRun) {
      await writeIMessageOffset({
        accountId: opts.accountId,
        lastProcessedAt: now,
        lastMessageId: null,
      });
    }
    return { processed: 0, skipped: false };
  }

  log(`[imessage] Catch-up: processing ${messages.length} missed messages`);

  let processed = 0;
  let lastTimestamp = effectiveTimestamp;
  let lastId: number | null = null;

  for (const message of messages) {
    try {
      // Skip messages from self
      if (message.is_from_me) {
        continue;
      }

      await opts.handleMessage(message);
      processed++;

      // Update tracking
      if (message.created_at) {
        const msgTimestamp = Math.floor(new Date(message.created_at).getTime() / 1000);
        if (msgTimestamp > lastTimestamp) {
          lastTimestamp = msgTimestamp;
          lastId = message.id ?? null;
        }
      }
    } catch (err) {
      log(`[imessage] Catch-up: error processing message ${message.id}: ${err}`);
      // Continue processing other messages
    }
  }

  // Update offset state
  if (lastTimestamp > effectiveTimestamp || lastId !== null) {
    await writeIMessageOffset({
      accountId: opts.accountId,
      lastProcessedAt: lastTimestamp,
      lastMessageId: lastId,
    });
  }

  return { processed, skipped: false };
}

/**
 * Update the offset state after processing a live message.
 * Called from the monitor when a new message is processed.
 */
export async function updateIMessageOffset(params: {
  accountId?: string;
  message: IMessagePayload;
}): Promise<void> {
  const { message, accountId } = params;

  if (!message.created_at) {
    return;
  }

  const timestamp = Math.floor(new Date(message.created_at).getTime() / 1000);
  const messageId = message.id ?? null;

  await writeIMessageOffset({
    accountId,
    lastProcessedAt: timestamp,
    lastMessageId: messageId,
  });
}
