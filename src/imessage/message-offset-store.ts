import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";

const STORE_VERSION = 1;

export type IMessageOffsetState = {
  version: number;
  /** Unix timestamp (seconds) of last processed message */
  lastProcessedAt: number | null;
  /** ROWID from message table */
  lastMessageId: number | null;
};

function normalizeAccountId(accountId?: string) {
  const trimmed = accountId?.trim();
  if (!trimmed) {
    return "default";
  }
  return trimmed.replace(/[^a-z0-9._-]+/gi, "_");
}

function resolveIMessageOffsetPath(
  accountId?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const stateDir = resolveStateDir(env, os.homedir);
  const normalized = normalizeAccountId(accountId);
  return path.join(stateDir, "imessage", `message-offset-${normalized}.json`);
}

function safeParseState(raw: string): IMessageOffsetState | null {
  try {
    const parsed = JSON.parse(raw) as IMessageOffsetState;
    if (parsed?.version !== STORE_VERSION) {
      return null;
    }
    if (parsed.lastProcessedAt !== null && typeof parsed.lastProcessedAt !== "number") {
      return null;
    }
    if (parsed.lastMessageId !== null && typeof parsed.lastMessageId !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function readIMessageOffset(params: {
  accountId?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<IMessageOffsetState | null> {
  const filePath = resolveIMessageOffsetPath(params.accountId, params.env);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return safeParseState(raw);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return null;
    }
    return null;
  }
}

export async function writeIMessageOffset(params: {
  accountId?: string;
  lastProcessedAt: number;
  lastMessageId: number | null;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const filePath = resolveIMessageOffsetPath(params.accountId, params.env);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const tmp = path.join(dir, `${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  const payload: IMessageOffsetState = {
    version: STORE_VERSION,
    lastProcessedAt: params.lastProcessedAt,
    lastMessageId: params.lastMessageId,
  };
  await fs.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf-8",
  });
  await fs.chmod(tmp, 0o600);
  await fs.rename(tmp, filePath);
}

/** For testing: resolve the path without writing */
export function getIMessageOffsetPath(
  accountId?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveIMessageOffsetPath(accountId, env);
}
