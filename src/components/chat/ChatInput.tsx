import React, { useState, useRef } from 'react';
import { 
  Send, Smile, Paperclip, Mic, BookOpen, 
  Code, X, Sparkles, Sigma, Atom, FileText, Check
} from 'lucide-react';
import { mockBooks } from '../../data';
import { ChatAttachment } from './types';

interface ChatInputProps {
  onSendMessage: (content: string, attachment?: ChatAttachment) => void;
  disabled?: boolean;
  disabledReason?: string;
  onSendFriendRequest?: () => void;
  onOpenSharedNotes?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  disabledReason,
  onSendFriendRequest,
  onOpenSharedNotes
}) => {
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [formulaTitle, setFormulaTitle] = useState('Newton\'s 2nd Law & Acceleration');
  const [formulaCode, setFormulaCode] = useState('F_net = m * a\nv = u + a * t\ns = u*t + 0.5*a*(t**2)');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [activeAttachment, setActiveAttachment] = useState<ChatAttachment | null>(null);

  const timerRef = useRef<any>(null);

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const handleStopRecording = (send: boolean) => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    if (send && recordingTime > 0) {
      onSendMessage(`🎙️ Voice Note (${recordingTime}s)`, {
        type: 'voice',
        name: `Audio_Note_${Date.now()}.m4a`,
        duration: recordingTime,
        url: '#'
      });
    }
    setRecordingTime(0);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!text.trim() && !activeAttachment) || disabled) return;

    onSendMessage(text.trim(), activeAttachment || undefined);
    setText('');
    setActiveAttachment(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttachFormula = () => {
    if (!formulaCode.trim()) return;
    setActiveAttachment({
      type: 'code',
      language: 'latex',
      name: formulaTitle.trim() || 'formula_step.tex',
      codeSnippet: formulaCode.trim()
    });
    setShowFormulaModal(false);
  };

  const emojis = ['👍', '❤️', '💡', '📚', '👏', '🔥', '✨', '🎓', '😮', '🙌', '💯', '🔬', '📐', '⚡'];

  if (disabled) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {disabledReason || 'Connect with this student or teacher to message directly.'}
        </p>
        {onSendFriendRequest && (
          <button
            onClick={onSendFriendRequest}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Send Study Connection Request
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 bg-white dark:bg-[#111b21] border-t border-slate-200/80 dark:border-slate-800 shrink-0 relative">
      
      {/* Quick Study Action Pills Row */}
      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setShowBookPicker(true)}
          className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
        >
          <BookOpen className="w-3 h-3 text-indigo-500" />
          <span>Quote Book</span>
        </button>

        <button
          type="button"
          onClick={() => setShowFormulaModal(true)}
          className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
        >
          <Sigma className="w-3 h-3 text-purple-500" />
          <span>Formula / Code</span>
        </button>

        {onOpenSharedNotes && (
          <button
            type="button"
            onClick={onOpenSharedNotes}
            className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Study Takeaway</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setText('Could someone break down how to solve this step-by-step? 💡');
          }}
          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
        >
          <span>"Explain Step-by-Step"</span>
        </button>
      </div>

      {/* Active Attachment Preview Banner */}
      {activeAttachment && (
        <div className="mb-2 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">
              {activeAttachment.type === 'book' ? '📖' : activeAttachment.type === 'code' ? '💻' : '📎'}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200 truncate">
                {activeAttachment.bookTitle || activeAttachment.name || 'Attachment attached'}
              </p>
              <p className="text-[10px] text-indigo-700 dark:text-indigo-300">
                {activeAttachment.bookAuthor || activeAttachment.type}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveAttachment(null)}
            className="w-6 h-6 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Book Attachment Modal Picker */}
      {showBookPicker && (
        <div className="absolute bottom-16 left-2 right-2 sm:left-4 sm:right-auto sm:w-80 bg-white dark:bg-[#1a2730] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-3 z-30 max-h-72 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700 mb-2">
            <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" /> Share Textbook Citation
            </span>
            <button onClick={() => setShowBookPicker(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {mockBooks.slice(0, 6).map(book => (
              <div
                key={book.id}
                onClick={() => {
                  setActiveAttachment({
                    type: 'book',
                    bookId: book.id,
                    bookTitle: book.title,
                    bookAuthor: book.author,
                    bookCover: book.coverImage
                  });
                  setShowBookPicker(false);
                }}
                className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-2.5 transition-colors"
              >
                <div className="w-8 h-10 bg-indigo-100 dark:bg-indigo-900 rounded flex items-center justify-center text-indigo-600 text-xs shrink-0 font-bold">
                  📖
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{book.title}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{book.author} • {book.category}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-2 sm:left-12 max-w-[calc(100vw-24px)] sm:max-w-xs bg-white dark:bg-[#1a2730] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-2.5 z-30 flex items-center gap-1.5 flex-wrap">
          {emojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                setText(prev => prev + emoji);
                setShowEmojiPicker(false);
              }}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-base hover:scale-110 transition-transform cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Attachment Options Menu */}
      {showAttachMenu && (
        <div className="absolute bottom-16 left-2 sm:left-3 bg-white dark:bg-[#1a2730] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-2 z-30 space-y-1 w-56 max-w-[calc(100vw-24px)]">
          {onOpenSharedNotes && (
            <button
              onClick={() => {
                setShowAttachMenu(false);
                onOpenSharedNotes();
              }}
              className="w-full px-3 py-2 rounded-xl bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">Collaborative Takeaway</span>
            </button>
          )}
          <button
            onClick={() => {
              setShowBookPicker(true);
              setShowAttachMenu(false);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="truncate">Share Textbook Citation</span>
          </button>
          <button
            onClick={() => {
              setShowFormulaModal(true);
              setShowAttachMenu(false);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Sigma className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="truncate">Math Formula / Code</span>
          </button>
          <button
            onClick={() => {
              setActiveAttachment({
                type: 'file',
                name: 'CBC_Physics_Form4_Notes.pdf',
                size: '2.4 MB'
              });
              setShowAttachMenu(false);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Paperclip className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">Attach Syllabus PDF</span>
          </button>
        </div>
      )}

      {/* Main Input Row */}
      {isRecording ? (
        <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-rose-500 rounded-full animate-ping shrink-0" />
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono truncate">
              Voice Note: {recordingTime}s
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => handleStopRecording(false)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => handleStopRecording(true)}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Send Voice</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Plus / Attach Action */}
          <button
            onClick={() => {
              setShowAttachMenu(prev => !prev);
              setShowEmojiPicker(false);
            }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
              showAttachMenu 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
            title="Attach Textbook, Code or Notes"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Emoji Trigger */}
          <button
            onClick={() => {
              setShowEmojiPicker(prev => !prev);
              setShowAttachMenu(false);
            }}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors shrink-0 cursor-pointer"
            title="Add Reaction / Emoji"
          >
            <Smile className="w-4.5 h-4.5" />
          </button>

          {/* Text Input */}
          <div className="flex-1 min-w-0 relative">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or discuss study topic with classmates..."
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-indigo-500/60 focus:bg-white dark:focus:bg-slate-900 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition-all"
            />
          </div>

          {/* Voice Record or Send Action */}
          {!text.trim() && !activeAttachment ? (
            <button
              onClick={handleStartRecording}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              title="Record Voice Note"
            >
              <Mic className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Formula & Code Snippet Composer Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a2730] rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sigma className="w-4 h-4 text-purple-600" /> Insert Math Formula / Code
              </span>
              <button onClick={() => setShowFormulaModal(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Formula or Concept Title
              </label>
              <input
                type="text"
                value={formulaTitle}
                onChange={(e) => setFormulaTitle(e.target.value)}
                placeholder="e.g. Kinematics Equation"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Equation / Snippet
              </label>
              <textarea
                value={formulaCode}
                onChange={(e) => setFormulaCode(e.target.value)}
                rows={4}
                placeholder="Type formula or code here..."
                className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAttachFormula}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
              >
                Attach to Message
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
