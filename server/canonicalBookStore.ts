import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeStorageBookId } from "../shared/b2StoragePaths";
import type {
  BookConversionOverview,
  CanonicalBookStructure,
  ConversionQualityReport,
  EpubArtifactInfo,
  ProcessingJobStatus,
  ProcessingStatus,
} from "../src/types";

export interface AdminAuditLogEntry {
  id: string;
  actorUserId?: string;
  actorEmail?: string;
  action: string;
  bookId?: string;
  details: Record<string, any>;
  createdAt: string;
}

export interface HybridBookmarkRecord {
  id: string;
  bookId: string;
  userId: string;
  bookTitle: string;
  title: string;
  chapter: string;
  textSnippet: string;
  canonicalSectionId?: string;
  epubHref?: string;
  epubAnchor?: string;
  format: "pdf" | "epub";
  pageNumber?: number;
  timestamp: number;
}

export interface HybridReadingProgressRecord {
  bookId: string;
  userId: string;
  progress: number;
  currentPage?: number;
  totalPages?: number;
  activeFormat: "pdf" | "epub";
  epubChapterHref?: string;
  canonicalSectionId?: string;
  scrollOffset?: number;
  updatedAt: string;
}

export interface CanonicalSearchHit {
  chapterId: string;
  chapterTitle: string;
  sectionId?: string;
  sectionTitle?: string;
  blockId: string;
  blockType: string;
  pdfPageNumber: number;
  epubHref: string;
  epubAnchor: string;
  snippet: string;
}

function getPipelineDir(uploadsDir: string): string {
  return path.resolve(uploadsDir, ".library-pipeline");
}

function atomicWriteJson(targetPath: string, data: unknown): void {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, targetPath);
}

