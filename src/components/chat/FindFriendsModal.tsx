import React, { useState } from 'react';
import { 
  X, Search, UserPlus, UserCheck, Clock, Check, 
  GraduationCap, BookOpen, Users, ShieldCheck, 
  MessageCircle, Sparkles, School
} from 'lucide-react';
import { ChatUser, FriendStatus, UserRole } from './types';

interface FindFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: ChatUser;
  users: ChatUser[];
  onSendFriendRequest: (userId: string) => void;
  onAcceptFriendRequest: (userId: string) => void;
  onDeclineFriendRequest: (userId: string) => void;
  onStartDirectChat: (userId: string) => void;
}

export const FindFriendsModal: React.FC<FindFriendsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onStartDirectChat
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'student' | 'pending'>('all');

  if (!isOpen) return null;

  const otherUsers = users.filter(u => u.id !== currentUser.id);

  const filteredUsers = otherUsers.filter(u => {
    const q = search.trim().toLowerCase();
    if (q) {
      const qTokens = q.split(/\s+/).filter(Boolean);
      const targetString = `${u.name} ${u.email || ''} ${u.institution} ${u.title} ${u.subjects.join(' ')} ${u.bio || ''} ${u.location || ''}`.toLowerCase();
      const matchesSearch = qTokens.every(token => targetString.includes(token)) || targetString.includes(q);
      if (!matchesSearch) return false;
    }

    if (roleFilter === 'all') return true;
    if (roleFilter === 'teacher') return u.role === 'teacher';
    if (roleFilter === 'student') return u.role === 'student';
    if (roleFilter === 'pending') return u.friendStatus === 'pending_received' || u.friendStatus === 'pending_sent';
    return true;
  });

  const pendingReceivedCount = otherUsers.filter(u => u.friendStatus === 'pending_received').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Academic Connections & Friends
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect with teachers, professors, and fellow students to start chatting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by teacher name, student, subject (e.g. Physics, Math) or school..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'all', label: 'All Contacts' },
              { id: 'teacher', label: 'Teachers & Educators 🎓' },
              { id: 'student', label: 'Students & Peers 🎒' },
              { 
                id: 'pending', 
                label: `Pending Requests ${pendingReceivedCount > 0 ? `(${pendingReceivedCount})` : ''}` 
              }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  roleFilter === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Contacts */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No contacts found</p>
              <p className="text-xs text-slate-400 mt-1">Try refining your search keyword or filters.</p>
            </div>
          ) : (
            filteredUsers.map(user => {
              const isTeacher = user.role === 'teacher';
              const relationType = currentUser.role === 'teacher' && isTeacher 
                ? 'Teacher-to-Teacher' 
                : isTeacher 
                ? 'Teacher-to-Student' 
                : currentUser.role === 'teacher' 
                ? 'Teacher-to-Student' 
                : 'Student-to-Student';

              return (
                <div key={user.id} className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="relative shrink-0 mt-0.5">
                      <img 
                        src={user.avatar} 
                        alt={user.name} 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700" 
                      />
                      {user.status === 'online' && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-0.5">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {user.name}
                        </h3>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          isTeacher 
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700' 
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                        }`}>
                          {user.role}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {relationType}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {user.title}
                      </p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <School className="w-3 h-3" />
                        <span>{user.institution}</span>
                      </p>

                      {user.subjects.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          {user.subjects.map(s => (
                            <span key={s} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Friendship Action Buttons */}
                  <div className="shrink-0 flex items-center gap-2 self-end sm:self-start mt-1">
                    {user.friendStatus === 'friends' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg">
                          <Check className="w-3.5 h-3.5" /> Friends
                        </span>
                        <button
                          onClick={() => {
                            onStartDirectChat(user.id);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1 transition-colors shadow-xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>
                      </div>
                    ) : user.friendStatus === 'pending_received' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onAcceptFriendRequest(user.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1 transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          onClick={() => onDeclineFriendRequest(user.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    ) : user.friendStatus === 'pending_sent' ? (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5" /> Requested
                      </span>
                    ) : (
                      <button
                        onClick={() => onSendFriendRequest(user.id)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs font-medium flex items-center gap-1.5 transition-colors border border-indigo-200 dark:border-indigo-800"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Connection</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500">
          Edu AI connects verified students & accredited teachers for safe academic collaboration.
        </div>
      </div>
    </div>
  );
};
