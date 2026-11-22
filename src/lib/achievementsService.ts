import { safeStorage } from './safeStorage';
import { Book } from '../types';

export const ACHIEVEMENTS_UPDATED_EVENT = 'edu-achievements-updated';
export const EDU_POINTS_AWARDED_EVENT = 'edu-points-awarded';

export type AchievementCategory = 'books' | 'quizzes' | 'learning-path' | 'mastery';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface AchievementBadgeDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: BadgeTier;
  pointsReward: number;
  iconName:
    | 'book-open'
    | 'library'
    | 'crown'
    | 'check-circle'
    | 'target'
    | 'trophy'
    | 'flame'
    | 'compass'
    | 'map'
    | 'award'
    | 'star'
    | 'sparkles';
  requirementTarget: number;
  requirementUnit: string;
  evaluateProgress: (state: UserAchievementState) => number;
}

export interface EarnedBadgeRecord {
  badgeId: string;
  unlockedAt: string;
  pointsAwarded: number;
}

export interface CompletedQuizRecord {
  quizId: string;
  title: string;
  subject: string;
  bestScore: number;
  completedAt: string;
}

export interface PointsLedgerEntry {
  id: string;
  source: 'book' | 'quiz' | 'learning-path' | 'badge';
  refId: string;
  label: string;
  points: number;
  earnedAt: string;
}

export interface UserAchievementState {
  totalEduPoints: number;
  earnedBadges: Record<string, EarnedBadgeRecord>;
  completedBookIds: string[];
  completedQuizIds: Record<string, CompletedQuizRecord>;
  completedPathSteps: string[];
  completedPathIds: string[];
  pointsLedger: PointsLedgerEntry[];
  updatedAt: string;
}

export interface EduPointsAwardResult {
  pointsGained: number;
  totalEduPoints: number;
  newlyUnlockedBadges: AchievementBadgeDefinition[];
  ledgerEntriesAdded: PointsLedgerEntry[];
  state: UserAchievementState;
}

export interface ScholarRankInfo {
  title: string;
  minPoints: number;
  nextRankTitle: string | null;
  nextRankPoints: number | null;
  progressPercent: number;
}

export const EDU_POINT_VALUES = {
  BOOK_COMPLETED: 100,
  QUIZ_COMPLETED: 50,
  QUIZ_HIGH_SCORE_BONUS: 25, // >= 80%
  QUIZ_PERFECT_ACE_BONUS: 15, // 100% (cumulative +40 bonus -> 90 EP total)
  PATH_MILESTONE_COMPLETED: 40,
  PATH_FULL_COMPLETED: 150,
} as const;

export const SCHOLAR_RANKS: Array<{ title: string; minPoints: number }> = [
  { title: 'Curious Initiate', minPoints: 0 },
  { title: 'Dedicated Scholar', minPoints: 200 },
  { title: 'Curriculum Voyager', minPoints: 500 },
  { title: "Dean's List Fellow", minPoints: 1000 },
  { title: 'Grand Polymath', minPoints: 2000 },
];

