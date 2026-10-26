import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight,
  jsonResponse,
  resolveSupabaseContext,
} from "../_shared/cors.ts";

/**
 * Edu AI Reader Assistant Edge Function
 * Powers:
 *  - Contextual Selection Menu: Dictionary | Translate | Explain | Generate
 *  - Listen Mode Audiobook Engine: Narrate (zero-loss conversational narration + dynamic science visualization prompts)
 */
serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const {
      action = "Explain",
      selectedText = "",
      surroundingContext = "",
      targetLanguage = "Kiswahili",
      stylePreset = "Style 01",
      bookId,
      bookTitle = "Educational Textbook",
      pageNumber = 1,
    } = await req.json();

    if (!selectedText.trim()) {
      return jsonResponse({ error: "selectedText is required" }, 400);
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return jsonResponse(
        { error: "GEMINI_API_KEY is not configured in Supabase secrets." },
        500,
      );
    }

    const { adminClient } = await resolveSupabaseContext(req);

    const promptByAction: Record<string, string> = {
      Dictionary: `Provide a clear, contextual academic definition of "${selectedText}" as used in "${bookTitle}" (Page ${pageNumber}). Surrounding passage: "${surroundingContext}". Include part of speech, contextual meaning, and one concise syllabus example.`,
      Translate: `Translate "${selectedText}" into ${targetLanguage} while preserving academic accuracy and textbook context from "${bookTitle}". Surrounding passage: "${surroundingContext}".`,
      Explain: `Explain the concept "${selectedText}" from "${bookTitle}" (Page ${pageNumber}) using bullet points, bold headers, intuition-first examples, and LaTeX notation where relevant. Surrounding passage: "${surroundingContext}".`,
      Generate: `Expand or refine the following study note in preset "${stylePreset}" grounded in "${bookTitle}": "${selectedText}".`,
      Narrate: `Convert the following textbook passage from "${bookTitle}" (Page ${pageNumber}) into a warm, zero-loss conversational tutor narration without omitting any textbook facts. Also identify any complex scientific/mathematical concepts and provide descriptive visual diagram prompts:\n\n"${selectedText}"`,
    };

    const instruction =
      promptByAction[action] || promptByAction.Explain;

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

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: instruction }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );

    const raw = await resp.json();
    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(text);

    if (action === "Narrate" && adminClient && bookId) {
      await adminClient.from("audiobook_narrations").upsert(
        {
          book_id: String(bookId),
          page_number: Number(pageNumber) || 1,
          source_text: selectedText,
          conversational_narration:
            parsed?.display_data?.audio_optimized_text ||
            parsed?.display_data?.primary_content ||
            selectedText,
          visualization_prompts:
            parsed?.display_data?.visualization_prompts || [],
        },
        { onConflict: "book_id,page_number,voice_preset" },
      );
    }

    return jsonResponse(parsed);
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to process reader-assistant action" },
      500,
    );
  }
});
