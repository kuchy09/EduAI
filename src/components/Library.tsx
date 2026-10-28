import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Book, Bookmark } from '../types';
import { Filter, Search, Bookmark as BookmarkIcon, LayoutGrid, List, HardDriveDownload, CheckCircle2, Loader2, WifiOff, CloudDownload, X, ShoppingBag, BookmarkCheck, ArrowRight, Compass } from 'lucide-react';
import { BookCoverVisual } from './BookCoverVisual';
import { useOffline } from '../lib/useOffline';
import { platformBookStoreCatalog } from '../data';
import {
  extractUserAcademicProfile,
  getPersonalizedBooks,
  getAiRecommendedBooks,
  findMatchingUserSubjects,
  ACADEMIC_PREFS_EVENT,
} from '../lib/bookPersonalization';

interface LibraryProps {
  books: Book[];
  categories: string[];
  onBookSelect: (book: Book) => void;
  bookmarks: Bookmark[];
  user?: any;
  profile?: any;
  onAddBookToLibrary?: (book: Book) => void;
  onNavigate?: (view: any) => void;
  onOpenAcademicPrefs?: () => void;
}

export function Library({ books, categories, onBookSelect, bookmarks, user, profile, onAddBookToLibrary, onNavigate, onOpenAcademicPrefs }: LibraryProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'books' | 'bookmarks' | 'downloaded'>('books');
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
  const [addedBookIds, setAddedBookIds] = useState<Set<string>>(new Set());
  const [catalogScope, setCatalogScope] = useState<'personalized' | 'all'>('personalized');
  const [prefsTick, setPrefsTick] = useState(0);
  const { isOnline, isBookCached, downloadBook, isDownloading, downloadProgress, cachedBookIds } = useOffline();

  useEffect(() => {
    const onPrefsUpdated = () => setPrefsTick((t) => t + 1);
    window.addEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
    return () => window.removeEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
  }, []);

  // Load prefilled search query if navigating from Header or Home
  useEffect(() => {
    const prefill = localStorage.getItem('edu_search_prefill');
    if (prefill) {
      setSearchQuery(prefill);
      localStorage.removeItem('edu_search_prefill');
    }
  }, []);

  const academicProfile = useMemo(
    () => extractUserAcademicProfile(profile, user),
    [profile, user, prefsTick]
  );

  const personalizedLibraryBooks = useMemo(
    () => getPersonalizedBooks(books, academicProfile, { allowFallbackIfEmpty: true, includeStartedBooks: true }),
    [books, academicProfile]
  );

  const baseBooks = catalogScope === 'personalized' && academicProfile.isConfigured
    ? personalizedLibraryBooks
    : books;

  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [selectedCurriculum, setSelectedCurriculum] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(false);

  const availableCountries = Array.from(new Set(baseBooks.flatMap(b => b.country || []))).filter(Boolean);
  const availableCurricula = Array.from(new Set(baseBooks.flatMap(b => b.curriculum || []))).filter(Boolean);

  const personalizedFilterPills = useMemo(() => {
    if (academicProfile.subjects.length > 0 && catalogScope === 'personalized') {
      return ['All', ...academicProfile.subjects];
    }
    const presentCats = Array.from(new Set(baseBooks.map(b => b.category).filter(Boolean)));
    return presentCats.length > 0 ? ['All', ...presentCats] : categories;
  }, [academicProfile.subjects, catalogScope, baseBooks, categories]);

  useEffect(() => {
    if (activeCategory !== 'All' && !personalizedFilterPills.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [personalizedFilterPills, activeCategory]);

  const q = searchQuery.toLowerCase().trim();

  // Search & filter through personalized library books
  const filteredBooks = useMemo(() => {
    const sourceList = viewMode === 'downloaded' ? books : baseBooks;
    return sourceList.filter(book => {
      if (viewMode === 'downloaded' && !isBookCached(book.id)) {
        return false;
      }

      const matchesCategory =
        activeCategory === 'All' ||
        book.category === activeCategory ||
        findMatchingUserSubjects(book, [activeCategory]).length > 0 ||
        (book.subjects && book.subjects.some(s => s.toLowerCase() === activeCategory.toLowerCase()));

      const matchesSearch = !q || 
                            book.title.toLowerCase().includes(q) || 
                            book.author.toLowerCase().includes(q) ||
                            book.category.toLowerCase().includes(q) ||
                            (book.description && book.description.toLowerCase().includes(q)) ||
                            (book.subjects && book.subjects.some(s => s.toLowerCase().includes(q))) ||
                            (book.curriculum && book.curriculum.some(c => c.toLowerCase().includes(q))) ||
                            (book.country && book.country.some(c => c.toLowerCase().includes(q)));
      
      const matchesCountry = selectedCountry === 'All' || (book.country && book.country.some(c => 
        c.toLowerCase() === selectedCountry.toLowerCase() ||
        c.toLowerCase().includes(selectedCountry.toLowerCase()) ||
        selectedCountry.toLowerCase().includes(c.toLowerCase())
      ));
      const matchesCurriculum = selectedCurriculum === 'All' || (book.curriculum && book.curriculum.some(c => 
        c.toLowerCase() === selectedCurriculum.toLowerCase() ||
        c.toLowerCase().includes(selectedCurriculum.toLowerCase()) ||
        selectedCurriculum.toLowerCase().includes(c.toLowerCase())
      ));
      
      return matchesCategory && matchesSearch && matchesCountry && matchesCurriculum;
    });
  }, [baseBooks, books, viewMode, activeCategory, q, selectedCountry, selectedCurriculum, isBookCached]);

  // AI Recommended syllabus titles (personalized to user's country, curriculum, level, and subjects)
  const aiRecommendedForLibrary = useMemo(() => {
    const libraryIds = new Set(books.map(b => b.id));
    const unownedStoreBooks = platformBookStoreCatalog.filter(b => !libraryIds.has(b.id));
    const combinedPool = [...personalizedLibraryBooks, ...getPersonalizedBooks(unownedStoreBooks, academicProfile, { allowFallbackIfEmpty: false })];
    return getAiRecommendedBooks(combinedPool, academicProfile, 4);
  }, [books, personalizedLibraryBooks, academicProfile]);

  const libraryIdSet = useMemo(() => new Set(books.map(b => b.id)), [books]);

  // Platform bookstore catalog books matching search (prioritizing user's academic profile)
  const platformStoreMatches = useMemo(() => {
    if (!q) return [];
    const libraryIds = new Set(books.map(b => b.id));
    const scopedStore = catalogScope === 'personalized' && academicProfile.isConfigured
      ? getPersonalizedBooks(platformBookStoreCatalog, academicProfile, { allowFallbackIfEmpty: true })
      : platformBookStoreCatalog;
    return scopedStore.filter(book => {
      if (libraryIds.has(book.id)) return false;
      return book.title.toLowerCase().includes(q) ||
             book.author.toLowerCase().includes(q) ||
             book.category.toLowerCase().includes(q) ||
             (book.description && book.description.toLowerCase().includes(q)) ||
             (book.subjects && book.subjects.some(s => s.toLowerCase().includes(q))) ||
             (book.curriculum && book.curriculum.some(c => c.toLowerCase().includes(q)));
    });
  }, [books, q, catalogScope, academicProfile]);

  // Related books computation
  const relatedBooks = useMemo(() => {
    if (!q) return [];
    const libraryIds = new Set(books.map(b => b.id));
    const matchedCategories = new Set<string>();
    const matchedSubjects = new Set<string>();
    [...filteredBooks, ...platformStoreMatches].forEach(b => {
      matchedCategories.add(b.category.toLowerCase());
      b.subjects?.forEach(s => matchedSubjects.add(s.toLowerCase()));
    });

    const directIds = new Set([...filteredBooks.map(b => b.id), ...platformStoreMatches.map(b => b.id)]);
    const allPlatformBooks = [...books, ...platformBookStoreCatalog.filter(b => !libraryIds.has(b.id))];
    const related: { book: Book; reason: string; inLibrary: boolean }[] = [];
    const seen = new Set<string>();

    allPlatformBooks.forEach(b => {
      if (directIds.has(b.id) || seen.has(b.id)) return;
      const matchSubj = b.subjects?.find(s => matchedSubjects.has(s.toLowerCase()));
      if (matchSubj) {
        related.push({ book: b, reason: `Subject: ${matchSubj}`, inLibrary: libraryIds.has(b.id) });
        seen.add(b.id);
      } else if (matchedCategories.has(b.category.toLowerCase())) {
        related.push({ book: b, reason: `Category: ${b.category}`, inLibrary: libraryIds.has(b.id) });
        seen.add(b.id);
      }
    });
    return related.slice(0, 4);
  }, [books, filteredBooks, platformStoreMatches, q]);

  const handleAddStoreBook = (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    if (onAddBookToLibrary) {
      onAddBookToLibrary(book);
    }
    setAddedBookIds(prev => new Set(prev).add(book.id));
  };

  const filteredBookmarks = bookmarks.filter(b => {
    if (!q) return true;
    return b.bookTitle.toLowerCase().includes(q) || 
           b.chapter.toLowerCase().includes(q) ||
           b.textSnippet.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 w-full">
        <div className="min-w-0 w-full">
          <div className="flex flex-wrap items-center gap-2.5 mb-1 sm:mb-2">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Library</h2>
            <button
              type="button"
              onClick={() => onOpenAcademicPrefs?.()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
              title="Customize your Country, Curriculum, Level & Subjects"
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>{academicProfile.isConfigured ? academicProfile.summaryLabel : 'Set Academic Intake'}</span>
            </button>
          </div>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mb-4 sm:mb-6">
            {academicProfile.isConfigured && catalogScope === 'personalized'
              ? `Showing textbooks tailored to ${academicProfile.summaryLabel}${academicProfile.subjects.length > 0 ? ` (${academicProfile.subjects.join(', ')})` : ''}.`
              : 'Access your collection and AI-generated study notes.'}
          </p>

          <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-1 sm:gap-2 overflow-x-auto scrollbar-hide w-full max-w-full">
            <button 
              onClick={() => setViewMode('books')}
              className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer shrink-0 ${viewMode === 'books' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              My Books ({baseBooks.length})
            </button>
            <button 
              onClick={() => setViewMode('downloaded')}
              className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${viewMode === 'downloaded' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <HardDriveDownload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Offline Books ({cachedBookIds.size})
              {!isOnline && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                  Active
                </span>
              )}
            </button>
            <button 
              onClick={() => setViewMode('bookmarks')}
              className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer shrink-0 ${viewMode === 'bookmarks' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <BookmarkIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Bookmarks ({bookmarks.length})
            </button>
          </div>
        </div>
        
        <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto shrink-0 mb-1">
          <div className="flex items-center gap-2">
            {academicProfile.isConfigured && (
              <button
                type="button"
                onClick={() => setCatalogScope(prev => prev === 'personalized' ? 'all' : 'personalized')}
                className={`px-3 py-1.5 sm:py-2 border rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  catalogScope === 'personalized'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-[#1e1e20] border-slate-200 dark:border-[#2e2e32] text-slate-600 dark:text-[#d4d4d8]'
                }`}
              >
                {catalogScope === 'personalized' ? 'My Intake Only' : 'Showing All Levels'}
              </button>
            )}
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 sm:py-2 border rounded-xl flex items-center gap-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                showFilters 
                  ? 'bg-brand-50 dark:bg-brand-500/20 border-brand-200 dark:border-brand-500/40 text-brand-700 dark:text-[#d8cef6]' 
                  : 'bg-white dark:bg-[#1e1e20] border-slate-200 dark:border-[#2e2e32] text-slate-600 dark:text-[#d4d4d8] hover:bg-slate-50 dark:hover:bg-[#27272a] dark:hover:text-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Filter
            </button>
          </div>
          
          {showFilters && (
            <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-[#1a1a1d] p-3 rounded-2xl border border-slate-200 dark:border-[#2e2e32] shadow-sm animate-in fade-in slide-in-from-top-2 w-full sm:w-auto">
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <label className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Country</label>
                <select 
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="bg-slate-50 dark:bg-[#242428] border border-slate-200 dark:border-[#34343a] text-slate-700 dark:text-[#ededed] text-xs sm:text-sm rounded-xl px-3 py-1.5 outline-none focus:border-brand-500 w-full sm:w-40 max-w-full"
                >
                  <option value="All">All Matched Countries</option>
                  {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <label className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Curriculum</label>
                <select 
                  value={selectedCurriculum}
                  onChange={(e) => setSelectedCurriculum(e.target.value)}
                  className="bg-slate-50 dark:bg-[#242428] border border-slate-200 dark:border-[#34343a] text-slate-700 dark:text-[#ededed] text-xs sm:text-sm rounded-xl px-3 py-1.5 outline-none focus:border-brand-500 w-full sm:w-40 max-w-full"
                >
                  <option value="All">All Matched Curricula</option>
                  {availableCurricula.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Recommendations Shelf inside Library */}
      {viewMode === 'books' && !q && aiRecommendedForLibrary.length > 0 && (
        <section className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-indigo-50/70 via-white to-brand-50/40 dark:from-[#191922] dark:via-[#16161a] dark:to-[#1d192b] border border-indigo-100/80 dark:border-indigo-900/40 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  AI Recommended For Your Curriculum & Subjects
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Selected for {academicProfile.summaryLabel}
                </p>
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('book-store')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                More in Bookstore <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {aiRecommendedForLibrary.map(({ book, matchReason }) => {
              const inLib = libraryIdSet.has(book.id) || addedBookIds.has(book.id);
              return (
                <div
                  key={`ai-lib-${book.id}`}
                  onClick={() => {
                    if (!inLib && onAddBookToLibrary) {
                      onAddBookToLibrary(book);
                      setAddedBookIds(prev => new Set(prev).add(book.id));
                    }
                    onBookSelect(book);
                  }}
                  className="bg-white/90 dark:bg-[#1e1e24] p-3 rounded-2xl border border-slate-200/70 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50 shadow-xs hover:shadow-md transition-all cursor-pointer flex gap-3 items-center group"
                >
                  <div className="w-12 h-18 aspect-[2/3] rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 shadow-xs">
                    <BookCoverVisual book={book} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full max-w-full truncate mb-1">
                      <Sparkles className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{matchReason}</span>
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {book.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{book.author}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {viewMode === 'books' || viewMode === 'downloaded' ? (
        <>
          <div className="flex items-center justify-between pb-2 gap-3 w-full max-w-full min-w-0">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1 min-w-0 py-1 bg-transparent">
              {personalizedFilterPills.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                    activeCategory === cat 
                      ? 'bg-slate-900 dark:bg-brand-600 text-white border border-transparent dark:border-brand-500/50 shadow-sm' 
                      : 'bg-white dark:bg-[#1e1e20] border border-slate-200 dark:border-[#2e2e32] text-slate-600 dark:text-[#d4d4d8] hover:bg-slate-50 dark:hover:bg-[#27272a] dark:hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-[#1a1a1d] border border-transparent dark:border-[#2e2e32] p-1 rounded-lg shrink-0">
              <button
                onClick={() => setDisplayMode('grid')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${displayMode === 'grid' ? 'bg-white dark:bg-[#2a2a2e] text-slate-900 dark:text-[#ededed] shadow-sm' : 'text-slate-500 dark:text-[#8e8e93] hover:text-slate-700 dark:hover:text-[#ededed]'}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDisplayMode('list')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${displayMode === 'list' ? 'bg-white dark:bg-[#2a2a2e] text-slate-900 dark:text-[#ededed] shadow-sm' : 'text-slate-500 dark:text-[#8e8e93] hover:text-slate-700 dark:hover:text-[#ededed]'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {displayMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6 w-full max-w-full">
              {filteredBooks.map((book) => {
                const cached = isBookCached(book.id);
                const downloading = isDownloading(book.id);
                const progressPct = downloadProgress[book.id];

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ scale: 1.035, y: -4 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                    onClick={() => onBookSelect(book)}
                    key={book.id}
                    className="group cursor-pointer flex flex-col h-full relative liquid-glass-card p-2.5 sm:p-3 rounded-2xl border border-white/70 dark:border-white/10 shadow-sm hover:shadow-xl transition-shadow"
                  >
                    <div className="w-full aspect-[2/3] rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-shadow relative mb-2.5 bg-slate-100 dark:bg-slate-800">
                      <BookCoverVisual book={book} className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-500 ease-out" />
                      {book.readProgress !== undefined && (
                         <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40">
                           <div className="h-full bg-brand-500" style={{ width: book.readProgress + '%' }}></div>
                         </div>
                      )}

                      {/* Offline Download Status Badge on Cover */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                        {cached ? (
                          <div className="bg-emerald-600/90 backdrop-blur-md text-white p-1 rounded-full shadow" title="Saved offline">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        ) : downloading ? (
                          <div className="bg-slate-900/80 backdrop-blur-md text-brand-300 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {progressPct ? `${progressPct}%` : '...'}
                          </div>
                        ) : isOnline ? (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await downloadBook(book);
                              } catch (err) {
                                console.error('Download failed', err);
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-full shadow hover:scale-105"
                            title="Download for offline reading"
                          >
                            <CloudDownload className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col px-0.5">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 leading-tight text-xs sm:text-sm line-clamp-2 mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{book.title}</h4>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-300 line-clamp-1 mb-2">{book.author}</p>
                      
                      <div className="mt-auto flex items-center gap-1.5 flex-wrap">
                        {cached && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded font-medium">
                            <HardDriveDownload className="w-2.5 h-2.5" /> Offline
                          </span>
                        )}
                        {book.aiInsights && book.aiInsights.length > 0 && (
                          <div className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md font-medium uppercase tracking-wider">
                            <Sparkles className="w-2.5 h-2.5" />
                            {book.aiInsights.length} Notes
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {filteredBooks.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-500">
                  {viewMode === 'downloaded' 
                    ? 'No books downloaded for offline reading yet. Download any book while online to read anytime.' 
                    : 'No books found matching your criteria.'}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredBooks.map((book) => {
                const cached = isBookCached(book.id);
                const downloading = isDownloading(book.id);
                const progressPct = downloadProgress[book.id];

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    whileHover={{ scale: 1.015, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                    onClick={() => onBookSelect(book)}
                    key={book.id}
                    className="group cursor-pointer flex gap-4 sm:gap-5 liquid-glass-card p-3.5 sm:p-4 rounded-2xl border border-white/70 dark:border-white/10 shadow-sm hover:shadow-lg transition-all items-center"
                  >
                    <div className="w-16 sm:w-20 aspect-[2/3] shrink-0 rounded-xl overflow-hidden shadow-sm relative bg-slate-100 dark:bg-slate-800">
                      <BookCoverVisual book={book} className="w-full h-full absolute inset-0 object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="flex-1 flex flex-col min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{book.title}</h4>
                        <div className="flex items-center gap-2">
                          {cached ? (
                            <span className="shrink-0 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Saved Offline
                            </span>
                          ) : downloading ? (
                            <span className="shrink-0 text-[10px] font-medium text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> {progressPct ? `${progressPct}%` : 'Downloading'}
                            </span>
                          ) : isOnline ? (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await downloadBook(book);
                                } catch (err) {
                                  console.error('Download failed', err);
                                }
                              }}
                              className="text-xs px-2.5 py-1 rounded-md bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1 transition-colors"
                            >
                              <CloudDownload className="w-3.5 h-3.5" /> Save Offline
                            </button>
                          ) : null}
                          {book.category && (
                            <span className="shrink-0 text-[10px] font-medium text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              {book.category}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 mb-2">{book.author}</p>
                      {book.description && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 hidden sm:block mb-3">{book.description}</p>
                      )}
                      
                      <div className="mt-auto flex items-center gap-4">
                        {book.readProgress !== undefined && (
                          <div className="flex items-center gap-2 text-xs font-medium text-brand-600 dark:text-brand-400">
                            <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-500 rounded-full" style={{ width: book.readProgress + '%' }}></div>
                            </div>
                            {Math.round(book.readProgress)}%
                          </div>
                        )}
                        {book.aiInsights && book.aiInsights.length > 0 && (
                          <div className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md font-medium uppercase tracking-wider">
                            <Sparkles className="w-2.5 h-2.5" />
                            {book.aiInsights.length} Notes
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {filteredBooks.length === 0 && (
                <div className="py-12 text-center text-slate-500 col-span-full">
                  <p className="text-base font-medium text-slate-700 dark:text-slate-300">
                    {viewMode === 'downloaded' 
                      ? 'No books downloaded for offline reading yet. Download any book while online to read anytime.' 
                      : q 
                        ? `No books in your personal library match "${searchQuery}"`
                        : 'No books found matching your criteria.'}
                  </p>
                  {q && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-3 px-4 py-1.5 bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 rounded-xl text-xs font-bold hover:bg-brand-100 transition-colors cursor-pointer"
                    >
                      Clear Search Filter
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Platform Catalog Matches (Available to add) when searching */}
          {q && platformStoreMatches.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Available in Platform Bookstore ({platformStoreMatches.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    These matching books are available on the platform and can be added to your library.
                  </p>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => {
                      localStorage.setItem('edu_search_prefill', searchQuery);
                      onNavigate('book-store');
                    }}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Browse Bookstore <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {platformStoreMatches.map(book => {
                  const isJustAdded = addedBookIds.has(book.id);
                  return (
                    <div 
                      key={book.id}
                      onClick={() => onBookSelect(book)}
                      className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer group flex gap-4"
                    >
                      <div className="w-16 h-24 sm:w-20 sm:h-28 aspect-[2/3] rounded-lg overflow-hidden shrink-0 shadow-sm bg-slate-100 dark:bg-slate-800 relative">
                        <BookCoverVisual book={book} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            Bookstore
                          </span>
                          <h4 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1 group-hover:text-indigo-600 transition-colors mt-1">
                            {book.title}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-300 truncate">
                            {book.author}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                          <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{book.category}</span>
                          {isJustAdded ? (
                            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Added
                            </span>
                          ) : (
                            <button
                              onClick={(e) => handleAddStoreBook(e, book)}
                              className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-transform"
                            >
                              <BookmarkCheck className="w-3 h-3" /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {filteredBookmarks.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <BookmarkIcon className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p>{searchQuery ? `No bookmarks match "${searchQuery}"` : "You haven't saved any bookmarks yet."}</p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-xs font-semibold hover:bg-brand-100 transition-colors"
                >
                  Clear search
                </button>
              ) : (
                <p className="text-sm mt-2">Read a book and click the bookmark icon to save your place.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBookmarks.map((bookmark) => {
                const book = books.find(b => b.id === bookmark.bookId);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                    key={bookmark.id}
                    onClick={() => book && onBookSelect(book)}
                    className="liquid-glass-card p-4 sm:p-5 rounded-2xl border border-white/70 dark:border-white/10 shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-4 sm:gap-5 items-center"
                  >
                     {book && (
                       <div className="w-16 h-24 shrink-0 rounded-xl overflow-hidden shadow-sm hidden sm:block relative bg-slate-100 dark:bg-slate-800">
                         <BookCoverVisual book={book} className="w-full h-full absolute inset-0 object-cover" />
                       </div>
                     )}
                     <div className="flex-1 flex flex-col justify-center min-w-0">
                       <h4 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">{bookmark.bookTitle}</h4>
                       <p className="text-xs sm:text-sm text-brand-600 dark:text-brand-400 font-medium mb-2">{bookmark.chapter}</p>
                       <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 italic border-l-2 border-brand-300 dark:border-brand-700 pl-3">
                         "{bookmark.textSnippet}"
                       </p>
                       <span className="text-[11px] text-slate-400 dark:text-slate-300 mt-2.5 inline-block">
                         {new Date(bookmark.timestamp).toLocaleDateString()}
                       </span>
                     </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Sparkles(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/>
      <path d="M19 17v4"/>
      <path d="M3 5h4"/>
      <path d="M17 19h4"/>
    </svg>
  );
}
