import fs from "fs";
import path from "path";
import type { S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildGeneratedEpubKey,
  sanitizeStorageBookId,
} from "../shared/b2StoragePaths";
import { extractCanonicalBookFromPdf } from "./pdfExtractor";
import { buildEpub3FromCanonicalStructure } from "./epubBuilder";
import { assessConversionQuality, validateEpub3Archive } from "./epubValidator";
import {
  computeSha256,
  readEpubArtifact,
  readProcessingJob,
  saveCanonicalStructure,
  saveConversionReport,
  saveEpubArtifact,
  saveProcessingJob,
} from "./canonicalBookStore";
import type {
  BookConversionOverview,
  CanonicalBookStructure,
  EpubArtifactInfo,
  ProcessingJobStatus,
} from "../src/types";

export interface PipelineRuntimeDeps {
  uploadsDir: string;
  b2BucketName?: string;
  getS3Client: () => S3Client | null;
  getSupabase: () => SupabaseClient | null;
  onBookMetadataUpdated?: (bookId: string, patch: Record<string, any>) => void;
  onBroadcast?: (event: any) => void;
}

const TOTAL_STAGES = 12;

const activeJobsByBook = new Set<string>();
const pendingQueue: Array<() => Promise<void>> = [];
let workerActive = false;

async function drainQueue() {
  if (workerActive) return;
  workerActive = true;
  try {
    while (pendingQueue.length > 0) {
      const task = pendingQueue.shift();
      if (task) {
        try {
          await task();
        } catch (err) {
          console.error("[PdfToEpubQueue] Uncaught worker task error:", err);
        }
      }
    }
  } finally {
    workerActive = false;
  }
}

async function resolvePdfBinaryBuffer(
  sourcePdfKey: string,
  deps: PipelineRuntimeDeps
): Promise<Buffer> {
  const safeKey = String(sourcePdfKey || "").replace(/^\/+/, "").replace(/\.\./g, "");
  const stripped = safeKey.replace(/^uploads\/+/, "");
  const resolvedUploads = path.resolve(deps.uploadsDir);
  const candidates = [
    path.resolve(resolvedUploads, safeKey),
    path.resolve(resolvedUploads, stripped),
  ].filter((p) => p.startsWith(resolvedUploads + path.sep));

  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return fs.readFileSync(p);
    }
  }

  // Fallback to Backblaze B2 private bucket if not cached locally
  const s3 = deps.getS3Client();
  if (s3 && deps.b2BucketName) {
    for (const keyVariant of Array.from(new Set([safeKey, stripped]))) {
      try {
        const res = await s3.send(
          new GetObjectCommand({ Bucket: deps.b2BucketName, Key: keyVariant })
        );
        if (res.Body) {
          const chunks: Buffer[] = [];
          for await (const ch of res.Body as any) {
            chunks.push(Buffer.isBuffer(ch) ? ch : Buffer.from(ch));
          }
          const buf = Buffer.concat(chunks);
          if (buf.length > 0) {
            // Cache locally for fast subsequent reads
            const cacheDest = path.resolve(resolvedUploads, safeKey);
            if (cacheDest.startsWith(resolvedUploads + path.sep)) {
              fs.mkdirSync(path.dirname(cacheDest), { recursive: true });
              fs.writeFileSync(cacheDest, buf);
            }
            return buf;
          }
        }
      } catch (_) {}
    }
  }

  throw new Error(`Original source PDF '${sourcePdfKey}' not found in local disk or Backblaze B2.`);
}

async function storeDerivedObject(
  key: string,
  buffer: Buffer,
  contentType: string,
  deps: PipelineRuntimeDeps
): Promise<{ storedLocally: boolean; storedB2: boolean }> {
  let storedLocally = false;
  let storedB2 = false;

  const resolvedUploads = path.resolve(deps.uploadsDir);
  const destPath = path.resolve(resolvedUploads, key);
  if (destPath.startsWith(resolvedUploads + path.sep)) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buffer);
    storedLocally = true;
  }

  const s3 = deps.getS3Client();
  if (s3 && deps.b2BucketName) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: deps.b2BucketName,
          Key: key,
          ContentType: contentType,
          ContentLength: buffer.length,
          Body: buffer,
        })
      );
      storedB2 = true;
    } catch (err: any) {
      console.warn(`[PdfToEpub] B2 store notice for ${key}:`, err?.message || err);
    }
  }

  return { storedLocally, storedB2 };
}

