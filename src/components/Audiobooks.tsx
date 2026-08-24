import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book } from '../types';
import { Headphones, Play, Pause, SkipForward, SkipBack, Volume2, Sparkles, Clock, Star, PlayCircle, MessageSquareText, Radio, VolumeX, Search, X } from 'lucide-react';
import { BookCoverVisual } from './BookCoverVisual';

interface AudiobooksProps {
  books: Book[];
  onBookSelect: (book: Book) => void;
  user?: any;
  profile?: any;
}

const VOICE_PROFILES = [
  { id: 'seraphina', name: 'Seraphina', description: 'Deeply Calm & Clear', gender: 'Female', speed: '1.0x' },
  { id: 'marcus', name: 'Marcus', description: 'Dynamic Academic Scholar', gender: 'Male', speed: '1.1x' },
  { id: 'aria', name: 'Aria', description: 'Soft & Eloquent', gender: 'Female', speed: '0.95x' },
];

export function Audiobooks({ books, onBookSelect, user, profile }: AudiobooksProps) {
  const [playingBook, setPlayingBook] = useState<Book | null>(books[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(35); // percentage
  const [selectedVoice, setSelectedVoice] = useState('seraphina');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Load prefilled search query if navigating from Header
  useEffect(() => {
    const prefill = localStorage.getItem('edu_search_prefill');
    if (prefill) {
      setSearchQuery(prefill);
      localStorage.removeItem('edu_search_prefill');
    }
  }, []);

  // Animated visualizer heights
  const [visualizerHeights, setVisualizerHeights] = useState<number[]>([15, 25, 45, 10, 30, 20, 50, 25, 15, 40]);

  // Simulated audiobook narration paragraphs
  const narrationParagraphs = [
    "In our modern scientific era, the pursuit of fundamental truths requires challenging standard intuition. Physics is the language through which nature speaks its deepest mathematical secrets.",
    "When Dirac formulated the relativistic wave equation, he was guided by a profound sense of mathematical beauty. The existence of antimatter was not just a theoretical speculation, but an inevitable consequence.",
    "To fully grasp quantum mechanics, we must shed our macro-world biases. The microscopic world is governed by probabilities, superposition, and non-local entanglement.",
    "Every physical model we construct is an approximation—a shadow of the deeper reality that lies just beyond our current mathematical horizons.",
  ];

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

  const filteredAudiobooks = books.filter(book => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchesTitle = book.title.toLowerCase().includes(q);
    const matchesAuthor = book.author.toLowerCase().includes(q);
    const matchesCategory = book.category.toLowerCase().includes(q);
    const matchesSubjects = book.subjects?.some(s => s.toLowerCase().includes(q)) || false;
    return matchesTitle || matchesAuthor || matchesCategory || matchesSubjects;
  });

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 select-none" id="audiobooks-view-container">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Headphones className="w-5 h-5 animate-pulse" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Edu AI Audio Sync
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight mb-2">
            AI Audiobooks
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Listen to expert AI-narrated books with synchronized highlight tracking.
          </p>
        </div>
      </div>

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
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      Est. 45 mins
                    </span>
                  </div>
                  <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white leading-snug tracking-tight truncate">
                    {playingBook ? playingBook.title : 'Select an Audiobook'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    by {playingBook ? playingBook.author : 'Edu AI Reader'}
                  </p>
                </div>

                {/* Voice Profile Picker */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
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
                            : 'bg-slate-50/50 dark:bg-slate-900/50 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
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
              <div className="flex justify-between items-center text-xs text-slate-400 dark:text-slate-500 font-mono">
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
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
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
                className="p-2.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-full transition-colors"
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
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
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
                          <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
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
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                          by {book.author}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
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