function readJsonSafe<T>(targetPath: string, fallback: T): T {
  try {
    if (!fs.existsSync(targetPath)) return fallback;
    return JSON.parse(fs.readFileSync(targetPath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

export function getCanonicalStructurePath(uploadsDir: string, bookId: string): string {
  const safeId = sanitizeStorageBookId(bookId);
  return path.join(getPipelineDir(uploadsDir), "structures", `${safeId}.json`);
}

export function getProcessingJobPath(uploadsDir: string, bookId: string): string {
  const safeId = sanitizeStorageBookId(bookId);
  return path.join(getPipelineDir(uploadsDir), "jobs", `${safeId}.json`);
}

export function getConversionReportPath(uploadsDir: string, bookId: string): string {
  const safeId = sanitizeStorageBookId(bookId);
  return path.join(getPipelineDir(uploadsDir), "reports", `${safeId}.json`);
}

export function getEpubArtifactPath(uploadsDir: string, bookId: string): string {
  const safeId = sanitizeStorageBookId(bookId);
  return path.join(getPipelineDir(uploadsDir), "artifacts", `${safeId}.json`);
}

export function readCanonicalStructure(uploadsDir: string, bookId: string): CanonicalBookStructure | null {
  return readJsonSafe<CanonicalBookStructure | null>(getCanonicalStructurePath(uploadsDir, bookId), null);
}

export function readProcessingJob(uploadsDir: string, bookId: string): ProcessingJobStatus | null {
  return readJsonSafe<ProcessingJobStatus | null>(getProcessingJobPath(uploadsDir, bookId), null);
}

export function readConversionReport(uploadsDir: string, bookId: string): ConversionQualityReport | null {
  return readJsonSafe<ConversionQualityReport | null>(getConversionReportPath(uploadsDir, bookId), null);
}

export function readEpubArtifact(uploadsDir: string, bookId: string): EpubArtifactInfo | null {
  return readJsonSafe<EpubArtifactInfo | null>(getEpubArtifactPath(uploadsDir, bookId), null);
}

export async function saveProcessingJob(
  uploadsDir: string,
  job: ProcessingJobStatus,
  supabase?: SupabaseClient | null
): Promise<void> {
  atomicWriteJson(getProcessingJobPath(uploadsDir, job.bookId), job);
  if (supabase) {
    try {
      await supabase.from("book_processing_jobs").upsert({
        id: job.id,
        book_id: job.bookId,
        source_pdf_key: job.sourcePdfKey,
        status: job.status,
        current_stage: job.currentStage,
        stage_index: job.stageIndex,
        total_stages: job.totalStages,
        progress_pct: job.progressPct,
        ocr_status: job.ocrStatus,
        ocr_pages_count: job.ocrPagesCount,
        error_message: job.errorMessage || null,
        retry_count: job.retryCount,
        started_at: job.startedAt || null,
        completed_at: job.completedAt || null,
        updated_at: job.updatedAt,
      });
    } catch (_) {}
  }
}

export async function saveConversionReport(
  uploadsDir: string,
  report: ConversionQualityReport,
  supabase?: SupabaseClient | null
): Promise<void> {
  atomicWriteJson(getConversionReportPath(uploadsDir, report.bookId), report);
  if (supabase) {
    try {
      await supabase.from("book_conversion_reports").upsert({
        id: report.id,
        book_id: report.bookId,
        job_id: report.jobId,
        confidence_status: report.confidenceStatus,
        quality_score: report.qualityScore,
        total_pages: report.totalPages,
        extracted_chapters_count: report.extractedChaptersCount,
        extracted_sections_count: report.extractedSectionsCount,
        extracted_images_count: report.extractedImagesCount,
        extracted_tables_count: report.extractedTablesCount,
        math_blocks_count: report.mathBlocksCount,
        ocr_pages: report.ocrPages,
        warnings: report.warnings,
        errors: report.errors,
        validation_passed: report.validationPassed,
        auto_published: report.autoPublished,
        created_at: report.createdAt,
      });
    } catch (_) {}
  }
}

export async function saveEpubArtifact(
  uploadsDir: string,
  artifact: EpubArtifactInfo,
  supabase?: SupabaseClient | null
): Promise<void> {
  atomicWriteJson(getEpubArtifactPath(uploadsDir, artifact.bookId), artifact);
  if (supabase) {
    try {
      await supabase.from("book_epub_artifacts").upsert({
        id: artifact.id,
        book_id: artifact.bookId,
        version: artifact.version,
        epub_key: artifact.epubKey,
        sha256_checksum: artifact.sha256Checksum,
        file_size_bytes: artifact.fileSizeBytes,
        validation_passed: artifact.validationPassed,
        validation_errors: artifact.validationErrors,
        validation_warnings: artifact.validationWarnings,
        published: artifact.published,
        created_at: artifact.createdAt,
      });
    } catch (_) {}
  }
}

export async function saveCanonicalStructure(
  uploadsDir: string,
  structure: CanonicalBookStructure,
  supabase?: SupabaseClient | null
): Promise<void> {
  atomicWriteJson(getCanonicalStructurePath(uploadsDir, structure.bookId), structure);
  if (!supabase) return;

  try {
    await supabase.from("book_sections").delete().eq("book_id", structure.bookId);
    const sectionRows: any[] = [];
    const blockRows: any[] = [];

    for (const ch of structure.chapters) {
      sectionRows.push({
        id: ch.id,
        book_id: structure.bookId,
        chapter_id: ch.id,
        parent_section_id: null,
        stable_id: ch.stableId,
        title: ch.title,
        hierarchy_level: ch.hierarchyLevel,
        section_type: ch.sectionType,
        order_index: ch.orderIndex,
        pdf_page_start: ch.pdfPageStart,
        pdf_page_end: ch.pdfPageEnd,
        epub_href: ch.epubHref,
        epub_anchor: ch.epubAnchor,
        content_ref: ch.contentRef,
        updated_at: structure.updatedAt,
      });

      for (const blk of ch.blocks || []) {
        blockRows.push({
          id: blk.id,
          book_id: structure.bookId,
          chapter_id: ch.id,
          section_id: null,
          block_type: blk.type,
          order_index: blk.orderIndex,
          text_content: blk.text,
          math_ml: blk.mathMl || null,
          latex: blk.latex || null,
          table_data: blk.tableData || null,
          asset_id: blk.assetId || null,
          pdf_page_number: blk.pdfPageNumber,
          epub_anchor: blk.epubAnchor,
        });
      }

      for (const sec of ch.sections || []) {
        sectionRows.push({
          id: sec.id,
          book_id: structure.bookId,
          chapter_id: ch.id,
          parent_section_id: sec.parentSectionId || null,
          stable_id: sec.stableId,
          title: sec.title,
          hierarchy_level: sec.hierarchyLevel,
          section_type: sec.sectionType,
          order_index: sec.orderIndex,
          pdf_page_start: sec.pdfPageStart,
          pdf_page_end: sec.pdfPageEnd,
          epub_href: sec.epubHref,
          epub_anchor: sec.epubAnchor,
          content_ref: sec.contentRef,
          updated_at: structure.updatedAt,
        });

        for (const blk of sec.blocks || []) {
          blockRows.push({
            id: blk.id,
            book_id: structure.bookId,
            chapter_id: ch.id,
            section_id: sec.id,
            block_type: blk.type,
            order_index: blk.orderIndex,
            text_content: blk.text,
            math_ml: blk.mathMl || null,
            latex: blk.latex || null,
            table_data: blk.tableData || null,
            asset_id: blk.assetId || null,
            pdf_page_number: blk.pdfPageNumber,
            epub_anchor: blk.epubAnchor,
          });
        }
      }
    }

    if (sectionRows.length > 0) {
      await supabase.from("book_sections").upsert(sectionRows);
    }

    await supabase.from("book_content_blocks").delete().eq("book_id", structure.bookId);
    for (let i = 0; i < blockRows.length; i += 200) {
      await supabase.from("book_content_blocks").insert(blockRows.slice(i, i + 200));
    }

    if (Array.isArray(structure.assets) && structure.assets.length > 0) {
      await supabase.from("book_extracted_assets").upsert(
        structure.assets.map((a) => ({
          id: a.id,
          book_id: structure.bookId,
          asset_type: a.assetType,
          storage_key: a.storageKey,
          mime_type: a.mimeType,
          width: a.width || null,
          height: a.height || null,
          pdf_page_number: a.pdfPageNumber,
          caption: a.caption || null,
          sha256_checksum: a.sha256Checksum || null,
        }))
      );
    }

    // Also update book_chapters / book_content_chunks if bookId is linked in curriculum_books
    if (isUuid(structure.bookId)) {
      const { data: currBook } = await supabase
        .from("curriculum_books")
        .select("id")
        .eq("id", structure.bookId)
        .maybeSingle();

      if (currBook?.id) {
        await supabase.from("book_chapters").delete().eq("book_id", currBook.id);
        const chapterRows = structure.chapters.map((ch) => ({
          book_id: currBook.id,
          book_catalog_id: structure.bookId,
          title: ch.title,
          chapter_number: ch.chapterNumber,
          page_start: ch.pdfPageStart,
          page_end: ch.pdfPageEnd,
          summary: ch.summary || null,
          stable_id: ch.stableId,
          hierarchy_level: ch.hierarchyLevel,
          section_type: ch.sectionType,
          epub_href: ch.epubHref,
          epub_anchor: ch.epubAnchor,
        }));
        if (chapterRows.length > 0) {
          await supabase.from("book_chapters").insert(chapterRows);
        }
      }
    }
  } catch (_) {}
}

export async function recordAdminAuditLog(
  uploadsDir: string,
  entry: Omit<AdminAuditLogEntry, "id" | "createdAt">,
  supabase?: SupabaseClient | null
): Promise<AdminAuditLogEntry> {
  const fullEntry: AdminAuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...entry,
    createdAt: new Date().toISOString(),
  };

  const logPath = path.join(getPipelineDir(uploadsDir), "admin-audit-logs.json");
  const existing = readJsonSafe<AdminAuditLogEntry[]>(logPath, []);
  atomicWriteJson(logPath, [fullEntry, ...existing].slice(0, 500));

  if (supabase) {
    try {
      await supabase.from("admin_audit_logs").insert({
        id: fullEntry.id,
        actor_user_id: fullEntry.actorUserId || null,
        actor_email: fullEntry.actorEmail || null,
        action: fullEntry.action,
        book_id: fullEntry.bookId || null,
        details: fullEntry.details,
        created_at: fullEntry.createdAt,
      });
    } catch (_) {}
  }

  return fullEntry;
}

export function resolveBookConversionOverview(
  uploadsDir: string,
  bookId: string,
  bookRecord?: any
): BookConversionOverview {
  const structure = readCanonicalStructure(uploadsDir, bookId);
  const job = readProcessingJob(uploadsDir, bookId);
  const report = readConversionReport(uploadsDir, bookId);
  const artifact = readEpubArtifact(uploadsDir, bookId);

  const processingStatus: ProcessingStatus =
    (job?.status as ProcessingStatus) ||
    (bookRecord?.processingStatus as ProcessingStatus) ||
    (artifact?.published ? "completed" : "pending");

  const epubPublished = Boolean(
    artifact?.published ?? structure?.epubPublished ?? bookRecord?.epubPublished ?? false
  );

  const chaptersCount = structure?.chapters?.length || 0;
  const sectionsCount =
    structure?.chapters?.reduce((sum, ch) => sum + (ch.sections?.length || 0), 0) || 0;

  return {
    bookId,
    processingStatus,
    epubFileKey: artifact?.epubKey || structure?.epubKey || bookRecord?.epubFileKey,
    epubPublished,
    confidenceStatus: report?.confidenceStatus || structure?.confidenceStatus || bookRecord?.conversionConfidence,
    qualityScore: report?.qualityScore ?? structure?.qualityScore ?? bookRecord?.conversionQualityScore,
    rightsConversionAllowed: bookRecord?.rightsConversionAllowed !== false,
    sha256Checksum: structure?.sourceChecksum || bookRecord?.sha256Checksum,
    fileSizeBytes: bookRecord?.fileSizeBytes,
    mimeType: bookRecord?.mimeType || "application/pdf",
    pageCount: structure?.totalPages || report?.totalPages || bookRecord?.pageCount,
    language: structure?.language || bookRecord?.language || "en",
    job,
    report,
    artifact,
    chaptersCount,
    sectionsCount,
  };
}

export function searchCanonicalBook(
  structure: CanonicalBookStructure,
  rawQuery: string,
  limit = 40
): CanonicalSearchHit[] {
  const query = String(rawQuery || "").trim().toLowerCase();
  if (!query) return [];
  const tokens = query.split(/\s+/).filter(Boolean);

  const matchesText = (raw: string): number => {
    const lower = raw.toLowerCase();
    const exactIdx = lower.indexOf(query);
    if (exactIdx !== -1) return exactIdx;
    if (tokens.length > 1 && tokens.every((tok) => lower.includes(tok))) {
      return lower.indexOf(tokens[0]);
    }
    return -1;
  };

  const hits: CanonicalSearchHit[] = [];

  for (const ch of structure.chapters) {
    for (const blk of ch.blocks || []) {
      const idx = matchesText(blk.text);
      if (idx !== -1) {
        const start = Math.max(0, idx - 45);
        const end = Math.min(blk.text.length, idx + query.length + 110);
        const snippet = `${start > 0 ? "..." : ""}${blk.text.slice(start, end)}${end < blk.text.length ? "..." : ""}`;
        hits.push({
          chapterId: ch.id,
          chapterTitle: ch.title,
          blockId: blk.id,
          blockType: blk.type,
          pdfPageNumber: blk.pdfPageNumber,
          epubHref: ch.epubHref,
          epubAnchor: blk.epubAnchor || ch.epubAnchor,
          snippet,
        });
        if (hits.length >= limit) return hits;
      }
    }

    for (const sec of ch.sections || []) {
      if (matchesText(sec.title) !== -1) {
        hits.push({
          chapterId: ch.id,
          chapterTitle: ch.title,
          sectionId: sec.id,
          sectionTitle: sec.title,
          blockId: sec.id,
          blockType: "section_heading",
          pdfPageNumber: sec.pdfPageStart,
          epubHref: sec.epubHref,
          epubAnchor: sec.epubAnchor,
          snippet: sec.title,
        });
        if (hits.length >= limit) return hits;
      }

      for (const blk of sec.blocks || []) {
        const idx = matchesText(blk.text);
        if (idx !== -1) {
          const start = Math.max(0, idx - 45);
          const end = Math.min(blk.text.length, idx + query.length + 110);
          const snippet = `${start > 0 ? "..." : ""}${blk.text.slice(start, end)}${end < blk.text.length ? "..." : ""}`;
          hits.push({
            chapterId: ch.id,
            chapterTitle: ch.title,
            sectionId: sec.id,
            sectionTitle: sec.title,
            blockId: blk.id,
            blockType: blk.type,
            pdfPageNumber: blk.pdfPageNumber,
            epubHref: sec.epubHref,
            epubAnchor: blk.epubAnchor || sec.epubAnchor,
            snippet,
          });
          if (hits.length >= limit) return hits;
        }
      }
    }
  }

  return hits;
}

export function readUserBookmarks(uploadsDir: string, userId: string, bookId?: string): HybridBookmarkRecord[] {
  const safeUser = sanitizeStorageBookId(userId || "anon");
  const list = readJsonSafe<HybridBookmarkRecord[]>(
    path.join(getPipelineDir(uploadsDir), "user-bookmarks", `${safeUser}.json`),
    []
  );
  return bookId ? list.filter((b) => b.bookId === bookId) : list;
}

export function saveUserBookmark(
  uploadsDir: string,
  bookmark: HybridBookmarkRecord
): HybridBookmarkRecord[] {
  const safeUser = sanitizeStorageBookId(bookmark.userId || "anon");
  const filePath = path.join(getPipelineDir(uploadsDir), "user-bookmarks", `${safeUser}.json`);
  const existing = readJsonSafe<HybridBookmarkRecord[]>(filePath, []);
  const next = [bookmark, ...existing.filter((b) => b.id !== bookmark.id)];
  atomicWriteJson(filePath, next);
  return next.filter((b) => b.bookId === bookmark.bookId);
}

export function deleteUserBookmark(
  uploadsDir: string,
  userId: string,
  bookmarkId: string
): boolean {
  const safeUser = sanitizeStorageBookId(userId || "anon");
  const filePath = path.join(getPipelineDir(uploadsDir), "user-bookmarks", `${safeUser}.json`);
  const existing = readJsonSafe<HybridBookmarkRecord[]>(filePath, []);
  const next = existing.filter((b) => b.id !== bookmarkId);
  if (next.length === existing.length) return false;
  atomicWriteJson(filePath, next);
  return true;
}

export function readUserReadingProgress(
  uploadsDir: string,
  userId: string,
  bookId: string
): HybridReadingProgressRecord | null {
  const safeUser = sanitizeStorageBookId(userId || "anon");
  const map = readJsonSafe<Record<string, HybridReadingProgressRecord>>(
    path.join(getPipelineDir(uploadsDir), "user-progress", `${safeUser}.json`),
    {}
  );
  return map[bookId] || null;
}

export function saveUserReadingProgress(
  uploadsDir: string,
  record: HybridReadingProgressRecord
): HybridReadingProgressRecord {
  const safeUser = sanitizeStorageBookId(record.userId || "anon");
  const filePath = path.join(getPipelineDir(uploadsDir), "user-progress", `${safeUser}.json`);
  const map = readJsonSafe<Record<string, HybridReadingProgressRecord>>(filePath, {});
  map[record.bookId] = record;
  atomicWriteJson(filePath, map);
  return record;
}
