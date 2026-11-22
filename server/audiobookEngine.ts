import fs from "fs";
import path from "path";
import crypto from "crypto";
import JSZip from "jszip";
import { GoogleGenAI, Type } from "@google/genai";
import { generateEducationalEpub } from "./epubBuilder";

export interface AudiobookDiagramNode {
  label: string;
  detail: string;
  role?: string;
}

export interface AudiobookComplexConcept {
  conceptTitle: string;
  complexityReason: string;
  visualizationPrompt: string;
  diagramType: "cycle" | "comparison" | "process" | "formula" | "hierarchy" | "wave-or-optics";
  formulaOrRule?: string;
  keyTakeaways: string[];
  diagramNodes: AudiobookDiagramNode[];
}

export interface AudiobookSegment {
  id: string;
  heading: string;
  sourceExcerpt: string;
  narration: string;
  estimatedSeconds: number;
  isComplexConcept: boolean;
  complexConcept?: AudiobookComplexConcept;
}

export interface AudiobookChapterMeta {
  index: number;
  title: string;
  wordCount: number;
}

export interface AudiobookChapterScript {
  bookId: string;
  bookTitle: string;
  chapterIndex: number;
  chapterTitle: string;
  chaptersMeta: AudiobookChapterMeta[];
  sourceMode: "library-text" | "epub-curriculum";
  tutorModel: string;
  engine?: "gemini-tutor" | "textbook-concept-parser";
  ttsAvailable: boolean;
  aiNotice?: string;
  segments: AudiobookSegment[];
  generatedAt: string;
}

const VOICE_MAP: Record<string, string> = {
  seraphina: "Kore",
  marcus: "Charon",
  aria: "Zephyr",
  kore: "Kore",
  charon: "Charon",
  zephyr: "Zephyr",
  puck: "Puck",
  fenrir: "Fenrir",
};

let lastRejectedKeyHash: string | null = null;

function getUsableGeminiKey(): { apiKey: string | null; keyHash: string | null; reason?: string } {
  const raw = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (
    !raw ||
    raw === "MY_GEMINI_API_KEY" ||
    raw.startsWith("your_") ||
    raw.length < 16
  ) {
    return {
      apiKey: null,
      keyHash: null,
      reason: "GEMINI_API_KEY is not configured. Using extracted Library chapter narration with Device Voice.",
    };
  }
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  if (lastRejectedKeyHash && lastRejectedKeyHash === keyHash) {
    return {
      apiKey: null,
      keyHash,
      reason: "Configured GEMINI_API_KEY was rejected by Google AI. Using extracted Library chapter narration with Device Voice.",
    };
  }
  return { apiKey: raw, keyHash };
}

function isAuthKeyError(err: any): boolean {
  const raw = String(err?.message || err || "");
  return (
    err?.status === 400 ||
    err?.status === 401 ||
    err?.status === 403 ||
    raw.includes("API_KEY_INVALID") ||
    raw.includes("API key not valid") ||
    raw.includes("UNAUTHENTICATED")
  );
}

