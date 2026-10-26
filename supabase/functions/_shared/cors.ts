import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.39.3";

export const MAX_BODY_BYTES = 64 * 1024;
export const GENERIC_SERVICE_ERROR = "The service ran into a problem. Please try again.";

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsHeadersFor(
  origin: string | null,
  allowedOrigins: string[],
): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (allowedOrigins.length === 0) return base;
  if (origin && allowedOrigins.includes(origin)) {
    return { ...base, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  }
  return base;
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1]?.trim() || null;
}

export interface AuthenticatedContext {
  adminClient: SupabaseClient;
  user: User;
}

/**
 * Verifies the caller's JWT and enforces the monthly token quota BEFORE any paid API call.
 * Returns either `{ ok: true, adminClient, user }` or `{ ok: false, response }`.
 */
export async function requireAuthAndQuota(
  req: Request,
  json: (status: number, body: unknown) => Response,
): Promise<
  | ({ ok: true } & AuthenticatedContext)
  | { ok: false; response: Response }
> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
    return { ok: false, response: json(500, { error: GENERIC_SERVICE_ERROR }) };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = extractBearerToken(req.headers.get("Authorization"));
  if (!token) {
    return { ok: false, response: json(401, { error: "Sign in to continue." }) };
  }

  const { data: userData, error: authError } = await adminClient.auth.getUser(token);
  const user = userData?.user;
  if (authError || !user) {
    return {
      ok: false,
      response: json(401, { error: "Your session has expired. Please sign in again." }),
    };
  }

  const { data: quota, error: quotaError } = await adminClient.rpc("check_tutor_quota", {
    p_user_id: user.id,
  });
  const q = Array.isArray(quota) ? quota[0] : null;
  if (quotaError || !q) {
    console.error("check_tutor_quota failed", quotaError);
    return {
      ok: false,
      response: json(503, {
        error: "Could not verify your usage right now. Please try again shortly.",
      }),
    };
  }

  if (q.is_over_limit) {
    return {
      ok: false,
      response: json(429, {
        error: `Monthly token quota exceeded (Free tier: ${Number(q.tokens_limit).toLocaleString("en-US")} tokens).`,
      }),
    };
  }

  return { ok: true, adminClient, user };
}

export async function callGeminiJson(params: {
  systemInstruction?: string;
  prompt: string;
}): Promise<{
  parsed: any;
  inputTokens: number;
  outputTokens: number;
  model: string;
}> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: params.prompt }] }],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 2048 },
  };
  if (params.systemInstruction) {
    body.systemInstruction = { parts: [{ text: params.systemInstruction }] };
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify(body),
    },
  );

  if (!resp.ok) {
    const detail = await resp.text();
    console.error("gemini upstream error", resp.status, detail.slice(0, 500));
    throw new Error(`gemini upstream status ${resp.status}`);
  }

  const raw = await resp.json();
  const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(text);
  const promptChars = (params.systemInstruction?.length ?? 0) + params.prompt.length;
  const inputTokens =
    raw?.usageMetadata?.promptTokenCount || Math.max(1, Math.ceil(promptChars / 4));
  const outputTokens =
    raw?.usageMetadata?.candidatesTokenCount || Math.max(1, Math.ceil(text.length / 4));

  return { parsed, inputTokens, outputTokens, model };
}

export async function recordAiUsage(
  adminClient: SupabaseClient,
  params: {
    userId: string;
    subject: string;
    model: string;
    bookId?: string | null;
    inputTokens: number;
    outputTokens: number;
  },
): Promise<void> {
  const input = Math.max(0, Math.round(params.inputTokens));
  const output = Math.max(0, Math.round(params.outputTokens));
  if (input + output <= 0) return;

  const { error } = await adminClient.from("ai_tutor_usage").insert({
    user_id: params.userId,
    subject: params.subject.slice(0, 120) || "general",
    provider: "gemini",
    model: params.model,
    book_id: params.bookId ? String(params.bookId).slice(0, 120) : null,
    input_tokens: input,
    output_tokens: output,
    total_tokens: input + output,
  });

  if (error) {
    console.error("recording ai_tutor_usage failed", error);
  }
}
