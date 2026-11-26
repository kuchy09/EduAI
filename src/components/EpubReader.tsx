import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, List, Lock, BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { Book, CanonicalBookChapter } from '../types';
import { ParsedEpubDocument, parseEpubArrayBuffer } from '../lib/epubParser';

interface EpubReaderProps {
  book: Book;
  sourceUrl: string;
  theme: 'sepia' | 'dark' | 'amoled';
  fontSize: 'sm' | 'base' | 'lg' | 'xl';
  fontFamily: 'serif' | 'sans';
  isCachedLocally: boolean;
  renderTextWithHighlights: (text: string) => React.ReactNode;
  canonicalChapters?: CanonicalBookChapter[];
  externalChapterHref?: string;
  externalAnchor?: string;
  navigationToken?: number;
  onChapterProgress?: (
    chapterIndex: number,
    totalChapters: number,
    chapterTitle: string,
    chapterHref: string
  ) => void;
  onFallbackToPdf?: () => void;
}

export function EpubReader({
  book,
  sourceUrl,
  theme,
  fontSize,
  fontFamily,
  isCachedLocally,
  renderTextWithHighlights,
  externalChapterHref,
  externalAnchor,
  navigationToken,
  onChapterProgress,
  onFallbackToPdf,
}: EpubReaderProps) {
  const [epubDoc, setEpubDoc] = useState<ParsedEpubDocument | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let urlsToClean: string[] = [];
    setLoading(true);
    setError(null);

    fetch(sourceUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) =>
        parseEpubArrayBuffer(buf, {
          title: book.title,
          author: book.author,
          publisher: book.publisher,
        })
      )
      .then((parsed) => {
        if (!active) {
          parsed.blobUrlsToRevoke.forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        urlsToClean = parsed.blobUrlsToRevoke;
        setEpubDoc(parsed);
        setChapterIndex(0);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || 'Unable to open EPUB archive.');
        setLoading(false);
      });

    return () => {
      active = false;
      urlsToClean.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [sourceUrl, book.title, book.author, book.publisher]);

  // Synchronize external TOC / search / PDF-switch navigation into active EPUB chapter + anchor
  useEffect(() => {
    if (!epubDoc || !externalChapterHref) return;
    const cleanTarget = externalChapterHref.replace(/^OEBPS\//i, '').split('#')[0].toLowerCase();
    const matchIdx = epubDoc.chapters.findIndex(
      (c) =>
        c.href.toLowerCase().endsWith(cleanTarget) ||
        cleanTarget.endsWith(c.href.toLowerCase()) ||
        c.id.toLowerCase() === cleanTarget
    );
    if (matchIdx >= 0) {
      setChapterIndex(matchIdx);
    }
    if (externalAnchor) {
      setTimeout(() => {
        const el = document.getElementById(externalAnchor);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (contentScrollRef.current) {
          contentScrollRef.current.scrollTop = 0;
        }
      }, 90);
    } else if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }
  }, [epubDoc, externalChapterHref, externalAnchor, navigationToken]);

  const onChapterProgressRef = useRef(onChapterProgress);
  onChapterProgressRef.current = onChapterProgress;
  const lastReportedChapterRef = useRef<string>('');

  const activeChapter = epubDoc?.chapters[chapterIndex] || null;
  const totalChapters = epubDoc?.chapters.length || 0;
  const activeChapterTitle = activeChapter?.title || '';

  useEffect(() => {
    if (!activeChapter || totalChapters <= 0) return;
    const signature = `${sourceUrl}::${chapterIndex}::${totalChapters}::${activeChapterTitle}`;
    if (lastReportedChapterRef.current === signature) return;
    lastReportedChapterRef.current = signature;
    onChapterProgressRef.current?.(chapterIndex, totalChapters, activeChapterTitle, activeChapter.href);
  }, [sourceUrl, chapterIndex, totalChapters, activeChapter, activeChapterTitle]);

  const navigateToTocItem = (href: string, anchor?: string) => {
    if (!epubDoc) return;
    const targetClean = href.replace(/^OEBPS\//i, '').toLowerCase();
    const idx = epubDoc.chapters.findIndex(
      (c) => c.href.toLowerCase().endsWith(targetClean) || targetClean.endsWith(c.href.toLowerCase())
    );
    if (idx >= 0) {
      setChapterIndex(idx);
      setShowToc(false);
      setTimeout(() => {
        if (anchor) {
          const el = document.getElementById(anchor);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
        }
        if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0;
      }, 60);
    }
  };

  const sizeClass =
    fontSize === 'sm'
      ? 'text-[15px] leading-[1.7]'
      : fontSize === 'base'
      ? 'text-[17px] leading-[1.75]'
      : fontSize === 'lg'
      ? 'text-[19px] leading-[1.8]'
      : 'text-[22px] leading-[1.8]';

  const surfaceTextClass =
    theme === 'dark'
      ? 'text-[#EDEDED]'
      : theme === 'amoled'
      ? 'text-[#E5E5EA]'
      : 'text-[#2C2925]';

  const mutedTextClass =
    theme === 'dark' || theme === 'amoled' ? 'text-stone-400' : 'text-stone-600';

  const borderClass =
    theme === 'dark'
      ? 'border-white/10'
      : theme === 'amoled'
      ? 'border-stone-800'
      : 'border-stone-300/70';

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
        <p className={`text-sm font-sans ${mutedTextClass}`}>
          Unpacking reflowable EPUB 3 chapters...
        </p>
      </div>
    );
  }

  if (error || !epubDoc || epubDoc.chapters.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto gap-3 font-sans">
        <AlertCircle className="w-10 h-10 text-rose-500 opacity-80" />
        <h3 className={`text-base font-bold ${surfaceTextClass}`}>EPUB 3 edition unavailable</h3>
        <p className={`text-sm ${mutedTextClass}`}>
          {error || 'No readable XHTML chapters were found inside this EPUB container.'}
        </p>
        {onFallbackToPdf && (
          <button
            type="button"
            onClick={onFallbackToPdf}
            className="mt-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold cursor-pointer"
          >
            Open Original PDF Edition
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex overflow-hidden relative">
      {/* Chapter Table of Contents Drawer */}
      {showToc && (
        <aside
          className={`w-72 max-w-[82vw] border-r ${borderClass} overflow-y-auto p-4 shrink-0 font-sans ${
            theme === 'dark'
              ? 'bg-[#161618]'
              : theme === 'amoled'
              ? 'bg-[#080808]'
              : 'bg-[#ECE3CC]'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-semibold uppercase tracking-wider ${mutedTextClass}`}>
              EPUB Navigation
            </span>
            <button
              type="button"
              onClick={() => setShowToc(false)}
              className={`text-xs font-medium underline cursor-pointer ${mutedTextClass}`}
            >
              Close
            </button>
          </div>
          <nav className="space-y-1">
            {epubDoc.toc.map((item, idx) => {
              const active =
                activeChapter &&
                item.level === 1 &&
                item.href.toLowerCase() === activeChapter.href.toLowerCase();
              return (
                <button
                  key={`${item.href}-${item.anchor || idx}`}
                  type="button"
                  onClick={() => navigateToTocItem(item.href, item.anchor)}
                  style={{ paddingLeft: `${0.75 + (item.level - 1) * 0.75}rem` }}
                  className={`w-full text-left pr-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand-600 text-white font-semibold'
                      : `${surfaceTextClass} hover:bg-black/5 dark:hover:bg-white/5`
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      {/* Reflowable Reading Canvas */}
      <div ref={contentScrollRef} className="flex-1 h-full overflow-y-auto px-5 sm:px-10 py-8 pb-32">
        <div className="max-w-[68ch] mx-auto">
          {/* Quiet Metadata Strip */}
          <div className={`flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b ${borderClass} font-sans text-xs ${mutedTextClass}`}>
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Reflowable EPUB 3 · Chapter <span className="tabular-nums">{chapterIndex + 1}</span> of{' '}
                <span className="tabular-nums">{totalChapters}</span>
              </span>
              {isCachedLocally && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Lock className="w-3 h-3" />
                    Offline Secured
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowToc((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 font-semibold whitespace-nowrap shrink-0 cursor-pointer hover:underline ${surfaceTextClass}`}
            >
              <List className="w-3.5 h-3.5" />
              EPUB Index
            </button>
          </div>

          {/* Chapter Content */}
          <article className={`${fontFamily === 'serif' ? 'font-serif' : 'font-sans'} ${sizeClass} ${surfaceTextClass} space-y-5`}>
            {activeChapter?.blocks.map((block, idx) => {
              if (block.type === 'heading') {
                const lvl = block.level || 2;
                return (
                  <h2
                    key={idx}
                    id={block.id}
                    className={`font-display font-bold tracking-tight scroll-mt-6 ${
                      lvl <= 1 ? 'text-2xl sm:text-3xl mb-4' : lvl === 2 ? 'text-xl mt-7 mb-2' : 'text-lg mt-5 mb-1.5'
                    }`}
                  >
                    {renderTextWithHighlights(block.text)}
                  </h2>
                );
              }
              if (block.type === 'image') {
                return (
                  <figure key={idx} id={block.id} className={`my-6 p-3 rounded-xl border ${borderClass} text-center`}>
                    {block.imageSrc && (
                      <img
                        src={block.imageSrc}
                        alt={block.caption || block.text}
                        className="max-w-full h-auto mx-auto rounded-lg"
                      />
                    )}
                    <figcaption className={`mt-2 text-xs font-sans ${mutedTextClass}`}>
                      {block.caption || block.text}
                    </figcaption>
                  </figure>
                );
              }
              if (block.type === 'table' && block.tableData) {
                return (
                  <div key={idx} id={block.id} className={`my-5 overflow-x-auto rounded-xl border ${borderClass} font-sans text-xs`}>
                    <table className="w-full border-collapse text-left">
                      {block.tableData.headers.length > 0 && (
                        <thead>
                          <tr className={`border-b ${borderClass} bg-black/5 dark:bg-white/5`}>
                            {block.tableData.headers.map((h, hIdx) => (
                              <th key={hIdx} className="px-3 py-2 font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody className={`divide-y ${borderClass}`}>
                        {block.tableData.rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-3 py-2">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }
              if (block.type === 'math') {
                return (
                  <div
                    key={idx}
                    id={block.id}
                    className={`my-4 px-4 py-3 rounded-xl border ${borderClass} font-mono text-sm text-center overflow-x-auto ${
                      theme === 'dark' ? 'bg-[#222226]' : theme === 'amoled' ? 'bg-[#121212]' : 'bg-[#EAE0C8]'
                    }`}
                  >
                    {block.text}
                  </div>
                );
              }
              if (block.type === 'blockquote') {
                return (
                  <blockquote
                    key={idx}
                    id={block.id}
                    className={`p-5 rounded-xl border ${borderClass} italic font-sans text-[15px] leading-relaxed ${
                      theme === 'dark'
                        ? 'bg-[#222226]'
                        : theme === 'amoled'
                        ? 'bg-[#121212]'
                        : 'bg-[#EAE0C8]'
                    }`}
                  >
                    {renderTextWithHighlights(block.text)}
                  </blockquote>
                );
              }
              if (block.type === 'list-item') {
                return (
                  <p key={idx} id={block.id} className="pl-4">
                    • {renderTextWithHighlights(block.text)}
                  </p>
                );
              }
              return (
                <p key={idx} id={block.id}>
                  {renderTextWithHighlights(block.text)}
                </p>
              );
            })}
          </article>

          {/* Chapter Pager */}
          <div className={`mt-12 pt-6 border-t ${borderClass} flex items-center justify-between gap-4 font-sans`}>
            <button
              type="button"
              disabled={chapterIndex <= 0}
              onClick={() => {
                setChapterIndex((i) => Math.max(0, i - 1));
                if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0;
              }}
              className={`px-4 py-2 rounded-xl border ${borderClass} text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-opacity disabled:opacity-40 cursor-pointer ${surfaceTextClass}`}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous Chapter
            </button>
            <span className={`text-xs tabular-nums ${mutedTextClass}`}>
              {chapterIndex + 1} / {totalChapters}
            </span>
            <button
              type="button"
              disabled={chapterIndex >= totalChapters - 1}
              onClick={() => {
                setChapterIndex((i) => Math.min(totalChapters - 1, i + 1));
                if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0;
              }}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-opacity disabled:opacity-40 cursor-pointer"
            >
              Next Chapter
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
