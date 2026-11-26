import { Book, ViewState } from '../types';
import { safeStorage } from './safeStorage';
import { getStoredAchievements } from './achievementsService';
import {
  getAiChatsStorageKey,
  getGeneratedQuizzesStorageKey,
} from './accountSyncService';
import { extractUserAcademicProfile } from './bookPersonalization';

export const LEARNING_CYCLE_UPDATED_EVENT = 'eduai-learning-cycle-updated';

export type LearningCycleStageId =
  | 'learn'
  | 'understand'
  | 'experiment'
  | 'test'
  | 'improve';

export type StageStatus = 'completed' | 'active' | 'ready';

export interface LearningCycleStageSummary {
  id: LearningCycleStageId;
  stepNumber: string;
  title: string;
  description: string;
  targetView: ViewState;
  actionLabel: string;
  status: StageStatus;
  statusLabel: string;
  metricSummary: string;
  detailLine: string;
  prefillPrompt?: string;
}

export interface QuizWeaknessRecord {
  quizId: string;
  quizTitle: string;
  subject: string;
  score: number;
  missedQuestions: string[];
  recordedAt: string;
}

export interface WeaknessRecommendation {
  id: string;
  subject: string;
  severity: 'priority' | 'focus' | 'mastered';
  statusLabel: string;
  reason: string;
  missedTopics: string[];
  recommendedActionLabel: string;
  recommendedView: ViewState;
  sagePrefillPrompt: string;
  relatedBook?: Book;
}

export interface LearningCycleAnalysis {
  stages: LearningCycleStageSummary[];
  completedStagesCount: number;
  recommendedNextStage: LearningCycleStageSummary;
  weaknesses: WeaknessRecommendation[];
  quizAverage: number | null;
  activeReadingCount: number;
  sageExchangeCount: number;
  eduLabTrialsCount: number;
  completedQuizzesCount: number;
}

function getWeaknessesStorageKey(userId?: string): string {
  return `eduai_quiz_weaknesses_${userId || 'guest'}`;
}

export function getStoredQuizWeaknesses(userId?: string): QuizWeaknessRecord[] {
  const raw = safeStorage.getJSON<QuizWeaknessRecord[]>(
    getWeaknessesStorageKey(userId),
    []
  );
  return Array.isArray(raw) ? raw : [];
}

export function recordQuizWeaknesses(
  userId: string | undefined,
  record: QuizWeaknessRecord
): void {
  const key = getWeaknessesStorageKey(userId);
  const existing = getStoredQuizWeaknesses(userId);
  const filtered = existing.filter((item) => item.quizId !== record.quizId);
  const updated = [record, ...filtered].slice(0, 20);
  safeStorage.setJSON(key, updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LEARNING_CYCLE_UPDATED_EVENT));
  }
}

export function clearSubjectWeaknesses(
  userId: string | undefined,
  subject: string
): void {
  const key = getWeaknessesStorageKey(userId);
  const existing = getStoredQuizWeaknesses(userId);
  const updated = existing.filter(
    (item) => item.subject.toLowerCase() !== subject.toLowerCase()
  );
  safeStorage.setJSON(key, updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LEARNING_CYCLE_UPDATED_EVENT));
  }
}

export function notifyLearningCycleUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LEARNING_CYCLE_UPDATED_EVENT));
  }
}

