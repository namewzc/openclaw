/**
 * Live test for Code Relay (custom Anthropic-compatible endpoint).
 * Run with: CODE_RELAY_LIVE_TEST=1 CODE_RELAY_API_KEY=sk-... pnpm test -- code-relay.live
 */
import { completeSimple, type Model } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { isTruthyEnvValue } from "../infra/env.js";

const CODE_RELAY_API_KEY = process.env.CODE_RELAY_API_KEY ?? "";
const CODE_RELAY_BASE_URL = process.env.CODE_RELAY_BASE_URL?.trim() || "https://api.code-relay.com";
const CODE_RELAY_MODEL = process.env.CODE_RELAY_MODEL?.trim() || "claude-sonnet-4-20250514";
const LIVE =
  isTruthyEnvValue(process.env.CODE_RELAY_LIVE_TEST) || isTruthyEnvValue(process.env.LIVE);

const describeLive = LIVE && CODE_RELAY_API_KEY ? describe : describe.skip;

/** Anthropic-compatible GET /v1/models response (list models). */
type ModelInfo = { id: string; display_name?: string; created_at?: string; type?: string };

function makeModel(): Model<"anthropic-messages"> {
  return {
    id: CODE_RELAY_MODEL,
    name: `Code Relay (${CODE_RELAY_MODEL})`,
    api: "anthropic-messages",
    provider: "code-relay",
    baseUrl: CODE_RELAY_BASE_URL,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 8192,
  };
}

describeLive("code-relay live (Anthropic-compatible endpoint)", () => {
  it("lists available models (GET /v1/models)", async () => {
    const url = `${CODE_RELAY_BASE_URL.replace(/\/$/, "")}/v1/models`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${CODE_RELAY_API_KEY}`,
        "x-api-key": CODE_RELAY_API_KEY,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!res.ok) {
      console.log("\n[code-relay] GET /v1/models failed:", res.status, await res.text());
      expect(res.ok).toBe(true);
      return;
    }
    const data = (await res.json()) as {
      data?: ModelInfo[];
      model?: ModelInfo[];
      models?: ModelInfo[];
    };
    const list = data.data ?? data.models ?? data.model ?? [];
    const models = Array.isArray(list) ? list : [];
    console.log("\n[code-relay] 可用模型 (available models):");
    if (models.length === 0) {
      console.log(
        "  (none or unexpected response shape; raw keys:",
        Object.keys(data).join(", "),
        ")",
      );
    } else {
      for (const m of models) {
        const id = typeof m?.id === "string" ? m.id : "";
        const name =
          typeof (m as ModelInfo)?.display_name === "string" ? (m as ModelInfo).display_name : id;
        console.log(`  - ${id}  (${name})`);
      }
    }
    expect(Array.isArray(list)).toBe(true);
  }, 15000);

  it("returns assistant text via custom baseUrl and apiKey", async () => {
    const question = "Reply with the word ok.";
    const res = await completeSimple(
      makeModel(),
      {
        messages: [{ role: "user", content: question, timestamp: Date.now() }],
      },
      { apiKey: CODE_RELAY_API_KEY, maxTokens: 64 },
    );
    const text = res.content
      .filter((block) => block.type === "text")
      .map((block) => block.text.trim())
      .join(" ");
    expect(text.length).toBeGreaterThan(0);
  }, 20000);

  it("simulates question and prints output (demo)", async () => {
    const question = "1+1等于几？只回答一个数字。";
    const res = await completeSimple(
      makeModel(),
      {
        messages: [{ role: "user", content: question, timestamp: Date.now() }],
      },
      { apiKey: CODE_RELAY_API_KEY, maxTokens: 32 },
    );
    const output = res.content
      .filter((block) => block.type === "text")
      .map((block) => block.text.trim())
      .join(" ")
      .trim();
    // Log for demo: 问题 -> 输出
    console.log("\n[code-relay demo] 问题:", question);
    console.log("[code-relay demo] 输出:", output || "(empty)");
    expect(output.length).toBeGreaterThan(0);
  }, 20000);

  it("asks '你是什么模型' and prints reply", async () => {
    const question = "你是什么模型？";
    const res = await completeSimple(
      makeModel(),
      {
        messages: [{ role: "user", content: question, timestamp: Date.now() }],
      },
      { apiKey: CODE_RELAY_API_KEY, maxTokens: 256 },
    );
    const output = res.content
      .filter((block) => block.type === "text")
      .map((block) => block.text.trim())
      .join(" ")
      .trim();
    console.log("\n[code-relay demo] 问题:", question);
    console.log("[code-relay demo] 输出:", output || "(empty)");
    expect(output.length).toBeGreaterThan(0);
  }, 20000);

  /**
   * Probe which system prompt format Code Relay accepts (they may return 500 "claude system prompt not allowed").
   * Runs POST /v1/messages with different system payloads and logs status.
   */
  it("probes system prompt: no system vs empty vs minimal vs OpenClaw identity", async () => {
    const url = `${CODE_RELAY_BASE_URL.replace(/\/$/, "")}/v1/messages`;
    const baseBody = {
      model: CODE_RELAY_MODEL,
      max_tokens: 32,
      messages: [{ role: "user", content: "Reply with the word ok." }],
    };
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": CODE_RELAY_API_KEY,
      "anthropic-version": "2023-06-01",
    };

    const cases: { label: string; body: Record<string, unknown> }[] = [
      { label: "no system key", body: { ...baseBody } },
      { label: "system: ''", body: { ...baseBody, system: "" } },
      { label: "system: 'You are helpful.'", body: { ...baseBody, system: "You are helpful." } },
      {
        label: "system: OpenClaw identity (none mode)",
        body: {
          ...baseBody,
          system: "You are a personal assistant running inside OpenClaw.",
        },
      },
    ];

    console.log("\n[code-relay] System prompt probe (POST /v1/messages):");
    const results: boolean[] = [];
    for (const { label, body } of cases) {
      const res = await fetch(url, {
        method: "POST",
        headers: { ...headers, Authorization: `Bearer ${CODE_RELAY_API_KEY}` },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let parsed: { error?: { message?: string } } | null = null;
      try {
        parsed = JSON.parse(text) as { error?: { message?: string } };
      } catch {
        // ignore
      }
      const errMsg = parsed?.error?.message ?? (res.ok ? "" : text.slice(0, 120));
      console.log(`  ${res.ok ? "✓" : "✗"} ${label} → ${res.status} ${errMsg ? errMsg : ""}`);
      results.push(res.ok);
    }
    expect(results.some(Boolean)).toBe(true);
  }, 30000);
});
