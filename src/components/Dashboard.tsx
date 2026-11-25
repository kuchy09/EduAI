import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book } from '../types';
import {
  Clock, PlayCircle, Flame, BookOpen,
  CheckCircle2, Target, ArrowRight, Compass,
  Brain, Headphones, ChevronRight, Layers,
  Zap, X, Check, FlaskConical, SlidersHorizontal
} from 'lucide-react';
import { BookCoverVisual } from './BookCoverVisual';
import { DailyReadingGoalCard } from './DailyReadingGoalCard';
import { HomeSearchBar } from './HomeSearchBar';
import { getDailyGoal, GOAL_EVENT_NAME } from '../lib/readingGoal';
import { fetchUserDashboardMetrics, UserStatsSummary } from '../lib/userHomeDataService';
import { isAppOnline } from '../lib/offlineManager';
import { useUserAvatar, markAvatarUrlFailed } from '../lib/userAvatarService';
import { safeStorage } from '../lib/safeStorage';
import { platformBookStoreCatalog } from '../data';
import {
  GLOBAL_BOOK_COVERS_EVENT,
  applyGlobalCoversToBooks,
} from '../lib/globalBookCoversService';
import {
  extractUserAcademicProfile,
  getPersonalizedBooks,
  getAiRecommendedBooks,
  findMatchingUserSubjects,
  ACADEMIC_PREFS_EVENT,
} from '../lib/bookPersonalization';
import scholarlyStudioImg from '../assets/images/eduai_scholarly_studio_1795602310890.jpg';
import stemAtlasImg from '../assets/images/eduai_stem_atlas_1795602311194.jpg';
import physicsMotifImg from '../assets/images/eduai_motif_physics_waves_1795603432952.jpg';
import chemistryMotifImg from '../assets/images/eduai_motif_chemistry_lattice_1795603433562.jpg';
import biologyMotifImg from '../assets/images/eduai_motif_biology_botany_1795603433768.jpg';
import mathMotifImg from '../assets/images/eduai_motif_math_geometry_1795603434867.jpg';

const HERO_EDUCATIONAL_MOTIFS = [
  {
    id: 'atelier-desk',
    plateNo: '01',
    discipline: 'Study Atelier',
    caption: 'Optics, Cartography & Open Folios',
    src: scholarlyStudioImg,
    alt: 'Scholarly study desk with geometric diagrams, brass astrolabe, and optical prism',
  },
  {
    id: 'physics-waves',
    plateNo: '02',
    discipline: 'Physics · Plate II',
    caption: 'Prism Refraction & Harmonic Waves',
    src: physicsMotifImg,
    alt: 'Educational illustration of a glass prism splitting light, brass pendulum arc, and standing harmonic waves',
  },
  {
    id: 'chemistry-lattice',
    plateNo: '03',
    discipline: 'Chemistry · Plate III',
    caption: 'Crystal Lattices & Atomic Orbitals',
    src: chemistryMotifImg,
    alt: 'Educational illustration of a 3D crystalline molecular lattice, concentric atomic orbitals, and titration flask',
  },
  {
    id: 'biology-botany',
    plateNo: '04',
    discipline: 'Biology · Plate IV',
    caption: 'Leaf Venation & Cellular Helix',
    src: biologyMotifImg,
    alt: 'Educational illustration of botanical leaf cross-section, vascular venation, and double-helix structure',
  },
  {
    id: 'math-geometry',
    plateNo: '05',
    discipline: 'Mathematics · Plate V',
    caption: 'Conic Sections & Polyhedral Solids',
    src: mathMotifImg,
    alt: 'Educational illustration of intersecting conic sections, brass dodecahedron, and golden ratio spiral',
  },
  {
    id: 'stem-atlas',
    plateNo: '06',
    discipline: 'STEM Atlas · Plate VI',
    caption: 'Orbital Mechanics & Wave Synthesis',
    src: stemAtlasImg,
    alt: 'Unified STEM atlas illustrating planetary orbits, crystal geometry, botanical venation, and acoustic waves',
  },
] as const;

interface DashboardProps {
  books: Book[];
  onBookSelect: (book: Book) => void;
  user: any;
  profile?: any;
  onNavigate?: (view: any) => void;
  onAddBookToLibrary?: (book: Book) => void;
  onOpenAcademicPrefs?: () => void;
}

