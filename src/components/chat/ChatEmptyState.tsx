import React from 'react';
import { MessageSquare, Users, UserPlus, Sparkles, Bell } from 'lucide-react';

interface ChatEmptyStateProps {
  onOpenFindFriends: () => void;
  onOpenCreateGroup: () => void;
  onOpenSharedNotes: () => void;
  onlineCount?: number;
  friendsCount?: number;
  pendingRequestsCount?: number;
}

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({
  onOpenFindFriends,
  onOpenCreateGroup,
  onOpenSharedNotes,
  onlineCount = 0,
  friendsCount = 0,
  pendingRequestsCount = 0,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-slate-50/70 dark:bg-slate-950 text-center overflow-y-auto pt-20 sm:pt-24">
      <div className="max-w-lg w-full space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white mx-auto flex items-center justify-center shadow-sm">
          <MessageSquare className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
            Academic Study Network
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Select a conversation from the left, connect with classmates and faculty educators, or start a subject study group.
          </p>
        </div>

        {/* Live Account Metrics */}
        <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{friendsCount}</p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Friends</p>
          </div>
          <div className="border-x border-slate-100 dark:border-slate-800">
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{onlineCount}</p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Online Now</p>
          </div>
          <div>
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{pendingRequestsCount}</p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Requests</p>
          </div>
        </div>

        {/* Action Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <button
            type="button"
            onClick={onOpenFindFriends}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors cursor-pointer space-y-2"
          >
            <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Find People</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {pendingRequestsCount > 0 ? `${pendingRequestsCount} pending request` : 'Connect with peers'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenCreateGroup}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors cursor-pointer space-y-2"
          >
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Study Group</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Launch a topic room
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenSharedNotes}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors cursor-pointer space-y-2"
          >
            <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Book Takeaways</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Collaborative study notes
              </p>
            </div>
          </button>
        </div>

        {pendingRequestsCount > 0 && (
          <button
            type="button"
            onClick={onOpenFindFriends}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Review {pendingRequestsCount} incoming connection request{pendingRequestsCount > 1 ? 's' : ''}</span>
          </button>
        )}
      </div>
    </div>
  );
};
