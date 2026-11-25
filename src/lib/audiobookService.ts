import { Book } from '../types';
import { parseEpubArrayBuffer } from './epubParser';
import {
  getBookContentLocal,
  openDB,
  saveBookContentLocal,
  saveReadingProgressLocal,
} from './offlineManager';
import { safeStorage } from './safeStorage';

export interface AudiobookDiagramNode {
  label: string;
  detail: string;
  role?: string;
}

export interface AudiobookComplexConcept {
  conceptTitle: string;
  complexityReason: string;
  visualizationPrompt: string;
  diagramType: 'cycle' | 'comparison' | 'process' | 'formula' | 'hierarchy' | 'wave-or-optics';
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
  sourceMode: 'library-text' | 'epub-curriculum';
  tutorModel: string;
  engine?: 'qwen3-tutor' | 'gemini-tutor' | 'textbook-concept-parser';
  ttsAvailable?: boolean;
  aiNotice?: string;
  segments: AudiobookSegment[];
  generatedAt: string;
}

export interface ExtractedBookChapter {
  title: string;
  text: string;
}

export interface AudioResumeState {
  bookId: string;
  chapterIndex: number;
  segmentIndex: number;
  progressPercent: number;
  voiceId: string;
  updatedAt: number;
}

const AUDIO_WAV_CACHE_NAME = 'eduai-audiobook-wav-v1';

async function getCachedBookRawBlob(bookId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction('book_blobs', 'readonly');
      const req = tx.objectStore('book_blobs').get(bookId);
      req.onsuccess = () => resolve((req.result?.blob as Blob) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function isZipOrEpubBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false;
  const bytes = new Uint8Array(buf, 0, 4);
  return bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
}

export async function extractLibraryBookChapters(book: Book): Promise<ExtractedBookChapter[]> {
  // 1. Check IndexedDB cached book_content first (instant + works offline)
  const localContent = await getBookContentLocal(book.id);
  if (localContent?.chapters && localContent.chapters.length > 0) {
    const nonEmpty = localContent.chapters
      .filter((ch) => typeof ch.content === 'string' && ch.content.trim().length > 20)
      .map((ch, i) => ({
        title: ch.title || `Chapter ${i + 1}`,
        text: ch.content.trim(),
      }));
    if (nonEmpty.length > 0) {
      return nonEmpty;
    }
  }

  // 2. Check cached binary EPUB blob in IndexedDB
  const cachedBlob = await getCachedBookRawBlob(book.id);
  if (cachedBlob) {
    try {
      const buf = await cachedBlob.arrayBuffer();
      if (isZipOrEpubBuffer(buf)) {
        const parsed = await parseEpubArrayBuffer(buf, {
          title: book.title,
          author: book.author,
          publisher: book.publisher,
        });
        if (parsed.chapters.length > 0) {
          const chapters = parsed.chapters.map((ch) => ({
            title: ch.title,
            text: ch.plainText,
          }));
          await saveBookContentLocal(book.id, {
            title: parsed.title,
            author: parsed.author,
            category: book.category,
            chapters: parsed.chapters.map((ch, i) => ({
              chapterNumber: i + 1,
              title: ch.title,
              content: ch.plainText,
            })),
            fullText: chapters.map((c) => `${c.title}\n\n${c.text}`).join('\n\n---\n\n'),
          });
          return chapters;
        }
      }
    } catch (err) {
      console.warn('[AudiobookService] Cached EPUB parse warning:', err);
    }
  }

  // 3. Fetch reflowable EPUB edition from server if online
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const fileKey = book.fileUrl || book.id;
      const url = `/api/download?key=${encodeURIComponent(fileKey)}&format=epub`;
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (isZipOrEpubBuffer(buf)) {
          const parsed = await parseEpubArrayBuffer(buf, {
            title: book.title,
            author: book.author,
            publisher: book.publisher,
          });
          if (parsed.chapters.length > 0) {
            const chapters = parsed.chapters.map((ch) => ({
              title: ch.title,
              text: ch.plainText,
            }));
            await saveBookContentLocal(book.id, {
              title: parsed.title,
              author: parsed.author,
              category: book.category,
              chapters: parsed.chapters.map((ch, i) => ({
                chapterNumber: i + 1,
                title: ch.title,
                content: ch.plainText,
              })),
              fullText: chapters.map((c) => `${c.title}\n\n${c.text}`).join('\n\n---\n\n'),
            });
            return chapters;
          }
        }
      }
    } catch (err) {
      console.warn('[AudiobookService] Remote EPUB chapter fetch notice:', err);
    }
  }

  // 4. Local fallback from book_content fullText or description/insights
  if (localContent?.fullText && localContent.fullText.trim().length > 30) {
    return [
      {
        title: `Chapter 1: ${book.title}`,
        text: localContent.fullText.trim(),
      },
    ];
  }

  const assembled = [
    book.description || '',
    ...(book.aiInsights || []),
  ]
    .filter(Boolean)
    .join('\n\n');

  return [
    {
      title: `Chapter 1: Foundations of ${book.title}`,
      text:
        assembled ||
        `${book.title} by ${book.author}. Core curriculum principles and worked analytical foundations.`,
    },
  ];
}

