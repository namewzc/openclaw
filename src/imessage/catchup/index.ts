export {
  performIMessageCatchup,
  updateIMessageOffset,
  type CatchupConfig,
  type CatchupResult,
  type PerformCatchupOptions,
} from "./catchup.js";

export {
  getLatestMessageTimestamp,
  isDatabaseAccessible,
  queryMessagesSince,
  resolveDbPath,
  type MessageRow,
  type QueryMessagesOptions,
} from "./database.js";