async function syncBookPipelineFields(
  bookId: string,
  patch: Record<string, any>,
  deps: PipelineRuntimeDeps
) {
  deps.onBookMetadataUpdated?.(bookId, patch);
  const sb = deps.getSupabase();
  if (!sb) return;
  try {
    const sbPatch: Record<string, any> = {};
    if (patch.sha256Checksum !== undefined) sbPatch.sha256_checksum = patch.sha256Checksum;
    if (patch.mimeType !== undefined) sbPatch.mime_type = patch.mimeType;
    if (patch.fileSizeBytes !== undefined) sbPatch.file_size_bytes = patch.fileSizeBytes;
    if (patch.pageCount !== undefined) sbPatch.page_count = patch.pageCount;
    if (patch.language !== undefined) sbPatch.language = patch.language;
    if (patch.processingStatus !== undefined) sbPatch.processing_status = patch.processingStatus;
    if (patch.epubFileKey !== undefined) sbPatch.epub_file_key = patch.epubFileKey;
    if (patch.epubPublished !== undefined) sbPatch.epub_published = patch.epubPublished;
    if (patch.conversionConfidence !== undefined) sbPatch.conversion_confidence = patch.conversionConfidence;
    if (patch.conversionQualityScore !== undefined) sbPatch.conversion_quality_score = patch.conversionQualityScore;
    if (patch.rightsConversionAllowed !== undefined) sbPatch.rights_conversion_allowed = patch.rightsConversionAllowed;
    if (Object.keys(sbPatch).length > 0) {
      await sb.from("books").update(sbPatch).eq("id", bookId);
    }
  } catch (_) {}
}

/**
 * Executes the 12-stage PDF-to-EPUB conversion pipeline for a single book.
 * Never modifies or deletes the original PDF.
 */