function getScriptLocalStorageKey(bookId: string, chapterIndex: number): string {
  return `eduai_audiobook_script_${bookId}_ch${chapterIndex}`;
}

export function getCachedAudiobookScriptLocal(
  bookId: string,
  chapterIndex: number
): AudiobookChapterScript | null {
  try {
    const raw = safeStorage.getItem(getScriptLocalStorageKey(bookId, chapterIndex));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AudiobookChapterScript;
    if (Array.isArray(parsed?.segments) && parsed.segments.length > 0) {
      return parsed;
    }
  } catch {
    // ignore parse failure
  }
  return null;
}

export async function fetchAudiobookChapterScript(params: {
  book: Book;
  chapterIndex: number;
  chapters: ExtractedBookChapter[];
  academicSummary?: string;
  forceRefresh?: boolean;
}): Promise<AudiobookChapterScript> {
  const { book, chapterIndex, chapters, academicSummary, forceRefresh } = params;

  if (!forceRefresh) {
    const localCached = getCachedAudiobookScriptLocal(book.id, chapterIndex);
    if (localCached && (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return localCached;
    }
  }

  const targetChapter = chapters[chapterIndex] || chapters[0];
  const response = await fetch('/api/audiobooks/script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookId: book.id,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      category: book.category,
      level: book.level,
      curriculum: book.curriculum,
      subjects: book.subjects,
      description: book.description,
      fileUrl: book.fileUrl,
      chapterIndex,
      chapterTitle: targetChapter?.title,
      sourceText: targetChapter?.text,
      chaptersList: chapters,
      academicSummary,
      forceRefresh,
    }),
  });

  if (!response.ok) {
    const errPayload = await response.json().catch(() => ({}));
    throw new Error(errPayload.error || `Failed to generate narration script (${response.status})`);
  }

  const script = (await response.json()) as AudiobookChapterScript;
  try {
    safeStorage.setItem(
      getScriptLocalStorageKey(book.id, chapterIndex),
      JSON.stringify(script)
    );
  } catch {
    // ignore storage quota limits
  }
  return script;
}

function buildAudioCacheUrl(bookId: string, chapterIndex: number, segmentId: string, voiceId: string): string {
  return `/_audiobook_cache/${encodeURIComponent(bookId)}/${chapterIndex}/${encodeURIComponent(segmentId)}/${encodeURIComponent(voiceId)}.wav`;
}

export async function hasCachedSegmentAudio(
  bookId: string,
  chapterIndex: number,
  segmentId: string,
  voiceId: string
): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open(AUDIO_WAV_CACHE_NAME);
    const match = await cache.match(buildAudioCacheUrl(bookId, chapterIndex, segmentId, voiceId));
    return Boolean(match);
  } catch {
    return false;
  }
}

