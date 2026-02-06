import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getIMessageOffsetPath,
  readIMessageOffset,
  writeIMessageOffset,
} from "./message-offset-store.js";

async function withTempStateDir<T>(fn: (dir: string) => Promise<T>) {
  const previous = process.env.OPENCLAW_STATE_DIR;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-imessage-"));
  process.env.OPENCLAW_STATE_DIR = dir;
  try {
    return await fn(dir);
  } finally {
    if (previous === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previous;
    }
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("iMessage offset store", () => {
  it("persists and reloads the last processed timestamp", async () => {
    await withTempStateDir(async () => {
      expect(await readIMessageOffset({ accountId: "primary" })).toBeNull();

      const timestamp = Math.floor(Date.now() / 1000);
      await writeIMessageOffset({
        accountId: "primary",
        lastProcessedAt: timestamp,
        lastMessageId: 12345,
      });

      const result = await readIMessageOffset({ accountId: "primary" });
      expect(result).not.toBeNull();
      expect(result?.lastProcessedAt).toBe(timestamp);
      expect(result?.lastMessageId).toBe(12345);
    });
  });

  it("handles missing message id", async () => {
    await withTempStateDir(async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      await writeIMessageOffset({
        accountId: "test",
        lastProcessedAt: timestamp,
        lastMessageId: null,
      });

      const result = await readIMessageOffset({ accountId: "test" });
      expect(result).not.toBeNull();
      expect(result?.lastProcessedAt).toBe(timestamp);
      expect(result?.lastMessageId).toBeNull();
    });
  });

  it("uses default account id when not specified", async () => {
    await withTempStateDir(async (dir) => {
      await writeIMessageOffset({
        lastProcessedAt: 1000,
        lastMessageId: null,
      });

      const expectedPath = path.join(dir, "imessage", "message-offset-default.json");
      const exists = await fs
        .access(expectedPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  it("normalizes account id for file names", async () => {
    await withTempStateDir(async (dir) => {
      const accountId = "special/account@name";
      await writeIMessageOffset({
        accountId,
        lastProcessedAt: 2000,
        lastMessageId: null,
      });

      const resolvedPath = getIMessageOffsetPath(accountId);
      expect(resolvedPath).toContain("message-offset-special_account_name.json");
    });
  });

  it("returns null for corrupted state file", async () => {
    await withTempStateDir(async (dir) => {
      const stateDir = path.join(dir, "imessage");
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(path.join(stateDir, "message-offset-default.json"), "not valid json");

      const result = await readIMessageOffset({});
      expect(result).toBeNull();
    });
  });

  it("returns null for state file with wrong version", async () => {
    await withTempStateDir(async (dir) => {
      const stateDir = path.join(dir, "imessage");
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(
        path.join(stateDir, "message-offset-default.json"),
        JSON.stringify({ version: 999, lastProcessedAt: 1000, lastMessageId: null }),
      );

      const result = await readIMessageOffset({});
      expect(result).toBeNull();
    });
  });
});