export const ACHIEVEMENT_BADGES: AchievementBadgeDefinition[] = [
  {
    id: 'first_chapter_hero',
    title: 'First Page Finisher',
    description: 'Complete your very first book or textbook from cover to cover.',
    category: 'books',
    tier: 'bronze',
    pointsReward: 50,
    iconName: 'book-open',
    requirementTarget: 1,
    requirementUnit: 'book',
    evaluateProgress: (s) => s.completedBookIds.length,
  },
  {
    id: 'bookworm_scholar',
    title: 'Avid Bookworm',
    description: 'Reach 100% completion on 3 curriculum books.',
    category: 'books',
    tier: 'silver',
    pointsReward: 100,
    iconName: 'library',
    requirementTarget: 3,
    requirementUnit: 'books',
    evaluateProgress: (s) => s.completedBookIds.length,
  },
  {
    id: 'grand_librarian',
    title: 'Curriculum Librarian',
    description: 'Complete 5 full books in your digital library.',
    category: 'books',
    tier: 'gold',
    pointsReward: 200,
    iconName: 'crown',
    requirementTarget: 5,
    requirementUnit: 'books',
    evaluateProgress: (s) => s.completedBookIds.length,
  },
  {
    id: 'quiz_challenger',
    title: 'First Quiz Cleared',
    description: 'Finish your first adaptive practice quiz.',
    category: 'quizzes',
    tier: 'bronze',
    pointsReward: 50,
    iconName: 'check-circle',
    requirementTarget: 1,
    requirementUnit: 'quiz',
    evaluateProgress: (s) => Object.keys(s.completedQuizIds).length,
  },
  {
    id: 'quiz_sharpshooter',
    title: 'Quiz Sharpshooter',
    description: 'Score 80% or higher on any practice quiz.',
    category: 'quizzes',
    tier: 'silver',
    pointsReward: 75,
    iconName: 'target',
    requirementTarget: 1,
    requirementUnit: '80%+ quiz',
    evaluateProgress: (s) =>
      Object.values(s.completedQuizIds).filter((q) => q.bestScore >= 80).length,
  },
  {
    id: 'quiz_ace',
    title: 'Perfect Score Ace',
    description: 'Achieve a flawless 100% score on a practice quiz.',
    category: 'quizzes',
    tier: 'gold',
    pointsReward: 125,
    iconName: 'trophy',
    requirementTarget: 1,
    requirementUnit: '100% quiz',
    evaluateProgress: (s) =>
      Object.values(s.completedQuizIds).filter((q) => q.bestScore >= 100).length,
  },
  {
    id: 'quiz_veteran',
    title: 'Assessment Veteran',
    description: 'Complete 5 practice quizzes across your study subjects.',
    category: 'quizzes',
    tier: 'gold',
    pointsReward: 150,
    iconName: 'flame',
    requirementTarget: 5,
    requirementUnit: 'quizzes',
    evaluateProgress: (s) => Object.keys(s.completedQuizIds).length,
  },
  {
    id: 'pathfinder',
    title: 'Pathfinder',
    description: 'Complete your first Learning Path milestone.',
    category: 'learning-path',
    tier: 'bronze',
    pointsReward: 50,
    iconName: 'compass',
    requirementTarget: 1,
    requirementUnit: 'milestone',
    evaluateProgress: (s) => s.completedPathSteps.length,
  },
  {
    id: 'roadmap_finisher',
    title: 'Roadmap Champion',
    description: 'Complete an entire personalized Learning Path from start to finish.',
    category: 'learning-path',
    tier: 'gold',
    pointsReward: 150,
    iconName: 'map',
    requirementTarget: 1,
    requirementUnit: 'path',
    evaluateProgress: (s) => s.completedPathIds.length,
  },
  {
    id: 'polymath_learner',
    title: 'All-Round Scholar',
    description: 'Complete at least 1 book, 1 quiz, and 1 full Learning Path.',
    category: 'mastery',
    tier: 'platinum',
    pointsReward: 200,
    iconName: 'award',
    requirementTarget: 3,
    requirementUnit: 'pillars',
    evaluateProgress: (s) =>
      (s.completedBookIds.length > 0 ? 1 : 0) +
      (Object.keys(s.completedQuizIds).length > 0 ? 1 : 0) +
      (s.completedPathIds.length > 0 ? 1 : 0),
  },
  {
    id: 'point_collector_500',
    title: '500 Edu Points Club',
    description: 'Accumulate 500 Edu Points across readings, quizzes, and paths.',
    category: 'mastery',
    tier: 'silver',
    pointsReward: 50,
    iconName: 'star',
    requirementTarget: 500,
    requirementUnit: 'EP',
    evaluateProgress: (s) => Math.min(500, s.totalEduPoints),
  },
  {
    id: 'point_legend_1000',
    title: 'Grand Academician',
    description: 'Accumulate 1,000 Edu Points to join the elite scholarship tier.',
    category: 'mastery',
    tier: 'platinum',
    pointsReward: 100,
    iconName: 'sparkles',
    requirementTarget: 1000,
    requirementUnit: 'EP',
    evaluateProgress: (s) => Math.min(1000, s.totalEduPoints),
  },
];

