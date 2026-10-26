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
      subject = "Physics",
      topic = "Core Syllabus Concepts",
      curriculum = "CBC Kenya",
      gradeLevel = "Senior School",
      difficulty = "medium",
      questionCount = 5,
      bookId = null,
    } = await req.json();

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return jsonResponse(
        { error: "GEMINI_API_KEY is not configured in Supabase secrets." },
        500,
      );
    }

    const { adminClient, user } = await resolveSupabaseContext(req);

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
    const quizData = JSON.parse(
      raw?.candidates?.[0]?.content?.parts?.[0]?.text || "{}",
    );

    let savedQuizId: string | null = null;
    if (adminClient && Array.isArray(quizData.questions)) {
      const { data: inserted } = await adminClient
        .from("quizzes")
        .insert({
          creator_id: user?.id ?? null,
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
      savedQuizId = inserted?.id ?? null;
    }

    return jsonResponse({
      id: savedQuizId || crypto.randomUUID(),
      ...quizData,
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to generate quiz" },
      500,
    );
  }
});
