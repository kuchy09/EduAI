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

interface DashboardProps {
  books: Book[];
  onBookSelect: (book: Book) => void;
  user: any;
  profile?: any;
  onNavigate?: (view: any) => void;
  onAddBookToLibrary?: (book: Book) => void;
}

export function Dashboard({ books, onBookSelect, user, profile, onNavigate }: DashboardProps) {
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

  // Fallback to user_metadata if profile not found/loaded yet
  const educationLevel = profile?.education_level || user?.user_metadata?.education_level;
  const fieldOfStudy = profile?.field_of_study || user?.user_metadata?.field_of_study;
  const userCurriculum = profile?.curriculum || user?.user_metadata?.curriculum;
  const userCountry = profile?.country || user?.user_metadata?.country || '';
  const userSubjectsRaw = profile?.subjects || user?.user_metadata?.subjects || '';

  const userSubjects = Array.isArray(userSubjectsRaw) 
    ? userSubjectsRaw.map((s: string) => s.toLowerCase()) 
    : typeof userSubjectsRaw === 'string' 
      ? userSubjectsRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) 
      : [];

  const isSchool = educationLevel === 'Primary' || educationLevel === 'High School';

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

  const personalizedBooks = books.filter(book => {
    const bookSubjects = (book.subjects || []).map(s => s.toLowerCase());
    
    // Always strict match subjects if user has subjects defined
    const matchesSubjects = userSubjects.length > 0 
      ? bookSubjects.some(s => userSubjects.includes(s)) || book.level === 'All'
      : book.level === 'All' || book.category === 'Information and Communication Technologies (ICT)';

    if (isSchool) {
      // Filter school books by curriculum and subjects
      const matchesCurriculum = (book.curriculum?.some(c => c.toLowerCase().includes(userCurriculum?.toLowerCase() || '')) || !book.curriculum || !userCurriculum);
      const matchesCountry = (book.country?.some(c => c.toLowerCase().includes(userCountry?.toLowerCase() || '')) || !book.country || !userCountry);
      const bLevel = book.level?.toLowerCase() || '';
      const isLevelMatch = bLevel === 'school' || bLevel.includes('school');
      return isLevelMatch && matchesCurriculum && matchesCountry && matchesSubjects;
    } else if (educationLevel) {
      // Filter university books by field of study and subjects
      const matchesField = book.category === fieldOfStudy || !fieldOfStudy || book.level === 'All';
      const bLevel = book.level?.toLowerCase() || '';
      const isLevelMatch = bLevel === 'university' || bLevel.includes('uni');
      return isLevelMatch && (matchesField || matchesSubjects);
    }
    
    // If no setup, don't show school or university specific books unless they are general.
    return book.level === 'All' || book.category === 'General' || matchesSubjects; 
  });

  // Sort continue reading by most recently read / active progress
  const continueReading = books
    .filter(b => b.readProgress && b.readProgress > 0 && b.readProgress < 100)
    .sort((a, b) => (b.readProgress || 0) - (a.readProgress || 0));

  const recommended = (personalizedBooks.length > 0 ? personalizedBooks : books)
    .filter(b => b.rating >= 4.5)
    .slice(0, 6);

  const exploreList = selectedCategory === 'All'
    ? books.slice(0, 8)
    : books.filter(b => b.category === selectedCategory);

  const categories = ['All', ...Array.from(new Set(books.map(b => b.category).filter(Boolean)))].slice(0, 6);

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

  const fullName = profile?.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Alex Morgan');
  const firstName = fullName.split(' ')[0] || 'Learner';
  const displayField = isSchool
    ? 'General Studies'
    : fieldOfStudy;

  const defaultSubject = userSubjects.length > 0 
    ? (userSubjects[0].charAt(0).toUpperCase() + userSubjects[0].slice(1))
    : (displayField || 'Computer Science & AI');

  const [activeSubject, setActiveSubject] = useState<string>(() => {
    return safeStorage.getItem('edu_ai_active_subject') || defaultSubject;
  });

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

  const availableSubjects = Array.from(new Set([
    activeSubject,
    ...userSubjects.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)),
    'Computer Science & AI',
    'Interactive Design Systems',
    'Data Structures & Algorithms',
    'Cognitive Psychology',
    'Business & Innovation'
  ])).filter(Boolean);

  const insight = fieldInsights[displayField as keyof typeof fieldInsights] || {
    quote: "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela"
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      {/* Compact Subject Check & User Welcome Header */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 p-4 sm:p-5 shadow-sm hover:shadow transition-all duration-300"
      >
        {/* Subtle accent specular gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-indigo-500 to-emerald-500" />
        <div className="absolute -right-12 -top-12 w-36 h-36 bg-brand-500/5 dark:bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Avatar + Subject Check Badge + User's Name + Welcome sentence */}
          <div className="flex items-start sm:items-center gap-3.5">
            {/* User Avatar / Initials */}
            <button 
              onClick={() => onNavigate?.('profile')}
              className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl ring-2 ring-brand-500/20 dark:ring-brand-400/20 p-0.5 shadow-sm overflow-hidden shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-transform bg-slate-100 dark:bg-slate-800"
              title="View & Edit Profile"
            >
              {avatarUrl && !avatarFailed ? (
                <img 
                  src={avatarUrl} 
                  alt={fullName} 
                  className="w-full h-full object-cover rounded-[10px]" 
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-brand-600 to-indigo-600 rounded-[10px] flex items-center justify-center font-bold text-sm sm:text-base text-white">
                  {firstName.charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            {/* Content text */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* Subject Check Pill */}
                <button
                  onClick={() => setIsSubjectModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer group/btn"
                  title="Click to perform Subject Check & view modules"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 group-hover/btn:scale-110 transition-transform" />
                  <span>Subject Check:</span>
                  <span className="font-bold underline decoration-emerald-400/40">{activeSubject}</span>
                </button>

                {/* User's Name */}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  • <strong className="font-semibold text-slate-700 dark:text-slate-300">{fullName}</strong>
                </span>
              </div>

              {/* Exact user request sentence: "Welcome to Edu AI. You've completed.....modules this week" */}
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-1.5 leading-snug">
                <span>Welcome to Edu AI.</span>
                <span className="text-brand-600 dark:text-brand-400 font-bold">
                  You've completed {completedModules} modules this week
                </span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  ({Math.round((completedModules / weeklyTarget) * 100)}% of weekly goal)
                </span>
              </h2>

              <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <span>
                  {completedModules >= weeklyTarget 
                    ? '🎉 Weekly module milestone achieved!' 
                    : `${weeklyTarget - completedModules} more module${weeklyTarget - completedModules === 1 ? '' : 's'} to hit your 5-module target.`}
                </span>
                {continueReading.length > 0 && (
                  <span className="hidden sm:inline text-slate-400 dark:text-slate-600">
                    • In progress: <strong className="font-medium text-slate-700 dark:text-slate-300">"{continueReading[0].title}"</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right section ("and more"): Quick stats + action triggers */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
            {/* Mini Progress & Streak Pills */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs">
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold" title="Reading streak">
                <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{metrics.streakDays}d</span>
              </div>
              <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Target className="w-3.5 h-3.5 text-brand-500" />
                <span className="font-medium">{completedModules}/{weeklyTarget} modules</span>
              </div>
            </div>

            {/* Quick Action: Subject Check Modal */}
            <button
              onClick={() => setIsSubjectModalOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Inspect modules and subjects"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Subject Check</span>
            </button>

            {continueReading.length > 0 ? (
              <button
                onClick={() => onBookSelect(continueReading[0])}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                title={`Continue reading "${continueReading[0].title}"`}
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Resume</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate?.('learning-path')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Learning Path</span>
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

              {/* This Week's 5 Modules Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 font-display">
              Recommended For Your Studies
            </h3>
          </div>
          <button 
            onClick={() => onNavigate?.('library')}
            className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Explore All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {recommended.map((book, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 + 0.1 }}
              onClick={() => onBookSelect(book)}
              key={book.id} 
              className="group cursor-pointer flex flex-col liquid-glass-card p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-500/50 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-full aspect-[2/3] rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-shadow relative mb-2.5 bg-slate-100 dark:bg-slate-800">
                <BookCoverVisual book={book} className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 backdrop-blur-[2px]">
                  <PlayCircle className="w-8 h-8 text-white drop-shadow-md" />
                </div>
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 leading-tight text-xs line-clamp-2 mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                {book.title}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {book.author}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Category Pills & Explore Catalog */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 font-display">
            Browse by Subject & Category
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {exploreList.slice(0, 4).map((book) => (
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
                  {book.category}
                </span>
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-brand-600 transition-colors">
                  {book.title}
                </h4>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{book.author}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
