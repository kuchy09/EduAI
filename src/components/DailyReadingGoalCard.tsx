import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, Clock, BookOpen, Flame, Check, Settings2, Plus, 
  Sparkles, RotateCcw, Award, ChevronRight, CheckCircle2
} from 'lucide-react';
import { 
  DailyReadingGoal, GoalType, getDailyGoal, setDailyGoalConfig, 
  logReadingProgress, resetTodayProgress, GOAL_EVENT_NAME 
} from '../lib/readingGoal';

export function DailyReadingGoalCard() {
  const [goal, setGoal] = useState<DailyReadingGoal>(getDailyGoal);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [tempType, setTempType] = useState<GoalType>(goal.type);
  const [tempTarget, setTempTarget] = useState<number>(goal.target);
  const [customValueInput, setCustomValueInput] = useState<string>('');
  const [showLogToast, setShowLogToast] = useState<string | null>(null);

  useEffect(() => {
    const handleGoalUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<DailyReadingGoal>;
      if (customEvent.detail) {
        setGoal(customEvent.detail);
      } else {
        setGoal(getDailyGoal());
      }
    };

    window.addEventListener(GOAL_EVENT_NAME, handleGoalUpdate);
    window.addEventListener('storage', handleGoalUpdate);

    return () => {
      window.removeEventListener(GOAL_EVENT_NAME, handleGoalUpdate);
      window.removeEventListener('storage', handleGoalUpdate);
    };
  }, []);

  const currentValue = goal.type === 'time' ? goal.currentMinutes : goal.currentPages;
  const targetValue = goal.target || 1;
  const percentage = Math.min(100, Math.round((currentValue / targetValue) * 100));
  const isCompleted = currentValue >= targetValue;
  const remaining = Math.max(0, targetValue - currentValue);

  const handleOpenConfig = () => {
    setTempType(goal.type);
    setTempTarget(goal.target);
    setCustomValueInput(goal.target.toString());
    setIsConfigOpen(true);
  };

  const handleSaveConfig = () => {
    const parsedTarget = parseInt(customValueInput, 10);
    const finalTarget = !isNaN(parsedTarget) && parsedTarget > 0 ? parsedTarget : tempTarget;
    const updated = setDailyGoalConfig(tempType, finalTarget);
    setGoal(updated);
    setIsConfigOpen(false);
    triggerToast(`Goal updated to ${finalTarget} ${tempType === 'time' ? 'minutes' : 'pages'} per day!`);
  };

  const handleQuickLog = (amount: number, unit: 'minutes' | 'pages') => {
    let updated: DailyReadingGoal;
    if (unit === 'minutes') {
      updated = logReadingProgress({ minutes: amount });
      triggerToast(`+${amount} minutes logged to today's goal!`);
    } else {
      updated = logReadingProgress({ pages: amount });
      triggerToast(`+${amount} pages logged to today's goal!`);
    }
    setGoal(updated);
  };

  const handleResetToday = () => {
    const updated = resetTodayProgress();
    setGoal(updated);
    triggerToast("Today's reading log reset.");
  };

  const triggerToast = (msg: string) => {
    setShowLogToast(msg);
    setTimeout(() => {
      setShowLogToast(null);
    }, 3000);
  };

  // Helper for 7-day mini calendar
  const weekDays = (() => {
    const list = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      const record = goal.history?.[dateKey];
      const isToday = i === 0;
      const done = isToday ? isCompleted : (record?.completed ?? false);
      list.push({ dateKey, dayName, done, isToday });
    }
    return list;
  })();

  const timePresets = [10, 15, 20, 30, 45, 60];
  const pagePresets = [5, 10, 15, 20, 30, 50];

  return (
    <div id="daily-reading-goal-card" className="relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {showLogToast && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border border-slate-700 pointer-events-none whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{showLogToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 sm:p-7 border transition-all duration-300 shadow-sm relative overflow-hidden bg-white dark:bg-[#1a1a1a] scrollbar-none contrast-blocked-card plan-card [color-scheme:light] dark:[color-scheme:dark] ${
          isCompleted 
            ? 'border-emerald-300/80 dark:border-emerald-500/35 shadow-emerald-500/10 ring-1 ring-emerald-400/30' 
            : 'border-slate-200/90 dark:border-[#2a2a2a] hover:border-brand-300 dark:hover:border-indigo-500/40'
        }`}
      >

        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 relative z-10 mb-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl flex items-center justify-center transition-colors ${
              isCompleted 
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                : 'bg-brand-50 dark:bg-indigo-500/15 text-brand-600 dark:text-indigo-300 border border-brand-100 dark:border-indigo-500/25'
            }`}>
              {isCompleted ? <Award className="w-5 h-5" /> : <Target className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#EDEDED] font-display tracking-tight">
                  Daily Reading Goal
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-100 dark:bg-[#252525] text-slate-600 dark:text-[#D1D1D6] border border-transparent dark:border-white/10">
                  {goal.type === 'time' ? (
                    <><Clock className="w-3 h-3 text-slate-500 dark:text-[#A0A0A0]" /> Time</>
                  ) : (
                    <><BookOpen className="w-3 h-3 text-slate-500 dark:text-[#A0A0A0]" /> Pages</>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#A0A0A0] mt-0.5">
                {goal.type === 'time' ? 'Reading time target' : 'Page count target'} for today
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Streak Counter Badge */}
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-800/40 text-orange-700 dark:text-orange-300 text-xs font-bold shadow-xs"
              title={`${goal.streak} consecutive days meeting your reading goal`}
            >
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500 animate-pulse" />
              <span>{goal.streak} Day{goal.streak === 1 ? '' : 's'} Streak</span>
            </div>

            {/* Edit Goal Button */}
            <button
              id="edit-daily-goal-btn"
              onClick={handleOpenConfig}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252525] transition-colors border border-transparent hover:border-slate-200 dark:hover:border-white/10 cursor-pointer"
              title="Customize Goal Target & Mode"
              aria-label="Customize Reading Goal"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Display & Bar */}
        <div className="space-y-4 relative z-10">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-[#EDEDED] tracking-tight">
                {currentValue}
              </span>
              <span className="text-sm font-semibold text-slate-400 dark:text-[#8E8E93]">
                / {targetValue} {goal.type === 'time' ? 'mins' : 'pages'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                isCompleted 
                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-500/20' 
                  : 'bg-brand-50 dark:bg-indigo-500/15 text-brand-700 dark:text-indigo-300 border border-transparent dark:border-indigo-500/20'
              }`}>
                {percentage}%
              </span>
            </div>
          </div>

          {/* Progress Bar Container / Scroll Pad Track */}
          <div 
            className="relative w-full h-3 bg-slate-100 dark:bg-[#222222] rounded-full overflow-hidden p-0.5 border border-slate-200/80 dark:border-[#2e2e2e] shadow-inner"
            style={{ colorScheme: 'dark light' }}
          >
            <motion.div
              className={`h-full rounded-full transition-all duration-500 ${
                isCompleted
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm shadow-emerald-500/40'
                  : 'bg-gradient-to-r from-brand-500 dark:from-[#8a70d6] to-indigo-600 dark:to-[#7b5ecc]'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>

          {/* Motivational Status Text */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-[#A0A0A0]">
            <div className="flex items-center gap-1.5">
              {isCompleted ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    Goal achieved today! Great dedication to your study routine.
                  </span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-[#8E8E93] shrink-0" />
                  <span>
                    <strong className="text-slate-700 dark:text-[#EDEDED] font-semibold">{remaining} {goal.type === 'time' ? 'minutes' : 'pages'}</strong> remaining today to keep your streak!
                  </span>
                </>
              )}
            </div>

            {/* Quick Reset option if testing */}
            {currentValue > 0 && (
              <button
                onClick={handleResetToday}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:text-[#8E8E93] dark:hover:text-[#EDEDED] inline-flex items-center gap-1 self-start sm:self-auto hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Today
              </button>
            )}
          </div>
        </div>

        {/* Action Row: Quick Log Buttons & 7-Day Activity Strip */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#262626] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          
          {/* Quick Manual Log Buttons */}
          <div className="flex items-center flex-wrap gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider mr-1">
              Quick Log:
            </span>
            {goal.type === 'time' ? (
              <>
                <button
                  id="log-time-5m-btn"
                  onClick={() => handleQuickLog(5, 'minutes')}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-50 dark:bg-[#222222] hover:bg-brand-50 dark:hover:bg-indigo-500/15 hover:text-brand-700 dark:hover:text-indigo-300 text-slate-600 dark:text-[#EDEDED] rounded-lg border border-slate-200/80 dark:border-[#303030] hover:border-brand-200 dark:hover:border-indigo-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> 5m
                </button>
                <button
                  id="log-time-15m-btn"
                  onClick={() => handleQuickLog(15, 'minutes')}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-50 dark:bg-[#222222] hover:bg-brand-50 dark:hover:bg-indigo-500/15 hover:text-brand-700 dark:hover:text-indigo-300 text-slate-600 dark:text-[#EDEDED] rounded-lg border border-slate-200/80 dark:border-[#303030] hover:border-brand-200 dark:hover:border-indigo-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> 15m
                </button>
                <button
                  id="log-time-30m-btn"
                  onClick={() => handleQuickLog(30, 'minutes')}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-50 dark:bg-[#222222] hover:bg-brand-50 dark:hover:bg-indigo-500/15 hover:text-brand-700 dark:hover:text-indigo-300 text-slate-600 dark:text-[#EDEDED] rounded-lg border border-slate-200/80 dark:border-[#303030] hover:border-brand-200 dark:hover:border-indigo-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> 30m
                </button>
              </>
            ) : (
              <>
                <button
                  id="log-pages-2p-btn"
                  onClick={() => handleQuickLog(2, 'pages')}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-50 dark:bg-[#222222] hover:bg-brand-50 dark:hover:bg-indigo-500/15 hover:text-brand-700 dark:hover:text-indigo-300 text-slate-600 dark:text-[#EDEDED] rounded-lg border border-slate-200/80 dark:border-[#303030] hover:border-brand-200 dark:hover:border-indigo-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> 2 pgs
                </button>
                <button
                  id="log-pages-5p-btn"
                  onClick={() => handleQuickLog(5, 'pages')}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-50 dark:bg-[#222222] hover:bg-brand-50 dark:hover:bg-indigo-500/15 hover:text-brand-700 dark:hover:text-indigo-300 text-slate-600 dark:text-[#EDEDED] rounded-lg border border-slate-200/80 dark:border-[#303030] hover:border-brand-200 dark:hover:border-indigo-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> 5 pgs
                </button>
                <button
                  id="log-pages-10p-btn"
                  onClick={() => handleQuickLog(10, 'pages')}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-50 dark:bg-[#222222] hover:bg-brand-50 dark:hover:bg-indigo-500/15 hover:text-brand-700 dark:hover:text-indigo-300 text-slate-600 dark:text-[#EDEDED] rounded-lg border border-slate-200/80 dark:border-[#303030] hover:border-brand-200 dark:hover:border-indigo-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> 10 pgs
                </button>
              </>
            )}
          </div>

          {/* 7-Day Activity Mini Dots */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[10px] font-bold text-slate-400 dark:text-[#8E8E93] uppercase tracking-wider hidden md:inline">
              Past 7 Days:
            </span>
            <div className="flex items-center gap-1.5">
              {weekDays.map((d) => (
                <div 
                  key={d.dateKey} 
                  className="flex flex-col items-center gap-1"
                  title={`${d.dateKey}: ${d.done ? 'Goal Completed' : 'Incomplete'}`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-transform ${
                      d.done
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : d.isToday
                          ? 'bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 border-2 border-brand-500'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {d.done ? <Check className="w-3 h-3 stroke-[3]" /> : d.dayName}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </motion.div>

      {/* Goal Configuration Modal */}
      <AnimatePresence>
        {isConfigOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfigOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white dark:bg-[#161616]/85 dark:backdrop-blur-2xl rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-white/10 z-10 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-brand-50 dark:bg-indigo-500/15 text-brand-600 dark:text-indigo-300 border border-transparent dark:border-indigo-500/30 rounded-xl">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-[#EDEDED]">Configure Daily Goal</h3>
                    <p className="text-xs text-slate-500 dark:text-[#A0A0A0]">Choose your measurement metric and daily target</p>
                  </div>
                </div>
              </div>

              {/* Goal Type Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#8E8E93]">
                  Measurement Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTempType('time');
                      setTempTarget(20);
                      setCustomValueInput('20');
                    }}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all text-center cursor-pointer ${
                      tempType === 'time'
                        ? 'border-brand-600 dark:border-indigo-500/60 bg-brand-50/60 dark:bg-indigo-500/15 text-brand-900 dark:text-[#EDEDED] font-semibold ring-2 ring-brand-500/20'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-600 dark:text-[#A0A0A0] bg-slate-50/50 dark:bg-white/5'
                    }`}
                  >
                    <Clock className={`w-5 h-5 mb-1.5 ${tempType === 'time' ? 'text-brand-600 dark:text-indigo-400' : 'text-slate-400 dark:text-[#8E8E93]'}`} />
                    <span className="text-sm font-semibold">Time-Based</span>
                    <span className="text-[11px] text-slate-400 dark:text-[#8E8E93]">Minutes per day</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTempType('pages');
                      setTempTarget(15);
                      setCustomValueInput('15');
                    }}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all text-center cursor-pointer ${
                      tempType === 'pages'
                        ? 'border-brand-600 dark:border-indigo-500/60 bg-brand-50/60 dark:bg-indigo-500/15 text-brand-900 dark:text-[#EDEDED] font-semibold ring-2 ring-brand-500/20'
                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-600 dark:text-[#A0A0A0] bg-slate-50/50 dark:bg-white/5'
                    }`}
                  >
                    <BookOpen className={`w-5 h-5 mb-1.5 ${tempType === 'pages' ? 'text-brand-600 dark:text-indigo-400' : 'text-slate-400 dark:text-[#8E8E93]'}`} />
                    <span className="text-sm font-semibold">Page-Based</span>
                    <span className="text-[11px] text-slate-400 dark:text-[#8E8E93]">Pages per day</span>
                  </button>
                </div>
              </div>

              {/* Target Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#8E8E93]">
                  Target Presets ({tempType === 'time' ? 'Minutes' : 'Pages'})
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(tempType === 'time' ? timePresets : pagePresets).map((preset) => {
                    const isSelected = tempTarget === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setTempTarget(preset);
                          setCustomValueInput(preset.toString());
                        }}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 dark:bg-indigo-600/80 text-white border-slate-900 dark:border-indigo-500 shadow-xs'
                            : 'bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-[#EDEDED] border-slate-200 dark:border-white/10'
                        }`}
                      >
                        {preset} {tempType === 'time' ? 'mins' : 'pgs'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Target Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#8E8E93]">
                  Custom Target ({tempType === 'time' ? 'Minutes' : 'Pages'})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={customValueInput}
                    onChange={(e) => {
                      setCustomValueInput(e.target.value);
                      const parsed = parseInt(e.target.value, 10);
                      if (!isNaN(parsed) && parsed > 0) {
                        setTempTarget(parsed);
                      }
                    }}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-[#EDEDED] font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm"
                    placeholder={`Enter custom ${tempType === 'time' ? 'minutes' : 'pages'}`}
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 dark:text-[#8E8E93] uppercase">
                    {tempType === 'time' ? 'Mins' : 'Pages'}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-[#EDEDED] font-semibold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="flex-1 py-3 px-4 rounded-xl bg-brand-600 dark:bg-indigo-600/80 hover:bg-brand-700 dark:hover:bg-indigo-600 text-white font-semibold text-sm shadow-md shadow-brand-500/20 transition-all cursor-pointer"
                >
                  Save Goal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
