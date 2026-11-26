import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Trophy, Book, CheckCircle2, Target, Flame, Activity, Brain,
  BookOpen, Sparkles, Compass, Map as MapIcon, Award, Star,
  Library as LibraryIcon, Crown, ArrowRight, FlaskConical, AlertCircle, Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getDailyGoal, GOAL_EVENT_NAME } from '../lib/readingGoal';
import {
  ACHIEVEMENT_BADGES,
  ACHIEVEMENTS_UPDATED_EVENT,
  AchievementBadgeDefinition,
  getScholarRank,
  getStoredAchievements,
  UserAchievementState,
} from '../lib/achievementsService';
import {
  analyzeLearningCycle,
  LEARNING_CYCLE_UPDATED_EVENT,
} from '../lib/learningCycleService';
import { ACCOUNT_SYNC_EVENT } from '../lib/accountSyncService';
import { safeStorage } from '../lib/safeStorage';
import { ViewState } from '../types';

interface ProgressProps {
  user: any;
  profile?: any;
  books: any[];
  onNavigate?: (view: ViewState) => void;
}

function getBadgeIcon(iconName: AchievementBadgeDefinition['iconName']) {
  switch (iconName) {
    case 'book-open':
      return <BookOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
    case 'library':
      return <LibraryIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />;
    case 'crown':
      return <Crown className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
    case 'check-circle':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />;
    case 'target':
      return <Target className="w-4 h-4 text-rose-500 dark:text-rose-400" />;
    case 'trophy':
      return <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
    case 'flame':
      return <Flame className="w-4 h-4 text-orange-500 dark:text-orange-400" />;
    case 'compass':
      return <Compass className="w-4 h-4 text-teal-500 dark:text-teal-400" />;
    case 'map':
      return <MapIcon className="w-4 h-4 text-purple-500 dark:text-purple-400" />;
    case 'award':
      return <Award className="w-4 h-4 text-violet-500 dark:text-violet-400" />;
    case 'star':
      return <Star className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
    default:
      return <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />;
  }
}