function humanizeMathAndAbbreviationsForSpeech(text: string): string {
  return String(text || "")
    .replace(/\be\.m\.f\./gi, "electromotive force")
    .replace(/\br\.m\.s\./gi, "root mean square")
    .replace(/\brad\s*s\^-1/gi, "radians per second")
    .replace(/\b1\/f\s*=\s*1\/u\s*\+\s*1\/v\b/gi, "one over f, equals one over u, plus one over v")
    .replace(/\bm\s*=\s*v\/u\b/gi, "m equals v divided by u")
    .replace(/\bFc\s*=\s*mv\^2\s*\/\s*r\b/gi, "F sub c equals m times v squared, divided by r")
    .replace(/\bm\s*\*\s*omega\^2\s*\*\s*r\b/gi, "m times omega squared times r")
    .replace(/\bsqrt\(([^)]+)\)/gi, "the square root of $1")
    .replace(/\bGMm\/r\^2\b/gi, "G times big M times little m, over r squared")
    .replace(/\bGM\/r\b/gi, "G times M divided by r")
    .replace(/\bI\^2\s*R\b/g, "I squared times R")
    .replace(/\bP_loss\b/g, "power loss")
    .replace(/([A-Za-z0-9])\^2\b/g, "$1 squared")
    .replace(/([A-Za-z0-9])\^3\b/g, "$1 cubed")
    .replace(/([A-Za-z])_([A-Za-z0-9]+)/g, "$1 sub $2")
    .replace(/\s*\*\s*/g, " times ")
    .replace(/\s+\/\s+/g, " divided by ")
    .replace(/(^|[\s(=+])([A-Za-z0-9]{1,2})\/([A-Za-z0-9]{1,2})(?=$|[\s.,;)+-])/g, "$1$2 divided by $3")
    .replace(/\s*=\s*/g, ", equals ")
    .replace(/\s*\+\s*/g, ", plus ")
    .replace(/\s+-\s+/g, ", minus ")
    .replace(/(?<=[A-Za-z]{2})-(?=[A-Za-z]{2})/g, " ")
    .replace(/\s*\(/g, ", ")
    .replace(/\)\s*/g, ", ")
    .replace(/,\s*,+/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function humanizeTextbookSegment(params: {
  rawParagraph: string;
  index: number;
  total: number;
  chapterTitle: string;
  isComplex: boolean;
  hasFormula: boolean;
}): string {
  const spokenCore = humanizeMathAndAbbreviationsForSpeech(params.rawParagraph);
  const cleanChapter = params.chapterTitle.replace(/^Chapter\s+\d+:\s*/i, "");

  if (params.index === 0) {
    return `Welcome back! Let's explore ${cleanChapter} together at a relaxed pace. Here's how to picture the core idea right from the start: ${spokenCore}`;
  }
  if (params.isComplex && params.hasFormula) {
    return `Now pause for just a second — here's an essential quantitative relationship worth hearing clearly, step by step. ${spokenCore} Take a quick glance at the formula schematic beside the script so every symbol clicks together.`;
  }
  if (params.isComplex) {
    return `Let's slow down slightly on this part, because once you see how the pieces fit together, it becomes super intuitive. ${spokenCore}`;
  }
  if (params.index === params.total - 1) {
    const tail = /^[A-Z]{2}/.test(spokenCore)
      ? spokenCore
      : `${spokenCore.charAt(0).toLowerCase()}${spokenCore.slice(1)}`;
    return `To tie this chapter together nicely — ${tail}`;
  }
  const transitions = [
    "Building right on that thought — ",
    "Here's why that matters in practice: ",
    "Notice how this connects directly: ",
  ];
  const opener = transitions[params.index % transitions.length];
  return `${opener}${spokenCore}`;
}

function buildDeterministicChapterSegments(params: {
  title: string;
  category?: string;
  curriculum?: string[];
  chapterTitle: string;
  chapterText: string;
}): AudiobookSegment[] {
  let rawParagraphs = params.chapterText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 15);
  const cleanTitle = params.chapterTitle.replace(/^Chapter\s+\d+:\s*/i, "").trim().toLowerCase();
  if (
    rawParagraphs.length > 1 &&
    rawParagraphs[0].length < 95 &&
    (rawParagraphs[0].toLowerCase() === params.chapterTitle.toLowerCase() ||
      (cleanTitle && rawParagraphs[0].toLowerCase().includes(cleanTitle)))
  ) {
    rawParagraphs = rawParagraphs.slice(1);
  }
  const paras = (rawParagraphs.length > 0 ? rawParagraphs : [params.chapterText.trim() || params.title]).slice(0, 8);

  const currLabel = params.curriculum?.[0] || params.category?.split(",")[0] || "Syllabus";

  return paras.map((para, idx) => {
    const sentences = para
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const formulaMatch = para.match(/([A-Za-z0-9_]+\s*=\s*[^.,;()\n]{3,42})/);
    const hasComplex =
      Boolean(formulaMatch) ||
      /\b(law|theorem|principle|equation|formula|lens|magnification|centripetal|induction|flux|orbital|transformer|osmosis|respiration|derivation|process|cycle|mechanism)\b/i.test(
        para
      );

    let diagramType: AudiobookComplexConcept["diagramType"] = "process";
    if (/lens|ray|focus|wave|optics|converg|diverg/i.test(para)) {
      diagramType = "wave-or-optics";
    } else if (/circular|orbit|cycle|respiration|feedback/i.test(para)) {
      diagramType = "cycle";
    } else if (formulaMatch) {
      diagramType = "formula";
    }

    const complexConcept: AudiobookComplexConcept | undefined = hasComplex
      ? {
          conceptTitle: `${params.chapterTitle.replace(/^Chapter \d+:\s*/i, "")} — Key Mechanism`,
          complexityReason: formulaMatch
            ? "Combines formal notation and variable relationships best understood with a diagram beside the audio."
            : "Connects multiple spatial or causal steps best understood visually while listening.",
          visualizationPrompt: `Instructional curriculum diagram for "${params.title}" (${currLabel}), illustrating ${params.chapterTitle}: label all physical variables, direction vectors, and relationships in "${sentences[0] || para.slice(0, 120)}"${formulaMatch ? ` including ${formulaMatch[1]}` : ""}.`,
          diagramType,
          formulaOrRule: formulaMatch ? formulaMatch[1].trim() : undefined,
          keyTakeaways: sentences.slice(0, 3),
          diagramNodes: (sentences.length >= 2 ? sentences : [para]).slice(0, 4).map((s, nIdx) => ({
            role: `Step ${nIdx + 1}`,
            label: s.split(/\s+/).slice(0, 3).join(" "),
            detail: s,
          })),
        }
      : undefined;

    const spokenNarration = humanizeTextbookSegment({
      rawParagraph: para,
      index: idx,
      total: paras.length,
      chapterTitle: params.chapterTitle,
      isComplex: hasComplex,
      hasFormula: Boolean(formulaMatch),
    });

    return {
      id: `seg-${idx + 1}`,
      heading:
        idx === 0
          ? params.chapterTitle
          : formulaMatch
          ? `Formula & Rule (${formulaMatch[1].slice(0, 20)})`
          : `Section ${idx + 1}`,
      sourceExcerpt: para,
      narration: spokenNarration,
      estimatedSeconds: Math.max(10, Math.round(spokenNarration.split(/\s+/).filter(Boolean).length / 2.2)),
      isComplexConcept: Boolean(complexConcept),
      complexConcept,
    };
  });
}