export function Dashboard({ books, onBookSelect, user, profile, onNavigate, onAddBookToLibrary, onOpenAcademicPrefs }: DashboardProps) {
  const avatarUrl = useUserAvatar(user, profile);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [failedMotifs, setFailedMotifs] = useState<Record<string, boolean>>({});
  const [activeMotifIndex, setActiveMotifIndex] = useState(0);
  const [isMotifPaused, setIsMotifPaused] = useState(false);
  const [atlasImgFailed, setAtlasImgFailed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    HERO_EDUCATIONAL_MOTIFS.forEach((motif) => {
      const preload = new window.Image();
      preload.src = motif.src;
    });
  }, []);

  useEffect(() => {
    if (isMotifPaused) return;
    const timer = window.setInterval(() => {
      setActiveMotifIndex((prev) => (prev + 1) % HERO_EDUCATIONAL_MOTIFS.length);
    }, 4800);
    return () => window.clearInterval(timer);
  }, [isMotifPaused]);

  const currentMotif = HERO_EDUCATIONAL_MOTIFS[activeMotifIndex] || HERO_EDUCATIONAL_MOTIFS[0];

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [metrics, setMetrics] = useState<UserStatsSummary>({
    booksRead: 0,
    booksInProgress: 0,
    totalReadingMinutes: 0,
    streakDays: 3,
    todayMinutes: 8,
    todayPages: 5,
    isGoalMetToday: false,
    notesAndHighlightsCount: 0,
    activeLearnersCount: 18
  });

  const [prefsTick, setPrefsTick] = useState(0);
  useEffect(() => {
    const onPrefsUpdated = () => setPrefsTick((t) => t + 1);
    window.addEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
    window.addEventListener(GLOBAL_BOOK_COVERS_EVENT, onPrefsUpdated);
    return () => {
      window.removeEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
      window.removeEventListener(GLOBAL_BOOK_COVERS_EVENT, onPrefsUpdated);
    };
  }, []);

  const academicProfile = React.useMemo(
    () => extractUserAcademicProfile(profile, user),
    [profile, user, prefsTick]
  );

  const fieldOfStudy = academicProfile.fieldOfStudy;
  const isSchool = academicProfile.isSchoolLevel;

  // Real-time metrics loading and event listener
  useEffect(() => {
    let isMounted = true;
    void isAppOnline();

    const updateMetrics = async () => {
      if (user?.id) {
        const data = await fetchUserDashboardMetrics(user.id, books);
        if (isMounted) {
          setMetrics(data);
        }
      }
    };

    updateMetrics();

    const handleGoalUpdate = () => updateMetrics();
    const handleProgressUpdate = () => updateMetrics();

    window.addEventListener(GOAL_EVENT_NAME, handleGoalUpdate);
    window.addEventListener('edu-ai-progress-updated', handleProgressUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener(GOAL_EVENT_NAME, handleGoalUpdate);
      window.removeEventListener('edu-ai-progress-updated', handleProgressUpdate);
    };
  }, [user?.id, books]);

  const personalizedBooks = React.useMemo(
    () => getPersonalizedBooks(books, academicProfile, { allowFallbackIfEmpty: true, includeStartedBooks: true }),
    [books, academicProfile]
  );

  const unifiedRecommendationPool = React.useMemo(() => {
    const seen = new Set(books.map((b) => b.id));
    const extras = applyGlobalCoversToBooks(platformBookStoreCatalog).filter((b) => !seen.has(b.id));
    return [...books, ...extras];
  }, [books, prefsTick]);

  const aiRecommendations = React.useMemo(
    () => getAiRecommendedBooks(unifiedRecommendationPool, academicProfile, 6),
    [unifiedRecommendationPool, academicProfile]
  );

  const libraryBookIdSet = React.useMemo(() => new Set(books.map((b) => b.id)), [books]);

  const continueReading = React.useMemo(
    () =>
      personalizedBooks
        .filter((b) => b.readProgress && b.readProgress > 0 && b.readProgress < 100)
        .sort((a, b) => (b.readProgress || 0) - (a.readProgress || 0)),
    [personalizedBooks]
  );

  const categories = React.useMemo(() => {
    if (academicProfile.subjects.length > 0) {
      return ['All', ...academicProfile.subjects];
    }
    return ['All', ...Array.from(new Set(personalizedBooks.map((b) => b.category).filter(Boolean)))].slice(0, 7);
  }, [academicProfile.subjects, personalizedBooks]);

  useEffect(() => {
    if (selectedCategory !== 'All' && !categories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [categories, selectedCategory]);

  const exploreList = React.useMemo(() => {
    if (selectedCategory === 'All') {
      return personalizedBooks;
    }
    return personalizedBooks.filter(
      (b) =>
        findMatchingUserSubjects(b, [selectedCategory]).length > 0 ||
        b.category === selectedCategory ||
        b.subjects?.some((s) => s.toLowerCase() === selectedCategory.toLowerCase())
    );
  }, [personalizedBooks, selectedCategory]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    if (hour >= 18 && hour < 22) return 'Good evening';
    return 'Welcome back';
  })();

  const fullName = profile?.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Learner');
  const firstName = fullName.split(' ')[0] || 'Learner';
  const displayField = isSchool
    ? (academicProfile.curriculum || 'School Curriculum')
    : fieldOfStudy;

  const defaultSubject = academicProfile.subjects.length > 0
    ? academicProfile.subjects[0]
    : (displayField || 'General Studies');

  const [activeSubject, setActiveSubject] = useState<string>(() => {
    const saved = safeStorage.getItem('edu_ai_active_subject');
    if (saved && academicProfile.subjects.includes(saved)) return saved;
    return defaultSubject;
  });

  useEffect(() => {
    if (academicProfile.subjects.length > 0 && !academicProfile.subjects.includes(activeSubject)) {
      setActiveSubject(academicProfile.subjects[0]);
      safeStorage.setItem('edu_ai_active_subject', academicProfile.subjects[0]);
    }
  }, [academicProfile.subjects, activeSubject]);

  const [completedModules, setCompletedModules] = useState<number>(() => {
    const saved = safeStorage.getItem('edu_ai_weekly_modules');
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 0) return num;
    }
    return 4;
  });

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const weeklyTarget = 5;
  const weeklyPct = Math.min(100, Math.round((completedModules / weeklyTarget) * 100));

  const handleCompleteModule = () => {
    const nextVal = completedModules + 1;
    setCompletedModules(nextVal);
    safeStorage.setItem('edu_ai_weekly_modules', String(nextVal));
  };

  const availableSubjects = Array.from(
    new Set(
      academicProfile.subjects.length > 0
        ? [activeSubject, ...academicProfile.subjects]
        : [
            activeSubject,
            ...personalizedBooks.flatMap((b) => b.subjects || []).slice(0, 6),
          ]
    )
  ).filter(Boolean);

  const studyPortals = [
    {
      index: '01',
      id: 'ai-tutor',
      title: 'Sage AI Tutor',
      desc: 'Socratic explanations & step-by-step LaTeX',
      icon: Brain,
    },
    {
      index: '02',
      id: 'quizzes',
      title: 'Smart Quizzes',
      desc: 'Diagnostic recall & chapter checks',
      icon: Zap,
    },
    {
      index: '03',
      id: 'audiobooks',
      title: 'Audiobooks',
      desc: 'Guided narrations & visual cues',
      icon: Headphones,
    },
    {
      index: '04',
      id: 'workspace',
      title: 'Workspace',
      desc: 'Field notes, highlights & citations',
      icon: Layers,
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8 space-y-6 sm:space-y-8 min-w-0 transition-all duration-300">
      {/* Search Bar */}
      <HomeSearchBar
        books={books}
        user={user}
        profile={profile}
        onBookSelect={onBookSelect}
        onNavigate={(view) => onNavigate?.(view)}
        onAddBookToLibrary={onAddBookToLibrary}
      />

      {/* Scholarly Atelier Hero Band */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-[#171E24] border border-[#E2DDD3] dark:border-[#26313A] atelier-grid-bg shadow-xs w-full max-w-full min-w-0"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] items-stretch">
          {/* Left Column: Editorial Greeting, Weekly Progress & Controls */}
          <div className="p-5 sm:p-7 md:p-8 flex flex-col justify-between gap-5 min-w-0">
            <div className="space-y-4">
              {/* Unboxed Metadata & Interactive Selectors */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] font-mono uppercase tracking-[0.09em] text-slate-500 dark:text-slate-400">
                <button
                  onClick={() => setIsSubjectModalOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-brand-700 dark:text-brand-400 hover:underline font-semibold cursor-pointer"
                  title="Inspect Subject Check & syllabus modules"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Subject: {activeSubject}</span>
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onOpenAcademicPrefs?.()}
                  className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer truncate max-w-[240px]"
                  title="Edit Country, Curriculum, Education Level & Subjects"
                >
                  <SlidersHorizontal className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {academicProfile.isConfigured ? academicProfile.summaryLabel : 'Set Curriculum'}
                  </span>
                </button>
              </div>

              {/* Main Headline + Avatar */}
              <div className="flex items-start gap-3.5 sm:gap-4">
                <button
                  onClick={() => onNavigate?.('profile')}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border border-[#E2DDD3] dark:border-[#26313A] overflow-hidden shrink-0 cursor-pointer hover:opacity-90 transition-opacity bg-[#EFECE4] dark:bg-[#1E272E] flex items-center justify-center"
                  title="View & Edit Profile"
                >
                  {avatarUrl && !avatarFailed ? (
                    <img
                      src={avatarUrl}
                      alt={fullName}
                      className="w-full h-full object-cover"
                      onError={() => {
                        const nextCandidate = markAvatarUrlFailed(avatarUrl, user, profile);
                        if (nextCandidate && nextCandidate !== avatarUrl) {
                          setAvatarFailed(false);
                        } else {
                          setAvatarFailed(true);
                        }
                      }}
                    />
                  ) : (
                    <span className="font-display font-semibold text-base text-brand-700 dark:text-brand-400">
                      {firstName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>

                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {greeting}, {fullName}
                  </p>
                  <h1 className="text-xl sm:text-2xl md:text-[26px] font-display font-semibold text-slate-900 dark:text-white leading-snug tracking-tight">
                    Welcome to Edu AI.{' '}
                    <span className="text-brand-600 dark:text-brand-400">
                      You&apos;ve completed {completedModules} modules this week.
                    </span>
                  </h1>
                </div>
              </div>

              {/* Progress Track + Tabular Telemetry */}
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300">
                    {completedModules >= weeklyTarget
                      ? 'Weekly study milestone achieved.'
                      : `${weeklyTarget - completedModules} module${weeklyTarget - completedModules === 1 ? '' : 's'} remaining toward weekly goal`}
                    {continueReading.length > 0 && (
                      <span className="hidden sm:inline text-slate-400 dark:text-slate-400">
                        {' '}· Reading <em className="not-italic font-medium text-slate-700 dark:text-slate-200">{continueReading[0].title}</em>
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums shrink-0 ml-2">
                    {String(completedModules).padStart(2, '0')}/{String(weeklyTarget).padStart(2, '0')} · {weeklyPct}%
                  </span>
                </div>

                <div className="w-full bg-[#EFECE4] dark:bg-[#11161A] border border-[#E2DDD3] dark:border-[#26313A] rounded-full h-2 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      completedModules >= weeklyTarget
                        ? 'bg-emerald-600 dark:bg-emerald-500'
                        : 'bg-brand-600 dark:bg-brand-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${weeklyPct}%` }}
                    transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E2DDD3] dark:border-[#26313A]">
              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                <span className="inline-flex items-center gap-1.5" title="Active study streak">
                  <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <strong className="font-semibold text-slate-900 dark:text-white">{metrics.streakDays}d</strong> streak
                </span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <strong className="font-semibold text-slate-900 dark:text-white">{completedModules}/{weeklyTarget}</strong> modules
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSubjectModalOpen((prev) => !prev)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#FAF8F4] dark:bg-[#11161A] text-slate-700 dark:text-slate-200 border border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-400 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Subject Check</span>
                </button>

                {continueReading.length > 0 ? (
                  <button
                    onClick={() => onBookSelect(continueReading[0])}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    title={`Continue reading "${continueReading[0].title}"`}
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Resume Reading</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onNavigate?.('learning-path')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Learning Path</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Sequential Educational Motif Showcase */}
          <div
            onMouseEnter={() => setIsMotifPaused(true)}
            onMouseLeave={() => setIsMotifPaused(false)}
            className="relative min-h-[220px] sm:min-h-[250px] lg:min-h-[270px] border-t lg:border-t-0 lg:border-l border-[#E2DDD3] dark:border-[#26313A] bg-[#EFECE4] dark:bg-[#11161A] overflow-hidden"
          >
            <AnimatePresence initial={false}>
              {!failedMotifs[currentMotif.id] ? (
                <motion.img
                  key={currentMotif.id}
                  src={currentMotif.src}
                  alt={currentMotif.alt}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailedMotifs((prev) => ({ ...prev, [currentMotif.id]: true }))
                  }
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
              ) : (
                <motion.div
                  key={`${currentMotif.id}-fallback`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#0F4C5C]/15 to-[#C27D1A]/15"
                >
                  <BookOpen className="w-8 h-8 text-brand-600 dark:text-brand-400 mb-2" />
                  <span className="font-display text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {currentMotif.discipline}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute inset-0 bg-gradient-to-t from-[#11161A]/82 via-[#11161A]/18 to-[#11161A]/25 pointer-events-none" />

            {/* Top Plate Sequence Progress Bar */}
            <div className="absolute top-3 left-4 right-4 flex items-center justify-between gap-3 z-10">
              <div className="flex items-center gap-1.5 flex-1 max-w-[190px]" role="tablist" aria-label="Educational motif plates">
                {HERO_EDUCATIONAL_MOTIFS.map((motif, idx) => {
                  const isActive = idx === activeMotifIndex;
                  return (
                    <button
                      key={motif.id}
                      type="button"
                      onClick={() => setActiveMotifIndex(idx)}
                      aria-label={`Show ${motif.discipline}: ${motif.caption}`}
                      aria-selected={isActive}
                      className="group py-1.5 flex-1 cursor-pointer focus:outline-none"
                    >
                      <span
                        className={`block h-[3px] w-full rounded-full transition-all duration-500 ${
                          isActive
                            ? 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.55)]'
                            : idx < activeMotifIndex
                            ? 'bg-white/60 group-hover:bg-white/85'
                            : 'bg-white/30 group-hover:bg-white/60'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] font-mono tabular-nums tracking-[0.14em] text-white/90 bg-[#11161A]/55 backdrop-blur-xs px-2 py-0.5 rounded-md border border-white/15">
                {currentMotif.plateNo}/{String(HERO_EDUCATIONAL_MOTIFS.length).padStart(2, '0')}
              </span>
            </div>

            {/* Bottom Animated Plate Caption + EduLab CTA */}
            <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between gap-2 text-white/95 z-10">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${currentMotif.id}-caption`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="min-w-0"
                >
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-amber-300 truncate">
                    {currentMotif.discipline}
                  </p>
                  <p className="text-xs sm:text-[13px] font-display font-medium truncate">
                    {currentMotif.caption}
                  </p>
                </motion.div>
              </AnimatePresence>

              <button
                onClick={() => onNavigate?.('edulab')}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-xs text-[11px] font-medium text-white border border-white/25 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <FlaskConical className="w-3 h-3" />
                <span>EduLab</span>
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Subject Check Syllabus Drawer */}
        <AnimatePresence>
          {isSubjectModalOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-[#E2DDD3] dark:border-[#26313A] bg-[#FAF8F4] dark:bg-[#141A20] px-5 sm:px-7 py-5 space-y-4 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                    Subject Check &amp; Weekly Syllabus
                  </h3>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    · {activeSubject}
                  </span>
                </div>
                <button
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Close Subject Check"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
                  Subject:
                </span>
                {availableSubjects.map((subj) => (
                  <button
                    key={subj}
                    onClick={() => {
                      setActiveSubject(subj);
                      safeStorage.setItem('edu_ai_active_subject', subj);
                    }}
                    className={`text-xs px-3 py-1 rounded-lg font-medium transition-all cursor-pointer border ${
                      activeSubject === subj
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white dark:bg-[#171E24] text-slate-600 dark:text-slate-300 border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-300'
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
                {[
                  { num: 1, title: 'Foundations & Concepts', desc: 'Core theory & context' },
                  { num: 2, title: 'Applied Case Analysis', desc: 'Practical walkthroughs' },
                  { num: 3, title: 'Framework Study', desc: 'Key architecture models' },
                  { num: 4, title: 'Exercises & Practice', desc: 'Problem sets & notes' },
                  { num: 5, title: 'Weekly Assessment', desc: 'Final mastery review' },
                ].map((mod) => {
                  const isDone = mod.num <= completedModules;
                  const isCurrent = mod.num === completedModules + 1;
                  return (
                    <div
                      key={mod.num}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isDone
                          ? 'bg-emerald-50/70 dark:bg-[#12211B] border-emerald-200 dark:border-emerald-700/40'
                          : isCurrent
                          ? 'bg-brand-50/80 dark:bg-[#13252C] border-brand-300 dark:border-brand-400/50'
                          : 'bg-white dark:bg-[#171E24] border-[#E2DDD3] dark:border-[#26313A] opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          0{mod.num}
                        </span>
                        {isDone ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <span className={`text-[10px] font-mono ${isCurrent ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-slate-400'}`}>
                            {isCurrent ? 'Active' : 'Next'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                        {mod.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {mod.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCompleteModule}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Complete Next Module (+1)</span>
                  </button>
                  {completedModules > 0 && (
                    <button
                      onClick={() => {
                        setCompletedModules(0);
                        safeStorage.setItem('edu_ai_weekly_modules', '0');
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Reset Week
                    </button>
                  )}
                </div>

                <button
                  onClick={() => onNavigate?.('learning-path')}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Full Curriculum</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Daily Reading Goal Widget */}
      <DailyReadingGoalCard />

      {/* Continue Reading Shelf */}
      {continueReading.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2DDD3] dark:border-[#26313A] pb-2.5">
            <div className="flex items-baseline gap-2.5">
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 font-display">
                Continue Reading
              </h3>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {continueReading.length} active
              </span>
            </div>
            <button
              onClick={() => onNavigate?.('library')}
              className="text-xs sm:text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Library</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex overflow-x-auto gap-4 sm:gap-5 pb-2 pt-1 px-0.5 scrollbar-hide snap-x">
            {continueReading.map((book, idx) => (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06 }}
                onClick={() => onBookSelect(book)}
                key={book.id}
                className="group cursor-pointer shrink-0 w-36 sm:w-44 snap-start flex flex-col bg-white dark:bg-[#171E24] p-3 rounded-2xl border border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-400 dark:hover:border-brand-400/60 transition-all duration-200"
              >
                <div className="w-full aspect-[2/3] rounded-xl overflow-hidden relative mb-3 bg-[#EFECE4] dark:bg-[#11161A]">
                  <BookCoverVisual book={book} className="w-full h-full object-cover absolute inset-0 group-hover:scale-[1.03] transition-transform duration-300" />

                  {book.readProgress !== undefined && (
                    <div className="absolute top-2 right-2 z-10 bg-[#11161A]/85 text-white text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md tabular-nums">
                      {book.readProgress}%
                    </div>
                  )}

                  <div className="absolute inset-0 bg-[#11161A]/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                    <div className="w-10 h-10 rounded-full bg-white text-brand-700 flex items-center justify-center shadow-md">
                      <PlayCircle className="w-6 h-6" />
                    </div>
                  </div>

                  {book.readProgress !== undefined && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                      <div
                        className="h-full bg-brand-500 transition-all duration-500"
                        style={{ width: `${book.readProgress}%` }}
                      />
                    </div>
                  )}
                </div>

                <h4 className="font-semibold text-slate-900 dark:text-slate-100 leading-tight text-xs sm:text-sm line-clamp-2 mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {book.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                  {book.author}
                </p>

                <div className="mt-auto pt-2 border-t border-[#E2DDD3]/80 dark:border-[#26313A] flex items-center justify-between text-[11px] text-brand-600 dark:text-brand-400 font-semibold">
                  <span>Resume</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Study Portals — Unified Architectural Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {studyPortals.map((portal) => {
          const Icon = portal.icon;
          return (
            <button
              key={portal.id}
              onClick={() => onNavigate?.(portal.id)}
              className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#171E24] border border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-400 dark:hover:border-brand-400/70 transition-all text-left flex flex-col justify-between gap-4 group cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-100/80 text-brand-600 dark:text-brand-400 border border-brand-200/70 dark:border-brand-300/20 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-400">
                  {portal.index}
                </span>
              </div>
              <div>
                <div className="font-display font-semibold text-slate-900 dark:text-white text-sm sm:text-base flex items-center justify-between gap-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  <span>{portal.title}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0" />
                </div>
                <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  {portal.desc}
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* Curriculum STEM Atlas Feature Plate */}
      <section className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#171E24] border border-[#E2DDD3] dark:border-[#26313A] overflow-hidden grid grid-cols-1 md:grid-cols-[1.1fr_1.4fr] items-center">
        <div className="h-44 md:h-full min-h-[180px] bg-[#EFECE4] dark:bg-[#11161A] border-b md:border-b-0 md:border-r border-[#E2DDD3] dark:border-[#26313A] overflow-hidden">
          {!atlasImgFailed ? (
            <img
              src={stemAtlasImg}
              alt="Scientific atlas plate depicting orbital mechanics, crystal lattice, botanical leaf venation, and wave resonance"
              referrerPolicy="no-referrer"
              onError={() => setAtlasImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-brand-50 dark:bg-[#122E35]">
              <FlaskConical className="w-10 h-10 text-brand-600 dark:text-brand-400" />
            </div>
          )}
        </div>
        <div className="p-5 sm:p-6 md:p-7 space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400 font-medium">
            Interactive Practicals · Study Roadmap
          </div>
          <h3 className="text-lg sm:text-xl font-display font-semibold text-slate-900 dark:text-white leading-snug">
            Bridge textbook theory with live simulations and structured curriculum milestones
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Explore interactive Chemistry, Physics, and Biology apparatus inside EduLab or follow a syllabus-calibrated weekly roadmap for {displayField || 'your studies'}.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              onClick={() => onNavigate?.('edulab')}
              className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Open EduLab</span>
            </button>
            <button
              onClick={() => onNavigate?.('learning-path')}
              className="px-3.5 py-2 rounded-xl bg-[#FAF8F4] dark:bg-[#11161A] border border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-400 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span>View Learning Path</span>
            </button>
          </div>
        </div>
      </section>

      {/* Curated Recommendations */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#E2DDD3] dark:border-[#26313A] pb-2.5">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 font-display">
              Recommended Readings
            </h3>
            {academicProfile.isConfigured && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Aligned to <span className="font-medium text-slate-800 dark:text-slate-200">{academicProfile.summaryLabel}</span>
                {academicProfile.subjects.length > 0 && (
                  <span> · {academicProfile.subjects.slice(0, 4).join(', ')}{academicProfile.subjects.length > 4 ? ` +${academicProfile.subjects.length - 4}` : ''}</span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={() => onNavigate?.('library')}
            className="text-xs sm:text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Explore Library</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {aiRecommendations.map(({ book, matchReason }, idx) => {
            const isInLibrary = libraryBookIdSet.has(book.id);
            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 + 0.06 }}
                onClick={() => {
                  if (!isInLibrary && onAddBookToLibrary) {
                    onAddBookToLibrary(book);
                  }
                  onBookSelect(book);
                }}
                key={book.id}
                className="group cursor-pointer flex flex-col bg-white dark:bg-[#171E24] p-3 rounded-2xl border border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-400 dark:hover:border-brand-400/60 transition-all duration-200"
              >
                <div className="w-full aspect-[2/3] rounded-xl overflow-hidden relative mb-2.5 bg-[#EFECE4] dark:bg-[#11161A]">
                  <BookCoverVisual book={book} className="w-full h-full object-cover absolute inset-0 group-hover:scale-[1.03] transition-transform duration-300" />
                  <div className="absolute inset-0 bg-[#11161A]/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                    <PlayCircle className="w-8 h-8 text-white drop-shadow-md" />
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-brand-600 dark:text-brand-400 font-medium truncate mb-1">
                  {matchReason}
                </span>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 leading-tight text-xs line-clamp-2 mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {book.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                  {book.author}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Subject Filter Shelf */}
      <section className="space-y-4 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DDD3] dark:border-[#26313A] pb-2.5">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 font-display">
            Your Subject Shelf
          </h3>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer border ${
                  selectedCategory === cat
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white dark:bg-[#171E24] text-slate-600 dark:text-slate-300 border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {exploreList.slice(0, 8).map((book) => (
            <div
              key={book.id}
              onClick={() => onBookSelect(book)}
              className="flex gap-3 p-3 rounded-2xl bg-white dark:bg-[#171E24] border border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-400 transition-all cursor-pointer group"
            >
              <div className="w-14 h-20 shrink-0 rounded-lg overflow-hidden bg-[#EFECE4] dark:bg-[#11161A] relative">
                <BookCoverVisual book={book} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-[10px] font-mono uppercase font-medium text-brand-600 dark:text-brand-400 tracking-wider truncate">
                  {book.subjects?.[0] || book.category.split(',')[0]}
                </span>
                <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors mt-0.5">
                  {book.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{book.author}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