export function createEmptyAchievementState(): UserAchievementState {
  return {
    totalEduPoints: 0,
    earnedBadges: {},
    completedBookIds: [],
    completedQuizIds: {},
    completedPathSteps: [],
    completedPathIds: [],
    pointsLedger: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function getAchievementsStorageKey(userId?: string): string {
  return `edu_achievements_${userId || 'guest'}`;
}

function recalculateTotalPoints(ledger: PointsLedgerEntry[]): number {
  return ledger.reduce((sum, entry) => sum + (Number(entry.points) || 0), 0);
}

function dedupeAndSortLedger(entries: PointsLedgerEntry[]): PointsLedgerEntry[] {
  const byId = new Map<string, PointsLedgerEntry>();
  for (const item of entries) {
    if (!item?.id) continue;
    const prev = byId.get(item.id);
    if (!prev) {
      byId.set(item.id, item);
    } else {
      const prevTime = Date.parse(prev.earnedAt) || 0;
      const nextTime = Date.parse(item.earnedAt) || 0;
      byId.set(item.id, nextTime <= prevTime ? prev : item);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => (Date.parse(b.earnedAt) || 0) - (Date.parse(a.earnedAt) || 0)
  );
}

export function mergeAchievementStates(
  a?: Partial<UserAchievementState> | null,
  b?: Partial<UserAchievementState> | null
): UserAchievementState {
  const safeA = a || {};
  const safeB = b || {};

  const completedBookIds = Array.from(
    new Set([...(safeA.completedBookIds || []), ...(safeB.completedBookIds || [])].filter(Boolean))
  );

  const completedPathSteps = Array.from(
    new Set([...(safeA.completedPathSteps || []), ...(safeB.completedPathSteps || [])].filter(Boolean))
  );

  const completedPathIds = Array.from(
    new Set([...(safeA.completedPathIds || []), ...(safeB.completedPathIds || [])].filter(Boolean))
  );

  const completedQuizIds: Record<string, CompletedQuizRecord> = {};
  for (const src of [safeA.completedQuizIds, safeB.completedQuizIds]) {
    if (!src || typeof src !== 'object') continue;
    for (const [qId, rec] of Object.entries(src)) {
      if (!qId || !rec) continue;
      const prev = completedQuizIds[qId];
      if (!prev || rec.bestScore > prev.bestScore) {
        completedQuizIds[qId] = {
          ...prev,
          ...rec,
          bestScore: Math.max(prev?.bestScore || 0, rec.bestScore || 0),
        };
      }
    }
  }

  const earnedBadges: Record<string, EarnedBadgeRecord> = {};
  for (const src of [safeA.earnedBadges, safeB.earnedBadges]) {
    if (!src || typeof src !== 'object') continue;
    for (const [bId, rec] of Object.entries(src)) {
      if (!bId || !rec) continue;
      const prev = earnedBadges[bId];
      if (!prev) {
        earnedBadges[bId] = rec;
      } else {
        const prevTs = Date.parse(prev.unlockedAt) || 0;
        const nextTs = Date.parse(rec.unlockedAt) || 0;
        earnedBadges[bId] = nextTs < prevTs ? rec : prev;
      }
    }
  }

  const pointsLedger = dedupeAndSortLedger([
    ...(safeA.pointsLedger || []),
    ...(safeB.pointsLedger || []),
  ]);

  const tsA = safeA.updatedAt ? Date.parse(safeA.updatedAt) || 0 : 0;
  const tsB = safeB.updatedAt ? Date.parse(safeB.updatedAt) || 0 : 0;
  const latestUpdatedAt =
    tsB >= tsA
      ? safeB.updatedAt || safeA.updatedAt || new Date().toISOString()
      : safeA.updatedAt || new Date().toISOString();

  return {
    totalEduPoints: recalculateTotalPoints(pointsLedger),
    earnedBadges,
    completedBookIds,
    completedQuizIds,
    completedPathSteps,
    completedPathIds,
    pointsLedger,
    updatedAt: latestUpdatedAt,
  };
}

export function getStoredAchievements(userId?: string): UserAchievementState {
  const raw = safeStorage.getJSON<UserAchievementState | null>(
    getAchievementsStorageKey(userId),
    null
  );
  if (!raw || typeof raw !== 'object') {
    return createEmptyAchievementState();
  }
  return mergeAchievementStates(createEmptyAchievementState(), raw);
}

export function getScholarRank(points: number): ScholarRankInfo {
  let currentIdx = 0;
  for (let i = 0; i < SCHOLAR_RANKS.length; i++) {
    if (points >= SCHOLAR_RANKS[i].minPoints) {
      currentIdx = i;
    }
  }
  const current = SCHOLAR_RANKS[currentIdx];
  const next = SCHOLAR_RANKS[currentIdx + 1] || null;
  if (!next) {
    return {
      title: current.title,
      minPoints: current.minPoints,
      nextRankTitle: null,
      nextRankPoints: null,
      progressPercent: 100,
    };
  }
  const span = Math.max(1, next.minPoints - current.minPoints);
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((points - current.minPoints) / span) * 100))
  );
  return {
    title: current.title,
    minPoints: current.minPoints,
    nextRankTitle: next.title,
    nextRankPoints: next.minPoints,
    progressPercent,
  };
}