function ensureCacheDirs(uploadsDir: string) {
  const base = path.join(uploadsDir, "audiobook-cache");
  const scriptsDir = path.join(base, "scripts");
  const audioDir = path.join(base, "audio");
  if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true });
  if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
  return { scriptsDir, audioDir };
}

function stripXhtmlToText(xhtml: string): { title: string; text: string } {
  const titleMatch = xhtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || xhtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = (titleMatch?.[1] || "Chapter")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const bodyMatch = xhtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : xhtml;

  const text = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|h1|h2|h3|h4|li|blockquote|div)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text };
}

export async function extractServerChaptersFromEpubBuffer(
  epubBuffer: Buffer
): Promise<Array<{ title: string; text: string }>> {
  const zip = await JSZip.loadAsync(epubBuffer);
  const htmlFiles = Object.keys(zip.files)
    .filter(
      (name) =>
        !zip.files[name].dir &&
        /\.(xhtml|html|htm)$/i.test(name) &&
        !name.toLowerCase().includes("nav")
    )
    .sort();

  const chapters: Array<{ title: string; text: string }> = [];
  for (let i = 0; i < htmlFiles.length; i++) {
    const raw = await zip.files[htmlFiles[i]].async("text");
    const parsed = stripXhtmlToText(raw);
    if (parsed.text.length > 20) {
      chapters.push({
        title: parsed.title || `Chapter ${i + 1}`,
        text: parsed.text,
      });
    }
  }
  return chapters;
}

