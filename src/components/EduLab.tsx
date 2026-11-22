import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FlaskConical,
  Atom,
  Dna,
  Download,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { ViewState } from '../types';
import { safeStorage } from '../lib/safeStorage';
import { triggerCapsuleFeedback } from '../lib/feedback';
import {
  LabCategory,
  LabExperimentId,
  ChemistryPracticalId,
  PhysicsPracticalId,
  BiologyPracticalId,
  LabTrialRecord,
  TrialPayload,
  PRACTICALS_CATALOG,
} from './edulab/edulabTypes';
import { ChemistryLabView } from './edulab/ChemistryLabView';
import { PhysicsLabView } from './edulab/PhysicsLabView';
import { BiologyLabView } from './edulab/BiologyLabView';

interface EduLabProps {
  user?: any;
  profile?: any;
  onNavigate?: (view: ViewState) => void;
}

export function EduLab({ user, profile, onNavigate }: EduLabProps) {
  const storageKey = useMemo(
    () => `edulab_trials_v3_${user?.id || 'guest'}`,
    [user?.id]
  );

  const [activeCategory, setActiveCategory] = useState<LabCategory>('chemistry');
  const [chemPractical, setChemPractical] = useState<ChemistryPracticalId>('reactions');
  const [physPractical, setPhysPractical] = useState<PhysicsPracticalId>('circuits');
  const [bioPractical, setBioPractical] = useState<BiologyPracticalId>('cells');

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
    () => PRACTICALS_CATALOG.find((p) => p.id === activePracticalId) || PRACTICALS_CATALOG[0],
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

  useEffect(() => {
    try {
      const raw = safeStorage.getItem(storageKey);
      setTrials(raw ? JSON.parse(raw) : []);
    } catch {
      setTrials([]);
    }
  }, [storageKey]);

  const persistTrials = useCallback(
    (next: LabTrialRecord[]) => {
      setTrials(next);
      try {
        safeStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
    },
    [storageKey]
  );

  const handleSelectPractical = (id: LabExperimentId) => {
    if (activeCategory === 'chemistry') setChemPractical(id as ChemistryPracticalId);
    else if (activeCategory === 'physics') setPhysPractical(id as PhysicsPracticalId);
    else setBioPractical(id as BiologyPracticalId);
  };

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

  return (
    <div className="min-h-full w-full bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-[#EDEDED]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-5">
        {/* Top Lab Console Header + 3 Main Categories */}
        <div className="flex flex-col gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  EDULAB VIRTUAL LABORATORY
                </span>
                <span>·</span>
                <span>{activeMeta.code}</span>
                {profile?.curriculum && (
                  <>
                    <span>·</span>
                    <span>{String(profile.curriculum).toUpperCase()} TRACK</span>
                  </>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
                {activeMeta.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                {activeMeta.objective}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div
                className="inline-flex p-1 rounded-xl bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10"
                role="tablist"
                aria-label="EduLab Categories"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === 'chemistry'}
                  onClick={() => setActiveCategory('chemistry')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeCategory === 'chemistry'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <FlaskConical className="w-4 h-4" />
                  <span>Chemistry Lab</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === 'physics'}
                  onClick={() => setActiveCategory('physics')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeCategory === 'physics'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <Atom className="w-4 h-4" />
                  <span>Physics Lab</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === 'biology'}
                  onClick={() => setActiveCategory('biology')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeCategory === 'biology'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <Dna className="w-4 h-4" />
                  <span>Biology Lab</span>
                </button>
              </div>

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('library')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Textbooks</span>
                </button>
              )}
            </div>
          </div>

          {/* 5 Practical Selector Tabs for Active Category */}
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Lab Practicals">
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
        </div>

        {/* Active Practical Lab Workspace */}
        {activeCategory === 'chemistry' && (
          <ChemistryLabView
            practicalId={chemPractical}
            formula={activeMeta.formula}
            onRecordTrial={handleRecordTrial}
          />
        )}
        {activeCategory === 'physics' && (
          <PhysicsLabView
            practicalId={physPractical}
            formula={activeMeta.formula}
            onRecordTrial={handleRecordTrial}
          />
        )}
        {activeCategory === 'biology' && (
          <BiologyLabView
            practicalId={bioPractical}
            formula={activeMeta.formula}
            onRecordTrial={handleRecordTrial}
          />
        )}

        {/* Shared Persistent Lab Notebook & CSV Export */}
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
                    <tr key={trial.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                      <td className="py-2 pr-3 text-slate-400">{activeLabTrials.length - idx}</td>
                      <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{trial.timestamp}</td>
                      <td className="py-2 pr-3 font-sans text-slate-700 dark:text-slate-300">{trial.inputsSummary}</td>
                      <td className="py-2 pr-3 font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{trial.primaryReading}</td>
                      <td className="py-2 pr-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{trial.secondaryReading}</td>
                      <td className="py-2 pr-3 font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{trial.derivedMetric}</td>
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
      </div>
    </div>
  );
}
