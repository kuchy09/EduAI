import { Book, Bookmark, Highlight } from '../types';
import { ChevronLeft, List, Settings, MessageSquareText, Search, BookmarkPlus, Bookmark as BookmarkIcon, ExternalLink, FileText, ChevronRight, Highlighter, Trash2, X, CheckCircle2, Loader2, Download as DownloadIcon, Clock, Sun, Type, Copy, BookOpen, Share, Sparkles, WifiOff, Wifi, CloudDownload, HardDriveDownload, Headphones, Quote as QuoteIcon, Image as ImageIcon, SpellCheck } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { logReadingProgress } from '../lib/readingGoal';
import { useOffline } from '../lib/useOffline';
import {
  getCachedBookBlobUrl,
  queueOfflineAction,
  saveReadingProgressLocal,
  getReadingProgressLocal,
  saveBookContentLocal,
  saveHighlightLocal,
  getHighlightsLocal,
  deleteHighlightLocal,
  saveBookmarkLocal
} from '../lib/offlineManager';
import { triggerCapsuleFeedback } from '../lib/feedback';
import { QuoteCardModal } from './QuoteCardModal';
import { QuickDictionaryPopover } from './QuickDictionaryPopover';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function DownloadFallback({ book }: { book: Book }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);

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
    <button onClick={handleDownload} disabled={isDownloading || downloadComplete} className="mt-4 px-4 py-2 bg-stone-200 text-stone-800 rounded-lg hover:bg-stone-300 transition-colors inline-block text-sm flex items-center justify-center gap-2">
      {isDownloading ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> downloading...</>
      ) : downloadComplete ? (
        <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Downloaded</>
      ) : (
        <><DownloadIcon className="w-4 h-4" /> Download File</>
      )}
    </button>
  );
}

interface ReaderProps {
  book: Book;
  onClose: () => void;
  onOpenAi: () => void;
  onAddBookmark: (bookmark: Bookmark) => void;
  bookmarks: Bookmark[];
  user?: any;
  onUpdateProgress?: (bookId: string, progress: number) => void;
}