async function resolveBookChapterContent(params: {
  uploadsDir: string;
  bookId: string;
  fileUrl?: string;
  title: string;
  author?: string;
  publisher?: string;
  description?: string;
  chapterIndex: number;
  chapterTitle?: string;
  sourceText?: string;
  chaptersList?: Array<{ title: string; text: string }>;
}): Promise<{
  chapterTitle: string;
  chapterText: string;
  chaptersMeta: AudiobookChapterMeta[];
  sourceMode: "library-text" | "epub-curriculum";
}> {
  if (Array.isArray(params.chaptersList) && params.chaptersList.length > 0) {
    const idx = Math.max(0, Math.min(params.chapterIndex, params.chaptersList.length - 1));
    const chosen = params.chaptersList[idx];
    return {
      chapterTitle: params.chapterTitle || chosen.title || `Chapter ${idx + 1}`,
      chapterText: params.sourceText || chosen.text,
      chaptersMeta: params.chaptersList.map((c, i) => ({
        index: i,
        title: c.title || `Chapter ${i + 1}`,
        wordCount: c.text.split(/\s+/).filter(Boolean).length,
      })),
      sourceMode: "library-text",
    };
  }

  if (params.sourceText && params.sourceText.trim().length >= 40) {
    return {
      chapterTitle: params.chapterTitle || `Chapter ${params.chapterIndex + 1}`,
      chapterText: params.sourceText.trim(),
      chaptersMeta: [
        {
          index: params.chapterIndex,
          title: params.chapterTitle || `Chapter ${params.chapterIndex + 1}`,
          wordCount: params.sourceText.trim().split(/\s+/).filter(Boolean).length,
        },
      ],
      sourceMode: "library-text",
    };
  }

  // Try disk-stored EPUB file first if uploaded
  const key = params.fileUrl || params.bookId;
  const safeKey = key.replace(/^\/+/, "");
  const diskPath = path.join(params.uploadsDir, safeKey);
  if (safeKey.toLowerCase().endsWith(".epub") && fs.existsSync(diskPath)) {
    try {
      const buf = fs.readFileSync(diskPath);
      const parsed = await extractServerChaptersFromEpubBuffer(buf);
      if (parsed.length > 0) {
        const idx = Math.max(0, Math.min(params.chapterIndex, parsed.length - 1));
        return {
          chapterTitle: parsed[idx].title,
          chapterText: parsed[idx].text,
          chaptersMeta: parsed.map((c, i) => ({
            index: i,
            title: c.title,
            wordCount: c.text.split(/\s+/).filter(Boolean).length,
          })),
          sourceMode: "library-text",
        };
      }
    } catch (err) {
      console.warn("[Audiobook] Failed reading disk EPUB, falling back to curriculum builder:", err);
    }
  }

  // Fallback to generated curriculum EPUB edition
  const epubBuf = await generateEducationalEpub({
    id: params.bookId,
    title: params.title,
    author: params.author,
    publisher: params.publisher,
    description: params.description,
  });
  const parsed = await extractServerChaptersFromEpubBuffer(epubBuf);
  const chapters = parsed.length > 0
    ? parsed
    : [{ title: `Chapter 1: ${params.title}`, text: params.description || params.title }];
  const idx = Math.max(0, Math.min(params.chapterIndex, chapters.length - 1));

  return {
    chapterTitle: chapters[idx].title,
    chapterText: chapters[idx].text,
    chaptersMeta: chapters.map((c, i) => ({
      index: i,
      title: c.title,
      wordCount: c.text.split(/\s+/).filter(Boolean).length,
    })),
    sourceMode: "epub-curriculum",
  };
}

