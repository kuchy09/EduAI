import React from 'react';
import { 
  Users, 
  UserPlus, 
  Sparkles, 
  BookOpen, 
  MessageSquare, 
  ArrowRight,
  Brain,
  GraduationCap,
  Atom,
  Sigma
} from 'lucide-react';

interface ChatEmptyStateProps {
  onOpenFindContacts: () => void;
  onOpenNewGroup?: () => void;
  onOpenDocumentShare?: () => void;
  onOpenSharedNotes?: () => void;
  onOpenAIHelp?: () => void;
  onSelectConversation?: (id: string) => void;
}

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({
  onOpenFindContacts,
  onOpenNewGroup,
  onOpenSharedNotes,
  onOpenAIHelp,
  onSelectConversation
}) => {
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0b1115] overflow-y-auto p-4 sm:p-8 select-none">
      <div className="max-w-3xl mx-auto my-auto w-full py-6 space-y-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Hero Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Student Study Hub • 480+ Active Learners</span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight">
            Edu AI Study Lounge
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Collaborate with peers, solve problem sets together, share textbook takeaways, or get 24/7 help from the Edu AI Study Coach.
          </p>
        </div>

        {/* 4 Feature Launch Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Card 1: Start a Study Room */}
          <button
            onClick={onOpenNewGroup || onOpenFindContacts}
            className="p-5 rounded-2xl bg-white dark:bg-[#152026] border border-slate-200/80 dark:border-slate-800 text-left hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Start Study Room</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Create a subject room for class discussions, homework review, and lab prep.
              </p>
            </div>
          </button>

          {/* Card 2: Find Classmates & Teachers */}
          <button
            onClick={onOpenFindContacts}
            className="p-5 rounded-2xl bg-white dark:bg-[#152026] border border-slate-200/80 dark:border-slate-800 text-left hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <UserPlus className="w-5 h-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Find Classmates</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Connect with verified STEM scholars, instructors, and study partners.
              </p>
            </div>
          </button>

          {/* Card 3: Consult Edu AI Study Coach */}
          <button
            onClick={onOpenAIHelp}
            className="p-5 rounded-2xl bg-white dark:bg-[#152026] border border-purple-200/80 dark:border-purple-900/60 text-left hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Ask AI Study Coach</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Get step-by-step formula derivations, concept breakdowns, and test prep.
              </p>
            </div>
          </button>

          {/* Card 4: Shared Book Takeaways */}
          <button
            onClick={onOpenSharedNotes || onOpenFindContacts}
            className="p-5 rounded-2xl bg-white dark:bg-[#152026] border border-slate-200/80 dark:border-slate-800 text-left hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Shared Takeaways</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Review peer notes, textbook syntheses, and annotated study summaries.
              </p>
            </div>
          </button>
        </div>

        {/* Featured Active Study Rooms List */}
        {onSelectConversation && (
          <div className="bg-white dark:bg-[#152026] p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-indigo-500" />
                Featured Active Study Rooms
              </span>
              <span className="text-[11px] text-slate-400">Click to enter discussion</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div
                onClick={() => onSelectConversation('conv-group-physics')}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3 cursor-pointer transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-base shrink-0 shadow-2xs">
                  ⚡
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    Physics & Mechanics Hub
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Alliance High & Moi Girls • Lab Prep
                  </div>
                </div>
              </div>

              <div
                onClick={() => onSelectConversation('conv-group-math')}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3 cursor-pointer transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center text-base shrink-0 shadow-2xs">
                  📐
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    Pure Math & Calculus Circle
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Olympiad Proofs & Derivatives
                  </div>
                </div>
              </div>

              <div
                onClick={() => onSelectConversation('conv-marop')}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3 cursor-pointer transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-base shrink-0 shadow-2xs">
                  👨‍🎓
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    Marop Majok
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Senior Secondary STEM Scholar
                  </div>
                </div>
              </div>

              <div
                onClick={() => onSelectConversation('conv-meta-ai')}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3 cursor-pointer transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-600 text-white flex items-center justify-center text-base shrink-0 shadow-2xs">
                  🤖
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    Edu AI Assistant
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    24/7 Intelligent Academic Mentor
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pedagogical Note / Quote */}
        <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 text-center text-xs text-slate-500 dark:text-slate-400">
          💡 <span className="font-semibold text-slate-700 dark:text-slate-300">Feynman Technique:</span> The highest retention happens when you explain concepts in simple terms to peer study partners.
        </div>

      </div>
    </div>
  );
};