export function Reader({ book, onClose, onOpenAi, onAddBookmark, bookmarks, user, onUpdateProgress }: ReaderProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Bookmark saved');
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  // Offline Engine & Cached Blob State
  const { isOnline, isBookCached, downloadBook, isDownloading, downloadProgress } = useOffline();
  const [cachedBlobUrl, setCachedBlobUrl] = useState<string | null>(null);
  const [isCachedLocally, setIsCachedLocally] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    let createdUrl: string | null = null;

    async function loadOfflineDocument() {
      try {
        const cachedUrl = await getCachedBookBlobUrl(book.id);
        if (cachedUrl && isMounted) {
          createdUrl = cachedUrl;
          setCachedBlobUrl(cachedUrl);
          setIsCachedLocally(true);
        } else if (isMounted) {
          setIsCachedLocally(false);
        }
      } catch (err) {
        console.warn('[Reader] Failed to check offline document blob:', err);
      }
    }

    loadOfflineDocument();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [book.id]);

  // Highlighting and Sidebar states
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectionRange, setSelectionRange] = useState<{ x: number; y: number; text: string } | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chapters' | 'bookmarks' | 'highlights' | 'settings'>('highlights');

  // Shareable Quote Card Overlay State
  const [quoteCardModalOpen, setQuoteCardModalOpen] = useState(false);
  const [activeQuoteForCard, setActiveQuoteForCard] = useState<{ text: string; pageNumber?: number }>({ text: '' });

  // Quick Dictionary Popover State
  const [dictionaryTarget, setDictionaryTarget] = useState<{
    word: string;
    x: number;
    y: number;
    contextSentence?: string;
  } | null>(null);

  const handleOpenDictionary = (wordToDefine: string, x: number, y: number, contextSentence?: string) => {
    triggerCapsuleFeedback({ pitch: 620, volume: 0.16, hapticDuration: 12 });
    setSelectionRange(null);
    setDictionaryTarget({
      word: wordToDefine.trim(),
      x,
      y,
      contextSentence
    });
  };

  const handleOpenQuoteCard = (text: string, pageNum?: number) => {
    triggerCapsuleFeedback({ pitch: 580, volume: 0.18, hapticDuration: 14 });
    setActiveQuoteForCard({
      text: text.trim(),
      pageNumber: pageNum || (book.fileUrl ? pageNumber : undefined)
    });
    setSelectionRange(null);
    setQuoteCardModalOpen(true);
  };

  // Reader styling states
  const getInitialFontSize = () => {
    const globalFontSize = localStorage.getItem('fontSize');
    if (globalFontSize === 'Small') return 'sm';
    if (globalFontSize === 'Large') return 'xl';
    return 'lg';
  };
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>(getInitialFontSize());

  useEffect(() => {
    if (fontSize === 'sm') localStorage.setItem('fontSize', 'Small');
    else if (fontSize === 'xl') localStorage.setItem('fontSize', 'Large');
    else localStorage.setItem('fontSize', 'Medium');
  }, [fontSize]);
  const [theme, setTheme] = useState<'sepia' | 'dark' | 'amoled'>('sepia');
  const [viewMode, setViewMode] = useState<'slide' | 'scroll'>('slide');
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [showHighlights, setShowHighlights] = useState(true);
  const [readerMode, setReaderMode] = useState<'read' | 'listen'>('read');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleListen = () => {
    if (readerMode === 'read') {
      setReaderMode('listen');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const textToRead = `${book.title}. Chapter 1: The Foundations. ${book.description || 'Welcome to your reading session.'}`;
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
      }
    } else {
      setReaderMode('read');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    }
  };

  const handleCycleTheme = () => {
    if (theme === 'sepia') setTheme('dark');
    else if (theme === 'dark') setTheme('amoled');
    else setTheme('sepia');
  };

  const settingsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node)) {
        setShowSettingsDropdown(false);
      }
    };
    if (showSettingsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettingsDropdown]);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [readingProgress, setReadingProgress] = useState<number>(() => {
    const saved = localStorage.getItem(`book_progress_${book.id}`);
    return saved ? parseInt(saved, 10) : 0;
  });

  // Auto-cache book metadata & content in IndexedDB
  useEffect(() => {
    saveBookContentLocal(book.id, {
      title: book.title,
      author: book.author,
      category: book.category,
      keyConcepts: book.aiInsights,
      summary: book.description,
      chapters: [
        {
          chapterNumber: 1,
          title: 'Chapter 1: The Foundations',
          content: `The principles of ${book.category} explored in ${book.title} represent a cornerstone of modern educational frameworks.`
        }
      ]
    });
  }, [book]);

  // Load progress and last read page from IndexedDB
  useEffect(() => {
    let isMounted = true;
    async function loadSavedProgress() {
      try {
        const record = await getReadingProgressLocal(book.id);
        if (record && isMounted) {
          if (typeof record.progress === 'number' && record.progress > 0) {
            setReadingProgress(record.progress);
          }
          if (typeof record.currentPage === 'number' && record.currentPage > 1) {
            setPageNumber(record.currentPage);
          }
        }
      } catch (e) {
        console.warn('[Reader] Failed to load progress from IndexedDB:', e);
      }
    }
    loadSavedProgress();
    return () => {
      isMounted = false;
    };
  }, [book.id]);

  useEffect(() => {
    if (book.fileUrl && numPages) {
      const currentProgress = Math.min(100, Math.round((pageNumber / numPages) * 100));
      if (currentProgress !== readingProgress) {
        setReadingProgress(currentProgress);
        saveReadingProgressLocal(book.id, currentProgress, pageNumber, numPages);
        const timer = setTimeout(() => {
          onUpdateProgress?.(book.id, currentProgress);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [pageNumber, numPages, book.id, book.fileUrl, onUpdateProgress, readingProgress]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || book.fileUrl) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight === clientHeight) return;
      const pct = Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100));
      setReadingProgress(prev => {
        if (pct !== prev) {
          setTimeout(() => {
            saveReadingProgressLocal(book.id, pct, undefined, undefined, pct);
            onUpdateProgress?.(book.id, pct);
          }, 0);
          return pct;
        }
        return prev;
      });
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [book.id, book.fileUrl, theme, onUpdateProgress]);

  // Track Daily Reading Goal time and pages
  const prevPageRef = useRef<number>(pageNumber);
  useEffect(() => {
    if (pageNumber !== prevPageRef.current) {
      const pageDelta = Math.abs(pageNumber - prevPageRef.current);
      prevPageRef.current = pageNumber;
      if (pageDelta > 0 && pageDelta <= 5) {
        logReadingProgress({ pages: pageDelta });
      }
    }
  }, [pageNumber]);

  useEffect(() => {
    // Record 1 minute every 60 seconds while reader is open and active
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        logReadingProgress({ minutes: 1 });
      }
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Load highlights from IndexedDB and cloud database
  useEffect(() => {
    let active = true;
    
    // Always try to load from IndexedDB and localStorage first for instant offline reading
    async function loadOfflineHighlights() {
      try {
        const idbHighlights = await getHighlightsLocal(book.id);
        if (idbHighlights && idbHighlights.length > 0 && active) {
          setHighlights(idbHighlights);
          return;
        }
      } catch {
        // Fallback below
      }

      const localHighlightsKey = `highlights_${book.id}_${user?.id || 'guest'}`;
      const localHighlights = localStorage.getItem(localHighlightsKey);
      if (localHighlights && active) {
        try {
          setHighlights(JSON.parse(localHighlights));
        } catch (e) {
          console.error('Failed to parse local highlights', e);
        }
      }
    }
    loadOfflineHighlights();

    async function fetchHighlights() {
      if (!supabase || !user) return;
      try {
        const { data, error } = await supabase
          .from('highlights')
          .select('*')
          .eq('book_id', book.id)
          .eq('user_id', user.id);
          
        if (error) {
          return;
        }
        
        if (data && active && data.length > 0) {
          const loadedHighlights: Highlight[] = data.map((item: any) => ({
            id: item.id,
            bookId: item.book_id,
            userId: item.user_id,
            text: item.text,
            pageNumber: item.page_number || undefined,
            color: item.color,
            createdAt: item.created_at
          }));
          setHighlights(loadedHighlights);
          const localHighlightsKey = `highlights_${book.id}_${user?.id || 'guest'}`;
          localStorage.setItem(localHighlightsKey, JSON.stringify(loadedHighlights));
          // Save to IndexedDB
          loadedHighlights.forEach(hl => saveHighlightLocal(hl));
        }
      } catch (err) {
        // Suppress network errors
      }
    }
    fetchHighlights();
    return () => {
      active = false;
    };
  }, [book.id, user]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setPageNumber((prev) => Math.max(prev - 1, 1));
      } else if (e.key === 'ArrowRight') {
        setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages]);

  const handleBookmark = () => {
    const newBookmark: Bookmark = {
      id: Date.now().toString(),
      bookId: book.id,
      bookTitle: book.title,
      chapter: 'Chapter 1: The Foundations',
      textSnippet: `This text from ${book.title} represents a core foundation of ${book.category} studies.`,
      timestamp: Date.now(),
    };
    onAddBookmark(newBookmark);
    saveBookmarkLocal(newBookmark);
    
    if (!navigator.onLine) {
      queueOfflineAction('bookmark', {
        id: newBookmark.id,
        book_id: book.id,
        user_id: user?.id || 'guest',
        chapter: newBookmark.chapter,
        text_snippet: newBookmark.textSnippet,
        created_at: new Date().toISOString()
      });
    }

    setToastMessage(!navigator.onLine ? 'Bookmark saved locally (IndexedDB Offline)' : 'Bookmark saved');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const isBookmarked = bookmarks.some(b => b.chapter === 'Chapter 1: The Foundations');

  // Save new highlight to IndexedDB, DB & Local State
  const addHighlight = async (selectedText: string, color: string) => {
    const tempId = crypto.randomUUID();
    const newHighlightObj: Highlight = {
      id: tempId,
      bookId: book.id,
      userId: user?.id || 'guest',
      text: selectedText,
      pageNumber: book.fileUrl ? pageNumber : undefined,
      color: color,
      createdAt: new Date().toISOString()
    };

    // Optimistically add to local state
    const updatedHighlights = [...highlights, newHighlightObj];
    setHighlights(updatedHighlights);
    
    // Save to IndexedDB and localStorage
    saveHighlightLocal(newHighlightObj);
    const localHighlightsKey = `highlights_${book.id}_${user?.id || 'guest'}`;
    localStorage.setItem(localHighlightsKey, JSON.stringify(updatedHighlights));

    if (!navigator.onLine) {
      queueOfflineAction('highlight', {
        id: tempId,
        book_id: book.id,
        user_id: user?.id || 'guest',
        text: selectedText,
        page_number: book.fileUrl ? pageNumber : null,
        color: color,
        created_at: newHighlightObj.createdAt
      });
    }

    setToastMessage(!navigator.onLine ? 'Highlighted & saved to local cache' : 'Passage highlighted!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);

    // Save to database
    if (supabase && user && navigator.onLine) {
      try {
        const { error } = await supabase.from('highlights').insert([{
          id: tempId,
          book_id: book.id,
          user_id: user.id,
          text: selectedText,
          page_number: book.fileUrl ? pageNumber : null,
          color: color,
          created_at: newHighlightObj.createdAt
        }]);
        if (error) {
          console.error('Database highlight save error:', error.message);
        }
      } catch (err) {
        console.error('Supabase exception while saving highlight:', err);
      }
    }
  };

  // Delete highlight from DB & Local State
  const deleteHighlight = async (id: string) => {
    const updatedHighlights = highlights.filter(h => h.id !== id);
    setHighlights(updatedHighlights);
    
    deleteHighlightLocal(id, book.id);
    const localHighlightsKey = `highlights_${book.id}_${user?.id || 'guest'}`;
    localStorage.setItem(localHighlightsKey, JSON.stringify(updatedHighlights));
    
    if (supabase && user) {
      try {
        const { error } = await supabase
          .from('highlights')
          .delete()
          .eq('id', id);
        if (error) {
          console.error('Database highlight delete error:', error.message);
        }
      } catch (err) {
        console.error('Supabase exception while deleting highlight:', err);
      }
    }
  };

  // Long-press and word selection detection
  const touchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getWordAtPoint = (x: number, y: number): string | null => {
    try {
      let range: Range | null = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(x, y);
      } else if ((document as any).caretPositionFromPoint) {
        const pos = (document as any).caretPositionFromPoint(x, y);
        if (pos && pos.offsetNode) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.setEnd(pos.offsetNode, pos.offset);
        }
      }

      if (range && range.startContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
        const text = range.startContainer.textContent || '';
        const offset = range.startOffset;
        let start = offset;
        while (start > 0 && /[\w\-]/.test(text.charAt(start - 1))) {
          start--;
        }
        let end = offset;
        while (end < text.length && /[\w\-]/.test(text.charAt(end))) {
          end++;
        }
        const word = text.slice(start, end).trim();
        if (word.length >= 2) {
          return word;
        }
      }
    } catch (e) {
      // Ignored
    }
    return null;
  };

  // Handle selection capture
  const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();
    if (text.length > 0) {
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setSelectionRange({
          x: rect.left + rect.width / 2,
          y: rect.top - 54, // Position above selection
          text: text
        });
      } catch (err) {
        const clientX = 'clientX' in e ? e.clientX : (e.changedTouches?.[0]?.clientX || window.innerWidth / 2);
        const clientY = 'clientY' in e ? e.clientY : (e.changedTouches?.[0]?.clientY || 100);
        setSelectionRange({
          x: clientX,
          y: clientY - 54,
          text: text
        });
      }
    } else {
      setSelectionRange(null);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      const sel = window.getSelection();
      const selText = sel ? sel.toString().trim() : '';
      const word = selText || getWordAtPoint(touch.clientX, touch.clientY);
      if (word && word.length >= 2 && !word.includes('\n')) {
        handleOpenDictionary(word, touch.clientX, touch.clientY);
      }
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dist = Math.hypot(touch.clientX - touchStartPosRef.current.x, touch.clientY - touchStartPosRef.current.y);
    if (dist > 12) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    handleMouseUp(e);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      const sel = window.getSelection();
      const selText = sel ? sel.toString().trim() : '';
      const word = selText || getWordAtPoint(e.clientX, e.clientY);
      if (word && word.length >= 2 && !word.includes('\n')) {
        handleOpenDictionary(word, e.clientX, e.clientY);
      }
    }, 500);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!touchStartPosRef.current) return;
    const dist = Math.hypot(e.clientX - touchStartPosRef.current.x, e.clientY - touchStartPosRef.current.y);
    if (dist > 12) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const sel = window.getSelection();
    const selText = sel ? sel.toString().trim() : '';
    const word = selText || getWordAtPoint(e.clientX, e.clientY);
    if (word && word.length >= 2 && !word.includes('\n')) {
      handleOpenDictionary(word, e.clientX, e.clientY);
    }
  };

  // Custom text renderer to inject inline highlights (case-insensitive highlight matching)
  const renderTextWithHighlights = (rawText: string) => {
    if (!highlights || highlights.length === 0) return <>{rawText}</>;

    // Filter highlights occurring in this specific string block
    const matches = highlights.filter(h => rawText.toLowerCase().includes(h.text.toLowerCase()));
    if (matches.length === 0) return <>{rawText}</>;

    // Sort descending by text length
    const sortedMatches = [...matches].sort((a, b) => b.text.length - a.text.length);

    interface Token {
      text: string;
      highlight?: Highlight;
    }

    let tokens: Token[] = [{ text: rawText }];

    for (const h of sortedMatches) {
      const nextTokens: Token[] = [];
      for (const token of tokens) {
        if (token.highlight) {
          nextTokens.push(token);
          continue;
        }

        const escaped = h.text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        const splits = token.text.split(regex);

        if (splits.length > 1) {
          for (const part of splits) {
            if (part === '') continue;
            if (part.toLowerCase() === h.text.toLowerCase()) {
              nextTokens.push({ text: part, highlight: h });
            } else {
              nextTokens.push({ text: part });
            }
          }
        } else {
          nextTokens.push(token);
        }
      }
      tokens = nextTokens;
    }

    return (
      <>
        {tokens.map((token, idx) => {
          if (token.highlight) {
            const colors: Record<string, string> = {
              yellow: 'bg-yellow-200/95 text-stone-900 border-b-2 border-yellow-300',
              green: 'bg-emerald-100 text-stone-900 border-b-2 border-emerald-300',
              blue: 'bg-sky-100 text-stone-900 border-b-2 border-sky-300',
              pink: 'bg-pink-100 text-stone-900 border-b-2 border-pink-300'
            };
            const colClass = colors[token.highlight.color] || 'bg-yellow-200/95';
            return (
              <span
                key={idx}
                title="Highlighted text. Click to delete."
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Do you want to delete this highlight?')) {
                    deleteHighlight(token.highlight!.id);
                  }
                }}
                className={`px-0.5 rounded-sm cursor-pointer transition-all duration-200 hover:brightness-95 ${colClass}`}
              >
                {token.text}
              </span>
            );
          }
          return <span key={idx}>{token.text}</span>;
        })}
      </>
    );
  };

  const fontSizeClasses = {
    sm: 'text-sm leading-relaxed',
    base: 'text-base leading-relaxed',
    lg: 'text-lg md:text-xl leading-relaxed',
    xl: 'text-xl md:text-2xl leading-relaxed font-medium font-serif'
  };

  const themeClasses: Record<string, string> = {
    sepia: 'bg-[#F4ECD8] text-[#2C2925]',
    dark: 'bg-[#1C1C1E] text-[#D1D1D6]',
    amoled: 'bg-black text-[#E5E5EA]'
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${fontFamily === 'serif' ? 'font-serif' : 'font-sans'} ${themeClasses[theme]} transition-colors duration-250`}>
      {/* Reader Header */}
      <header className={`h-16 backdrop-blur-2xl backdrop-saturate-150 border-b flex items-center justify-between px-4 sticky top-0 shrink-0 font-sans z-30 transition-colors duration-250 ${
        theme === 'dark' ? 'bg-[#1C1C1E]/80 border-[#2C2C2E]/80 text-[#D1D1D6]' : 
        theme === 'amoled' ? 'bg-black/80 border-stone-800 text-[#E5E5EA]' :
        'bg-[#F4ECD8]/85 border-stone-300/60 text-[#2C2925]'
      }`}>
      
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-semibold truncate max-w-[150px] md:max-w-md opacity-95">{book.title}</h1>
            <p className="text-[11px] opacity-60">
              {numPages ? `Page ${pageNumber} of ${numPages}` : (book.author || 'Academic Reader')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2">
          {/* Offline / Online Status Badge */}
          {!isOnline ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Offline Mode</span>
            </div>
          ) : (
            <button
              onClick={async () => {
                if (isCachedLocally) {
                  setToastMessage('This book is already saved for offline reading.');
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 3000);
                  return;
                }
                try {
                  setToastMessage('Saving book for offline reading...');
                  setShowToast(true);
                  await downloadBook(book);
                  const cachedUrl = await getCachedBookBlobUrl(book.id);
                  if (cachedUrl) {
                    setCachedBlobUrl(cachedUrl);
                    setIsCachedLocally(true);
                  }
                  setToastMessage('Book successfully cached for offline reading!');
                  setTimeout(() => setShowToast(false), 3500);
                } catch (e: any) {
                  setToastMessage('Failed to cache book: ' + (e.message || 'Error'));
                  setTimeout(() => setShowToast(false), 3500);
                }
              }}
              disabled={isDownloading(book.id)}
              className={`p-2 rounded-full transition-colors flex items-center gap-1 cursor-pointer ${
                isCachedLocally 
                  ? 'text-emerald-500 bg-emerald-500/10' 
                  : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={isCachedLocally ? 'Downloaded for offline reading' : 'Save for offline reading'}
            >
              {isDownloading(book.id) ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
              ) : isCachedLocally ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <HardDriveDownload className="w-4 h-4" />
              )}
            </button>
          )}

          <button 
            onClick={handleBookmark}
            className={`p-2 rounded-full transition-colors flex items-center gap-1 cursor-pointer ${isBookmarked ? 'text-indigo-500 bg-indigo-500/10' : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}
            title="Bookmarked"
          >
            {isBookmarked ? <BookmarkIcon className="w-4 h-4 fill-current" /> : <BookmarkPlus className="w-4 h-4" />}
          </button>

          <div className="relative" ref={settingsDropdownRef}>
            <button
              onClick={() => setShowSettingsDropdown(prev => !prev)}
              className="p-2 rounded-full transition-colors opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              title="Reader Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {showSettingsDropdown && (
              <div className={`absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-2xl border backdrop-blur-2xl p-4 flex flex-col gap-4 z-50 animate-in fade-in zoom-in-95 duration-150 ${theme === 'dark' ? 'bg-[#1C1C1E]/95 border-[#2C2C2E] text-white' : theme === 'amoled' ? 'bg-black/95 border-stone-800 text-white' : 'bg-white/95 border-stone-200 text-stone-900'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-60">Reader View</span>
                  <button onClick={() => setShowSettingsDropdown(false)} className="p-1.5 opacity-50 hover:opacity-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {/* View Mode */}
                <div className="flex items-center bg-black/5 dark:bg-white/5 p-1 rounded-xl">
                  <button
                    onClick={() => setViewMode('slide')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${viewMode === 'slide' ? 'bg-white dark:bg-stone-800 shadow-sm' : 'opacity-70'}`}
                  >
                    Slide
                  </button>
                  <button
                    onClick={() => setViewMode('scroll')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${viewMode === 'scroll' ? 'bg-white dark:bg-stone-800 shadow-sm' : 'opacity-70'}`}
                  >
                    Scroll
                  </button>
                </div>

                {/* Theme */}
                <div className="flex items-center bg-black/5 dark:bg-white/5 p-1 rounded-xl">
                  <button onClick={() => setTheme('sepia')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${theme === 'sepia' ? 'bg-white text-stone-900 shadow-sm' : 'opacity-70'}`}>
                    Sepia
                  </button>
                  <button onClick={() => setTheme('dark')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${theme === 'dark' ? 'bg-stone-800 text-white shadow-sm' : 'opacity-70'}`}>
                    Dark
                  </button>
                  <button onClick={() => setTheme('amoled')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${theme === 'amoled' ? 'bg-black text-white shadow-sm' : 'opacity-70'}`}>
                    Amoled
                  </button>
                </div>

                {/* Font Size */}
                <div>
                  <div className="text-xs font-medium opacity-60 mb-2">Text Size</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setFontSize('sm')} className={`flex-1 py-1 text-sm rounded-lg border transition-all cursor-pointer ${fontSize === 'sm' ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-stone-200 dark:border-stone-700'}`}>Aa</button>
                    <button onClick={() => setFontSize('base')} className={`flex-1 py-1 text-base rounded-lg border transition-all cursor-pointer ${fontSize === 'base' ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-stone-200 dark:border-stone-700'}`}>Aa</button>
                    <button onClick={() => setFontSize('lg')} className={`flex-1 py-1 text-lg rounded-lg border transition-all cursor-pointer ${fontSize === 'lg' ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-stone-200 dark:border-stone-700'}`}>Aa</button>
                    <button onClick={() => setFontSize('xl')} className={`flex-1 py-1 text-xl rounded-lg border transition-all cursor-pointer ${fontSize === 'xl' ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-stone-200 dark:border-stone-700'}`}>Aa</button>
                  </div>
                </div>

                {/* Font Style */}
                <div>
                  <div className="text-xs font-medium opacity-60 mb-2">Typography</div>
                  <div className="flex gap-2">
                    <button onClick={() => setFontFamily('serif')} className={`flex-1 py-1.5 text-sm font-serif rounded-lg border transition-all cursor-pointer ${fontFamily === 'serif' ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-stone-200 dark:border-stone-700'}`}>Serif</button>
                    <button onClick={() => setFontFamily('sans')} className={`flex-1 py-1.5 text-sm font-sans rounded-lg border transition-all cursor-pointer ${fontFamily === 'sans' ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-stone-200 dark:border-stone-700'}`}>Sans-Serif</button>
                  </div>
                </div>

                {/* Show Highlights Toggle */}
                <button 
                  onClick={() => setShowHighlights(!showHighlights)} 
                  className="flex items-center justify-between w-full py-2 group cursor-pointer"
                >
                  <span className="text-sm font-medium">Show Highlights</span>
                  <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${showHighlights ? 'bg-brand-500' : 'bg-stone-300 dark:bg-stone-700'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${showHighlights ? 'translate-x-4' : 'translate-x-0'}`}></div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-stone-200 dark:bg-stone-700 mx-1 md:mx-2"></div>
          <button 
            onClick={onOpenAi}
            className="flex items-center gap-2 px-3 py-1.5 liquid-glass-pill text-brand-700 dark:text-brand-300 hover:scale-105 active:scale-95 rounded-full text-sm font-medium transition-all shadow-sm cursor-pointer"
          >
            <MessageSquareText className="w-4 h-4" />
            <span className="hidden md:inline">Ask AI Tutor</span>
          </button>
        </div>
      </header>

      {/* Reader Body and Drawer Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content Area */}
        <main 
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
          className={`flex-1 flex overflow-hidden bg-stone-100 items-center justify-center relative ${showSidebar ? 'mr-0 lg:mr-80' : ''} transition-all duration-300`}
        >
          {book ? (
            <div className="flex-1 h-full overflow-y-auto bg-stone-100 flex justify-center pb-20">
              <Document
                file={
                  cachedBlobUrl ||
                  ((book.fileUrl && book.fileUrl.startsWith('http')) 
                    ? book.fileUrl 
                    : `/api/download?key=${encodeURIComponent(book.fileUrl || book.id)}`)
                }
                onLoadSuccess={onDocumentLoadSuccess}
                onItemClick={({ pageNumber }) => setPageNumber(pageNumber)}
                onLoadError={(error) => {
                  console.warn("Document load error caught gracefully:", error.message);
                }}
                loading={
                  <div className="flex flex-col items-center justify-center p-20 text-stone-500 font-sans">
                    <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    {cachedBlobUrl ? 'Loading offline document...' : 'Loading document...'}
                  </div>
                }
                error={
                  <div className="flex flex-col items-center justify-center p-20 text-red-500 max-w-md text-center font-sans">
                    <FileText className="w-12 h-12 mb-4 opacity-50" />
                    <p>Failed to load PDF. It may be restricted or formatted incorrectly.</p>
                    <DownloadFallback book={book} />
                  </div>
                }
              >
                {viewMode === 'scroll' ? (
                  <div className="flex flex-col items-center gap-8 py-8">
                    {Array.from(new Array(numPages || 0), (el, index) => (
                      <div key={`page_${index + 1}`} className={`relative shadow-xl bg-white transition-all duration-300 ${theme === 'dark' || theme === 'amoled' ? 'invert-[0.92] hue-rotate-180 brightness-95' : ''}`}>
                         <Page 
                            pageNumber={index + 1} 
                            width={Math.min(window.innerWidth - 32, 800)}
                            scale={fontSize === 'sm' ? 0.8 : fontSize === 'base' ? 1.0 : fontSize === 'lg' ? 1.2 : 1.5}
                            renderTextLayer={true}
                            renderAnnotationLayer={showHighlights}
                          />
                      </div>
                    ))}
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={pageNumber}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="relative group inline-block"
                    >
                      <div className={`transition-all duration-300 ${theme === 'dark' || theme === 'amoled' ? 'invert-[0.92] hue-rotate-180 brightness-95' : ''}`}>
                        <Page 
                          pageNumber={pageNumber} 
                          className="my-8 shadow-xl"
                          width={Math.min(window.innerWidth - 32, 800)}
                          scale={fontSize === 'sm' ? 0.8 : fontSize === 'base' ? 1.0 : fontSize === 'lg' ? 1.2 : 1.5}
                          renderTextLayer={true}
                          renderAnnotationLayer={showHighlights}
                        />
                      </div>

                      {/* Page Navigation Arrows Inside the Page */}
                      {pageNumber > 1 && (
                        <button
                          onClick={goToPrevPage}
                          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-700 rounded-full shadow-xl backdrop-blur-sm z-20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-105 active:scale-95"
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="w-7 h-7 text-stone-700 dark:text-stone-300" />
                        </button>
                      )}
                      {pageNumber < (numPages || 1) && (
                        <button
                          onClick={goToNextPage}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-700 rounded-full shadow-xl backdrop-blur-sm z-20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-105 active:scale-95"
                          aria-label="Next page"
                        >
                          <ChevronRight className="w-7 h-7 text-stone-700 dark:text-stone-300" />
                        </button>
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </Document>
              
            </div>
          ) : (
            <div ref={scrollContainerRef} className={`flex-1 overflow-y-auto px-4 py-8 sm:px-6 sm:py-12 lg:py-20 lg:px-20 transition-colors duration-250 ${themeClasses[theme]}`}>
              <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
                <h2 className="text-2xl sm:text-3xl font-display font-bold mb-6 sm:mb-8 font-sans tracking-tight text-stone-900 border-b border-stone-200/40 pb-4">Chapter 1: The Foundations</h2>
                
                <div className={`space-y-6 sm:space-y-8 ${fontSizeClasses[fontSize]}`}>
                  <p className="first-letter:text-5xl md:first-letter:text-6xl first-letter:font-bold first-letter:mr-2 first-letter:float-left first-letter:text-stone-900">
                    {renderTextWithHighlights("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.")}
                  </p>
                  <p>
                    {renderTextWithHighlights("Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.")}
                  </p>
                  
                  <div className={`p-6 md:p-8 rounded-2xl border-l-4 border-brand-500 italic my-8 md:my-10 font-sans shadow-sm ${theme === 'dark' ? 'bg-stone-800 text-stone-200' : 'bg-stone-100/70 text-stone-700'}`}>
                    "{renderTextWithHighlights(`The principles of ${book.category} explored in ${book.title} represent a cornerstone of modern educational frameworks.`)}"
                  </div>

                  <p>
                    {renderTextWithHighlights("Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.")}
                  </p>
                  <p>
                    {renderTextWithHighlights("Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?")}
                  </p>
                  <p>
                    {renderTextWithHighlights("At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio.")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating Liquid Glass Bottom Control Dock & Page Progress Indicator */}
      <div className="fixed bottom-4 sm:bottom-6 inset-x-0 z-40 flex flex-col items-center justify-center pointer-events-none px-4 gap-2">
        {/* Minimalist Page Progress Indicator */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[11px] font-mono tracking-widest px-3 py-1 rounded-full liquid-glass-card text-stone-600 dark:text-stone-300 pointer-events-auto select-none shadow-sm"
        >
          {numPages ? `${pageNumber} of ${numPages}` : `Chapter 1 • 6 of 1049`}
        </motion.div>

        {/* Floating Capsule Bar Dock */}
        <div className="relative pointer-events-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-brand-500/10 via-purple-500/10 to-indigo-500/10 rounded-full blur-lg opacity-60 pointer-events-none" />

          <motion.div 
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="relative flex items-center gap-2 sm:gap-3 px-3 py-1.5 liquid-glass-dock rounded-full select-none"
          >
            {/* Specular rim light */}
            <div className="absolute top-0 inset-x-4 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full" />

            {/* 1. Digital Clock Display inside dark circular/capsule tag */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-900/90 text-stone-100 dark:bg-black/90 dark:text-stone-200 text-xs font-mono font-medium shadow-inner">
              <Clock className="w-3 h-3 text-stone-400" />
              <span>{currentTime}</span>
            </div>

            {/* 2. Mode Selector Segment ("Read" and "Listen") */}
            <div className="flex items-center p-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 relative">
              <button
                onClick={() => {
                  triggerCapsuleFeedback({ pitch: 540, volume: 0.16, hapticDuration: 12 });
                  if (readerMode !== 'read') handleToggleListen();
                }}
                className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer select-none ${
                  readerMode === 'read' ? 'text-brand-700 dark:text-brand-300 font-semibold' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                {readerMode === 'read' && (
                  <motion.div
                    layoutId="activeReaderModePill"
                    className="absolute inset-0 liquid-glass-pill rounded-full"
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  Read
                </span>
              </button>

              <button
                onClick={() => {
                  triggerCapsuleFeedback({ pitch: 620, volume: 0.16, hapticDuration: 12 });
                  if (readerMode !== 'listen') handleToggleListen();
                }}
                className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer select-none ${
                  readerMode === 'listen' ? 'text-brand-700 dark:text-brand-300 font-semibold' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                {readerMode === 'listen' && (
                  <motion.div
                    layoutId="activeReaderModePill"
                    className="absolute inset-0 liquid-glass-pill rounded-full"
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  <Headphones className={`w-3.5 h-3.5 ${isSpeaking ? 'text-brand-500 animate-bounce' : ''}`} />
                  Listen
                </span>
              </button>
            </div>

            {/* 3. Brightness/Theme Quick Button */}
            <button
              onClick={handleCycleTheme}
              className="p-2 rounded-full liquid-glass-card hover:scale-105 active:scale-95 text-stone-700 dark:text-stone-200 transition-all cursor-pointer shadow-sm border border-white/50 dark:border-white/10"
              title={`Theme: ${theme.toUpperCase()} (Click to toggle)`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>

            {/* 4. Typography Controller (Tt Icon) */}
            <button
              onClick={() => setShowSettingsDropdown(prev => !prev)}
              className="p-2 rounded-full liquid-glass-card hover:scale-105 active:scale-95 text-stone-700 dark:text-stone-200 transition-all cursor-pointer shadow-sm border border-white/50 dark:border-white/10 flex items-center justify-center font-serif font-bold text-xs"
              title="Typography & Text Settings"
            >
              <Type className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        </div>
      </div>

      {/* Contextual Text Selection Menu (Liquid Glass Card Overlay) */}
      {selectionRange && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 450, damping: 26 }}
          className="fixed z-50 liquid-glass-dock text-stone-800 dark:text-stone-100 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col font-sans w-60 overflow-hidden border border-white/70 dark:border-white/15"
          style={{
            left: `${selectionRange.x}px`,
            top: `${selectionRange.y}px`,
          }}
        >
          {/* Top specular reflection line */}
          <div className="absolute top-0 inset-x-4 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none" />

          {/* Quick Horizontal Action Row (Top) */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-stone-200/50 dark:border-stone-700/50 bg-white/40 dark:bg-black/20">
            <button 
              onClick={() => {
                setToastMessage('Note added to workspace');
                setShowToast(true);
                setSelectionRange(null);
                setTimeout(() => setShowToast(false), 2500);
              }}
              className="flex flex-col items-center gap-1 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              <FileText className="w-4 h-4 text-stone-600 dark:text-stone-300" />
              <span className="text-[9px] font-medium text-stone-500 dark:text-stone-400">Note</span>
            </button>

            <button 
              onClick={() => {
                handleOpenDictionary(selectionRange.text, selectionRange.x, selectionRange.y);
              }}
              className="flex flex-col items-center gap-1 hover:scale-105 active:scale-95 transition-transform cursor-pointer text-brand-600 dark:text-brand-400"
              title="Quick Dictionary Definition"
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-[9px] font-semibold">Define</span>
            </button>

            <div className="relative group flex flex-col items-center gap-1 hover:scale-105 transition-transform cursor-pointer">
              <div className="w-4.5 h-4.5 rounded-full border-2 border-stone-300 dark:border-stone-600 overflow-hidden relative shadow-sm" title="Highlight">
                <div className="absolute inset-0 bg-gradient-to-tr from-yellow-300 via-pink-400 to-sky-400 animate-pulse"></div>
              </div>
              <span className="text-[9px] font-medium text-stone-500 dark:text-stone-400">Highlight</span>
              <div className="absolute top-11 flex gap-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-2 rounded-full shadow-2xl border border-white/80 dark:border-slate-700 z-50">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { addHighlight(selectionRange.text, 'yellow'); setSelectionRange(null); window.getSelection()?.removeAllRanges(); }}
                  className="w-5 h-5 rounded-full bg-yellow-400 hover:scale-125 transition-transform shadow-inner cursor-pointer"
                  title="Yellow Highlight"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { addHighlight(selectionRange.text, 'green'); setSelectionRange(null); window.getSelection()?.removeAllRanges(); }}
                  className="w-5 h-5 rounded-full bg-emerald-400 hover:scale-125 transition-transform shadow-inner cursor-pointer"
                  title="Green Highlight"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { addHighlight(selectionRange.text, 'pink'); setSelectionRange(null); window.getSelection()?.removeAllRanges(); }}
                  className="w-5 h-5 rounded-full bg-pink-400 hover:scale-125 transition-transform shadow-inner cursor-pointer"
                  title="Pink Highlight"
                />
              </div>
            </div>

            <button 
              onClick={() => {
                handleOpenQuoteCard(selectionRange.text);
              }}
              className="flex flex-col items-center gap-1 hover:scale-105 active:scale-95 transition-transform cursor-pointer text-indigo-600 dark:text-indigo-400"
              title="Generate shareable quote image card"
            >
              <QuoteIcon className="w-4 h-4 fill-current" />
              <span className="text-[9px] font-semibold">Card</span>
            </button>

            <button 
              onClick={() => {
                navigator.clipboard.writeText(selectionRange.text);
                setToastMessage('Text copied to clipboard');
                setShowToast(true);
                setSelectionRange(null);
                setTimeout(() => setShowToast(false), 2000);
              }}
              className="flex flex-col items-center gap-1 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              <Copy className="w-4 h-4 text-stone-600 dark:text-stone-300" />
              <span className="text-[9px] font-medium text-stone-500 dark:text-stone-400">Copy</span>
            </button>
          </div>

          {/* Vertical Feature List (Bottom) */}
          <div className="flex flex-col py-1">
            <button 
              onClick={() => {
                handleOpenDictionary(selectionRange.text, selectionRange.x, selectionRange.y);
              }}
              className="flex items-center justify-between px-4 py-2 hover:bg-brand-50/50 dark:hover:bg-brand-950/40 text-xs sm:text-sm font-semibold text-brand-700 dark:text-brand-300 transition-colors text-left w-full cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>Quick Dictionary</span>
              </div>
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 border border-brand-300/60 dark:border-brand-700/60 group-hover:scale-105 transition-transform">
                Instant
              </span>
            </button>

            <button 
              onClick={() => {
                handleOpenQuoteCard(selectionRange.text);
              }}
              className="flex items-center justify-between px-4 py-2 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 text-xs sm:text-sm font-medium text-indigo-700 dark:text-indigo-300 transition-colors text-left w-full cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <QuoteIcon className="w-3.5 h-3.5 fill-current text-indigo-600 dark:text-indigo-400" />
                <span>Create Quote Card</span>
              </div>
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300/60 dark:border-indigo-700/60 group-hover:scale-105 transition-transform">
                HD
              </span>
            </button>

            <button 
              onClick={() => {
                setSelectionRange(null);
                onOpenAi();
              }}
              className="flex items-center gap-2.5 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-200 transition-colors text-left w-full cursor-pointer"
            >
              <span className="text-stone-400 text-xs font-serif italic">A文</span>
              Translate
            </button>
            <button 
              onClick={() => {
                handleOpenQuoteCard(selectionRange.text);
              }}
              className="flex items-center gap-2.5 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-200 transition-colors text-left w-full cursor-pointer"
            >
              <Share className="w-3.5 h-3.5 text-stone-400" />
              Share Quote
            </button>
          </div>
          
          {/* Edu AI Assistant Premium Portal */}
          <div className="border-t border-stone-200/60 dark:border-stone-700/60 bg-gradient-to-r from-brand-500/10 via-purple-500/10 to-indigo-500/10 p-1.5">
            <button 
              onClick={() => { setSelectionRange(null); onOpenAi(); }}
              className="flex items-center justify-between w-full px-3 py-2 liquid-glass-pill hover:scale-[1.02] active:scale-95 rounded-2xl transition-all cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
                <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 animate-pulse" />
                Edu AI Assistant
              </div>
              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/30">Ask</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Quick Dictionary Popover Overlay */}
      {dictionaryTarget && (
        <QuickDictionaryPopover
          word={dictionaryTarget.word}
          contextSentence={dictionaryTarget.contextSentence}
          position={{ x: dictionaryTarget.x, y: dictionaryTarget.y }}
          theme={theme}
          bookTitle={book.title}
          onClose={() => setDictionaryTarget(null)}
          onAskAi={(prompt) => {
            localStorage.setItem('ai_tutor_prefill', prompt);
            setDictionaryTarget(null);
            onOpenAi();
          }}
          onSaveToVocabulary={(entry) => {
            setToastMessage(`"${entry.word}" saved to Vocabulary flashcards`);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2500);
          }}
        />
      )}

      {/* Toast Notification Alert */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 liquid-glass-dock text-stone-900 dark:text-white px-4 py-2.5 rounded-full text-xs font-semibold shadow-2xl tracking-wide flex items-center gap-2 font-sans z-50 animate-in fade-in slide-in-from-bottom-4 border border-white/60 dark:border-white/10">
          <Highlighter className="w-4 h-4 text-brand-500 dark:text-brand-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Shareable Quote Card Generator Modal Overlay */}
      <QuoteCardModal
        isOpen={quoteCardModalOpen}
        onClose={() => setQuoteCardModalOpen(false)}
        quote={activeQuoteForCard.text}
        bookTitle={book.title}
        bookAuthor={book.author || ''}
        category={book.category}
        pageNumber={activeQuoteForCard.pageNumber}
      />
    </div>
  );
}
