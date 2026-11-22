import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Book, Bookmark } from '../types';
import {
  Headphones,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Sparkles,
  BookOpen,
  Search,
  X,
  ChevronRight,
  BookmarkPlus,
  Check,
  HardDriveDownload,
  Loader2,
  RefreshCw,
  MessageSquareText,
  WifiOff,
  AlertCircle,
  Star,
} from 'lucide-react';
import { BookCoverVisual } from './BookCoverVisual';
import { ConceptVisualizerCard } from './ConceptVisualizerCard';
import { useOffline } from '../lib/useOffline';
import {
  extractUserAcademicProfile,
  getPersonalizedBooks,
  getAiRecommendedBooks,
  findMatchingUserSubjects,
  ACADEMIC_PREFS_EVENT,
} from '../lib/bookPersonalization';
import {
  AudiobookChapterScript,
  AudiobookSegment,
  ExtractedBookChapter,
  RankedBrowserVoice,
  buildLocalConceptSegmentsFromChapter,
  cacheFullChapterAudioOffline,
  extractLibraryBookChapters,
  fetchAudiobookChapterScript,
  fetchOrGetCachedSegmentAudioUrl,
  getAudioResumeState,
  getCachedAudiobookScriptLocal,
  getRankedBrowserVoices,
  hasCachedSegmentAudio,
  pickBrowserVoiceForProfile,
  saveAudioProgressAndSyncLibrary,
  splitIntoHumanSpeechChunks,
} from '../lib/audiobookService';

interface AudiobooksProps {
  books: Book[];
  bookmarks?: Bookmark[];
  initialBookId?: string | null;
  onConsumeInitialBook?: () => void;
  onBookSelect: (book: Book) => void;
  onOpenInReader?: (book: Book) => void;
  onUpdateProgress?: (bookId: string, progress: number) => void;
  onAddBookmark?: (bookmark: Bookmark) => void;
  onAskAiAboutBook?: (book: Book, topicPrompt?: string) => void;
  user?: any;
  profile?: any;
  onOpenAcademicPrefs?: () => void;
}

const VOICE_PROFILES = [
  { id: 'seraphina', name: 'Seraphina', role: 'Warm Mentor', gender: 'Female' },
  { id: 'marcus', name: 'Marcus', role: 'Academic Scholar', gender: 'Male' },
  { id: 'aria', name: 'Aria', role: 'Lucid Explainer', gender: 'Female' },
];

const SPEED_OPTIONS = [0.85, 1.0, 1.25, 1.5];

