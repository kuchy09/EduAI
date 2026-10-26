import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight,
  jsonResponse,
  resolveSupabaseContext,
} from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const apiKey =
      Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");

    if (!apiKey) {
      return jsonResponse(
        {
          error:
            "Claude API key not configured. Set ANTHROPIC_API_KEY or CLAUDE_API_KEY in Supabase Edge Function secrets.",
        },
        500,
      );
    }

    const {
      prompt,
      history = [],
      system,
      bookContext,
      model = "claude-sonnet-4-20250514",
      max_tokens = 1024,
    } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return jsonResponse({ error: "Prompt is required" }, 400);
    }

    const { adminClient, user } = await resolveSupabaseContext(req);

    const defaultSystemPrompt =
      system ||
      `You are Sage AI on the Edu-Claude educational platform. Provide structured, encouraging, curriculum-accurate explanations with LaTeX formatting ($inline$ and $$display$$) for formulas.` +
        (bookContext?.title
          ? `\nReading Context: "${bookContext.title}"${bookContext.page ? ` (Page ${bookContext.page})` : ""}${bookContext.selectedText ? `\nExcerpt: "${bookContext.selectedText}"` : ""}`
          : "");

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (Array.isArray(history)) {
      for (const m of history) {
        if (!m?.content) continue;
        messages.push({
          role: m.role === "user" || m.role === "User" ? "user" : "assistant",
          content: String(m.content),
        });
      }
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens,
        system: defaultSystemPrompt,
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return jsonResponse(
        { error: data?.error?.message || "Claude API error", details: data },
        response.status,
      );
    }

    if (adminClient && user && data?.usage) {
      const inputTokens = data.usage.input_tokens || 0;
      const outputTokens = data.usage.output_tokens || 0;
      await adminClient.from("ai_tutor_usage").insert({
        user_id: user.id,
        subject: bookContext?.title || "claude-direct",
        provider: "anthropic",
        model,
        book_id: bookContext?.bookId || null,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      });
    }

    const reply = data?.content?.[0]?.text || "";
    return jsonResponse({ ...data, reply });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Unexpected error in handle-claude" },
      500,
    );
  }
});
