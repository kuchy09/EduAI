import { 
  Search, Bell, MoreHorizontal, Book as BookIcon, Map, FileQuestion, 
  Headphones, ShoppingBag, X, CheckCircle2, Sparkles, ArrowRight,
  BookmarkCheck, Compass, HelpCircle, HardDriveDownload, TrendingUp
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Book, ViewState } from '../types';
import { platformBookStoreCatalog } from '../data';
import { useOffline } from '../lib/useOffline';
import { getRelatedSearchSuggestions } from '../lib/searchSuggestions';
import { getStoredNotifications } from '../lib/notifications';
import { triggerCapsuleFeedback } from '../lib/feedback';

interface HeaderProps {
  onMenuClick: () => void;
  onBookSelect: (book: Book) => void;
  onNavigate: (view: ViewState) => void;
  onAddBookToLibrary?: (book: Book) => void;
  user?: any;
  books: Book[];
}

export type SearchTabFilter = 'all' | 'library' | 'store' | 'related' | 'audiobooks' | 'paths' | 'quizzes';

export function Header({ 
  onMenuClick, 
  onBookSelect, 
  onNavigate, 
  onAddBookToLibrary, 
  user, 
  books 
}: HeaderProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchTabFilter>('all');
  const [addedBookIds, setAddedBookIds] = useState<Set<string>>(new Set());
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => {
    return getStoredNotifications().filter(n => !n.isRead).length;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { cachedBookIds } = useOffline();

  // Keep unread count in sync
  useEffect(() => {
    const updateCount = () => {
      const count = getStoredNotifications().filter(n => !n.isRead).length;
      setUnreadNotifCount(count);
    };

    updateCount();
    window.addEventListener('storage', updateCount);
    window.addEventListener('notifications_updated', updateCount);
    const interval = setInterval(updateCount, 3000);
    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('notifications_updated', updateCount);
      clearInterval(interval);
    };
  }, []);

  const fieldOfStudy = user?.user_metadata?.field_of_study || 'General Studies';
  const subjects = user?.user_metadata?.subjects || 'core concepts';

  const learningPaths = useMemo(() => [
    { id: 'path-1', title: `Foundations of ${fieldOfStudy}`, category: 'Path' },
    { id: 'path-2', title: `Advanced Topics in ${subjects}`, category: 'Path' },
    { id: 'path-3', title: 'Practical Applications & Projects', category: 'Path' },
    { id: 'path-4', title: 'Kenyan CBC Senior Secondary Core Pathway', category: 'Path' },
  ], [fieldOfStudy, subjects]);

  const quizzes = useMemo(() => [
    { id: 'quiz-1', title: `${fieldOfStudy}: Chapter 1 Review`, topic: fieldOfStudy },
    { id: 'quiz-2', title: `${subjects} Diagnostic Quiz`, topic: subjects },
    { id: 'quiz-3', title: 'Problem Solving & Critical Thinking', topic: 'General' },
    { id: 'quiz-4', title: 'CBC Grade 9 Science Assessment', topic: 'Science' },
  ], [fieldOfStudy, subjects]);

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

  // Combine Library Books and Bookstore Catalog into a comprehensive platform directory
  const { directLibraryBooks, directStoreBooks, relatedBooks } = useMemo(() => {
    if (!searchLow) {
      return { directLibraryBooks: [], directStoreBooks: [], relatedBooks: [] };
    }

    const libraryIds = new Set(books.map(b => b.id));

    // Match books in user's library
    const libMatches = books.filter(b => {
      const titleMatch = b.title.toLowerCase().includes(searchLow);
      const authorMatch = b.author.toLowerCase().includes(searchLow);
      const curriculumMatch = b.curriculum?.some(c => c.toLowerCase().includes(searchLow)) || false;
      const subjectsMatch = b.subjects?.some(s => s.toLowerCase().includes(searchLow)) || false;
      const categoryMatch = b.category.toLowerCase().includes(searchLow);
      const descMatch = b.description.toLowerCase().includes(searchLow);
      return titleMatch || authorMatch || curriculumMatch || subjectsMatch || categoryMatch || descMatch;
    });

    // Match books in the platform bookstore that are NOT in the library
    const storeMatches = platformBookStoreCatalog.filter(b => {
      if (libraryIds.has(b.id)) return false; // Already in library
      const titleMatch = b.title.toLowerCase().includes(searchLow);
      const authorMatch = b.author.toLowerCase().includes(searchLow);
      const curriculumMatch = b.curriculum?.some(c => c.toLowerCase().includes(searchLow)) || false;
      const subjectsMatch = b.subjects?.some(s => s.toLowerCase().includes(searchLow)) || false;
      const categoryMatch = b.category.toLowerCase().includes(searchLow);
      const descMatch = b.description.toLowerCase().includes(searchLow);
      return titleMatch || authorMatch || curriculumMatch || subjectsMatch || categoryMatch || descMatch;
    });

    // Extract subjects/categories from direct matches to find related books on the platform
    const matchedCategories = new Set<string>();
    const matchedSubjects = new Set<string>();

    [...libMatches, ...storeMatches].forEach(b => {
      matchedCategories.add(b.category.toLowerCase());
      b.subjects?.forEach(s => matchedSubjects.add(s.toLowerCase()));
    });

    const directIds = new Set([...libMatches.map(b => b.id), ...storeMatches.map(b => b.id)]);

    // Find related books on the platform that share category or subjects
    const allPlatformBooks = [...books, ...platformBookStoreCatalog.filter(b => !libraryIds.has(b.id))];
    
    const related: { book: Book; reason: string; inLibrary: boolean }[] = [];
    const seenRelatedIds = new Set<string>();

    allPlatformBooks.forEach(b => {
      if (directIds.has(b.id) || seenRelatedIds.has(b.id)) return;

      const hasCategoryRelation = matchedCategories.has(b.category.toLowerCase()) && matchedCategories.size > 0;
      const matchingSubject = b.subjects?.find(s => matchedSubjects.has(s.toLowerCase()));

      // Or if query loosely relates to book's subject / category
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
  }, [books, searchLow]);

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
        setDropdownStyle({
          position: 'fixed',
          top: rect.bottom + 8,
          left: rect.left,
          width: rect.width,
          zIndex: 9999
        });
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

  // Tab visibility flags
  const showLibrarySection = (searchFilter === 'all' || searchFilter === 'library' || searchFilter === 'books' as any) && directLibraryBooks.length > 0;
  const showStoreSection = (searchFilter === 'all' || searchFilter === 'store' || searchFilter === 'books' as any) && directStoreBooks.length > 0;
  const showRelatedSection = (searchFilter === 'all' || searchFilter === 'related') && relatedBooks.length > 0;
  const showAudiobooksSection = (searchFilter === 'all' || searchFilter === 'audiobooks') && directLibraryBooks.length > 0;
  const showPathsSection = (searchFilter === 'all' || searchFilter === 'paths') && filteredPaths.length > 0;
  const showQuizzesSection = (searchFilter === 'all' || searchFilter === 'quizzes') && filteredQuizzes.length > 0;

  const handleAddStoreBook = (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    if (onAddBookToLibrary) {
      onAddBookToLibrary(book);
    }
    setAddedBookIds(prev => new Set(prev).add(book.id));
  };

  const handleAskAiAboutTopic = () => {
    localStorage.setItem('ai_tutor_prefill', `Can you provide a comprehensive summary, key chapter concepts, and study guide questions for "${query}"?`);
    onNavigate('ai-tutor');
    setIsFocused(false);
    setQuery('');
  };

  return (
    <header className="h-16 liquid-glass-card border-b border-white/60 dark:border-white/10 flex items-center justify-between px-4 md:px-8 sticky top-0 z-[100] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)]">
      <div className="flex items-center flex-1 max-w-2xl relative gap-2.5 overflow-visible">
        <button 
          onClick={() => {
            setIsFocused(false);
            onMenuClick();
          }} 
          className="p-2 text-slate-700 dark:text-slate-200 liquid-glass-card hover:scale-105 active:scale-95 rounded-full shadow-sm hover:shadow-md transition-all shrink-0 cursor-pointer flex items-center justify-center group w-9 h-9 border border-white/60 dark:border-white/10"
          title="Open Navigation"
        >
          <MoreHorizontal className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
        
        <div ref={containerRef} className="relative flex-1 overflow-visible">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                localStorage.setItem('edu_search_prefill', query);
                onNavigate('library');
                setIsFocused(false);
              }
            }}
            placeholder="Search books, authors, subjects, syllabus or check availability..." 
            className="w-full pl-10 pr-10 py-2 bg-slate-100/60 dark:bg-slate-800/60 hover:bg-slate-100/90 dark:hover:bg-slate-800/90 focus:bg-white/95 dark:focus:bg-slate-900/95 border border-slate-200/60 dark:border-slate-700/60 focus:border-brand-500 rounded-full text-sm outline-none transition-all placeholder:text-slate-400 shadow-inner backdrop-blur-md"
          />

          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Search Dropdown */}
          {showDropdown && createPortal(
            <div 
              ref={dropdownRef}
              style={dropdownStyle}
              className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 max-h-[480px] overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-150"
            >
              
              {/* If no query is entered yet, show popular suggestions & trending topics */}
              {!searchLow ? (
                <div className="p-4 space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                      <TrendingUp className="w-3.5 h-3.5 text-brand-500" />
                      <span>Trending & Recommended Searches</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Computer Science', icon: '💻' },
                        { label: 'Calculus & Physics', icon: '📐' },
                        { label: 'African Literature', icon: '🌍' },
                        { label: 'Kenyan CBC Grade 9', icon: '🇰🇪' },
                        { label: 'Data Structures & Algorithms', icon: '⚡' },
                        { label: 'Microbiology & Chemistry', icon: '🧬' },
                        { label: 'Business & Finance', icon: '📊' },
                        { label: 'Things Fall Apart', icon: '📖' },
                      ].map((item) => (
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

                  {/* Quick Shortcuts */}
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
                        <div className="text-[10px] text-slate-400">{books.length} books available</div>
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
                        <div className="text-[10px] text-slate-400">Official syllabuses & preps</div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Platform Availability Summary Banner */}
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
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {directLibraryBooks.length} In Library
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          {directStoreBooks.length} in Bookstore
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Category Filter Chips inside dropdown */}
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

                  {/* Related Searches & Keywords suggestion chips */}
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

                  {/* 1. Books in User's Library (Ready to Read) */}
                  {showLibrarySection && (
                    <div>
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>In Your Library ({directLibraryBooks.length})</span>
                        </div>
                        <button 
                          onClick={() => { 
                            if (query) localStorage.setItem('edu_search_prefill', query);
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

                  {/* 2. Books Available in Platform Bookstore Catalog */}
                  {showStoreSection && (
                    <div>
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Available on Platform ({directStoreBooks.length})</span>
                        </div>
                        <button 
                          onClick={() => { 
                            if (query) localStorage.setItem('edu_search_prefill', query);
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

                  {/* 3. Related Books on Platform */}
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

                  {/* 4. Audiobooks */}
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

                  {/* 5. Learning Paths & Quizzes */}
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

                  {/* AI Tutor Smart Assistant Shortcut */}
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
                /* No direct results found state */
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
      </div>

      <div className="flex items-center gap-3 ml-4">
        <button 
          onClick={() => {
            triggerCapsuleFeedback({ pitch: 580, volume: 0.18, hapticDuration: 12 });
            onNavigate('notifications');
          }}
          className="relative w-10 h-10 rounded-full liquid-glass-card hover:scale-105 active:scale-95 flex items-center justify-center transition-all shadow-sm cursor-pointer border text-slate-600 dark:text-slate-300 border-white/60 dark:border-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700"
          title="Notifications & Broadcasts Page"
        >
          <Bell className="w-4.5 h-4.5" />
          {unreadNotifCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-rose-500 to-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs animate-pulse">
              {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
            </span>
          ) : (
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
          )}
        </button>
      </div>
    </header>
  );
}
