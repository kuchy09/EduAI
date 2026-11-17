import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ShoppingBag, CheckCircle, Sparkles, Star, ChevronRight, ShieldCheck, CreditCard, Tag, X, BookOpen, CheckCircle2, HelpCircle } from 'lucide-react';
import { Book } from '../types';
import { BookCoverVisual } from './BookCoverVisual';
import { platformBookStoreCatalog } from '../data';
import {
  extractUserAcademicProfile,
  getPersonalizedBooks,
  getAiRecommendedBooks,
  findMatchingUserSubjects,
  ACADEMIC_PREFS_EVENT,
} from '../lib/bookPersonalization';
import { ACCOUNT_SYNC_EVENT } from '../lib/accountSyncService';
import {
  GLOBAL_BOOK_COVERS_EVENT,
  applyGlobalCoversToBooks,
} from '../lib/globalBookCoversService';

interface BookStoreProps {
  books: Book[];
  onAddBookToLibrary: (book: Book) => void;
  user: any;
  profile: any;
  onBookSelect?: (book: Book) => void;
  onNavigate?: (view: any) => void;
  onOpenAcademicPrefs?: () => void;
}

export function BookStore({ books, onAddBookToLibrary, user, profile, onBookSelect, onOpenAcademicPrefs }: BookStoreProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [catalogScope, setCatalogScope] = useState<'personalized' | 'all'>('personalized');
  const [prefsTick, setPrefsTick] = useState(0);

  useEffect(() => {
    const onPrefsUpdated = () => setPrefsTick((t) => t + 1);
    window.addEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
    window.addEventListener(ACCOUNT_SYNC_EVENT, onPrefsUpdated);
    window.addEventListener(GLOBAL_BOOK_COVERS_EVENT, onPrefsUpdated);
    return () => {
      window.removeEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
      window.removeEventListener(ACCOUNT_SYNC_EVENT, onPrefsUpdated);
      window.removeEventListener(GLOBAL_BOOK_COVERS_EVENT, onPrefsUpdated);
    };
  }, []);

  // Load prefilled search query if navigating from Header, Home, or Library
  useEffect(() => {
    const prefill = localStorage.getItem('edu_search_prefill');
    if (prefill) {
      setSearchQuery(prefill);
      localStorage.removeItem('edu_search_prefill');
    }
  }, []);

  const resolvedStoreCatalog = useMemo(
    () => applyGlobalCoversToBooks(platformBookStoreCatalog),
    [prefsTick]
  );

  // Comprehensive catalog combining platform store items and general library items with global canonical covers
  const allStoreCatalog = useMemo(() => {
    const map = new Map<string, Book>();
    resolvedStoreCatalog.forEach(b => map.set(b.id, b));
    books.forEach(b => {
      const existing = map.get(b.id);
      if (!existing) {
        map.set(b.id, b);
      } else if (b.coverImage || b.customCover || b.coverMode) {
        map.set(b.id, { ...existing, ...b });
      }
    });
    return applyGlobalCoversToBooks(Array.from(map.values()));
  }, [books, resolvedStoreCatalog, prefsTick]);

  const [purchasedBookIds, setPurchasedBookIds] = useState<string[]>(() => {
    const existingIds = books.map(b => b.id);
    return allStoreCatalog.filter(item => existingIds.includes(item.id)).map(item => item.id);
  });

  // Keep purchasedBookIds in sync when books prop changes
  useEffect(() => {
    const existingIds = books.map(b => b.id);
    setPurchasedBookIds(allStoreCatalog.filter(item => existingIds.includes(item.id)).map(item => item.id));
  }, [books, allStoreCatalog]);
  
  const [activeModalItem, setActiveModalItem] = useState<Book | null>(null);
  const [purchaseStep, setPurchaseStep] = useState<'details' | 'buying' | 'success'>('details');

  const academicProfile = useMemo(
    () => extractUserAcademicProfile(profile, user),
    [profile, user, prefsTick]
  );

  const personalizedStoreCatalog = useMemo(
    () => getPersonalizedBooks(allStoreCatalog, academicProfile, { allowFallbackIfEmpty: true }),
    [allStoreCatalog, academicProfile]
  );

  const activeCatalog = catalogScope === 'personalized' && academicProfile.isConfigured
    ? personalizedStoreCatalog
    : allStoreCatalog;

  const aiRecommendedStoreBooks = useMemo(
    () => getAiRecommendedBooks(personalizedStoreCatalog, academicProfile, 3),
    [personalizedStoreCatalog, academicProfile]
  );

  const subjectFilterPills = useMemo(() => {
    if (academicProfile.subjects.length > 0 && catalogScope === 'personalized') {
      return ['All', ...academicProfile.subjects];
    }
    const cats = Array.from(new Set(activeCatalog.map(b => b.category).filter(Boolean)));
    return ['All', ...cats];
  }, [academicProfile.subjects, catalogScope, activeCatalog]);

  useEffect(() => {
    if (selectedCategory !== 'All' && !subjectFilterPills.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [subjectFilterPills, selectedCategory]);

  // Filter items across comprehensive criteria
  const q = searchQuery.toLowerCase().trim();
  const filteredItems = useMemo(() => {
    return activeCatalog.filter(item => {
      const matchesSearch = !q ||
                            item.title.toLowerCase().includes(q) || 
                            item.author.toLowerCase().includes(q) ||
                            (item.description && item.description.toLowerCase().includes(q)) ||
                            item.category.toLowerCase().includes(q) ||
                            (item.subjects && item.subjects.some(s => s.toLowerCase().includes(q))) ||
                            (item.curriculum && item.curriculum.some(c => c.toLowerCase().includes(q))) ||
                            (item.country && item.country.some(c => c.toLowerCase().includes(q)));
      
      const matchesCategory =
        selectedCategory === 'All' ||
        item.category === selectedCategory ||
        item.category.includes(selectedCategory) ||
        findMatchingUserSubjects(item, [selectedCategory]).length > 0 ||
        (item.subjects && item.subjects.some(s => s.toLowerCase() === selectedCategory.toLowerCase()));
      return matchesSearch && matchesCategory;
    });
  }, [activeCatalog, q, selectedCategory]);

  // Breakdown for dropdown
  const libraryBooks = useMemo(() => {
    if (!q) return [];
    const libraryIds = new Set(books.map(b => b.id));
    return books.filter(b => {
      return b.title.toLowerCase().includes(q) ||
             b.author.toLowerCase().includes(q) ||
             b.category.toLowerCase().includes(q) ||
             (b.subjects && b.subjects.some(s => s.toLowerCase().includes(q)));
    });
  }, [books, q]);

  const storeMatches = useMemo(() => {
    if (!q) return [];
    const libraryIds = new Set(books.map(b => b.id));
    return resolvedStoreCatalog.filter(b => {
      if (libraryIds.has(b.id)) return false;
      return b.title.toLowerCase().includes(q) ||
             b.author.toLowerCase().includes(q) ||
             b.category.toLowerCase().includes(q) ||
             (b.subjects && b.subjects.some(s => s.toLowerCase().includes(q)));
    });
  }, [books, resolvedStoreCatalog, q]);

  const relatedBooks = useMemo(() => {
    if (!q) return [];
    const libraryIds = new Set(books.map(b => b.id));
    const matchedCategories = new Set<string>();
    const matchedSubjects = new Set<string>();
    [...libraryBooks, ...storeMatches].forEach(b => {
      matchedCategories.add(b.category.toLowerCase());
      b.subjects?.forEach(s => matchedSubjects.add(s.toLowerCase()));
    });

    const directIds = new Set([...libraryBooks.map(b => b.id), ...storeMatches.map(b => b.id)]);
    const allPlatformBooks = [...books, ...resolvedStoreCatalog.filter(b => !libraryIds.has(b.id))];
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
  }, [books, libraryBooks, storeMatches, q]);

  const handleOpenPurchase = (item: Book) => {
    if (purchasedBookIds.includes(item.id)) {
      if (onBookSelect) {
        onBookSelect(item);
      }
      return; // Already owned
    }
    setActiveModalItem(item);
    setPurchaseStep('details');
  };

  const handleConfirmPurchase = () => {
    if (!activeModalItem) return;
    setPurchaseStep('buying');
    
    // Simulate interactive grant activation
    setTimeout(() => {
      setPurchasedBookIds(prev => [...prev, activeModalItem.id]);
      onAddBookToLibrary(activeModalItem);
      setPurchaseStep('success');
    }, 1200);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 pb-32 font-sans overflow-hidden">
      
      {/* Header section with branding */}
      <div className="mb-8 sm:mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6 w-full">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold text-xs sm:text-sm tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Premium Course Library</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenAcademicPrefs?.()}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
              title="Customize Country, Curriculum, Level & Subjects"
            >
              <span>{academicProfile.isConfigured ? academicProfile.summaryLabel : 'Set Academic Intake'}</span>
            </button>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Syllabus & Textbook Store</h2>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-300 mt-1 max-w-2xl">
            {academicProfile.isConfigured && catalogScope === 'personalized'
              ? `Curated textbooks, syllabus guides, and course packs matched to ${academicProfile.summaryLabel}${academicProfile.subjects.length > 0 ? ` • ${academicProfile.subjects.join(', ')}` : ''}.`
              : 'Browse and unlock official curriculum publications, accredited study materials, and academic course packs.'}
          </p>
        </div>
        
        {/* Wallet balance */}
        <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-2xl p-3.5 sm:p-4 flex items-center gap-3.5 sm:gap-4 shadow-lg border border-slate-800 dark:border-slate-700 w-full sm:w-auto shrink-0">
          <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center font-bold shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Available Grant Balance</div>
            <div className="text-lg sm:text-xl font-bold font-mono">KES 12,500.00</div>
          </div>
        </div>
      </div>

      {/* AI Recommended Syllabus Shelf */}
      {!q && aiRecommendedStoreBooks.length > 0 && (
        <section className="mb-8 p-4 sm:p-6 rounded-3xl bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/50 dark:from-slate-900 dark:via-[#16161d] dark:to-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  AI Recommended For Your Intake
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Top syllabus matches for {academicProfile.summaryLabel}
                </p>
              </div>
            </div>
            {academicProfile.isConfigured && (
              <button
                type="button"
                onClick={() => setCatalogScope(prev => prev === 'personalized' ? 'all' : 'personalized')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  catalogScope === 'personalized'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
              >
                {catalogScope === 'personalized' ? 'Matched To My Subjects' : 'Viewing Global Catalog'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiRecommendedStoreBooks.map(({ book, matchReason }) => {
              const isOwned = purchasedBookIds.includes(book.id);
              return (
                <div
                  key={`store-ai-${book.id}`}
                  onClick={() => handleOpenPurchase(book)}
                  className="bg-white dark:bg-slate-900/90 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 shadow-xs hover:shadow-md transition-all cursor-pointer flex gap-3.5 items-center group"
                >
                  <div className="w-14 h-20 aspect-[2/3] rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 shadow-xs">
                    <BookCoverVisual book={book} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-full max-w-full truncate mb-1">
                      <Sparkles className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{matchReason}</span>
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {book.title}
                    </h4>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]">{book.author}</span>
                      <span className={`text-[10px] font-bold ${isOwned ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {isOwned ? 'In Library' : 'Unlock'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Search & Subject Filter Bar */}
      <div className="space-y-3 mb-6 sm:mb-8 w-full max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search syllabus textbooks, authors, or subjects..."
              className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-300">
            Showing <span className="font-bold text-slate-800 dark:text-slate-200">{filteredItems.length}</span> matched textbooks
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {subjectFilterPills.map((pill) => (
            <button
              key={pill}
              type="button"
              onClick={() => setSelectedCategory(pill)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                selectedCategory === pill
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {pill}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid or Empty State */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-full">
          {filteredItems.map((item, idx) => {
          const isOwned = purchasedBookIds.includes(item.id);
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow group relative w-full min-w-0"
            >
              {/* Cover & General Badges */}
              <div className="p-4 sm:p-5 flex gap-3.5 sm:gap-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 w-full min-w-0">
                <div className="w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden shadow-md shrink-0 bg-slate-100 dark:bg-slate-800 relative">
                  <BookCoverVisual book={item} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                  <div>
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1.5 max-w-full truncate">
                      <Tag className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{item.category.split(',')[0]}</span>
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2 text-sm sm:text-base group-hover:text-indigo-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 truncate">{item.author}</p>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-amber-500 text-xs font-semibold mt-1">
                    <Star className="w-3.5 h-3.5 fill-current shrink-0" />
                    {item.rating}
                    <span className="text-slate-400 dark:text-slate-300 font-normal">({(idx + 12) * 5} reviews)</span>
                  </div>
                </div>
              </div>

              {/* Description & AI Insights preview */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 mb-4 leading-relaxed">
                    {item.description}
                  </p>
                  
                  {item.aiInsights && item.aiInsights.length > 0 && (
                    <div className="space-y-2 mb-4 bg-indigo-50/40 dark:bg-indigo-950/30 rounded-2xl p-3 border border-indigo-100/50 dark:border-indigo-900/30">
                      <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                        Sage AI Study Features
                      </div>
                      <ul className="space-y-1.5">
                        {item.aiInsights.slice(0, 2).map((insight, i) => (
                          <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                            <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                            <span className="line-clamp-1">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Purchase Button / Unlocked Status */}
                <div className="pt-2">
                  {isOwned ? (
                    <button
                      onClick={() => onBookSelect && onBookSelect(item)}
                      className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 shrink-0" />
                      In Your Library • Read Now
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenPurchase(item)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                    >
                      <ShoppingBag className="w-4 h-4 shrink-0" />
                      Unlock Syllabus Pack • KES 1,200
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      ) : (
        <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
          <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">No syllabus textbooks found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `We couldn't find any textbooks matching "${searchQuery}".`
              : 'No textbooks matched this specific filter.'}
          </p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
            className="mt-4 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Checkout Modal Overlay */}
      <AnimatePresence>
        {activeModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              {/* Detail view header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Unlock Premium Course</h3>
                <button
                  onClick={() => setActiveModalItem(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {purchaseStep === 'details' && (
                <div className="p-5 sm:p-6 space-y-5 sm:space-y-6">
                  <div className="flex gap-4">
                    <div className="w-16 h-24 rounded-lg overflow-hidden shadow bg-slate-100 dark:bg-slate-800 shrink-0">
                      <BookCoverVisual book={activeModalItem} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-slate-900 dark:text-white leading-tight text-sm sm:text-base line-clamp-2">{activeModalItem.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 truncate">{activeModalItem.author}</p>
                      <div className="text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm font-bold mt-2 font-mono">KES 1,200.00</div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-3 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Course Syllabus Features Included</div>
                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Full High-Fidelity Interactive Reading</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>Sage AI Chatbot Grounding for all chapters</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>Curriculum-aligned Quizzes and Study Goals</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <span>Payment Method:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      Educational Grant Wallet
                    </span>
                  </div>

                  <button
                    onClick={handleConfirmPurchase}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-2xl transition-colors cursor-pointer"
                  >
                    Confirm Purchase • KES 1,200.00
                  </button>
                </div>
              )}

              {purchaseStep === 'buying' && (
                <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin"></div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Authorizing Grant Funds...</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Acquiring syllabus materials for your study library.</p>
                  </div>
                </div>
              )}

              {purchaseStep === 'success' && (
                <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-100/50 dark:shadow-none">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">Syllabus Unlocked!</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 max-w-xs leading-relaxed">
                      "{activeModalItem.title}" has been added to your Library. You can now access full AI study notes and custom quizzes.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveModalItem(null)}
                    className="w-full py-3 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white text-xs font-semibold rounded-2xl transition-colors mt-4 cursor-pointer"
                  >
                    Close & Continue
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
