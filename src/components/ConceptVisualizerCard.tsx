import { useState } from 'react';
import { Book } from '../types';
import {
  AudiobookComplexConcept,
  AudiobookSegment,
} from '../lib/audiobookService';
import {
  BookmarkPlus,
  Check,
  Copy,
  Eye,
  GitBranch,
  Layers,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface ConceptVisualizerCardProps {
  book: Book;
  chapterTitle: string;
  segment: AudiobookSegment;
  complexConcept: AudiobookComplexConcept;
  onBookmarkConcept: () => void;
  onAskAiConcept: () => void;
  isBookmarked?: boolean;
}

function renderDiagramSvg(concept: AudiobookComplexConcept) {
  const nodes = concept.diagramNodes.slice(0, 4);
  const type = concept.diagramType;

  if (type === 'cycle' && nodes.length >= 3) {
    const cx = 210;
    const cy = 105;
    const r = 68;
    const positions = nodes.map((_, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      return {
        x: cx + Math.cos(angle) * r * 1.45,
        y: cy + Math.sin(angle) * r * 0.9,
      };
    });

    return (
      <svg viewBox="0 0 420 210" className="w-full h-48 select-none" role="img" aria-label={concept.conceptTitle}>
        <defs>
          <marker id="cycle-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 8 5 L 0 9 z" className="fill-indigo-500 dark:fill-indigo-400" />
          </marker>
        </defs>
        <ellipse
          cx={cx}
          cy={cy}
          rx={r * 1.45}
          ry={r * 0.9}
          fill="none"
          strokeDasharray="5 4"
          className="stroke-indigo-300 dark:stroke-indigo-700"
          strokeWidth="1.75"
        />
        {positions.map((pos, idx) => {
          const next = positions[(idx + 1) % positions.length];
          const midX = (pos.x + next.x) / 2;
          const midY = (pos.y + next.y) / 2;
          return (
            <line
              key={`edge-${idx}`}
              x1={pos.x}
              y1={pos.y}
              x2={midX}
              y2={midY}
              markerEnd="url(#cycle-arrow)"
              className="stroke-indigo-500/50 dark:stroke-indigo-400/50"
              strokeWidth="1.5"
            />
          );
        })}
        {nodes.map((node, idx) => {
          const pos = positions[idx];
          return (
            <g key={`node-${idx}`} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                x="-62"
                y="-22"
                width="124"
                height="44"
                rx="10"
                className="fill-white dark:fill-slate-800 stroke-indigo-300 dark:stroke-indigo-700"
                strokeWidth="1.5"
              />
              <text
                y="-4"
                textAnchor="middle"
                className="fill-slate-900 dark:fill-white text-[10px] font-bold"
              >
                {node.label.slice(0, 20)}
              </text>
              <text
                y="11"
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-300 text-[8.5px]"
              >
                {node.detail.slice(0, 24)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  if (type === 'wave-or-optics') {
    return (
      <svg viewBox="0 0 420 190" className="w-full h-44 select-none" role="img" aria-label={concept.conceptTitle}>
        <line x1="20" y1="95" x2="400" y2="95" className="stroke-slate-300 dark:stroke-slate-700" strokeDasharray="4 4" strokeWidth="1.5" />
        <ellipse cx="210" cy="95" rx="10" ry="62" className="fill-indigo-500/15 stroke-indigo-500 dark:stroke-indigo-400" strokeWidth="2" />
        {/* Incident & refracted rays */}
        <path
          d="M 45 55 L 210 55 L 365 130"
          fill="none"
          className="stroke-amber-500 dark:stroke-amber-400"
          strokeWidth="2.2"
        />
        <path
          d="M 45 55 L 210 95 L 365 130"
          fill="none"
          className="stroke-emerald-500 dark:stroke-emerald-400"
          strokeWidth="2"
        />
        <circle cx="288" cy="95" r="4" className="fill-indigo-600 dark:fill-indigo-400" />
        <text x="288" y="84" textAnchor="middle" className="fill-indigo-700 dark:fill-indigo-300 text-[9px] font-bold">
          F
        </text>
        {nodes.slice(0, 3).map((node, idx) => {
          const x = 22 + idx * 132;
          return (
            <g key={`opt-${idx}`} transform={`translate(${x}, 148)`}>
              <rect
                width="116"
                height="34"
                rx="8"
                className="fill-white dark:fill-slate-800 stroke-slate-200 dark:stroke-slate-700"
                strokeWidth="1.2"
              />
              <text x="8" y="14" className="fill-slate-900 dark:fill-white text-[9px] font-bold">
                {node.label.slice(0, 19)}
              </text>
              <text x="8" y="26" className="fill-slate-500 dark:fill-slate-300 text-[8px]">
                {node.detail.slice(0, 22)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  // Default: Sequential Process / Hierarchy / Comparison horizontal schematic
  const count = Math.max(1, Math.min(4, nodes.length));
  const cardWidth = count <= 2 ? 170 : count === 3 ? 116 : 90;
  const gap = count <= 2 ? 32 : count === 3 ? 18 : 12;
  const totalWidth = count * cardWidth + (count - 1) * gap;
  const startX = Math.max(12, (420 - totalWidth) / 2);

  return (
    <svg viewBox="0 0 420 155" className="w-full h-40 select-none" role="img" aria-label={concept.conceptTitle}>
      <defs>
        <marker id="flow-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 8 5 L 0 9 z" className="fill-indigo-500 dark:fill-indigo-400" />
        </marker>
      </defs>
      {nodes.map((node, idx) => {
        const x = startX + idx * (cardWidth + gap);
        const y = 34;
        const nextX = x + cardWidth + gap;
        return (
          <g key={`step-${idx}`}>
            {idx < count - 1 && (
              <line
                x1={x + cardWidth + 2}
                y1={y + 42}
                x2={nextX - 4}
                y2={y + 42}
                markerEnd="url(#flow-arrow)"
                className="stroke-indigo-400 dark:stroke-indigo-500"
                strokeWidth="1.8"
              />
            )}
            <rect
              x={x}
              y={y}
              width={cardWidth}
              height={84}
              rx="10"
              className="fill-white dark:fill-slate-800 stroke-indigo-200 dark:stroke-indigo-800"
              strokeWidth="1.5"
            />
            <rect
              x={x}
              y={y}
              width={cardWidth}
              height={22}
              rx="10"
              className="fill-indigo-50 dark:fill-indigo-950/70"
            />
            <text
              x={x + 8}
              y={y + 15}
              className="fill-indigo-700 dark:fill-indigo-300 text-[9px] font-bold"
            >
              {`${idx + 1}. ${(node.role || 'Stage').slice(0, 14)}`}
            </text>
            <text
              x={x + 8}
              y={y + 39}
              className="fill-slate-900 dark:fill-white text-[9.5px] font-bold"
            >
              {node.label.slice(0, count === 4 ? 13 : 18)}
            </text>
            <text
              x={x + 8}
              y={y + 55}
              className="fill-slate-600 dark:fill-slate-300 text-[8.5px]"
            >
              {node.detail.slice(0, count === 4 ? 15 : 22)}
            </text>
            <text
              x={x + 8}
              y={y + 68}
              className="fill-slate-500 dark:fill-slate-400 text-[8px]"
            >
              {node.detail.slice(count === 4 ? 15 : 22, count === 4 ? 30 : 44)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ConceptVisualizerCard({
  book,
  chapterTitle,
  segment,
  complexConcept,
  onBookmarkConcept,
  onAskAiConcept,
  isBookmarked = false,
}: ConceptVisualizerCardProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(complexConcept.visualizationPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // Clipboard blocked in some contexts
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>Complex Concept Visual Cue</span>
            <span className="text-slate-400 dark:text-slate-500">·</span>
            <span className="text-slate-500 dark:text-slate-400 truncate">
              {book.curriculum?.[0] || book.category.split(',')[0]}
            </span>
          </div>
          <h4 className="text-base sm:text-lg font-display font-bold text-slate-900 dark:text-white leading-snug">
            {complexConcept.conceptTitle}
          </h4>
          {complexConcept.complexityReason && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {complexConcept.complexityReason}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onBookmarkConcept}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              isBookmarked
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {isBookmarked ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
            <span>{isBookmarked ? 'Saved' : 'Save Concept'}</span>
          </button>
          <button
            type="button"
            onClick={onAskAiConcept}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Ask Tutor</span>
          </button>
        </div>
      </div>

      {/* Formula / Scientific Law Callout */}
      {complexConcept.formulaOrRule && (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
            Law / Formula
          </span>
          <code className="text-xs sm:text-sm font-mono font-bold text-indigo-700 dark:text-indigo-300 break-words text-right">
            {complexConcept.formulaOrRule}
          </code>
        </div>
      )}

      {/* Curriculum Diagram Schematic */}
      <div className="rounded-xl bg-slate-50/80 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 p-3">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-semibold">
            <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
            Interactive Concept Schematic ({complexConcept.diagramType})
          </span>
          <span className="truncate max-w-[200px]">{chapterTitle}</span>
        </div>

        {renderDiagramSvg(complexConcept)}

        {complexConcept.diagramNodes.length > 0 && (
          <div className="mt-2 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {complexConcept.diagramNodes.map((node, idx) => (
              <div
                key={`detail-${idx}`}
                className="text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 px-2.5 py-2"
              >
                <span className="font-semibold text-slate-900 dark:text-white block">
                  {node.label}
                </span>
                <span className="text-slate-600 dark:text-slate-300 text-[11px] leading-snug block mt-0.5">
                  {node.detail}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zero-Loss Key Facts */}
      {complexConcept.keyTakeaways.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zero-Loss Concept Facts ({segment.heading})</span>
          </div>
          <ul className="space-y-1">
            {complexConcept.keyTakeaways.map((fact, idx) => (
              <li
                key={`fact-${idx}`}
                className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 flex items-start gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dynamic Visualization Prompt Box */}
      <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Dynamic Visualization Prompt
          </span>
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            {copiedPrompt ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copiedPrompt ? 'Copied' : 'Copy Prompt'}</span>
          </button>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
          {complexConcept.visualizationPrompt}
        </p>
      </div>
    </div>
  );
}
