import { Map, CheckCircle2, Circle, Sparkles, Loader2, Calendar, Target, Clock, BookOpen, ChevronRight, Layers, Award } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { extractUserAcademicProfile, ACADEMIC_PREFS_EVENT } from '../lib/bookPersonalization';
import { safeStorage } from '../lib/safeStorage';
import { pushAccountSyncPatch, ACCOUNT_SYNC_EVENT } from '../lib/accountSyncService';
import {
  recordLearningPathMilestoneCompleted,
  reconcileAchievementsSnapshot,
} from '../lib/achievementsService';

interface LearningStep {
  id?: string;
  title: string;
  status: 'completed' | 'current' | 'upcoming';
  duration: string;
  description?: string;
  concepts?: string[];
}

interface LearningPathProps {
  user: any;
  profile?: any;
}

export function LearningPath({ user, profile }: LearningPathProps) {
  const [steps, setSteps] = useState<LearningStep[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [planMode, setPlanMode] = useState<'roadmap' | 'weekly'>('roadmap');
  const [prefsTick, setPrefsTick] = useState(0);

  useEffect(() => {
    const onPrefsUpdated = () => setPrefsTick((t) => t + 1);
    window.addEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
    return () => window.removeEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
  }, []);

  const academicProfile = useMemo(
    () => extractUserAcademicProfile(profile, user),
    [profile, user, prefsTick]
  );

  const trackLabel = academicProfile.isSchoolLevel
    ? `${academicProfile.country ? `${academicProfile.country} ` : ''}${academicProfile.curriculum || academicProfile.educationLevel}`.trim()
    : academicProfile.fieldOfStudy || academicProfile.educationLevel || 'General Studies';

  const subjectsLabel = academicProfile.subjects.length > 0
    ? academicProfile.subjects.join(', ')
    : 'core syllabus concepts';

  const buildDefaultSteps = useCallback((): LearningStep[] => [
    {
      id: 'step-1',
      title: `Foundations of ${trackLabel}`,
      status: 'completed',
      duration: '2 weeks',
      description: `Core syllabus principles, foundational definitions, and guided reading modules aligned with ${academicProfile.summaryLabel}.`,
      concepts: academicProfile.subjects.slice(0, 3).length > 0
        ? academicProfile.subjects.slice(0, 3)
        : ['Key Terminology', 'Fundamental Laws', 'Core Frameworks']
    },
    {
      id: 'step-2',
      title: `Core Mastery in ${subjectsLabel}`,
      status: 'current',
      duration: '3 weeks',
      description: 'In-depth conceptual breakdowns, worked examples, and curriculum-aligned textbook problem sets.',
      concepts: ['Analytical Frameworks', 'Worked Examples', 'Practical Inquiry']
    },
    {
      id: 'step-3',
      title: `${academicProfile.curriculum || academicProfile.educationLevel || 'Syllabus'} Assessment & Synthesis`,
      status: 'upcoming',
      duration: '4 weeks',
      description: 'Comprehensive evaluations, past-paper style quizzes, and cross-topic mastery synthesis.',
      concepts: ['Exam Readiness', 'Active Recall', 'Review Assessments']
    },
  ], [trackLabel, subjectsLabel, academicProfile.summaryLabel, academicProfile.curriculum, academicProfile.educationLevel, academicProfile.subjects]);

  const storageKey = user?.id ? `edu_learning_path_steps_${user.id}` : 'edu_learning_path_steps_guest';
  const currentPathId = `path_${trackLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

  useEffect(() => {
    const saved = safeStorage.getJSON<LearningStep[]>(storageKey, []);
    if (Array.isArray(saved) && saved.length > 0) {
      setSteps(saved);
    } else {
      const defaults = buildDefaultSteps();
      setSteps(defaults);
      if (user?.id) {
        reconcileAchievementsSnapshot(
          user.id,
          {
            completedPathSteps: defaults
              .filter((s) => s.status === 'completed')
              .map((s, idx) => ({
                pathId: currentPathId,
                stepId: s.id || `step-${idx + 1}`,
                stepTitle: s.title,
              })),
          },
          { silentToast: true }
        );
      }
    }
  }, [storageKey, buildDefaultSteps, user?.id, currentPathId]);

  useEffect(() => {
    const onAccountSync = (e: any) => {
      if (e?.detail?.userId && user?.id && e.detail.userId !== user.id) return;
      const synced = e?.detail?.sync?.learningPathSteps;
      if (Array.isArray(synced) && synced.length > 0) {
        setSteps(synced);
      }
    };
    window.addEventListener(ACCOUNT_SYNC_EVENT, onAccountSync);
    return () => window.removeEventListener(ACCOUNT_SYNC_EVENT, onAccountSync);
  }, [user?.id]);

  const persistSteps = useCallback((nextSteps: LearningStep[]) => {
    setSteps(nextSteps);
    safeStorage.setJSON(storageKey, nextSteps);
    if (user?.id) {
      pushAccountSyncPatch(user.id, { learningPathSteps: nextSteps }, undefined, { immediate: true });
    }
  }, [storageKey, user?.id]);

  const handleCompleteMilestone = useCallback((targetIdx: number) => {
    const updated: LearningStep[] = steps.map((step, i) =>
      i === targetIdx ? { ...step, status: 'completed' } : step
    );
    // Promote first remaining upcoming step to 'current' if none are current
    if (!updated.some(s => s.status === 'current')) {
      const nextUpcomingIdx = updated.findIndex(s => s.status === 'upcoming');
      if (nextUpcomingIdx !== -1) {
        updated[nextUpcomingIdx] = { ...updated[nextUpcomingIdx], status: 'current' };
      }
    }

    setSteps(updated);
    safeStorage.setJSON(storageKey, updated);
    if (user?.id) {
      pushAccountSyncPatch(user.id, { learningPathSteps: updated }, undefined, { immediate: true });
    }

    const targetStep = updated[targetIdx];
    const allCompleted = updated.length > 0 && updated.every(s => s.status === 'completed');
    recordLearningPathMilestoneCompleted(user?.id, {
      pathId: currentPathId,
      stepId: targetStep?.id || `step-${targetIdx + 1}`,
      stepTitle: targetStep?.title || `Milestone ${targetIdx + 1}`,
      allStepsCompleted: allCompleted,
      pathTitle: `${trackLabel} Study Path`,
    });
  }, [steps, storageKey, user?.id, currentPathId, trackLabel]);

  const generatePersonalizedPath = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const allowDataCollection = JSON.parse(localStorage.getItem('privacy_data') ?? 'true');
      
      const requestBody = allowDataCollection 
        ? {
            userStyle: "Visual learner, needs hands-on exercises",
            readingHabits: `Studying ${academicProfile.summaryLabel} with subjects: ${subjectsLabel}`,
            currentProgress: `Finished Foundations of ${trackLabel} recently.`
          }
        : {
             userStyle: "Standard",
             readingHabits: "Standard",
             currentProgress: "Standard"
          };

      const response = await fetch('/api/learning-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate learning path');
      }

      const data = await response.json();
      if (data.steps) {
        const formatted = data.steps.map((s: any, idx: number) => ({
          ...s,
          id: s.id || `gen-step-${Date.now()}-${idx + 1}`,
          description: s.description || 'Structured academic milestone designed for deep comprehension.',
          concepts: s.concepts || ['Target Competency', 'Active Recall', 'Quiz Review']
        }));
        persistSteps(formatted);
      }
    } catch (err: any) {
      setError(err.message || 'Could not generate personalized path. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const completedCount = steps.filter(s => s.status === 'completed').length;
  const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-brand-700 dark:text-brand-400 font-semibold mb-1.5">
            Syllabus Curriculum &amp; Weekly Milestones
          </p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-[#F2EFE9] tracking-tight">
            Study Plan &amp; Roadmap
          </h2>
          <p className="text-slate-500 dark:text-[#98A4AF] text-sm mt-1">
            Structured reading sequence and weekly academic milestones tailored to your study cadence.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            onClick={generatePersonalizedPath}
            disabled={isGenerating}
            className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 font-medium text-xs sm:text-sm transition-all shadow-sm cursor-pointer disabled:opacity-75"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isGenerating ? 'Analyzing...' : 'Regenerate Plan'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm border border-red-200 dark:border-red-900/40">
          {error}
        </div>
      )}

      {/* Plan Mode View Toggle & Progress Overview Card */}
      <div className="plan-card rounded-2xl p-5 border border-[#E2DDD3] dark:border-[#26313A] bg-white dark:bg-[#171E24] transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2DDD3]/70 dark:border-[#26313A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 flex items-center justify-center border border-brand-200/70 dark:border-brand-700/30">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-[#98A4AF]">Plan Completion</div>
              <div className="text-lg font-display font-bold text-slate-900 dark:text-[#F2EFE9] tabular-nums">{completedCount} of {steps.length} Milestones Cleared ({progressPercent}%)</div>
            </div>
          </div>

          {/* Segmented Mode Selector */}
          <div className="flex items-center gap-1 p-1 bg-[#EFECE4] dark:bg-[#11161A] rounded-xl border border-[#E2DDD3] dark:border-[#26313A] self-start sm:self-auto">
            <button
              onClick={() => setPlanMode('roadmap')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                planMode === 'roadmap'
                  ? 'bg-white dark:bg-[#1F2830] text-slate-900 dark:text-[#F2EFE9] shadow-xs border border-[#E2DDD3] dark:border-[#2E3B46]'
                  : 'text-slate-500 dark:text-[#98A4AF] hover:text-slate-800 dark:hover:text-[#F2EFE9]'
              }`}
            >
              Curriculum Roadmap
            </button>
            <button
              onClick={() => setPlanMode('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                planMode === 'weekly'
                  ? 'bg-white dark:bg-[#1F2830] text-slate-900 dark:text-[#F2EFE9] shadow-xs border border-[#E2DDD3] dark:border-[#2E3B46]'
                  : 'text-slate-500 dark:text-[#98A4AF] hover:text-slate-800 dark:hover:text-[#F2EFE9]'
              }`}
            >
              Weekly Schedule
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="pt-4">
          <div className="w-full h-2 bg-[#EFECE4] dark:bg-[#222B33] rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-600 dark:bg-brand-500 rounded-full transition-all duration-500" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Plan Mode Display - Light & Dark Milestone Cards */}
      <div className="space-y-4">
        {steps.map((step, idx) => {
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';

          return (
            <div 
              key={idx}
              className={`rounded-2xl p-5 sm:p-6 transition-all duration-200 border ${
                isCompleted 
                  ? 'plan-card-completed bg-emerald-50/60 dark:bg-[#13221C] border-emerald-200 dark:border-emerald-500/35'
                  : isCurrent 
                  ? 'plan-card-current bg-brand-50/55 dark:bg-[#14232A] border-brand-200 dark:border-brand-500/45 ring-1 ring-brand-500/20'
                  : 'plan-card-upcoming bg-white dark:bg-[#171E24] border-[#E2DDD3] dark:border-[#26313A]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  {/* Status Indicator Icon */}
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 flex items-center justify-center border border-brand-200 dark:border-brand-500/40">
                        <Target className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-[#EFECE4] dark:bg-[#222B33] text-slate-400 dark:text-[#8A97A3] flex items-center justify-center border border-[#E2DDD3] dark:border-[#2E3B46]">
                        <Circle className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tracking-wider uppercase font-semibold">
                      <span className="text-slate-500 dark:text-[#98A4AF]">
                        Milestone 0{idx + 1}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-[#44515C]">·</span>
                      <span className={
                        isCompleted
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : isCurrent
                          ? 'text-brand-700 dark:text-brand-300'
                          : 'text-slate-500 dark:text-[#98A4AF]'
                      }>
                        {step.status}
                      </span>
                    </div>

                    <h3 className="text-lg font-display font-bold text-slate-900 dark:text-[#F2EFE9] mt-1 tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-[#98A4AF] mt-1 leading-relaxed">
                      {step.description}
                    </p>

                    {/* Key Concepts Tags in Light & Dark Block */}
                    {step.concepts && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {step.concepts.map((concept, cIdx) => (
                          <span 
                            key={cIdx} 
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-[#FAF8F4] dark:bg-[#11161A] text-slate-700 dark:text-[#D5D1C8] border border-[#E2DDD3] dark:border-[#26313A] font-medium"
                          >
                            {concept}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Duration and Action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E2DDD3]/70 dark:border-white/5">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-600 dark:text-[#98A4AF]">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-[#8A97A3]" />
                    <span>{step.duration}</span>
                  </div>

                  {isCompleted ? (
                    <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      +40 EP Earned
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCompleteMilestone(idx)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-xs whitespace-nowrap ${
                        isCurrent
                          ? 'bg-brand-600 hover:bg-brand-700 text-white'
                          : 'bg-[#FAF8F4] dark:bg-[#202931] hover:bg-[#EFECE4] dark:hover:bg-[#29343E] text-slate-700 dark:text-[#F2EFE9] border border-[#E2DDD3] dark:border-[#2E3B46]'
                      }`}
                    >
                      <span>Complete Milestone (+40 EP)</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Schedule Supplementary Card (when Plan Mode is weekly) */}
      {planMode === 'weekly' && (
        <div className="contrast-blocked-card plan-card rounded-2xl p-6 border border-[#E2DDD3] dark:border-[#26313A] bg-white dark:bg-[#171E24] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <h4 className="text-base font-display font-bold text-slate-900 dark:text-[#F2EFE9]">Weekly Reading &amp; Retention Rhythm</h4>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-[#98A4AF]">4 Sessions / Week</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { day: 'Mon & Wed', activity: 'Chapter Deep Dive & Cornell Notes', focus: 'Deep Reading (45 mins)' },
              { day: 'Friday', activity: 'Concept Synthesis with Sage AI', focus: 'Interactive Q&A (30 mins)' },
              { day: 'Saturday', activity: 'Assessment Quiz & Spaced Repetition', focus: 'Quiz Practice (20 mins)' },
              { day: 'Sunday', activity: 'Weekly Review & Learning Path Sync', focus: 'Reflection (15 mins)' }
            ].map((slot, sIdx) => (
              <div 
                key={sIdx}
                className="p-3.5 rounded-xl bg-[#FAF8F4] dark:bg-[#11161A] border border-[#E2DDD3] dark:border-[#26313A]"
              >
                <div className="text-[11px] font-mono font-bold text-brand-700 dark:text-brand-400 uppercase tracking-wider">{slot.day}</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-[#F2EFE9] mt-0.5">{slot.activity}</div>
                <div className="text-xs text-slate-500 dark:text-[#98A4AF] mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{slot.focus}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
