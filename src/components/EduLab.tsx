import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  Library,
  FlaskConical,
  Atom,
  Dna,
  Sparkles,
  ClipboardList,
  TrendingUp,
  Download,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { ViewState } from '../types';
import { safeStorage } from '../lib/safeStorage';
import { triggerCapsuleFeedback } from '../lib/feedback';
import {
  EduLabNavSection,
  LabCategory,
  LabExperimentId,
  ChemistryPracticalId,
  PhysicsPracticalId,
  BiologyPracticalId,
  LabTrialRecord,
  TrialPayload,
  AssessmentAttempt,
  PRACTICALS_CATALOG,
} from './edulab/edulabTypes';
import { ChemistryLabView } from './edulab/ChemistryLabView';
import { PhysicsLabView } from './edulab/PhysicsLabView';
import { BiologyLabView } from './edulab/BiologyLabView';
import { EduLabDashboard } from './edulab/EduLabDashboard';
import { ExperimentLibraryView } from './edulab/ExperimentLibraryView';
import { AiLabAssistantView } from './edulab/AiLabAssistantView';
import { PracticalAssessmentsView } from './edulab/PracticalAssessmentsView';
import { EduLabProgressView } from './edulab/EduLabProgressView';

interface EduLabProps {
  user?: any;
  profile?: any;
  onNavigate?: (view: ViewState) => void;
}

const EDULAB_NAV_ITEMS: Array<{
  id: EduLabNavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'library', label: 'Experiment Library', icon: Library },
  { id: 'chemistry', label: 'Chemistry', icon: FlaskConical },
  { id: 'physics', label: 'Physics', icon: Atom },
  { id: 'biology', label: 'Biology', icon: Dna },
  { id: 'assistant', label: 'AI Lab Assistant', icon: Sparkles },
  { id: 'assessments', label: 'Practical Assessments', icon: ClipboardList },
  { id: 'progress', label: 'My Progress', icon: TrendingUp },
];

