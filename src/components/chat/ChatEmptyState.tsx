import React, { useRef } from 'react';
import { FileText, UserPlus, Sparkles } from 'lucide-react';

interface ChatEmptyStateProps {
  onOpenFindContacts: () => void;
  onOpenDocumentShare?: () => void;
  onOpenAIHelp?: () => void;
}

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({
  onOpenFindContacts,
  onOpenDocumentShare,
  onOpenAIHelp,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDocumentClick = () => {
    if (onOpenDocumentShare) {
      onOpenDocumentShare();
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#f0f2f5] dark:bg-[#111b21] p-6 text-center select-none">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onOpenFindContacts();
          }
        }} 
      />

      {/* 3 Centered Actions from Screenshot */}
      <div className="flex items-center justify-center gap-8 sm:gap-12 animate-in fade-in zoom-in-95 duration-200">
        
        {/* 1. Send Document */}
        <div className="flex flex-col items-center gap-2.5 group">
          <button
            onClick={handleDocumentClick}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white dark:bg-[#202c33] border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:shadow-md flex items-center justify-center text-slate-700 dark:text-slate-200 hover:scale-105 active:scale-95 transition-all cursor-pointer group-hover:border-emerald-500/50"
            title="Send document"
          >
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8]" />
          </button>
          <span className="text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300">
            Send document
          </span>
        </div>

        {/* 2. Add Contact */}
        <div className="flex flex-col items-center gap-2.5 group">
          <button
            onClick={onOpenFindContacts}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white dark:bg-[#202c33] border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:shadow-md flex items-center justify-center text-slate-700 dark:text-slate-200 hover:scale-105 active:scale-95 transition-all cursor-pointer group-hover:border-emerald-500/50"
            title="Add contact"
          >
            <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8]" />
          </button>
          <span className="text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300">
            Add contact
          </span>
        </div>

        {/* 3. Ask Meta AI */}
        <div className="flex flex-col items-center gap-2.5 group">
          <button
            onClick={onOpenAIHelp}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white dark:bg-[#202c33] border border-purple-200/80 dark:border-purple-800/80 shadow-xs hover:shadow-md flex items-center justify-center text-purple-600 dark:text-purple-400 hover:scale-105 active:scale-95 transition-all cursor-pointer group-hover:border-purple-500"
            title="Ask Meta AI"
          >
            {/* Meta-style multi-color radial gradient ring or Sparkles */}
            <div className="relative flex items-center justify-center">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-transparent bg-gradient-to-tr from-purple-500 via-pink-500 to-indigo-500 [mask:linear-gradient(#fff_0_0)_padding-box,linear-gradient(#fff_0_0)] p-[2px] flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </button>
          <span className="text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300">
            Ask Meta AI
          </span>
        </div>

      </div>
    </div>
  );
};
