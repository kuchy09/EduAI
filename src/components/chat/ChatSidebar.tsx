import React, { useState } from 'react';
import { 
  Search, Plus, Users, GraduationCap, BookOpen, 
  CheckCheck, Check, Sparkles, Filter, Pin, 
  MessageSquarePlus, ShieldCheck, UserCheck
} from 'lucide-react';
import { ChatUser, Conversation, UserRole } from './types';

interface ChatSidebarProps {
  currentUser: ChatUser;
  conversations: Conversation[];
  allUsers: ChatUser[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onOpenFindFriends: () => void;
  onOpenNewGroupModal: () => void;
  onToggleUserRole: (role: UserRole) => void;
  filterTab: 'all' | 'direct' | 'teachers' | 'students' | 'groups';
  setFilterTab: (tab: 'all' | 'direct' | 'teachers' | 'students' | 'groups') => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  currentUser,
  conversations,
  allUsers,
  activeConversationId,
  onSelectConversation,
  onOpenFindFriends,
  onOpenNewGroupModal,
  onToggleUserRole,
  filterTab,
  setFilterTab
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Online friends for horizontal story bubble strip
  const onlineFriends = allUsers.filter(u => u.id !== currentUser.id && u.friendStatus === 'friends' && u.status === 'online');

  // Helper to find partner in a direct chat
  const getPartner = (conv: Conversation): ChatUser | undefined => {
    if (conv.type === 'direct') {
      const partnerId = conv.participants.find(p => p !== currentUser.id);
      return allUsers.find(u => u.id === partnerId);
    }
    return undefined;
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    const partner = getPartner(conv);
    const title = conv.type === 'group' ? conv.name || '' : partner?.name || '';
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    if (!matchesSearch) return false;

    if (filterTab === 'all') return true;
    if (filterTab === 'groups') return conv.type === 'group';
    if (filterTab === 'direct') return conv.type === 'direct';
    if (filterTab === 'teachers') {
      return conv.type === 'direct' ? partner?.role === 'teacher' : conv.groupRoleType === 'teacher-to-teacher';
    }
    if (filterTab === 'students') {
      return conv.type === 'direct' ? partner?.role === 'student' : conv.groupRoleType === 'student-to-student';
    }
    return true;
  });

  const pendingRequestsCount = allUsers.filter(u => u.friendStatus === 'pending_received').length;

  return (
    <div className="w-full md:w-80 lg:w-96 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex flex-col h-full shrink-0 select-none">
      {/* User Header & Role Switcher */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img 
                src={currentUser.avatar} 
                alt={currentUser.name} 
                className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/20"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {currentUser.name}
                </h2>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                  currentUser.role === 'teacher' 
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700' 
                    : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                }`}>
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {currentUser.institution}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Quick Role Toggle (Teacher <-> Student) */}
            <button
              onClick={() => onToggleUserRole(currentUser.role === 'teacher' ? 'student' : 'teacher')}
              title={`Switch perspective to ${currentUser.role === 'teacher' ? 'Student' : 'Teacher'}`}
              className="px-2 py-1 text-[11px] font-medium rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3 text-indigo-500" />
              <span>As {currentUser.role === 'teacher' ? 'Teacher' : 'Student'}</span>
            </button>

            {/* Find / Add Friends Modal Trigger */}
            <button
              onClick={onOpenFindFriends}
              title="Find Teachers & Students / Friend Requests"
              className="relative p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats, teachers, classmates..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Online Active Strip */}
      {onlineFriends.length > 0 && (
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-3 overflow-x-auto scrollbar-none">
          <div 
            onClick={onOpenFindFriends}
            className="flex flex-col items-center gap-1 cursor-pointer shrink-0 group"
          >
            <div className="w-11 h-11 rounded-full border-2 border-dashed border-indigo-400/60 dark:border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium truncate max-w-[48px]">Add</span>
          </div>

          {onlineFriends.map(friend => (
            <div 
              key={friend.id}
              onClick={() => {
                // Find or start conversation with this friend
                const conv = conversations.find(c => c.type === 'direct' && c.participants.includes(friend.id));
                if (conv) onSelectConversation(conv.id);
              }}
              className="flex flex-col items-center gap-1 cursor-pointer shrink-0 group"
            >
              <div className="relative">
                <img 
                  src={friend.avatar} 
                  alt={friend.name}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-500/30 group-hover:scale-105 transition-transform" 
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
              </div>
              <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium truncate max-w-[52px]">
                {friend.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Category Navigation Pills */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {[
          { id: 'all', label: 'All' },
          { id: 'teachers', label: 'Teachers 🎓' },
          { id: 'students', label: 'Students 🎒' },
          { id: 'direct', label: 'Friends' },
          { id: 'groups', label: 'Groups 👥' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id as any)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filterTab === tab.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
              <MessageSquarePlus className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No chats found</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[200px]">
              Connect with teachers or student study buddies to start messaging.
            </p>
            <button
              onClick={onOpenFindFriends}
              className="mt-4 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
            >
              Browse Directory
            </button>
          </div>
        ) : (
          filteredConversations.map(conv => {
            const isGroup = conv.type === 'group';
            const partner = getPartner(conv);
            const isActive = conv.id === activeConversationId;
            const isOnline = partner?.status === 'online';

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all ${
                  isActive 
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-l-4 border-indigo-600' 
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {isGroup ? (
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-lg shadow-sm">
                      {conv.groupAvatar || '👥'}
                    </div>
                  ) : (
                    <>
                      <img 
                        src={partner?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'} 
                        alt={partner?.name || 'User'} 
                        className="w-12 h-12 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                      />
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
                      )}
                    </>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {isGroup ? conv.name : partner?.name}
                      </h3>
                      {conv.isPinned && <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                    </div>
                    {conv.lastMessage && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                        {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Role or Group Subtitle */}
                  <div className="flex items-center gap-1.5 mb-1">
                    {isGroup ? (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {conv.groupRoleType === 'teacher-to-teacher' ? 'Faculty Circle' : 'Study Group'}
                      </span>
                    ) : (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                        partner?.role === 'teacher'
                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {partner?.role === 'teacher' ? 'Teacher' : 'Student'}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {isGroup ? `${conv.participants.length} members` : partner?.subjects?.[0] || partner?.institution}
                    </span>
                  </div>

                  {/* Message Snippet & Read Receipt */}
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate ${
                      conv.unreadCount > 0 
                        ? 'font-semibold text-slate-900 dark:text-white' 
                        : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {conv.lastMessage ? (
                        <>
                          {conv.lastMessage.senderId === currentUser.id && <span className="text-slate-400 font-normal">You: </span>}
                          {conv.lastMessage.attachment ? `[${conv.lastMessage.attachment.type === 'book' ? '📖 Book' : conv.lastMessage.attachment.type === 'voice' ? '🎙️ Voice' : '📎 File'}] ` : ''}
                          {conv.lastMessage.content}
                        </>
                      ) : (
                        <span className="italic">No messages yet</span>
                      )}
                    </p>

                    {conv.unreadCount > 0 && (
                      <span className="w-5 h-5 bg-indigo-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
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
