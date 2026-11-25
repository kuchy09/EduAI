import { Book } from '../types';
import {
  X, Play, MessageSquare, Star, Clock, BookOpen, Sparkles,
  Download, CheckCircle2, Loader2, Info, FileText, Calendar,
  ChevronLeft, ChevronRight, Headphones
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BookCoverVisual } from './BookCoverVisual';
import { mockBooks } from '../data';
import {
  applyGlobalCoverToBook,
  applyGlobalCoversToBooks,
  GLOBAL_BOOK_COVERS_EVENT,
} from '../lib/globalBookCoversService';

interface BookDetailProps {
  book: Book;
  onClose: () => void;
  onDiscuss: () => void;
  onRead: () => void;
  onListen?: () => void;
  onMarkCompleted?: (book: Book) => void;
  allBooks?: Book[];
  onSelectBook?: (book: Book) => void;
}

function hashBookSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getBookPageCount(book: Book): number {
  if (typeof book.pages === 'number' && book.pages > 0) return book.pages;
  const seed = hashBookSeed(`${book.id}:${book.title}`);
  const isHigherEd =
    book.level === 'University' ||
    book.level === 'College' ||
    book.level === 'Graduate' ||
    book.level === 'Postgraduate';
  return isHigherEd ? 320 + (seed % 340) : 184 + (seed % 168);
}

function getBookPublishYear(book: Book): number {
  if (typeof book.publishedYear === 'number' && book.publishedYear > 0) return book.publishedYear;
  const seed = hashBookSeed(`${book.id}:${book.author}`);
  const currs = (book.curriculum || []).join(' ').toUpperCase();
  if (currs.includes('CBC')) return 2022 + (seed % 4);
  if (currs.includes('KCSE') || (book.publisher || '').includes('KLB')) return 2020 + (seed % 5);
  return 2018 + (seed % 8);
}