export async function runPdfToEpubConversion(
  params: {
    bookId: string;
    title: string;
    author?: string;
    publisher?: string;
    description?: string;
    language?: string;
    sourcePdfKey: string;
    rightsConversionAllowed?: boolean;
    forceRepublish?: boolean;
  },
  deps: PipelineRuntimeDeps
): Promise<{
  structure?: CanonicalBookStructure;
  overview?: BookConversionOverview;
}> {
  const { bookId, sourcePdfKey } = params;
  const sb = deps.getSupabase();
  const prevJob = readProcessingJob(deps.uploadsDir, bookId);
  const jobId = `job-${sanitizeStorageBookId(bookId)}-${Date.now()}`;
  const startedAt = new Date().toISOString();

  if (params.rightsConversionAllowed === false) {
    const blockedJob: ProcessingJobStatus = {
      id: jobId,
      bookId,
      sourcePdfKey,
      status: "pdf_only",
      currentStage: "rights_restricted",
      stageIndex: 0,
      totalStages: TOTAL_STAGES,
      progressPct: 100,
      ocrStatus: "not_needed",
      ocrPagesCount: 0,
      errorMessage: "Conversion skipped because publisher conversion permission is disabled.",
      retryCount: prevJob?.retryCount || 0,
      startedAt,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveProcessingJob(deps.uploadsDir, blockedJob, sb);
    await syncBookPipelineFields(
      bookId,
      { processingStatus: "pdf_only", epubPublished: false, rightsConversionAllowed: false },
      deps
    );
    return {};
  }

  let currentJob: ProcessingJobStatus = {
    id: jobId,
    bookId,
    sourcePdfKey,
    status: "processing",
    currentStage: "pdf_validation",
    stageIndex: 1,
    totalStages: TOTAL_STAGES,
    progressPct: 5,
    ocrStatus: "not_needed",
    ocrPagesCount: 0,
    retryCount: prevJob ? prevJob.retryCount + (prevJob.status === "failed" ? 1 : 0) : 0,
    startedAt,
    updatedAt: startedAt,
  };

  const updateStage = async (
    stageIndex: number,
    stageName: string,
    extra?: Partial<ProcessingJobStatus>
  ) => {
    currentJob = {
      ...currentJob,
      stageIndex,
      currentStage: stageName,
      progressPct: Math.min(100, Math.round((stageIndex / TOTAL_STAGES) * 100)),
      updatedAt: new Date().toISOString(),
      ...extra,
    };
    await saveProcessingJob(deps.uploadsDir, currentJob, sb);
  };

  await saveProcessingJob(deps.uploadsDir, currentJob, sb);
  await syncBookPipelineFields(bookId, { processingStatus: "processing" }, deps);

  try {
    // Load original PDF without touching/overwriting it
    const pdfBuffer = await resolvePdfBinaryBuffer(sourcePdfKey, deps);
    const pdfChecksum = computeSha256(pdfBuffer);

    await syncBookPipelineFields(
      bookId,
      {
        sha256Checksum: pdfChecksum,
        mimeType: "application/pdf",
        fileSizeBytes: pdfBuffer.length,
      },
      deps
    );

    // Stages 1-7: Validate, Extract Text, Detect Scans, OCR, TOC, Canonical Structure, Assets
    const extracted = await extractCanonicalBookFromPdf({
      bookId,
      title: params.title,
      author: params.author,
      publisher: params.publisher,
      language: params.language,
      sourcePdfKey,
      pdfBuffer,
      onStage: async (stageIdx, stageName) => {
        const ocrStatus: ProcessingJobStatus["ocrStatus"] =
          stageIdx === 4 ? "running" : currentJob.ocrStatus;
        await updateStage(stageIdx, stageName, { ocrStatus });
      },
    });

    const ocrStatus: ProcessingJobStatus["ocrStatus"] =
      extracted.scannedPagesCount === 0
        ? "not_needed"
        : extracted.ocrFailedPages.length === 0
        ? "completed"
        : extracted.ocrSuccessPages.length > 0
        ? "partial"
        : "failed";

    await updateStage(7, "asset_extraction", {
      ocrStatus,
      ocrPagesCount: extracted.ocrSuccessPages.length,
    });

    // Store extracted images in separate B2 prefix (`extracted-assets/<bookId>/...`)
    for (const item of extracted.assetBinaries) {
      await storeDerivedObject(item.asset.storageKey, item.buffer, item.asset.mimeType, deps);
    }

    // Stage 8 & 9: Semantic XHTML Generation & EPUB 3 Packaging
    await updateStage(8, "semantic_xhtml_generation");
    await updateStage(9, "epub3_packaging");

    const epubBuffer = await buildEpub3FromCanonicalStructure({
      structure: extracted.structure,
      embeddedAssets: extracted.assetBinaries,
      description: params.description,
    });

    // Stage 10: EPUB Validation
    await updateStage(10, "epub_validation");
    const validation = await validateEpub3Archive(epubBuffer, { runExternalEpubCheck: true });

    // Stage 11: Quality Assessment
    await updateStage(11, "quality_assessment");
    const report = assessConversionQuality({
      bookId,
      jobId,
      structure: extracted.structure,
      validation,
      scannedPagesCount: extracted.scannedPagesCount,
      ocrSuccessPages: extracted.ocrSuccessPages,
      ocrFailedPages: extracted.ocrFailedPages,
      emptyTextPagesCount: extracted.emptyTextPagesCount,
      unpreservedMathCount: extracted.unpreservedMathCount,
      missingAssetsCount: extracted.missingAssetsCount,
    });

    await saveConversionReport(deps.uploadsDir, report, sb);

    // Stage 12: Publication (never auto-publish failed validation; store under separate generated-epubs prefix)
    const prevArtifact = readEpubArtifact(deps.uploadsDir, bookId);
    const nextVersion = (prevArtifact?.version || 0) + 1;
    const epubKey = buildGeneratedEpubKey(bookId, nextVersion);
    const epubChecksum = computeSha256(epubBuffer);

    let published = false;
    if (validation.passed) {
      await storeDerivedObject(epubKey, epubBuffer, "application/epub+zip", deps);
      published = Boolean(report.autoPublished || (params.forceRepublish && validation.passed));
    }

    const artifact: EpubArtifactInfo = {
      id: `epub-${sanitizeStorageBookId(bookId)}-v${nextVersion}`,
      bookId,
      version: nextVersion,
      epubKey: validation.passed ? epubKey : "",
      sha256Checksum: epubChecksum,
      fileSizeBytes: epubBuffer.length,
      validationPassed: validation.passed,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      published,
      createdAt: new Date().toISOString(),
    };
    await saveEpubArtifact(deps.uploadsDir, artifact, sb);

    const finalStructure: CanonicalBookStructure = {
      ...extracted.structure,
      epubKey: validation.passed ? epubKey : undefined,
      epubPublished: published,
      confidenceStatus: report.confidenceStatus,
      qualityScore: report.qualityScore,
      updatedAt: new Date().toISOString(),
    };
    await saveCanonicalStructure(deps.uploadsDir, finalStructure, sb);

    const finalStatus: ProcessingJobStatus["status"] = !validation.passed
      ? "failed"
      : published
      ? "completed"
      : report.confidenceStatus === "medium"
      ? "needs_review"
      : "pdf_only";

    await updateStage(12, "publication", {
      status: finalStatus,
      progressPct: 100,
      completedAt: new Date().toISOString(),
      errorMessage: !validation.passed
        ? `EPUB validation failed (${validation.errors[0] || "structural error"}); PDF remains available.`
        : undefined,
    });

    await syncBookPipelineFields(
      bookId,
      {
        processingStatus: finalStatus,
        pageCount: finalStructure.totalPages,
        language: finalStructure.language,
        epubFileKey: validation.passed ? epubKey : undefined,
        epubPublished: published,
        conversionConfidence: report.confidenceStatus,
        conversionQualityScore: report.qualityScore,
      },
      deps
    );

    deps.onBroadcast?.({
      type: "system:books-updated",
      bookId,
      action: "conversion-complete",
      processingStatus: finalStatus,
      epubPublished: published,
      updatedAt: new Date().toISOString(),
    });

    return { structure: finalStructure };
  } catch (err: any) {
    const errMsg = err?.message || "PDF-to-EPUB conversion failed; source PDF remains intact.";
    console.error(`[PdfToEpubPipeline] Failed for book ${bookId}:`, errMsg);
    const failedJob: ProcessingJobStatus = {
      ...currentJob,
      status: "failed",
      progressPct: 100,
      errorMessage: errMsg,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveProcessingJob(deps.uploadsDir, failedJob, sb);
    await syncBookPipelineFields(
      bookId,
      {
        processingStatus: "failed",
        epubPublished: false,
      },
      deps
    );
    return {};
  }
}

/**
 * Enqueues a non-blocking background PDF-to-EPUB conversion job.
 */
export function enqueuePdfToEpubJob(
  params: {
    bookId: string;
    title: string;
    author?: string;
    publisher?: string;
    description?: string;
    language?: string;
    sourcePdfKey: string;
    rightsConversionAllowed?: boolean;
    forceRepublish?: boolean;
  },
  deps: PipelineRuntimeDeps
): { queued: boolean; reason?: string; job?: ProcessingJobStatus } {
  if (!params.bookId || !params.sourcePdfKey) {
    return { queued: false, reason: "Missing bookId or sourcePdfKey" };
  }
  if (activeJobsByBook.has(params.bookId)) {
    const existing = readProcessingJob(deps.uploadsDir, params.bookId);
    return { queued: false, reason: "Conversion already queued or running", job: existing || undefined };
  }

  const prevJob = readProcessingJob(deps.uploadsDir, params.bookId);
  const queuedJob: ProcessingJobStatus = {
    id: `job-${sanitizeStorageBookId(params.bookId)}-${Date.now()}`,
    bookId: params.bookId,
    sourcePdfKey: params.sourcePdfKey,
    status: "queued",
    currentStage: "queued",
    stageIndex: 0,
    totalStages: TOTAL_STAGES,
    progressPct: 0,
    ocrStatus: "not_needed",
    ocrPagesCount: 0,
    retryCount: prevJob?.retryCount || 0,
    updatedAt: new Date().toISOString(),
  };

  activeJobsByBook.add(params.bookId);
  void saveProcessingJob(deps.uploadsDir, queuedJob, deps.getSupabase());
  void syncBookPipelineFields(params.bookId, { processingStatus: "queued" }, deps);

  pendingQueue.push(async () => {
    try {
      await runPdfToEpubConversion(params, deps);
    } finally {
      activeJobsByBook.delete(params.bookId);
    }
  });

  setTimeout(() => {
    void drainQueue();
  }, 20);

  return { queued: true, job: queuedJob };
}

/**
 * Rebuilds the EPUB 3 package from an admin-edited CanonicalBookStructure,
 * validates it, and updates publication state without modifying the source PDF.
 */
export async function rebuildAndPublishFromEditedStructure(
  params: {
    structure: CanonicalBookStructure;
    publish: boolean;
    description?: string;
  },
  deps: PipelineRuntimeDeps
): Promise<{
  structure: CanonicalBookStructure;
  artifact: EpubArtifactInfo;
  validationErrors: string[];
  validationWarnings: string[];
}> {
  const sb = deps.getSupabase();
  const { structure } = params;

  // Load cached asset PNG binaries for embedding into rebuilt EPUB
  const embeddedAssets: Array<{ asset: any; buffer: Buffer }> = [];
  const resolvedUploads = path.resolve(deps.uploadsDir);
  for (const asset of structure.assets || []) {
    const p = path.resolve(resolvedUploads, asset.storageKey);
    if (p.startsWith(resolvedUploads + path.sep) && fs.existsSync(p)) {
      embeddedAssets.push({ asset, buffer: fs.readFileSync(p) });
    }
  }

  const epubBuffer = await buildEpub3FromCanonicalStructure({
    structure,
    embeddedAssets,
    description: params.description,
  });

  const validation = await validateEpub3Archive(epubBuffer, { runExternalEpubCheck: true });
  if (!validation.passed && params.publish) {
    throw new Error(`Cannot publish invalid EPUB 3: ${validation.errors.join("; ")}`);
  }

  const prevArtifact = readEpubArtifact(deps.uploadsDir, structure.bookId);
  const nextVersion = (prevArtifact?.version || 0) + 1;
  const epubKey = buildGeneratedEpubKey(structure.bookId, nextVersion);
  const epubChecksum = computeSha256(epubBuffer);

  if (validation.passed) {
    await storeDerivedObject(epubKey, epubBuffer, "application/epub+zip", deps);
  }

  const artifact: EpubArtifactInfo = {
    id: `epub-${sanitizeStorageBookId(structure.bookId)}-v${nextVersion}`,
    bookId: structure.bookId,
    version: nextVersion,
    epubKey: validation.passed ? epubKey : prevArtifact?.epubKey || "",
    sha256Checksum: epubChecksum,
    fileSizeBytes: epubBuffer.length,
    validationPassed: validation.passed,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    published: Boolean(params.publish && validation.passed),
    createdAt: new Date().toISOString(),
  };
  await saveEpubArtifact(deps.uploadsDir, artifact, sb);

  const nextStructure: CanonicalBookStructure = {
    ...structure,
    tocSource: "admin_edited",
    epubKey: artifact.epubKey || structure.epubKey,
    epubPublished: artifact.published,
    updatedAt: new Date().toISOString(),
  };
  await saveCanonicalStructure(deps.uploadsDir, nextStructure, sb);

  const status: ProcessingJobStatus["status"] = artifact.published
    ? "completed"
    : validation.passed
    ? "needs_review"
    : "failed";

  await saveProcessingJob(
    deps.uploadsDir,
    {
      id: `job-${sanitizeStorageBookId(structure.bookId)}-edit-${Date.now()}`,
      bookId: structure.bookId,
      sourcePdfKey: structure.sourcePdfKey,
      status,
      currentStage: "publication",
      stageIndex: TOTAL_STAGES,
      totalStages: TOTAL_STAGES,
      progressPct: 100,
      ocrStatus: "not_needed",
      ocrPagesCount: 0,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    sb
  );

  await syncBookPipelineFields(
    structure.bookId,
    {
      processingStatus: status,
      epubFileKey: artifact.epubKey || undefined,
      epubPublished: artifact.published,
    },
    deps
  );

  return {
    structure: nextStructure,
    artifact,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
  };
}
