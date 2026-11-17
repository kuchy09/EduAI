import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Book as BookIcon, Map, FileQuestion,
  Headphones, ShoppingBag, X, CheckCircle2, Sparkles, ArrowRight,
  BookmarkCheck, Compass, HelpCircle, HardDriveDownload, TrendingUp,
  Mic, MicOff
} from 'lucide-react';
import { Book, ViewState } from '../types';
import { platformBookStoreCatalog } from '../data';
import {
  GLOBAL_BOOK_COVERS_EVENT,
  applyGlobalCoversToBooks,
} from '../lib/globalBookCoversService';
import { useOffline } from '../lib/useOffline';
import { getRelatedSearchSuggestions } from '../lib/searchSuggestions';
import { triggerCapsuleFeedback } from '../lib/feedback';
import { safeStorage } from '../lib/safeStorage';
import {
  extractUserAcademicProfile,
  getPersonalizedBooks,
  getAiRecommendedBooks,
  ACADEMIC_PREFS_EVENT,
} from '../lib/bookPersonalization';

export type SearchTabFilter = 'all' | 'library' | 'store' | 'related' | 'audiobooks' | 'paths' | 'quizzes';

interface HomeSearchBarProps {
  books: Book[];
  user?: any;
  profile?: any;
  onBookSelect: (book: Book) => void;
  onNavigate: (view: ViewState) => void;
  onAddBookToLibrary?: (book: Book) => void;
}

