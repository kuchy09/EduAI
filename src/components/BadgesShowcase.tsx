import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Crown,
  Flame,
  Library as LibraryIcon,
  Lock,
  Map as MapIcon,
  Sparkles,
  Star,
  Target,
  Trophy,
  ArrowUpRight,
} from 'lucide-react';
import {
  ACHIEVEMENT_BADGES,
  AchievementBadgeDefinition,
  AchievementCategory,
  BadgeTier,
  UserAchievementState,
  getScholarRank,
} from '../lib/achievementsService';

interface BadgesShowcaseProps {
  achievements: UserAchievementState;
  onNavigate?: (view: string) => void;
}

type FilterOption = 'all' | 'earned' | AchievementCategory;

function BadgeEmblemIcon({
  iconName,
  className = 'w-5 h-5',
}: {
  iconName: AchievementBadgeDefinition['iconName'];
  className?: string;
}) {
  switch (iconName) {
    case 'book-open':
      return <BookOpen className={className} />;
    case 'library':
      return <LibraryIcon className={className} />;
    case 'crown':
      return <Crown className={className} />;
    case 'check-circle':
      return <CheckCircle2 className={className} />;
    case 'target':
      return <Target className={className} />;
    case 'trophy':
      return <Trophy className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'map':
      return <MapIcon className={className} />;
    case 'star':
      return <Star className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'award':
    default:
      return <Award className={className} />;
  }
}

const TIER_EMBLEM_CLASSES: Record<BadgeTier, { unlocked: string; ring: string; label: string }> = {
  bronze: {
    unlocked: 'bg-amber-100/90 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/60',
    ring: 'border-amber-200/80 dark:border-amber-800/40',
    label: 'Bronze',
  },
  silver: {
    unlocked: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600',
    ring: 'border-slate-300/90 dark:border-slate-700',
    label: 'Silver',
  },
  gold: {
    unlocked: 'bg-yellow-100/90 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700/60',
    ring: 'border-yellow-300/80 dark:border-yellow-700/40',
    label: 'Gold',
  },
  platinum: {
    unlocked: 'bg-indigo-100/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700/60',
    ring: 'border-indigo-300/80 dark:border-indigo-700/45',
    label: 'Platinum',
  },
};

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  books: 'Books',
  quizzes: 'Quizzes',
  'learning-path': 'Learning Path',
  mastery: 'Mastery',
};

const SOURCE_LABELS: Record<'book' | 'quiz' | 'learning-path' | 'badge', string> = {
  book: 'Book Completion',
  quiz: 'Practice Quiz',
  'learning-path': 'Learning Path',
  badge: 'Badge Milestone',
};

