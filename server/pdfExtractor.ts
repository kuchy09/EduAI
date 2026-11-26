import fs from "fs";
import zlib from "zlib";
import { execFile } from "child_process";
import { promisify } from "util";
import katex from "katex";
import { computeSha256 } from "./canonicalBookStore";
import { buildExtractedAssetKey } from "../shared/b2StoragePaths";
import type {
  CanonicalBookBlock,
  CanonicalBookChapter,
  CanonicalBookSection,
  CanonicalBookStructure,
  ExtractedAsset,
} from "../src/types";

const execFileAsync = promisify(execFile);

export interface ExtractedPdfAssetBinary {
  asset: ExtractedAsset;
  buffer: Buffer;
}

export interface PdfExtractionOutput {
  structure: CanonicalBookStructure;
  assetBinaries: ExtractedPdfAssetBinary[];
  scannedPagesCount: number;
  ocrSuccessPages: number[];
  ocrFailedPages: number[];
  emptyTextPagesCount: number;
  unpreservedMathCount: number;
  missingAssetsCount: number;
}

interface TextLineItem {
  pageNumber: number;
  text: string;
  fontSize: number;
  isBold: boolean;
  x: number;
  y: number;
  columns: string[];
}

interface OutlineEntry {
  title: string;
  pageNumber: number;
  level: number;
}

