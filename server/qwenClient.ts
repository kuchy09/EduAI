export interface QwenChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface QwenRuntimeConfig {
  providerLabel: string;
  endpointUrl: string;
  apiKey: string;
  model: string;
}

export const DEFAULT_QWEN_ENDPOINT_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_QWEN_MODEL = "qwen/qwen3.8-27b";
export const DEFAULT_QWEN_PROVIDER_LABEL = "GroqCloud (Qwen 3)";

function isUsableSecret(val?: string): string {
  let trimmed = String(val || "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(trimmed)) {
    trimmed = trimmed.replace(/^bearer\s+/i, "").trim();
  }
  if (
    !trimmed ||
    trimmed.startsWith("MY_") ||
    trimmed.startsWith("your_") ||
    trimmed.includes("placeholder") ||
    trimmed.length < 8
  ) {
    return "";
  }
  return trimmed;
}

function normalizeChatCompletionsUrl(rawBase: string): string {
  const clean = rawBase.trim().replace(/\/+$/, "");
  if (clean.endsWith("/chat/completions")) return clean;
  if (clean.endsWith("/v1")) return `${clean}/chat/completions`;
  return `${clean}/v1/chat/completions`;
}

export function getMissingGroqMessage(): string {
  if (process.env.VERCEL) {
    return "Qwen 3 inference is not configured on this Vercel deployment. Add GROQ_API_KEY in Vercel Dashboard > Project Settings > Environment Variables and redeploy.";
  }
  return "Qwen 3 inference is not configured yet. Add GROQ_API_KEY in Settings > Secrets.";
}

export function resolveQwenRuntimeConfig(): QwenRuntimeConfig | null {
  const apiKey = isUsableSecret(
    process.env.GROQ_API_KEY ||
      process.env.GROQ_KEY ||
      process.env.QWEN_API_KEY ||
      process.env.VITE_GROQ_API_KEY
  );
  if (!apiKey) {
    return null;
  }

  const rawEndpoint = String(process.env.QWEN_ENDPOINT_URL || "").trim();
  const isCustomHttp =
    Boolean(rawEndpoint) && (rawEndpoint.startsWith("https://") || rawEndpoint.startsWith("http://"));
  const isStaleMismatchedEndpoint =
    isCustomHttp && apiKey.startsWith("gsk_") && !/groq\.com/i.test(rawEndpoint);
  const endpointUrl =
    isCustomHttp && !isStaleMismatchedEndpoint
      ? normalizeChatCompletionsUrl(rawEndpoint)
      : DEFAULT_QWEN_ENDPOINT_URL;

  const model = String(process.env.QWEN_MODEL || "").trim() || DEFAULT_QWEN_MODEL;

  return {
    providerLabel: DEFAULT_QWEN_PROVIDER_LABEL,
    endpointUrl,
    apiKey,
    model,
  };
}

export function isQwenConfigured(): boolean {
  return resolveQwenRuntimeConfig() !== null;
}

export function splitThinkAndContent(raw: string): { thought: string; text: string } {
  const src = String(raw || "");
  const thoughts: string[] = [];
  const cleaned = src
    .replace(/<think>([\s\S]*?)<\/think>/gi, (_m, inner) => {
      if (String(inner || "").trim()) thoughts.push(String(inner).trim());
      return "";
    })
    .replace(/<\/?think>/gi, "")
    .trim();

  return {
    thought: thoughts.join("\n\n"),
    text: cleaned,
  };
}

export function createThinkStreamSplitter(
  onThought: (chunk: string) => void,
  onText: (chunk: string) => void
) {
  let mode: "text" | "think" = "text";
  let pending = "";

  const push = (token: string) => {
    if (!token) return;
    pending += token;

    while (pending.length > 0) {
      if (mode === "text") {
        const openIdx = pending.indexOf("<think>");
        if (openIdx >= 0) {
          if (openIdx > 0) {
            onText(pending.slice(0, openIdx));
          }
          pending = pending.slice(openIdx + 7);
          mode = "think";
          continue;
        }
        const partialIdx = pending.lastIndexOf("<");
        if (partialIdx >= 0 && "<think>".startsWith(pending.slice(partialIdx))) {
          if (partialIdx > 0) {
            onText(pending.slice(0, partialIdx));
            pending = pending.slice(partialIdx);
          }
          return;
        }
        onText(pending);
        pending = "";
      } else {
        const closeIdx = pending.indexOf("</think>");
        if (closeIdx >= 0) {
          if (closeIdx > 0) {
            onThought(pending.slice(0, closeIdx));
          }
          pending = pending.slice(closeIdx + 8);
          mode = "text";
          continue;
        }
        const partialIdx = pending.lastIndexOf("<");
        if (partialIdx >= 0 && "</think>".startsWith(pending.slice(partialIdx))) {
          if (partialIdx > 0) {
            onThought(pending.slice(0, partialIdx));
            pending = pending.slice(partialIdx);
          }
          return;
        }
        onThought(pending);
        pending = "";
      }
    }
  };

  const flush = () => {
    if (!pending) return;
    if (mode === "think") {
      onThought(pending);
    } else {
      onText(pending);
    }
    pending = "";
  };

  return { push, flush };
}

