import {
  callGeminiJson,
  corsHeadersFor,
  GENERIC_SERVICE_ERROR,
  MAX_BODY_BYTES,
  parseAllowedOrigins,
  recordAiUsage,
  requireAuthAndQuota,
} from "../_shared/cors.ts";

const ALLOWED_ORIGINS = parseAllowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));

/**
 * Edu AI Reader Assistant Edge Function
 * Powers:
 *  - Contextual Selection Menu: Dictionary | Translate | Explain | Generate
 *  - Listen Mode Audiobook Engine: Narrate (zero-loss conversational narration + dynamic science visualization prompts)
 */
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
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return json(413, { error: "Request too large" });
    }

    const auth = await requireAuthAndQuota(req, json);
    if (!auth.ok) return auth.response;
    const { adminClient, user } = auth;

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return json(400, { error: "Request body must be valid JSON" });
    }

    const action = typeof payload?.action === "string" ? payload.action : "Explain";
    const selectedText = typeof payload?.selectedText === "string" ? payload.selectedText.trim() : "";
    const surroundingContext =
      typeof payload?.surroundingContext === "string" ? payload.surroundingContext.slice(0, 4000) : "";
    const targetLanguage =
      typeof payload?.targetLanguage === "string" ? payload.targetLanguage.slice(0, 60) : "Kiswahili";
    const stylePreset =
      typeof payload?.stylePreset === "string" ? payload.stylePreset.slice(0, 60) : "Style 01";
    const bookId = payload?.bookId ? String(payload.bookId).slice(0, 120) : null;
    const bookTitle =
      typeof payload?.bookTitle === "string" && payload.bookTitle.trim()
        ? payload.bookTitle.trim().slice(0, 200)
        : "Educational Textbook";
    const pageNumber = Math.max(1, Number(payload?.pageNumber) || 1);

    if (!selectedText || selectedText.length > 8000) {
      return json(400, { error: "selectedText must be between 1 and 8000 characters" });
    }

    const promptByAction: Record<string, string> = {
      Dictionary: `Provide a clear, contextual academic definition of "${selectedText}" as used in "${bookTitle}" (Page ${pageNumber}). Surrounding passage: "${surroundingContext}". Include part of speech, contextual meaning, and one concise syllabus example.`,
      Translate: `Translate "${selectedText}" into ${targetLanguage} while preserving academic accuracy and textbook context from "${bookTitle}". Surrounding passage: "${surroundingContext}".`,
      Explain: `Explain the concept "${selectedText}" from "${bookTitle}" (Page ${pageNumber}) using bullet points, bold headers, intuition-first examples, and LaTeX notation where relevant. Surrounding passage: "${surroundingContext}".`,
      Generate: `Expand or refine the following study note in preset "${stylePreset}" grounded in "${bookTitle}": "${selectedText}".`,
      Narrate: `Convert the following textbook passage from "${bookTitle}" (Page ${pageNumber}) into a warm, zero-loss conversational tutor narration without omitting any textbook facts. Also identify any complex scientific/mathematical concepts and provide descriptive visual diagram prompts:\n\n"${selectedText}"`,
    };

    const instruction = promptByAction[action] || promptByAction.Explain;
    const systemInstruction = `Return ONLY valid JSON matching this schema:
{
  "action_triggered": "${action}",
  "ui_adjustments": {
    "highlighted_text": "string"
  },
  "display_data": {
    "title": "Short Header",
    "primary_content": "Markdown formatted response (*bold*, bullet lists)",
    "audio_optimized_text": "Clean conversational text optimized for Listen-mode TTS without raw markdown symbols",
    "visualization_prompts": ["Optional descriptive diagram prompts when complex concepts appear"]
  }
}`;

    const { parsed, inputTokens, outputTokens, model } = await callGeminiJson({
      systemInstruction,
      prompt: instruction,
    });

    await recordAiUsage(adminClient, {
      userId: user.id,
      subject: `reader:${action}`,
      model,
      bookId,
      inputTokens,
      outputTokens,
    });

    if (action === "Narrate" && bookId) {
      const { error: upsertErr } = await adminClient.from("audiobook_narrations").upsert(
        {
          book_id: bookId,
          page_number: pageNumber,
          source_text: selectedText,
          conversational_narration:
            parsed?.display_data?.audio_optimized_text ||
            parsed?.display_data?.primary_content ||
            selectedText,
          visualization_prompts: parsed?.display_data?.visualization_prompts || [],
        },
        { onConflict: "book_id,page_number,voice_preset" },
      );
      if (upsertErr) console.error("audiobook_narrations upsert failed", upsertErr);
    }

    return json(200, parsed);
  } catch (error) {
    console.error("reader-assistant failed", error);
    return json(500, { error: GENERIC_SERVICE_ERROR });
  }
});
