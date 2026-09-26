import React, { useState } from 'react';
import { 
  Search, Plus, MoreVertical, Check, CheckCheck, 
  UserPlus, X, Users, BookOpen
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
  onOpenSharedNotes?: () => void;
  sharedNotesCount?: number;
  onToggleUserRole?: (role: UserRole) => void;
  typingConversations?: Record<string, boolean>;
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
  onOpenSharedNotes,
  sharedNotesCount = 0,
  typingConversations = {},
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);

  // Helper to find partner in a direct chat
  const currentUid = currentUser?.id || 'current-user-id';
  const getPartner = (conv: Conversation): ChatUser | undefined => {
    if (conv.type === 'direct') {
      const participants = Array.isArray(conv.participants) ? conv.participants : [];
      const partnerId = participants.find(p => p !== currentUid);
      return (allUsers || []).find(u => u.id === partnerId);
    }
    return undefined;
  };

  // Filter conversations based on search
  const filteredConversations = (conversations || []).filter(conv => {
    if (!searchQuery.trim()) return true;
    const partner = getPartner(conv);
    const title = conv.type === 'group' ? conv.name || '' : partner?.name || '';
    const lastMsg = conv.lastMessage?.content || '';
    const q = searchQuery.toLowerCase();
    
    return title.toLowerCase().includes(q) || lastMsg.toLowerCase().includes(q);
  });

  return (
    <div className="w-full h-full bg-white dark:bg-[#111b21] text-slate-900 dark:text-white border-r border-slate-200/80 dark:border-slate-800 flex flex-col shrink-0 select-none min-w-0 font-sans">
      
      {/* 1. TOP HEADER */}
      <div className="px-4 py-3.5 flex items-center justify-between bg-white dark:bg-[#111b21] border-b border-slate-100 dark:border-slate-800/60 shrink-0 min-h-[60px]">
        {isSearchOpen ? (
          <div className="flex items-center gap-2 w-full animate-in fade-in duration-150">
            <div className="flex-1 flex items-center gap-2 bg-[#f0f2f5] dark:bg-[#202c33] rounded-full px-3 py-1.5 border border-emerald-500/50">
              <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats or colleagues..."
                className="bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none w-full min-w-0"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white px-1.5 py-1 rounded cursor-pointer shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Chats
            </h1>

            <div className="flex items-center gap-1.5 relative">
              {/* Search Lens Icon Button - Placed right next to 'SharedBooks And Takeaways' icon */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className={`w-8.5 h-8.5 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  searchQuery
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Search chats"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* SharedBooks And Takeaways Icon Button */}
              {onOpenSharedNotes && (
                <button
                  onClick={onOpenSharedNotes}
                  className="w-8.5 h-8.5 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer relative"
                  title="SharedBooks And Takeaways"
                >
                  <BookOpen className="w-5 h-5" />
                  {sharedNotesCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                      {sharedNotesCount > 9 ? '9+' : sharedNotesCount}
                    </span>
                  )}
                </button>
              )}

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
                      {onOpenSharedNotes && (
                        <button
                          onClick={() => {
                            setShowMenuDropdown(false);
                            onOpenSharedNotes();
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182229] flex items-center gap-3 cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>SharedBooks And Takeaways</span>
                        </button>
                      )}
                      <div className="my-1 border-t border-slate-200/60 dark:border-slate-700/60" />
                      <button
                        onClick={() => {
                          setShowMenuDropdown(false);
                          setIsSearchOpen(true);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182229] flex items-center gap-3 cursor-pointer"
                      >
                        <Search className="w-4 h-4 text-slate-500" />
                        <span>Search chats</span>
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
          </>
        )}
      </div>

      {/* Active Search Result Indicator (if searching with query) */}
      {searchQuery && (
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
          <span>Results for "{searchQuery}" ({filteredConversations.length})</span>
          <button
            onClick={() => setSearchQuery('')}
            className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* 2. CONVERSATIONS LIST (Directly below header) */}
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
                        alt={partner?.name}
                        className="w-12 h-12 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                      />
                    </div>
                  )}
                  {partner?.status === 'online' && !isGroup && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#00a884] rounded-full ring-2 ring-white dark:ring-[#111b21]" />
                  )}
                </div>

                {/* Middle: Name & Last Message Snippet */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-[15px] text-slate-900 dark:text-white truncate">
                        {title}
                      </h3>
                      {!isGroup && partner && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                          partner.role === 'teacher' 
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' 
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        }`}>
                          {partner.role}
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] shrink-0 font-normal ${
                      unread > 0 ? 'text-[#00a884] font-semibold' : 'text-slate-400 dark:text-slate-400'
                    }`}>
                      {timeDisplay}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
                    {typingConversations[conv.id] ? (
                      <p className="truncate flex items-center gap-1.5 min-w-0 font-medium text-[#00a884] dark:text-[#00a884] animate-pulse">
                        <span className="flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-bounce" />
                        </span>
                        <span>typing...</span>
                      </p>
                    ) : (
                      <p className="truncate flex items-center gap-1 min-w-0 font-normal">
                        {isSentByMe && (
                          lastMsg?.status === 'read' ? (
                            <span title="Seen" className="inline-flex items-center">
                              <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0 inline stroke-[2.2]" />
                            </span>
                          ) : lastMsg?.status === 'delivered' ? (
                            <span title="Delivered" className="inline-flex items-center">
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400 shrink-0 inline" />
                            </span>
                          ) : (
                            <span title="Sent" className="inline-flex items-center">
                              <Check className="w-3.5 h-3.5 text-slate-400 shrink-0 inline" />
                            </span>
                          )
                        )}
                        {lastMsg?.attachment?.type === 'note' ? (
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                            📖 Shared Note: {lastMsg.attachment.name || 'Takeaways'}
                          </span>
                        ) : (
                          <span>{lastMsg?.content || 'No messages yet'}</span>
                        )}
                      </p>
                    )}

                    {/* Unread Pill Count */}
                    {unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#00a884] text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-xs">
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
