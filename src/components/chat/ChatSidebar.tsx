import React, { useState, useMemo } from 'react';
import {
  Search,
  UserPlus,
  Users,
  Check,
  X,
  MessageSquare,
  Clock,
  ShieldCheck,
  GraduationCap,
  RefreshCw,
} from 'lucide-react';
import { ChatUser, Conversation, FriendRequestRecord } from './types';
import { AvatarBadge } from './AvatarBadge';

interface ChatSidebarProps {
  currentUser: ChatUser;
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (convId: string) => void;
  onStartDirectChat: (partnerId: string) => void;
  users: ChatUser[];
  friendRequests?: FriendRequestRecord[];
  onSendFriendRequest?: (userId: string) => void;
  onAcceptFriendRequest: (senderId: string) => void;
  onDeclineFriendRequest: (senderId: string) => void;
  onCancelFriendRequest: (targetId: string) => void;
  onOpenFindFriends: () => void;
  onOpenCreateGroup: () => void;
  onRefreshDirectory?: () => void;
  socialError?: string | null;
  typingByConversation?: Record<string, string[]>;
  isWsConnected?: boolean;
}

type SidebarTab = 'all' | 'friends' | 'requests' | 'groups';

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  currentUser,
  conversations,
  activeConversationId,
  onSelectConversation,
  onStartDirectChat,
  users,
  friendRequests = [],
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onCancelFriendRequest,
  onOpenFindFriends,
  onOpenCreateGroup,
  onRefreshDirectory,
  socialError = null,
  typingByConversation = {},
  isWsConnected = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SidebarTab>('all');

  const incomingRequests = useMemo(() => {
    return users.filter((u) => u.id !== currentUser.id && u.friendStatus === 'pending_received');
  }, [users, currentUser.id]);

  const outgoingRequests = useMemo(() => {
    return users.filter((u) => u.id !== currentUser.id && u.friendStatus === 'pending_sent');
  }, [users, currentUser.id]);

  const connectedFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users
      .filter((u) => u.id !== currentUser.id && u.friendStatus === 'friends')
      .filter((u) => {
        if (!q) return true;
        return `${u.name} ${u.institution} ${u.title} ${u.subjects.join(' ')}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return a.name.localeCompare(b.name);
      });
  }, [users, currentUser.id, searchQuery]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations
      .filter((conv) => {
        if (activeTab === 'groups' && conv.type !== 'group') return false;
        if (activeTab === 'friends' && conv.type !== 'direct') return false;

        if (!q) return true;
        if (conv.type === 'group') {
          return (
            (conv.name || '').toLowerCase().includes(q) ||
            (conv.description || '').toLowerCase().includes(q) ||
            (conv.lastMessage?.content || '').toLowerCase().includes(q)
          );
        }
        const partnerId = conv.participants.find((id) => id !== currentUser.id);
        const partner = users.find((u) => u.id === partnerId);
        return (
          (partner?.name || '').toLowerCase().includes(q) ||
          (partner?.email || '').toLowerCase().includes(q) ||
          (partner?.institution || '').toLowerCase().includes(q) ||
          (partner?.subjects || []).join(' ').toLowerCase().includes(q) ||
          (conv.lastMessage?.content || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [conversations, activeTab, searchQuery, currentUser.id, users]);

  const matchingDirectoryPeers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || activeTab === 'groups' || activeTab === 'requests') return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const existingDmPartnerIds = new Set(
      filteredConversations
        .filter((c) => c.type === 'direct')
        .map((c) => c.participants.find((id) => id !== currentUser.id))
        .filter(Boolean) as string[]
    );
    return users
      .filter((u) => {
        if (u.id === currentUser.id) return false;
        if (existingDmPartnerIds.has(u.id)) return false;
        if (activeTab === 'friends' && u.friendStatus !== 'friends') return false;
        const emailLower = (u.email || '').toLowerCase();
        const emailHandle = emailLower.includes('@') ? emailLower.split('@')[0] : '';
        const roleKeywords =
          u.role === 'teacher' || u.role === 'educator'
            ? 'teacher educator faculty'
            : u.role === 'admin'
            ? 'admin administrator'
            : 'student scholar learner';
        const hay = `${u.name || ''} ${emailLower} ${emailHandle} ${u.phone || ''} ${u.institution || ''} ${u.title || ''} ${(u.subjects || []).join(' ')} ${u.bio || ''} ${u.location || ''} ${roleKeywords}`.toLowerCase();
        return hay.includes(q) || (tokens.length > 0 && tokens.every((tok) => hay.includes(tok)));
      })
      .slice(0, 12);
  }, [users, currentUser.id, searchQuery, activeTab, filteredConversations]);

  const formatListTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const now = new Date();
    const isSameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (isSameDay) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const findRequestNote = (userId: string) => {
    const found = friendRequests.find(
      (r) =>
        r.status === 'pending' &&
        ((r.senderId === userId && r.receiverId === currentUser.id) ||
          (r.senderId === currentUser.id && r.receiverId === userId))
    );
    return found?.note;
  };

  const totalPendingCount = incomingRequests.length;

  return (
    <aside className="w-full md:w-80 lg:w-[348px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shrink-0 select-none overflow-hidden">
      {/* Top Bar — pt-16 sm:pt-[72px] clears the floating top-left navigation button */}
      <div className="px-4 pt-16 sm:pt-[72px] pb-3 border-b border-slate-200/80 dark:border-slate-800 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
                Messages
              </h1>
              <span
                title={isWsConnected ? 'Real-time WebSocket active' : 'Syncing over HTTPS'}
                className={`text-[11px] font-medium ${
                  isWsConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                }`}
              >
                {isWsConnected ? '· Live' : ''}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {connectedFriends.length} {connectedFriends.length === 1 ? 'connection' : 'connections'} ·{' '}
              {conversations.filter((c) => c.type === 'group').length} groups
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenCreateGroup}
              className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              title="Create Study Group"
              aria-label="Create Study Group"
            >
              <Users className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={onOpenFindFriends}
              className="h-10 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Find Classmates & Educators"
            >
              <UserPlus className="w-4 h-4" />
              <span>Find</span>
            </button>
          </div>
        </div>

        {/* Search Field */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats, classmates, subjects..."
            className="w-full h-10 pl-10 pr-8 bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-indigo-500/40 focus:bg-white dark:focus:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Segmented Filter Bar */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'friends', label: 'Friends' },
              { id: 'requests', label: 'Requests', badge: totalPendingCount },
              { id: 'groups', label: 'Groups' },
            ] as Array<{ id: SidebarTab; label: string; badge?: number }>
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-2">
        {/* REQUESTS TAB */}
        {activeTab === 'requests' ? (
          <div className="space-y-4 px-1">
            {/* Incoming */}
            <div>
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Incoming Requests ({incomingRequests.length})
                </h2>
              </div>
              {incomingRequests.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No pending friend requests right now.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {incomingRequests.map((reqUser) => {
                    const note = findRequestNote(reqUser.id);
                    return (
                      <div
                        key={reqUser.id}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <AvatarBadge
                            name={reqUser.name}
                            avatarUrl={reqUser.avatar}
                            role={reqUser.role}
                            isOnline={reqUser.status === 'online'}
                            size="md"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {reqUser.name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {reqUser.role === 'admin' ? 'Platform Admin' : reqUser.role === 'teacher' || reqUser.role === 'educator' ? 'Educator' : 'Student'} · {reqUser.institution}
                            </p>
                            {note && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 italic">
                                “{note}”
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onAcceptFriendRequest(reqUser.id)}
                            className="flex-1 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeclineFriendRequest(reqUser.id)}
                            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Outgoing */}
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 mb-2">
                Sent Requests ({outgoingRequests.length})
              </h2>
              {outgoingRequests.length === 0 ? (
                <p className="text-xs text-slate-400 px-1">No outgoing requests.</p>
              ) : (
                <div className="space-y-2">
                  {outgoingRequests.map((reqUser) => (
                    <div
                      key={reqUser.id}
                      className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AvatarBadge
                          name={reqUser.name}
                          avatarUrl={reqUser.avatar}
                          role={reqUser.role}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {reqUser.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Pending approval
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onCancelFriendRequest(reqUser.id)}
                        className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Compact Incoming Request Notice Banner in All Tab */}
            {activeTab === 'all' && incomingRequests.length > 0 && (
              <div className="p-2.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/70 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-indigo-950 dark:text-indigo-100 truncate">
                    {incomingRequests.length}{' '}
                    {incomingRequests.length === 1 ? 'friend request waiting' : 'friend requests waiting'}
                  </p>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300 truncate">
                    From {incomingRequests[0].name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className="h-8 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                >
                  Review
                </button>
              </div>
            )}

            {/* Quick Start DM list in Friends Tab */}
            {activeTab === 'friends' && (
              <div className="space-y-1 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 pt-1">
                  Connected Peers ({connectedFriends.length})
                </p>
                {connectedFriends.length === 0 ? (
                  <div className="p-4 text-center space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No connected friends yet.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenFindFriends}
                      className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Find Classmates
                    </button>
                  </div>
                ) : (
                  connectedFriends.map((friend) => (
                    <button
                      type="button"
                      key={friend.id}
                      onClick={() => onStartDirectChat(friend.id)}
                      className="w-full p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AvatarBadge
                          name={friend.name}
                          avatarUrl={friend.avatar}
                          role={friend.role}
                          isOnline={friend.status === 'online'}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {friend.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {friend.status === 'online' ? 'Active now' : friend.title}
                          </p>
                        </div>
                      </div>
                      <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Error Banner if directory failed to load */}
            {socialError && users.length === 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  Directory sync paused
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  {socialError}
                </p>
                {onRefreshDirectory && (
                  <button
                    type="button"
                    onClick={onRefreshDirectory}
                    className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry Sync</span>
                  </button>
                )}
              </div>
            )}

            {/* Matching Directory Members when typing a search query */}
            {matchingDirectoryPeers.length > 0 && (
              <div className="space-y-1.5 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between px-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    People Directory ({matchingDirectoryPeers.length})
                  </p>
                  <button
                    type="button"
                    onClick={onOpenFindFriends}
                    className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                  >
                    View all
                  </button>
                </div>
                {matchingDirectoryPeers.map((peer) => (
                  <div
                    key={peer.id}
                    className="p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AvatarBadge
                        name={peer.name}
                        avatarUrl={peer.avatar}
                        role={peer.role}
                        isOnline={peer.status === 'online'}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {peer.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {peer.email || peer.institution || peer.title}
                        </p>
                      </div>
                    </div>
                    {peer.friendStatus === 'friends' ? (
                      <button
                        type="button"
                        onClick={() => onStartDirectChat(peer.id)}
                        className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Chat</span>
                      </button>
                    ) : peer.friendStatus === 'pending_received' ? (
                      <button
                        type="button"
                        onClick={() => onAcceptFriendRequest(peer.id)}
                        className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Accept</span>
                      </button>
                    ) : peer.friendStatus === 'pending_sent' ? (
                      <button
                        type="button"
                        onClick={() => onCancelFriendRequest(peer.id)}
                        className="h-7 px-2.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold shrink-0 cursor-pointer"
                      >
                        Pending
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (onSendFriendRequest) {
                            onSendFriendRequest(peer.id);
                          } else {
                            onOpenFindFriends();
                          }
                        }}
                        className="h-7 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-950/60 dark:hover:bg-indigo-600 dark:text-indigo-300 dark:hover:text-white border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Connect</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Conversation Threads */}
            {filteredConversations.length === 0 ? (
              matchingDirectoryPeers.length > 0 ? null : (
                <div className="py-12 px-4 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {activeTab === 'groups'
                        ? 'No study groups yet'
                        : searchQuery
                        ? 'No matching members or chats'
                        : 'No active conversations'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {activeTab === 'groups'
                        ? 'Create a study group to collaborate on textbooks and shared notes.'
                        : 'Search the directory to send friend requests and start chatting with peers.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={activeTab === 'groups' ? onOpenCreateGroup : onOpenFindFriends}
                    className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {activeTab === 'groups' ? 'New Study Group' : 'Find Friends'}
                  </button>
                </div>
              )
            ) : (
              <div className="space-y-1">
                {filteredConversations.map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  const isGroup = conv.type === 'group';
                  const partnerId = !isGroup
                    ? conv.participants.find((id) => id !== currentUser.id)
                    : undefined;
                  const partner = partnerId ? users.find((u) => u.id === partnerId) : undefined;

                  const title = isGroup ? conv.name || 'Study Group' : partner?.name || 'Academic Peer';
                  const typingNames = typingByConversation[conv.id] || [];
                  const isTyping = typingNames.length > 0;

                  const previewText = isTyping
                    ? `${typingNames[0]} is typing...`
                    : conv.lastMessage?.content
                    ? conv.lastMessage.content
                    : isGroup
                    ? `${conv.participants.length} members · Ready for discussion`
                    : partner?.friendStatus === 'friends'
                    ? 'Connected · Start your conversation'
                    : 'Connection pending';

                  const timeDisplay = formatListTime(conv.lastMessage?.createdAt || conv.updatedAt);

                  return (
                    <button
                      type="button"
                      key={conv.id}
                      onClick={() => onSelectConversation(conv.id)}
                      className={`w-full p-2.5 rounded-2xl flex items-center gap-3 text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/70'
                          : 'border border-transparent hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {isGroup ? (
                        <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 font-bold text-sm">
                          <Users className="w-5 h-5" />
                        </div>
                      ) : (
                        <AvatarBadge
                          name={title}
                          avatarUrl={partner?.avatar}
                          role={partner?.role}
                          isOnline={partner?.status === 'online'}
                          size="md"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`text-xs font-bold truncate ${
                                isActive
                                  ? 'text-indigo-950 dark:text-white'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {title}
                            </span>
                            {!isGroup && (partner?.role === 'teacher' || partner?.role === 'educator' || partner?.role === 'admin') && (
                              <span title={partner?.role === 'admin' ? 'Platform Admin' : 'Verified Educator'} className="shrink-0 flex items-center">
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                            {timeDisplay}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p
                            className={`text-xs truncate ${
                              isTyping
                                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                : conv.unreadCount > 0
                                ? 'text-slate-900 dark:text-slate-100 font-semibold'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {previewText}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold tabular-nums flex items-center justify-center shrink-0">
                              {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
