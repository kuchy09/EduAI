import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book } from '../types';
import { 
  Sparkles, Clock, Star, PlayCircle, Flame, BookOpen, 
  CheckCircle2, Target, ArrowRight, Radio, Compass,
  BookMarked, Brain, Headphones, ChevronRight, Layers,
  RefreshCw, Award, Zap, X, Check
} from 'lucide-react';
import { BookCoverVisual } from './BookCoverVisual';
import { DailyReadingGoalCard } from './DailyReadingGoalCard';
import { getDailyGoal, GOAL_EVENT_NAME } from '../lib/readingGoal';
import { fetchUserDashboardMetrics, UserStatsSummary } from '../lib/userHomeDataService';
import { isAppOnline } from '../lib/offlineManager';
import { useUserAvatar } from '../lib/userAvatarService';
import { safeStorage } from '../lib/safeStorage';
import { platformBookStoreCatalog } from '../data';
import {
  extractUserAcademicProfile,
  getPersonalizedBooks,
  getAiRecommendedBooks,
  findMatchingUserSubjects,
  ACADEMIC_PREFS_EVENT,
} from '../lib/bookPersonalization';

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
  const avatarUrl = useUserAvatar(user);
  const [avatarFailed, setAvatarFailed] = useState(false);

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
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [prefsTick, setPrefsTick] = useState(0);
  useEffect(() => {
    const onPrefsUpdated = () => setPrefsTick((t) => t + 1);
    window.addEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
    return () => window.removeEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
  }, []);

  const academicProfile = React.useMemo(
    () => extractUserAcademicProfile(profile, user),
    [profile, user, prefsTick]
  );

  const educationLevel = academicProfile.educationLevel;
  const fieldOfStudy = academicProfile.fieldOfStudy;
  const isSchool = academicProfile.isSchoolLevel;

  // Real-time metrics loading and event listener
  useEffect(() => {
    let isMounted = true;
    setIsOnline(isAppOnline());

    const updateMetrics = async () => {
      if (user?.id) {
        setIsSyncing(true);
        const data = await fetchUserDashboardMetrics(user.id, books);
        if (isMounted) {
          setMetrics(data);
          setIsSyncing(false);
        }
      }
    };

    updateMetrics();

    const handleGoalUpdate = () => updateMetrics();
    const handleProgressUpdate = () => updateMetrics();
    const handleOnlineStatus = () => setIsOnline(isAppOnline());

    window.addEventListener(GOAL_EVENT_NAME, handleGoalUpdate);
    window.addEventListener('edu-ai-progress-updated', handleProgressUpdate);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      isMounted = false;
      window.removeEventListener(GOAL_EVENT_NAME, handleGoalUpdate);
      window.removeEventListener('edu-ai-progress-updated', handleProgressUpdate);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, [user?.id, books]);

  const personalizedBooks = React.useMemo(
    () => getPersonalizedBooks(books, academicProfile, { allowFallbackIfEmpty: true, includeStartedBooks: true }),
    [books, academicProfile]
  );

  // Merge library + unowned bookstore catalog items for comprehensive AI Recommendations
  const unifiedRecommendationPool = React.useMemo(() => {
    const seen = new Set(books.map((b) => b.id));
    const extras = platformBookStoreCatalog.filter((b) => !seen.has(b.id));
    return [...books, ...extras];
  }, [books]);

  const aiRecommendations = React.useMemo(
    () => getAiRecommendedBooks(unifiedRecommendationPool, academicProfile, 6),
    [unifiedRecommendationPool, academicProfile]
  );

  const libraryBookIdSet = React.useMemo(() => new Set(books.map((b) => b.id)), [books]);

  // Sort continue reading by most recently read / active progress within personalized shelf
  const continueReading = React.useMemo(
    () =>
      personalizedBooks
        .filter((b) => b.readProgress && b.readProgress > 0 && b.readProgress < 100)
        .sort((a, b) => (b.readProgress || 0) - (a.readProgress || 0)),
    [personalizedBooks]
  );

  // Subject & category chips tailored to user's sign-up subjects
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

  const fieldInsights: Record<string, { quote: string; author: string }> = {
    'Business, Administration, and Law': {
      quote: "The best way to predict the future is to create it.",
      author: "Peter Drucker"
    },
    'Engineering, Manufacturing, and Construction': {
      quote: "Scientists study the world as it is; engineers create the world that has never been.",
      author: "Theodore von Kármán"
    },
    'Information and Communication Technologies (ICT)': {
      quote: "Innovation distinguishes between a leader and a follower.",
      author: "Steve Jobs"
    },
    'Health and Welfare': {
      quote: "Wherever the art of Medicine is loved, there is also a love of Humanity.",
      author: "Hippocrates"
    },
    'Natural Sciences, Mathematics, and Statistics': {
      quote: "Nothing in life is to be feared, it is only to be understood. Now is the time to understand more.",
      author: "Marie Curie"
    },
    'Arts and Humanities': {
      quote: "Creativity takes courage.",
      author: "Henri Matisse"
    },
    'Social Sciences': {
      quote: "The function of education is to teach one to think intensively and to think critically.",
      author: "Martin Luther King Jr."
    },
    'Agriculture, Forestry, Fisheries, and Veterinary': {
      quote: "The discovery of agriculture was the first big step toward a civilized life.",
      author: "Arthur Keith"
    },
    'Services': {
      quote: "Always give people more than what they expect to get.",
      author: "Nelson Boswell"
    }
  };

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
    return 4; // Starter weekly completed modules
  });

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const weeklyTarget = 5;

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

  const insight = fieldInsights[displayField as keyof typeof fieldInsights] || {
    quote: "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela"
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6 md:space-y-8 min-w-0 transition-all duration-300">
      {/* Elastic Adaptive Subject Check & User Welcome Header */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white dark:bg-[#181818] border border-slate-200/90 dark:border-[#282828] p-3 sm:p-5 md:p-6 lg:p-7 shadow-sm dark:shadow-[0_6px_24px_-4px_rgba(0,0,0,0.55)] hover:shadow-md transition-all duration-300 w-full max-w-full min-w-0 box-border"
      >
        {/* Subtle accent specular gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-indigo-500 to-emerald-500" />
        <div className="absolute -right-8 -top-8 sm:-right-12 sm:-top-12 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 bg-brand-500/5 dark:bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Elastic responsive main flex row (phone: clean horizontal cluster, tablet/desktop: fluid row) */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4 md:gap-5 lg:gap-6 w-full min-w-0">
          {/* Left: Avatar + Subject Check Badge + User's Name + Welcome sentence */}
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-4 md:gap-5 min-w-0 flex-1">
            {/* User Avatar / Initials with elastic sizing */}
            <button 
              onClick={() => onNavigate?.('profile')}
              className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl ring-2 ring-brand-500/20 dark:ring-brand-400/20 p-0.5 shadow-sm overflow-hidden shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-transform bg-slate-100 dark:bg-[#202020] inline-flex items-center justify-center align-middle"
              title="View & Edit Profile"
            >
              {avatarUrl && !avatarFailed ? (
                <img 
                  src={avatarUrl} 
                  alt={fullName} 
                  className="w-full h-full object-cover rounded-[10px] sm:rounded-[14px]" 
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-brand-600 to-indigo-600 rounded-[10px] sm:rounded-[14px] flex items-center justify-center font-bold text-sm sm:text-base md:text-lg text-white">
                  {firstName.charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            {/* Elastic content text column with min-w-0 to prevent flex blowouts */}
            <div className="space-y-1 sm:space-y-1.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 min-w-0">
                {/* Subject Check Pill */}
                <button
                  onClick={() => setIsSubjectModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer group/btn shrink-0"
                  title="Click to perform Subject Check & view modules"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 group-hover/btn:scale-110 transition-transform" />
                  <span>Subject Check:</span>
                  <span className="font-bold underline decoration-emerald-400/40">{activeSubject}</span>
                </button>

                {/* User's Name */}
                <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-[#A0A0A0] truncate max-w-full">
                  • <strong className="font-semibold text-slate-700 dark:text-[#EDEDED]">{fullName}</strong>
                </span>

                {/* Active Academic Intake Pill */}
                <button
                  type="button"
                  onClick={() => onOpenAcademicPrefs?.()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                  title="Edit Country, Curriculum, Education Level & Subjects"
                >
                  <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span className="truncate max-w-[220px] sm:max-w-xs">
                    {academicProfile.isConfigured ? academicProfile.summaryLabel : 'Set Curriculum & Subjects'}
                  </span>
                </button>
              </div>

              {/* Exact user request sentence: "Welcome to Edu AI. You've completed.....modules this week" */}
              <h2 className="text-sm xs:text-base sm:text-lg md:text-xl font-semibold text-slate-900 dark:text-[#EDEDED] flex flex-wrap items-baseline gap-x-2 gap-y-1 leading-snug sm:leading-tight">
                <span>Welcome to Edu AI.</span>
                <span className="text-brand-600 dark:text-[#8a70d6] font-bold">
                  You've completed {completedModules} modules this week
                </span>
                <span className="text-[11px] sm:text-xs font-normal text-slate-500 dark:text-[#A0A0A0] shrink-0">
                  ({Math.round((completedModules / weeklyTarget) * 100)}% of weekly goal)
                </span>
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A0A0A0] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  {completedModules >= weeklyTarget 
                    ? '🎉 Weekly module milestone achieved!' 
                    : `${weeklyTarget - completedModules} more module${weeklyTarget - completedModules === 1 ? '' : 's'} to hit your 5-module target.`}
                </span>
                {continueReading.length > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-slate-400 dark:text-[#8E8E93] truncate max-w-xs md:max-w-sm lg:max-w-md">
                    • In progress: <strong className="font-medium text-slate-700 dark:text-[#EDEDED] truncate">"{continueReading[0].title}"</strong>
                  </span>
                )}
              </p>

              {/* Elastic fluid module progress bar */}
              <div className="w-full max-w-md lg:max-w-lg bg-slate-100 dark:bg-[#242424] rounded-full h-1.5 sm:h-2 overflow-hidden mt-1.5">
                <motion.div 
                  className="h-full bg-gradient-to-r from-brand-500 via-indigo-500 to-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.round((completedModules / weeklyTarget) * 100))}%` }}
                  transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                />
              </div>
            </div>
          </div>

          {/* Right section: Horizontally aligned on the same line */}
          <div className="flex flex-row items-center gap-1.5 sm:gap-2.5 lg:gap-3 w-full sm:w-auto shrink-0 justify-start sm:justify-end flex-wrap sm:flex-nowrap pt-2 sm:pt-0 border-t border-slate-100 dark:border-[#282828] sm:border-0">
            {/* Mini Progress & Streak Pills */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 dark:bg-[#202020] px-2 sm:px-2.5 md:px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-white/10 text-xs sm:text-sm shrink-0">
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold" title="Reading streak">
                <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{metrics.streakDays}d</span>
              </div>
              <div className="w-px h-3.5 bg-slate-200 dark:bg-white/10" />
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#EDEDED]">
                <Target className="w-3.5 h-3.5 text-brand-500" />
                <span className="font-medium hidden sm:inline">{completedModules}/{weeklyTarget} modules</span>
                <span className="font-medium sm:hidden">{completedModules}/{weeklyTarget}m</span>
              </div>
            </div>

            {/* Quick Action: Subject Check Modal */}
            <button
              onClick={() => setIsSubjectModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
              title="Inspect modules and subjects"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden xs:inline">Subject Check</span>
            </button>

            {continueReading.length > 0 ? (
              <button
                onClick={() => onBookSelect(continueReading[0])}
                className="px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
                title={`Continue reading "${continueReading[0].title}"`}
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Resume</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate?.('learning-path')}
                className="px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
              >
                <Compass className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Learning Path</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Subject Check Modal / Drawer Overlay */}
        <AnimatePresence>
          {isSubjectModalOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Subject Check & Module Syllabus
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                    {activeSubject}
                  </span>
                </div>
                <button
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Subject switcher pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">Switch Subject:</span>
                {availableSubjects.map((subj) => (
                  <button
                    key={subj}
                    onClick={() => {
                      setActiveSubject(subj);
                      safeStorage.setItem('edu_ai_active_subject', subj);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      activeSubject === subj
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>

              {/* This Week's 5 Modules Checklist - Elastic Grid: Phone (1-2 col), Tablet (3 col), Computer (5 col) */}
              <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-2.5 pt-1">
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
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isDone
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                          : isCurrent
                          ? 'bg-brand-50/70 dark:bg-brand-950/30 border-brand-300 dark:border-brand-700 ring-1 ring-brand-400/30'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Module 0{mod.num}
                        </span>
                        {isDone ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : isCurrent ? (
                          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                        {mod.title}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {isDone ? 'Completed ✓' : isCurrent ? 'In progress' : 'Upcoming'}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons inside the Subject Check modal */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCompleteModule}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
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
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Reset Week
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate?.('learning-path')}
                    className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <span>Full Curriculum</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Daily Reading Goal Widget (Realtime Synced with Cloud) */}
      <DailyReadingGoalCard />

      {/* Continue Reading Shelf (Real-time Progress Tracker) */}
      {continueReading.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 font-display">
                Continue Reading
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {continueReading.length}
              </span>
            </div>
            <button 
              onClick={() => onNavigate?.('library')}
              className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Library</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex overflow-x-auto gap-4 sm:gap-6 pb-4 pt-1 px-1 -mx-1 scrollbar-hide snap-x">
            {continueReading.map((book, idx) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                onClick={() => onBookSelect(book)}
                key={book.id} 
                className="group cursor-pointer shrink-0 w-36 sm:w-44 snap-start flex flex-col liquid-glass-card p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-500/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-full aspect-[2/3] rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-shadow relative mb-3 bg-slate-100 dark:bg-slate-800">
                  <BookCoverVisual book={book} className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-500" />
                  
                  {/* Floating Percentage Badge */}
                  {book.readProgress !== undefined && (
                    <div className="absolute top-2 right-2 z-10 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow border border-white/20">
                      {book.readProgress}%
                    </div>
                  )}

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 backdrop-blur-[2px]">
                    <div className="w-10 h-10 rounded-full bg-white text-brand-900 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      <PlayCircle className="w-6 h-6 fill-brand-600 text-white" />
                    </div>
                  </div>

                  {/* Progress Line */}
                  {book.readProgress !== undefined && (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40">
                      <div 
                        className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-500" 
                        style={{ width: `${book.readProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                <h4 className="font-bold text-slate-900 dark:text-slate-100 leading-tight text-xs sm:text-sm line-clamp-2 mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {book.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                  {book.author}
                </p>

                <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-brand-600 dark:text-brand-400 font-semibold">
                  <span>Resume</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Study Navigation & Smart Portals */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => onNavigate?.('ai-tutor')}
          className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/40 hover:shadow-md transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer active:scale-98"
        >
          <div className="p-2.5 rounded-xl bg-indigo-500 text-white w-fit shadow-sm shadow-indigo-500/20 group-hover:scale-110 transition-transform">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">AI Study Tutor</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Mascot explanations & Q&A</div>
          </div>
        </button>

        <button
          onClick={() => onNavigate?.('quizzes')}
          className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-100 dark:border-amber-900/40 hover:shadow-md transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer active:scale-98"
        >
          <div className="p-2.5 rounded-xl bg-amber-500 text-white w-fit shadow-sm shadow-amber-500/20 group-hover:scale-110 transition-transform">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Smart Quizzes</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Test chapter retention</div>
          </div>
        </button>

        <button
          onClick={() => onNavigate?.('audiobooks')}
          className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/80 to-pink-50/50 dark:from-purple-950/30 dark:to-pink-950/20 border border-purple-100 dark:border-purple-900/40 hover:shadow-md transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer active:scale-98"
        >
          <div className="p-2.5 rounded-xl bg-purple-500 text-white w-fit shadow-sm shadow-purple-500/20 group-hover:scale-110 transition-transform">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Audiobooks</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Listen & learn on the go</div>
          </div>
        </button>

        <button
          onClick={() => onNavigate?.('workspace')}
          className="p-4 rounded-2xl bg-gradient-to-br from-sky-50/80 to-blue-50/50 dark:from-sky-950/30 dark:to-blue-950/20 border border-sky-100 dark:border-sky-900/40 hover:shadow-md transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer active:scale-98"
        >
          <div className="p-2.5 rounded-xl bg-sky-500 text-white w-fit shadow-sm shadow-sky-500/20 group-hover:scale-110 transition-transform">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">Workspace</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Notes, documents & docs</div>
          </div>
        </button>
      </section>

      {/* AI Recommended / Curated For You */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 font-display">
                AI Recommendations For Your Studies
              </h3>
            </div>
            {academicProfile.isConfigured && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Matched to <strong className="text-slate-700 dark:text-slate-200">{academicProfile.summaryLabel}</strong>
                {academicProfile.subjects.length > 0 && (
                  <span> • {academicProfile.subjects.slice(0, 4).join(', ')}{academicProfile.subjects.length > 4 ? ` +${academicProfile.subjects.length - 4} more` : ''}</span>
                )}
              </p>
            )}
          </div>
          <button 
            onClick={() => onNavigate?.('library')}
            className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 flex items-center gap-1 transition-colors cursor-pointer"
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 + 0.1 }}
                onClick={() => {
                  if (!isInLibrary && onAddBookToLibrary) {
                    onAddBookToLibrary(book);
                  }
                  onBookSelect(book);
                }}
                key={book.id} 
                className="group cursor-pointer flex flex-col liquid-glass-card p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-500/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-full aspect-[2/3] rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-shadow relative mb-2.5 bg-slate-100 dark:bg-slate-800">
                  <BookCoverVisual book={book} className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 backdrop-blur-[2px]">
                    <PlayCircle className="w-8 h-8 text-white drop-shadow-md" />
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full truncate mb-1.5">
                  <Sparkles className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{matchReason}</span>
                </span>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 leading-tight text-xs line-clamp-2 mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
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

      {/* Subject Pills & Personalized Shelf */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 font-display">
            Your Personalized Subject Shelf
          </h3>
          
          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
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
              className="flex gap-3 p-3 rounded-2xl liquid-glass-card border border-slate-200/80 dark:border-slate-800 hover:border-brand-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="w-14 h-20 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative shadow-sm">
                <BookCoverVisual book={book} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-[10px] uppercase font-bold text-brand-600 dark:text-brand-400 tracking-wider truncate">
                  {book.subjects?.[0] || book.category.split(',')[0]}
                </span>
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-brand-600 transition-colors">
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