export class QwenUpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function formatQwenErrorPayload(err: any): { status: number; message: string } {
  const status = typeof err?.status === "number" ? err.status : 500;
  const raw = String(err?.message || err || "");
  const lower = raw.toLowerCase();
  const cfg = resolveQwenRuntimeConfig();
  let host = "api.groq.com";
  try {
    if (cfg?.endpointUrl) host = new URL(cfg.endpointUrl).host;
  } catch {}

  if (status === 401 || status === 403 || lower.includes("invalid api key") || lower.includes("unauthorized")) {
    const cleanReason = raw && raw.length < 140 ? ` (${raw})` : "";
    const locationHint = process.env.VERCEL
      ? "Vercel Dashboard > Project Settings > Environment Variables (and redeploy)"
      : "Settings > Secrets";
    return {
      status,
      message: `The GROQ_API_KEY secret was rejected by ${host}${cleanReason}. Please verify GROQ_API_KEY in ${locationHint}.`,
    };
  }
  if (status === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
    return {
      status: 429,
      message:
        "GroqCloud Qwen3 free-tier rate limit reached (30 RPM / 8,000 TPM). Please wait a few seconds and click Retry.",
    };
  }
  if (status === 413 || lower.includes("request too large") || lower.includes("context_length")) {
    return {
      status: 413,
      message:
        "This prompt exceeds the free-tier per-minute token limit. Try asking a shorter question or starting a new chat.",
    };
  }
  if (status === 402 || lower.includes("insufficient") || lower.includes("credit")) {
    return {
      status: 402,
      message:
        "Your GroqCloud quota or billing limit was reached. Please check your Groq Console plan.",
    };
  }
  if (status === 503 || lower.includes("unavailable") || lower.includes("not configured")) {
    return {
      status: 503,
      message: raw || getMissingGroqMessage(),
    };
  }
  return {
    status: status >= 400 ? status : 500,
    message: raw && raw.length < 220 ? raw : "Could not complete Qwen 3 request right now. Please try again shortly.",
  };
}

function buildApiMessages(
  systemPrompt: string,
  messages: QwenChatMessage[],
  speedMode: "fast" | "deep"
): QwenChatMessage[] {
  const speedDirective =
    speedMode === "fast"
      ? "\n\nRespond directly with crisp, clear formatting."
      : "";
  const formatted: QwenChatMessage[] = [
    { role: "system", content: `${systemPrompt}${speedDirective}` },
  ];
  for (const m of messages) {
    const content = String(m?.content || "").trim();
    if (!content) continue;
    formatted.push({
      role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
      content,
    });
  }
  return formatted;
}

function applyReasoningParams(
  payload: Record<string, any>,
  model: string,
  speedMode: "fast" | "deep",
  jsonMode?: boolean
) {
  if (!/qwen3/i.test(model)) return;
  if (jsonMode || speedMode !== "deep") {
    payload.reasoning_effort = "none";
  } else {
    payload.reasoning_effort = "medium";
    payload.reasoning_format = "parsed";
  }
}

