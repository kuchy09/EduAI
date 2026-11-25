import React from 'react';
import {
  FlaskConical,
  Atom,
  Dna,
  CheckCircle2,
  Circle,
  ArrowRight,
  Award,
} from 'lucide-react';
import {
  LabCategory,
  LabExperimentId,
  LabTrialRecord,
  AssessmentAttempt,
  PRACTICALS_CATALOG,
} from './edulabTypes';

interface EduLabProgressViewProps {
  trials: LabTrialRecord[];
  exploredIds: LabExperimentId[];
  assessmentAttempts: AssessmentAttempt[];
  onLaunchPractical: (category: LabCategory, id: LabExperimentId) => void;
  onOpenAssessments: () => void;
}

export function EduLabProgressView({
  trials,
  exploredIds,
  assessmentAttempts,
  onLaunchPractical,
  onOpenAssessments,
}: EduLabProgressViewProps) {
  const categories: Array<{
    key: LabCategory;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    barColor: string;
    iconColor: string;
  }> = [
    {
      key: 'chemistry',
      label: 'Chemistry Lab Mastery',
      icon: FlaskConical,
      barColor: 'bg-indigo-600',
      iconColor: 'text-indigo-500',
    },
    {
      key: 'physics',
      label: 'Physics Lab Mastery',
      icon: Atom,
      barColor: 'bg-sky-600',
      iconColor: 'text-sky-500',
    },
    {
      key: 'biology',
      label: 'Biology Lab Mastery',
      icon: Dna,
      barColor: 'bg-emerald-600',
      iconColor: 'text-emerald-500',
    },
  ];

  const avgScore =
    assessmentAttempts.length > 0
      ? Math.round(
          assessmentAttempts.reduce((acc, item) => acc + item.percentage, 0) /
            assessmentAttempts.length
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Discipline Mastery Bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const items = PRACTICALS_CATALOG.filter((p) => p.category === cat.key);
          const done = items.filter((p) => exploredIds.includes(p.id)).length;
          const catTrials = trials.filter((t) => t.category === cat.key).length;
          const pct = Math.round((done / items.length) * 100);

          return (
            <div
              key={cat.key}
              className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${cat.iconColor}`} />
                  <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                    {cat.label}
                  </h3>
                </div>
                <span className="text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                  {pct}%
                </span>
              </div>

              <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full ${cat.barColor} transition-all duration-300`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {done}/{items.length} practicals explored · {catTrials} logged readings
              </p>

              <div className="pt-1 space-y-1.5 border-t border-slate-100 dark:border-white/5">
                {items.map((prac) => {
                  const visited = exploredIds.includes(prac.id);
                  const count = trials.filter((t) => t.experiment === prac.id).length;
                  return (
                    <button
                      key={prac.id}
                      type="button"
                      onClick={() => onLaunchPractical(cat.key, prac.id)}
                      className="w-full flex items-center justify-between gap-2 py-1 text-left text-xs hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        {visited ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                        )}
                        <span className="truncate text-slate-700 dark:text-slate-300">
                          {prac.label}
                        </span>
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                        {count} trials
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assessment Performance History */}
      <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                Assessment Performance History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {assessmentAttempts.length > 0
                  ? `Average score ${avgScore}% across ${assessmentAttempts.length} completed practical assessments.`
                  : 'Complete a practical assessment to establish your lab readiness score.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenAssessments}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Open Assessments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {assessmentAttempts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3">Paper</th>
                  <th className="py-2 pr-3">Track</th>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono tabular-nums">
                {assessmentAttempts.map((att) => (
                  <tr key={att.id}>
                    <td className="py-2.5 pr-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                      {att.title}
                    </td>
                    <td className="py-2.5 pr-3 uppercase text-slate-500">
                      {att.discipline}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">
                      {att.timestamp}
                    </td>
                    <td className="py-2.5 text-right font-bold text-indigo-600 dark:text-indigo-400">
                      {att.score}/{att.total} ({att.percentage}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