function evaluateAndUnlockBadges(
  draftState: UserAchievementState,
  nowIso: string
): {
  nextState: UserAchievementState;
  newlyUnlockedBadges: AchievementBadgeDefinition[];
  badgeLedgerEntries: PointsLedgerEntry[];
} {
  const newlyUnlockedBadges: AchievementBadgeDefinition[] = [];
  const badgeLedgerEntries: PointsLedgerEntry[] = [];
  let working = {
    ...draftState,
    earnedBadges: { ...draftState.earnedBadges },
    pointsLedger: [...draftState.pointsLedger],
  };

  // Run up to 2 passes in case unlocking earlier badges crosses the 500/1000 EP badge threshold
  for (let pass = 0; pass < 2; pass++) {
    let unlockedInPass = false;
    working.totalEduPoints = recalculateTotalPoints(working.pointsLedger);

    for (const badge of ACHIEVEMENT_BADGES) {
      if (working.earnedBadges[badge.id]) continue;
      const progress = badge.evaluateProgress(working);
      if (progress >= badge.requirementTarget) {
        unlockedInPass = true;
        working.earnedBadges[badge.id] = {
          badgeId: badge.id,
          unlockedAt: nowIso,
          pointsAwarded: badge.pointsReward,
        };
        const badgeEntry: PointsLedgerEntry = {
          id: `badge:${badge.id}`,
          source: 'badge',
          refId: badge.id,
          label: `Unlocked badge: ${badge.title}`,
          points: badge.pointsReward,
          earnedAt: nowIso,
        };
        working.pointsLedger = dedupeAndSortLedger([badgeEntry, ...working.pointsLedger]);
        newlyUnlockedBadges.push(badge);
        badgeLedgerEntries.push(badgeEntry);
      }
    }

    if (!unlockedInPass) break;
  }

  working.totalEduPoints = recalculateTotalPoints(working.pointsLedger);
  working.updatedAt = nowIso;

  return {
    nextState: working,
    newlyUnlockedBadges,
    badgeLedgerEntries,
  };
}

