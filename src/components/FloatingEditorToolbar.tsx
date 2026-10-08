import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Bold, 
  Italic, 
  Play, 
  ChevronDown, 
  Sparkles,
  Volume2
} from 'lucide-react';
import { triggerCapsuleFeedback } from '../lib/feedback';

export type TextStylePreset = 'Style 01' | 'Style 02' | 'Style 03' | 'Style 04';
export type TextAlignment = 'left' | 'center' | 'right';

interface FloatingEditorToolbarProps {
  currentStyle?: TextStylePreset;
  onStyleChange?: (style: TextStylePreset) => void;
  alignment?: TextAlignment;
  onAlignmentChange?: (align: TextAlignment) => void;
  isBold?: boolean;
  onToggleBold?: () => void;
  isItalic?: boolean;
  onToggleItalic?: () => void;
  onActionTrigger?: () => void;
  actionTooltip?: string;
  className?: string;
}

const STYLE_OPTIONS: { id: TextStylePreset; label: string; description: string }[] = [
  { id: 'Style 01', label: 'Style 01', description: 'Body Serif' },
  { id: 'Style 02', label: 'Style 02', description: 'Heading Sans' },
  { id: 'Style 03', label: 'Style 03', description: 'Blockquote' },
  { id: 'Style 04', label: 'Style 04', description: 'Code Monospace' },
];

export function FloatingEditorToolbar({
  currentStyle = 'Style 01',
  onStyleChange,
  alignment = 'left',
  onAlignmentChange,
  isBold = false,
  onToggleBold,
  isItalic = false,
  onToggleItalic,
  onActionTrigger,
  actionTooltip = 'Play audio / AI summarize',
  className = '',
}: FloatingEditorToolbarProps) {
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsStyleDropdownOpen(false);
      }
    };
    if (isStyleDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStyleDropdownOpen]);

  return (
    <div className={`relative z-30 select-none ${className}`}>
      {/* Ambient glass shadow aura */}
      <div className="absolute -inset-1 bg-gradient-to-r from-brand-500/15 via-purple-500/10 to-indigo-500/15 rounded-full blur-md opacity-60 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: -6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 liquid-glass-dock rounded-full border border-white/60 dark:border-white/10 shadow-xl backdrop-blur-2xl text-stone-700 dark:text-stone-200"
      >
        {/* Specular top rim highlight */}
        <div className="absolute top-0 inset-x-3 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full" />

        {/* 1. Style Drop-Down Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              triggerCapsuleFeedback({ pitch: 580, volume: 0.14, hapticDuration: 10 });
              setIsStyleDropdownOpen(prev => !prev);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-900/10 dark:bg-white/10 hover:bg-stone-900/15 dark:hover:bg-white/15 transition-colors cursor-pointer"
            title="Select Text Style Preset"
          >
            <span>{currentStyle}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isStyleDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isStyleDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-2 w-40 rounded-2xl liquid-glass-dock border border-white/80 dark:border-stone-800 shadow-2xl p-1.5 z-50 text-xs backdrop-blur-2xl"
              >
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      triggerCapsuleFeedback({ pitch: 620, volume: 0.15, hapticDuration: 12 });
                      onStyleChange?.(opt.id);
                      setIsStyleDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer ${
                      currentStyle === opt.id 
                        ? 'bg-brand-600 text-white font-semibold' 
                        : 'hover:bg-black/5 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[10px] opacity-70">{opt.description}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-[1px] h-4 bg-stone-300/60 dark:bg-stone-700/60 mx-0.5" />

        {/* 2. Text Alignment Icons */}
        <div className="flex items-center bg-black/5 dark:bg-white/5 p-0.5 rounded-full">
          <button
            type="button"
            onClick={() => {
              triggerCapsuleFeedback({ pitch: 520, volume: 0.12, hapticDuration: 8 });
              onAlignmentChange?.('left');
            }}
            className={`p-1.5 rounded-full transition-all cursor-pointer ${
              alignment === 'left' 
                ? 'bg-white dark:bg-stone-800 text-brand-600 dark:text-brand-400 shadow-sm' 
                : 'opacity-70 hover:opacity-100'
            }`}
            title="Align Left"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerCapsuleFeedback({ pitch: 560, volume: 0.12, hapticDuration: 8 });
              onAlignmentChange?.('center');
            }}
            className={`p-1.5 rounded-full transition-all cursor-pointer ${
              alignment === 'center' 
                ? 'bg-white dark:bg-stone-800 text-brand-600 dark:text-brand-400 shadow-sm' 
                : 'opacity-70 hover:opacity-100'
            }`}
            title="Align Center"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerCapsuleFeedback({ pitch: 600, volume: 0.12, hapticDuration: 8 });
              onAlignmentChange?.('right');
            }}
            className={`p-1.5 rounded-full transition-all cursor-pointer ${
              alignment === 'right' 
                ? 'bg-white dark:bg-stone-800 text-brand-600 dark:text-brand-400 shadow-sm' 
                : 'opacity-70 hover:opacity-100'
            }`}
            title="Align Right"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-[1px] h-4 bg-stone-300/60 dark:bg-stone-700/60 mx-0.5" />

        {/* 3. Bold (B) & Italic (I) Typography Toggles */}
        <button
          type="button"
          onClick={() => {
            triggerCapsuleFeedback({ pitch: 580, volume: 0.14, hapticDuration: 10 });
            onToggleBold?.();
          }}
          className={`px-2 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
            isBold 
              ? 'bg-brand-600 text-white shadow-sm' 
              : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-80 hover:opacity-100'
          }`}
          title="Toggle Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            triggerCapsuleFeedback({ pitch: 620, volume: 0.14, hapticDuration: 10 });
            onToggleItalic?.();
          }}
          className={`px-2 py-1 rounded-full text-xs font-serif italic font-bold transition-all cursor-pointer ${
            isItalic 
              ? 'bg-brand-600 text-white shadow-sm' 
              : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-80 hover:opacity-100'
          }`}
          title="Toggle Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-stone-300/60 dark:bg-stone-700/60 mx-0.5" />

        {/* 4. Action / Play Trigger Button */}
        <button
          type="button"
          onClick={() => {
            triggerCapsuleFeedback({ pitch: 720, volume: 0.18, hapticDuration: 14 });
            onActionTrigger?.();
          }}
          className="p-1.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/25 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          title={actionTooltip}
        >
          <Play className="w-3 h-3 fill-current ml-0.5" />
        </button>
      </motion.div>
    </div>
  );
}
