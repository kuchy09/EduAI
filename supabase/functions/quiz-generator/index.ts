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

    const subject =
      typeof payload?.subject === "string" && payload.subject.trim()
        ? payload.subject.trim().slice(0, 100)
        : "Physics";
    const topic =
      typeof payload?.topic === "string" && payload.topic.trim()
        ? payload.topic.trim().slice(0, 200)
        : "Core Syllabus Concepts";
    const curriculum =
      typeof payload?.curriculum === "string" && payload.curriculum.trim()
        ? payload.curriculum.trim().slice(0, 80)
        : "CBC Kenya";
    const gradeLevel =
      typeof payload?.gradeLevel === "string" && payload.gradeLevel.trim()
        ? payload.gradeLevel.trim().slice(0, 80)
        : "Senior School";
    const difficulty = ["easy", "medium", "hard"].includes(payload?.difficulty)
      ? payload.difficulty
      : "medium";
    const questionCount = Math.min(20, Math.max(1, Number(payload?.questionCount) || 5));
    const bookId = payload?.bookId ? String(payload.bookId).slice(0, 120) : null;

    const prompt = `Create a ${questionCount}-question multiple-choice assessment for ${subject} (${topic}) aligned with ${curriculum} (${gradeLevel}), difficulty: ${difficulty}.
Return JSON matching:
{
  "title": "Quiz title",
  "subject": "${subject}",
  "questions": [
    {
      "question": "Clear syllabus question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief pedagogical explanation"
    }
  ]
}`;

    const { parsed: quizData, inputTokens, outputTokens, model } = await callGeminiJson({ prompt });

    await recordAiUsage(adminClient, {
      userId: user.id,
      subject: `quiz:${subject}`,
      model,
      bookId,
      inputTokens,
      outputTokens,
    });

    let savedQuizId: string | null = null;
    if (Array.isArray(quizData?.questions)) {
      const { data: inserted, error: insertErr } = await adminClient
        .from("quizzes")
        .insert({
          creator_id: user.id,
          book_id: bookId,
          title: quizData.title || `${subject}: ${topic}`,
          subject,
          curriculum,
          grade_level: gradeLevel,
          difficulty,
          questions: quizData.questions,
          is_public: true,
        })
        .select("id")
        .single();
      if (insertErr) console.error("quizzes insert failed", insertErr);
      savedQuizId = inserted?.id ?? null;
    }

    return json(200, {
      id: savedQuizId || crypto.randomUUID(),
      ...quizData,
    });
  } catch (error) {
    console.error("quiz-generator failed", error);
    return json(500, { error: GENERIC_SERVICE_ERROR });
  }
});
