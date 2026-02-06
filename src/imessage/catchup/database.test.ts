import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isDatabaseAccessible, resolveDbPath } from "./database.js";

describe("iMessage database utilities", () => {
  describe("resolveDbPath", () => {
    it("returns default path when not specified", () => {
      const result = resolveDbPath();
      expect(result).toBe(path.join(os.homedir(), "Library/Messages/chat.db"));
    });

    it("expands tilde in path", () => {
      const result = resolveDbPath("~/Library/Messages/chat.db");
      expect(result).toBe(path.join(os.homedir(), "Library/Messages/chat.db"));
    });

    it("returns absolute path unchanged", () => {
      const result = resolveDbPath("/custom/path/chat.db");
      expect(result).toBe("/custom/path/chat.db");
    });

    it("handles empty string", () => {
      const result = resolveDbPath("");
      expect(result).toBe(path.join(os.homedir(), "Library/Messages/chat.db"));
    });

    it("handles whitespace-only string", () => {
      const result = resolveDbPath("   ");
      expect(result).toBe(path.join(os.homedir(), "Library/Messages/chat.db"));
    });
  });

  describe("isDatabaseAccessible", () => {
    it("returns false for non-existent database", () => {
      const result = isDatabaseAccessible("/nonexistent/path/chat.db");
      expect(result).toBe(false);
    });

    // Note: We cannot easily test the positive case without the actual Messages database
    // or creating a mock SQLite database. In CI/CD environments, the database won't exist.
  });

  // Note: queryMessagesSince and getLatestMessageTimestamp cannot be easily unit tested
  // without the actual macOS Messages database. These should be tested manually or
  // in integration tests with a mock database.
});