export function BadgesShowcase({ achievements, onNavigate }: BadgesShowcaseProps) {
  const [filter, setFilter] = useState<FilterOption>('all');
  const [showFullHistory, setShowFullHistory] = useState(false);

  const rank = useMemo(() => getScholarRank(achievements.totalEduPoints), [achievements.totalEduPoints]);
  const unlockedCount = Object.keys(achievements.earnedBadges).length;

  const filteredBadges = useMemo(() => {
    const items = ACHIEVEMENT_BADGES.filter((b) => {
      const isEarned = Boolean(achievements.earnedBadges[b.id]);
      if (filter === 'earned') return isEarned;
      if (filter === 'all') return true;
      return b.category === filter;
    });

    // Show unlocked badges first inside 'all'
    return items.sort((a, b) => {
      const aEarned = Boolean(achievements.earnedBadges[a.id]) ? 1 : 0;
      const bEarned = Boolean(achievements.earnedBadges[b.id]) ? 1 : 0;
      if (aEarned !== bEarned) return bEarned - aEarned;
      return a.pointsReward - b.pointsReward;
    });
  }, [achievements.earnedBadges, filter]);

  const filterTabs: Array<{ id: FilterOption; label: string }> = [
    { id: 'all', label: `All (${ACHIEVEMENT_BADGES.length})` },
    { id: 'earned', label: `Earned (${unlockedCount})` },
    { id: 'books', label: 'Books' },
    { id: 'quizzes', label: 'Quizzes' },
    { id: 'learning-path', label: 'Learning Path' },
    { id: 'mastery', label: 'Mastery' },
  ];

  const ledgerToShow = showFullHistory
    ? achievements.pointsLedger
    : achievements.pointsLedger.slice(0, 6);

  return (
    <div id="profile-achievements-section" className="space-y-6">
      {/* Scholar Rank & Edu Points Banner */}
      <div className="bg-white dark:bg-[#1a1a1d] p-6 rounded-2xl border border-slate-200 dark:border-[#2e2e32] shadow-sm dark:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.55)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-[#a1a1aa]">
              <span>Scholar Standing</span>
              <span aria-hidden="true">·</span>
              <span className="text-brand-600 dark:text-[#b8a5f0] font-semibold">{rank.title}</span>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-3xl sm:text-4xl font-display font-bold text-slate-900 dark:text-[#ededed] tabular-nums tracking-tight">
                {achievements.totalEduPoints.toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-slate-600 dark:text-[#c4c4c8]">
                Edu Points
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-[#2a2a2f]">
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-[#ededed] tabular-nums">
                {unlockedCount} / {ACHIEVEMENT_BADGES.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-[#a1a1aa]">Badges Earned</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-[#ededed] tabular-nums">
                {achievements.completedBookIds.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-[#a1a1aa]">Books Done</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-[#ededed] tabular-nums">
                {Object.keys(achievements.completedQuizIds).length}
              </div>
              <div className="text-xs text-slate-500 dark:text-[#a1a1aa]">Quizzes Done</div>
            </div>
          </div>
        </div>

        {/* Rank Progress Bar */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#a1a1aa]">
            <span>
              {rank.nextRankTitle
                ? `Next rank: ${rank.nextRankTitle} (${rank.nextRankPoints?.toLocaleString()} EP)`
                : 'Highest Scholar Rank Achieved'}
            </span>
            <span className="font-semibold text-slate-700 dark:text-[#ededed] tabular-nums">
              {rank.progressPercent}%
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-[#26262b] rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 dark:bg-[#8a70d6] rounded-full transition-all duration-500"
              style={{ width: `${rank.progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">
            Earn +100 EP per completed book, +50 to +90 EP per completed quiz, and +40 EP per learning path milestone (+150 EP full path bonus).
          </p>
        </div>
      </div>

      {/* Earned & Available Badges Collection */}
      <div className="bg-white dark:bg-[#1a1a1d] p-6 rounded-2xl border border-slate-200 dark:border-[#2e2e32] shadow-sm dark:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.55)] space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-[#ededed] text-base sm:text-lg">
              Achievement Badges
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#a1a1aa] mt-0.5">
              Permanent academic milestones displayed on your learner profile.
            </p>
          </div>

          {/* Interactive Category Segmented Tabs */}
          <div
            role="tablist"
            aria-label="Filter achievement badges"
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#222226] rounded-xl border border-slate-200/70 dark:border-[#2e2e34] overflow-x-auto max-w-full"
          >
            {filterTabs.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-[#303036] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-[#a1a1aa] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredBadges.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-50 dark:bg-[#222226] border border-dashed border-slate-200 dark:border-[#34343c] text-center space-y-3">
            <Trophy className="w-8 h-8 text-slate-400 dark:text-[#8e8e93] mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-[#ededed]">
                No badges earned in this view yet
              </p>
              <p className="text-xs text-slate-500 dark:text-[#a1a1aa] max-w-md mx-auto">
                Finish reading a textbook, score well on a practice quiz, or clear a learning path milestone to unlock your first badge.
              </p>
            </div>
            {onNavigate && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('library')}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Browse Library
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('quizzes')}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-[#2a2a30] border border-slate-200 dark:border-[#383840] text-slate-700 dark:text-[#ededed] text-xs font-semibold hover:bg-slate-100 dark:hover:bg-[#34343c] transition-colors cursor-pointer"
                >
                  Take a Quiz
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBadges.map((badge) => {
              const earned = achievements.earnedBadges[badge.id];
              const isUnlocked = Boolean(earned);
              const progressVal = badge.evaluateProgress(achievements);
              const pct = Math.min(100, Math.round((progressVal / badge.requirementTarget) * 100));
              const tierStyle = TIER_EMBLEM_CLASSES[badge.tier];

              return (
                <div
                  key={badge.id}
                  className={`p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                    isUnlocked
                      ? `bg-[#fafafe] dark:bg-[#222227] ${tierStyle.ring}`
                      : 'bg-slate-50/60 dark:bg-[#1e1e22] border-slate-200/80 dark:border-[#2a2a30] opacity-85'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                        isUnlocked
                          ? tierStyle.unlocked
                          : 'bg-slate-100 dark:bg-[#28282e] border-slate-200 dark:border-[#34343c] text-slate-400 dark:text-[#7a7a82]'
                      }`}
                    >
                      {isUnlocked ? (
                        <BadgeEmblemIcon iconName={badge.iconName} className="w-5 h-5" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-[#a1a1aa]">
                        <span>{CATEGORY_LABELS[badge.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span>{tierStyle.label}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-brand-600 dark:text-[#b8a5f0] tabular-nums">
                          +{badge.pointsReward} EP
                        </span>
                      </div>
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-[#ededed] leading-snug">
                        {badge.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-[#a1a1aa] leading-relaxed">
                        {badge.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-[#2c2c33]">
                    {isUnlocked ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          Unlocked
                        </span>
                        <span className="text-slate-400 dark:text-[#8e8e93] tabular-nums">
                          {new Date(earned.unlockedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#a1a1aa] tabular-nums">
                          <span>Progress</span>
                          <span>
                            {Math.min(progressVal, badge.requirementTarget)} / {badge.requirementTarget}{' '}
                            {badge.requirementUnit}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200/80 dark:bg-[#2c2c34] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 dark:bg-[#8a70d6] rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edu Points Activity Ledger */}
      <div className="bg-white dark:bg-[#1a1a1d] p-6 rounded-2xl border border-slate-200 dark:border-[#2e2e32] shadow-sm dark:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.55)] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-[#ededed] text-base">
              Edu Points Activity
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">
              Recent rewards earned from completed books, quizzes, and learning paths.
            </p>
          </div>
          {achievements.pointsLedger.length > 6 && (
            <button
              type="button"
              onClick={() => setShowFullHistory((v) => !v)}
              className="text-xs font-semibold text-brand-600 dark:text-[#b8a5f0] hover:underline cursor-pointer whitespace-nowrap"
            >
              {showFullHistory ? 'Show recent' : `View all (${achievements.pointsLedger.length})`}
            </button>
          )}
        </div>

        {ledgerToShow.length === 0 ? (
          <div className="py-6 px-4 rounded-xl bg-slate-50 dark:bg-[#222226] border border-slate-100 dark:border-[#2e2e34] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-600 dark:text-[#a1a1aa]">
              No Edu Points recorded yet. Complete a textbook, practice quiz, or learning path step to start earning points.
            </div>
            {onNavigate && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate('quizzes')}
                  className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <span>Start Quiz</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('learning-path')}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#2a2a30] border border-slate-200 dark:border-[#383840] text-slate-700 dark:text-[#ededed] text-xs font-semibold hover:bg-slate-100 dark:hover:bg-[#34343c] cursor-pointer whitespace-nowrap"
                >
                  Open Roadmap
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#2a2a30]">
            {ledgerToShow.map((entry) => (
              <div key={entry.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-[#ededed] truncate">
                    {entry.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-[#a1a1aa] flex items-center gap-1.5 mt-0.5">
                    <span>{SOURCE_LABELS[entry.source]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {new Date(entry.earnedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                  +{entry.points} EP
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
