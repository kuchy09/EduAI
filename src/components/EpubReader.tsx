import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, List, Lock, BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { Book } from '../types';
import { ParsedEpubDocument, parseEpubArrayBuffer } from '../lib/epubParser';

interface EpubReaderProps {
  book: Book;
  sourceUrl: string;
  theme: 'sepia' | 'dark' | 'amoled';
  fontSize: 'sm' | 'base' | 'lg' | 'xl';
  fontFamily: 'serif' | 'sans';
  isCachedLocally: boolean;
  renderTextWithHighlights: (text: string) => React.ReactNode;
  onChapterProgress?: (chapterIndex: number, totalChapters: number, chapterTitle: string) => void;
}

export function EpubReader({
  book,
  sourceUrl,
  theme,
  fontSize,
  fontFamily,
  isCachedLocally,
  renderTextWithHighlights,
  onChapterProgress,
}: EpubReaderProps) {
  const [epubDoc, setEpubDoc] = useState<ParsedEpubDocument | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
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
        if (!active) return;
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
    };
  }, [sourceUrl, book.title, book.author, book.publisher]);

  const activeChapter = epubDoc?.chapters[chapterIndex] || null;
  const totalChapters = epubDoc?.chapters.length || 0;

  useEffect(() => {
    if (activeChapter && totalChapters > 0 && onChapterProgress) {
      onChapterProgress(chapterIndex, totalChapters, activeChapter.title);
    }
  }, [chapterIndex, totalChapters, activeChapter, onChapterProgress]);

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
          Unpacking reflowable EPUB chapters...
        </p>
      </div>
    );
  }

  if (error || !epubDoc || epubDoc.chapters.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto gap-3 font-sans">
        <AlertCircle className="w-10 h-10 text-rose-500 opacity-80" />
        <h3 className={`text-base font-bold ${surfaceTextClass}`}>Could not parse EPUB edition</h3>
        <p className={`text-sm ${mutedTextClass}`}>
          {error || 'No readable XHTML chapters were found inside this EPUB container.'}
        </p>
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
              EPUB Chapters
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
            {epubDoc.chapters.map((ch, idx) => {
              const active = idx === chapterIndex;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setChapterIndex(idx);
                    setShowToc(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand-600 text-white font-semibold'
                      : `${surfaceTextClass} hover:bg-black/5 dark:hover:bg-white/5`
                  }`}
                >
                  <span className="tabular-nums opacity-70 mr-1.5">{idx + 1}.</span>
                  {ch.title}
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      {/* Reflowable Reading Canvas */}
      <div className="flex-1 h-full overflow-y-auto px-5 sm:px-10 py-8 pb-32">
        <div className="max-w-[68ch] mx-auto">
          {/* Quiet Metadata Strip (Zero-Pill Rule) */}
          <div className={`flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b ${borderClass} font-sans text-xs ${mutedTextClass}`}>
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Reflowable EPUB · Chapter <span className="tabular-nums">{chapterIndex + 1}</span> of{' '}
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
              Chapters
            </button>
          </div>

          {/* Chapter Content */}
          <article className={`${fontFamily === 'serif' ? 'font-serif' : 'font-sans'} ${sizeClass} ${surfaceTextClass} space-y-5`}>
            {activeChapter?.blocks.map((block, idx) => {
              if (block.type === 'heading') {
                return (
                  <h2
                    key={idx}
                    className={`font-display font-bold tracking-tight ${
                      (block.level || 1) <= 1 ? 'text-2xl sm:text-3xl mb-4' : 'text-xl mt-6 mb-2'
                    }`}
                  >
                    {renderTextWithHighlights(block.text)}
                  </h2>
                );
              }
              if (block.type === 'blockquote') {
                return (
                  <blockquote
                    key={idx}
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
                  <p key={idx} className="pl-4">
                    • {renderTextWithHighlights(block.text)}
                  </p>
                );
              }
              return <p key={idx}>{renderTextWithHighlights(block.text)}</p>;
            })}
          </article>

          {/* Chapter Pager */}
          <div className={`mt-12 pt-6 border-t ${borderClass} flex items-center justify-between gap-4 font-sans`}>
            <button
              type="button"
              disabled={chapterIndex <= 0}
              onClick={() => setChapterIndex((i) => Math.max(0, i - 1))}
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
              onClick={() => setChapterIndex((i) => Math.min(totalChapters - 1, i + 1))}
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
