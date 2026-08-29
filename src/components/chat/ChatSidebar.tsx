import React, { useState } from 'react';
import { 
  Search, Plus, MoreVertical, ChevronDown, Check, CheckCheck, 
  UserPlus, Sparkles, Filter, X, Users, MessageSquarePlus, 
  Settings, BookOpen, Star, Archive, BellOff
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
  onToggleUserRole?: (role: UserRole) => void;
  filterTab?: 'all' | 'direct' | 'teachers' | 'students' | 'groups';
  setFilterTab?: (tab: 'all' | 'direct' | 'teachers' | 'students' | 'groups') => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  currentUser,
  conversations,
  allUsers,
  activeConversationId,
  onSelectConversation,
  onOpenFindFriends,
  onOpenNewGroupModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'favourites' | 'groups'>('all');
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Helper to find partner in a direct chat
  const getPartner = (conv: Conversation): ChatUser | undefined => {
    if (conv.type === 'direct') {
      const partnerId = conv.participants.find(p => p !== currentUser.id);
      return allUsers.find(u => u.id === partnerId);
    }
    return undefined;
  };

  // Calculate total unread count across all conversations
  const totalUnreadCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  // Filter conversations based on search and active filter pill
  const filteredConversations = conversations.filter(conv => {
    const partner = getPartner(conv);
    const title = conv.type === 'group' ? conv.name || '' : partner?.name || '';
    const lastMsg = conv.lastMessage?.content || '';
    
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lastMsg.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'unread') {
      return (conv.unreadCount || 0) > 0;
    }
    if (activeFilter === 'favourites') {
      return conv.isPinned || partner?.role === 'teacher';
    }
    if (activeFilter === 'groups') {
      return conv.type === 'group';
    }
    return true; // 'all'
  });

  return (
    <div className="w-full h-full bg-white dark:bg-[#111b21] text-slate-900 dark:text-white border-r border-slate-200/80 dark:border-slate-800 flex flex-col shrink-0 select-none min-w-0 font-sans">
      
      {/* 1. TOP HEADER: "Chats" + 3-dots Menu + Green New Chat Plus Button */}
      <div className="px-4 py-3.5 flex items-center justify-between bg-white dark:bg-[#111b21] border-b border-slate-100 dark:border-slate-800/60 shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Chats
        </h1>

        <div className="flex items-center gap-1.5 relative">
          {/* 3-dots Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowMenuDropdown(prev => !prev)}
              className="w-8.5 h-8.5 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Menu"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Menu Dropdown */}
            {showMenuDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenuDropdown(false)} 
                />
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-[#233138] rounded-xl shadow-xl border border-slate-200/70 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => {
                      setShowMenuDropdown(false);
                      onOpenNewGroupModal();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182229] flex items-center gap-3 cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>New group</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenuDropdown(false);
                      onOpenFindFriends();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182229] flex items-center gap-3 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Find contacts</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenuDropdown(false);
                      setActiveFilter(prev => prev === 'unread' ? 'all' : 'unread');
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182229] flex items-center gap-3 cursor-pointer"
                  >
                    <Star className="w-4 h-4 text-amber-500" />
                    <span>Starred messages</span>
                  </button>
                  <div className="my-1 border-t border-slate-200/60 dark:border-slate-700/60" />
                  <button
                    onClick={() => {
                      setShowMenuDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182229] flex items-center gap-3 cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Settings</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Green New Chat Plus Button */}
          <button
            onClick={onOpenFindFriends}
            className="w-8.5 h-8.5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
            title="New Chat / Add Contact"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* 2. SEARCH BAR: "Search or start a new chat" */}
      <div className="px-3.5 pt-2 pb-1.5 shrink-0">
        <div className="w-full px-3.5 py-2 bg-[#f0f2f5] dark:bg-[#202c33] rounded-full flex items-center gap-2.5 border border-transparent focus-within:bg-white dark:focus-within:bg-[#111b21] focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all">
          <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or start a new chat"
            className="bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none w-full min-w-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. FILTER CHIPS ROW: All | Unread 10 | Favourites | Dropdown */}
      <div className="px-3.5 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 border-b border-slate-100 dark:border-slate-800/40">
        {/* All Button */}
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer shrink-0 ${
            activeFilter === 'all'
              ? 'bg-[#d9fdd3] dark:bg-[#0a332c] text-[#008069] dark:text-[#00a884] border border-[#a8e89d] dark:border-[#144f43] font-semibold'
              : 'bg-[#f0f2f5] dark:bg-[#202c33] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          All
        </button>

        {/* Unread Button */}
        <button
          onClick={() => setActiveFilter(activeFilter === 'unread' ? 'all' : 'unread')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
            activeFilter === 'unread'
              ? 'bg-[#d9fdd3] dark:bg-[#0a332c] text-[#008069] dark:text-[#00a884] border border-[#a8e89d] dark:border-[#144f43] font-semibold'
              : 'bg-[#f0f2f5] dark:bg-[#202c33] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <span>Unread</span>
          <span className="text-[11px] font-semibold opacity-90">
            {totalUnreadCount || 10}
          </span>
        </button>

        {/* Favourites Button */}
        <button
          onClick={() => setActiveFilter(activeFilter === 'favourites' ? 'all' : 'favourites')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer shrink-0 ${
            activeFilter === 'favourites'
              ? 'bg-[#d9fdd3] dark:bg-[#0a332c] text-[#008069] dark:text-[#00a884] border border-[#a8e89d] dark:border-[#144f43] font-semibold'
              : 'bg-[#f0f2f5] dark:bg-[#202c33] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Favourites
        </button>

        {/* Filter Dropdown Button */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowFilterDropdown(prev => !prev)}
            className="w-7 h-7 rounded-full bg-[#f0f2f5] dark:bg-[#202c33] hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Filter options"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showFilterDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />
              <div className="absolute left-0 top-full mt-1 w-40 bg-white dark:bg-[#233138] rounded-xl shadow-xl border border-slate-200/70 dark:border-slate-700 py-1 z-50 animate-in fade-in zoom-in-95">
                <button
                  onClick={() => {
                    setActiveFilter('groups');
                    setShowFilterDropdown(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182229] flex items-center gap-2 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Groups only</span>
                </button>
                <button
                  onClick={() => {
                    setActiveFilter('all');
                    setShowFilterDropdown(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182229] flex items-center gap-2 cursor-pointer"
                >
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <span>Clear filters</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. CONVERSATIONS LIST */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100/70 dark:divide-slate-800/40 select-none">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500">
            <p className="text-sm font-medium">No chats found</p>
            <p className="text-xs mt-1">Try a different search or start a new chat</p>
            <button
              onClick={onOpenFindFriends}
              className="mt-3 px-4 py-1.5 bg-[#00a884] text-white text-xs font-semibold rounded-full hover:bg-[#008f6f] cursor-pointer"
            >
              Find Contacts
            </button>
          </div>
        ) : (
          filteredConversations.map(conv => {
            const partner = getPartner(conv);
            const isGroup = conv.type === 'group';
            const title = isGroup ? conv.name : partner?.name;
            const isSelected = conv.id === activeConversationId;
            const unread = conv.unreadCount || 0;
            const lastMsg = conv.lastMessage;
            const isSentByMe = lastMsg?.senderId === currentUser.id;
            const isMaggy = partner?.id === 'user-maggy' || title?.toLowerCase().includes('maggy');

            // Format time display
            const timeDisplay = conv.updatedAt || '12:00 PM';

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`px-3.5 py-3 flex items-center gap-3 cursor-pointer transition-colors relative ${
                  isSelected
                    ? 'bg-[#f0f2f5] dark:bg-[#2a3942]'
                    : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'
                }`}
              >
                {/* Left: Avatar with optional Status Circle Ring */}
                <div className="relative shrink-0">
                  {isGroup ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xl shadow-xs">
                      {conv.groupAvatar || '👥'}
                    </div>
                  ) : (
                    <div className={isMaggy ? 'p-[2px] rounded-full ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-[#111b21]' : ''}>
                      <img
                        src={partner?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                        alt={title}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    </div>
                  )}

                  {/* Online Dot (if not Maggy ring) */}
                  {!isMaggy && partner?.status === 'online' && !isGroup && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#25d366] rounded-full ring-2 ring-white dark:ring-[#111b21]" />
                  )}
                </div>

                {/* Center: Name & Last Message snippet */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h2 className="text-[15px] font-medium sm:font-semibold text-slate-900 dark:text-white truncate">
                      {title}
                    </h2>
                    
                    {/* Timestamp */}
                    <span className={`text-xs font-medium shrink-0 ml-1.5 ${
                      unread > 0 
                        ? 'text-[#00a884] dark:text-[#25d366] font-semibold' 
                        : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {timeDisplay}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    {/* Message Preview */}
                    <p className="text-[13px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 min-w-0">
                      {isSentByMe && (
                        <Check className="w-3.5 h-3.5 text-slate-400 shrink-0 inline-block" />
                      )}
                      <span className="truncate">
                        {lastMsg?.content || 'No messages yet'}
                      </span>
                    </p>

                    {/* Unread Counter Badge */}
                    {unread > 0 && (
                      <span className="min-w-[20px] h-5 px-1 bg-[#25d366] text-white text-[11px] font-bold rounded-full flex items-center justify-center shrink-0 shadow-xs ml-1">
                        {unread}
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
