import React, { useState } from 'react';
import { 
  BookOpen, Plus, Search, Filter, Users, Lock, 
  Globe, UserCheck, Sparkles, ChevronRight, Edit3,
  Calendar, Check, ShieldCheck, ArrowUpRight
} from 'lucide-react';
import { SharedBookNote, SharedNotePermission, ChatUser, Conversation } from './types';
import { canUserViewNote, canUserEditNote } from './sharedNotesService';

interface SharedNotesPanelProps {
  currentUser: ChatUser;
  notes: SharedBookNote[];
  activeConversation?: Conversation;
  onOpenCreateNote: () => void;
  onSelectNote: (note: SharedBookNote) => void;
  onEditNote: (note: SharedBookNote) => void;
  onShareNoteToChat: (note: SharedBookNote) => void;
  onClose?: () => void;
  isSidebarWidget?: boolean;
}

export const SharedNotesPanel: React.FC<SharedNotesPanelProps> = ({
  currentUser,
  notes,
  activeConversation,
  onOpenCreateNote,
  onSelectNote,
  onEditNote,
  onShareNoteToChat,
  onClose,
  isSidebarWidget = false
}) => {
  const [filter, setFilter] = useState<'all' | 'conversation' | 'group' | 'individual' | 'my_notes'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Visible notes based on permissions
  const safeNotes = Array.isArray(notes) ? notes : [];
  const currentUserId = currentUser?.id || 'current-user-id';

  const visibleNotes = safeNotes.filter(n => {
    if (!n) return false;
    // 1. Check user permission
    const hasViewPerm = canUserViewNote(n, currentUserId, activeConversation?.id);
    if (!hasViewPerm) return false;

    // 2. Search query filter
    const title = n.title || '';
    const bookTitle = n.bookTitle || '';
    const takeaways = Array.isArray(n.keyTakeaways) ? n.keyTakeaways : [];
    const tags = Array.isArray(n.tags) ? n.tags : [];
    const q = searchQuery.toLowerCase();

    const matchesSearch = 
      title.toLowerCase().includes(q) ||
      bookTitle.toLowerCase().includes(q) ||
      takeaways.some(t => (t || '').toLowerCase().includes(q)) ||
      tags.some(t => (t || '').toLowerCase().includes(q));

    if (!matchesSearch) return false;

    const allowedGroupIds = Array.isArray(n.allowedGroupIds) ? n.allowedGroupIds : [];
    const allowedUserIds = Array.isArray(n.allowedUserIds) ? n.allowedUserIds : [];

    // 3. Tab filter
    if (filter === 'conversation' && activeConversation) {
      if (activeConversation.type === 'group') {
        return allowedGroupIds.includes(activeConversation.id) || n.conversationId === activeConversation.id;
      } else {
        const participants = Array.isArray(activeConversation.participants) ? activeConversation.participants : [];
        const partnerId = participants.find(p => p !== currentUserId);
        return allowedUserIds.includes(partnerId || '') && allowedUserIds.includes(currentUserId);
      }
    }
    if (filter === 'group') {
      return n.permissionType === 'group';
    }
    if (filter === 'individual') {
      return n.permissionType === 'individual';
    }
    if (filter === 'my_notes') {
      return n.authorId === currentUserId || n.authorId === 'current-user-id';
    }

    return true; // 'all'
  });

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#111b21] text-slate-900 dark:text-white select-none">
      
      {/* Top Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              Shared Book Takeaways
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Collaborative notes & takeaways ({visibleNotes.length})
            </p>
          </div>
        </div>

        <button
          onClick={onOpenCreateNote}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Note</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3.5 pt-2.5 pb-1.5 shrink-0">
        <div className="w-full px-3 py-1.5 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl flex items-center gap-2 border border-transparent focus-within:bg-white dark:focus-within:bg-[#111b21] focus-within:border-indigo-500 transition-all">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search takeaways, books, concepts..."
            className="bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none w-full"
          />
        </div>
      </div>

      {/* Filter Tabs Chips */}
      <div className="px-3.5 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 border-b border-slate-100 dark:border-slate-800/40">
        <button
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
            filter === 'all'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All Shared
        </button>

        {activeConversation && (
          <button
            onClick={() => setFilter('conversation')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
              filter === 'conversation'
                ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            In This Chat
          </button>
        )}

        <button
          onClick={() => setFilter('group')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
            filter === 'group'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-3 h-3" />
          <span>Group Only</span>
        </button>

        <button
          onClick={() => setFilter('individual')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
            filter === 'individual'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <UserCheck className="w-3 h-3" />
          <span>Individual</span>
        </button>

        <button
          onClick={() => setFilter('my_notes')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
            filter === 'my_notes'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          My Notes
        </button>
      </div>

      {/* Notes Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {visibleNotes.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              No shared takeaways yet
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[220px] mx-auto mt-1 leading-relaxed">
              Synthesize key ideas from your textbooks and invite peers or study groups to collaborate.
            </p>
            <button
              onClick={onOpenCreateNote}
              className="mt-4 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Note</span>
            </button>
          </div>
        ) : (
          visibleNotes.map(note => {
            const isAuthor = note.authorId === currentUser.id || note.authorId === 'current-user-id';
            const canEdit = canUserEditNote(note, currentUser.id);

            return (
              <div
                key={note.id}
                onClick={() => onSelectNote(note)}
                className="group p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-[#182229] hover:bg-indigo-50/20 dark:hover:bg-[#202c33] transition-all cursor-pointer shadow-2xs hover:shadow-xs relative"
              >
                {/* Header Row: Permission badge & Date */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                      note.permissionType === 'group'
                        ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                        : note.permissionType === 'individual'
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                        : note.permissionType === 'public'
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {note.permissionType === 'group' && <Users className="w-2.5 h-2.5" />}
                      {note.permissionType === 'individual' && <UserCheck className="w-2.5 h-2.5" />}
                      {note.permissionType === 'public' && <Globe className="w-2.5 h-2.5" />}
                      {note.permissionType === 'private' && <Lock className="w-2.5 h-2.5" />}
                      <span>{note.permissionType}</span>
                    </span>

                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                      {note.bookTitle}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {/* Title */}
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {note.title}
                </h4>

                {/* Top Takeaways Snippet */}
                <div className="mt-2 space-y-1">
                  {note.keyTakeaways.slice(0, 2).map((takeaway, idx) => (
                    <p key={idx} className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1 flex items-start gap-1.5">
                      <span className="text-indigo-500 font-bold shrink-0">•</span>
                      <span>{takeaway}</span>
                    </p>
                  ))}
                  {note.keyTakeaways.length > 2 && (
                    <p className="text-[10px] text-slate-400 font-medium pl-2.5">
                      +{note.keyTakeaways.length - 2} more takeaways
                    </p>
                  )}
                </div>

                {/* Bottom Row: Collaborators & Action triggers */}
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">By <strong className="text-slate-700 dark:text-slate-300">{isAuthor ? 'You' : note.authorName}</strong></span>
                    <span>•</span>
                    <span className="text-[10px]">{note.collaborators.length} collaborator{note.collaborators.length === 1 ? '' : 's'}</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    {canEdit && (
                      <button
                        onClick={() => onEditNote(note)}
                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600"
                        title="Edit note"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onShareNoteToChat(note)}
                      className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-semibold text-[10px] hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                      title="Post into active chat conversation"
                    >
                      Share in Chat
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
