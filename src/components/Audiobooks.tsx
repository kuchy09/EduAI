import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book } from '../types';
import { Headphones, Play, Pause, SkipForward, SkipBack, Volume2, Sparkles, Clock, Star, PlayCircle, MessageSquareText, Radio, VolumeX, Search, X } from 'lucide-react';
import { BookCoverVisual } from './BookCoverVisual';
import {
  extractUserAcademicProfile,
  getPersonalizedBooks,
  getAiRecommendedBooks,
  findMatchingUserSubjects,
  buildPersonalizedNarration,
  ACADEMIC_PREFS_EVENT,
} from '../lib/bookPersonalization';

interface AudiobooksProps {
  books: Book[];
  onBookSelect: (book: Book) => void;
  user?: any;
  profile?: any;
  onOpenAcademicPrefs?: () => void;
}

const VOICE_PROFILES = [
  { id: 'seraphina', name: 'Seraphina', description: 'Deeply Calm & Clear', gender: 'Female', speed: '1.0x' },
  { id: 'marcus', name: 'Marcus', description: 'Dynamic Academic Scholar', gender: 'Male', speed: '1.1x' },
  { id: 'aria', name: 'Aria', description: 'Soft & Eloquent', gender: 'Female', speed: '0.95x' },
];

export function Audiobooks({ books, onBookSelect, user, profile, onOpenAcademicPrefs }: AudiobooksProps) {
  const [prefsTick, setPrefsTick] = useState(0);
  const [catalogScope, setCatalogScope] = useState<'personalized' | 'all'>('personalized');

  useEffect(() => {
    const onPrefsUpdated = () => setPrefsTick((t) => t + 1);
    window.addEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
    return () => window.removeEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
  }, []);

  const academicProfile = useMemo(
    () => extractUserAcademicProfile(profile, user),
    [profile, user, prefsTick]
  );

  const personalizedAudiobooks = useMemo(
    () => getPersonalizedBooks(books, academicProfile, { allowFallbackIfEmpty: true, includeStartedBooks: true }),
    [books, academicProfile]
  );

  const activeAudioCatalog = catalogScope === 'personalized' && academicProfile.isConfigured
    ? personalizedAudiobooks
    : books;

  const aiRecommendedAudiobooks = useMemo(
    () => getAiRecommendedBooks(personalizedAudiobooks, academicProfile, 3),
    [personalizedAudiobooks, academicProfile]
  );

  const [playingBook, setPlayingBook] = useState<Book | null>(() => personalizedAudiobooks[0] || books[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(35); // percentage
  const [selectedVoice, setSelectedVoice] = useState('seraphina');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Keep playingBook aligned with user's personalized shelf when profile/books load
  useEffect(() => {
    if (activeAudioCatalog.length === 0) return;
    if (!playingBook || !activeAudioCatalog.some((b) => b.id === playingBook.id)) {
      setPlayingBook(activeAudioCatalog[0]);
      setCurrentParagraphIndex(0);
    }
  }, [activeAudioCatalog, playingBook]);

  // Load prefilled search query if navigating from Header
  useEffect(() => {
    try {
      const prefill = localStorage.getItem('edu_search_prefill');
      if (prefill) {
        setSearchQuery(prefill);
        localStorage.removeItem('edu_search_prefill');
      }
    } catch (_) {}
  }, []);

  // Animated visualizer heights
  const [visualizerHeights, setVisualizerHeights] = useState<number[]>([15, 25, 45, 10, 30, 20, 50, 25, 15, 40]);

  // Personalized, textbook-specific audiobook narration paragraphs
  const narrationParagraphs = useMemo(
    () => buildPersonalizedNarration(playingBook, academicProfile),
    [playingBook, academicProfile]
  );

  // Tick the playback progress when isPlaying is true
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setPlaybackProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          // Cycle narration paragraph every ~25% progress
          const segment = Math.floor((prev + 0.8) / 25);
          if (segment !== currentParagraphIndex && segment < narrationParagraphs.length) {
            setCurrentParagraphIndex(segment);
          }
          return prev + 0.8;
        });

        // Randomize visualizer heights for nice waveform effect
        setVisualizerHeights(prev => prev.map(() => Math.floor(Math.random() * 45) + 8));
      }, 300);
    } else {
      // Steady idle visualizer
      setVisualizerHeights([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentParagraphIndex]);

  const formatProgressTime = (progressPercent: number) => {
    const totalSeconds = 745; // 12 mins, 25 secs
    const currentSeconds = Math.floor((progressPercent / 100) * totalSeconds);
    
    const formatTime = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return {
      current: formatTime(currentSeconds),
      total: formatTime(totalSeconds)
    };
  };

  const time = formatProgressTime(playbackProgress);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setPlaybackProgress(value);
    const segment = Math.floor(value / 25);
    if (segment < narrationParagraphs.length) {
      setCurrentParagraphIndex(segment);
    }
  };

  const subjectPills = useMemo(() => {
    if (academicProfile.subjects.length > 0 && catalogScope === 'personalized') {
      return ['All', ...academicProfile.subjects];
    }
    const cats = Array.from(new Set(activeAudioCatalog.map((b) => b.category.split(',')[0]).filter(Boolean)));
    return ['All', ...cats];
  }, [academicProfile.subjects, catalogScope, activeAudioCatalog]);

  useEffect(() => {
    if (selectedCategory !== 'All' && !subjectPills.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [subjectPills, selectedCategory]);

  const filteredAudiobooks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return activeAudioCatalog.filter((book) => {
      const matchesSubjectPill =
        selectedCategory === 'All' ||
        findMatchingUserSubjects(book, [selectedCategory]).length > 0 ||
        book.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        (book.subjects && book.subjects.some((s) => s.toLowerCase() === selectedCategory.toLowerCase()));

      if (!matchesSubjectPill) return false;
      if (!q) return true;
      const matchesTitle = book.title.toLowerCase().includes(q);
      const matchesAuthor = book.author.toLowerCase().includes(q);
      const matchesCategory = book.category.toLowerCase().includes(q);
      const matchesSubjects = book.subjects?.some((s) => s.toLowerCase().includes(q)) || false;
      return matchesTitle || matchesAuthor || matchesCategory || matchesSubjects;
    });
  }, [activeAudioCatalog, searchQuery, selectedCategory]);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 select-none" id="audiobooks-view-container">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="p-1.5 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Headphones className="w-5 h-5 animate-pulse" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Edu AI Audio Sync
            </span>
            <button
              type="button"
              onClick={() => onOpenAcademicPrefs?.()}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
              title="Customize Country, Curriculum, Level & Subjects"
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>{academicProfile.isConfigured ? academicProfile.summaryLabel : 'Set Academic Intake'}</span>
            </button>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight mb-2">
            AI Audiobooks
          </h2>
          <p className="text-slate-500 dark:text-slate-300 text-sm sm:text-base">
            {academicProfile.isConfigured && catalogScope === 'personalized'
              ? `Tutor-narrated syllabus audiobooks matched to ${academicProfile.summaryLabel}${academicProfile.subjects.length > 0 ? ` (${academicProfile.subjects.join(', ')})` : ''}.`
              : 'Listen to expert AI-narrated books with synchronized highlight tracking.'}
          </p>
        </div>

        {academicProfile.isConfigured && (
          <button
            type="button"
            onClick={() => setCatalogScope((prev) => (prev === 'personalized' ? 'all' : 'personalized'))}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer self-start md:self-auto ${
              catalogScope === 'personalized'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800'
            }`}
          >
            {catalogScope === 'personalized' ? 'My Curriculum Shelf' : 'Showing All Audiobooks'}
          </button>
        )}
      </div>

      {/* AI Recommended Audiobooks Shelf */}
      {!searchQuery && aiRecommendedAudiobooks.length > 0 && (
        <section className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 dark:from-slate-900 dark:via-[#16161d] dark:to-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-3.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                AI Recommended Audiobooks For Your Subjects
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Personalized listening queue for {academicProfile.summaryLabel}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {aiRecommendedAudiobooks.map(({ book, matchReason }) => {
              const active = playingBook?.id === book.id;
              return (
                <div
                  key={`ai-audio-${book.id}`}
                  onClick={() => {
                    setPlayingBook(book);
                    setIsPlaying(true);
                    setPlaybackProgress(0);
                    setCurrentParagraphIndex(0);
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex gap-3 items-center group ${
                    active
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-xs'
                      : 'bg-white/90 dark:bg-slate-900/90 border-slate-200/70 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600'
                  }`}
                >
                  <div className="w-12 h-18 aspect-[2/3] rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 shadow-xs">
                    <BookCoverVisual book={book} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-full max-w-full truncate mb-1">
                      <Sparkles className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{matchReason}</span>
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Now Playing Immersive Card */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-xl dark:shadow-2xl relative overflow-hidden" id="now-playing-card">
            
            {/* Ambient Background Glow matching the current book */}
            <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-indigo-400/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-violet-400/10 blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row gap-6 relative z-10">
              {/* Cover Art Box with pulse ring if playing */}
              <div className="flex-shrink-0 flex justify-center sm:justify-start">
                <div className="relative">
                  {isPlaying && (
                    <span className="absolute -inset-1.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 opacity-30 blur animate-pulse" />
                  )}
                  <div className="w-[120px] h-[180px] rounded-xl overflow-hidden shadow-lg border border-slate-200/50 dark:border-slate-800">
                    {playingBook ? (
                      <BookCoverVisual book={playingBook} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                        <Headphones className="w-10 h-10 text-slate-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Narrated Info / Voice Selection */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                      HQ AI Voice
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-300 font-medium">
                      Est. 45 mins
                    </span>
                  </div>
                  <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white leading-snug tracking-tight truncate">
                    {playingBook ? playingBook.title : 'Select an Audiobook'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300 font-medium">
                    by {playingBook ? playingBook.author : 'Edu AI Reader'}
                  </p>
                </div>

                {/* Voice Profile Picker */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> AI Narrator Voice
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {VOICE_PROFILES.map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => setSelectedVoice(voice.id)}
                        className={`py-2 px-1 text-center rounded-lg border text-xs font-medium transition-all focus:outline-none ${
                          selectedVoice === voice.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                            : 'bg-slate-50/50 dark:bg-slate-900/50 border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="block text-[11px] truncate">{voice.name}</span>
                        <span className="block text-[9px] opacity-60 font-normal scale-90 truncate">{voice.gender}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Immersive Audio Progress Bar */}
            <div className="mt-8 space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-400 dark:text-slate-300 font-mono">
                <span>{time.current}</span>
                
                {/* Simulated Waveform Visualization */}
                <div className="flex items-end gap-0.5 h-[16px] px-2">
                  {visualizerHeights.map((h, i) => (
                    <motion.span
                      key={i}
                      animate={{ height: h }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="w-1 rounded-t-sm bg-indigo-500/70"
                    />
                  ))}
                </div>

                <span>{time.total}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={playbackProgress}
                onChange={handleSeek}
                className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-400 focus:outline-none"
              />
            </div>

            {/* Premium Control Dock Buttons */}
            <div className="mt-6 flex items-center justify-between">
              {/* Playback speed switcher */}
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-full p-1">
                {[1.0, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                      playbackSpeed === speed
                        ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                        : 'text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-400'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              {/* Core playback controls */}
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setPlaybackProgress(Math.max(0, playbackProgress - 10))}
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title="Rewind 10s"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-4 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
                </button>

                <button 
                  onClick={() => setPlaybackProgress(Math.min(100, playbackProgress + 10))}
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title="Forward 10s"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              {/* Mute button */}
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="p-2.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-300 rounded-full transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Sync Narration text panel */}
          <div className="bg-[#FAF8F5] dark:bg-[#121214] border border-amber-900/5 dark:border-white/5 rounded-2xl p-6 space-y-4 shadow-sm" id="synchronized-script-panel">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareText className="w-4 h-4 text-amber-600/70" /> Live Synchronized Highlight
              </span>
              <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded">
                Chapter 1: Foundations
              </span>
            </div>

            <div className="font-serif text-[17px] leading-relaxed text-slate-800 dark:text-slate-200 space-y-4">
              {narrationParagraphs.map((para, index) => (
                <motion.p
                  key={index}
                  animate={{
                    opacity: index === currentParagraphIndex ? 1 : 0.4,
                    scale: index === currentParagraphIndex ? 1.01 : 1,
                  }}
                  transition={{ duration: 0.4 }}
                  className={`p-2.5 rounded-lg transition-all ${
                    index === currentParagraphIndex
                      ? 'bg-amber-500/10 dark:bg-amber-400/5 text-slate-900 dark:text-white font-medium border-l-2 border-indigo-500'
                      : 'border-l-2 border-transparent'
                  }`}
                >
                  {para}
                </motion.p>
              ))}
            </div>

            {playingBook && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => onBookSelect(playingBook)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  Open in Full Reader Screen <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Audiobooks Playlist Grid */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300">
              Audio Library ({filteredAudiobooks.length})
            </h4>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer"
              >
                Clear filter
              </button>
            )}
          </div>

          {/* Functional Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, author, or subject..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                title="Clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Subject Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {subjectPills.map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() => setSelectedCategory(pill)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  selectedCategory === pill
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {pill}
              </button>
            ))}
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[520px] pr-1" id="audiobook-playlist-scroller">
            {filteredAudiobooks.length > 0 ? (
              filteredAudiobooks.map((book) => {
                const isSelected = playingBook?.id === book.id;
                return (
                  <motion.div
                    key={book.id}
                    onClick={() => {
                      setPlayingBook(book);
                      setIsPlaying(true);
                      setPlaybackProgress(0);
                      setCurrentParagraphIndex(0);
                    }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex gap-4 ${
                      isSelected
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {/* Thumbnail Cover */}
                    <div className="w-[50px] h-[75px] rounded-lg overflow-hidden shadow-sm flex-shrink-0 border border-slate-200/50 dark:border-slate-800">
                      <BookCoverVisual book={book} className="w-full h-full object-cover" />
                    </div>

                    {/* Audio metadata info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-300 uppercase tracking-wider">
                            {book.category.split(',')[0]}
                          </span>
                          {isSelected && isPlaying ? (
                            <span className="flex gap-0.5 items-end h-[10px] pr-1">
                              <span className="w-0.5 h-1.5 bg-indigo-500 animate-[pulse_0.8s_infinite]" />
                              <span className="w-0.5 h-2.5 bg-indigo-500 animate-[pulse_0.6s_infinite]" />
                              <span className="w-0.5 h-2 bg-indigo-500 animate-[pulse_0.7s_infinite]" />
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> 12m
                            </span>
                          )}
                        </div>
                        <h5 className={`text-sm font-semibold truncate leading-snug ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                          {book.title}
                        </h5>
                        <p className="text-xs text-slate-400 dark:text-slate-300 truncate">
                          by {book.author}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-300">
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {book.rating}
                        </span>
                        {isSelected ? (
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-xs flex items-center gap-1">
                            {isPlaying ? 'Playing Now' : 'Selected'}
                          </span>
                        ) : (
                          <span className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs flex items-center gap-1 font-medium transition-colors">
                            <PlayCircle className="w-4 h-4" /> Listen
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <Headphones className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No audiobooks found</p>
                <p className="text-xs text-slate-400 mt-1">No audiobooks match "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

const ChevronRight = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);
