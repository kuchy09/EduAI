import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0";
import {
  corsHeaders,
  handleCorsPreflight,
  jsonResponse,
  resolveSupabaseContext,
} from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const payload = await req.json();
    let {
      prompt,
      history,
      provider = "gemini",
      messages,
      subject,
      studentName,
      bookContext,
      allowDataCollection = true,
      stream: wantStream = true,
    } = payload;

    if (messages && messages.length > 0 && !prompt) {
      prompt = messages[messages.length - 1].content;
      history = messages.slice(0, -1);
    }

    if (!prompt || typeof prompt !== "string") {
      return jsonResponse({ error: "prompt is required" }, 400);
    }

    const { adminClient, user } = await resolveSupabaseContext(req);

    if (adminClient && user) {
      const { data: quotaInfo } = await adminClient.rpc("check_tutor_quota", {
        p_user_id: user.id,
      });
      if (quotaInfo && quotaInfo[0]?.is_over_limit) {
        return jsonResponse(
          { error: "Monthly token quota exceeded (Free tier: 50k tokens)." },
          429,
        );
      }
    }

    const recordUsage = async (
      inputTokens: number,
      outputTokens: number,
      modelName: string,
    ) => {
      if (!user || !adminClient || (inputTokens === 0 && outputTokens === 0)) {
        return;
      }
      try {
        await adminClient.from("ai_tutor_usage").insert({
          user_id: user.id,
          subject: subject || bookContext?.title || "general",
          provider,
          model: modelName,
          book_id: bookContext?.bookId || null,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
        });
      } catch (err) {
        console.error("Error recording ai_tutor_usage:", err);
      }
    };

    const studentNameContext = studentName || "Student";
    const subjectContext = subject ? ` in ${subject}` : "";
    const studyPatternsText = allowDataCollection
      ? "Adapt explanations dynamically to the learner's pace and curriculum context."
      : "Operate statelessly without assuming historical study patterns.";

    const bookGroundingText = bookContext
      ? `\nActive Reading Context:\n- Book Title: "${bookContext.title || "Educational Textbook"}"` +
        (bookContext.author ? `\n- Author/Publisher: "${bookContext.author}"` : "") +
        (bookContext.page
          ? `\n- Current Page: ${bookContext.page}${bookContext.numPages ? ` of ${bookContext.numPages}` : ""}`
          : "") +
        (bookContext.selectedText
          ? `\n- Highlighted Selection: "${bookContext.selectedText}"`
          : "")
      : "";

    const systemPrompt =
      `You are Sage AI, an expert educational tutor${subjectContext} guiding ${studentNameContext}. ${studyPatternsText}${bookGroundingText}\n` +
      `Pedagogical rules:\n` +
      `1. Build clear intuition with examples before formal derivations.\n` +
      `2. Structure responses cleanly using concise headings and bullet points.\n` +
      `3. Format all math, physics, and chemistry expressions strictly with LaTeX ($inline$ and $$display$$).`;

    if (provider === "anthropic" || provider === "claude") {
      const apiKey =
        Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
      if (!apiKey) {
        return jsonResponse(
          {
            error:
              "ANTHROPIC_API_KEY is not configured in Supabase Edge Function secrets.",
          },
          500,
        );
      }

      const modelName = "claude-sonnet-4-20250514";
      const anthropic = new Anthropic({ apiKey });
      const anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> =
        [];

      if (Array.isArray(history)) {
        for (const msg of history) {
          if (!msg?.content) continue;
          anthropicMessages.push({
            role:
              msg.role === "user" || msg.role === "User" ? "user" : "assistant",
            content: String(msg.content),
          });
        }
      }
      anthropicMessages.push({ role: "user", content: prompt });

      if (!wantStream) {
        const result = await anthropic.messages.create({
          model: modelName,
          max_tokens: 1024,
          system: systemPrompt,
          messages: anthropicMessages,
        });
        const text =
          result.content[0]?.type === "text" ? result.content[0].text : "";
        await recordUsage(
          result.usage?.input_tokens || 0,
          result.usage?.output_tokens || 0,
          modelName,
        );
        return jsonResponse({ reply: text });
      }

      const responseStream = await anthropic.messages.create({
        model: modelName,
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true,
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let inputTokens = 0;
          let outputTokens = 0;
          try {
            for await (const chunk of responseStream) {
              if (
                chunk.type === "message_start" &&
                chunk.message?.usage?.input_tokens
              ) {
                inputTokens = chunk.message.usage.input_tokens;
              }
              if (chunk.type === "message_delta" && chunk.usage?.output_tokens) {
                outputTokens = chunk.usage.output_tokens;
              }
              if (
                chunk.type === "content_block_delta" &&
                chunk.delta.type === "text_delta"
              ) {
                const data = JSON.stringify({
                  type: "delta",
                  text: chunk.delta.text,
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }
            recordUsage(inputTokens, outputTokens, modelName);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
            );
            controller.close();
          } catch (err: any) {
            const data = JSON.stringify({
              type: "delta",
              text: `\n[Error: ${err.message}]`,
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Default: Gemini 2.5 Flash
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return jsonResponse(
        {
          error:
            "GEMINI_API_KEY is not configured in Supabase Edge Function secrets.",
        },
        500,
      );
    }

    const geminiModel = "gemini-2.5-flash";
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    if (Array.isArray(history)) {
      for (const m of history) {
        if (!m?.content) continue;
        contents.push({
          role: m.role === "user" || m.role === "User" ? "user" : "model",
          parts: [{ text: String(m.content) }],
        });
      }
    }
    contents.push({ role: "user", parts: [{ text: prompt }] });

    if (!wantStream) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
          }),
        },
      );
      const data = await resp.json();
      const reply =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Unable to generate response.";
      await recordUsage(
        data?.usageMetadata?.promptTokenCount || 0,
        data?.usageMetadata?.candidatesTokenCount || 0,
        geminiModel,
      );
      return jsonResponse({ reply });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
        }),
      },
    );

    if (!response.body) {
      throw new Error("No response stream returned from Gemini API");
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let inputTokens = 0;
        let outputTokens = 0;
        try {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const dataStr = line.substring(6).trim();
              if (!dataStr || dataStr === "[DONE]") continue;
              try {
                const dataJson = JSON.parse(dataStr);
                if (dataJson.usageMetadata) {
                  inputTokens =
                    dataJson.usageMetadata.promptTokenCount || inputTokens;
                  outputTokens =
                    dataJson.usageMetadata.candidatesTokenCount || outputTokens;
                }
                const parts = dataJson.candidates?.[0]?.content?.parts;
                if (parts && parts.length > 0 && parts[0].text) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "delta", text: parts[0].text })}\n\n`,
                    ),
                  );
                }
              } catch (e) {
                console.error("Error parsing Gemini SSE:", e);
              }
            }
          }

          recordUsage(inputTokens, outputTokens, geminiModel);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
          );
          controller.close();
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "delta", text: `\n[Error: ${err.message}]` })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error: any) {
    console.error("Error in ai-tutor Edge Function:", error);
    return jsonResponse(
      { error: error?.message || "Failed to generate tutor response" },
      500,
    );
  }
});
