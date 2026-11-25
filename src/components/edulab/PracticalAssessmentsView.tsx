import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react';
import {
  LabCategory,
  LabExperimentId,
  AssessmentAttempt,
  PRACTICAL_ASSESSMENT_QUESTIONS,
  PRACTICALS_CATALOG,
} from './edulabTypes';

interface PracticalAssessmentsViewProps {
  attempts: AssessmentAttempt[];
  onSaveAttempt: (attempt: AssessmentAttempt) => void;
  onLaunchPractical: (category: LabCategory, id: LabExperimentId) => void;
}

export function PracticalAssessmentsView({
  attempts,
  onSaveAttempt,
  onLaunchPractical,
}: PracticalAssessmentsViewProps) {
  const [discipline, setDiscipline] = useState<'mixed' | LabCategory>('mixed');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const questions = useMemo(() => {
    if (discipline === 'mixed') return PRACTICAL_ASSESSMENT_QUESTIONS;
    return PRACTICAL_ASSESSMENT_QUESTIONS.filter(
      (q) => q.discipline === discipline
    );
  }, [discipline]);

  const answeredCount = questions.filter(
    (q) => selectedAnswers[q.id] !== undefined
  ).length;

  const score = useMemo(() => {
    return questions.reduce(
      (sum, q) => sum + (selectedAnswers[q.id] === q.correctIndex ? 1 : 0),
      0
    );
  }, [questions, selectedAnswers]);

  const handleSelectDiscipline = (next: 'mixed' | LabCategory) => {
    setDiscipline(next);
    setSelectedAnswers({});
    setIsSubmitted(false);
  };

  const handleSubmit = () => {
    if (questions.length === 0) return;
    setIsSubmitted(true);
    const pct = Math.round((score / questions.length) * 100);
    const labelMap: Record<'mixed' | LabCategory, string> = {
      mixed: 'Comprehensive Practical Exam (All 3 Labs)',
      chemistry: 'Chemistry Practical Assessment',
      physics: 'Physics Practical Assessment',
      biology: 'Biology Practical Assessment',
    };
    onSaveAttempt({
      id: `assess-${Date.now()}`,
      discipline,
      title: labelMap[discipline],
      score,
      total: questions.length,
      percentage: pct,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
  };

  const pct =
    questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Assessment Mode Bar */}
      <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-display font-bold text-slate-900 dark:text-white">
            Practical Assessments & Data Interpretation
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select a paper track, answer experimental questions, and record your graded score.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: 'mixed', label: 'All Labs (12)' },
              { key: 'chemistry', label: 'Chemistry (4)' },
              { key: 'physics', label: 'Physics (4)' },
              { key: 'biology', label: 'Biology (4)' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelectDiscipline(item.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                discipline === item.key
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                  : 'bg-white dark:bg-[#18181a] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Banner After Submit */}
      {isSubmitted && (
        <div className="bg-white dark:bg-[#18181a] border border-indigo-300 dark:border-indigo-700/60 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Assessment Graded
              </p>
              <p className="text-lg font-display font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {score} / {questions.length} Correct ({pct}%)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake Paper</span>
          </button>
        </div>
      )}

      {/* Question Cards */}
      <div className="space-y-4">
        {questions.map((q, index) => {
          const picked = selectedAnswers[q.id];
          const pracMeta = PRACTICALS_CATALOG.find(
            (p) => p.id === q.practicalId
          );

          return (
            <div
              key={q.id}
              className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Question {index + 1} · {q.discipline.toUpperCase()} ·{' '}
                  {pracMeta?.label || q.practicalId}
                </span>
                {pracMeta && (
                  <button
                    type="button"
                    onClick={() =>
                      onLaunchPractical(pracMeta.category, pracMeta.id)
                    }
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Review Bench</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <p className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">
                {q.prompt}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map((opt, optIdx) => {
                  const isPicked = picked === optIdx;
                  const isCorrectOpt = q.correctIndex === optIdx;

                  let optStyle =
                    'border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05]';

                  if (!isSubmitted && isPicked) {
                    optStyle =
                      'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold';
                  } else if (isSubmitted && isCorrectOpt) {
                    optStyle =
                      'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold';
                  } else if (isSubmitted && isPicked && !isCorrectOpt) {
                    optStyle =
                      'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300';
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isSubmitted}
                      onClick={() =>
                        setSelectedAnswers((prev) => ({
                          ...prev,
                          [q.id]: optIdx,
                        }))
                      }
                      className={`p-3 rounded-xl border text-left text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer disabled:cursor-default ${optStyle}`}
                    >
                      <span>{opt}</span>
                      {isSubmitted && isCorrectOpt && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      {isSubmitted && isPicked && !isCorrectOpt && (
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {isSubmitted && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong className="font-semibold text-slate-900 dark:text-white">
                    Worked Explanation:{' '}
                  </strong>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Action Bar */}
      {!isSubmitted && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-4">
          <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
            Answered {answeredCount} of {questions.length} questions
          </span>
          <button
            type="button"
            disabled={answeredCount === 0}
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Submit Practical Assessment
          </button>
        </div>
      )}

      {/* Recent Attempts Summary */}
      {attempts.length > 0 && (
        <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-2.5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Recent Assessment Scores ({attempts.length})
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
            {attempts.slice(0, 5).map((a) => (
              <div
                key={a.id}
                className="py-2 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {a.title}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Recorded at {a.timestamp}
                  </p>
                </div>
                <span className="font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                  {a.score}/{a.total} ({a.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
