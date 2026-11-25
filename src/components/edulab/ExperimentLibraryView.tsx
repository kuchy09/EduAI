import React, { useState, useMemo } from 'react';
import {
  Search,
  FlaskConical,
  Atom,
  Dna,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import {
  LabCategory,
  LabExperimentId,
  LabTrialRecord,
  PRACTICALS_CATALOG,
} from './edulabTypes';

interface ExperimentLibraryViewProps {
  trials: LabTrialRecord[];
  exploredIds: LabExperimentId[];
  onLaunchPractical: (category: LabCategory, id: LabExperimentId) => void;
}

export function ExperimentLibraryView({
  trials,
  exploredIds,
  onLaunchPractical,
}: ExperimentLibraryViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | LabCategory>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRACTICALS_CATALOG.filter((item) => {
      if (filter !== 'all' && item.category !== filter) return false;
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.objective.toLowerCase().includes(q) ||
        item.formula.toLowerCase().includes(q)
      );
    });
  }, [query, filter]);

  const filterButtons: Array<{ key: 'all' | LabCategory; label: string; count: number }> = [
    { key: 'all', label: 'All Labs', count: PRACTICALS_CATALOG.length },
    {
      key: 'chemistry',
      label: 'Chemistry',
      count: PRACTICALS_CATALOG.filter((p) => p.category === 'chemistry').length,
    },
    {
      key: 'physics',
      label: 'Physics',
      count: PRACTICALS_CATALOG.filter((p) => p.category === 'physics').length,
    },
    {
      key: 'biology',
      label: 'Biology',
      count: PRACTICALS_CATALOG.filter((p) => p.category === 'biology').length,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Search and Discipline Filter Toolbar */}
      <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search practicals, formulas, or apparatus..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setFilter(btn.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === btn.key
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                  : 'bg-white dark:bg-[#18181a] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {btn.label} ({btn.count})
            </button>
          ))}
        </div>
      </div>

      {/* Experiment Catalog Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#18181a] border border-dashed border-slate-200 dark:border-white/10 rounded-2xl py-12 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No practicals matched "{query}". Try clearing the search filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const isExplored = exploredIds.includes(item.id);
            const trialCount = trials.filter((t) => t.experiment === item.id).length;
            const CategoryIcon =
              item.category === 'chemistry'
                ? FlaskConical
                : item.category === 'physics'
                ? Atom
                : Dna;
            const iconTint =
              item.category === 'chemistry'
                ? 'text-indigo-600 dark:text-indigo-400'
                : item.category === 'physics'
                ? 'text-sky-600 dark:text-sky-400'
                : 'text-emerald-600 dark:text-emerald-400';

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <CategoryIcon className={`w-3.5 h-3.5 ${iconTint}`} />
                      <span>{item.category}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {isExplored && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      <span>
                        {isExplored ? 'Explored' : 'New'} · {trialCount} trials
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                      {item.label}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.objective}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-nowrap">
                    {item.formula}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onLaunchPractical(item.category, item.id)}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-indigo-600 hover:border-indigo-600 hover:text-white text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Open Experiment</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
