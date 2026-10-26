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

    const userStyle =
      typeof payload?.userStyle === "string"
        ? payload.userStyle.slice(0, 300)
        : "Visual learner, prefers structured examples";
    const readingHabits =
      typeof payload?.readingHabits === "string"
        ? payload.readingHabits.slice(0, 300)
        : "General learning and core curriculum subjects";
    const currentProgress =
      typeof payload?.currentProgress === "string"
        ? payload.currentProgress.slice(0, 300)
        : "Starting foundational topics";
    const fieldOfStudy =
      typeof payload?.fieldOfStudy === "string" && payload.fieldOfStudy.trim()
        ? payload.fieldOfStudy.trim().slice(0, 120)
        : "General Studies";
    const subjects =
      typeof payload?.subjects === "string" && payload.subjects.trim()
        ? payload.subjects.trim().slice(0, 200)
        : "Core Subjects";
    const planMode = payload?.planMode === "weekly" ? "weekly" : "roadmap";

    const prompt = `Generate a personalized 4-step ${planMode} learning path for a student studying ${fieldOfStudy} (${subjects}).
Learner Style: ${userStyle}
Reading Habits: ${readingHabits}
Current Progress: ${currentProgress}

Return JSON with a "steps" array where each item has:
- "title": concise milestone title
- "status": "completed" | "current" | "upcoming"
- "duration": estimated duration (e.g. "2 weeks")
- "description": 1-2 sentence academic milestone breakdown
- "concepts": array of 3 key syllabus concepts`;

    const { parsed, inputTokens, outputTokens, model } = await callGeminiJson({ prompt });
    const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];

    await recordAiUsage(adminClient, {
      userId: user.id,
      subject: `learning-path:${fieldOfStudy}`,
      model,
      inputTokens,
      outputTokens,
    });

    if (steps.length > 0) {
      const { error: insertErr } = await adminClient.from("learning_paths").insert({
        user_id: user.id,
        title: `${fieldOfStudy} Personalized Path`,
        field_of_study: fieldOfStudy,
        subjects,
        plan_mode: planMode,
        learner_style: userStyle,
        steps,
        is_active: true,
      });
      if (insertErr) console.error("learning_paths insert failed", insertErr);
    }

    return json(200, { steps });
  } catch (error) {
    console.error("learning-path failed", error);
    return json(500, { error: GENERIC_SERVICE_ERROR });
  }
});