export function HomeSearchBar({
  books,
  user,
  profile,
  onBookSelect,
  onNavigate,
  onAddBookToLibrary,
}: HomeSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchTabFilter>('all');
  const [addedBookIds, setAddedBookIds] = useState<Set<string>>(new Set());
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { cachedBookIds } = useOffline();

  // Voice Search / Web SpeechRecognition API State
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const voiceNoticeTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      if (voiceNoticeTimeoutRef.current) {
        clearTimeout(voiceNoticeTimeoutRef.current);
      }
    };
  }, []);

  const [prefsTick, setPrefsTick] = useState(0);
  useEffect(() => {
    const refreshPrefs = () => setPrefsTick((t) => t + 1);
    window.addEventListener(ACADEMIC_PREFS_EVENT, refreshPrefs);
    window.addEventListener(GLOBAL_BOOK_COVERS_EVENT, refreshPrefs);
    return () => {
      window.removeEventListener(ACADEMIC_PREFS_EVENT, refreshPrefs);
      window.removeEventListener(GLOBAL_BOOK_COVERS_EVENT, refreshPrefs);
    };
  }, []);

  const academicProfile = useMemo(
    () => extractUserAcademicProfile(profile, user),
    [profile, user, prefsTick]
  );

  const resolvedStoreCatalog = useMemo(
    () => applyGlobalCoversToBooks(platformBookStoreCatalog),
    [prefsTick]
  );

  const personalizedLibraryBooks = useMemo(
    () => getPersonalizedBooks(books, academicProfile),
    [books, academicProfile]
  );

  const personalizedStoreCatalog = useMemo(
    () => getPersonalizedBooks(resolvedStoreCatalog, academicProfile),
    [resolvedStoreCatalog, academicProfile]
  );

  const aiSearchRecommendations = useMemo(
    () => getAiRecommendedBooks([...books, ...resolvedStoreCatalog], academicProfile, 4),
    [books, resolvedStoreCatalog, academicProfile]
  );

  const primaryTrack =
    academicProfile.curriculum ||
    academicProfile.fieldOfStudy ||
    academicProfile.educationLevel ||
    'General Studies';
  const primarySubject = academicProfile.subjects[0] || primaryTrack;
  const secondarySubject = academicProfile.subjects[1] || 'Core Concepts';

  const learningPaths = useMemo(() => [
    { id: 'path-1', title: `Foundations of ${primaryTrack}`, category: 'Path' },
    { id: 'path-2', title: `Mastery Track: ${primarySubject}`, category: 'Path' },
    { id: 'path-3', title: `Applied Practice in ${secondarySubject}`, category: 'Path' },
    {
      id: 'path-4',
      title: academicProfile.country
        ? `${academicProfile.country} ${primaryTrack} Pathway`
        : `${primaryTrack} Exam Readiness`,
      category: 'Path',
    },
  ], [primaryTrack, primarySubject, secondarySubject, academicProfile.country]);

  const quizzes = useMemo(() => [
    { id: 'quiz-1', title: `${primarySubject}: Chapter 1 Review`, topic: primarySubject },
    { id: 'quiz-2', title: `${secondarySubject} Diagnostic Quiz`, topic: secondarySubject },
    { id: 'quiz-3', title: 'Problem Solving & Critical Thinking', topic: 'General' },
    { id: 'quiz-4', title: `${primaryTrack} Assessment`, topic: primaryTrack },
  ], [primaryTrack, primarySubject, secondarySubject]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(event.target as Node);
      const isOutsideDropdown = !dropdownRef.current || !dropdownRef.current.contains(event.target as Node);

      if (isOutsideContainer && isOutsideDropdown) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLow = query.toLowerCase().trim();

  const { directLibraryBooks, directStoreBooks, relatedBooks } = useMemo(() => {
    if (!searchLow) {
      return { directLibraryBooks: [], directStoreBooks: [], relatedBooks: [] };
    }

    const libraryIds = new Set(books.map(b => b.id));
    const personalizedIds = new Set([
      ...personalizedLibraryBooks.map(b => b.id),
      ...personalizedStoreCatalog.map(b => b.id),
    ]);

    const libMatches = books
      .filter(b => {
        const titleMatch = b.title.toLowerCase().includes(searchLow);
        const authorMatch = b.author.toLowerCase().includes(searchLow);
        const curriculumMatch = b.curriculum?.some(c => c.toLowerCase().includes(searchLow)) || false;
        const subjectsMatch = b.subjects?.some(s => s.toLowerCase().includes(searchLow)) || false;
        const categoryMatch = b.category.toLowerCase().includes(searchLow);
        const descMatch = b.description.toLowerCase().includes(searchLow);
        return titleMatch || authorMatch || curriculumMatch || subjectsMatch || categoryMatch || descMatch;
      })
      .sort((a, b) => Number(personalizedIds.has(b.id)) - Number(personalizedIds.has(a.id)));

    const storeMatches = resolvedStoreCatalog
      .filter(b => {
        if (libraryIds.has(b.id)) return false;
        const titleMatch = b.title.toLowerCase().includes(searchLow);
        const authorMatch = b.author.toLowerCase().includes(searchLow);
        const curriculumMatch = b.curriculum?.some(c => c.toLowerCase().includes(searchLow)) || false;
        const subjectsMatch = b.subjects?.some(s => s.toLowerCase().includes(searchLow)) || false;
        const categoryMatch = b.category.toLowerCase().includes(searchLow);
        const descMatch = b.description.toLowerCase().includes(searchLow);
        return titleMatch || authorMatch || curriculumMatch || subjectsMatch || categoryMatch || descMatch;
      })
      .sort((a, b) => Number(personalizedIds.has(b.id)) - Number(personalizedIds.has(a.id)));

    const matchedCategories = new Set<string>();
    const matchedSubjects = new Set<string>();

    [...libMatches, ...storeMatches].forEach(b => {
      matchedCategories.add(b.category.toLowerCase());
      b.subjects?.forEach(s => matchedSubjects.add(s.toLowerCase()));
    });

    const directIds = new Set([...libMatches.map(b => b.id), ...storeMatches.map(b => b.id)]);

    const allPlatformBooks = [
      ...personalizedLibraryBooks,
      ...personalizedStoreCatalog.filter(b => !libraryIds.has(b.id)),
    ];

    const related: { book: Book; reason: string; inLibrary: boolean }[] = [];
    const seenRelatedIds = new Set<string>();

    allPlatformBooks.forEach(b => {
      if (directIds.has(b.id) || seenRelatedIds.has(b.id)) return;

      const hasCategoryRelation = matchedCategories.has(b.category.toLowerCase()) && matchedCategories.size > 0;
      const matchingSubject = b.subjects?.find(s => matchedSubjects.has(s.toLowerCase()));
      const queryInSubject = b.subjects?.some(s => s.toLowerCase().includes(searchLow));
      const queryInCategory = b.category.toLowerCase().includes(searchLow);

      if (matchingSubject) {
        related.push({
          book: b,
          reason: `Related subject: ${matchingSubject}`,
          inLibrary: libraryIds.has(b.id)
        });
        seenRelatedIds.add(b.id);
      } else if (hasCategoryRelation) {
        related.push({
          book: b,
          reason: `Related category: ${b.category}`,
          inLibrary: libraryIds.has(b.id)
        });
        seenRelatedIds.add(b.id);
      } else if (queryInSubject || queryInCategory) {
        related.push({
          book: b,
          reason: `Related domain: ${b.category}`,
          inLibrary: libraryIds.has(b.id)
        });
        seenRelatedIds.add(b.id);
      }
    });

    return {
      directLibraryBooks: libMatches,
      directStoreBooks: storeMatches,
      relatedBooks: related.slice(0, 4)
    };
  }, [books, searchLow, personalizedLibraryBooks, personalizedStoreCatalog]);

  const filteredPaths = useMemo(() => {
    if (!searchLow) return [];
    return learningPaths.filter(p => p.title.toLowerCase().includes(searchLow));
  }, [learningPaths, searchLow]);

  const filteredQuizzes = useMemo(() => {
    if (!searchLow) return [];
    return quizzes.filter(q => q.title.toLowerCase().includes(searchLow) || q.topic.toLowerCase().includes(searchLow));
  }, [quizzes, searchLow]);

  const relatedSuggestions = useMemo(() => {
    return getRelatedSearchSuggestions(query, books);
  }, [query, books]);

  const showDropdown = isFocused;

  useLayoutEffect(() => {
    function updatePosition() {
      if (showDropdown && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isMobile = window.innerWidth < 640;

        if (isMobile) {
          setDropdownStyle({
            position: 'fixed',
            top: Math.max(rect.bottom + 6, 12),
            left: 12,
            right: 12,
            width: 'calc(100vw - 24px)',
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: `calc(100vh - ${Math.min(Math.max(rect.bottom + 24, 90), window.innerHeight - 100)}px)`,
            zIndex: 90
          });
        } else {
          setDropdownStyle({
            position: 'fixed',
            top: Math.max(rect.bottom + 8, 12),
            left: rect.left,
            width: Math.max(rect.width, 460),
            maxWidth: `calc(100vw - ${rect.left + 24}px)`,
            maxHeight: '460px',
            zIndex: 90
          });
        }
      }
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showDropdown]);

  const totalBooksCount = directLibraryBooks.length + directStoreBooks.length;
  const hasResults = totalBooksCount > 0 || relatedBooks.length > 0 || filteredPaths.length > 0 || filteredQuizzes.length > 0;

  const showLibrarySection = (searchFilter === 'all' || searchFilter === 'library') && directLibraryBooks.length > 0;
  const showStoreSection = (searchFilter === 'all' || searchFilter === 'store') && directStoreBooks.length > 0;
  const showRelatedSection = (searchFilter === 'all' || searchFilter === 'related') && relatedBooks.length > 0;
  const showAudiobooksSection = (searchFilter === 'all' || searchFilter === 'audiobooks') && directLibraryBooks.length > 0;
  const showPathsSection = (searchFilter === 'all' || searchFilter === 'paths') && filteredPaths.length > 0;
  const showQuizzesSection = (searchFilter === 'all' || searchFilter === 'quizzes') && filteredQuizzes.length > 0;

  const handleAddStoreBook = (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    onAddBookToLibrary?.(book);
    setAddedBookIds(prev => new Set(prev).add(book.id));
  };

  const handleAskAiAboutTopic = () => {
    safeStorage.setItem('ai_tutor_prefill', `Can you provide a comprehensive summary, key chapter concepts, and study guide questions for "${query}"?`);
    onNavigate('ai-tutor');
    setIsFocused(false);
    setQuery('');
  };

  const handleToggleVoiceSearch = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (voiceNoticeTimeoutRef.current) {
      clearTimeout(voiceNoticeTimeoutRef.current);
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsListening(false);
      setVoiceNotice(null);
      return;
    }

    const SpeechRecognitionClass =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionClass) {
      setVoiceNotice('Voice search is not supported in this browser.');
      voiceNoticeTimeoutRef.current = setTimeout(() => setVoiceNotice(null), 3500);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setIsFocused(true);
        setVoiceNotice('Listening... Speak a book title, topic or author');
        triggerCapsuleFeedback({ pitch: 620, volume: 0.2 });
      };

      recognition.onresult = (event: any) => {
        let currentFinal = '';
        let currentInterim = '';

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            currentFinal += item[0].transcript + ' ';
          } else {
            currentInterim += item[0].transcript;
          }
        }

        const spoken = (currentFinal || currentInterim).trim();
        if (spoken) {
          setQuery(spoken);
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('SpeechRecognition error:', err?.error || err);
        setIsListening(false);
        if (err?.error === 'not-allowed' || err?.error === 'service-not-allowed') {
          setVoiceNotice('Microphone access blocked. Please enable mic permissions.');
        } else if (err?.error !== 'no-speech') {
          setVoiceNotice(`Speech recognition error (${err?.error || 'failed'})`);
        } else {
          setVoiceNotice(null);
        }
        voiceNoticeTimeoutRef.current = setTimeout(() => setVoiceNotice(null), 3500);
      };

      recognition.onend = () => {
        setIsListening(false);
        voiceNoticeTimeoutRef.current = setTimeout(() => setVoiceNotice(null), 1500);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Could not start voice search:', err);
      setIsListening(false);
      setVoiceNotice('Could not start microphone');
      voiceNoticeTimeoutRef.current = setTimeout(() => setVoiceNotice(null), 3500);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto min-w-0 overflow-visible">
      <Search className={`w-4 h-4 sm:w-4.5 sm:h-4.5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none transition-colors ${
        isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 dark:text-[#8e8e93]'
      }`} />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query.trim()) {
            safeStorage.setItem('edu_search_prefill', query);
            onNavigate('library');
            setIsFocused(false);
          }
        }}
        placeholder={isListening ? 'Listening... Speak now' : 'Search books, syllabus, topics...'}
        className={`w-full h-11 sm:h-12 pl-10 sm:pl-11 ${query ? 'pr-16 sm:pr-18' : 'pr-10 sm:pr-11'} bg-white dark:bg-[#1a1a1d] border rounded-full text-sm text-slate-900 dark:text-[#ededed] outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-[#8e8e93] placeholder:truncate shadow-sm focus:shadow-md min-w-0 ${
          isListening
            ? 'border-red-500 ring-2 ring-red-500/30'
            : 'border-slate-200/90 dark:border-[#2e2e32] focus:border-brand-500 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
        }`}
      />

      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          className="absolute right-9 sm:right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
          title="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        type="button"
        onClick={handleToggleVoiceSearch}
        className={`absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center ${
          isListening
            ? 'bg-red-500 text-white shadow-md shadow-red-500/40 ring-2 ring-red-400/60 animate-pulse scale-105'
            : 'text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 active:scale-95'
        }`}
        title={isListening ? 'Listening... Click to stop' : 'Voice search (Click and speak)'}
        aria-label={isListening ? 'Stop listening' : 'Search by voice'}
      >
        {isListening ? (
          <Mic className="w-4 h-4 text-white animate-bounce" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      {voiceNotice && (
        <div className="absolute top-full left-0 mt-1.5 px-2.5 py-1 bg-slate-900/90 dark:bg-slate-950/95 text-white text-[11px] rounded-lg shadow-xl backdrop-blur-md z-[120] flex items-center gap-1.5 border border-white/10 animate-in fade-in slide-in-from-top-1">
          {isListening ? (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
          ) : (
            <MicOff className="w-3 h-3 text-slate-400 shrink-0" />
          )}
          <span className="truncate max-w-[240px] sm:max-w-xs">{voiceNotice}</span>
        </div>
      )}

      {showDropdown && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white/95 dark:bg-[#161616]/90 dark:backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/10 max-h-[460px] overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {!searchLow ? (
            <div className="p-4 space-y-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-brand-500" />
                  <span>Recommended For Your Subjects</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(academicProfile.isConfigured
                    ? [
                        ...academicProfile.subjects.slice(0, 5).map((sub) => ({ label: sub, icon: '📚' })),
                        ...(academicProfile.curriculum ? [{ label: academicProfile.curriculum, icon: '🎓' }] : []),
                        ...(academicProfile.fieldOfStudy ? [{ label: academicProfile.fieldOfStudy, icon: '🎯' }] : []),
                        ...(academicProfile.country ? [{ label: academicProfile.country, icon: '🌍' }] : []),
                      ]
                    : [
                        { label: 'Mathematics', icon: '📐' },
                        { label: 'Physics', icon: '⚡' },
                        { label: 'Chemistry', icon: '🧪' },
                        { label: 'Biology', icon: '🧬' },
                        { label: 'Computer Science', icon: '💻' },
                        { label: 'Business Studies', icon: '📊' },
                      ]
                  ).map((item) => (
                    <button
                      key={item.label}
                      onClick={() => setQuery(item.label)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 dark:hover:text-brand-400 text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-slate-200/60 dark:border-slate-700/60"
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {aiSearchRecommendations.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Picks For Your Intake</span>
                  </div>
                  <div className="space-y-1">
                    {aiSearchRecommendations.slice(0, 3).map(({ book, matchReason }) => (
                      <button
                        key={`ai-pick-${book.id}`}
                        onClick={() => {
                          onBookSelect(book);
                          setIsFocused(false);
                        }}
                        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 text-left transition-colors cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {book.title}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {matchReason}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onNavigate('library');
                    setIsFocused(false);
                  }}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors flex items-center gap-2.5 group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <BookIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600">Your Library</div>
                    <div className="text-[10px] text-slate-400">{personalizedLibraryBooks.length} tailored books</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigate('book-store');
                    setIsFocused(false);
                  }}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors flex items-center gap-2.5 group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">Bookstore Catalog</div>
                    <div className="text-[10px] text-slate-400">{personalizedStoreCatalog.length} intake syllabuses</div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 bg-gradient-to-r from-slate-50 to-brand-50/40 dark:from-slate-800/80 dark:to-slate-800/40 border-b border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                    <Compass className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                    <span>
                      Platform Search: <strong>"{query}"</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      {directLibraryBooks.length} In Library
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                      {directStoreBooks.length} in Bookstore
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: 'All Results', count: totalBooksCount + relatedBooks.length + filteredPaths.length + filteredQuizzes.length },
                  { id: 'library', label: 'In Library', count: directLibraryBooks.length },
                  { id: 'store', label: 'In Bookstore', count: directStoreBooks.length },
                  { id: 'related', label: 'Related Books', count: relatedBooks.length },
                  { id: 'audiobooks', label: 'Audiobooks', count: directLibraryBooks.length },
                  { id: 'paths', label: 'Paths', count: filteredPaths.length },
                  { id: 'quizzes', label: 'Quizzes', count: filteredQuizzes.length },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSearchFilter(tab.id as SearchTabFilter)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      searchFilter === tab.id
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                        searchFilter === tab.id ? 'bg-brand-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {relatedSuggestions.length > 0 && (
                <div className="px-3 py-2 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    <TrendingUp className="w-3 h-3 text-brand-500" />
                    <span>Related Searches & Topics</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {relatedSuggestions.map((s, idx) => (
                      <button
                        key={`${s.text}-${idx}`}
                        onClick={() => setQuery(s.text)}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1 shadow-2xs cursor-pointer group active:scale-95"
                      >
                        <span className="text-[11px]">{s.icon || '🔍'}</span>
                        <span className="group-hover:underline">{s.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hasResults ? (
                <div className="p-2 space-y-4">
                  {showLibrarySection && (
                    <div>
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>In Your Library ({directLibraryBooks.length})</span>
                        </div>
                        <button
                          onClick={() => {
                            if (query) safeStorage.setItem('edu_search_prefill', query);
                            onNavigate('library');
                            setIsFocused(false);
                          }}
                          className="text-brand-600 dark:text-brand-400 font-medium hover:underline text-[10px] cursor-pointer"
                        >
                          Open Library →
                        </button>
                      </div>
                      <div className="space-y-1 mt-1">
                        {directLibraryBooks.slice(0, 4).map((book) => {
                          const isCached = cachedBookIds.has(book.id);
                          return (
                            <button
                              key={book.id}
                              onClick={() => {
                                onBookSelect(book);
                                setQuery('');
                                setIsFocused(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 rounded-xl text-left transition-colors cursor-pointer group border border-transparent hover:border-emerald-200/50"
                            >
                              <div className="w-8 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 font-bold shadow-sm">
                                <BookIcon className="w-4 h-4" />
                              </div>
                              <div className="truncate flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                                    {book.title}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-2 mt-0.5">
                                  <span>by {book.author}</span>
                                  <span>·</span>
                                  <span className="text-slate-400">{book.category}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isCached && (
                                  <span className="text-[10px] flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium" title="Saved offline">
                                    <HardDriveDownload className="w-3 h-3 text-emerald-500" /> Offline
                                  </span>
                                )}
                                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  Ready to Read
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {showStoreSection && (
                    <div>
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Available on Platform ({directStoreBooks.length})</span>
                        </div>
                        <button
                          onClick={() => {
                            if (query) safeStorage.setItem('edu_search_prefill', query);
                            onNavigate('book-store');
                            setIsFocused(false);
                          }}
                          className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline text-[10px] cursor-pointer"
                        >
                          Visit Bookstore →
                        </button>
                      </div>
                      <div className="space-y-1 mt-1">
                        {directStoreBooks.slice(0, 4).map((book) => {
                          const isJustAdded = addedBookIds.has(book.id);
                          return (
                            <div
                              key={book.id}
                              onClick={() => {
                                onBookSelect(book);
                                setQuery('');
                                setIsFocused(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 rounded-xl text-left transition-colors cursor-pointer group border border-transparent hover:border-indigo-200/50"
                            >
                              <div className="w-8 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 font-bold shadow-sm">
                                <ShoppingBag className="w-4 h-4" />
                              </div>
                              <div className="truncate flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                                    {book.title}
                                  </span>
                                  {book.curriculum && book.curriculum.length > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 rounded font-medium">
                                      {book.curriculum.join(', ')}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-2 mt-0.5">
                                  <span>by {book.author}</span>
                                  <span>·</span>
                                  <span className="text-slate-400">{book.category}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {isJustAdded ? (
                                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Added
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => handleAddStoreBook(e, book)}
                                    className="text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-full flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                                  >
                                    <BookmarkCheck className="w-3.5 h-3.5" />
                                    Get Book
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {showRelatedSection && (
                    <div>
                      <div className="px-3 py-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Related Books on Platform ({relatedBooks.length})</span>
                        </div>
                      </div>
                      <div className="space-y-1 mt-1">
                        {relatedBooks.map(({ book, reason, inLibrary }) => (
                          <button
                            key={`related-${book.id}`}
                            onClick={() => {
                              onBookSelect(book);
                              setQuery('');
                              setIsFocused(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-amber-50/60 dark:hover:bg-amber-950/30 rounded-xl text-left transition-colors cursor-pointer group border border-transparent hover:border-amber-200/50"
                          >
                            <div className="w-8 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0 shadow-sm">
                              <BookIcon className="w-4 h-4" />
                            </div>
                            <div className="truncate flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                                  {book.title}
                                </span>
                              </div>
                              <div className="text-xs text-amber-700/80 dark:text-amber-400/90 truncate flex items-center gap-1.5 mt-0.5">
                                <span className="font-medium">{reason}</span>
                                <span>·</span>
                                <span>by {book.author}</span>
                              </div>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                              inLibrary
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300'
                            }`}>
                              {inLibrary ? 'In Library' : 'Available in Store'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showAudiobooksSection && (
                    <div>
                      <div className="px-3 py-1.5 text-[11px] font-bold text-purple-500 uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Headphones className="w-3.5 h-3.5" />
                          <span>Audiobook Narrations</span>
                        </div>
                        <button
                          onClick={() => { onNavigate('audiobooks'); setIsFocused(false); }}
                          className="text-purple-600 dark:text-purple-400 font-medium hover:underline text-[10px] cursor-pointer"
                        >
                          View All Audio →
                        </button>
                      </div>
                      <div className="space-y-1 mt-1">
                        {directLibraryBooks.slice(0, 2).map((book) => (
                          <button
                            key={`audio-${book.id}`}
                            onClick={() => {
                              onNavigate('audiobooks');
                              setQuery('');
                              setIsFocused(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-purple-50/70 dark:hover:bg-purple-950/40 rounded-xl text-left transition-colors cursor-pointer group"
                          >
                            <div className="w-7 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                              <Headphones className="w-4 h-4" />
                            </div>
                            <div className="truncate flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-purple-600 transition-colors">
                                {book.title} (Audio Edition)
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">Narrated · by {book.author}</div>
                            </div>
                            <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-2 py-0.5 rounded-full shrink-0">
                              Listen
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showPathsSection && (
                    <div>
                      <div className="px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <Map className="w-3 h-3" />
                        <span>Curriculum & Learning Paths</span>
                      </div>
                      <div className="space-y-1 mt-1">
                        {filteredPaths.slice(0, 2).map((path) => (
                          <button
                            key={path.id}
                            onClick={() => {
                              onNavigate('learning-path');
                              setQuery('');
                              setIsFocused(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 rounded-xl text-left transition-colors cursor-pointer"
                          >
                            <Map className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{path.title}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showQuizzesSection && (
                    <div>
                      <div className="px-3 py-1 text-[11px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                        <FileQuestion className="w-3 h-3" />
                        <span>Quizzes & Assessments</span>
                      </div>
                      <div className="space-y-1 mt-1">
                        {filteredQuizzes.slice(0, 2).map((quiz) => (
                          <button
                            key={quiz.id}
                            onClick={() => {
                              onNavigate('quizzes');
                              setQuery('');
                              setIsFocused(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-amber-50/70 dark:hover:bg-amber-950/40 rounded-xl text-left transition-colors cursor-pointer"
                          >
                            <FileQuestion className="w-4 h-4 text-amber-500 shrink-0" />
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{quiz.title}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={handleAskAiAboutTopic}
                      className="w-full p-3 bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950/40 border border-brand-200/60 dark:border-brand-800/40 rounded-xl flex items-center justify-between gap-3 text-left hover:brightness-95 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-xs">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                            <span>Ask Edu AI Tutor about "{query}"</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Generate on-demand summaries, textbook notes, and practice quizzes</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-brand-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    No exact textbook match for "{query}"
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    This specific title is not yet cataloged on the platform. You can ask the AI Tutor to generate study material or explore the bookstore for related subjects.
                  </p>

                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={handleAskAiAboutTopic}
                      className="w-full sm:w-auto px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate Study Guide with AI
                    </button>
                    <button
                      onClick={() => {
                        onNavigate('book-store');
                        setIsFocused(false);
                      }}
                      className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Browse Bookstore
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