export async function generateAudiobookChapterScript(params: {
  uploadsDir: string;
  bookId: string;
  title: string;
  author?: string;
  publisher?: string;
  category?: string;
  level?: string;
  curriculum?: string[];
  subjects?: string[];
  description?: string;
  fileUrl?: string;
  chapterIndex?: number;
  chapterTitle?: string;
  sourceText?: string;
  chaptersList?: Array<{ title: string; text: string }>;
  academicSummary?: string;
  forceRefresh?: boolean;
}): Promise<AudiobookChapterScript> {
  const chapterIndex = Math.max(0, Number(params.chapterIndex || 0));
  const resolved = await resolveBookChapterContent({
    uploadsDir: params.uploadsDir,
    bookId: params.bookId,
    fileUrl: params.fileUrl,
    title: params.title,
    author: params.author,
    publisher: params.publisher,
    description: params.description,
    chapterIndex,
    chapterTitle: params.chapterTitle,
    sourceText: params.sourceText,
    chaptersList: params.chaptersList,
  });

  const truncatedSource = resolved.chapterText.slice(0, 7500);
  const { scriptsDir } = ensureCacheDirs(params.uploadsDir);
  const cacheKey = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        v: 3,
        bookId: params.bookId,
        chapterIndex,
        chapterTitle: resolved.chapterTitle,
        textHash: crypto.createHash("md5").update(truncatedSource).digest("hex"),
      })
    )
    .digest("hex");
  const cacheFile = path.join(scriptsDir, `${cacheKey}.json`);

  const keyState = getUsableGeminiKey();

  if (!params.forceRefresh && fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf-8")) as AudiobookChapterScript;
      if (Array.isArray(cached?.segments) && cached.segments.length > 0) {
        return {
          ...cached,
          ttsAvailable: Boolean(keyState.apiKey),
          chaptersMeta: resolved.chaptersMeta.length > 0 ? resolved.chaptersMeta : cached.chaptersMeta,
        };
      }
    } catch (_) {}
  }

  if (!keyState.apiKey) {
    return {
      bookId: params.bookId,
      bookTitle: params.title,
      chapterIndex,
      chapterTitle: resolved.chapterTitle,
      chaptersMeta: resolved.chaptersMeta,
      sourceMode: resolved.sourceMode,
      tutorModel: "textbook-concept-parser",
      engine: "textbook-concept-parser",
      ttsAvailable: false,
      aiNotice: keyState.reason,
      segments: buildDeterministicChapterSegments({
        title: params.title,
        category: params.category,
        curriculum: params.curriculum,
        chapterTitle: resolved.chapterTitle,
        chapterText: truncatedSource,
      }),
      generatedAt: new Date().toISOString(),
    };
  }

  const ai = new GoogleGenAI({
    apiKey: keyState.apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });

  const curriculumContext = [
    params.curriculum?.length ? `Curriculum: ${params.curriculum.join(", ")}` : "",
    params.level ? `Level: ${params.level}` : "",
    params.subjects?.length ? `Subjects: ${params.subjects.join(", ")}` : "",
    params.category ? `Category: ${params.category}` : "",
    params.academicSummary ? `Learner Profile: ${params.academicSummary}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const prompt = `You are an elite, deeply human educational audiobook narrator AND a multimodal instructional designer specializing in sciences and rigorous academic textbooks.

BOOK CONTEXT:
Title: "${params.title}"
Author: ${params.author || "Academic Faculty"}
${curriculumContext}
Chapter: "${resolved.chapterTitle}"

STRICT GOALS & CONSTRAINTS:
1. Natural, Warm Human Conversation (Zero-Loss): Convert the textbook prose below into 3 to 5 spoken tutoring segments that sound unmistakably human — like an encouraging, articulate mentor sitting across the table. Use natural contractions ("let's", "here's", "you'll notice"), gentle rhetorical check-ins ("Think about why that happens...", "Picture this for a moment —"), and varied sentence rhythm with commas and em-dashes so a voice synthesizer breathes naturally. NEVER omit, shorten, or simplify any textbook facts, equations, units, numbers, definitions, or rules.
2. Natural Spoken Math & Rhythm: Never output raw symbolic math that reads like robot code (write "one over f, equals one over u, plus one over v", "centripetal force F sub c equals m times v squared, divided by r"). Keep segments concise (50–115 words) with natural conversational pacing.
3. Complex Concept Identification: Set isComplexConcept = true whenever the segment introduces an abstract mechanism, spatial geometry, mathematical formula, derivation, microscopic process, or computationally heavy idea.
4. Dynamic Visualization Prompts: Whenever isComplexConcept is true, provide a complete complexConcept object containing:
   - conceptTitle: concise title of the complex concept
   - complexityReason: 1 short sentence explaining why learners benefit from a visual model
   - visualizationPrompt: a rich, descriptive prompt for an instructional illustration or curriculum diagram directly relevant to "${params.title}" (${params.curriculum?.join(", ") || params.category || "syllabus"})
   - diagramType: choose the best fit from "cycle", "comparison", "process", "formula", "hierarchy", "wave-or-optics"
   - formulaOrRule: key mathematical equation or scientific law if applicable (e.g., "1/f = 1/u + 1/v")
   - keyTakeaways: 2 to 3 crisp, zero-loss key points
   - diagramNodes: 3 to 4 labeled visual parts (label + detail + role) so the learner can inspect an interactive concept diagram immediately while listening.

TEXTBOOK CHAPTER CONTENT:
"""
${truncatedSource}
"""`;

  const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  let generated: any = null;
  let usedModel = modelsToTry[0];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              segments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    heading: { type: Type.STRING },
                    sourceExcerpt: { type: Type.STRING },
                    narration: { type: Type.STRING },
                    estimatedSeconds: { type: Type.NUMBER },
                    isComplexConcept: { type: Type.BOOLEAN },
                    complexConcept: {
                      type: Type.OBJECT,
                      properties: {
                        conceptTitle: { type: Type.STRING },
                        complexityReason: { type: Type.STRING },
                        visualizationPrompt: { type: Type.STRING },
                        diagramType: { type: Type.STRING },
                        formulaOrRule: { type: Type.STRING },
                        keyTakeaways: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                        diagramNodes: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              label: { type: Type.STRING },
                              detail: { type: Type.STRING },
                              role: { type: Type.STRING },
                            },
                            required: ["label", "detail"],
                          },
                        },
                      },
                      required: [
                        "conceptTitle",
                        "complexityReason",
                        "visualizationPrompt",
                        "diagramType",
                        "keyTakeaways",
                        "diagramNodes",
                      ],
                    },
                  },
                  required: [
                    "id",
                    "heading",
                    "sourceExcerpt",
                    "narration",
                    "estimatedSeconds",
                    "isComplexConcept",
                  ],
                },
              },
            },
            required: ["segments"],
          },
        },
      });

      const rawText = response.text?.trim() || "";
      const parsedJson = JSON.parse(rawText);
      if (Array.isArray(parsedJson?.segments) && parsedJson.segments.length > 0) {
        generated = parsedJson;
        usedModel = modelName;
        break;
      }
    } catch (err: any) {
      lastError = err;
      if (isAuthKeyError(err)) {
        lastRejectedKeyHash = keyState.keyHash;
        break;
      }
    }
  }

  if (!generated) {
    const notice = isAuthKeyError(lastError)
      ? "Configured GEMINI_API_KEY was rejected by Google AI. Using extracted Library chapter narration with Device Voice."
      : "Cloud AI Tutor narration is temporarily busy. Playing full extracted textbook chapter with local concept diagrams.";
    return {
      bookId: params.bookId,
      bookTitle: params.title,
      chapterIndex,
      chapterTitle: resolved.chapterTitle,
      chaptersMeta: resolved.chaptersMeta,
      sourceMode: resolved.sourceMode,
      tutorModel: "textbook-concept-parser",
      engine: "textbook-concept-parser",
      ttsAvailable: !isAuthKeyError(lastError),
      aiNotice: notice,
      segments: buildDeterministicChapterSegments({
        title: params.title,
        category: params.category,
        curriculum: params.curriculum,
        chapterTitle: resolved.chapterTitle,
        chapterText: truncatedSource,
      }),
      generatedAt: new Date().toISOString(),
    };
  }

  const normalizedSegments: AudiobookSegment[] = generated.segments.map((seg: any, index: number) => {
    const narration = String(seg.narration || "").trim();
    const wordCount = narration.split(/\s+/).filter(Boolean).length;
    const estSeconds = Math.max(10, Math.round(Number(seg.estimatedSeconds) || wordCount / 2.3));
    const allowedTypes = new Set([
      "cycle",
      "comparison",
      "process",
      "formula",
      "hierarchy",
      "wave-or-optics",
    ]);

    let complexConcept: AudiobookComplexConcept | undefined;
    if (seg.isComplexConcept && seg.complexConcept) {
      const rawType = String(seg.complexConcept.diagramType || "process").toLowerCase();
      complexConcept = {
        conceptTitle: String(seg.complexConcept.conceptTitle || seg.heading || "Key Concept"),
        complexityReason: String(seg.complexConcept.complexityReason || ""),
        visualizationPrompt: String(seg.complexConcept.visualizationPrompt || ""),
        diagramType: (allowedTypes.has(rawType) ? rawType : "process") as AudiobookComplexConcept["diagramType"],
        formulaOrRule: seg.complexConcept.formulaOrRule ? String(seg.complexConcept.formulaOrRule) : undefined,
        keyTakeaways: Array.isArray(seg.complexConcept.keyTakeaways)
          ? seg.complexConcept.keyTakeaways.map((k: any) => String(k)).slice(0, 4)
          : [],
        diagramNodes: Array.isArray(seg.complexConcept.diagramNodes)
          ? seg.complexConcept.diagramNodes.slice(0, 5).map((n: any) => ({
              label: String(n.label || ""),
              detail: String(n.detail || ""),
              role: n.role ? String(n.role) : undefined,
            }))
          : [],
      };
    }

    return {
      id: String(seg.id || `seg-${index + 1}`),
      heading: String(seg.heading || `Section ${index + 1}`),
      sourceExcerpt: String(seg.sourceExcerpt || ""),
      narration,
      estimatedSeconds: estSeconds,
      isComplexConcept: Boolean(seg.isComplexConcept && complexConcept),
      complexConcept,
    };
  });

  const script: AudiobookChapterScript = {
    bookId: params.bookId,
    bookTitle: params.title,
    chapterIndex,
    chapterTitle: resolved.chapterTitle,
    chaptersMeta: resolved.chaptersMeta,
    sourceMode: resolved.sourceMode,
    tutorModel: usedModel,
    engine: "gemini-tutor",
    ttsAvailable: true,
    segments: normalizedSegments,
    generatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(cacheFile, JSON.stringify(script, null, 2), "utf-8");
  } catch (_) {}

  return script;
}

export async function synthesizeAudiobookSpeech(params: {
  uploadsDir: string;
  text: string;
  voiceId?: string;
}): Promise<{ wavBuffer: Buffer; voiceName: string; cached: boolean }> {
  const cleanText = String(params.text || "").trim();
  if (!cleanText) {
    throw new Error("Narration text is required for speech synthesis.");
  }

  const normalizedVoiceKey = String(params.voiceId || "seraphina").toLowerCase().trim();
  const voiceName = VOICE_MAP[normalizedVoiceKey] || "Kore";

  const { audioDir } = ensureCacheDirs(params.uploadsDir);
  const hash = crypto
    .createHash("sha256")
    .update(`${voiceName}::${cleanText}`)
    .digest("hex");
  const audioFile = path.join(audioDir, `${hash}.wav`);

  if (fs.existsSync(audioFile)) {
    return {
      wavBuffer: fs.readFileSync(audioFile),
      voiceName,
      cached: true,
    };
  }

  const keyState = getUsableGeminiKey();
  if (!keyState.apiKey) {
    const err: any = new Error(keyState.reason || "GEMINI_API_KEY is not configured.");
    err.status = 503;
    throw err;
  }

  const ai = new GoogleGenAI({
    apiKey: keyState.apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });

  const modelsToTry = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"];
  let wavBuffer: Buffer | null = null;
  let lastErr: any = null;

  // Add subtle natural breath cue for flagship gemini-3.8-flash-tts for lifelike pacing
  const expressiveScript = cleanText.replace(/\.\s+/g, ". <breath> ");

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  modelName === "gemini-3.8-flash-tts"
                    ? expressiveScript
                    : cleanText,
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        wavBuffer = Buffer.from(base64Audio, "base64");
        break;
      }
    } catch (err: any) {
      lastErr = err;
      if (isAuthKeyError(err)) {
        lastRejectedKeyHash = keyState.keyHash;
        break;
      }
    }
  }

  if (!wavBuffer) {
    if (isAuthKeyError(lastErr)) {
      const authErr: any = new Error(
        "Configured GEMINI_API_KEY is invalid for Studio TTS. Using Device Voice."
      );
      authErr.status = 503;
      throw authErr;
    }
    throw lastErr || new Error("Speech synthesis returned empty audio payload.");
  }

  try {
    fs.writeFileSync(audioFile, wavBuffer);
  } catch (_) {}

  return { wavBuffer, voiceName, cached: false };
}