function formatSeconds(secs: number): string {
  const safe = Math.max(0, Math.floor(secs || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function Audiobooks({
  books,
  bookmarks = [],
  initialBookId,
  onConsumeInitialBook,
  onBookSelect,
  onOpenInReader,
  onUpdateProgress,
  onAddBookmark,
  onAskAiAboutBook,
  user,
  profile,
  onOpenAcademicPrefs,
}: AudiobooksProps) {
  const [prefsTick, setPrefsTick] = useState(0);
  const [playlistMode, setPlaylistMode] = useState<'personalized' | 'all' | 'offline'>('all');
  const { isOnline, cachedBookIds, isBookCached } = useOffline();

  useEffect(() => {
    const onPrefsUpdated = () => setPrefsTick((t) => t + 1);
    window.addEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
    return () => window.removeEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
  }, []);

  const academicProfile = useMemo(
    () => extractUserAcademicProfile(profile, user),
    [profile, user, prefsTick]
  );

  // Default to personalized shelf when academic intake is configured
  useEffect(() => {
    if (academicProfile.isConfigured) {
      setPlaylistMode((prev) => (prev === 'all' ? 'personalized' : prev));
    }
  }, [academicProfile.isConfigured]);

  const personalizedAudiobooks = useMemo(
    () => getPersonalizedBooks(books, academicProfile, { allowFallbackIfEmpty: true, includeStartedBooks: true }),
    [books, academicProfile]
  );

  const activeAudioCatalog = useMemo(() => {
    if (playlistMode === 'offline') {
      return books.filter((b) => cachedBookIds.has(b.id));
    }
    if (playlistMode === 'personalized' && academicProfile.isConfigured) {
      return personalizedAudiobooks;
    }
    return books;
  }, [playlistMode, books, cachedBookIds, academicProfile.isConfigured, personalizedAudiobooks]);

  const aiRecommendedAudiobooks = useMemo(
    () => getAiRecommendedBooks(personalizedAudiobooks, academicProfile, 3),
    [personalizedAudiobooks, academicProfile]
  );

  const [playingBook, setPlayingBook] = useState<Book | null>(() => {
    if (initialBookId) {
      const target = books.find((b) => b.id === initialBookId);
      if (target) return target;
    }
    return personalizedAudiobooks[0] || books[0] || null;
  });

  // Handle incoming book launch from Library / BookDetail
  useEffect(() => {
    if (!initialBookId || books.length === 0) return;
    const match = books.find((b) => b.id === initialBookId);
    if (match) {
      setPlayingBook(match);
      setPlaylistMode((prev) => {
        if (prev === 'offline' && !cachedBookIds.has(match.id)) return 'all';
        return prev;
      });
      setAutoPlayOnLoad(true);
    }
    onConsumeInitialBook?.();
  }, [initialBookId, books, cachedBookIds, onConsumeInitialBook]);

  // Keep playingBook synced with latest progress / metadata from parent Library state
  useEffect(() => {
    if (books.length === 0) return;
    if (!playingBook) {
      setPlayingBook(activeAudioCatalog[0] || books[0] || null);
      return;
    }
    const updated = books.find((b) => b.id === playingBook.id);
    if (updated && updated !== playingBook) {
      setPlayingBook(updated);
    }
  }, [books, activeAudioCatalog, playingBook]);

  // Prefill search if navigated from global header
  useEffect(() => {
    try {
      const prefill = localStorage.getItem('edu_search_prefill');
      if (prefill) {
        setSearchQuery(prefill);
        localStorage.removeItem('edu_search_prefill');
      }
    } catch (_) {}
  }, []);

  // Book Chapters & Generated Script State
  const [bookChapters, setBookChapters] = useState<ExtractedBookChapter[]>([]);
  const [chapterIndex, setChapterIndex] = useState<number>(0);
  const [script, setScript] = useState<AudiobookChapterScript | null>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [sourceReadMode, setSourceReadMode] = useState<'tutor' | 'verbatim'>('tutor');

  // Playback & Voice Engine State
  const [selectedVoice, setSelectedVoice] = useState<string>('seraphina');
  const [voiceEngine, setVoiceEngine] = useState<'studio' | 'device'>('studio');
  const [browserVoices, setBrowserVoices] = useState<RankedBrowserVoice[]>([]);
  const [preferredBrowserVoiceUri, setPreferredBrowserVoiceUri] = useState<string>('');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [autoPlayOnLoad, setAutoPlayOnLoad] = useState<boolean>(false);
  const [isSynthesizingAudio, setIsSynthesizingAudio] = useState<boolean>(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [segmentElapsed, setSegmentElapsed] = useState<number>(0);
  const [segmentDuration, setSegmentDuration] = useState<number>(0);

  // Offline Audio Cache & Bookmark Feedback
  const [isCachingOfflineAudio, setIsCachingOfflineAudio] = useState(false);
  const [offlineAudioProgress, setOfflineAudioProgress] = useState<{ done: number; total: number } | null>(null);
  const [chapterAudioCached, setChapterAudioCached] = useState(false);
  const [justBookmarkedSegId, setJustBookmarkedSegId] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);
  const playbackSessionRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const speechPauseTimerRef = useRef<number | null>(null);
  const segmentRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Load ranked neural/natural browser voices as soon as OS voices populate
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const refreshVoices = () => {
      setBrowserVoices(getRankedBrowserVoices(selectedVoice));
    };
    refreshVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoices);
    };
  }, [selectedVoice]);

  // Derive active playable segments (AI Tutor script OR structural textbook + concept extraction)
  const effectiveSegments: AudiobookSegment[] = useMemo(() => {
    if (sourceReadMode === 'tutor' && script?.segments && script.segments.length > 0) {
      return script.segments;
    }
    const ch = bookChapters[chapterIndex] || bookChapters[0];
    if (!ch || !playingBook) return [];
    return buildLocalConceptSegmentsFromChapter(playingBook, ch.title, ch.text);
  }, [sourceReadMode, script, bookChapters, chapterIndex, playingBook]);

  const currentSegment = effectiveSegments[currentSegmentIndex] || null;
  const activeChapterTitle =
    script?.chapterTitle ||
    bookChapters[chapterIndex]?.title ||
    (playingBook ? `Chapter ${chapterIndex + 1}: ${playingBook.title}` : 'Select a Book');

  // Stop any active audio or speech synthesis cleanly
  const stopAudioEngines = useCallback(() => {
    playbackSessionRef.current += 1;
    if (speechPauseTimerRef.current !== null) {
      window.clearTimeout(speechPauseTimerRef.current);
      speechPauseTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSynthesizingAudio(false);
  }, []);

  useEffect(() => {
    return () => {
      stopAudioEngines();
    };
  }, [stopAudioEngines]);

  // Step 1: When playingBook changes, extract real Library chapters & restore resume state
  useEffect(() => {
    if (!playingBook) return;
    let cancelled = false;
    stopAudioEngines();
    setIsPlaying(false);
    setScript(null);
    setScriptError(null);
    setAudioNotice(null);
    setSegmentElapsed(0);
    setSegmentDuration(0);

    const resume = getAudioResumeState(playingBook.id);
    if (resume?.voiceId) {
      setSelectedVoice(resume.voiceId);
    }

    (async () => {
      setIsLoadingScript(true);
      try {
        const chapters = await extractLibraryBookChapters(playingBook);
        if (cancelled) return;
        setBookChapters(chapters);
        const startChap =
          resume && resume.chapterIndex >= 0 && resume.chapterIndex < chapters.length
            ? resume.chapterIndex
            : 0;
        const startSeg = resume && resume.chapterIndex === startChap ? resume.segmentIndex : 0;
        setChapterIndex(startChap);
        setCurrentSegmentIndex(startSeg);
      } catch (err: any) {
        if (cancelled) return;
        setScriptError(err?.message || 'Unable to load chapters for this book.');
        setIsLoadingScript(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playingBook?.id, stopAudioEngines]);

  // Step 2: Load AI Tutor Zero-Loss Script + Multimodal Concept Prompts for (playingBook, chapterIndex)
  const loadChapterScript = useCallback(
    async (forceRefresh = false) => {
      if (!playingBook || bookChapters.length === 0) return;
      setIsLoadingScript(true);
      setScriptError(null);

      try {
        if (!forceRefresh) {
          const localCached = getCachedAudiobookScriptLocal(playingBook.id, chapterIndex);
          if (localCached && !isOnline) {
            setScript(localCached);
            setSourceReadMode('tutor');
            setIsLoadingScript(false);
            return;
          }
        }

        const fetched = await fetchAudiobookChapterScript({
          book: playingBook,
          chapterIndex,
          chapters: bookChapters,
          academicSummary: academicProfile.isConfigured ? academicProfile.summaryLabel : undefined,
          forceRefresh,
        });
        setScript(fetched);
        setSourceReadMode('tutor');
        if (fetched.ttsAvailable === false) {
          setVoiceEngine('device');
        }
        if (fetched.aiNotice) {
          setAudioNotice(fetched.aiNotice);
        }
      } catch (err: any) {
        setScriptError(err?.message || 'AI Tutor script generation unavailable.');
        setSourceReadMode('verbatim');
      } finally {
        setIsLoadingScript(false);
      }
    },
    [playingBook, bookChapters, chapterIndex, isOnline, academicProfile.isConfigured, academicProfile.summaryLabel]
  );

  useEffect(() => {
    if (!playingBook || bookChapters.length === 0) return;
    void loadChapterScript(false);
  }, [playingBook?.id, chapterIndex, bookChapters, loadChapterScript]);

  // Check if current chapter audio is already cached offline
  useEffect(() => {
    if (!playingBook || !script?.segments?.length) {
      setChapterAudioCached(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const checks = await Promise.all(
        script.segments.map((seg) =>
          hasCachedSegmentAudio(playingBook.id, chapterIndex, seg.id, selectedVoice)
        )
      );
      if (!cancelled) {
        setChapterAudioCached(checks.every(Boolean));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playingBook?.id, chapterIndex, script, selectedVoice]);

  // Sync listening progress back to Library & Dashboard whenever active segment advances
  useEffect(() => {
    if (!playingBook || effectiveSegments.length === 0) return;
    if (!isPlaying && currentSegmentIndex === 0 && chapterIndex === 0) return;
    let cancelled = false;
    (async () => {
      const pct = await saveAudioProgressAndSyncLibrary({
        bookId: playingBook.id,
        chapterIndex,
        totalChapters: Math.max(1, bookChapters.length),
        segmentIndex: currentSegmentIndex,
        totalSegments: effectiveSegments.length,
        voiceId: selectedVoice,
      });
      if (!cancelled) {
        onUpdateProgress?.(playingBook.id, pct);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    playingBook?.id,
    chapterIndex,
    currentSegmentIndex,
    effectiveSegments.length,
    bookChapters.length,
    selectedVoice,
    isPlaying,
    onUpdateProgress,
  ]);

  // Scroll active paragraph into comfortable view
  useEffect(() => {
    const el = segmentRefs.current[currentSegmentIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentSegmentIndex]);

  // Core audio playback effect: speaks currentSegmentIndex when isPlaying === true
  const playSegmentAt = useCallback(
    async (segIndex: number) => {
      if (!playingBook || !effectiveSegments[segIndex]) return;
      const seg = effectiveSegments[segIndex];
      const sessionId = ++playbackSessionRef.current;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      setAudioNotice(null);
      setSegmentElapsed(0);
      setSegmentDuration(seg.estimatedSeconds || 25);

      const advanceNext = () => {
        if (playbackSessionRef.current !== sessionId) return;
        if (segIndex + 1 < effectiveSegments.length) {
          setCurrentSegmentIndex(segIndex + 1);
        } else if (chapterIndex + 1 < bookChapters.length) {
          setChapterIndex((prev) => prev + 1);
          setCurrentSegmentIndex(0);
          setAutoPlayOnLoad(true);
        } else {
          setIsPlaying(false);
        }
      };

      const startDeviceSpeech = (reason?: string) => {
        if (playbackSessionRef.current !== sessionId) return;
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          setIsPlaying(false);
          setAudioNotice(reason || 'Speech synthesis is not supported in this browser.');
          return;
        }
        if (reason) setAudioNotice(reason);
        setIsSynthesizingAudio(false);

        const { voice } = pickBrowserVoiceForProfile(
          selectedVoice,
          preferredBrowserVoiceUri || undefined
        );
        const chunks = splitIntoHumanSpeechChunks(seg.narration);
        if (chunks.length === 0) {
          advanceNext();
          return;
        }

        // Persona-calibrated base cadence & pitch so reading feels warm, unhurried, and expressive
        const personaBase =
          selectedVoice === 'marcus'
            ? { rate: 0.95, pitch: 0.93 }
            : selectedVoice === 'aria'
            ? { rate: 0.93, pitch: 1.04 }
            : { rate: 0.94, pitch: 1.01 };

        const est = Math.max(
          5,
          Math.round(seg.narration.split(/\s+/).length / (2.15 * playbackSpeed))
        );
        setSegmentDuration(est);
        const startedAt = Date.now();
        const ticker = window.setInterval(() => {
          if (playbackSessionRef.current !== sessionId) {
            window.clearInterval(ticker);
            return;
          }
          setSegmentElapsed(Math.min(est, (Date.now() - startedAt) / 1000));
        }, 250);

        const speakChunk = (chunkIdx: number) => {
          if (playbackSessionRef.current !== sessionId) {
            window.clearInterval(ticker);
            return;
          }
          if (chunkIdx >= chunks.length) {
            window.clearInterval(ticker);
            advanceNext();
            return;
          }

          const chunk = chunks[chunkIdx];
          const utterance = new SpeechSynthesisUtterance(chunk.text);
          if (voice) utterance.voice = voice;
          utterance.rate = Math.max(
            0.75,
            Math.min(1.8, playbackSpeed * personaBase.rate * chunk.rateMultiplier)
          );
          utterance.pitch = Math.max(
            0.8,
            Math.min(1.2, personaBase.pitch + chunk.pitchOffset)
          );
          utterance.volume = isMuted ? 0 : 1;

          utterance.onend = () => {
            if (playbackSessionRef.current !== sessionId) return;
            const pauseMs = Math.round(chunk.pauseAfterMs / Math.max(0.85, playbackSpeed));
            speechPauseTimerRef.current = window.setTimeout(() => {
              speechPauseTimerRef.current = null;
              speakChunk(chunkIdx + 1);
            }, pauseMs);
          };

          utterance.onerror = () => {
            window.clearInterval(ticker);
            if (playbackSessionRef.current === sessionId) {
              setIsPlaying(false);
            }
          };

          window.speechSynthesis.speak(utterance);
        };

        speakChunk(0);
      };

      if (voiceEngine === 'device') {
        startDeviceSpeech();
        return;
      }

      // Studio AI Voice via Gemini TTS (/api/audiobooks/tts) or Offline WAV cache
      try {
        setIsSynthesizingAudio(true);
        const { objectUrl } = await fetchOrGetCachedSegmentAudioUrl({
          bookId: playingBook.id,
          chapterIndex,
          segmentId: seg.id,
          text: seg.narration,
          voiceId: selectedVoice,
          signal: controller.signal,
        });

        if (playbackSessionRef.current !== sessionId) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setIsSynthesizingAudio(false);
        if (activeObjectUrlRef.current) {
          URL.revokeObjectURL(activeObjectUrlRef.current);
        }
        activeObjectUrlRef.current = objectUrl;

        const audio = audioRef.current;
        if (!audio) return;

        audio.src = objectUrl;
        audio.playbackRate = playbackSpeed;
        audio.muted = isMuted;
        audio.onloadedmetadata = () => {
          if (playbackSessionRef.current === sessionId && Number.isFinite(audio.duration)) {
            setSegmentDuration(audio.duration);
          }
        };
        audio.ontimeupdate = () => {
          if (playbackSessionRef.current === sessionId) {
            setSegmentElapsed(audio.currentTime);
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
              setSegmentDuration(audio.duration);
            }
          }
        };
        audio.onended = () => {
          advanceNext();
        };

        await audio.play();

        // Pre-fetch next segment WAV in the background for seamless transition
        const nextSeg = effectiveSegments[segIndex + 1];
        if (nextSeg && (typeof navigator === 'undefined' || navigator.onLine)) {
          void fetchOrGetCachedSegmentAudioUrl({
            bookId: playingBook.id,
            chapterIndex,
            segmentId: nextSeg.id,
            text: nextSeg.narration,
            voiceId: selectedVoice,
          })
            .then((res) => URL.revokeObjectURL(res.objectUrl))
            .catch(() => {});
        }
      } catch (err: any) {
        if (controller.signal.aborted || playbackSessionRef.current !== sessionId) return;
        setIsSynthesizingAudio(false);
        const msg = err?.message || 'Studio TTS unavailable right now.';
        setVoiceEngine('device');
        startDeviceSpeech(`${msg} Switched to Device Voice so your study session plays smoothly.`);
      }
    },
    [
      playingBook,
      effectiveSegments,
      chapterIndex,
      bookChapters.length,
      selectedVoice,
      preferredBrowserVoiceUri,
      voiceEngine,
      playbackSpeed,
      isMuted,
    ]
  );

  // Trigger segment playback when playing state, segment index, voice profile, or engine changes
  useEffect(() => {
    if (!isPlaying) return;
    if (!effectiveSegments[currentSegmentIndex]) return;
    void playSegmentAt(currentSegmentIndex);
  }, [
    isPlaying,
    currentSegmentIndex,
    selectedVoice,
    preferredBrowserVoiceUri,
    voiceEngine,
    chapterIndex,
    effectiveSegments.length,
  ]);

  // Auto-start playback after launching from Library / BookDetail
  useEffect(() => {
    if (autoPlayOnLoad && !isLoadingScript && effectiveSegments.length > 0) {
      setAutoPlayOnLoad(false);
      setIsPlaying(true);
    }
  }, [autoPlayOnLoad, isLoadingScript, effectiveSegments.length]);

  // Live updates to speed & mute without restarting studio audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.muted = isMuted;
    }
  }, [playbackSpeed, isMuted]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      stopAudioEngines();
      setIsPlaying(false);
    } else {
      if (effectiveSegments.length === 0) return;
      setIsPlaying(true);
    }
  };

  const handleSelectSegment = (idx: number) => {
    const bounded = Math.max(0, Math.min(effectiveSegments.length - 1, idx));
    setCurrentSegmentIndex(bounded);
    setSegmentElapsed(0);
    setIsPlaying(true);
  };

  const handlePrevSegment = () => {
    if (currentSegmentIndex > 0) {
      handleSelectSegment(currentSegmentIndex - 1);
    } else if (chapterIndex > 0) {
      stopAudioEngines();
      setChapterIndex(chapterIndex - 1);
      setCurrentSegmentIndex(0);
      setAutoPlayOnLoad(true);
    }
  };

  const handleNextSegment = () => {
    if (currentSegmentIndex + 1 < effectiveSegments.length) {
      handleSelectSegment(currentSegmentIndex + 1);
    } else if (chapterIndex + 1 < bookChapters.length) {
      stopAudioEngines();
      setChapterIndex(chapterIndex + 1);
      setCurrentSegmentIndex(0);
      setAutoPlayOnLoad(true);
    }
  };

  const handleSeekSegment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (voiceEngine === 'studio' && audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      audioRef.current.currentTime = (val / 100) * audioRef.current.duration;
      setSegmentElapsed(audioRef.current.currentTime);
    }
  };

  const handleSaveChapterOffline = async () => {
    if (!script || !playingBook) return;
    setIsCachingOfflineAudio(true);
    setOfflineAudioProgress({ done: 0, total: script.segments.length });
    setAudioNotice(null);
    try {
      await cacheFullChapterAudioOffline({
        script,
        voiceId: selectedVoice,
        onProgress: (done, total) => setOfflineAudioProgress({ done, total }),
      });
      setChapterAudioCached(true);
    } catch (err: any) {
      setAudioNotice(err?.message || 'Could not download all audio segments offline.');
    } finally {
      setIsCachingOfflineAudio(false);
    }
  };

  const handleBookmarkSegment = (seg: AudiobookSegment, customNote?: string) => {
    if (!playingBook || !onAddBookmark) return;
    const bm: Bookmark = {
      id: `audio-bm-${playingBook.id}-${chapterIndex}-${seg.id}-${Date.now()}`,
      bookId: playingBook.id,
      bookTitle: playingBook.title,
      chapter: `${activeChapterTitle} · ${seg.heading}`,
      textSnippet: (customNote || seg.complexConcept?.visualizationPrompt || seg.narration).slice(0, 220),
      timestamp: Date.now(),
    };
    onAddBookmark(bm);
    setJustBookmarkedSegId(seg.id);
    setTimeout(() => setJustBookmarkedSegId(null), 2200);
  };

  const totalChapterDuration = useMemo(
    () => effectiveSegments.reduce((acc, s) => acc + (s.estimatedSeconds || 25), 0),
    [effectiveSegments]
  );

  const chapterElapsedEstimate = useMemo(() => {
    const completed = effectiveSegments
      .slice(0, currentSegmentIndex)
      .reduce((acc, s) => acc + (s.estimatedSeconds || 25), 0);
    return Math.round(completed + segmentElapsed);
  }, [effectiveSegments, currentSegmentIndex, segmentElapsed]);

  const segmentProgressPct =
    segmentDuration > 0 ? Math.min(100, (segmentElapsed / segmentDuration) * 100) : 0;

  const subjectPills = useMemo(() => {
    if (academicProfile.subjects.length > 0 && playlistMode === 'personalized') {
      return ['All', ...academicProfile.subjects];
    }
    const cats = Array.from(new Set(activeAudioCatalog.map((b) => b.category.split(',')[0].trim()).filter(Boolean)));
    return ['All', ...cats];
  }, [academicProfile.subjects, playlistMode, activeAudioCatalog]);

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
      return (
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.category.toLowerCase().includes(q) ||
        (book.subjects?.some((s) => s.toLowerCase().includes(q)) ?? false)
      );
    });
  }, [activeAudioCatalog, searchQuery, selectedCategory]);

  // Waveform heights tied to live playback progress
  const visualizerBars = useMemo(() => {
    const phase = isPlaying ? Math.floor(segmentElapsed * 4) : 0;
    return Array.from({ length: 14 }, (_, i) => {
      if (!isPlaying) return 8;
      return 10 + Math.round(Math.abs(Math.sin((phase + i * 0.7) * 0.85)) * 28);
    });
  }, [isPlaying, segmentElapsed]);

  const isCurrentConceptBookmarked = useMemo(() => {
    if (!playingBook || !currentSegment) return false;
    if (justBookmarkedSegId === currentSegment.id) return true;
    return bookmarks.some(
      (b) => b.bookId === playingBook.id && b.chapter.includes(currentSegment.heading)
    );
  }, [playingBook, currentSegment, justBookmarkedSegId, bookmarks]);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8" id="audiobooks-view-container">
      {/* Hidden native HTMLAudioElement for real WAV playback */}
      <audio ref={audioRef} preload="auto" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1.5">
            <Headphones className="w-4 h-4 shrink-0" />
            <span>Multimodal Tutor Audio</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <button
              type="button"
              onClick={() => onOpenAcademicPrefs?.()}
              className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              title="Customize Country, Curriculum, Level & Subjects"
            >
              {academicProfile.isConfigured ? academicProfile.summaryLabel : 'Configure Curriculum'}
            </button>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
            Library Audiobooks
          </h2>
          <p className="text-slate-500 dark:text-slate-300 text-sm mt-1">
            Warm, zero-loss spoken narration extracted directly from your Library textbooks with curriculum visual diagrams on complex concepts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isOnline && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
              <WifiOff className="w-3.5 h-3.5" /> Offline Mode
            </span>
          )}
          <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1">
            {academicProfile.isConfigured && (
              <button
                type="button"
                onClick={() => setPlaylistMode('personalized')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  playlistMode === 'personalized'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                My Subjects
              </button>
            )}
            <button
              type="button"
              onClick={() => setPlaylistMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                playlistMode === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Library ({books.length})
            </button>
            <button
              type="button"
              onClick={() => setPlaylistMode('offline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                playlistMode === 'offline'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Offline ({cachedBookIds.size})
            </button>
          </div>
        </div>
      </div>

      {/* Recommended Library Shelf */}
      {!searchQuery && aiRecommendedAudiobooks.length > 0 && (
        <section className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Recommended Listening Queue</span>
              {academicProfile.isConfigured && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500 dark:text-slate-400 font-normal">
                    {academicProfile.summaryLabel}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {aiRecommendedAudiobooks.map(({ book, matchReason }) => {
              const active = playingBook?.id === book.id;
              return (
                <button
                  type="button"
                  key={`rec-audio-${book.id}`}
                  onClick={() => {
                    setPlayingBook(book);
                    setAutoPlayOnLoad(true);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex gap-3 items-center group ${
                    active
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700'
                      : 'bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <div className="w-11 h-16 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
                    <BookCoverVisual book={book} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 truncate">
                      {matchReason}
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 mt-0.5">
                      {book.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {book.author} · {book.readProgress || 0}% read
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Main 12-Col Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left 7 Cols: Live Player + Multimodal Concept Deck + Synchronized Script */}
        <div className="lg:col-span-7 space-y-5">
          {/* Now Playing Studio Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-5" id="now-playing-card">
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="shrink-0 flex justify-center sm:justify-start">
                <div className="w-[110px] h-[165px] rounded-xl overflow-hidden shadow-md border border-slate-200/80 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                  {playingBook ? (
                    <BookCoverVisual book={playingBook} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Headphones className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {voiceEngine === 'studio' ? 'Studio AI Voice' : 'Device Offline Voice'}
                    </span>
                    <span>·</span>
                    <span>{playingBook?.format?.toUpperCase() || 'EPUB'}</span>
                    <span>·</span>
                    <span>{playingBook?.readProgress || 0}% Library Sync</span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-display font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                    {playingBook ? playingBook.title : 'Select a Textbook'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300">
                    {playingBook ? `${playingBook.author}` : 'Library Collection'}
                  </p>
                </div>

                {/* Chapter Picker + Connected Library Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {bookChapters.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={chapterIndex}
                        onChange={(e) => {
                          stopAudioEngines();
                          setIsPlaying(false);
                          setChapterIndex(Number(e.target.value));
                          setCurrentSegmentIndex(0);
                        }}
                        aria-label="Select Chapter"
                        className="flex-1 min-w-0 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {bookChapters.map((ch, idx) => (
                          <option key={`ch-opt-${idx}`} value={idx}>
                            {ch.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void loadChapterScript(true)}
                        disabled={isLoadingScript}
                        title="Regenerate warm tutor narration & visuals"
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingScript ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  )}

                  {/* Voice Picker & Natural Browser Voice Selector */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {VOICE_PROFILES.map((voice) => (
                      <button
                        type="button"
                        key={voice.id}
                        onClick={() => {
                          setSelectedVoice(voice.id);
                          setPreferredBrowserVoiceUri('');
                        }}
                        className={`py-1.5 px-2 text-center rounded-lg border text-xs transition-all cursor-pointer ${
                          selectedVoice === voice.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="block truncate">{voice.name}</span>
                        <span className="block text-[10px] opacity-75 truncate">{voice.role}</span>
                      </button>
                    ))}
                  </div>

                  {voiceEngine === 'device' && browserVoices.length > 0 && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                        Voice
                      </span>
                      <select
                        value={preferredBrowserVoiceUri || browserVoices[0]?.voice.voiceURI || ''}
                        onChange={(e) => setPreferredBrowserVoiceUri(e.target.value)}
                        aria-label="Select Natural Device Voice"
                        className="flex-1 min-w-0 text-[11px] font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {browserVoices.slice(0, 12).map((item) => (
                          <option key={item.voice.voiceURI} value={item.voice.voiceURI}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Segment Audio Progress & Live Waveform */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                <span>
                  {formatSeconds(chapterElapsedEstimate)} · Seg {effectiveSegments.length ? currentSegmentIndex + 1 : 0}/{effectiveSegments.length}
                </span>

                <div className="flex items-end gap-1 h-[28px] px-2">
                  {visualizerBars.map((h, i) => (
                    <motion.span
                      key={i}
                      animate={{ height: h }}
                      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                      className="w-1 rounded-t-sm bg-indigo-500/80 dark:bg-indigo-400/80"
                    />
                  ))}
                </div>

                <span>{formatSeconds(totalChapterDuration)}</span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={segmentProgressPct}
                onChange={handleSeekSegment}
                aria-label="Audio segment seek bar"
                className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-400"
              />
            </div>

            {/* Transport Dock */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl p-1">
                {SPEED_OPTIONS.map((speed) => (
                  <button
                    type="button"
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer tabular-nums whitespace-nowrap ${
                      playbackSpeed === speed
                        ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrevSegment}
                  disabled={currentSegmentIndex === 0 && chapterIndex === 0}
                  className="p-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Previous segment"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleTogglePlay}
                  disabled={isLoadingScript && effectiveSegments.length === 0}
                  className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isSynthesizingAudio ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5 fill-white" />
                  ) : (
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleNextSegment}
                  disabled={
                    currentSegmentIndex + 1 >= effectiveSegments.length &&
                    chapterIndex + 1 >= bookChapters.length
                  }
                  className="p-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Next segment"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVoiceEngine((prev) => (prev === 'studio' ? 'device' : 'studio'))}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                  title="Switch between Studio AI Audio and Device Speech Synthesis"
                >
                  {voiceEngine === 'studio' ? 'Studio TTS' : 'Device Voice'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Library Integration Bar (Reader Link, Offline Audio Save, Bookmark) */}
            {playingBook && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenInReader ? onOpenInReader(playingBook) : onBookSelect(playingBook)
                    }
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Open in Reader</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onBookSelect(playingBook)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                  >
                    Book Details
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {currentSegment && onAddBookmark && (
                    <button
                      type="button"
                      onClick={() => handleBookmarkSegment(currentSegment)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        isCurrentConceptBookmarked
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isCurrentConceptBookmarked ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <BookmarkPlus className="w-3.5 h-3.5" />
                      )}
                      <span>{isCurrentConceptBookmarked ? 'Bookmarked' : 'Bookmark Spot'}</span>
                    </button>
                  )}

                  {script && (
                    <button
                      type="button"
                      onClick={handleSaveChapterOffline}
                      disabled={isCachingOfflineAudio || chapterAudioCached}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-75 ${
                        chapterAudioCached
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                      }`}
                    >
                      {isCachingOfflineAudio ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>
                            Caching {offlineAudioProgress?.done || 0}/{offlineAudioProgress?.total || script.segments.length}
                          </span>
                        </>
                      ) : chapterAudioCached ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Audio Offline Ready</span>
                        </>
                      ) : (
                        <>
                          <HardDriveDownload className="w-3.5 h-3.5" />
                          <span>Save Chapter Audio</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Status / Notice Banner */}
            {(audioNotice || scriptError) && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 px-3.5 py-2.5 flex items-start justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>{audioNotice || scriptError}</span>
                </div>
                {scriptError && (
                  <button
                    type="button"
                    onClick={() => void loadChapterScript(true)}
                    className="font-semibold underline shrink-0 cursor-pointer"
                  >
                    Retry AI Script
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Complex Concept Visualization Deck (appears whenever current or chapter segment has complex concept) */}
          {playingBook && currentSegment?.isComplexConcept && currentSegment.complexConcept && (
            <ConceptVisualizerCard
              book={playingBook}
              chapterTitle={activeChapterTitle}
              segment={currentSegment}
              complexConcept={currentSegment.complexConcept}
              isBookmarked={isCurrentConceptBookmarked}
              onBookmarkConcept={() =>
                handleBookmarkSegment(
                  currentSegment,
                  `${currentSegment.complexConcept?.conceptTitle}: ${currentSegment.complexConcept?.visualizationPrompt}`
                )
              }
              onAskAiConcept={() =>
                onAskAiAboutBook?.(
                  playingBook,
                  `Explain this complex concept from "${playingBook.title}" (${activeChapterTitle}): ${currentSegment.complexConcept?.conceptTitle}. Formula/Details: ${currentSegment.complexConcept?.formulaOrRule || currentSegment.sourceExcerpt}`
                )
              }
            />
          )}

          {/* Synchronized Zero-Loss Narration Script */}
          <div className="bg-[#FAF8F5] dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm" id="synchronized-script-panel">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                {sourceReadMode === 'tutor' ? 'Warm Tutor Narration (Zero-Loss)' : 'Verbatim Textbook Chapter'}
              </span>

              <div className="flex items-center gap-2">
                {script && bookChapters[chapterIndex] && (
                  <button
                    type="button"
                    onClick={() =>
                      setSourceReadMode((prev) => (prev === 'tutor' ? 'verbatim' : 'tutor'))
                    }
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {sourceReadMode === 'tutor' ? 'View Raw Text' : 'Switch to Tutor Narration'}
                  </button>
                )}
                <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-lg truncate max-w-[220px]">
                  {activeChapterTitle}
                </span>
              </div>
            </div>

            {isLoadingScript ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Preparing zero-loss tutor narration &amp; visual concept cues…
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Analyzing textbook chapter for complex concepts and curriculum diagrams
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {effectiveSegments.map((seg, index) => {
                  const isActive = index === currentSegmentIndex;
                  return (
                    <div
                      key={seg.id}
                      ref={(el) => {
                        segmentRefs.current[index] = el;
                      }}
                      onClick={() => handleSelectSegment(index)}
                      className={`p-3.5 rounded-xl border-l-4 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-amber-500/10 dark:bg-indigo-950/40 border-l-indigo-600 dark:border-l-indigo-400 text-slate-900 dark:text-white'
                          : 'bg-white/60 dark:bg-slate-800/40 border-l-transparent text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                          {index + 1}. {seg.heading}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                          {seg.isComplexConcept && (
                            <span className="font-semibold text-amber-700 dark:text-amber-300">
                              Visual Concept
                            </span>
                          )}
                          <span>~{seg.estimatedSeconds}s</span>
                        </div>
                      </div>
                      <p className="font-serif text-[16px] leading-relaxed">
                        {seg.narration}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Connected Library Playlist */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Library Playlist ({filteredAudiobooks.length})
            </h4>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer"
              >
                Clear search
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Library titles, authors, subjects..."
              className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                aria-label="Clear search"
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
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {pill}
              </button>
            ))}
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[620px] pr-1" id="audiobook-playlist-scroller">
            {filteredAudiobooks.length > 0 ? (
              filteredAudiobooks.map((book) => {
                const isSelected = playingBook?.id === book.id;
                const isOffline = isBookCached(book.id);
                const resume = getAudioResumeState(book.id);
                const progress = book.readProgress ?? resume?.progressPercent ?? 0;

                return (
                  <div
                    key={book.id}
                    onClick={() => {
                      if (isSelected) {
                        handleTogglePlay();
                      } else {
                        setPlayingBook(book);
                        setAutoPlayOnLoad(true);
                      }
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex gap-3.5 ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700'
                        : 'bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="w-[48px] h-[72px] rounded-lg overflow-hidden shrink-0 border border-slate-200/60 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                      <BookCoverVisual book={book} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="truncate font-semibold uppercase tracking-wider">
                            {book.category.split(',')[0]} · {book.format?.toUpperCase() || 'EPUB'}
                          </span>
                          {isOffline && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                              Offline
                            </span>
                          )}
                        </div>
                        <h5
                          className={`text-sm font-semibold truncate mt-0.5 ${
                            isSelected
                              ? 'text-indigo-700 dark:text-indigo-300'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {book.title}
                        </h5>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {book.author}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px] tabular-nums">
                        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{book.rating}</span>
                          {progress > 0 && <span>· {progress}%</span>}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenInReader) onOpenInReader(book);
                              else onBookSelect(book);
                            }}
                            className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium cursor-pointer"
                          >
                            Read
                          </button>
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                            {isSelected && isPlaying ? 'Playing' : 'Listen'}
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <Headphones className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {playlistMode === 'offline'
                    ? 'No offline Library books saved yet'
                    : 'No matching audiobooks'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {playlistMode === 'offline'
                    ? 'Save any book offline in Library or switch to All Library.'
                    : 'Try clearing your search or switching subject filters.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    if (playlistMode === 'offline') setPlaylistMode('all');
                  }}
                  className="mt-3 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 rounded-lg text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
                >
                  Show All Library
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