export async function generateQwenCompletion(params: {
  systemPrompt: string;
  messages: QwenChatMessage[];
  maxTokens?: number;
  speedMode?: "fast" | "deep";
  jsonMode?: boolean;
}): Promise<{ text: string; thought: string; model: string; providerLabel: string }> {
  const cfg = resolveQwenRuntimeConfig();
  if (!cfg) {
    throw new QwenUpstreamError(503, getMissingGroqMessage());
  }

  const speedMode = params.speedMode || "fast";
  const apiMessages = buildApiMessages(params.systemPrompt, params.messages, speedMode);

  const buildPayload = (includeJsonMode: boolean, includeReasoning: boolean) => {
    const payload: Record<string, any> = {
      model: cfg.model,
      messages: apiMessages,
      max_tokens: params.maxTokens ?? 2048,
      stream: false,
    };
    if (includeJsonMode) {
      payload.response_format = { type: "json_object" };
    }
    if (includeReasoning) {
      applyReasoningParams(payload, cfg.model, speedMode, includeJsonMode);
    }
    return payload;
  };

  let response = await fetch(cfg.endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(buildPayload(Boolean(params.jsonMode), true)),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    let parsedMsg = errBody;
    try {
      const j = JSON.parse(errBody);
      parsedMsg = j?.error?.message || j?.message || errBody;
    } catch {}
    const lowerErr = parsedMsg.toLowerCase();

    if (
      response.status === 400 &&
      (lowerErr.includes("response_format") ||
        lowerErr.includes("reasoning_effort") ||
        lowerErr.includes("reasoning_format"))
    ) {
      response = await fetch(cfg.endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(
          buildPayload(
            Boolean(params.jsonMode) && !lowerErr.includes("response_format"),
            !(lowerErr.includes("reasoning_effort") || lowerErr.includes("reasoning_format"))
          )
        ),
      });
    } else {
      throw new QwenUpstreamError(response.status, parsedMsg || `HTTP ${response.status}`);
    }
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    let parsedMsg = errBody;
    try {
      const j = JSON.parse(errBody);
      parsedMsg = j?.error?.message || j?.message || errBody;
    } catch {}
    throw new QwenUpstreamError(response.status, parsedMsg || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawContent = String(data?.choices?.[0]?.message?.content || "");
  const reasoningContent = String(
    data?.choices?.[0]?.message?.reasoning ||
      data?.choices?.[0]?.message?.reasoning_content ||
      ""
  ).trim();
  const split = splitThinkAndContent(rawContent);
  const finalText = split.text || rawContent.trim();
  const finalThought = reasoningContent || split.thought;

  if (!finalText) {
    throw new QwenUpstreamError(500, "Qwen 3 returned an empty response.");
  }

  return {
    text: finalText,
    thought: finalThought,
    model: cfg.model,
    providerLabel: cfg.providerLabel,
  };
}

export async function streamQwenCompletion(params: {
  systemPrompt: string;
  messages: QwenChatMessage[];
  maxTokens?: number;
  speedMode?: "fast" | "deep";
  signal?: AbortSignal;
  onThought: (chunk: string) => void;
  onText: (chunk: string) => void;
}): Promise<{ streamedAny: boolean; model: string; providerLabel: string }> {
  const cfg = resolveQwenRuntimeConfig();
  if (!cfg) {
    throw new QwenUpstreamError(503, getMissingGroqMessage());
  }

  const speedMode = params.speedMode || "fast";
  const apiMessages = buildApiMessages(params.systemPrompt, params.messages, speedMode);

  const buildPayload = (includeReasoning: boolean) => {
    const payload: Record<string, any> = {
      model: cfg.model,
      messages: apiMessages,
      max_tokens: params.maxTokens ?? 2048,
      stream: true,
    };
    if (includeReasoning) {
      applyReasoningParams(payload, cfg.model, speedMode, false);
    }
    return payload;
  };

  let response = await fetch(cfg.endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    signal: params.signal,
    body: JSON.stringify(buildPayload(true)),
  });

  if (!response.ok || !response.body) {
    const errBody = await response.text().catch(() => "");
    let parsedMsg = errBody;
    try {
      const j = JSON.parse(errBody);
      parsedMsg = j?.error?.message || j?.message || errBody;
    } catch {}
    const lowerErr = parsedMsg.toLowerCase();

    if (
      response.status === 400 &&
      (lowerErr.includes("reasoning_effort") || lowerErr.includes("reasoning_format"))
    ) {
      response = await fetch(cfg.endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        signal: params.signal,
        body: JSON.stringify(buildPayload(false)),
      });
    } else {
      throw new QwenUpstreamError(response.status, parsedMsg || `HTTP ${response.status}`);
    }
  }

  if (!response.ok || !response.body) {
    const errBody = await response.text().catch(() => "");
    let parsedMsg = errBody;
    try {
      const j = JSON.parse(errBody);
      parsedMsg = j?.error?.message || j?.message || errBody;
    } catch {}
    throw new QwenUpstreamError(response.status, parsedMsg || `HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamedAny = false;

  const splitter = createThinkStreamSplitter(
    (thoughtChunk) => {
      if (thoughtChunk) params.onThought(thoughtChunk);
    },
    (textChunk) => {
      if (textChunk) {
        streamedAny = true;
        params.onText(textChunk);
      }
    }
  );

  while (true) {
    if (params.signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const payloadStr = line.slice(5).trim();
      if (!payloadStr || payloadStr === "[DONE]") continue;

      try {
        const parsed = JSON.parse(payloadStr);
        if (parsed?.error) {
          throw new QwenUpstreamError(
            Number(parsed.error?.code) || 500,
            parsed.error?.message || "Upstream Qwen 3 streaming error"
          );
        }
        const delta = parsed?.choices?.[0]?.delta;
        if (!delta) continue;

        const reasoningDelta = delta.reasoning || delta.reasoning_content;
        if (typeof reasoningDelta === "string" && reasoningDelta.length > 0) {
          params.onThought(reasoningDelta);
        }
        if (typeof delta.content === "string" && delta.content.length > 0) {
          splitter.push(delta.content);
        }
      } catch (chunkErr: any) {
        if (chunkErr instanceof QwenUpstreamError) throw chunkErr;
      }
    }
  }

  const trailing = buffer.trim();
  if (trailing.startsWith("data:")) {
    const payloadStr = trailing.slice(5).trim();
    if (payloadStr && payloadStr !== "[DONE]") {
      try {
        const parsed = JSON.parse(payloadStr);
        const delta = parsed?.choices?.[0]?.delta;
        const reasoningDelta = delta?.reasoning || delta?.reasoning_content;
        if (typeof reasoningDelta === "string" && reasoningDelta.length > 0) {
          params.onThought(reasoningDelta);
        }
        if (typeof delta?.content === "string" && delta.content.length > 0) {
          splitter.push(delta.content);
        }
      } catch {}
    }
  }

  splitter.flush();

  if (!streamedAny) {
    throw new QwenUpstreamError(500, "Qwen 3 stream ended without generating text.");
  }

  return { streamedAny: true, model: cfg.model, providerLabel: cfg.providerLabel };
}
