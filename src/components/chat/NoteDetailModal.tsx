import React, { useState } from 'react';
import { 
  X, BookOpen, Users, Lock, Globe, UserCheck, 
  Calendar, Tag, MessageSquare, Edit3, Trash2, 
  Share2, Check, ArrowRight, ShieldCheck, Sparkles,
  Download, Copy, ExternalLink
} from 'lucide-react';
import { SharedBookNote, ChatUser } from './types';
import { canUserEditNote } from './sharedNotesService';

interface NoteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: SharedBookNote | null;
  currentUser: ChatUser;
  onEditNote: (note: SharedBookNote) => void;
  onDeleteNote: (noteId: string) => void;
  onShareToChat?: (note: SharedBookNote) => void;
}

export const NoteDetailModal: React.FC<NoteDetailModalProps> = ({
  isOpen,
  onClose,
  note,
  currentUser,
  onEditNote,
  onDeleteNote,
  onShareToChat
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'takeaways' | 'collaborators'>('takeaways');

  if (!isOpen || !note) return null;

  const currentUserId = currentUser?.id || 'current-user-id';
  const canEdit = canUserEditNote(note, currentUserId);
  const keyTakeaways = Array.isArray(note.keyTakeaways) ? note.keyTakeaways : [];
  const tags = Array.isArray(note.tags) ? note.tags : [];
  const collaborators = Array.isArray(note.collaborators) ? note.collaborators : [];

  const handleCopyNote = () => {
    const textToCopy = `*${note.title}*\nBook: ${note.bookTitle} (${note.bookAuthor || ''})\n\nKey Takeaways:\n${keyTakeaways.map(k => `• ${k}`).join('\n')}\n\nSynthesis Notes:\n${note.content || ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
              note.permissionType === 'group'
                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                : note.permissionType === 'individual'
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                : note.permissionType === 'public'
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              {note.permissionType === 'group' && <Users className="w-3 h-3" />}
              {note.permissionType === 'individual' && <UserCheck className="w-3 h-3" />}
              {note.permissionType === 'public' && <Globe className="w-3 h-3" />}
              {note.permissionType === 'private' && <Lock className="w-3 h-3" />}
              <span>{note.permissionType} Access</span>
            </span>

            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {canEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEditNote(note);
                }}
                className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Edit Takeaways"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

            {(note.authorId === currentUserId || currentUser?.role === 'teacher') && (
              <button
                onClick={() => {
                  if (confirm('Delete this shared takeaway note?')) {
                    onDeleteNote(note.id);
                    onClose();
                  }
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="Delete note"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Main Title & Book Header Card */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-slate-800/60 border border-indigo-100 dark:border-slate-700/80 flex items-start gap-4">
            <div className="w-12 h-16 rounded-lg bg-indigo-600 text-white flex flex-col items-center justify-center p-1 text-center shrink-0 shadow-sm">
              <BookOpen className="w-5 h-5 mb-0.5" />
              <span className="text-[8px] font-bold uppercase leading-none">Book</span>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                {note.title}
              </h2>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 font-semibold mt-0.5">
                {note.bookTitle} {note.bookAuthor ? `• ${note.bookAuthor}` : ''}
              </p>
              {note.chapterOrPage && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  📖 {note.chapterOrPage}
                </p>
              )}
            </div>
          </div>

          {/* Author & Tabs Switcher */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden">
                {note.authorAvatar && !note.authorAvatar.includes('unsplash.com') ? (
                  <img
                    src={note.authorAvatar}
                    alt={note.authorName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{String(note.authorName || 'EA').slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{note.authorName}</span>
                  <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">
                    · {note.authorRole}
                  </span>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Note author</p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('takeaways')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'takeaways'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Takeaways ({keyTakeaways.length})
              </button>
              <button
                onClick={() => setActiveTab('collaborators')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'collaborators'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Peers ({collaborators.length})
              </button>
            </div>
          </div>

          {/* TAB 1: Key Takeaways & Content */}
          {activeTab === 'takeaways' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Key Takeaways & Core Concepts
                </h3>
                
                <div className="space-y-2.5">
                  {keyTakeaways.map((takeaway, idx) => (
                    <div 
                      key={idx} 
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-3"
                    >
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        {idx + 1}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                        {takeaway}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {note.content && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Synthesis & Study Notes
                  </h3>
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed font-sans">
                    {note.content}
                  </div>
                </div>
              )}

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-2">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  {tags.map(t => (
                    <span 
                      key={t}
                      className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Collaborators & Permissions */}
          {activeTab === 'collaborators' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800 flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-300">
                <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                <div>
                  <p className="font-bold">Active Permission Level: {(note.permissionType || 'group').toUpperCase()}</p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    {note.permissionType === 'group'
                      ? 'Shared across assigned study circles and classrooms. Group members can view and collaborate.'
                      : note.permissionType === 'individual'
                      ? 'Shared exclusively with selected peers and instructors listed below.'
                      : note.permissionType === 'public'
                      ? 'Accessible to all students and educators across the Edu AI community.'
                      : 'Private personal revision notes only visible to you.'}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Collaborator Roster ({collaborators.length})
                </h4>
                <div className="space-y-2">
                  {collaborators.map(c => (
                    <div 
                      key={c.userId} 
                      className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold text-xs">
                          {c.userName ? c.userName.charAt(0) : 'U'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {c.userName || 'Learner'} {c.userId === currentUserId ? '(You)' : ''}
                          </p>
                          <p className="text-[10px] text-slate-400 capitalize">
                            {c.userRole || 'Learner'}
                          </p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        c.permission === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                          : c.permission === 'edit'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {c.permission} access
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between shrink-0">
          <button
            onClick={handleCopyNote}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Takeaways!' : 'Copy Summary'}</span>
          </button>

          <div className="flex items-center gap-2">
            {onShareToChat && (
              <button
                onClick={() => {
                  onShareToChat(note);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share in Chat</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
