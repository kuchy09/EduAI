import React from 'react';
import {
  FlaskConical,
  Atom,
  Dna,
  Library,
  Sparkles,
  ClipboardList,
  TrendingUp,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  EduLabNavSection,
  LabCategory,
  LabExperimentId,
  LabTrialRecord,
  AssessmentAttempt,
  PRACTICALS_CATALOG,
} from './edulabTypes';

interface EduLabDashboardProps {
  profile?: any;
  trials: LabTrialRecord[];
  exploredIds: LabExperimentId[];
  assessmentAttempts: AssessmentAttempt[];
  onOpenSection: (section: EduLabNavSection) => void;
  onLaunchPractical: (category: LabCategory, id: LabExperimentId) => void;
}

export function EduLabDashboard({
  profile,
  trials,
  exploredIds,
  assessmentAttempts,
  onOpenSection,
  onLaunchPractical,
}: EduLabDashboardProps) {
  const totalPracticals = PRACTICALS_CATALOG.length;
  const exploredCount = exploredIds.length;
  const avgAssessment =
    assessmentAttempts.length > 0
      ? Math.round(
          assessmentAttempts.reduce((sum, a) => sum + a.percentage, 0) /
            assessmentAttempts.length
        )
      : null;

  const recentTrials = trials.slice(0, 5);

  const disciplines: Array<{
    key: LabCategory;
    name: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    accentText: string;
    accentBg: string;
  }> = [
    {
      key: 'chemistry',
      name: 'Chemistry Lab',
      subtitle: 'Kinetics, titrations, gas preparation, electrolysis & salt qualitative tests.',
      icon: FlaskConical,
      accentText: 'text-indigo-600 dark:text-indigo-400',
      accentBg: 'bg-indigo-50 dark:bg-indigo-950/50',
    },
    {
      key: 'physics',
      name: 'Physics Lab',
      subtitle: 'DC circuits, pendulum mechanics, optics & wave tank, solenoids & vernier metrology.',
      icon: Atom,
      accentText: 'text-sky-600 dark:text-sky-400',
      accentBg: 'bg-sky-50 dark:bg-sky-950/50',
    },
    {
      key: 'biology',
      name: 'Biology Lab',
      subtitle: 'Osmosis plasmolysis, compound microscopy, Punnett genetics, physiology & ecology.',
      icon: Dna,
      accentText: 'text-emerald-600 dark:text-emerald-400',
      accentBg: 'bg-emerald-50 dark:bg-emerald-950/50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Practicals Explored
          </p>
          <p className="mt-1.5 text-2xl font-display font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {exploredCount} / {totalPracticals}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {Math.round((exploredCount / totalPracticals) * 100)}% syllabus coverage
          </p>
        </div>

        <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Logged Bench Trials
          </p>
          <p className="mt-1.5 text-2xl font-display font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
            {trials.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Saved empirical lab readings
          </p>
        </div>

        <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Assessment Average
          </p>
          <p className="mt-1.5 text-2xl font-display font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {avgAssessment !== null ? `${avgAssessment}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {assessmentAttempts.length}{' '}
            {assessmentAttempts.length === 1 ? 'attempt' : 'attempts'} graded
          </p>
        </div>

        <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Curriculum Track
          </p>
          <p className="mt-1.5 text-xl font-display font-bold text-slate-900 dark:text-white truncate">
            {profile?.curriculum ? String(profile.curriculum).toUpperCase() : 'KCSE / CBC'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            3 active laboratory benches
          </p>
        </div>
      </div>

      {/* Discipline Quick-Launch Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-display font-bold text-slate-900 dark:text-white">
            Laboratory Workbenches
          </h2>
          <button
            type="button"
            onClick={() => onOpenSection('library')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Browse all 15 experiments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {disciplines.map((disc) => {
            const Icon = disc.icon;
            const list = PRACTICALS_CATALOG.filter((p) => p.category === disc.key);
            const discExplored = list.filter((p) => exploredIds.includes(p.id)).length;
            const discTrials = trials.filter((t) => t.category === disc.key).length;

            return (
              <div
                key={disc.key}
                className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${disc.accentBg}`}>
                      <Icon className={`w-5 h-5 ${disc.accentText}`} />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {discExplored}/{list.length} explored · {discTrials} trials
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-display font-bold text-slate-900 dark:text-white">
                      {disc.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {disc.subtitle}
                    </p>
                  </div>
                  <div className="pt-1 flex flex-col gap-1">
                    {list.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onLaunchPractical(disc.key, item.id)}
                        className="text-left text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 py-0.5 flex items-center justify-between cursor-pointer"
                      >
                        <span className="truncate">{item.label}</span>
                        <ArrowRight className="w-3 h-3 shrink-0 opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenSection(disc.key)}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Enter {disc.name}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tools Row + Recent Bench Trials */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-display font-bold text-slate-900 dark:text-white">
            Lab Support & Evaluation
          </h2>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => onOpenSection('library')}
              className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.03] text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Library className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Experiment Library
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Search & launch any of the 15 practical modules
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onOpenSection('assistant')}
              className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.03] text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    AI Lab Assistant
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Ask Sage about equations, precautions & experimental error
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onOpenSection('assessments')}
              className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.03] text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ClipboardList className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Practical Assessments
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Graded calculation & observation checks across all labs
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onOpenSection('progress')}
              className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.03] text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    My Progress
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Track mastery by subject, logged trials & quiz history
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-display font-bold text-slate-900 dark:text-white">
              Recent Lab Readings
            </h2>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {trials.length} total recorded
            </span>
          </div>

          {recentTrials.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-xl px-4">
              <Clock className="w-5 h-5 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                No bench trials logged yet. Open any practical in Chemistry, Physics, or Biology and click <strong>Record Trial</strong>.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {recentTrials.map((trial) => {
                const prac = PRACTICALS_CATALOG.find((p) => p.id === trial.experiment);
                return (
                  <div
                    key={trial.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {prac?.label || trial.experiment}{' '}
                        <span className="font-mono font-normal text-[11px] text-slate-500 dark:text-slate-400">
                          · {trial.category.toUpperCase()} · {trial.timestamp}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {trial.inputsSummary}
                      </p>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <p className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {trial.primaryReading}
                      </p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        {trial.derivedMetric}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
