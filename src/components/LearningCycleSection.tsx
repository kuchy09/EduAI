import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Brain,
  FlaskConical,
  Zap,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Compass,
  AlertCircle,
} from 'lucide-react';
import { Book, ViewState } from '../types';
import {
  analyzeLearningCycle,
  LEARNING_CYCLE_UPDATED_EVENT,
  LearningCycleStageId,
  LearningCycleStageSummary,
} from '../lib/learningCycleService';
import { ACHIEVEMENTS_UPDATED_EVENT } from '../lib/achievementsService';
import { ACCOUNT_SYNC_EVENT } from '../lib/accountSyncService';
import { ACADEMIC_PREFS_EVENT } from '../lib/bookPersonalization';
import { safeStorage } from '../lib/safeStorage';

interface LearningCycleSectionProps {
  books: Book[];
  user?: any;
  profile?: any;
  onNavigate?: (view: ViewState) => void;
  onBookSelect?: (book: Book) => void;
}

const STAGE_ICONS: Record<
  LearningCycleStageId,
  React.ComponentType<{ className?: string }>
> = {
  learn: BookOpen,
  understand: Brain,
  experiment: FlaskConical,
  test: Zap,
  improve: TrendingUp,
};

export function LearningCycleSection({
  books,
  user,
  profile,
  onNavigate,
  onBookSelect,
}: LearningCycleSectionProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(LEARNING_CYCLE_UPDATED_EVENT, refresh);
    window.addEventListener(ACHIEVEMENTS_UPDATED_EVENT, refresh);
    window.addEventListener(ACCOUNT_SYNC_EVENT, refresh);
    window.addEventListener(ACADEMIC_PREFS_EVENT, refresh);
    window.addEventListener('edu-ai-progress-updated', refresh);
    return () => {
      window.removeEventListener(LEARNING_CYCLE_UPDATED_EVENT, refresh);
      window.removeEventListener(ACHIEVEMENTS_UPDATED_EVENT, refresh);
      window.removeEventListener(ACCOUNT_SYNC_EVENT, refresh);
      window.removeEventListener(ACADEMIC_PREFS_EVENT, refresh);
      window.removeEventListener('edu-ai-progress-updated', refresh);
    };
  }, []);

  const analysis = useMemo(
    () => analyzeLearningCycle({ books, user, profile }),
    [books, user, profile, tick]
  );

  const handleStageClick = (stage: LearningCycleStageSummary) => {
    if (stage.id === 'learn') {
      const inProgressBook = books.find(
        (b) => (b.readProgress || 0) > 0 && (b.readProgress || 0) < 100
      );
      if (inProgressBook && onBookSelect) {
        onBookSelect(inProgressBook);
        return;
      }
    }
    if (stage.id === 'understand' && stage.prefillPrompt) {
      safeStorage.setItem('ai_tutor_prefill', stage.prefillPrompt);
    }
    onNavigate?.(stage.targetView);
  };

  const topWeakness = analysis.weaknesses[0];
  const nextStage = analysis.recommendedNextStage;

  return (
    <section
      aria-labelledby="eduai-learning-cycle-heading"
      className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#171E24] border border-[#E2DDD3] dark:border-[#26313A] p-5 sm:p-6 md:p-7 space-y-5 shadow-xs"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-4 border-b border-[#E2DDD3] dark:border-[#26313A]">
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-brand-700 dark:text-brand-400 font-semibold">
            The EduAI Learning Cycle · 5-Stage Mastery Loop
          </div>
          <h2
            id="eduai-learning-cycle-heading"
            className="text-xl sm:text-2xl font-display font-semibold text-slate-900 dark:text-[#F2EFE9] tracking-tight"
          >
            Learn, Understand, Experiment, Test, Improve
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#98A4AF] max-w-2xl">
            Every study session moves through five connected stages—from textbook mastery to Socratic understanding, practical labs, diagnostic testing, and targeted remediation.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 font-mono text-xs tabular-nums">
          <span className="text-slate-500 dark:text-[#98A4AF]">
            Cycle Progress
          </span>
          <span className="text-sm font-semibold text-slate-900 dark:text-[#F2EFE9]">
            {analysis.completedStagesCount}/5 stages active
          </span>
        </div>
      </div>

      {/* 5-Stage Architectural Flow Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {analysis.stages.map((stage, index) => {
          const Icon = STAGE_ICONS[stage.id];
          const isCompleted = stage.status === 'completed';
          const isActive = stage.status === 'active';

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => handleStageClick(stage)}
              className={`group relative text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3.5 cursor-pointer active:scale-[0.99] ${
                isActive
                  ? 'bg-brand-50/70 dark:bg-[#13252C] border-brand-400 dark:border-brand-500/60 ring-1 ring-brand-500/20'
                  : isCompleted
                  ? 'bg-[#FAF8F4] dark:bg-[#131C22] border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-400 dark:hover:border-brand-400/70'
                  : 'bg-[#FAF8F4]/70 dark:bg-[#141A20] border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-400 dark:hover:border-brand-400/70'
              }`}
            >
              {/* Top Row: Stage Number + Status */}
              <div className="flex items-center justify-between gap-2 w-full">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 transition-colors ${
                    isActive
                      ? 'bg-brand-600 text-white border-brand-600'
                      : isCompleted
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/40'
                      : 'bg-white dark:bg-[#171E24] text-brand-700 dark:text-brand-400 border-[#E2DDD3] dark:border-[#26313A]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums">
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>{stage.statusLabel}</span>
                    </span>
                  ) : (
                    <span
                      className={
                        isActive
                          ? 'text-brand-700 dark:text-brand-300 font-semibold'
                          : 'text-slate-500 dark:text-[#98A4AF]'
                      }
                    >
                      {stage.statusLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Middle Row: Index + Title + Core Purpose */}
              <div className="space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-[#7F8C97] tabular-nums">
                    {stage.stepNumber}.
                  </span>
                  <h3 className="text-base font-display font-semibold text-slate-900 dark:text-[#F2EFE9] group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                    {stage.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-[#98A4AF] leading-relaxed">
                  {stage.description}
                </p>
              </div>

              {/* Bottom Row: Real Telemetry & Stage Action */}
              <div className="pt-2.5 border-t border-[#E2DDD3]/80 dark:border-[#26313A] flex items-center justify-between gap-2 text-[11px]">
                <span className="font-mono text-slate-500 dark:text-[#98A4AF] truncate tabular-nums">
                  {stage.metricSummary}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-brand-700 dark:text-brand-400 shrink-0">
                  <span>{index < 4 ? 'Open' : 'Track'}</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Connected Cycle Next-Action & Targeted Improvement Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 px-4 py-3.5 rounded-2xl bg-[#FAF8F4] dark:bg-[#11161A] border border-[#E2DDD3] dark:border-[#26313A]">
        {topWeakness ? (
          <>
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">
                  Stage 05 Improve · Targeted Recommendation ({topWeakness.subject})
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-[#D5D1C8] truncate">
                  {topWeakness.reason}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  safeStorage.setItem(
                    'ai_tutor_prefill',
                    topWeakness.sagePrefillPrompt
                  );
                  onNavigate?.('ai-tutor');
                }}
                className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Brain className="w-3.5 h-3.5" />
                <span>{topWeakness.recommendedActionLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('progress')}
                className="px-3 py-2 rounded-xl bg-white dark:bg-[#171E24] border border-[#E2DDD3] dark:border-[#26313A] hover:border-brand-400 text-slate-700 dark:text-[#F2EFE9] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                All Weaknesses
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-700/40 text-brand-700 dark:text-brand-400 flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-mono uppercase tracking-wider text-brand-700 dark:text-brand-400 font-semibold">
                  Recommended Next Step · Stage {nextStage.stepNumber} ({nextStage.title})
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-[#D5D1C8] truncate">
                  {nextStage.detailLine} — {nextStage.description.toLowerCase()}.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleStageClick(nextStage)}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0 self-start md:self-auto whitespace-nowrap"
            >
              <span>{nextStage.actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