export function EduLab({ user, profile, onNavigate }: EduLabProps) {
  const userKey = user?.id || 'guest';
  const trialsStorageKey = useMemo(
    () => `edulab_trials_v3_${userKey}`,
    [userKey]
  );
  const exploredStorageKey = useMemo(
    () => `edulab_explored_v1_${userKey}`,
    [userKey]
  );
  const assessmentsStorageKey = useMemo(
    () => `edulab_assessments_v1_${userKey}`,
    [userKey]
  );

  const [activeSection, setActiveSection] = useState<EduLabNavSection>('dashboard');
  const [chemPractical, setChemPractical] = useState<ChemistryPracticalId>('reactions');
  const [physPractical, setPhysPractical] = useState<PhysicsPracticalId>('circuits');
  const [bioPractical, setBioPractical] = useState<BiologyPracticalId>('cells');

  const isLabSection =
    activeSection === 'chemistry' ||
    activeSection === 'physics' ||
    activeSection === 'biology';

  const activeCategory: LabCategory = isLabSection ? activeSection : 'chemistry';

  const activePracticalId: LabExperimentId = useMemo(() => {
    if (activeCategory === 'chemistry') return chemPractical;
    if (activeCategory === 'physics') return physPractical;
    return bioPractical;
  }, [activeCategory, chemPractical, physPractical, bioPractical]);

  const categoryPracticals = useMemo(
    () => PRACTICALS_CATALOG.filter((p) => p.category === activeCategory),
    [activeCategory]
  );

  const activeMeta = useMemo(
    () =>
      PRACTICALS_CATALOG.find((p) => p.id === activePracticalId) ||
      PRACTICALS_CATALOG[0],
    [activePracticalId]
  );

  const [trials, setTrials] = useState<LabTrialRecord[]>(() => {
    try {
      const raw = safeStorage.getItem(`edulab_trials_v3_${user?.id || 'guest'}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [exploredIds, setExploredIds] = useState<LabExperimentId[]>(() => {
    try {
      const raw = safeStorage.getItem(`edulab_explored_v1_${user?.id || 'guest'}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [assessmentAttempts, setAssessmentAttempts] = useState<AssessmentAttempt[]>(
    () => {
      try {
        const raw = safeStorage.getItem(
          `edulab_assessments_v1_${user?.id || 'guest'}`
        );
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
  );

  useEffect(() => {
    try {
      const rawTrials = safeStorage.getItem(trialsStorageKey);
      setTrials(rawTrials ? JSON.parse(rawTrials) : []);
      const rawExplored = safeStorage.getItem(exploredStorageKey);
      setExploredIds(rawExplored ? JSON.parse(rawExplored) : []);
      const rawAssessments = safeStorage.getItem(assessmentsStorageKey);
      setAssessmentAttempts(rawAssessments ? JSON.parse(rawAssessments) : []);
    } catch {
      setTrials([]);
      setExploredIds([]);
      setAssessmentAttempts([]);
    }
  }, [trialsStorageKey, exploredStorageKey, assessmentsStorageKey]);

  const markPracticalExplored = useCallback(
    (id: LabExperimentId) => {
      setExploredIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        try {
          safeStorage.setItem(exploredStorageKey, JSON.stringify(next));
        } catch {
          // Ignore storage quota errors
        }
        return next;
      });
    },
    [exploredStorageKey]
  );

  useEffect(() => {
    if (isLabSection) {
      markPracticalExplored(activePracticalId);
    }
  }, [isLabSection, activePracticalId, markPracticalExplored]);

  const persistTrials = useCallback(
    (next: LabTrialRecord[]) => {
      setTrials(next);
      try {
        safeStorage.setItem(trialsStorageKey, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
    },
    [trialsStorageKey]
  );

  const handleSaveAssessmentAttempt = useCallback(
    (attempt: AssessmentAttempt) => {
      setAssessmentAttempts((prev) => {
        const next = [attempt, ...prev].slice(0, 30);
        try {
          safeStorage.setItem(assessmentsStorageKey, JSON.stringify(next));
        } catch {
          // Ignore storage quota errors
        }
        return next;
      });
    },
    [assessmentsStorageKey]
  );

  const handleSelectPractical = (id: LabExperimentId) => {
    if (activeCategory === 'chemistry') setChemPractical(id as ChemistryPracticalId);
    else if (activeCategory === 'physics') setPhysPractical(id as PhysicsPracticalId);
    else setBioPractical(id as BiologyPracticalId);
    markPracticalExplored(id);
  };

  const handleLaunchPractical = useCallback(
    (category: LabCategory, id: LabExperimentId) => {
      if (category === 'chemistry') setChemPractical(id as ChemistryPracticalId);
      else if (category === 'physics') setPhysPractical(id as PhysicsPracticalId);
      else setBioPractical(id as BiologyPracticalId);
      setActiveSection(category);
      markPracticalExplored(id);
    },
    [markPracticalExplored]
  );

  const handleRecordTrial = useCallback(
    (payload: TrialPayload) => {
      triggerCapsuleFeedback({ pitch: 720, volume: 0.16, hapticDuration: 12 });
      const nowLabel = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const record: LabTrialRecord = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: activeCategory,
        experiment: activePracticalId,
        timestamp: nowLabel,
        ...payload,
      };
      persistTrials([record, ...trials].slice(0, 100));
    },
    [activeCategory, activePracticalId, persistTrials, trials]
  );

  const activeLabTrials = useMemo(
    () => trials.filter((t) => t.experiment === activePracticalId),
    [trials, activePracticalId]
  );

  const handleDeleteTrial = (id: string) => {
    persistTrials(trials.filter((t) => t.id !== id));
  };

  const handleClearActiveTrials = () => {
    persistTrials(trials.filter((t) => t.experiment !== activePracticalId));
  };

  const handleExportCsv = () => {
    if (activeLabTrials.length === 0) return;
    const headers = [
      'Timestamp',
      'Category',
      'Practical',
      'Parameters',
      'Primary Reading',
      'Secondary Reading',
      'Derived Result',
    ];
    const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
    const rows = activeLabTrials.map((r) =>
      [
        r.timestamp,
        r.category.toUpperCase(),
        r.experiment.toUpperCase(),
        r.inputsSummary,
        r.primaryReading,
        r.secondaryReading,
        r.derivedMetric,
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edulab-${activeCategory}-${activePracticalId}-report.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const headerInfo = useMemo(() => {
    switch (activeSection) {
      case 'dashboard':
        return {
          code: 'EDULAB · COMMAND OVERVIEW',
          title: 'Science Laboratory Dashboard',
          subtitle:
            'Launch interactive Chemistry, Physics, and Biology practicals, inspect logged bench data, or take practical assessments.',
        };
      case 'library':
        return {
          code: 'EDULAB · EXPERIMENT CATALOG',
          title: 'Experiment Library',
          subtitle:
            'Browse all 15 curriculum-aligned practical modules with governing equations and launch straight into any workbench.',
        };
      case 'assistant':
        return {
          code: 'EDULAB · AI LAB COPILOT',
          title: 'AI Lab Assistant',
          subtitle:
            'Ask experiment-specific questions grounded in lab equations, practical procedures, and your recorded trials.',
        };
      case 'assessments':
        return {
          code: 'EDULAB · PRACTICAL EVALUATION',
          title: 'Practical Assessments',
          subtitle:
            'Test volumetric analysis, instrumentation reading, optics, and experimental deduction with instant worked solutions.',
        };
      case 'progress':
        return {
          code: 'EDULAB · TELEMETRY & MASTERY',
          title: 'My Progress',
          subtitle:
            'Review discipline coverage across all 15 practicals, empirical trials logged, and graded assessment performance.',
        };
      default:
        return {
          code: activeMeta.code,
          title: activeMeta.title,
          subtitle: activeMeta.objective,
        };
    }
  }, [activeSection, activeMeta]);

  return (
    <div className="min-h-full w-full bg-[#F7F5F0] dark:bg-[#11161A] text-slate-900 dark:text-[#F2EFE9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-5">
        {/* Top Lab Console Header + 8-Item EduLab Navigation */}
        <div className="flex flex-col gap-4 pb-4 border-b border-[#E2DDD3] dark:border-[#26313A]">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-[#98A4AF]">
                <span className="text-brand-700 dark:text-brand-400 font-semibold">
                  EDULAB VIRTUAL LABORATORY
                </span>
                <span>·</span>
                <span>{headerInfo.code}</span>
                {profile?.curriculum && (
                  <>
                    <span>·</span>
                    <span>{String(profile.curriculum).toUpperCase()} TRACK</span>
                  </>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-slate-900 dark:text-[#F2EFE9]">
                {headerInfo.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#98A4AF] max-w-3xl">
                {headerInfo.subtitle}
              </p>
            </div>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('library')}
                className="self-start flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                <span>Textbooks</span>
              </button>
            )}
          </div>

          {/* 8 EduLab Internal Navigations */}
          <nav
            aria-label="EduLab Navigation"
            className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10"
          >
            {EDULAB_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              const activeClass =
                item.id === 'physics'
                  ? 'bg-sky-600 text-white'
                  : item.id === 'biology'
                  ? 'bg-emerald-600 text-white'
                  : item.id === 'chemistry'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900';

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? activeClass
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* 5 Practical Selector Tabs when inside Chemistry / Physics / Biology */}
          {isLabSection && (
            <div
              className="flex flex-wrap items-center gap-2 pt-1"
              role="tablist"
              aria-label="Lab Practicals"
            >
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1">
                Practicals:
              </span>
              {categoryPracticals.map((prac) => {
                const isSelected = prac.id === activePracticalId;
                const activeStyles =
                  activeCategory === 'chemistry'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 text-indigo-700 dark:text-indigo-300'
                    : activeCategory === 'physics'
                    ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 text-sky-700 dark:text-sky-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-700 dark:text-emerald-300';
                return (
                  <button
                    key={prac.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleSelectPractical(prac.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? activeStyles
                        : 'bg-white dark:bg-[#18181a] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    {prac.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Section Body */}
        {activeSection === 'dashboard' && (
          <EduLabDashboard
            profile={profile}
            trials={trials}
            exploredIds={exploredIds}
            assessmentAttempts={assessmentAttempts}
            onOpenSection={setActiveSection}
            onLaunchPractical={handleLaunchPractical}
          />
        )}

        {activeSection === 'library' && (
          <ExperimentLibraryView
            trials={trials}
            exploredIds={exploredIds}
            onLaunchPractical={handleLaunchPractical}
          />
        )}

        {activeSection === 'assistant' && (
          <AiLabAssistantView
            user={user}
            activePracticalId={activePracticalId}
            trials={trials}
          />
        )}

        {activeSection === 'assessments' && (
          <PracticalAssessmentsView
            attempts={assessmentAttempts}
            onSaveAttempt={handleSaveAssessmentAttempt}
            onLaunchPractical={handleLaunchPractical}
          />
        )}

        {activeSection === 'progress' && (
          <EduLabProgressView
            trials={trials}
            exploredIds={exploredIds}
            assessmentAttempts={assessmentAttempts}
            onLaunchPractical={handleLaunchPractical}
            onOpenAssessments={() => setActiveSection('assessments')}
          />
        )}

        {activeSection === 'chemistry' && (
          <ChemistryLabView
            practicalId={chemPractical}
            formula={activeMeta.formula}
            onRecordTrial={handleRecordTrial}
          />
        )}

        {activeSection === 'physics' && (
          <PhysicsLabView
            practicalId={physPractical}
            formula={activeMeta.formula}
            onRecordTrial={handleRecordTrial}
          />
        )}

        {activeSection === 'biology' && (
          <BiologyLabView
            practicalId={bioPractical}
            formula={activeMeta.formula}
            onRecordTrial={handleRecordTrial}
          />
        )}

        {/* Persistent Lab Notebook & CSV Export for Active Lab Benches */}
        {isLabSection && (
          <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  Lab Notebook — {activeMeta.label} ({activeLabTrials.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click Record Trial in the bench controls to capture empirical readings and export as CSV.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={activeLabTrials.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                {activeLabTrials.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearActiveTrials}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {activeLabTrials.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                No readings logged yet for <strong>{activeMeta.label}</strong>. Adjust controls and click <strong>Record Trial</strong>.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Parameters</th>
                      <th className="py-2 pr-3">Primary</th>
                      <th className="py-2 pr-3">Secondary</th>
                      <th className="py-2 pr-3">Derived</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono tabular-nums">
                    {activeLabTrials.map((trial, idx) => (
                      <tr
                        key={trial.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                      >
                        <td className="py-2 pr-3 text-slate-400">
                          {activeLabTrials.length - idx}
                        </td>
                        <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">
                          {trial.timestamp}
                        </td>
                        <td className="py-2 pr-3 font-sans text-slate-700 dark:text-slate-300">
                          {trial.inputsSummary}
                        </td>
                        <td className="py-2 pr-3 font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {trial.primaryReading}
                        </td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {trial.secondaryReading}
                        </td>
                        <td className="py-2 pr-3 font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {trial.derivedMetric}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteTrial(trial.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                            title="Delete trial"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
