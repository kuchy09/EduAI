import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  BookOpen,
  FileText,
  Download,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Eye,
} from 'lucide-react';
import {
  Book,
  BookConversionOverview,
  CanonicalBookChapter,
  CanonicalBookStructure,
} from '../types';

interface BookConversionModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  getAdminAuthHeaders: (extraHeaders?: Record<string, string>) => Promise<Record<string, string>>;
  onUpdated: () => void;
}

export function BookConversionModal({
  book,
  isOpen,
  onClose,
  getAdminAuthHeaders,
  onUpdated,
}: BookConversionModalProps) {
  const [overview, setOverview] = useState<BookConversionOverview | null>(null);
  const [structure, setStructure] = useState<CanonicalBookStructure | null>(null);
  const [editableChapters, setEditableChapters] = useState<CanonicalBookChapter[]>([]);
  const [expandedChapterIds, setExpandedChapterIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);
  const [downloadingPreview, setDownloadingPreview] = useState(false);
  const [previewChapterId, setPreviewChapterId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConversionData = useCallback(async () => {
    try {
      const [convRes, structRes] = await Promise.all([
        fetch(`/api/books/${encodeURIComponent(book.id)}/conversion`),
        fetch(`/api/books/${encodeURIComponent(book.id)}/structure`),
      ]);
      if (convRes.ok) {
        const convJson: BookConversionOverview = await convRes.json();
        setOverview(convJson);
      }
      if (structRes.ok) {
        const structJson = await structRes.json();
        if (structJson?.structure) {
          setStructure(structJson.structure);
          setEditableChapters(structJson.structure.chapters || []);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load conversion status.');
    } finally {
      setLoading(false);
    }
  }, [book.id]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);
    loadConversionData();
  }, [isOpen, loadConversionData]);

  // Poll while queued or processing
  useEffect(() => {
    if (!isOpen) return;
    const status = overview?.job?.status || overview?.processingStatus;
    if (status !== 'queued' && status !== 'processing') return;

    const interval = setInterval(() => {
      loadConversionData();
    }, 2500);
    return () => clearInterval(interval);
  }, [isOpen, overview?.job?.status, overview?.processingStatus, loadConversionData]);

  const handleStartConversion = async () => {
    setReprocessing(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const headers = await getAdminAuthHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch(`/api/books/${encodeURIComponent(book.id)}/reprocess`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sourcePdfKey: book.fileUrl,
          title: book.title,
          language: book.language || 'en',
          rightsConversionAllowed: book.rightsConversionAllowed !== false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed to start conversion (HTTP ${res.status})`);
      }
      setStatusMessage('12-stage PDF-to-EPUB 3 conversion pipeline queued.');
      await loadConversionData();
      onUpdated();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not queue conversion job.');
    } finally {
      setReprocessing(false);
    }
  };

  const handleSaveStructure = async (publish: boolean) => {
    if (!structure) return;
    setSavingStructure(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const headers = await getAdminAuthHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch(`/api/books/${encodeURIComponent(book.id)}/structure`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          chapters: editableChapters,
          publish,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed to update structure (HTTP ${res.status})`);
      }
      if (data?.structure) {
        setStructure(data.structure);
        setEditableChapters(data.structure.chapters || []);
      }
      if (Array.isArray(data?.validationErrors) && data.validationErrors.length > 0) {
        setErrorMessage(`EPUBCheck validation flagged errors: ${data.validationErrors.join('; ')}`);
      } else {
        setStatusMessage(
          publish
            ? 'Canonical Table of Contents saved, EPUB 3 rebuilt & published.'
            : 'Canonical Table of Contents saved as draft (PDF-only access retained).'
        );
      }
      await loadConversionData();
      onUpdated();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save structure changes.');
    } finally {
      setSavingStructure(false);
    }
  };

  const handleDownloadEpubPreview = async () => {
    setDownloadingPreview(true);
    setErrorMessage(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/books/${encodeURIComponent(book.id)}/epub?preview=true`, {
        headers,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error || `EPUB preview unavailable (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_preview.epub`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to download EPUB preview.');
    } finally {
      setDownloadingPreview(false);
    }
  };

  const updateChapterField = (index: number, patch: Partial<CanonicalBookChapter>) => {
    setEditableChapters((prev) =>
      prev.map((ch, idx) => (idx === index ? { ...ch, ...patch } : ch))
    );
  };

  const updateSectionField = (
    chIndex: number,
    secIndex: number,
    patch: { title?: string; pdfPageStart?: number; pdfPageEnd?: number; sectionType?: any }
  ) => {
    setEditableChapters((prev) =>
      prev.map((ch, idx) => {
        if (idx !== chIndex) return ch;
        const nextSections = (ch.sections || []).map((sec, sIdx) =>
          sIdx === secIndex ? { ...sec, ...patch } : sec
        );
        return { ...ch, sections: nextSections };
      })
    );
  };

  const moveChapter = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= editableChapters.length) return;
    setEditableChapters((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(targetIdx, 0, item);
      return next.map((ch, i) => ({ ...ch, chapterNumber: i + 1, orderIndex: i }));
    });
  };

  if (!isOpen) return null;

  const job = overview?.job;
  const report = overview?.report;
  const status = job?.status || overview?.processingStatus || 'pending';
  const confidence = report?.confidenceStatus || overview?.confidenceStatus;
  const qualityScore = report?.qualityScore ?? overview?.qualityScore;
  const previewChapter = editableChapters.find((c) => c.id === previewChapterId) || null;
  const isPdfSource =
    book.format !== 'epub' && !String(book.fileUrl || '').toLowerCase().endsWith('.epub');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e36] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900 dark:text-[#ededed]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2e2e36] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <BookOpen className="w-4 h-4 text-brand-600 dark:text-[#a78bfa] shrink-0" />
              <h3 className="text-base font-bold truncate">{book.title}</h3>
              {overview?.epubPublished ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  EPUB 3 Published
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                  <FileText className="w-3 h-3" />
                  PDF Active · {status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-[#a1a1aa] font-mono">
              {book.fileUrl && <span className="truncate max-w-[320px]">{book.fileUrl}</span>}
              {overview?.sha256Checksum && (
                <span title={`SHA-256: ${overview.sha256Checksum}`}>
                  SHA256: {overview.sha256Checksum.slice(0, 12)}…
                </span>
              )}
              {overview?.fileSizeBytes ? (
                <span>{(overview.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
              ) : null}
              {overview?.pageCount ? <span>{overview.pageCount} pages</span> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#27272d] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {statusMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              Loading conversion telemetry and canonical structure...
            </div>
          ) : (
            <>
              {/* Pipeline Status & Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 p-4 rounded-xl bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#a1a1aa]">
                        12-Stage Processing Pipeline
                      </div>
                      <div className="text-sm font-semibold mt-0.5">
                        {job?.currentStage || (overview?.epubPublished ? 'Published EPUB 3 edition' : 'Ready to convert source PDF')}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold tabular-nums px-2 py-1 rounded-md bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#34343c]">
                      {job ? `Stage ${job.stageIndex}/${job.totalStages} · ${job.progressPct}%` : status.toUpperCase()}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-[#34343c] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        status === 'failed'
                          ? 'bg-rose-500'
                          : status === 'completed'
                          ? 'bg-emerald-500'
                          : 'bg-brand-600'
                      }`}
                      style={{ width: `${job?.progressPct ?? (overview?.epubPublished ? 100 : 0)}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-[#c4c4c8]">
                    <span>
                      OCR Status:{' '}
                      <strong className="font-semibold">
                        {job?.ocrStatus || 'not_needed'}
                        {job?.ocrPagesCount ? ` (${job.ocrPagesCount} pages)` : ''}
                      </strong>
                    </span>
                    {job?.retryCount ? (
                      <span>Retries: {job.retryCount}</span>
                    ) : null}
                    {overview?.artifact?.epubKey && (
                      <span className="font-mono truncate max-w-[260px]" title={overview.artifact.epubKey}>
                        EPUB: {overview.artifact.epubKey}
                      </span>
                    )}
                  </div>

                  {job?.errorMessage && (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                      {job.errorMessage}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {isPdfSource && (
                      <button
                        type="button"
                        onClick={handleStartConversion}
                        disabled={reprocessing || status === 'queued' || status === 'processing'}
                        className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {reprocessing || status === 'queued' || status === 'processing' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        {status === 'queued' || status === 'processing'
                          ? 'Pipeline Running...'
                          : structure
                          ? 'Retry / Re-run Conversion'
                          : 'Convert PDF to EPUB 3'}
                      </button>
                    )}

                    {overview?.artifact?.epubKey && (
                      <button
                        type="button"
                        onClick={handleDownloadEpubPreview}
                        disabled={downloadingPreview}
                        className="px-3.5 py-2 rounded-lg bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-[#2a2a30] border border-slate-200 dark:border-[#34343c] text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {downloadingPreview ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Download Preview EPUB 3
                      </button>
                    )}
                  </div>
                </div>

                {/* Quality Confidence Card */}
                <div className="p-4 rounded-xl bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#a1a1aa]">
                      Quality &amp; Confidence
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono tabular-nums">
                        {qualityScore !== undefined ? `${qualityScore}/100` : '—'}
                      </span>
                      {confidence && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                            confidence === 'high'
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : confidence === 'medium'
                              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {confidence} confidence
                        </span>
                      )}
                    </div>
                  </div>

                  {report ? (
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-[#c4c4c8] tabular-nums">
                      <div>Chapters: <strong>{report.extractedChaptersCount}</strong></div>
                      <div>Sections: <strong>{report.extractedSectionsCount}</strong></div>
                      <div>Diagrams: <strong>{report.extractedImagesCount}</strong></div>
                      <div>Tables: <strong>{report.extractedTablesCount}</strong></div>
                      <div>MathML: <strong>{report.mathBlocksCount}</strong></div>
                      <div>
                        EPUBCheck:{' '}
                        <strong className={report.validationPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {report.validationPassed ? 'PASS' : 'FAIL'}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 dark:text-[#a1a1aa]">
                      Quality assessment is generated automatically after conversion.
                    </p>
                  )}
                </div>
              </div>

              {/* Warnings & Errors */}
              {report && (report.errors.length > 0 || report.warnings.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {report.errors.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 space-y-1">
                      <div className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Validation Errors ({report.errors.length})
                      </div>
                      <ul className="list-disc pl-4 text-[11px] text-rose-700 dark:text-rose-300 space-y-0.5">
                        {report.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {report.warnings.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 space-y-1">
                      <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Conversion Notices ({report.warnings.length})
                      </div>
                      <ul className="list-disc pl-4 text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5">
                        {report.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Canonical TOC & Chapter Review / Editor */}
              {structure && editableChapters.length > 0 && (
                <div className="border border-slate-200 dark:border-[#34343c] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-[#f8f9fb] dark:bg-[#222226] border-b border-slate-200 dark:border-[#34343c] flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#d4d4d8]">
                        Canonical Table of Contents Review ({editableChapters.length} Chapters)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-[#a1a1aa]">
                        Source: {structure.tocSource.replace(/_/g, ' ')} · Adjust titles, types, or PDF page spans before publishing.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveStructure(false)}
                        disabled={savingStructure}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-[#3f3f46] text-xs font-semibold hover:bg-white dark:hover:bg-[#2a2a30] cursor-pointer disabled:opacity-50"
                      >
                        Save Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveStructure(true)}
                        disabled={savingStructure}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {savingStructure ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        Save &amp; Publish EPUB 3
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-[#2a2a30] max-h-80 overflow-y-auto">
                    {editableChapters.map((ch, idx) => {
                      const isExpanded = Boolean(expandedChapterIds[ch.id]);
                      return (
                        <div key={ch.id} className="p-3 space-y-2 bg-white dark:bg-[#18181b]">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedChapterIds((prev) => ({
                                  ...prev,
                                  [ch.id]: !prev[ch.id],
                                }))
                              }
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#27272d] cursor-pointer"
                              title="Toggle sections"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <input
                              type="text"
                              value={ch.title}
                              onChange={(e) => updateChapterField(idx, { title: e.target.value })}
                              className="flex-1 min-w-[180px] px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c] outline-none focus:border-brand-500"
                            />
                            <select
                              value={ch.sectionType}
                              onChange={(e) =>
                                updateChapterField(idx, { sectionType: e.target.value as any })
                              }
                              className="px-2 py-1 text-[11px] rounded-lg bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c]"
                            >
                              <option value="front_matter">Front Matter</option>
                              <option value="chapter">Chapter</option>
                              <option value="exercises">Exercises</option>
                              <option value="glossary">Glossary</option>
                              <option value="appendix">Appendix</option>
                            </select>
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="text-slate-400">pp.</span>
                              <input
                                type="number"
                                min={1}
                                value={ch.pdfPageStart}
                                onChange={(e) =>
                                  updateChapterField(idx, { pdfPageStart: Number(e.target.value) || 1 })
                                }
                                className="w-14 px-1.5 py-1 rounded bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c] font-mono tabular-nums"
                              />
                              <span>–</span>
                              <input
                                type="number"
                                min={ch.pdfPageStart}
                                value={ch.pdfPageEnd}
                                onChange={(e) =>
                                  updateChapterField(idx, {
                                    pdfPageEnd: Number(e.target.value) || ch.pdfPageStart,
                                  })
                                }
                                className="w-14 px-1.5 py-1 rounded bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c] font-mono tabular-nums"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewChapterId((cur) => (cur === ch.id ? null : ch.id))
                              }
                              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-[#27272d] cursor-pointer"
                              title="Preview extracted blocks"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveChapter(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#27272d] disabled:opacity-30 cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveChapter(idx, 1)}
                              disabled={idx === editableChapters.length - 1}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#27272d] disabled:opacity-30 cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {isExpanded && ch.sections && ch.sections.length > 0 && (
                            <div className="pl-7 space-y-1.5 border-l-2 border-slate-200 dark:border-[#2e2e36] ml-2.5">
                              {ch.sections.map((sec, sIdx) => (
                                <div key={sec.id} className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="text"
                                    value={sec.title}
                                    onChange={(e) =>
                                      updateSectionField(idx, sIdx, { title: e.target.value })
                                    }
                                    className="flex-1 min-w-[160px] px-2 py-1 text-[11px] rounded bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c]"
                                  />
                                  <select
                                    value={sec.sectionType}
                                    onChange={(e) =>
                                      updateSectionField(idx, sIdx, { sectionType: e.target.value })
                                    }
                                    className="px-1.5 py-1 text-[10px] rounded bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c]"
                                  >
                                    <option value="section">Section</option>
                                    <option value="subsection">Subsection</option>
                                    <option value="exercise">Exercise</option>
                                    <option value="learning_objectives">Objectives</option>
                                  </select>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    p.{sec.pdfPageStart}–{sec.pdfPageEnd}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chapter Block Preview Panel */}
              {previewChapter && (
                <div className="p-4 rounded-xl bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                      Extracted Preview: {previewChapter.title}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewChapterId(null)}
                      className="text-[11px] underline text-slate-500 cursor-pointer"
                    >
                      Hide Preview
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs text-slate-700 dark:text-[#d4d4d8]">
                    {previewChapter.blocks.slice(0, 12).map((b) => (
                      <div key={b.id} className="p-2 rounded bg-white dark:bg-[#18181b] border border-slate-200/70 dark:border-[#2e2e36]">
                        <span className="text-[10px] font-mono uppercase text-brand-600 dark:text-[#a78bfa] mr-2">
                          [{b.type} · p.{b.pdfPageNumber}]
                        </span>
                        <span>{b.text.slice(0, 260)}{b.text.length > 260 ? '…' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
