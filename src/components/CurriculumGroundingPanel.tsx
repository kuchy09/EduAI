import React, { useState } from 'react';
import { BookOpen, ChevronDown, Layers, Sparkles } from 'lucide-react';
import type { CurriculumSourceReference, GroundingMode } from '../types';

interface CurriculumGroundingPanelProps {
  groundingMode?: GroundingMode;
  sources?: CurriculumSourceReference[];
  compact?: boolean;
}

export function CurriculumGroundingPanel({
  groundingMode,
  sources = [],
  compact = false,
}: CurriculumGroundingPanelProps) {
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  if (!groundingMode && sources.length === 0) {
    return null;
  }

  const effectiveMode: GroundingMode =
    groundingMode || (sources.length > 0 ? 'curriculum_grounded' : 'general_ai');

  const modeMeta =
    effectiveMode === 'curriculum_grounded'
      ? {
          icon: <BookOpen className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />,
          title: 'Curriculum-Grounded',
          detail: `${sources.length} prescribed textbook ${sources.length === 1 ? 'reference' : 'references'}`,
          accentText: 'text-emerald-800 dark:text-emerald-300',
        }
      : effectiveMode === 'mixed'
      ? {
          icon: <Layers className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />,
          title: 'Mixed Grounding',
          detail: 'Syllabus reference combined with general AI explanation',
          accentText: 'text-amber-800 dark:text-amber-300',
        }
      : {
          icon: <Sparkles className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />,
          title: 'General AI Explanation',
          detail: 'No matching textbook excerpt retrieved for this query',
          accentText: 'text-slate-600 dark:text-slate-300',
        };

  return (
    <div
      className={`${
        compact ? 'pt-2 mt-2 space-y-1.5' : 'pt-3 mt-1 space-y-2'
      } border-t border-[#E2DDD3] dark:border-[#26313A]`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {modeMeta.icon}
          <span className={`text-[11px] font-semibold tracking-tight ${modeMeta.accentText}`}>
            {modeMeta.title}
          </span>
          <span aria-hidden="true" className="text-slate-400 text-[11px]">
            ·
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {modeMeta.detail}
          </span>
        </div>
      </div>

      {sources.length > 0 && (
        <div className="space-y-1.5">
          {sources.map((src, idx) => {
            const isExpanded = expandedSourceId === src.id;
            const pageLabel = src.pageRange || `p. ${src.pageNumber}`;
            const contextLine = [
              src.publisher,
              src.chapterTitle,
              src.subTopicTitle,
              src.isKicdApproved ? 'KICD Approved' : null,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <div
                key={src.id}
                className="rounded-lg bg-[#FAF8F4] dark:bg-[#11161A] border border-[#E2DDD3] dark:border-[#26313A]"
              >
                <button
                  type="button"
                  onClick={() => setExpandedSourceId(isExpanded ? null : src.id)}
                  className={`w-full flex items-start justify-between gap-2 text-left cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors ${
                    compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
                  }`}
                  title={isExpanded ? 'Hide textbook excerpt' : 'View retrieved textbook excerpt'}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="font-mono tabular-nums text-[10px] text-slate-400 shrink-0">
                        [{idx + 1}]
                      </span>
                      <span
                        className={`${
                          compact ? 'text-[11px]' : 'text-xs'
                        } font-semibold text-slate-800 dark:text-slate-100 truncate`}
                      >
                        {src.bookTitle}
                      </span>
                    </div>
                    {contextLine && (
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate pl-5 mt-0.5">
                        {contextLine}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <span className="font-mono tabular-nums text-[11px] font-medium text-brand-700 dark:text-brand-300 whitespace-nowrap">
                      {pageLabel}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {isExpanded && src.excerpt && (
                  <div
                    className={`${
                      compact ? 'px-2.5 pb-2 pt-1 text-[10.5px]' : 'px-3 pb-2.5 pt-1.5 text-[11.5px]'
                    } border-t border-[#E2DDD3]/70 dark:border-[#26313A]/80 text-slate-600 dark:text-slate-300 leading-relaxed select-text`}
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      Retrieved passage:{' '}
                    </span>
                    {src.excerpt}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