export function BookDetail({ book, onClose, onDiscuss, onRead, onListen, onMarkCompleted, allBooks, onSelectBook }: BookDetailProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [showExtraInfo, setShowExtraInfo] = useState(false);
  const [coverTick, setCoverTick] = useState(0);
  const drawerScrollRef = useRef<HTMLDivElement>(null);
  const shelfScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onCoversUpdated = () => setCoverTick((t) => t + 1);
    window.addEventListener(GLOBAL_BOOK_COVERS_EVENT, onCoversUpdated);
    return () => window.removeEventListener(GLOBAL_BOOK_COVERS_EVENT, onCoversUpdated);
  }, []);

  const displayBook = useMemo(
    () => applyGlobalCoverToBook(book),
    [book, coverTick]
  );

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Scroll drawer back to top when switching to a suggested book
  useEffect(() => {
    drawerScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setShowExtraInfo(false);
  }, [displayBook.id]);

  const pageCount = useMemo(() => getBookPageCount(displayBook), [displayBook]);
  const publishYear = useMemo(() => getBookPublishYear(displayBook), [displayBook]);

  const otherBooks = useMemo(() => {
    const rawSource = allBooks && allBooks.length > 0 ? allBooks : mockBooks;
    const source = applyGlobalCoversToBooks(rawSource).filter(
      (candidate) => candidate.id !== displayBook.id
    );
    const currentSubjects = new Set((displayBook.subjects || []).map((s) => s.toLowerCase()));
    const currentCurricula = new Set((displayBook.curriculum || []).map((c) => c.toLowerCase()));

    return [...source]
      .sort((a, b) => {
        const score = (item: Book) => {
          let pts = 0;
          if (item.category === displayBook.category) pts += 3;
          if (item.level && displayBook.level && item.level === displayBook.level) pts += 2;
          for (const s of item.subjects || []) {
            if (currentSubjects.has(s.toLowerCase())) pts += 4;
          }
          for (const c of item.curriculum || []) {
            if (currentCurricula.has(c.toLowerCase())) pts += 2;
          }
          return pts;
        };
        return score(b) - score(a);
      })
      .slice(0, 12);
  }, [allBooks, displayBook, coverTick]);

  const scrollShelf = (direction: 'left' | 'right') => {
    if (!shelfScrollRef.current) return;
    const offset = direction === 'left' ? -220 : 220;
    shelfScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadComplete(false);
    try {
      const fileKey = book.fileUrl || book.id;
      const url = `/api/download?key=${encodeURIComponent(fileKey)}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const extension = (book.fileUrl || 'pdf').split('.').pop()?.substring(0, 4) || 'pdf';
      const cleanExtension = extension.includes('?') ? extension.split('?')[0] : extension;
      a.download = `${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${cleanExtension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      
      setDownloadComplete(true);
      setTimeout(() => setDownloadComplete(false), 3000);
    } catch (err) {
      console.warn('Failed to download blob directly, opening in new tab:', err);
      const fileKey = book.fileUrl || book.id;
      const fallbackUrl = `/api/download?key=${encodeURIComponent(fileKey)}`;
      window.open(fallbackUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end"
        onClick={onClose}
      >
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full max-w-md h-full bg-white dark:bg-[#161616] text-slate-900 dark:text-[#EDEDED] shadow-2xl relative flex flex-col border-l border-slate-200/80 dark:border-white/10"
          onClick={e => e.stopPropagation()}
        >
          <div ref={drawerScrollRef} className="flex-1 overflow-y-auto p-6 pb-28">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-[#242424] hover:bg-slate-200 dark:hover:bg-[#2e2e2e] rounded-full text-slate-500 dark:text-slate-300 transition-colors z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center text-center mt-8 mb-6">
              <div className="w-40 h-56 rounded-xl overflow-hidden shadow-lg shadow-slate-200/50 dark:shadow-black/50 mb-6 border border-slate-100 dark:border-white/10 flex relative">
                <BookCoverVisual book={displayBook} className="w-full h-full absolute inset-0" />
              </div>
              <div className="text-xs font-semibold text-brand-700 dark:text-[#a690ee] uppercase tracking-wider mb-2">
                {displayBook.category}
              </div>
              <h2 className="text-2xl font-bold font-display text-slate-900 dark:text-[#EDEDED] mb-2 leading-tight px-4">{displayBook.title}</h2>
              <p className="text-slate-500 dark:text-[#A0A0A0] font-medium">{displayBook.author}</p>
            </div>

            <div className="flex items-center justify-center gap-6 mb-5 py-4 border-y border-slate-100 dark:border-white/10">
               <div className="flex flex-col items-center gap-1">
                 <div className="flex items-center text-slate-900 dark:text-[#EDEDED] font-semibold text-sm tabular-nums">
                   <Star className="w-4 h-4 fill-amber-400 text-amber-400 mr-1" />
                   {book.rating}
                 </div>
                 <span className="text-xs text-slate-500 dark:text-[#A0A0A0] font-medium">Rating</span>
               </div>
               <div className="w-px h-8 bg-slate-100 dark:bg-white/10"></div>
               <div className="flex flex-col items-center gap-1">
                 <div className="flex items-center text-slate-900 dark:text-[#EDEDED] font-semibold text-sm gap-1.5">
                   <BookOpen className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                   {(book.readProgress || 0) >= 100 ? 'Completed' : book.readProgress ? 'Reading' : 'Unread'}
                 </div>
                 <span className="text-xs text-slate-500 dark:text-[#A0A0A0] font-medium tabular-nums">{book.readProgress || 0}% Done</span>
               </div>
               <div className="w-px h-8 bg-slate-100 dark:bg-white/10"></div>
               <div className="flex flex-col items-center gap-1">
                 <div className="flex items-center text-slate-900 dark:text-[#EDEDED] font-semibold text-sm gap-1.5 tabular-nums">
                   <Clock className="w-4 h-4 text-emerald-500" />
                   12h
                 </div>
                 <span className="text-xs text-slate-500 dark:text-[#A0A0A0] font-medium">Est. Time</span>
               </div>
            </div>

            {onMarkCompleted && (
              <div className="mb-6">
                {(book.readProgress || 0) >= 100 ? (
                  <div className="w-full px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      Book Completed
                    </span>
                    <span className="tabular-nums">+100 Edu Points Earned</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onMarkCompleted(book)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#222222] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200/80 dark:border-white/10 hover:border-emerald-300 dark:hover:border-emerald-700/50 text-slate-700 dark:text-[#EDEDED] hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      Mark Book as Completed
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">+100 EP</span>
                  </button>
                )}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#EDEDED] mb-2 font-display">About this book</h3>
                <p className="text-slate-600 dark:text-[#B5B5B5] leading-relaxed text-[15px]">
                  {book.description}
                </p>

                {/* Book Info Icon & Publication Metadata (Pages & Year of Publish) */}
                <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5">
                  <button
                    type="button"
                    onClick={() => setShowExtraInfo((prev) => !prev)}
                    aria-expanded={showExtraInfo}
                    className="w-full flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 text-left cursor-pointer group"
                    title="Book edition & publication details"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center shrink-0 group-hover:bg-brand-100 transition-colors">
                        <Info className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 block">Book Info</span>
                        <span className="text-[11px] text-slate-500 block truncate">
                          Edition &amp; publication details
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/80 text-xs font-semibold text-slate-800 tabular-nums">
                        <FileText className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                        <span>{pageCount} pages</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/80 text-xs font-semibold text-slate-800 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{publishYear}</span>
                      </div>
                    </div>
                  </button>

                  {showExtraInfo && (
                    <div className="mt-3 pt-3 border-t border-slate-200/70 grid grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Publisher</span>
                        <span className="font-medium text-slate-800 truncate block">
                          {book.publisher || book.author}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Academic Level</span>
                        <span className="font-medium text-slate-800 truncate block">
                          {book.level || 'All Levels'}
                          {book.curriculum?.length ? ` · ${book.curriculum.join(', ')}` : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {book.aiInsights && book.aiInsights.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2 font-display">
                    <Sparkles className="w-5 h-5 text-brand-500" />
                    AI Insights
                  </h3>
                  <ul className="space-y-2">
                    {book.aiInsights.map((insight, idx) => (
                      <li key={idx} className="flex gap-3 text-[15px] text-slate-700 bg-brand-50/50 p-4 rounded-xl border border-brand-100/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0 mt-2"></span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Other Books Horizontal Scrollable Suggestion Shelf */}
              {otherBooks.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-lg font-bold text-slate-900 font-display">Other Books</h3>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => scrollShelf('left')}
                        aria-label="Scroll Other Books left"
                        className="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollShelf('right')}
                        aria-label="Scroll Other Books right"
                        className="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div
                    ref={shelfScrollRef}
                    className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
                  >
                    {otherBooks.map((suggested) => (
                      <button
                        type="button"
                        key={suggested.id}
                        onClick={() => onSelectBook?.(suggested)}
                        className="w-28 shrink-0 snap-start text-left group cursor-pointer focus:outline-none"
                      >
                        <div className="w-28 h-40 rounded-xl overflow-hidden shadow-sm border border-slate-200/80 relative bg-slate-100 group-hover:shadow-md group-hover:-translate-y-0.5 transition-all">
                          <BookCoverVisual book={suggested} className="w-full h-full absolute inset-0" />
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-brand-600 transition-colors">
                          {suggested.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                          {suggested.author}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 w-full px-4 py-3 bg-white/95 dark:bg-[#161616]/95 backdrop-blur-md border-t border-slate-100 dark:border-white/10 flex items-center gap-2">
            <button
              onClick={onRead}
              className="flex-1 min-w-0 h-10 sm:h-11 bg-brand-600 hover:bg-brand-700 text-white px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-brand-200 cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">{book.readProgress ? 'Continue Reading' : 'Start Reading'}</span>
            </button>
            {book.fileUrl && (
              <button
                onClick={handleDownload}
                disabled={isDownloading || downloadComplete}
                className={`h-10 sm:h-11 px-3 sm:px-3.5 shrink-0 ${downloadComplete ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-800 hover:bg-slate-900'} text-white rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-all disabled:opacity-90 cursor-pointer whitespace-nowrap`}
                title="Download File"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Saving...</span>
                  </>
                ) : downloadComplete ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Download</span>
                  </>
                )}
              </button>
            )}
            {onListen && (
              <button
                type="button"
                onClick={onListen}
                className="h-10 sm:h-11 px-3 shrink-0 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                title="Listen as AI Audiobook"
                aria-label="Listen as AI Audiobook"
              >
                <Headphones className="w-4 h-4 shrink-0" />
                <span>Listen</span>
              </button>
            )}
            <button
              onClick={onDiscuss}
              className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center justify-center transition-colors cursor-pointer"
              title="Discuss with Sage AI"
              aria-label="Discuss with Sage AI"
            >
              <MessageSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
