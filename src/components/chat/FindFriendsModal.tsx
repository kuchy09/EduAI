import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  UserPlus,
  Clock,
  Check,
  MessageSquare,
  Send,
  UserMinus,
  Loader2,
} from 'lucide-react';
import { ChatUser } from './types';
import { AvatarBadge } from './AvatarBadge';

interface FindFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: ChatUser[];
  currentUser: ChatUser;
  onSendRequest: (userId: string, note?: string) => Promise<void> | void;
  onAcceptRequest: (userId: string) => Promise<void> | void;
  onDeclineRequest: (userId: string) => Promise<void> | void;
  onCancelRequest: (userId: string) => Promise<void> | void;
  onStartChat: (userId: string) => Promise<void> | void;
  isLoading?: boolean;
}

export const FindFriendsModal: React.FC<FindFriendsModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onSendRequest,
  onAcceptRequest,
  onDeclineRequest,
  onCancelRequest,
  onStartChat,
  isLoading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'student' | 'friends' | 'pending'>('all');
  const [noteTarget, setNoteTarget] = useState<ChatUser | null>(null);
  const [noteText, setNoteText] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const otherUsers = useMemo(
    () => users.filter((u) => u.id !== currentUser.id),
    [users, currentUser.id]
  );

  const pendingCount = useMemo(
    () => otherUsers.filter((u) => u.friendStatus === 'pending_received').length,
    [otherUsers]
  );

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return otherUsers.filter((u) => {
      if (roleFilter === 'teacher' && u.role !== 'teacher') return false;
      if (roleFilter === 'student' && u.role !== 'student') return false;
      if (roleFilter === 'friends' && u.friendStatus !== 'friends') return false;
      if (roleFilter === 'pending' && u.friendStatus !== 'pending_received' && u.friendStatus !== 'pending_sent') {
        return false;
      }
      if (!q) return true;
      const hay = `${u.name} ${u.email} ${u.institution} ${u.title} ${u.bio} ${(u.subjects || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [otherUsers, roleFilter, searchQuery]);

  if (!isOpen) return null;

  const runAction = async (userId: string, fn: () => Promise<void> | void) => {
    try {
      setBusyUserId(userId);
      await fn();
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88dvh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight font-display">
              Connect with Scholars & Educators
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Send friend requests to unlock direct chats and study groups
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close directory modal"
            className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Tabs */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, subject (Physics, Calculus), or institution..."
              className="w-full h-10 pl-10 pr-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Requests', badge: pendingCount },
                { id: 'friends', label: 'Friends' },
                { id: 'student', label: 'Students' },
                { id: 'teacher', label: 'Educators' },
              ] as Array<{ id: typeof roleFilter; label: string; badge?: number }>
            ).map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setRoleFilter(tab.id)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  roleFilter === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Inline Request Note Composer if selected */}
        {noteTarget && (
          <div className="px-6 py-4 bg-indigo-50/70 dark:bg-indigo-950/30 border-b border-indigo-200/70 dark:border-indigo-900/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-indigo-950 dark:text-indigo-100">
                Include an intro note for {noteTarget.name}
              </p>
              <button
                type="button"
                onClick={() => setNoteTarget(null)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={`Hi ${noteTarget.name}, let's study together on Edu AI!`}
                className="flex-1 h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                type="button"
                onClick={async () => {
                  const target = noteTarget;
                  const note = noteText;
                  setNoteTarget(null);
                  setNoteText('');
                  await runAction(target.id, () => onSendRequest(target.id, note));
                }}
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </div>
        )}

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {isLoading ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading academic directory...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                No matching accounts found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Registered classmates and educators appear here automatically once they sign in. Try clearing your filter.
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isBusy = busyUserId === user.id;
              return (
                <div
                  key={user.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <AvatarBadge
                      name={user.name}
                      avatarUrl={user.avatar}
                      role={user.role}
                      isOnline={user.status === 'online'}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {user.name}
                        </p>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          · {user.role === 'teacher' ? 'Educator' : 'Student'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                        {user.title} · {user.institution}
                      </p>
                      {user.subjects?.length > 0 && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1">
                          {user.subjects.slice(0, 3).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Connection Actions */}
                  <div className="flex items-center gap-2 shrink-0 sm:ml-2">
                    {user.friendStatus === 'friends' ? (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => runAction(user.id, () => onStartChat(user.id))}
                          className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Message
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => runAction(user.id, () => onCancelRequest(user.id))}
                          className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                          title="Remove connection"
                          aria-label={`Remove ${user.name}`}
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </>
                    ) : user.friendStatus === 'pending_received' ? (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => runAction(user.id, () => onAcceptRequest(user.id))}
                          className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => runAction(user.id, () => onDeclineRequest(user.id))}
                          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Decline
                        </button>
                      </>
                    ) : user.friendStatus === 'pending_sent' ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runAction(user.id, () => onCancelRequest(user.id))}
                        className="h-9 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Cancel Request</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setNoteTarget(user);
                          setNoteText('');
                        }}
                        className="h-9 px-3.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-950/60 dark:hover:bg-indigo-600 dark:text-indigo-300 dark:hover:text-white border border-indigo-200 dark:border-indigo-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        <span>Add Friend</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
