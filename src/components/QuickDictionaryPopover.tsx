import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, VolumeX, Sparkles, BookOpen, Bookmark, 
  Check, Copy, X, Search, ChevronRight, ArrowRight, ExternalLink,
  BookMarked, Lightbulb, Loader2
} from 'lucide-react';
import { DictionaryEntry, lookupWordDefinition } from '../lib/dictionaryData';

interface QuickDictionaryPopoverProps {
  word: string;
  contextSentence?: string;
  position: { x: number; y: number };
  theme?: 'sepia' | 'dark' | 'amoled';
  bookTitle?: string;
  onClose: () => void;
  onAskAi?: (query: string) => void;
  onSaveToVocabulary?: (entry: DictionaryEntry) => void;
}

export function QuickDictionaryPopover({
  word,
  contextSentence,
  position,
  theme = 'sepia',
  bookTitle,
  onClose,
  onAskAi,
  onSaveToVocabulary
}: QuickDictionaryPopoverProps) {
  const [currentWord, setCurrentWord] = useState(word);
  const [searchInput, setSearchInput] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Check if saved to vocabulary in localStorage
  useEffect(() => {
    try {
      const savedList = JSON.parse(localStorage.getItem('edu_vocabulary_list') || '[]');
      const found = savedList.some((item: any) => item.word.toLowerCase() === currentWord.toLowerCase().trim());
      setIsSaved(found);
    } catch (e) {
      setIsSaved(false);
    }
  }, [currentWord]);

  // Load definition whenever currentWord changes
  useEffect(() => {
    let active = true;
    setLoading(true);
    lookupWordDefinition(currentWord)
      .then((data) => {
        if (active) {
          setEntry(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setEntry({
            word: currentWord,
            definition: `No online or local definition found for "${currentWord}". Try searching or ask Edu AI for in-depth textbook context.`,
            partOfSpeech: 'term'
          });
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentWord]);

  // Handle outside click to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [onClose]);

  // Pronounce word using Web Speech API
  const handlePronounce = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(entry?.word || currentWord);
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Copy definition
  const handleCopy = () => {
    if (!entry) return;
    const textToCopy = `${entry.word.toUpperCase()} (${entry.partOfSpeech || 'term'})${entry.phonetic ? ' ' + entry.phonetic : ''}\nDefinition: ${entry.definition}\n${entry.example ? 'Example: ' + entry.example : ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Toggle Save to Vocabulary Deck
  const handleToggleSave = () => {
    if (!entry) return;
    try {
      const savedList = JSON.parse(localStorage.getItem('edu_vocabulary_list') || '[]');
      const cleanW = entry.word.toLowerCase().trim();
      const existingIndex = savedList.findIndex((item: any) => item.word.toLowerCase() === cleanW);
      
      let updatedList = [];
      if (existingIndex >= 0) {
        updatedList = savedList.filter((item: any) => item.word.toLowerCase() !== cleanW);
        setIsSaved(false);
      } else {
        const newVocabItem = {
          id: Date.now().toString(),
          word: entry.word,
          phonetic: entry.phonetic,
          partOfSpeech: entry.partOfSpeech,
          definition: entry.definition,
          example: entry.example,
          category: entry.category || 'General',
          bookTitle: bookTitle || 'Edu AI Reader',
          savedAt: new Date().toISOString()
        };
        updatedList = [newVocabItem, ...savedList];
        setIsSaved(true);
        onSaveToVocabulary?.(entry);
      }
      localStorage.setItem('edu_vocabulary_list', JSON.stringify(updatedList));
    } catch (e) {
      console.error('Failed to update vocabulary list', e);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setCurrentWord(searchInput.trim());
      setSearchInput('');
      setShowSearch(false);
    }
  };

  // Calculate safe on-screen coordinates
  const popoverWidth = typeof window !== 'undefined' ? Math.min(340, window.innerWidth - 32) : 340;
  const leftPos = typeof window !== 'undefined' 
    ? Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, position.x - popoverWidth / 2))
    : position.x;
  
  // Decide whether to place above or below the selection
  const topPos = typeof window !== 'undefined'
    ? position.y > 380 
      ? Math.max(16, position.y - 340) // place above
      : Math.min(window.innerHeight - 360, position.y + 24) // place below
    : position.y;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <motion.div
        ref={popoverRef}
        initial={{ opacity: 0, scale: 0.9, y: position.y > 380 ? 12 : -12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
        style={{
          left: `${leftPos}px`,
          top: `${topPos}px`,
          width: `${popoverWidth}px`,
        }}
        className={`pointer-events-auto liquid-glass-dock rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] overflow-hidden border font-sans select-none flex flex-col max-h-[420px] ${
          theme === 'sepia' 
            ? 'border-amber-900/15 bg-[#F9F5EB]/95 text-[#2C2925]' 
            : theme === 'amoled'
            ? 'border-white/20 bg-black/95 text-white'
            : 'border-white/20 bg-[#1C1C1E]/95 text-stone-100'
        }`}
      >
        {/* Specular rim top light */}
        <div className="absolute top-0 inset-x-6 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/25 to-transparent pointer-events-none" />

        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider opacity-60">Quick Dictionary</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSearch(prev => !prev)}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
              title="Search another word"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleToggleSave}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isSaved 
                  ? 'text-amber-500 bg-amber-500/15' 
                  : 'hover:bg-black/5 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300'
              }`}
              title={isSaved ? "Saved in Vocabulary" : "Save to Vocabulary Flashcards"}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-stone-500 hover:text-stone-800 dark:hover:text-white transition-colors cursor-pointer"
              title="Close Dictionary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Optional Search Input Bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleSearchSubmit}
              className="px-3 py-2 border-b border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center gap-2 overflow-hidden"
            >
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Look up any word..."
                autoFocus
                className="flex-1 bg-white/70 dark:bg-stone-800/70 px-3 py-1.5 rounded-xl text-xs outline-none border border-black/10 dark:border-white/10 placeholder:opacity-50 text-stone-900 dark:text-white"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-medium cursor-pointer shadow-sm active:scale-95 transition-transform"
              >
                Find
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar text-xs">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-stone-500">
              <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
              <span className="text-[11px]">Searching vocabulary definitions...</span>
            </div>
          ) : entry ? (
            <>
              {/* Word & Phonetics Title */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold font-serif capitalize tracking-tight flex items-center gap-2">
                    {entry.word}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {entry.phonetic && (
                      <span className="text-stone-500 dark:text-stone-400 font-mono text-[11px]">
                        {entry.phonetic}
                      </span>
                    )}
                    {entry.partOfSpeech && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-500/20">
                        {entry.partOfSpeech}
                      </span>
                    )}
                    {entry.category && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/5 dark:bg-white/10 opacity-75">
                        {entry.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pronounce Button */}
                <button
                  onClick={handlePronounce}
                  className={`p-2 rounded-2xl transition-all cursor-pointer shadow-sm ${
                    isSpeaking 
                      ? 'bg-brand-500 text-white animate-pulse' 
                      : 'liquid-glass-card hover:scale-105 active:scale-95 text-stone-700 dark:text-stone-200'
                  }`}
                  title="Listen to pronunciation"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* Primary Definition */}
              <div className="space-y-1">
                <p className="text-[13px] leading-relaxed font-normal opacity-90">
                  {entry.definition}
                </p>
                {entry.secondaryDefinition && (
                  <p className="text-[11px] leading-relaxed opacity-70 italic pt-1 border-t border-black/5 dark:border-white/5">
                    {entry.secondaryDefinition}
                  </p>
                )}
              </div>

              {/* Example sentence */}
              {entry.example && (
                <div className="p-2.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1 text-[10px] font-semibold opacity-60">
                    <Lightbulb className="w-3 h-3 text-amber-500" />
                    <span>EXAMPLE IN USAGE</span>
                  </div>
                  <p className="italic text-[11px] opacity-80 leading-relaxed">
                    "{entry.example}"
                  </p>
                </div>
              )}

              {/* Synonyms / Related terms */}
              {entry.synonyms && entry.synonyms.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Related & Synonyms:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.synonyms.map((syn, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => setCurrentWord(syn)}
                        className="px-2 py-0.5 rounded-full text-[10px] liquid-glass-pill hover:bg-brand-500/20 hover:text-brand-700 dark:hover:text-brand-300 transition-colors cursor-pointer"
                      >
                        {syn}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="p-2 border-t border-black/5 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] flex items-center justify-between gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 text-xs font-medium transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {onAskAi && (
            <button
              onClick={() => {
                const prompt = `Explain the term "${currentWord}" in the context of the book "${bookTitle || 'the current chapter'}". Provide its definition, real-world analogies, and a practical practice question.`;
                onAskAi(prompt);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Deep-Dive with Edu AI</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