function commitAchievementUpdate(
  userId: string | undefined,
  previousState: UserAchievementState,
  mutator: (draft: UserAchievementState, nowIso: string) => {
    draft: UserAchievementState;
    addedEntries: PointsLedgerEntry[];
    summaryReason?: string;
  },
  options?: {
    accessToken?: string;
    silentToast?: boolean;
    skipCloudPush?: boolean;
  }
): EduPointsAwardResult {
  const nowIso = new Date().toISOString();
  const baseClone: UserAchievementState = {
    ...previousState,
    earnedBadges: { ...previousState.earnedBadges },
    completedBookIds: [...previousState.completedBookIds],
    completedQuizIds: { ...previousState.completedQuizIds },
    completedPathSteps: [...previousState.completedPathSteps],
    completedPathIds: [...previousState.completedPathIds],
    pointsLedger: [...previousState.pointsLedger],
  };

  const { draft, addedEntries, summaryReason } = mutator(baseClone, nowIso);
  const existingIds = new Set(previousState.pointsLedger.map((e) => e.id));
  const genuinelyNewEntries = addedEntries.filter((e) => !existingIds.has(e.id));
  draft.pointsLedger = dedupeAndSortLedger([...genuinelyNewEntries, ...draft.pointsLedger]);
  draft.totalEduPoints = recalculateTotalPoints(draft.pointsLedger);

  const { nextState, newlyUnlockedBadges, badgeLedgerEntries } = evaluateAndUnlockBadges(
    draft,
    nowIso
  );

  const allAdded = [...genuinelyNewEntries, ...badgeLedgerEntries];
  const pointsGained = Math.max(0, nextState.totalEduPoints - previousState.totalEduPoints);
  const didStateChange =
    pointsGained > 0 ||
    newlyUnlockedBadges.length > 0 ||
    nextState.completedBookIds.length !== previousState.completedBookIds.length ||
    Object.keys(nextState.completedQuizIds).length !==
      Object.keys(previousState.completedQuizIds).length ||
    nextState.completedPathSteps.length !== previousState.completedPathSteps.length ||
    nextState.completedPathIds.length !== previousState.completedPathIds.length;

  if (didStateChange) {
    safeStorage.setJSON(getAchievementsStorageKey(userId), nextState);

    if (userId && userId !== 'guest' && !options?.skipCloudPush) {
      void import('./accountSyncService').then(({ pushAccountSyncPatch }) => {
        pushAccountSyncPatch(
          userId,
          { achievements: nextState },
          options?.accessToken,
          { immediate: true }
        );
      });
    }

    if (typeof window !== 'undefined') {
      const dispatchEvents = () => {
        window.dispatchEvent(
          new CustomEvent(ACHIEVEMENTS_UPDATED_EVENT, {
            detail: { userId, state: nextState },
          })
        );

        if (!options?.silentToast && (pointsGained > 0 || newlyUnlockedBadges.length > 0)) {
          window.dispatchEvent(
            new CustomEvent(EDU_POINTS_AWARDED_EVENT, {
              detail: {
                userId,
                pointsGained,
                totalEduPoints: nextState.totalEduPoints,
                newlyUnlockedBadges,
                reason: summaryReason || allAdded[0]?.label || 'Achievement progress updated',
              },
            })
          );
        }
      };

      if (typeof queueMicrotask === 'function') {
        queueMicrotask(dispatchEvents);
      } else {
        setTimeout(dispatchEvents, 0);
      }
    }
  }

  return {
    pointsGained,
    totalEduPoints: nextState.totalEduPoints,
    newlyUnlockedBadges,
    ledgerEntriesAdded: allAdded,
    state: nextState,
  };
}

export function recordBookCompleted(
  userId: string | undefined,
  book: Pick<Book, 'id' | 'title'>,
  options?: { accessToken?: string; silentToast?: boolean }
): EduPointsAwardResult {
  const prev = getStoredAchievements(userId);
  return commitAchievementUpdate(
    userId,
    prev,
    (draft, nowIso) => {
      const addedEntries: PointsLedgerEntry[] = [];
      if (book?.id && !draft.completedBookIds.includes(book.id)) {
        draft.completedBookIds.push(book.id);
        addedEntries.push({
          id: `book:${book.id}`,
          source: 'book',
          refId: book.id,
          label: `Completed book: ${book.title || 'Curriculum Textbook'}`,
          points: EDU_POINT_VALUES.BOOK_COMPLETED,
          earnedAt: nowIso,
        });
      }
      return {
        draft,
        addedEntries,
        summaryReason: `Finished "${book.title || 'Book'}"`,
      };
    },
    options
  );
}

