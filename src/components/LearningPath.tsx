import { Map, CheckCircle2, Circle, Sparkles, Loader2, Calendar, Target, Clock, BookOpen, ChevronRight, Layers, Award } from 'lucide-react';
import { useState, useEffect } from 'react';

interface LearningStep {
  title: string;
  status: 'completed' | 'current' | 'upcoming';
  duration: string;
  description?: string;
  concepts?: string[];
}

interface LearningPathProps {
  user: any;
}

export function LearningPath({ user }: LearningPathProps) {
  const [steps, setSteps] = useState<LearningStep[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [planMode, setPlanMode] = useState<'roadmap' | 'weekly'>('roadmap');

  const fieldOfStudy = user?.user_metadata?.field_of_study || 'General Studies';
  const subjects = user?.user_metadata?.subjects || 'core concepts';

  useEffect(() => {
    // Generate an initial default structured plan based on user's field
    setSteps([
      { 
        title: `Foundations of ${fieldOfStudy}`, 
        status: 'completed', 
        duration: '2 weeks',
        description: 'Core principles, fundamental definitions, and foundational reading modules.',
        concepts: ['Key Terminology', 'Fundamental Laws', 'Core Frameworks']
      },
      { 
        title: `Advanced Topics in ${subjects}`, 
        status: 'current', 
        duration: '3 weeks',
        description: 'In-depth conceptual breakdowns, case analyses, and textbook problem sets.',
        concepts: ['Analytical Frameworks', 'System Architecture', 'Critical Case Studies']
      },
      { 
        title: `Practical Applications & Capstone`, 
        status: 'upcoming', 
        duration: '4 weeks',
        description: 'Comprehensive evaluations, mock exam quizzes, and practical project synthesis.',
        concepts: ['Project Synthesis', 'Exam Revision', 'Review Assessments']
      },
    ]);
  }, [fieldOfStudy, subjects]);

  const generatePersonalizedPath = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const allowDataCollection = JSON.parse(localStorage.getItem('privacy_data') ?? 'true');
      
      const requestBody = allowDataCollection 
        ? {
            userStyle: "Visual learner, needs hands-on exercises",
            readingHabits: `Reads late night, studying ${fieldOfStudy} and ${subjects}`,
            currentProgress: `Finished Foundations of ${fieldOfStudy} recently.`
          }
        : {
             userStyle: "Standard",
             readingHabits: "Standard",
             currentProgress: "Standard"
          };

      const response = await fetch('/api/learning-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate learning path');
      }

      const data = await response.json();
      if (data.steps) {
        setSteps(data.steps.map((s: any) => ({
          ...s,
          description: s.description || 'Structured academic milestone designed for deep comprehension.',
          concepts: s.concepts || ['Target Competency', 'Active Recall', 'Quiz Review']
        })));
      }
    } catch (err: any) {
      setError(err.message || 'Could not generate personalized path. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const completedCount = steps.filter(s => s.status === 'completed').length;
  const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-[#EDEDED] tracking-tight">
              Study Plan & Roadmap
            </h2>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-500/30">
              Plan Mode
            </span>
          </div>
          <p className="text-slate-500 dark:text-[#A0A0A0] text-sm">
            Curated syllabus curriculum and weekly academic milestones tailored to your study cadence.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            onClick={generatePersonalizedPath}
            disabled={isGenerating}
            className="bg-brand-600 dark:bg-indigo-600/80 hover:bg-brand-700 dark:hover:bg-indigo-600 text-white rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 font-medium text-xs sm:text-sm transition-all shadow-sm cursor-pointer disabled:opacity-75"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isGenerating ? 'Analyzing...' : 'Regenerate Plan'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm border border-red-200 dark:border-red-900/40">
          {error}
        </div>
      )}

      {/* Plan Mode View Toggle & Progress Overview Contrast Block */}
      <div className="contrast-blocked-card plan-card rounded-2xl p-5 border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#262626]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-500/25">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-slate-400 dark:text-[#A0A0A0]">Plan Completion</div>
              <div className="text-lg font-bold text-slate-900 dark:text-[#EDEDED]">{completedCount} of {steps.length} Milestones Cleared ({progressPercent}%)</div>
            </div>
          </div>

          {/* Segmented Mode Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#141414] rounded-xl border border-slate-200/60 dark:border-white/10 self-start sm:self-auto">
            <button
              onClick={() => setPlanMode('roadmap')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                planMode === 'roadmap'
                  ? 'bg-white dark:bg-[#252525] text-slate-900 dark:text-[#EDEDED] shadow-xs border border-transparent dark:border-white/10'
                  : 'text-slate-500 dark:text-[#A0A0A0] hover:text-slate-800 dark:hover:text-[#EDEDED]'
              }`}
            >
              Curriculum Roadmap
            </button>
            <button
              onClick={() => setPlanMode('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                planMode === 'weekly'
                  ? 'bg-white dark:bg-[#252525] text-slate-900 dark:text-[#EDEDED] shadow-xs border border-transparent dark:border-white/10'
                  : 'text-slate-500 dark:text-[#A0A0A0] hover:text-slate-800 dark:hover:text-[#EDEDED]'
              }`}
            >
              Weekly Schedule
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="pt-4">
          <div className="w-full h-2 bg-slate-100 dark:bg-[#222222] rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 dark:bg-[#8a70d6] rounded-full transition-all duration-500" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Plan Mode Display - Contrast-Blocked Dark Cards */}
      <div className="space-y-4">
        {steps.map((step, idx) => {
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';

          return (
            <div 
              key={idx}
              className={`rounded-2xl p-5 sm:p-6 transition-all duration-200 border contrast-blocked-card ${
                isCompleted 
                  ? 'plan-card-completed bg-emerald-50/40 dark:bg-[#152219] border-emerald-200 dark:border-emerald-500/35'
                  : isCurrent 
                  ? 'plan-card-current bg-indigo-50/40 dark:bg-[#201a2f] border-indigo-200 dark:border-indigo-500/50 ring-1 ring-indigo-500/20'
                  : 'plan-card-upcoming bg-white dark:bg-[#171717] border-slate-200 dark:border-[#262626]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  {/* Status Indicator Icon */}
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/40 animate-pulse">
                        <Target className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#242424] text-slate-400 dark:text-[#8E8E93] flex items-center justify-center border border-slate-200 dark:border-[#303030]">
                        <Circle className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono tracking-wider uppercase font-bold text-slate-400 dark:text-[#A0A0A0]">
                        Milestone 0{idx + 1}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isCompleted
                          ? 'bg-emerald-100/80 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : isCurrent
                          ? 'bg-indigo-100/80 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-100 dark:bg-[#242424] text-slate-600 dark:text-[#A0A0A0]'
                      }`}>
                        {step.status}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-[#EDEDED] mt-1 tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A0A0A0] mt-1 leading-relaxed">
                      {step.description}
                    </p>

                    {/* Key Concepts Tags in Desaturated Primary / Dark Block */}
                    {step.concepts && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {step.concepts.map((concept, cIdx) => (
                          <span 
                            key={cIdx} 
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-white/80 dark:bg-[#121212] text-slate-700 dark:text-[#EDEDED] border border-slate-200/80 dark:border-white/10 font-medium"
                          >
                            {concept}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Duration and Action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-[#A0A0A0]">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-[#8E8E93]" />
                    <span>{step.duration}</span>
                  </div>

                  {isCurrent && (
                    <button className="bg-brand-600 dark:bg-indigo-600/80 hover:bg-brand-700 dark:hover:bg-indigo-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-xs">
                      <span>Active Focus</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Schedule Supplementary Card (when Plan Mode is weekly) */}
      {planMode === 'weekly' && (
        <div className="contrast-blocked-card plan-card rounded-2xl p-6 border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-[#EDEDED]">Weekly Reading & Retention Rhythm</h4>
            </div>
            <span className="text-xs text-slate-400 dark:text-[#A0A0A0]">4 Sessions / Week</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { day: 'Mon & Wed', activity: 'Chapter Deep Dive & Cornell Notes', focus: 'Deep Reading (45 mins)' },
              { day: 'Friday', activity: 'Concept Synthesis with Sage AI', focus: 'Interactive Q&A (30 mins)' },
              { day: 'Saturday', activity: 'Assessment Quiz & Spaced Repetition', focus: 'Quiz Practice (20 mins)' },
              { day: 'Sunday', activity: 'Weekly Review & Learning Path Sync', focus: 'Reflection (15 mins)' }
            ].map((slot, sIdx) => (
              <div 
                key={sIdx}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/70 dark:border-white/10"
              >
                <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wider">{slot.day}</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-[#EDEDED] mt-0.5">{slot.activity}</div>
                <div className="text-xs text-slate-500 dark:text-[#A0A0A0] mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{slot.focus}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
