// End-to-end tests of the Edge Function handler with Supabase and the AI providers mocked.
import assert from "node:assert/strict";

const SB = "https://project.supabase.test";
Deno.env.set("SUPABASE_URL", SB);
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
Deno.env.set("ANTHROPIC_API_KEY", "a-key");
Deno.env.set("GEMINI_API_KEY", "g-key");
Deno.env.set("ALLOWED_ORIGINS", "https://app.example.com");

// Capture the handler instead of opening a port.
let handler!: (req: Request) => Promise<Response>;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: (req: Request) => Promise<Response>) => {
  handler = h;
  return {};
};

// ── Mock world ────────────────────────────────────────────────────────────────
const state = {
  quota: { tokens_used: 100, tokens_limit: 50000, is_over_limit: false } as Record<string, unknown>,
  quotaFails: false,
  inserted: [] as Record<string, unknown>[],
  upstreamStatus: 200,
  upstreamCalls: [] as { url: string; headers: Headers; body: Record<string, unknown> }[],
};
const sse = (events: unknown[]) =>
  new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  });
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = (input: Request | URL | string, init?: RequestInit) => {
  const req = new Request(input, init);
  const url = req.url;
  if (url.startsWith(`${SB}/auth/v1/user`)) {
    return Promise.resolve(
      req.headers.get("authorization") === "Bearer good-token"
        ? jsonRes({ id: "user-1", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "" })
        : jsonRes({ message: "invalid" }, 401),
    );
  }
  if (url.includes("/rest/v1/rpc/check_tutor_quota")) {
    return Promise.resolve(state.quotaFails ? jsonRes({ message: "boom" }, 500) : jsonRes([state.quota]));
  }
  if (url.includes("/rest/v1/ai_tutor_usage")) {
    return req.json().then((row) => {
      state.inserted.push(row);
      return new Response(null, { status: 201 });
    });
  }
  if (url.startsWith("https://api.anthropic.com/") || url.startsWith("https://generativelanguage.googleapis.com/")) {
    return req.json().then((body) => {
      state.upstreamCalls.push({ url, headers: req.headers, body });
      if (state.upstreamStatus !== 200) return jsonRes({ error: "upstream" }, state.upstreamStatus);
      return url.includes("anthropic")
        ? sse([
          { type: "message_start", message: { usage: { input_tokens: 40 } } },
          { type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } },
          { type: "content_block_delta", delta: { type: "text_delta", text: "Amina" } },
          { type: "message_delta", usage: { output_tokens: 7 } },
        ])
        : sse([
          { candidates: [{ content: { parts: [{ text: "Hi " }] } }] },
          { candidates: [{ content: { parts: [{ text: "there" }] } }], usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 5 } },
        ]);
    });
  }
  throw new Error(`unexpected fetch ${url}`);
};

await import("./index.ts");

const call = (body: unknown, token: string | null = "good-token", extra: RequestInit = {}) =>
  handler(
    new Request("https://fn.test/ai-tutor", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
      ...extra,
    }),
  );
const reset = () => {
  state.quota = { tokens_used: 100, tokens_limit: 50000, is_over_limit: false };
  state.quotaFails = false;
  state.inserted = [];
  state.upstreamStatus = 200;
  state.upstreamCalls = [];
};

Deno.test("401 without a token or with an invalid token, and no model call is made", async () => {
  reset();
  assert.equal((await call({ prompt: "hi" }, null)).status, 401);
  assert.equal((await call({ prompt: "hi" }, "bad-token")).status, 401);
  assert.equal(state.upstreamCalls.length, 0);
});

Deno.test("400 on invalid JSON and invalid input, before any model call", async () => {
  reset();
  assert.equal((await call("{nope")).status, 400);
  assert.equal((await call({ prompt: "" })).status, 400);
  assert.equal((await call({ prompt: "hi", provider: "openai" })).status, 400);
  assert.equal(state.upstreamCalls.length, 0);
});

Deno.test("429 when over quota, and the model is never called", async () => {
  reset();
  state.quota = { tokens_used: 50000, tokens_limit: 50000, is_over_limit: true };
  const res = await call({ prompt: "hi" });
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /50,000/);
  assert.equal(state.upstreamCalls.length, 0);
});

Deno.test("fails closed (503) when the quota check errors", async () => {
  reset();
  state.quotaFails = true;
  assert.equal((await call({ prompt: "hi" })).status, 503);
  assert.equal(state.upstreamCalls.length, 0);
});

Deno.test("anthropic: streams deltas, sends done, records provider-reported usage", async () => {
  reset();
  const res = await call({ prompt: "Explain moles", provider: "anthropic", subject: "Chemistry", studentName: "Amina" });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /"type":"delta","text":"Hello "/);
  assert.match(text, /"type":"done"/);
  const sent = state.upstreamCalls[0];
  assert.equal(sent.headers.get("x-api-key"), "a-key");
  assert.equal(sent.body.model, "claude-haiku-5-5");
  assert.equal((sent.body.messages as unknown[]).length, 1);
  assert.deepEqual(state.inserted, [
    { user_id: "user-1", subject: "Chemistry", input_tokens: 40, output_tokens: 7, total_tokens: 47 },
  ]);
});

Deno.test("gemini (default): key in header not URL, streams, records usage", async () => {
  reset();
  const res = await call({ prompt: "hi", history: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /"text":"there"/);
  const sent = state.upstreamCalls[0];
  assert.ok(!sent.url.includes("g-key") && !sent.url.includes("key="));
  assert.equal(sent.headers.get("x-goog-api-key"), "g-key");
  assert.deepEqual((sent.body.contents as { role: string }[]).map((c) => c.role), ["user", "model", "user"]);
  assert.equal(state.inserted[0].total_tokens, 35);
});

Deno.test("provider outage becomes a clean 503 that does not leak details", async () => {
  reset();
  state.upstreamStatus = 529;
  const res = await call({ prompt: "hi", provider: "anthropic" });
  assert.equal(res.status, 503);
  const body = await res.text();
  assert.ok(!body.includes("upstream"));
  assert.equal(state.inserted.length, 0);
});

Deno.test("CORS: preflight allowed for listed origin only; GET rejected", async () => {
  const ok = await handler(new Request("https://fn.test/", { method: "OPTIONS", headers: { Origin: "https://app.example.com" } }));
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), "https://app.example.com");
  const evil = await handler(new Request("https://fn.test/", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }));
  assert.equal(evil.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal((await handler(new Request("https://fn.test/", { method: "GET" }))).status, 405);
});
