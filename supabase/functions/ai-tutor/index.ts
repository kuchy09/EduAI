import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import {
  buildSystemPrompt,
  corsHeadersFor,
  estimateTokens,
  LIMITS,
  parseAllowedOrigins,
  parseRequest,
  type Provider,
  type Turn,
  ValidationError,
} from "./validate.ts";

// ── Config (set with `supabase secrets set NAME=value`) ───────────────────────
//   ANTHROPIC_API_KEY / GEMINI_API_KEY  provider keys (set the ones you use)
//   DEFAULT_PROVIDER   'gemini' (default) or 'anthropic'
//   ANTHROPIC_MODEL    default 'claude-haiku-5-5'  (use 'claude-sonnet-5-5' for higher quality)
//   GEMINI_MODEL       default 'gemini-3.1-flash-lite' (same default as the web prototype)
//   ALLOWED_ORIGINS    comma-separated web origins allowed by CORS. Leave empty for a mobile-only app.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
const MAX_OUTPUT_TOKENS = 1024;
const ALLOWED_ORIGINS = parseAllowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));
const GENERIC_ERROR = "The tutor ran into a problem. Please try again.";

class UpstreamError extends Error {
  constructor(public status: number, detail: string) {
    super(detail);
  }
}

interface Chunk {
  text?: string;
  inputTokens?: number;
  outputTokens?: number;
}

// ── Provider plumbing ─────────────────────────────────────────────────────────

/** Yields the `data:` payloads of a Server-Sent-Events body. */
async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trimEnd();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data && data !== "[DONE]") yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function* anthropicChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<Chunk> {
  for await (const data of sseData(body)) {
    let evt: any;
    try {
      evt = JSON.parse(data);
    } catch {
      continue;
    }
    if (evt.type === "message_start") {
      yield { inputTokens: evt.message?.usage?.input_tokens };
    } else if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
      yield { text: evt.delta.text };
    } else if (evt.type === "message_delta") {
      yield { outputTokens: evt.usage?.output_tokens };
    } else if (evt.type === "error") {
      throw new Error(`anthropic stream error: ${evt.error?.type ?? "unknown"}`);
    }
  }
}

async function* geminiChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<Chunk> {
  for await (const data of sseData(body)) {
    let evt: any;
    try {
      evt = JSON.parse(data);
    } catch {
      continue;
    }
    const parts: any[] = evt.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p?.text ?? "").join("");
    yield {
      text: text || undefined,
      inputTokens: evt.usageMetadata?.promptTokenCount,
      outputTokens: evt.usageMetadata?.candidatesTokenCount,
    };
  }
}

/** Starts the upstream request. Throws before any streaming begins if the provider rejects it. */
async function openUpstream(
  provider: Provider,
  system: string,
  turns: Turn[],
): Promise<AsyncGenerator<Chunk>> {
  if (provider === "anthropic") {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-5-5",
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        messages: turns.map((t) => ({ role: t.role, content: t.content })),
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw new UpstreamError(res.status, await res.text());
    return anthropicChunks(res.body);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.1-flash-lite";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      // The key goes in a header, not the URL, so it never shows up in logs.
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({
          role: t.role === "user" ? "user" : "model",
          parts: [{ text: t.content }],
        })),
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
    },
  );
  if (!res.ok || !res.body) throw new UpstreamError(res.status, await res.text());
  return geminiChunks(res.body);
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get("Origin"), ALLOWED_ORIGINS);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
      return json(500, { error: GENERIC_ERROR });
    }
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Authentication is mandatory.
    const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
    if (!token) return json(401, { error: "Sign in to use the tutor" });
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (authError || !user) return json(401, { error: "Your session has expired. Please sign in again." });

    // 2. Parse and validate input.
    if (Number(req.headers.get("content-length") ?? 0) > LIMITS.bodyBytes) {
      return json(413, { error: "Request too large" });
    }
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return json(400, { error: "Request body must be valid JSON" });
    }
    const request = parseRequest(payload);
    const provider: Provider = request.provider ??
      (Deno.env.get("DEFAULT_PROVIDER") === "anthropic" ? "anthropic" : "gemini");

    // 3. Quota is enforced BEFORE calling the model, and fails closed.
    const { data: quota, error: quotaError } = await admin.rpc("check_tutor_quota", { p_user_id: user.id });
    const q = Array.isArray(quota) ? quota[0] : null;
    if (quotaError || !q) {
      console.error("check_tutor_quota failed", quotaError);
      return json(503, { error: "Could not verify your usage right now. Please try again shortly." });
    }
    if (q.is_over_limit) {
      return json(429, {
        error: `Monthly token quota exceeded (Free tier: ${Number(q.tokens_limit).toLocaleString("en-US")} tokens).`,
      });
    }

    // 4. Call the model.
    const system = buildSystemPrompt(request.studentName, request.subject);
    const turns: Turn[] = [...request.history, { role: "user", content: request.prompt }];
    const chunks = await openUpstream(provider, system, turns);

    // 5. Stream the answer back and record usage when it ends.
    const encoder = new TextEncoder();
    const promptChars = system.length + turns.reduce((n, t) => n + t.content.length, 0);

    const stream = new ReadableStream({
      async start(controller) {
        let inputTokens = 0;
        let outputTokens = 0;
        let outputChars = 0;
        const send = (obj: unknown) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          } catch { /* client disconnected */ }
        };
        try {
          for await (const c of chunks) {
            if (c.inputTokens) inputTokens = c.inputTokens;
            if (c.outputTokens) outputTokens = c.outputTokens;
            if (c.text) {
              outputChars += c.text.length;
              send({ type: "delta", text: c.text });
            }
          }
          send({ type: "done" });
        } catch (err) {
          console.error("stream failed", err);
          send({ type: "error", message: GENERIC_ERROR });
        } finally {
          // If the provider reported no usage, fall back to an estimate so nothing is free.
          const input = inputTokens || estimateTokens("x".repeat(promptChars));
          const output = outputTokens || Math.ceil(outputChars / 4);
          if (input + output > 0) {
            const { error } = await admin.from("ai_tutor_usage").insert({
              user_id: user.id,
              subject: request.subject ?? "general",
              input_tokens: input,
              output_tokens: output,
              total_tokens: input + output,
            });
            if (error) console.error("recording usage failed", error);
          }
          try {
            controller.close();
          } catch { /* already closed */ }
        }
      },
    });

    return new Response(stream, {
      headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (error) {
    if (error instanceof ValidationError) return json(400, { error: error.message });
    if (error instanceof UpstreamError) {
      console.error("upstream error", error.status, error.message.slice(0, 500));
      const busy = [429, 500, 502, 503, 504, 529].includes(error.status);
      return json(503, {
        error: busy
          ? "The AI model is busy right now. Please try again in a few moments."
          : "The tutor is temporarily unavailable.",
      });
    }
    console.error("ai-tutor failed", error);
    return json(500, { error: GENERIC_ERROR });
  }
});