export function Progress({ user, profile, books, onNavigate }: ProgressProps) {
  const [loading, setLoading] = useState(true);
  const [tokenUsage, setTokenUsage] = useState({ total: 0, count: 0, limit: 50000 });
  const [achievements, setAchievements] = useState<UserAchievementState>(() =>
    getStoredAchievements(user?.id)
  );
  const [goalTick, setGoalTick] = useState(0);

  useEffect(() => {
    setAchievements(getStoredAchievements(user?.id));
    const refreshAchievements = (e?: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.userId && user?.id && detail.userId !== user.id) return;
      setAchievements(getStoredAchievements(user?.id));
    };
    const refreshGoal = () => setGoalTick((t) => t + 1);

    window.addEventListener(ACHIEVEMENTS_UPDATED_EVENT, refreshAchievements);
    window.addEventListener(ACCOUNT_SYNC_EVENT, refreshAchievements);
    window.addEventListener(GOAL_EVENT_NAME, refreshGoal);
    window.addEventListener(LEARNING_CYCLE_UPDATED_EVENT, refreshGoal);
    window.addEventListener('edu-ai-progress-updated', refreshGoal);
    return () => {
      window.removeEventListener(ACHIEVEMENTS_UPDATED_EVENT, refreshAchievements);
      window.removeEventListener(ACCOUNT_SYNC_EVENT, refreshAchievements);
      window.removeEventListener(GOAL_EVENT_NAME, refreshGoal);
      window.removeEventListener(LEARNING_CYCLE_UPDATED_EVENT, refreshGoal);
      window.removeEventListener('edu-ai-progress-updated', refreshGoal);
    };
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    async function fetchUsage() {
      if (!user?.id || !supabase) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const { data: usageData } = await supabase
          .from('ai_tutor_usage')
          .select('total_tokens')
          .eq('user_id', user.id);

        let total = 0;
        let count = 0;
        if (usageData) {
          total = usageData.reduce((acc, curr) => acc + (curr.total_tokens || 0), 0);
          count = usageData.length;
        }
        if (mounted) {
          setTokenUsage({ total, count, limit: 50000 });
        }
      } catch (err) {
        console.error('Error fetching progress:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchUsage();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    const readFromBooks = books.filter((b) => (b.readProgress || 0) >= 100).length;
    const booksCompleted = Math.max(readFromBooks, achievements.completedBookIds.length);
    const quizRecords = Object.values(achievements.completedQuizIds);
    const avgScore =
      quizRecords.length > 0
        ? Math.round(quizRecords.reduce((sum, q) => sum + (q.bestScore || 0), 0) / quizRecords.length)
        : 0;
    const currentGoal = getDailyGoal();
    const historyValues = Object.entries(currentGoal.history || {});
    return {
      booksCompleted,
      quizzesCompleted: quizRecords.length,
      avgScore,
      streakDays: currentGoal.streak || 0,
      historyByDate: new Map(historyValues),
      todayMinutes: currentGoal.currentMinutes || 0,
    };
  }, [books, achievements, goalTick]);

  const weeklyActivity = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const bars: Array<{ day: string; mins: number; pct: number }> = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      const iso = d.toISOString().split('T')[0];
      const rec = stats.historyByDate.get(iso);
      const mins = offset === 0 ? Math.max(stats.todayMinutes, rec?.minutes || 0) : rec?.minutes || 0;
      bars.push({
        day: dayNames[d.getDay()],
        mins,
        pct: 0,
      });
    }
    const maxMins = Math.max(30, ...bars.map((b) => b.mins));
    return bars.map((b) => ({
      ...b,
      pct: Math.max(8, Math.round((b.mins / maxMins) * 100)),
    }));
  }, [stats.historyByDate, stats.todayMinutes]);

  const scholarRank = useMemo(
    () => getScholarRank(achievements.totalEduPoints),
    [achievements.totalEduPoints]
  );

  const previewBadges = useMemo(() => {
    const earned = ACHIEVEMENT_BADGES.filter((b) => Boolean(achievements.earnedBadges[b.id]))
      .sort((a, b) => {
        const tsA = Date.parse(achievements.earnedBadges[a.id]?.unlockedAt || '') || 0;
        const tsB = Date.parse(achievements.earnedBadges[b.id]?.unlockedAt || '') || 0;
        return tsB - tsA;
      });
    if (earned.length > 0) {
      return earned.slice(0, 4).map((badge) => ({
        badge,
        unlocked: true,
        earnedAt: achievements.earnedBadges[badge.id]?.unlockedAt,
        progress: badge.requirementTarget,
      }));
    }
    return ACHIEVEMENT_BADGES.slice(0, 3).map((badge) => ({
      badge,
      unlocked: false,
      earnedAt: undefined,
      progress: badge.evaluateProgress(achievements),
    }));
  }, [achievements]);

  const earnedBadgeCount = Object.keys(achievements.earnedBadges).length;
  const usagePercent = Math.min(100, Math.round((tokenUsage.total / tokenUsage.limit) * 100));

  const cycleAnalysis = useMemo(
    () => analyzeLearningCycle({ books, user, profile }),
    [books, user, profile, achievements, goalTick]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-[#EDEDED] tracking-tight">
            Your Progress
          </h2>
          <p className="text-slate-500 dark:text-[#A0A0A0] mt-2">
            Track your learning journey, Edu Points, and earned badges.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-[#171E24] px-4 py-3 rounded-2xl border border-[#E2DDD3] dark:border-[#26313A] shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-[#98A4AF]">
              {scholarRank.title}
            </div>
            <div className="text-lg font-bold font-display text-slate-900 dark:text-[#F2EFE9] tabular-nums">
              {achievements.totalEduPoints.toLocaleString()} EP
            </div>
          </div>
        </div>
      </div>

      {/* Stage 05 · Improve: Weakness Tracking & Targeted Recommendations */}
      <section className="rounded-2xl bg-white dark:bg-[#171E24] border border-[#E2DDD3] dark:border-[#26313A] p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2DDD3] dark:border-[#26313A]">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-brand-700 dark:text-brand-400 font-semibold">
              Stage 05 · Improve Loop
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-[#F2EFE9] mt-0.5">
              Weakness Diagnostics &amp; Targeted Recommendations
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#98A4AF] mt-0.5">
              Signals drawn from your reading progress, EduLab practicals, and quiz performance.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-600 dark:text-[#98A4AF] tabular-nums shrink-0">
            {cycleAnalysis.completedStagesCount}/5 cycle stages active
          </span>
        </div>

        {cycleAnalysis.weaknesses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cycleAnalysis.weaknesses.slice(0, 4).map((weakness) => (
              <div
                key={weakness.id}
                className="p-4 rounded-xl bg-[#FAF8F4] dark:bg-[#11161A] border border-[#E2DDD3] dark:border-[#26313A] flex flex-col justify-between gap-3.5"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-display font-bold text-slate-900 dark:text-[#F2EFE9] text-sm">
                      {weakness.subject}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold ${
                        weakness.severity === 'priority'
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{weakness.statusLabel}</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-[#98A4AF] leading-relaxed">
                    {weakness.reason}
                  </p>

                  {weakness.missedTopics.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-[#7F8C97]">
                        Concepts to Revisit
                      </div>
                      <ul className="space-y-1">
                        {weakness.missedTopics.slice(0, 2).map((topic, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-slate-700 dark:text-[#D5D1C8] line-clamp-1"
                          >
                            · {topic}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {onNavigate && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E2DDD3]/70 dark:border-[#26313A]">
                    <button
                      type="button"
                      onClick={() => {
                        safeStorage.setItem('ai_tutor_prefill', weakness.sagePrefillPrompt);
                        onNavigate('ai-tutor');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span>Ask Sage AI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('edulab')}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#171E24] border border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-400 text-slate-700 dark:text-[#F2EFE9] text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <FlaskConical className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                      <span>EduLab</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('quizzes')}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#171E24] border border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-400 text-slate-700 dark:text-[#F2EFE9] text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>Retake Quiz</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#FAF8F4] dark:bg-[#11161A] border border-[#E2DDD3] dark:border-[#26313A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-slate-900 dark:text-[#F2EFE9] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>No priority weaknesses detected yet</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#98A4AF]">
                Complete a chapter quiz in Stage 04 or explore an experiment in EduLab so Edu AI can pinpoint focus topics.
              </p>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(cycleAnalysis.recommendedNextStage.targetView)}
                className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
              >
                <span>{cycleAnalysis.recommendedNextStage.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Stats */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] shadow-sm flex flex-col items-center text-center plan-card transition-colors"
            >
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center mb-4">
                <Flame className="w-6 h-6" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-[#EDEDED] mb-1 tabular-nums">
                {stats.streakDays}
              </div>
              <div className="text-sm font-medium text-slate-500 dark:text-[#A0A0A0]">Day Streak</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] shadow-sm flex flex-col items-center text-center plan-card transition-colors"
            >
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
                <Book className="w-6 h-6" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-[#EDEDED] mb-1 tabular-nums">
                {stats.booksCompleted}
              </div>
              <div className="text-sm font-medium text-slate-500 dark:text-[#A0A0A0]">Books Completed</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] shadow-sm flex flex-col items-center text-center sm:col-span-2 md:col-span-1 plan-card transition-colors"
            >
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
                <Target className="w-6 h-6" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-[#EDEDED] mb-1 tabular-nums">
                {stats.quizzesCompleted > 0 ? `${stats.avgScore}%` : '—'}
              </div>
              <div className="text-sm font-medium text-slate-500 dark:text-[#A0A0A0]">
                {stats.quizzesCompleted > 0
                  ? `Avg Quiz (${stats.quizzesCompleted} done)`
                  : 'No Quizzes Yet'}
              </div>
            </motion.div>
          </div>

          {/* Weekly Reading Activity Chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-[#171E24] p-6 rounded-2xl border border-[#E2DDD3] dark:border-[#26313A] shadow-sm plan-card transition-colors"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-display font-bold text-slate-800 dark:text-[#F2EFE9] flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                Learning Activity (Last 7 Days)
              </h3>
              <span className="text-xs font-mono font-medium text-slate-500 dark:text-[#98A4AF] tabular-nums">
                Today: {stats.todayMinutes} mins
              </span>
            </div>

            <div className="h-64 flex items-end justify-between gap-2">
              {weeklyActivity.map((item, idx) => (
                <div key={`${item.day}-${idx}`} className="flex flex-col items-center flex-1 gap-2 h-full">
                  <div className="w-full bg-[#EFECE4] dark:bg-[#1F2830] rounded-t-lg relative group h-full flex items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-700 ${
                        item.mins > 0
                          ? 'bg-brand-600 dark:bg-brand-500'
                          : 'bg-[#E2DDD3] dark:bg-[#2B3742]'
                      }`}
                      style={{ height: `${item.pct}%` }}
                    ></div>
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-[#11161A] text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity border border-white/10 tabular-nums pointer-events-none font-mono">
                      {item.mins} mins
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-[#98A4AF] font-mono font-medium">
                    {item.day}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* AI Tutor Usage */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-[#171E24] p-6 rounded-2xl border border-[#E2DDD3] dark:border-[#26313A] shadow-sm relative overflow-hidden plan-card transition-colors"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 text-slate-900 dark:text-white">
              <Brain className="w-24 h-24" />
            </div>
            <h3 className="text-lg font-display font-bold text-slate-800 dark:text-[#F2EFE9] mb-4 flex items-center gap-2 relative z-10">
              <Sparkles className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              AI Tutor Usage (Free Tier)
            </h3>

            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-3xl font-bold font-mono text-slate-900 dark:text-[#F2EFE9] tabular-nums">
                    {tokenUsage.total.toLocaleString()}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-[#98A4AF] font-medium ml-1 tabular-nums">
                    / {tokenUsage.limit.toLocaleString()} tokens
                  </span>
                </div>
                <div className="text-xs font-mono font-semibold text-brand-700 dark:text-brand-300 tabular-nums">
                  {usagePercent}% utilized
                </div>
              </div>

              <div className="relative h-2.5 w-full bg-[#EFECE4] dark:bg-[#1F2830] rounded-full overflow-hidden">
                <div
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${
                    usagePercent > 90
                      ? 'bg-red-500'
                      : usagePercent > 75
                        ? 'bg-ochre-500'
                        : 'bg-brand-600 dark:bg-brand-500'
                  }`}
                  style={{ width: `${usagePercent}%` }}
                ></div>
              </div>

              <p className="text-sm text-slate-500 dark:text-[#A0A0A0]">
                You&apos;ve had{' '}
                <span className="font-semibold text-slate-700 dark:text-[#EDEDED] tabular-nums">
                  {tokenUsage.count} exchanges
                </span>{' '}
                with Sage AI this month.
              </p>

              {usagePercent > 80 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-sm rounded-xl border border-amber-200 dark:border-amber-800/40">
                  You are approaching your free tier limit. Consider upgrading if you need more tutor access.
                </div>
              )}
            </div>
          </motion.div>

          {/* Live Achievements Summary */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] shadow-sm plan-card transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-[#EDEDED] flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Achievements
              </h3>
              <span className="text-xs font-semibold text-slate-500 dark:text-[#A0A0A0] tabular-nums">
                {earnedBadgeCount}/{ACHIEVEMENT_BADGES.length} unlocked
              </span>
            </div>

            <div className="space-y-4">
              {previewBadges.map(({ badge, unlocked, earnedAt, progress }) => (
                <div key={badge.id} className="flex gap-3 items-start">
                  <div
                    className={`mt-0.5 p-2 rounded-lg border ${
                      unlocked
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-500/30'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200/70 dark:border-white/10 opacity-75'
                    }`}
                  >
                    {getBadgeIcon(badge.iconName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-[#EDEDED] truncate">
                      {badge.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-[#A0A0A0] line-clamp-2">
                      {badge.description}
                    </p>
                  </div>
                  <div className="text-xs font-semibold shrink-0 tabular-nums">
                    {unlocked ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {earnedAt
                          ? new Date(earnedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })
                          : `+${badge.pointsReward} EP`}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-[#8E8E93]">
                        {progress}/{badge.requirementTarget}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.('profile')}
              className="mt-6 w-full py-2.5 px-4 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-[#EDEDED] text-sm font-medium rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>View All Badges on Profile</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