export async function fetchOrGetCachedSegmentAudioUrl(params: {
  bookId: string;
  chapterIndex: number;
  segmentId: string;
  text: string;
  voiceId: string;
  signal?: AbortSignal;
}): Promise<{ objectUrl: string; cached: boolean }> {
  const { bookId, chapterIndex, segmentId, text, voiceId, signal } = params;
  const cacheKeyUrl = buildAudioCacheUrl(bookId, chapterIndex, segmentId, voiceId);

  // 1. Check CacheStorage for offline-ready audio WAV
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(AUDIO_WAV_CACHE_NAME);
      const cachedResp = await cache.match(cacheKeyUrl);
      if (cachedResp) {
        const blob = await cachedResp.blob();
        return { objectUrl: URL.createObjectURL(blob), cached: true };
      }
    } catch {
      // CacheStorage unavailable; proceed to network
    }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Offline audio not cached yet for this segment.');
  }

  // 2. Request Gemini TTS audio WAV from server
  const res = await fetch('/api/audiobooks/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
    signal,
  });

  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(errPayload.error || `Audio synthesis failed (${res.status})`);
  }

  const wavBlob = await res.blob();

  // Persist into CacheStorage for instant replay & offline playback
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(AUDIO_WAV_CACHE_NAME);
      await cache.put(
        cacheKeyUrl,
        new Response(wavBlob, {
          headers: { 'Content-Type': 'audio/wav' },
        })
      );
    } catch {
      // ignore storage quota failure
    }
  }

  return {
    objectUrl: URL.createObjectURL(wavBlob),
    cached: res.headers.get('X-TTS-Cached') === '1',
  };
}

export async function cacheFullChapterAudioOffline(params: {
  script: AudiobookChapterScript;
  voiceId: string;
  onProgress?: (completed: number, total: number) => void;
}): Promise<number> {
  const { script, voiceId, onProgress } = params;
  const total = script.segments.length;
  let completed = 0;

  try {
    safeStorage.setItem(
      getScriptLocalStorageKey(script.bookId, script.chapterIndex),
      JSON.stringify(script)
    );
  } catch {
    // ignore storage quota limits
  }

  for (const seg of script.segments) {
    const res = await fetchOrGetCachedSegmentAudioUrl({
      bookId: script.bookId,
      chapterIndex: script.chapterIndex,
      segmentId: seg.id,
      text: seg.narration,
      voiceId,
    });
    URL.revokeObjectURL(res.objectUrl);
    completed += 1;
    onProgress?.(completed, total);
  }

  return completed;
}

export function getAudioResumeState(bookId: string): AudioResumeState | null {
  try {
    const raw = safeStorage.getItem(`eduai_audio_resume_${bookId}`);
    if (!raw) return null;
    return JSON.parse(raw) as AudioResumeState;
  } catch {
    return null;
  }
}

