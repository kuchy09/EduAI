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
    const {
      userStyle = "Visual learner, prefers structured examples",
      readingHabits = "General learning and core curriculum subjects",
      currentProgress = "Starting foundational topics",
      fieldOfStudy = "General Studies",
      subjects = "Core Subjects",
      planMode = "roadmap",
    } = await req.json();

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return jsonResponse(
        { error: "GEMINI_API_KEY is not configured in Supabase secrets." },
        500,
      );
    }

    const { adminClient, user } = await resolveSupabaseContext(req);

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

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );

    const raw = await resp.json();
    const parsed = JSON.parse(
      raw?.candidates?.[0]?.content?.parts?.[0]?.text || '{"steps":[]}',
    );
    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];

    if (adminClient && user && steps.length > 0) {
      await adminClient.from("learning_paths").insert({
        user_id: user.id,
        title: `${fieldOfStudy} Personalized Path`,
        field_of_study: fieldOfStudy,
        subjects,
        plan_mode: planMode === "weekly" ? "weekly" : "roadmap",
        learner_style: userStyle,
        steps,
        is_active: true,
      });
    }

    return jsonResponse({ steps });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to generate learning path" },
      500,
    );
  }
});
