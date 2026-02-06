---
summary: "Use Code Relay (Anthropic-compatible) in OpenClaw"
read_when:
  - You want to use Code Relay as a model provider
  - You need to configure base URL and API key for Code Relay
title: "Code Relay"
---

# Code Relay

Code Relay exposes an Anthropic-compatible API. Configure it as a custom provider
`code-relay` with your base URL and API key, then add the models you want to use.

## List available models

To see which models your Code Relay endpoint supports, run the live test:

```bash
CODE_RELAY_LIVE_TEST=1 CODE_RELAY_API_KEY='your-key' pnpm exec vitest run --config vitest.live.config.ts src/agents/code-relay.live.test.ts -t "lists available" --reporter=verbose
```

The test calls `GET /v1/models` (with `Authorization: Bearer <key>`) and prints the list.
Use the printed model IDs in the config below.

## Config example (all Claude models)

Paste this into your OpenClaw config (`~/.openclaw/openclaw.json` or via `openclaw config set`).
Replace the `apiKey` value with your key (or use `"${CODE_RELAY_API_KEY}"` and set the env var).

```json5
{
  models: {
    mode: "merge",
    providers: {
      "code-relay": {
        baseUrl: "https://api.code-relay.com",
        apiKey: "sk-...",
        api: "anthropic-messages",
        models: [
          {
            id: "claude-3-5-haiku-20241022",
            name: "Claude 3.5 Haiku",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
          {
            id: "claude-3-5-sonnet-20241022",
            name: "Claude 3.5 Sonnet",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
          {
            id: "claude-3-7-sonnet-20250219",
            name: "Claude 3.7 Sonnet",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
          {
            id: "claude-haiku-4-5-20251001",
            name: "Claude Haiku 4.5",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
          {
            id: "claude-opus-4-1-20250805",
            name: "Claude Opus 4.1",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
          {
            id: "claude-opus-4-20250514",
            name: "Claude Opus 4",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
          {
            id: "claude-opus-4-5-20251101",
            name: "Claude Opus 4.5",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
          {
            id: "claude-sonnet-4-20250514",
            name: "Claude Sonnet 4",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
          {
            id: "claude-sonnet-4-5-20250929",
            name: "Claude Sonnet 4.5",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
  agents: {
    defaults: {
      model: { primary: "code-relay/claude-sonnet-4-20250514" },
      models: {
        "code-relay/claude-3-5-haiku-20241022": { alias: "Code Relay Haiku" },
        "code-relay/claude-sonnet-4-20250514": { alias: "Code Relay Sonnet" },
        "code-relay/claude-opus-4-5-20251101": { alias: "Code Relay Opus" },
      },
    },
  },
}
```

- **baseUrl**: Use `https://api.code-relay.com` (no trailing slash; OpenClaw appends `/v1`).
- **apiKey**: Your Code Relay API key. Prefer env: `"${CODE_RELAY_API_KEY}"`.
- **models**: Each entry needs `id`, `name`, `reasoning`, `input`, `cost`, `contextWindow`, `maxTokens`. Add or remove rows to match the list from `GET /v1/models`.
- **agents.defaults.model.primary**: Default model ref; use `code-relay/<id>`.
- **agents.defaults.models**: Optional aliases so the UI shows friendly names (e.g. "Code Relay Sonnet").

After saving, restart the gateway. In the Mac app or web UI, the model dropdown will list all configured `code-relay/*` models so you can switch between them.

## Optional: only list models (no assertion)

If your endpoint does not support `GET /v1/models` or uses different auth, run the list test without failing:

```bash
CODE_RELAY_LIVE_TEST=1 CODE_RELAY_API_KEY='your-key' pnpm exec vitest run --config vitest.live.config.ts src/agents/code-relay.live.test.ts -t "lists available" --reporter=verbose 2>&1 | cat
```

If you see "GET /v1/models failed", add model IDs manually from your provider’s documentation into `models.providers.code-relay.models`.

## Troubleshooting: no reply / 401

If the agent does not reply or you see auth errors:

1. **Replace the placeholder key**  
   The example config uses `"apiKey": "sk-..."`. You must replace that with your real Code Relay API key. If you leave the literal `sk-...`, the gateway will send it and get 401.

2. **Use an environment variable**  
   Set `CODE_RELAY_API_KEY` where the gateway runs, then in config set `"apiKey": "${CODE_RELAY_API_KEY}"` so OpenClaw substitutes it when loading config.

3. **Check gateway logs**  
   Run `openclaw doctor` and check gateway logs for `No API key resolved for provider "code-relay"` or HTTP 401 from the API.

4. **Restart the gateway after changing config**  
   Config (including `models.providers.code-relay.apiKey`) is loaded once when the gateway starts. If you edit the config while the gateway is already running, you must **restart the gateway** (stop and start `openclaw gateway run` or restart the Mac app) for the new key to be used.

5. **HTTP 500: "claude system prompt not allowed"**  
   Code Relay rejects any `system` parameter (including an empty string). OpenClaw handles this by:
   - Omitting the `system` field from the API request entirely
   - Injecting a condensed bootstrap context into the **first user message** of each session

   The bootstrap includes essential context (workspace path, available tools, basic behavior guidelines) so the model can still function effectively. Subsequent messages in the same session do not include the bootstrap.

   If you still see this error after restarting the gateway, the relay may have changed policy; consider using another provider or contacting Code Relay support.

6. **"request ended without sending any chunks"**  
   This can appear when the model returns no streamed content (e.g. empty response). The gateway was updated to always send at least one content chunk (or a fallback message) before closing the stream when using the OpenAI-compatible HTTP API. Restart the gateway to pick up the fix. If the issue persists, check gateway logs for Code Relay errors or timeouts.

7. **No tools**  
   Code-Relay returns empty responses when tools (read/write/edit/exec) are sent. OpenClaw therefore runs Code-Relay without tools. The model outputs text only; it cannot write files. Use another provider when you need tool use (e.g. Qwen for coding with file writes).

8. **Empty assistant bubble / usage shows 0 output tokens**  
   OpenClaw disables Anthropic prompt caching (`cache_control`) for Code-Relay because the relay may not support it and can return empty responses. If you still see empty replies:
   - Enable `OPENCLAW_ANTHROPIC_PAYLOAD_LOG=1` and inspect `~/.openclaw/logs/anthropic-payload.jsonl` for the exact request and usage.
   - Ensure messages alternate user/assistant; clear or reset the session if you had consecutive user messages from earlier failed runs.