export function recordQuizCompleted(
  userId: string | undefined,
  quiz: { id: string; title: string; subject: string; score: number },
  options?: { accessToken?: string; silentToast?: boolean }
): EduPointsAwardResult {
  const prev = getStoredAchievements(userId);
  const boundedScore = Math.max(0, Math.min(100, Math.round(quiz.score)));

  return commitAchievementUpdate(
    userId,
    prev,
    (draft, nowIso) => {
      const addedEntries: PointsLedgerEntry[] = [];
      const existing = draft.completedQuizIds[quiz.id];
      const bestScore = Math.max(existing?.bestScore || 0, boundedScore);

      draft.completedQuizIds[quiz.id] = {
        quizId: quiz.id,
        title: quiz.title,
        subject: quiz.subject,
        bestScore,
        completedAt: existing?.completedAt || nowIso,
      };

      addedEntries.push({
        id: `quiz_complete:${quiz.id}`,
        source: 'quiz',
        refId: quiz.id,
        label: `Completed quiz: ${quiz.title}`,
        points: EDU_POINT_VALUES.QUIZ_COMPLETED,
        earnedAt: nowIso,
      });

      if (bestScore >= 80) {
        addedEntries.push({
          id: `quiz_high:${quiz.id}`,
          source: 'quiz',
          refId: quiz.id,
          label: `High score bonus (80%+): ${quiz.title}`,
          points: EDU_POINT_VALUES.QUIZ_HIGH_SCORE_BONUS,
          earnedAt: nowIso,
        });
      }

      if (bestScore >= 100) {
        addedEntries.push({
          id: `quiz_ace:${quiz.id}`,
          source: 'quiz',
          refId: quiz.id,
          label: `Perfect 100% ace bonus: ${quiz.title}`,
          points: EDU_POINT_VALUES.QUIZ_PERFECT_ACE_BONUS,
          earnedAt: nowIso,
        });
      }

      return {
        draft,
        addedEntries,
        summaryReason: `Completed "${quiz.title}" (${boundedScore}%)`,
      };
    },
    options
  );
}

export function recordLearningPathMilestoneCompleted(
  userId: string | undefined,
  params: {
    pathId: string;
    stepId: string;
    stepTitle: string;
    allStepsCompleted: boolean;
    pathTitle?: string;
  },
  options?: { accessToken?: string; silentToast?: boolean }
): EduPointsAwardResult {
  const prev = getStoredAchievements(userId);
  return commitAchievementUpdate(
    userId,
    prev,
    (draft, nowIso) => {
      const addedEntries: PointsLedgerEntry[] = [];
      const scopedStepId = `${params.pathId}:${params.stepId}`;

      if (!draft.completedPathSteps.includes(scopedStepId)) {
        draft.completedPathSteps.push(scopedStepId);
        addedEntries.push({
          id: `path_step:${scopedStepId}`,
          source: 'learning-path',
          refId: scopedStepId,
          label: `Completed milestone: ${params.stepTitle}`,
          points: EDU_POINT_VALUES.PATH_MILESTONE_COMPLETED,
          earnedAt: nowIso,
        });
      }

      if (params.allStepsCompleted && !draft.completedPathIds.includes(params.pathId)) {
        draft.completedPathIds.push(params.pathId);
        addedEntries.push({
          id: `path_complete:${params.pathId}`,
          source: 'learning-path',
          refId: params.pathId,
          label: `Completed full Learning Path${params.pathTitle ? `: ${params.pathTitle}` : ''}`,
          points: EDU_POINT_VALUES.PATH_FULL_COMPLETED,
          earnedAt: nowIso,
        });
      }

      return {
        draft,
        addedEntries,
        summaryReason: params.allStepsCompleted
          ? 'Completed entire Learning Path!'
          : `Cleared milestone: ${params.stepTitle}`,
      };
    },
    options
  );
}