export async function saveAudioProgressAndSyncLibrary(params: {
  bookId: string;
  chapterIndex: number;
  totalChapters: number;
  segmentIndex: number;
  totalSegments: number;
  voiceId: string;
}): Promise<number> {
  const { bookId, chapterIndex, totalChapters, segmentIndex, totalSegments, voiceId } = params;
  const safeChapters = Math.max(1, totalChapters);
  const safeSegments = Math.max(1, totalSegments);
  const chapterWeight = 100 / safeChapters;
  const segmentPctWithinChapter = ((segmentIndex + 1) / safeSegments) * chapterWeight;
  const overallPct = Math.max(
    1,
    Math.min(100, Math.round(chapterIndex * chapterWeight + segmentPctWithinChapter))
  );

  const state: AudioResumeState = {
    bookId,
    chapterIndex,
    segmentIndex,
    progressPercent: overallPct,
    voiceId,
    updatedAt: Date.now(),
  };

  try {
    safeStorage.setItem(`eduai_audio_resume_${bookId}`, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }

  await saveReadingProgressLocal(bookId, overallPct, chapterIndex + 1, safeChapters, overallPct);
  return overallPct;
}

export interface RankedBrowserVoice {
  voice: SpeechSynthesisVoice;
  label: string;
  isNeural: boolean;
  score: number;
}

function scoreSpeechVoice(voice: SpeechSynthesisVoice, profileId: string): number {
  const name = voice.name || '';
  const lower = name.toLowerCase();
  const lang = (voice.lang || '').toLowerCase();

  let score = 0;
  if (lang.startsWith('en')) score += 40;
  else return -500;

  // Penalize robotic legacy synthesizers
  if (/espeak|mbrola|festival|eloquence|compact|pico/i.test(lower)) score -= 250;

  // Highest priority: Edge Natural / Chrome Google Neural / macOS Enhanced/Premium
  if (/online \(natural\)|natural|neural/i.test(lower)) score += 160;
  if (/google (us|uk|australian|indian) english/i.test(lower)) score += 145;
  if (/enhanced|premium|siri/i.test(lower)) score += 130;
  if (!voice.localService) score += 60;

  // Preferred warm human voices across macOS / Windows / Android / ChromeOS
  if (/aria|jenny|sonia|libby|ava|allison|serena|samantha|karen|moira|daniel|guy|ryan|andrew|christopher|rishi|tessa/i.test(lower)) {
    score += 45;
  }

  // Persona gender alignment
  const wantsMale = profileId === 'marcus';
  const looksMale = /\b(male|daniel|guy|ryan|andrew|eric|christopher|george|alex|arthur|david|rishi|mark)\b/i.test(lower);
  const looksFemale = /\b(female|aria|jenny|sonia|libby|ava|allison|serena|samantha|karen|moira|tessa|victoria|susan|zira|hazel)\b/i.test(lower);

  if (wantsMale) {
    if (looksMale) score += 50;
    if (looksFemale) score -= 20;
  } else {
    if (looksFemale) score += 50;
    if (looksMale) score -= 20;
  }

  return score;
}

export function getRankedBrowserVoices(profileId = 'seraphina'): RankedBrowserVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return [];

  return voices
    .filter((v) => (v.lang || '').toLowerCase().startsWith('en'))
    .map((voice) => {
      const score = scoreSpeechVoice(voice, profileId);
      const isNeural =
        /natural|neural|google|enhanced|premium|siri/i.test(voice.name) ||
        !voice.localService;
      const cleanName = voice.name
        .replace(/Microsoft\s+/i, '')
        .replace(/\s+-\s+English.*$/i, '')
        .replace(/\(Natural\)/i, '')
        .trim();
      return {
        voice,
        label: isNeural ? `${cleanName} · Natural` : cleanName,
        isNeural,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function pickBrowserVoiceForProfile(
  voiceId: string,
  preferredVoiceUri?: string
): { voice: SpeechSynthesisVoice | null; isNeural: boolean; displayName: string } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { voice: null, isNeural: false, displayName: 'System Speech' };
  }
  const ranked = getRankedBrowserVoices(voiceId);
  if (ranked.length === 0) {
    return { voice: null, isNeural: false, displayName: 'Default Speech' };
  }
  if (preferredVoiceUri) {
    const manual = ranked.find((r) => r.voice.voiceURI === preferredVoiceUri);
    if (manual) {
      return {
        voice: manual.voice,
        isNeural: manual.isNeural,
        displayName: manual.label,
      };
    }
  }
  return {
    voice: ranked[0].voice,
    isNeural: ranked[0].isNeural,
    displayName: ranked[0].label,
  };
}

export interface HumanSpeechChunk {
  text: string;
  pauseAfterMs: number;
  pitchOffset: number;
  rateMultiplier: number;
}

export function splitIntoHumanSpeechChunks(text: string): HumanSpeechChunk[] {
  const cleaned = String(text || '')
    .replace(/\s*—\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];

  // Split by sentence boundaries first, then split very long sentences on clauses/em-dashes
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: HumanSpeechChunk[] = [];
  for (const sentence of sentences) {
    if (sentence.length > 140 && /[;:]| — /.test(sentence)) {
      const subClauses = sentence
        .split(/(?<=[;:]| — )\s+/)
        .map((c) => c.trim())
        .filter(Boolean);
      subClauses.forEach((clause, idx) => {
        const isLastClause = idx === subClauses.length - 1;
        const isQuestion = clause.endsWith('?');
        chunks.push({
          text: clause,
          pauseAfterMs: isLastClause ? (isQuestion ? 360 : 240) : 140,
          pitchOffset: isQuestion ? 0.04 : idx === 0 ? 0.01 : -0.01,
          rateMultiplier: clause.includes('equals') ? 0.93 : 1.0,
        });
      });
    } else {
      const isQuestion = sentence.endsWith('?');
      const isFormulaSentence = /\bequals\b|\bdivided by\b|\bsquared\b/i.test(sentence);
      chunks.push({
        text: sentence,
        pauseAfterMs: isQuestion ? 360 : isFormulaSentence ? 300 : 210,
        pitchOffset: isQuestion ? 0.04 : isFormulaSentence ? -0.015 : 0,
        rateMultiplier: isFormulaSentence ? 0.92 : 1.0,
      });
    }
  }

  return chunks;
}

function humanizeMathForClientSpeech(text: string): string {
  return String(text || '')
    .replace(/\be\.m\.f\./gi, 'electromotive force')
    .replace(/\br\.m\.s\./gi, 'root mean square')
    .replace(/\brad\s*s\^-1/gi, 'radians per second')
    .replace(/\b1\/f\s*=\s*1\/u\s*\+\s*1\/v\b/gi, 'one over f, equals one over u, plus one over v')
    .replace(/\bm\s*=\s*v\/u\b/gi, 'm equals v divided by u')
    .replace(/\bFc\s*=\s*mv\^2\s*\/\s*r\b/gi, 'F sub c equals m times v squared, divided by r')
    .replace(/\bm\s*\*\s*omega\^2\s*\*\s*r\b/gi, 'm times omega squared times r')
    .replace(/\bsqrt\(([^)]+)\)/gi, 'the square root of $1')
    .replace(/\bGMm\/r\^2\b/gi, 'G times big M times little m, over r squared')
    .replace(/\bGM\/r\b/gi, 'G times M divided by r')
    .replace(/\bI\^2\s*R\b/g, 'I squared times R')
    .replace(/\bP_loss\b/g, 'power loss')
    .replace(/([A-Za-z0-9])\^2\b/g, '$1 squared')
    .replace(/([A-Za-z0-9])\^3\b/g, '$1 cubed')
    .replace(/([A-Za-z])_([A-Za-z0-9]+)/g, '$1 sub $2')
    .replace(/\s*\*\s*/g, ' times ')
    .replace(/\s+\/\s+/g, ' divided by ')
    .replace(/(^|[\s(=+])([A-Za-z0-9]{1,2})\/([A-Za-z0-9]{1,2})(?=$|[\s.,;)+-])/g, '$1$2 divided by $3')
    .replace(/\s*=\s*/g, ', equals ')
    .replace(/\s*\+\s*/g, ', plus ')
    .replace(/\s+-\s+/g, ', minus ')
    .replace(/(?<=[A-Za-z]{2})-(?=[A-Za-z]{2})/g, ' ')
    .replace(/\s*\(/g, ', ')
    .replace(/\)\s*/g, ', ')
    .replace(/,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function buildLocalConceptSegmentsFromChapter(
  book: Book,
  chapterTitle: string,
  chapterText: string
): AudiobookSegment[] {
  let rawParagraphs = chapterText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 15);
  const cleanTitleMatch = chapterTitle.replace(/^Chapter\s+\d+:\s*/i, '').trim().toLowerCase();
  if (
    rawParagraphs.length > 1 &&
    rawParagraphs[0].length < 95 &&
    (rawParagraphs[0].toLowerCase() === chapterTitle.toLowerCase() ||
      (cleanTitleMatch && rawParagraphs[0].toLowerCase().includes(cleanTitleMatch)))
  ) {
    rawParagraphs = rawParagraphs.slice(1);
  }
  const paras = (rawParagraphs.length > 0 ? rawParagraphs : [chapterText.trim() || book.description]).slice(0, 8);
  const cleanChapter = chapterTitle.replace(/^Chapter\s+\d+:\s*/i, '');

  return paras.map((para, idx) => {
    const sentences = para
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const formulaMatch = para.match(
      /([A-Za-z0-9_]+\s*=\s*[^.,;()\n]{3,42})/
    );
    const hasConceptKeywords =
      Boolean(formulaMatch) ||
      /\b(law|theorem|principle|equation|formula|lens|magnification|centripetal|induction|flux|orbital|transformer|osmosis|respiration|derivation|process|cycle|mechanism)\b/i.test(
        para
      );

    let diagramType: AudiobookComplexConcept['diagramType'] = 'process';
    if (/lens|ray|focus|wave|optics|converg|diverg/i.test(para)) {
      diagramType = 'wave-or-optics';
    } else if (/circular|orbit|cycle|respiration|feedback/i.test(para)) {
      diagramType = 'cycle';
    } else if (formulaMatch) {
      diagramType = 'formula';
    }

    const currLabel = book.curriculum?.[0] || book.category.split(',')[0] || 'Syllabus';
    const heading =
      idx === 0
        ? chapterTitle
        : formulaMatch
        ? `Quantitative Rule (${formulaMatch[1].slice(0, 20)})`
        : `Section ${idx + 1}`;

    const spokenCore = humanizeMathForClientSpeech(para);
    let narration = spokenCore;
    if (idx === 0) {
      narration = `Welcome back! Let's explore ${cleanChapter} together at a relaxed pace. Here's how to picture the core idea right from the start: ${spokenCore}`;
    } else if (hasConceptKeywords && formulaMatch) {
      narration = `Now pause for just a second — here's an essential quantitative relationship worth hearing clearly, step by step. ${spokenCore} Take a quick glance at the formula schematic beside the script so every symbol clicks together.`;
    } else if (hasConceptKeywords) {
      narration = `Let's slow down slightly on this part, because once you see how the pieces fit together, it becomes super intuitive. ${spokenCore}`;
    } else if (idx === paras.length - 1) {
      const tail = /^[A-Z]{2}/.test(spokenCore)
        ? spokenCore
        : `${spokenCore.charAt(0).toLowerCase()}${spokenCore.slice(1)}`;
      narration = `To tie this chapter together nicely — ${tail}`;
    } else {
      const bridges = [
        'Building right on that thought — ',
        "Here's why that matters in practice: ",
        'Notice how this connects directly: ',
      ];
      narration = `${bridges[idx % bridges.length]}${spokenCore}`;
    }

    const complexConcept: AudiobookComplexConcept | undefined = hasConceptKeywords
      ? {
          conceptTitle: `${cleanChapter} — Key Mechanism`,
          complexityReason: formulaMatch
            ? 'Involves quantitative relationships and variable sign conventions best grasped visually alongside spoken derivation.'
            : 'Involves multi-step causal interactions across physical or theoretical components.',
          visualizationPrompt: `Educational curriculum diagram for "${book.title}" (${currLabel}), illustrating ${chapterTitle}: clearly label all stages and relationships described in "${sentences[0] || para.slice(0, 110)}"${formulaMatch ? ` including equation ${formulaMatch[1]}` : ''}. Clean textbook schematic style on light paper background.`,
          diagramType,
          formulaOrRule: formulaMatch ? formulaMatch[1].trim() : undefined,
          keyTakeaways: sentences.slice(0, 3),
          diagramNodes: (sentences.length >= 2 ? sentences : [para]).slice(0, 4).map((s, nIdx) => {
            const words = s.split(/\s+/);
            return {
              role: `Step ${nIdx + 1}`,
              label: words.slice(0, 3).join(' '),
              detail: s,
            };
          }),
        }
      : undefined;

    return {
      id: `local-seg-${idx + 1}`,
      heading,
      sourceExcerpt: para,
      narration,
      estimatedSeconds: Math.max(10, Math.round(narration.split(/\s+/).filter(Boolean).length / 2.2)),
      isComplexConcept: Boolean(complexConcept),
      complexConcept,
    };
  });
}