export function analyzeLearningCycle(params: {
  books: Book[];
  user?: any;
  profile?: any;
}): LearningCycleAnalysis {
  const { books, user, profile } = params;
  const userId = user?.id as string | undefined;
  const userKey = userId || 'guest';

  const academicProfile = extractUserAcademicProfile(profile, user);
  const achievements = getStoredAchievements(userId);

  // 1. LEARN: Books started or completed
  const activeBooks = books.filter(
    (b) => (b.readProgress || 0) > 0 && (b.readProgress || 0) < 100
  );
  const completedBooks = books.filter((b) => (b.readProgress || 0) >= 100);
  const primaryActiveBook = activeBooks[0] || books[0];
  const activeReadingCount = activeBooks.length + completedBooks.length;

  // 2. UNDERSTAND: Sage AI user prompts across stored conversations
  const aiSessions = safeStorage.getJSON<Array<{ messages?: Array<{ role?: string }> }>>(
    getAiChatsStorageKey(userId),
    []
  );
  const sageExchangeCount = Array.isArray(aiSessions)
    ? aiSessions.reduce((acc, sess) => {
        const userMsgs = Array.isArray(sess?.messages)
          ? sess.messages.filter((m) => m?.role === 'user').length
          : 0;
        return acc + userMsgs;
      }, 0)
    : 0;

  // 3. EXPERIMENT: EduLab trials, explored experiments, and practical assessments
  const eduLabTrials = safeStorage.getJSON<any[]>(`edulab_trials_v3_${userKey}`, []);
  const eduLabExplored = safeStorage.getJSON<string[]>(
    `edulab_explored_v1_${userKey}`,
    []
  );
  const eduLabAssessments = safeStorage.getJSON<any[]>(
    `edulab_assessments_v1_${userKey}`,
    []
  );
  const eduLabTrialsCount =
    (Array.isArray(eduLabTrials) ? eduLabTrials.length : 0) +
    (Array.isArray(eduLabExplored) ? eduLabExplored.length : 0);
  const eduLabAssessmentCount = Array.isArray(eduLabAssessments)
    ? eduLabAssessments.length
    : 0;

  // 4. TEST: Quizzes + Practical Assessments
  const storedQuizzes =
    safeStorage.getJSON<
      Array<{
        id: string;
        title: string;
        subject: string;
        score: number | null;
        status: string;
      }>
    >(getGeneratedQuizzesStorageKey(userId), []) || [];

  const completedQuizzesFromStorage = Array.isArray(storedQuizzes)
    ? storedQuizzes.filter((q) => q?.status === 'completed' && typeof q.score === 'number')
    : [];
  const completedQuizzesFromLedger = Object.values(achievements.completedQuizIds || {});

  const completedQuizzesCount = Math.max(
    completedQuizzesFromStorage.length,
    completedQuizzesFromLedger.length
  );

  const allScores: number[] =
    completedQuizzesFromStorage.length > 0
      ? completedQuizzesFromStorage.map((q) => Number(q.score || 0))
      : completedQuizzesFromLedger.map((q) => Number(q.bestScore || 0));

  const quizAverage =
    allScores.length > 0
      ? Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length)
      : null;

  // 5. IMPROVE: Weakness detection & targeted recommendations
  const weaknessRecords = getStoredQuizWeaknesses(userId);
  const weaknesses: WeaknessRecommendation[] = [];
  const seenSubjects = new Set<string>();

  // Priority A: Recorded quiz weaknesses or low quiz scores (< 80%)
  for (const rec of weaknessRecords) {
    const subjKey = rec.subject.toLowerCase();
    if (seenSubjects.has(subjKey)) continue;
    if (rec.score < 85 || rec.missedQuestions.length > 0) {
      seenSubjects.add(subjKey);
      const relatedBook = books.find(
        (b) =>
          b.category.toLowerCase().includes(subjKey) ||
          b.subjects?.some((s) => s.toLowerCase().includes(subjKey))
      );
      const firstMissed = rec.missedQuestions[0];
      weaknesses.push({
        id: `weak-quiz-${rec.quizId}`,
        subject: rec.subject,
        severity: rec.score < 65 ? 'priority' : 'focus',
        statusLabel: rec.score < 65 ? 'Priority Review' : 'Needs Reinforcement',
        reason: `Scored ${rec.score}% on "${rec.quizTitle}"${
          rec.missedQuestions.length > 0
            ? ` with ${rec.missedQuestions.length} concept${
                rec.missedQuestions.length === 1 ? '' : 's'
              } missed.`
            : '.'
        }`,
        missedTopics: rec.missedQuestions.slice(0, 3),
        recommendedActionLabel: 'Review with Sage AI',
        recommendedView: 'ai-tutor',
        sagePrefillPrompt: firstMissed
          ? `I scored ${rec.score}% on ${rec.quizTitle} (${rec.subject}) and struggled with: "${firstMissed}". Please explain the underlying concept step-by-step and give me an example.`
          : `Help me strengthen my weak areas in ${rec.subject} after scoring ${rec.score}% on ${rec.quizTitle}.`,
        relatedBook,
      });
    }
  }

  // Priority B: Completed quizzes in storage/ledger with < 80% score not yet in weaknessRecords
  for (const q of completedQuizzesFromStorage) {
    const subjKey = (q.subject || 'General').toLowerCase();
    if (seenSubjects.has(subjKey)) continue;
    if (typeof q.score === 'number' && q.score < 80) {
      seenSubjects.add(subjKey);
      const relatedBook = books.find(
        (b) =>
          b.category.toLowerCase().includes(subjKey) ||
          b.subjects?.some((s) => s.toLowerCase().includes(subjKey))
      );
      weaknesses.push({
        id: `weak-score-${q.id}`,
        subject: q.subject,
        severity: q.score < 60 ? 'priority' : 'focus',
        statusLabel: q.score < 60 ? 'Priority Review' : 'Needs Reinforcement',
        reason: `Recent quiz "${q.title}" finished at ${q.score}%. Revisit core principles and test again.`,
        missedTopics: [],
        recommendedActionLabel: 'Ask Sage AI to Clarify',
        recommendedView: 'ai-tutor',
        sagePrefillPrompt: `I want to improve my mastery in ${q.subject} after scoring ${q.score}% on ${q.title}. Walk me through the key principles and a worked example.`,
        relatedBook,
      });
    }
  }

  // Priority C: Configured curriculum subjects with low or zero reading progress
  for (const subj of academicProfile.subjects) {
    const subjKey = subj.trim().toLowerCase();
    if (!subjKey || seenSubjects.has(subjKey)) continue;
    const matchingBooks = books.filter(
      (b) =>
        b.category.toLowerCase().includes(subjKey) ||
        b.subjects?.some((s) => s.toLowerCase().includes(subjKey))
    );
    const maxProg = matchingBooks.reduce(
      (m, b) => Math.max(m, b.readProgress || 0),
      0
    );
    if (matchingBooks.length > 0 && maxProg < 25) {
      seenSubjects.add(subjKey);
      weaknesses.push({
        id: `weak-reading-${subjKey}`,
        subject: subj,
        severity: 'focus',
        statusLabel: maxProg === 0 ? 'Not Started' : 'Early Foundation',
        reason:
          maxProg === 0
            ? `You haven't opened a ${subj} textbook yet. Starting core chapters unlocks quizzes and targeted insights.`
            : `${subj} reading progress is at ${maxProg}%. Finish the introductory chapters before testing.`,
        missedTopics: [],
        recommendedActionLabel: 'Open Textbook',
        recommendedView: 'library',
        sagePrefillPrompt: `Give me an introductory roadmap and key concepts to focus on before I begin studying ${subj}.`,
        relatedBook: matchingBooks[0],
      });
    }
  }

  const focusSubject =
    weaknesses[0]?.subject ||
    academicProfile.subjects[0] ||
    primaryActiveBook?.subjects?.[0] ||
    primaryActiveBook?.category ||
    'your current subject';

  // Determine status of each of the 5 stages
  const learnDone = activeReadingCount > 0;
  const understandDone = sageExchangeCount > 0;
  const experimentDone = eduLabTrialsCount > 0 || eduLabAssessmentCount > 0;
  const testDone = completedQuizzesCount > 0 || eduLabAssessmentCount > 0;
  const improveDone =
    testDone &&
    weaknesses.filter((w) => w.severity === 'priority').length === 0;

  const firstIncompleteKey: LearningCycleStageId = !learnDone
    ? 'learn'
    : !understandDone
    ? 'understand'
    : !experimentDone
    ? 'experiment'
    : !testDone
    ? 'test'
    : 'improve';

  const stages: LearningCycleStageSummary[] = [
    {
      id: 'learn',
      stepNumber: '01',
      title: 'Learn',
      description: 'Read textbooks and learning materials',
      targetView: 'library',
      actionLabel: activeBooks.length > 0 ? 'Continue Reading' : 'Open Library',
      status: learnDone
        ? 'completed'
        : firstIncompleteKey === 'learn'
        ? 'active'
        : 'ready',
      statusLabel: learnDone
        ? `${activeReadingCount} Active`
        : 'Start Reading',
      metricSummary:
        completedBooks.length > 0
          ? `${completedBooks.length} finished · ${activeBooks.length} in progress`
          : activeBooks.length > 0
          ? `${activeBooks.length} in progress`
          : `${books.length} textbooks ready`,
      detailLine: primaryActiveBook
        ? `Current: ${primaryActiveBook.title}`
        : 'Browse curriculum textbooks',
    },
    {
      id: 'understand',
      stepNumber: '02',
      title: 'Understand',
      description: 'Ask Sage AI for explanations and examples',
      targetView: 'ai-tutor',
      actionLabel: 'Ask Sage AI',
      status: understandDone
        ? 'completed'
        : firstIncompleteKey === 'understand'
        ? 'active'
        : 'ready',
      statusLabel: understandDone
        ? `${sageExchangeCount} Questions`
        : firstIncompleteKey === 'understand'
        ? 'Next Step'
        : 'Ready',
      metricSummary:
        sageExchangeCount > 0
          ? `${sageExchangeCount} tutor exchange${sageExchangeCount === 1 ? '' : 's'}`
          : 'Socratic Q&A & examples',
      detailLine: primaryActiveBook
        ? `Clarify concepts in ${focusSubject}`
        : 'Step-by-step guided tutor',
      prefillPrompt: primaryActiveBook
        ? `Explain the core concepts and give a worked example from "${primaryActiveBook.title}" (${focusSubject}).`
        : `Give me a clear explanation with worked examples for key topics in ${focusSubject}.`,
    },
    {
      id: 'experiment',
      stepNumber: '03',
      title: 'Experiment',
      description: 'Explore concepts through EduLab',
      targetView: 'edulab',
      actionLabel: 'Launch EduLab',
      status: experimentDone
        ? 'completed'
        : firstIncompleteKey === 'experiment'
        ? 'active'
        : 'ready',
      statusLabel: experimentDone
        ? `${eduLabTrialsCount} Explored`
        : firstIncompleteKey === 'experiment'
        ? 'Next Step'
        : 'Ready',
      metricSummary:
        eduLabTrialsCount > 0
          ? `${eduLabTrialsCount} lab trial${eduLabTrialsCount === 1 ? '' : 's'} logged`
          : 'Interactive apparatus',
      detailLine: 'Physics, Chemistry & Biology simulations',
    },
    {
      id: 'test',
      stepNumber: '04',
      title: 'Test',
      description: 'Complete quizzes and practical assessments',
      targetView: 'quizzes',
      actionLabel: 'Take Assessment',
      status: testDone
        ? 'completed'
        : firstIncompleteKey === 'test'
        ? 'active'
        : 'ready',
      statusLabel: testDone
        ? `${completedQuizzesCount} Completed`
        : firstIncompleteKey === 'test'
        ? 'Next Step'
        : 'Ready',
      metricSummary:
        quizAverage !== null
          ? `Avg score ${quizAverage}% · ${completedQuizzesCount} quiz${
              completedQuizzesCount === 1 ? '' : 'zes'
            }`
          : 'Adaptive diagnostics',
      detailLine: `Test mastery in ${focusSubject}`,
    },
    {
      id: 'improve',
      stepNumber: '05',
      title: 'Improve',
      description: 'Track weaknesses and receive targeted learning recommendations',
      targetView: 'progress',
      actionLabel: 'View Weaknesses',
      status: improveDone
        ? 'completed'
        : firstIncompleteKey === 'improve'
        ? 'active'
        : 'ready',
      statusLabel:
        weaknesses.length > 0
          ? `${weaknesses.length} Focus Area${weaknesses.length === 1 ? '' : 's'}`
          : improveDone
          ? 'On Track'
          : 'Diagnostics',
      metricSummary:
        weaknesses.length > 0
          ? `Focus: ${weaknesses[0].subject}`
          : 'Targeted study guidance',
      detailLine:
        weaknesses.length > 0
          ? weaknesses[0].statusLabel
          : 'Keep cycling to sharpen mastery',
    },
  ];

  const completedStagesCount = stages.filter((s) => s.status === 'completed').length;
  const recommendedNextStage =
    stages.find((s) => s.status === 'active') ||
    (weaknesses.length > 0 ? stages[4] : stages[0]);

  return {
    stages,
    completedStagesCount,
    recommendedNextStage,
    weaknesses,
    quizAverage,
    activeReadingCount,
    sageExchangeCount,
    eduLabTrialsCount,
    completedQuizzesCount,
  };
}