export function reconcileAchievementsSnapshot(
  userId: string | undefined,
  params: {
    books?: Book[];
    completedQuizzes?: Array<{ id: string; title: string; subject: string; score: number }>;
    completedPathSteps?: Array<{ pathId: string; stepId: string; stepTitle: string }>;
    completedPaths?: Array<{ pathId: string; pathTitle?: string }>;
  },
  options?: { accessToken?: string; silentToast?: boolean }
): UserAchievementState {
  const prev = getStoredAchievements(userId);
  const res = commitAchievementUpdate(
    userId,
    prev,
    (draft, nowIso) => {
      const addedEntries: PointsLedgerEntry[] = [];

      for (const b of params.books || []) {
        if (b?.id && (b.readProgress || 0) >= 100 && !draft.completedBookIds.includes(b.id)) {
          draft.completedBookIds.push(b.id);
          addedEntries.push({
            id: `book:${b.id}`,
            source: 'book',
            refId: b.id,
            label: `Completed book: ${b.title || 'Curriculum Textbook'}`,
            points: EDU_POINT_VALUES.BOOK_COMPLETED,
            earnedAt: nowIso,
          });
        }
      }

      for (const q of params.completedQuizzes || []) {
        if (!q?.id) continue;
        const score = Math.max(0, Math.min(100, Math.round(q.score)));
        const existing = draft.completedQuizIds[q.id];
        const bestScore = Math.max(existing?.bestScore || 0, score);
        draft.completedQuizIds[q.id] = {
          quizId: q.id,
          title: q.title,
          subject: q.subject,
          bestScore,
          completedAt: existing?.completedAt || nowIso,
        };
        addedEntries.push({
          id: `quiz_complete:${q.id}`,
          source: 'quiz',
          refId: q.id,
          label: `Completed quiz: ${q.title}`,
          points: EDU_POINT_VALUES.QUIZ_COMPLETED,
          earnedAt: nowIso,
        });
        if (bestScore >= 80) {
          addedEntries.push({
            id: `quiz_high:${q.id}`,
            source: 'quiz',
            refId: q.id,
            label: `High score bonus (80%+): ${q.title}`,
            points: EDU_POINT_VALUES.QUIZ_HIGH_SCORE_BONUS,
            earnedAt: nowIso,
          });
        }
        if (bestScore >= 100) {
          addedEntries.push({
            id: `quiz_ace:${q.id}`,
            source: 'quiz',
            refId: q.id,
            label: `Perfect 100% ace bonus: ${q.title}`,
            points: EDU_POINT_VALUES.QUIZ_PERFECT_ACE_BONUS,
            earnedAt: nowIso,
          });
        }
      }

      for (const st of params.completedPathSteps || []) {
        const scopedStepId = `${st.pathId}:${st.stepId}`;
        if (!draft.completedPathSteps.includes(scopedStepId)) {
          draft.completedPathSteps.push(scopedStepId);
          addedEntries.push({
            id: `path_step:${scopedStepId}`,
            source: 'learning-path',
            refId: scopedStepId,
            label: `Completed milestone: ${st.stepTitle}`,
            points: EDU_POINT_VALUES.PATH_MILESTONE_COMPLETED,
            earnedAt: nowIso,
          });
        }
      }

      for (const p of params.completedPaths || []) {
        if (!draft.completedPathIds.includes(p.pathId)) {
          draft.completedPathIds.push(p.pathId);
          addedEntries.push({
            id: `path_complete:${p.pathId}`,
            source: 'learning-path',
            refId: p.pathId,
            label: `Completed full Learning Path${p.pathTitle ? `: ${p.pathTitle}` : ''}`,
            points: EDU_POINT_VALUES.PATH_FULL_COMPLETED,
            earnedAt: nowIso,
          });
        }
      }

      return { draft, addedEntries };
    },
    { ...options, silentToast: options?.silentToast ?? true }
  );
  return res.state;
}