// ============================================================================
// Pure Node PNG Encoder (RGB / RGBA / Grayscale -> valid PNG Buffer)
// ============================================================================
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodeRawImageToPng(
  width: number,
  height: number,
  data: Uint8Array | Uint8ClampedArray,
  kind?: number
): Buffer | null {
  if (!width || !height || width < 16 || height < 16 || width > 4000 || height > 4000) {
    return null;
  }

  const pixelCount = width * height;
  let channels = 4;
  if (kind === 1 || data.length === pixelCount) {
    channels = 1; // Grayscale
  } else if (kind === 2 || data.length === pixelCount * 3) {
    channels = 3; // RGB
  } else if (data.length === pixelCount * 4) {
    channels = 4; // RGBA
  } else if (data.length >= pixelCount * 3) {
    channels = 3;
  } else {
    return null;
  }

  // Convert grayscale to RGB or preserve RGB/RGBA
  const colorType = channels === 1 ? 0 : channels === 3 ? 2 : 6;
  const stride = width * channels;
  const rawScanlines = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    rawScanlines[rowStart] = 0; // Filter type 0 (None)
    const srcStart = y * stride;
    for (let i = 0; i < stride; i++) {
      rawScanlines[rowStart + 1 + i] = data[srcStart + i] ?? 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(rawScanlines, { level: 6 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ============================================================================
// Text, Math, Table & Heading Classification Helpers
// ============================================================================

function normalizeText(s: string): string {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function sanitizeSlug(raw: string, fallback: string): string {
  const s = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return s || fallback;
}

function classifyChapterType(
  title: string
): "front_matter" | "chapter" | "exercises" | "glossary" | "appendix" {
  const lower = title.toLowerCase();
  if (/glossary|key terms|vocabulary/i.test(lower)) return "glossary";
  if (/appendix|appendices|formula sheet|constants/i.test(lower)) return "appendix";
  if (/^(preface|foreword|acknowledg|table of contents|front matter|introduction)/i.test(lower)) {
    return "front_matter";
  }
  if (/^(revision exercise|review question|chapter summary|practice test)/i.test(lower)) {
    return "exercises";
  }
  return "chapter";
}

function isMajorChapterHeading(line: TextLineItem, bodyFontSize: number): boolean {
  const t = line.text.trim();
  if (t.length < 3 || t.length > 110) return false;
  if (/^(chapter|unit|strand|topic|module|part)\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(t)) {
    return true;
  }
  if (/^(glossary|appendix\s+[a-z0-9]+|preface|foreword|acknowledgements)\b/i.test(t) && line.fontSize >= bodyFontSize * 1.15) {
    return true;
  }
  // Large standalone heading >= 1.48x body font size
  if (line.fontSize >= bodyFontSize * 1.48 && /^[A-Z0-9]/.test(t) && t.split(/\s+/).length <= 12 && !/[.?!]$/.test(t)) {
    return true;
  }
  return false;
}

function detectSectionHeadingLevel(
  line: TextLineItem,
  bodyFontSize: number
): { level: number; type: "section" | "subsection" | "exercise" | "learning_objectives" } | null {
  const t = line.text.trim();
  if (t.length < 3 || t.length > 105) return null;

  if (/^(learning objectives|specific objectives|learning outcomes|objectives|competencies)\b/i.test(t)) {
    return { level: 2, type: "learning_objectives" };
  }
  if (/^(exercise|revision exercise|review questions|self[- ]check|activity|experiment|worked example)\s*\d*/i.test(t)) {
    return { level: 2, type: "exercise" };
  }
  if (/^\d+\.\d+\.\d+\s+[A-Z]/.test(t)) {
    return { level: 3, type: "subsection" };
  }
  if (/^(\d+\.\d+|sub-?strand\s+\d+\.\d+|sub-?topic\s+\d+\.\d+)\s*[:\-–]?\s*[A-Z]/i.test(t)) {
    return { level: 2, type: "section" };
  }
  if (line.fontSize >= bodyFontSize * 1.24 && (line.isBold || line.fontSize >= bodyFontSize * 1.32) && !/[.?!]$/.test(t) && t.split(/\s+/).length <= 12) {
    return { level: 2, type: "section" };
  }
  if (line.isBold && line.fontSize >= bodyFontSize * 1.08 && !/[.?!]$/.test(t) && t.split(/\s+/).length <= 10 && /^[A-Z]/.test(t)) {
    return { level: 3, type: "subsection" };
  }
  return null;
}

function looksLikeMathExpression(text: string): boolean {
  const t = text.trim();
  if (t.length < 4 || t.length > 140) return false;
  const hasEquals = /=|≈|≤|≥|∝|→/.test(t);
  const hasMathSymbols = /[±×÷√∑∫ΔλθμπΩαβγ]|(\^[0-9a-zA-Z+-]+)|(\b(?:sin|cos|tan|log|ln|sqrt)\s*\()/i.test(t);
  const words = t.split(/\s+/).length;
  if (hasEquals && words <= 14 && /[a-zA-Z0-9]\s*[=≈≤≥∝]\s*[a-zA-Z0-9(√\-]/.test(t)) {
    return true;
  }
  if (hasMathSymbols && words <= 12) {
    return true;
  }
  return false;
}

function normalizeTextToLatex(expr: string): string {
  return expr
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/±/g, "\\pm ")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≈/g, "\\approx ")
    .replace(/∝/g, "\\propto ")
    .replace(/→/g, "\\rightarrow ")
    .replace(/π/g, "\\pi ")
    .replace(/θ/g, "\\theta ")
    .replace(/λ/g, "\\lambda ")
    .replace(/μ/g, "\\mu ")
    .replace(/Ω/g, "\\Omega ")
    .replace(/Δ/g, "\\Delta ")
    .replace(/√\(([^)]+)\)/g, "\\sqrt{$1}")
    .replace(/√([a-zA-Z0-9]+)/g, "\\sqrt{$1}")
    .trim();
}

function tryConvertToMathMl(expr: string): { latex: string; mathMl: string | null } {
  const latex = normalizeTextToLatex(expr);
  try {
    const html = katex.renderToString(latex, {
      output: "mathml",
      throwOnError: true,
      displayMode: true,
    });
    const m = html.match(/<math[\s\S]*?<\/math>/i);
    return { latex, mathMl: m ? m[0] : null };
  } catch {
    return { latex, mathMl: null };
  }
}

// ============================================================================
// Stage 4: OCR Helpers (External Worker -> Local Tesseract CLI -> Tesseract.js)
// ============================================================================

async function runOcrOnImageBuffer(pngBuffer: Buffer): Promise<string | null> {
  // 1. Optional external Python/Tesseract worker service
  const workerUrl = process.env.PDF_OCR_WORKER_URL;
  if (workerUrl) {
    try {
      const resp = await fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: new Uint8Array(pngBuffer),
      });
      if (resp.ok) {
        const json = (await resp.json().catch(() => null)) as any;
        if (json?.text && String(json.text).trim().length > 5) {
          return normalizeText(String(json.text));
        }
      }
    } catch (_) {}
  }

  // 2. Local tesseract binary if available in container
  try {
    const tmpImg = `/tmp/eduai-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;
    fs.writeFileSync(tmpImg, pngBuffer);
    try {
      const { stdout } = await execFileAsync("tesseract", [tmpImg, "stdout", "--psm", "6"], {
        timeout: 15000,
      });
      if (stdout && stdout.trim().length > 5) {
        return normalizeText(stdout);
      }
    } finally {
      try {
        if (fs.existsSync(tmpImg)) fs.unlinkSync(tmpImg);
      } catch (_) {}
    }
  } catch (_) {}

  // 3. Pure-Node tesseract.js fallback
  try {
    const tesseractMod: any = await import("tesseract.js");
    const recognize = tesseractMod?.default?.recognize || tesseractMod?.recognize;
    if (typeof recognize === "function") {
      const result = await Promise.race([
        recognize(pngBuffer, "eng", { logger: () => {} }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
      ]);
      const text = result?.data?.text;
      if (text && normalizeText(text).length > 5) {
        return normalizeText(text);
      }
    }
  } catch (_) {}

  return null;
}

// ============================================================================
// Main 1-7 Stage Extractor
// ============================================================================

export async function extractCanonicalBookFromPdf(params: {
  bookId: string;
  title: string;
  author?: string;
  publisher?: string;
  language?: string;
  sourcePdfKey: string;
  pdfBuffer: Buffer;
  onStage?: (stageIndex: number, stageName: string, detail?: string) => Promise<void> | void;
}): Promise<PdfExtractionOutput> {
  const { bookId, pdfBuffer, sourcePdfKey, onStage } = params;
  const sourceChecksum = computeSha256(pdfBuffer);

  // Stage 1: Validation & Metadata
  await onStage?.(1, "pdf_validation", "Validating PDF structure and metadata");
  if (!pdfBuffer.includes(Buffer.from("%PDF-"))) {
    throw new Error("Invalid PDF binary: missing %PDF- header");
  }

  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    verbosity: 0,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const totalPages = Math.max(1, Number(doc.numPages) || 1);
  let metaTitle = params.title;
  let metaAuthor = params.author || params.publisher || "Unknown Author";
  let metaLanguage = params.language || "en";

  try {
    const meta = await doc.getMetadata();
    if (!metaTitle && meta?.info?.Title) metaTitle = String(meta.info.Title).trim();
    if ((!params.author || params.author === "Unknown Author") && meta?.info?.Author) {
      metaAuthor = String(meta.info.Author).trim();
    }
    if (meta?.info?.Language) {
      metaLanguage = String(meta.info.Language).trim().slice(0, 12) || metaLanguage;
    }
  } catch (_) {}

  // Extract PDF embedded outline / bookmarks (Stage 5 input)
  const outlineEntries: OutlineEntry[] = [];
  try {
    const rawOutline = await doc.getOutline();
    const walkOutline = async (items: any[], level: number) => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        let pageNumber = 0;
        try {
          let dest = item.dest;
          if (typeof dest === "string") {
            dest = await doc.getDestination(dest);
          }
          if (Array.isArray(dest) && dest[0]) {
            const idx = await doc.getPageIndex(dest[0]);
            pageNumber = idx + 1;
          }
        } catch (_) {}
        const cleanTitle = normalizeText(String(item.title || ""));
        if (cleanTitle && pageNumber >= 1 && pageNumber <= totalPages) {
          outlineEntries.push({ title: cleanTitle, pageNumber, level });
        }
        if (Array.isArray(item.items) && item.items.length > 0 && level < 3) {
          await walkOutline(item.items, level + 1);
        }
      }
    };
    await walkOutline(rawOutline, 1);
  } catch (_) {}

  // Stage 2, 3, 4, 7: Walk pages to extract text lines, detect scanned pages, OCR if needed, extract images
  await onStage?.(2, "text_extraction", `Extracting structured text across ${totalPages} pages`);

  const allLines: TextLineItem[] = [];
  const pageImageMap = new Map<number, ExtractedPdfAssetBinary[]>();
  const assetBinaries: ExtractedPdfAssetBinary[] = [];
  const scannedPages: number[] = [];
  const ocrSuccessPages: number[] = [];
  const ocrFailedPages: number[] = [];
  let emptyTextPagesCount = 0;
  let missingAssetsCount = 0;

  // Bounded image extraction cap so huge scanned textbooks remain responsive
  const MAX_EXTRACTED_ASSETS = 60;
  const seenAssetChecksums = new Set<string>();

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const styles = textContent?.styles || {};
      const items = Array.isArray(textContent?.items) ? textContent.items : [];

      // Group fragments into visual lines by Y bucket
      const lineBuckets = new Map<
        number,
        Array<{ str: string; x: number; y: number; fontSize: number; isBold: boolean }>
      >();

      for (const item of items) {
        const str = String(item?.str || "");
        if (!str.trim()) continue;
        const tr = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 12, 0, 0];
        const x = Number(tr[4]) || 0;
        const y = Number(tr[5]) || 0;
        const fontSize = Math.max(6, Math.abs(Number(tr[3])) || Number(item.height) || 11);
        const fontMeta = styles?.[item.fontName];
        const fontFamilyStr = `${item.fontName || ""} ${fontMeta?.fontFamily || ""}`.toLowerCase();
        const isBold = /bold|black|heavy|semibold|demi/.test(fontFamilyStr);

        const yBucket = Math.round(y / 3) * 3;
        if (!lineBuckets.has(yBucket)) lineBuckets.set(yBucket, []);
        lineBuckets.get(yBucket)!.push({ str, x, y, fontSize, isBold });
      }

      const sortedY = Array.from(lineBuckets.keys()).sort((a, b) => b - a);
      const pageLines: TextLineItem[] = [];

      for (const yb of sortedY) {
        const chunks = lineBuckets.get(yb)!.sort((a, b) => a.x - b.x);
        const columns: string[] = [];
        let curCol = "";
        let prevX = chunks[0].x;
        let maxFont = chunks[0].fontSize;
        let anyBold = chunks[0].isBold;

        for (let i = 0; i < chunks.length; i++) {
          const ch = chunks[i];
          const gap = ch.x - prevX;
          if (i > 0 && gap > 28 && curCol.trim()) {
            columns.push(normalizeText(curCol));
            curCol = ch.str;
          } else {
            curCol += (curCol && !curCol.endsWith(" ") && !ch.str.startsWith(" ") ? " " : "") + ch.str;
          }
          if (ch.fontSize > maxFont) maxFont = ch.fontSize;
          if (ch.isBold) anyBold = true;
          prevX = ch.x + Math.max(6, ch.str.length * ch.fontSize * 0.45);
        }
        if (curCol.trim()) columns.push(normalizeText(curCol));

        const joined = normalizeText(columns.join(" "));
        if (!joined) continue;

        // Ignore repetitive page-number-only footer/header noise
        if (/^\d{1,4}$/.test(joined) && (yb < 65 || yb > 760)) continue;

        pageLines.push({
          pageNumber: pageNum,
          text: joined,
          fontSize: maxFont,
          isBold: anyBold,
          x: chunks[0].x,
          y: yb,
          columns,
        });
      }

      const pageCharCount = pageLines.reduce((sum, l) => sum + l.text.length, 0);

      // Extract embedded raster diagrams / scanned page images
      let pageHasImageOp = false;
      let pagePrimaryPng: Buffer | null = null;
      try {
        const opList = await page.getOperatorList();
        const OPS = pdfjs.OPS || {};
        const fnArray: number[] = Array.isArray(opList?.fnArray) ? opList.fnArray : [];
        const argsArray: any[] = Array.isArray(opList?.argsArray) ? opList.argsArray : [];

        for (let k = 0; k < fnArray.length; k++) {
          const fn = fnArray[k];
          const isXObj = fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat;
          const isInline = fn === OPS.paintInlineImageXObject;
          if (!isXObj && !isInline) continue;

          pageHasImageOp = true;
          if (assetBinaries.length >= MAX_EXTRACTED_ASSETS && pageCharCount >= 35) continue;

          try {
            let imgObj: any = null;
            if (isInline) {
              imgObj = argsArray[k]?.[0];
            } else if (argsArray[k]?.[0]) {
              const objName = argsArray[k][0];
              imgObj = page.objs?.has?.(objName) ? page.objs.get(objName) : null;
            }
            if (!imgObj || !imgObj.data || !imgObj.width || !imgObj.height) continue;

            const pngBuf = encodeRawImageToPng(imgObj.width, imgObj.height, imgObj.data, imgObj.kind);
            if (!pngBuf) continue;
            if (!pagePrimaryPng) pagePrimaryPng = pngBuf;

            // Skip tiny decorative icons or full-page scan wrappers from figure gallery unless substantive diagram
            if (imgObj.width >= 60 && imgObj.height >= 60 && assetBinaries.length < MAX_EXTRACTED_ASSETS) {
              const checksum = computeSha256(pngBuf);
              if (!seenAssetChecksums.has(checksum)) {
                seenAssetChecksums.add(checksum);
                const filename = `page-${pageNum}-fig-${assetBinaries.length + 1}.png`;
                const storageKey = buildExtractedAssetKey(bookId, filename);
                const captionLine = pageLines.find((l) => /^(figure|fig\.?|diagram|table)\s*\d*/i.test(l.text));
                const assetRecord: ExtractedAsset = {
                  id: `asset-${bookId}-p${pageNum}-${assetBinaries.length + 1}`,
                  bookId,
                  assetType: captionLine && /diagram/i.test(captionLine.text) ? "diagram" : "figure",
                  storageKey,
                  mimeType: "image/png",
                  width: imgObj.width,
                  height: imgObj.height,
                  pdfPageNumber: pageNum,
                  caption: captionLine?.text || `Diagram from page ${pageNum}`,
                  sha256Checksum: checksum,
                  url: `/api/books/${encodeURIComponent(bookId)}/assets/${encodeURIComponent(filename)}`,
                };
                const payload = { asset: assetRecord, buffer: pngBuf };
                assetBinaries.push(payload);
                if (!pageImageMap.has(pageNum)) pageImageMap.set(pageNum, []);
                pageImageMap.get(pageNum)!.push(payload);
              }
            }
          } catch (_) {
            missingAssetsCount += 1;
          }
        }
      } catch (_) {}

      // Stage 3 & 4: Scanned page detection & OCR fallback
      if (pageCharCount < 35) {
        if (pageHasImageOp) {
          scannedPages.push(pageNum);
          if (pagePrimaryPng) {
            await onStage?.(4, "ocr_processing", `Running OCR on scanned page ${pageNum}/${totalPages}`);
            const ocrText = await runOcrOnImageBuffer(pagePrimaryPng);
            if (ocrText && ocrText.length >= 20) {
              ocrSuccessPages.push(pageNum);
              for (const sentence of ocrText.split(/(?<=[.!?])\s+/).filter(Boolean)) {
                pageLines.push({
                  pageNumber: pageNum,
                  text: sentence,
                  fontSize: 11,
                  isBold: false,
                  x: 48,
                  y: 600,
                  columns: [sentence],
                });
              }
            } else {
              ocrFailedPages.push(pageNum);
              emptyTextPagesCount += 1;
            }
          } else {
            ocrFailedPages.push(pageNum);
            emptyTextPagesCount += 1;
          }
        } else {
          emptyTextPagesCount += 1;
        }
      }

      allLines.push(...pageLines);
    } catch (_) {
      emptyTextPagesCount += 1;
    }
  }

  try {
    await doc.destroy();
  } catch (_) {}

  await onStage?.(3, "scanned_page_detection", `Scanned pages detected: ${scannedPages.length}`);
  await onStage?.(4, "ocr_processing", `OCR completed (${ocrSuccessPages.length} recovered, ${ocrFailedPages.length} unresolved)`);

  // Compute median body font size across extracted lines
  const fontHistogram = new Map<number, number>();
  for (const l of allLines) {
    if (l.text.length > 20) {
      const rounded = Math.round(l.fontSize);
      fontHistogram.set(rounded, (fontHistogram.get(rounded) || 0) + 1);
    }
  }
  let bodyFontSize = 11;
  let maxCount = 0;
  for (const [sz, cnt] of fontHistogram.entries()) {
    if (cnt > maxCount) {
      maxCount = cnt;
      bodyFontSize = sz;
    }
  }

  // Stage 5: Hierarchical TOC & Chapter/Section Detection
  await onStage?.(5, "chapter_section_detection", "Detecting chapters, sections, exercises & appendices");

  const outlineTopChapters = outlineEntries.filter((o) => o.level === 1);
  const outlineSubSections = outlineEntries.filter((o) => o.level >= 2);
  const tocSource: CanonicalBookStructure["tocSource"] =
    outlineTopChapters.length >= 2 && allLines.length > 0
      ? "hybrid"
      : outlineTopChapters.length >= 2
      ? "pdf_bookmarks"
      : "layout_heuristics";

  // Build initial chapter boundaries
  interface ChapterDraft {
    id: string;
    stableId: string;
    chapterNumber: number;
    title: string;
    sectionType: CanonicalBookChapter["sectionType"];
    pdfPageStart: number;
    pdfPageEnd: number;
    lines: TextLineItem[];
  }

  const chapterDrafts: ChapterDraft[] = [];

  if (outlineTopChapters.length >= 2) {
    const sorted = [...outlineTopChapters].sort((a, b) => a.pageNumber - b.pageNumber);
    if (sorted[0].pageNumber > 1) {
      chapterDrafts.push({
        id: `ch-${bookId}-0`,
        stableId: `front-matter`,
        chapterNumber: 0,
        title: "Front Matter & Overview",
        sectionType: "front_matter",
        pdfPageStart: 1,
        pdfPageEnd: sorted[0].pageNumber - 1,
        lines: [],
      });
    }
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      const nextPage = i + 1 < sorted.length ? Math.max(cur.pageNumber, sorted[i + 1].pageNumber - 1) : totalPages;
      const num = i + 1;
      chapterDrafts.push({
        id: `ch-${bookId}-${num}`,
        stableId: sanitizeSlug(cur.title, `chapter-${num}`),
        chapterNumber: num,
        title: cur.title,
        sectionType: classifyChapterType(cur.title),
        pdfPageStart: cur.pageNumber,
        pdfPageEnd: nextPage,
        lines: [],
      });
    }
    for (const line of allLines) {
      const target =
        chapterDrafts.find((c) => line.pageNumber >= c.pdfPageStart && line.pageNumber <= c.pdfPageEnd) ||
        chapterDrafts[chapterDrafts.length - 1];
      target?.lines.push(line);
    }
  } else {
    // Heuristic layout & heading pattern segmentation
    let currentChapter: ChapterDraft | null = null;
    let chSeq = 0;

    for (const line of allLines) {
      if (isMajorChapterHeading(line, bodyFontSize)) {
        if (currentChapter) {
          currentChapter.pdfPageEnd = Math.max(currentChapter.pdfPageStart, line.pageNumber);
          chapterDrafts.push(currentChapter);
        } else if (line.pageNumber > 1) {
          chapterDrafts.push({
            id: `ch-${bookId}-0`,
            stableId: "front-matter",
            chapterNumber: 0,
            title: "Front Matter & Introduction",
            sectionType: "front_matter",
            pdfPageStart: 1,
            pdfPageEnd: line.pageNumber - 1,
            lines: [],
          });
        }
        chSeq += 1;
        currentChapter = {
          id: `ch-${bookId}-${chSeq}`,
          stableId: sanitizeSlug(line.text, `chapter-${chSeq}`),
          chapterNumber: chSeq,
          title: line.text,
          sectionType: classifyChapterType(line.text),
          pdfPageStart: line.pageNumber,
          pdfPageEnd: line.pageNumber,
          lines: [],
        };
      } else {
        if (!currentChapter) {
          chSeq = 1;
          currentChapter = {
            id: `ch-${bookId}-1`,
            stableId: "chapter-1",
            chapterNumber: 1,
            title: `Chapter 1: ${metaTitle}`,
            sectionType: "chapter",
            pdfPageStart: 1,
            pdfPageEnd: line.pageNumber,
            lines: [],
          };
        }
        currentChapter.pdfPageEnd = Math.max(currentChapter.pdfPageEnd, line.pageNumber);
        currentChapter.lines.push(line);
      }
    }

    if (currentChapter) {
      currentChapter.pdfPageEnd = totalPages;
      chapterDrafts.push(currentChapter);
    }

    // If a large textbook had 0 detected headings, chunk logically into 25-page study units cleanly
    if (chapterDrafts.length <= 1 && totalPages > 30 && allLines.length > 0) {
      chapterDrafts.length = 0;
      const chunkSize = 25;
      let idx = 0;
      for (let p = 1; p <= totalPages; p += chunkSize) {
        idx += 1;
        const pEnd = Math.min(totalPages, p + chunkSize - 1);
        const unitLines = allLines.filter((l) => l.pageNumber >= p && l.pageNumber <= pEnd);
        chapterDrafts.push({
          id: `ch-${bookId}-${idx}`,
          stableId: `unit-${idx}`,
          chapterNumber: idx,
          title: `Unit ${idx} (Pages ${p}–${pEnd})`,
          sectionType: "chapter",
          pdfPageStart: p,
          pdfPageEnd: pEnd,
          lines: unitLines,
        });
      }
    }

    // Guarantee at least 1 chapter even for empty/scanned-only docs so PDF fallback & TOC remain consistent
    if (chapterDrafts.length === 0) {
      chapterDrafts.push({
        id: `ch-${bookId}-1`,
        stableId: "chapter-1",
        chapterNumber: 1,
        title: `Chapter 1: ${metaTitle}`,
        sectionType: "chapter",
        pdfPageStart: 1,
        pdfPageEnd: totalPages,
        lines: [],
      });
    }
  }

  // Stage 6 & 7: Build canonical chapters, sections, blocks (paragraphs, tables, math, exercises, objectives, images)
  await onStage?.(6, "canonical_structure_generation", "Building canonical textbook hierarchy");

  let unpreservedMathCount = 0;
  const chapters: CanonicalBookChapter[] = [];
  const placedAssetPages = new Set<number>();

  for (let chIdx = 0; chIdx < chapterDrafts.length; chIdx++) {
    const draft = chapterDrafts[chIdx];
    const chFileNum = chIdx + 1;
    const epubHref = `chapters/chapter-${chFileNum}.xhtml`;
    const chAnchor = `ch-${chFileNum}`;

    const introBlocks: CanonicalBookBlock[] = [];
    const sections: CanonicalBookSection[] = [];
    let currentSection: CanonicalBookSection | null = null;
    let lastLevel2SectionId: string | undefined;
    let blockSeq = 0;
    let secSeq = 0;
    let inObjectiveZone = false;
    let inExerciseZone = draft.sectionType === "exercises";

    // Seed outline subsections for this chapter's page range if any
    const outlineSubsForChapter = outlineSubSections.filter(
      (s) => s.pageNumber >= draft.pdfPageStart && s.pageNumber <= draft.pdfPageEnd
    );

    const targetBlockList = () => (currentSection ? currentSection.blocks : introBlocks);

    const pushParagraphBuffer = (paraLines: TextLineItem[]) => {
      if (paraLines.length === 0) return;
      const first = paraLines[0];
      const last = paraLines[paraLines.length - 1];
      const combined = normalizeText(paraLines.map((l) => l.text).join(" "));
      if (!combined) return;

      blockSeq += 1;
      const anchor = `blk-${chFileNum}-${blockSeq}`;

      // Check table (multi-column lines across >= 2 lines)
      const multiColLines = paraLines.filter((l) => l.columns.length >= 2);
      if (multiColLines.length >= 2 && multiColLines.length >= paraLines.length * 0.6) {
        const headers = multiColLines[0].columns;
        const rows = multiColLines.slice(1).map((l) => l.columns);
        targetBlockList().push({
          id: `blk-${bookId}-${chFileNum}-${blockSeq}`,
          type: "table",
          orderIndex: blockSeq,
          text: `${headers.join(" | ")} — ${rows.map((r) => r.join(" | ")).join("; ")}`,
          tableData: { headers, rows },
          pdfPageNumber: first.pageNumber,
          epubAnchor: anchor,
        });
        return;
      }

      if (looksLikeMathExpression(combined)) {
        const { latex, mathMl } = tryConvertToMathMl(combined);
        if (!mathMl) unpreservedMathCount += 1;
        targetBlockList().push({
          id: `blk-${bookId}-${chFileNum}-${blockSeq}`,
          type: "math",
          orderIndex: blockSeq,
          text: combined,
          latex,
          mathMl: mathMl || undefined,
          pdfPageNumber: first.pageNumber,
          epubAnchor: anchor,
        });
        return;
      }

      if (inObjectiveZone) {
        targetBlockList().push({
          id: `blk-${bookId}-${chFileNum}-${blockSeq}`,
          type: "learning_objective",
          orderIndex: blockSeq,
          text: combined,
          pdfPageNumber: first.pageNumber,
          epubAnchor: anchor,
        });
        return;
      }

      if (inExerciseZone || /^\d+[\.)]\s+[A-Z]/.test(combined)) {
        targetBlockList().push({
          id: `blk-${bookId}-${chFileNum}-${blockSeq}`,
          type: "exercise",
          orderIndex: blockSeq,
          text: combined,
          pdfPageNumber: first.pageNumber,
          epubAnchor: anchor,
        });
        return;
      }

      if (/^[•\-–\*]\s+/.test(combined)) {
        targetBlockList().push({
          id: `blk-${bookId}-${chFileNum}-${blockSeq}`,
          type: "list_item",
          orderIndex: blockSeq,
          text: combined.replace(/^[•\-–\*]\s+/, ""),
          pdfPageNumber: first.pageNumber,
          epubAnchor: anchor,
        });
        return;
      }

      targetBlockList().push({
        id: `blk-${bookId}-${chFileNum}-${blockSeq}`,
        type: "paragraph",
        orderIndex: blockSeq,
        text: combined,
        pdfPageNumber: last.pageNumber || first.pageNumber,
        epubAnchor: anchor,
      });
    };

    let pendingPara: TextLineItem[] = [];

    for (let li = 0; li < draft.lines.length; li++) {
      const line = draft.lines[li];
      const headingInfo = detectSectionHeadingLevel(line, bodyFontSize);

      // Also honor PDF outline subsection start on this line's page if heading matches
      const matchingOutlineSub = outlineSubsForChapter.find(
        (os) =>
          os.pageNumber === line.pageNumber &&
          line.text.toLowerCase().includes(os.title.toLowerCase().slice(0, 14))
      );

      if (headingInfo || matchingOutlineSub) {
        pushParagraphBuffer(pendingPara);
        pendingPara = [];

        if (currentSection) {
          currentSection.pdfPageEnd = Math.max(currentSection.pdfPageStart, line.pageNumber);
        }

        secSeq += 1;
        const level = matchingOutlineSub?.level || headingInfo?.level || 2;
        const secType = headingInfo?.type || (level >= 3 ? "subsection" : "section");
        inObjectiveZone = secType === "learning_objectives";
        inExerciseZone = secType === "exercise" || draft.sectionType === "exercises";

        const secId = `sec-${bookId}-${chFileNum}-${secSeq}`;
        const secAnchor = `sec-${chFileNum}-${secSeq}`;
        const newSection: CanonicalBookSection = {
          id: secId,
          stableId: sanitizeSlug(line.text, secAnchor),
          chapterId: draft.id,
          parentSectionId: level >= 3 ? lastLevel2SectionId : undefined,
          title: line.text,
          hierarchyLevel: level,
          sectionType: secType,
          orderIndex: secSeq,
          pdfPageStart: line.pageNumber,
          pdfPageEnd: line.pageNumber,
          epubHref,
          epubAnchor: secAnchor,
          contentRef: `${epubHref}#${secAnchor}`,
          blocks: [],
        };
        if (level <= 2) lastLevel2SectionId = secId;
        sections.push(newSection);
        currentSection = newSection;
        continue;
      }

      // Flush paragraph on single-line math, bullet, wide table line, or large vertical gap
      const prev = pendingPara[pendingPara.length - 1];
      const verticalGap = prev ? Math.abs(prev.y - line.y) : 0;
      const isNewBullet = /^[•\-–\*]\s+/.test(line.text);
      const isMathLine = looksLikeMathExpression(line.text);
      const endsSentence = prev && /[.?!:]$/.test(prev.text) && verticalGap > bodyFontSize * 1.45;

      if (
        pendingPara.length > 0 &&
        (verticalGap > bodyFontSize * 2.1 || isNewBullet || isMathLine || endsSentence || pendingPara.length >= 9)
      ) {
        pushParagraphBuffer(pendingPara);
        pendingPara = [];
      }

      pendingPara.push(line);
      if (isMathLine) {
        pushParagraphBuffer(pendingPara);
        pendingPara = [];
      }

      // Attach extracted figures belonging to this page
      if (!placedAssetPages.has(line.pageNumber) && pageImageMap.has(line.pageNumber)) {
        placedAssetPages.add(line.pageNumber);
        pushParagraphBuffer(pendingPara);
        pendingPara = [];
        for (const imgPayload of pageImageMap.get(line.pageNumber)!) {
          blockSeq += 1;
          targetBlockList().push({
            id: `blk-${bookId}-${chFileNum}-${blockSeq}`,
            type: "image",
            orderIndex: blockSeq,
            text: imgPayload.asset.caption || `Diagram from page ${line.pageNumber}`,
            assetId: imgPayload.asset.id,
            assetUrl: imgPayload.asset.url,
            caption: imgPayload.asset.caption,
            pdfPageNumber: line.pageNumber,
            epubAnchor: `blk-${chFileNum}-${blockSeq}`,
          });
        }
      }
    }

    pushParagraphBuffer(pendingPara);
    if (currentSection) {
      currentSection.pdfPageEnd = Math.max(currentSection.pdfPageStart, draft.pdfPageEnd);
    }

    // Ensure images on pages within this chapter that had little/no text still appear
    for (let p = draft.pdfPageStart; p <= draft.pdfPageEnd; p++) {
      if (!placedAssetPages.has(p) && pageImageMap.has(p)) {
        placedAssetPages.add(p);
        for (const imgPayload of pageImageMap.get(p)!) {
          blockSeq += 1;
          introBlocks.push({
            id: `blk-${bookId}-${chFileNum}-${blockSeq}`,
            type: "image",
            orderIndex: blockSeq,
            text: imgPayload.asset.caption || `Diagram from page ${p}`,
            assetId: imgPayload.asset.id,
            assetUrl: imgPayload.asset.url,
            caption: imgPayload.asset.caption,
            pdfPageNumber: p,
            epubAnchor: `blk-${chFileNum}-${blockSeq}`,
          });
        }
      }
    }

    // Build concise chapter summary from first paragraph block
    const firstPara =
      introBlocks.find((b) => b.type === "paragraph") ||
      sections.flatMap((s) => s.blocks).find((b) => b.type === "paragraph");

    chapters.push({
      id: draft.id,
      stableId: draft.stableId,
      chapterNumber: draft.chapterNumber,
      title: draft.title,
      hierarchyLevel: 1,
      sectionType: draft.sectionType,
      orderIndex: chIdx,
      pdfPageStart: draft.pdfPageStart,
      pdfPageEnd: draft.pdfPageEnd,
      epubHref,
      epubAnchor: chAnchor,
      contentRef: `${epubHref}#${chAnchor}`,
      summary: firstPara?.text.slice(0, 260),
      sections,
      blocks: introBlocks,
    });
  }

  await onStage?.(7, "asset_extraction", `Extracted ${assetBinaries.length} figures/diagrams`);

  const structure: CanonicalBookStructure = {
    bookId,
    title: metaTitle || params.title || "Edu AI Textbook",
    author: metaAuthor,
    publisher: params.publisher,
    language: metaLanguage,
    totalPages,
    sourcePdfKey,
    sourceChecksum,
    epubPublished: false,
    tocSource,
    updatedAt: new Date().toISOString(),
    chapters,
    assets: assetBinaries.map((a) => a.asset),
  };

  return {
    structure,
    assetBinaries,
    scannedPagesCount: scannedPages.length,
    ocrSuccessPages,
    ocrFailedPages,
    emptyTextPagesCount,
    unpreservedMathCount,
    missingAssetsCount,
  };
}
