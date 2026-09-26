import React, { useState } from 'react';
import { 
  Search, Plus, MoreVertical, ChevronDown, Check, CheckCheck, 
  UserPlus, Sparkles, Filter, X, Users, MessageSquarePlus, 
  Settings, BookOpen, Star, BellOff, User, Pin, Compass, Lightbulb
} from 'lucide-react';
import { ChatUser, Conversation, UserRole, UserNote } from './types';

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
  filterTab?: 'all' | 'direct' | 'teachers' | 'students' | 'groups';
  setFilterTab?: (tab: 'all' | 'direct' | 'teachers' | 'students' | 'groups') => void;
}

const DEFAULT_PEER_NOTES = [
  { id: 'pn-1', userId: 'user-marop', name: 'Marop', focus: 'Mechanics & Newton 3rd ⚡', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', convId: 'conv-marop' },
  { id: 'pn-2', userId: 'user-ifrah', name: 'Ifrah', focus: 'Genetics & Punnett squares 🧬', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', convId: 'conv-ifrah' },
  { id: 'pn-3', userId: 'user-moossy', name: 'Mðøssŷ', focus: 'Calculus epsilon-delta proofs 📐', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', convId: 'conv-moossy' },
  { id: 'pn-4', userId: 'user-saphira', name: 'Saphira', focus: 'African post-colonial essays 📖', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80', convId: 'conv-saphira' },
];

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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'groups' | 'direct' | 'favourites'>('all');
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [myStudyStatus, setMyStudyStatus] = useState(() => {
    try {
      return localStorage.getItem('eduai_my_study_focus') || 'Reviewing CBC Syllabus & Physics 📚';
    } catch (_) {
      return 'Reviewing CBC Syllabus & Physics 📚';
    }
  });
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [tempStatus, setTempStatus] = useState(myStudyStatus);
  const [imgFailedMap, setImgFailedMap] = useState<Record<string, boolean>>({});

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

  const getInitials = (name?: string) => {
    if (!name) return 'ED';
    return name
      .split(' ')
      .map(n => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleSaveStatus = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = tempStatus.trim() || 'Studying on Edu AI 📖';
    setMyStudyStatus(updated);
    try {
      localStorage.setItem('eduai_my_study_focus', updated);
    } catch (_) {}
    setIsEditingStatus(false);
  };

  // Calculate total unread count across all conversations
  const totalUnreadCount = (conversations || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  // Filter conversations based on search and active filter
  const filteredConversations = (conversations || []).filter(conv => {
    const partner = getPartner(conv);
    const title = conv.type === 'group' ? conv.name || '' : partner?.name || '';
    const lastMsg = conv.lastMessage?.content || '';
    
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lastMsg.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'unread') {
      return (conv.unreadCount || 0) > 0;
    }
    if (activeFilter === 'groups') {
      return conv.type === 'group';
    }
    if (activeFilter === 'direct') {
      return conv.type === 'direct';
    }
    if (activeFilter === 'favourites') {
      return conv.isPinned || partner?.role === 'teacher';
    }
    return true; // 'all'
  });

  return (
    <div className="w-full h-full bg-white dark:bg-[#111b21] text-slate-900 dark:text-white border-r border-slate-200/80 dark:border-slate-800 flex flex-col shrink-0 select-none min-w-0 font-sans">
      
      {/* 1. TOP HEADER: "Chats & Study Rooms" + Actions */}
      <div className="px-4 py-3.5 flex items-center justify-between bg-white dark:bg-[#111b21] border-b border-slate-100 dark:border-slate-800/80 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Chats & Groups</span>
          </h1>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Student Collaboration Hub</p>
        </div>

        <div className="flex items-center gap-1.5 relative">
          {/* Shared Notes Header Button */}
          {onOpenSharedNotes && (
            <button
              onClick={onOpenSharedNotes}
              className="w-8.5 h-8.5 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer relative"
              title="Shared Book Takeaways & Notes"
            >
              <BookOpen className="w-4.5 h-4.5" />
              {sharedNotesCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-2xs">
                  {sharedNotesCount > 9 ? '9+' : sharedNotesCount}
                </span>
              )}
            </button>
          )}

          {/* 3-dots Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowMenuDropdown(prev => !prev)}
              className="w-8.5 h-8.5 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="More options"
            >
              <MoreVertical className="w-4.5 h-4.5" />
            </button>

            {/* Menu Dropdown */}
            {showMenuDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenuDropdown(false)} 
                />
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-[#1a2730] rounded-xl shadow-xl border border-slate-200/80 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => {
                      setShowMenuDropdown(false);
                      onOpenNewGroupModal();
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>New Study Group</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenuDropdown(false);
                      onOpenFindFriends();
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Find Classmates & Teachers</span>
                  </button>
                  {onOpenSharedNotes && (
                    <button
                      onClick={() => {
                        setShowMenuDropdown(false);
                        onOpenSharedNotes();
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Shared Book Takeaways</span>
                    </button>
                  )}
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <button
                    onClick={() => {
                      setShowMenuDropdown(false);
                      setIsEditingStatus(true);
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span>Update Study Focus</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* New Chat Button */}
          <button
            onClick={onOpenFindFriends}
            className="w-8.5 h-8.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
            title="Start New Discussion"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* 2. PEER STUDY FOCUS BUBBLE BAR */}
      <div className="px-3.5 py-2.5 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/60 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-3 min-w-max">
          {/* User's own focus bubble */}
          <div 
            onClick={() => setIsEditingStatus(true)}
            className="flex flex-col items-center gap-1 cursor-pointer group shrink-0"
            title="Click to update your study status"
          >
            <div className="relative">
              <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-indigo-500 to-purple-500">
                <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center">
                  {currentUser.avatar && !imgFailedMap['me'] ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      onError={() => setImgFailedMap(prev => ({ ...prev, me: true }))}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {getInitials(currentUser.name)}
                    </span>
                  )}
                </div>
              </div>
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs">
                +
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 max-w-[54px] truncate">
              Your Focus
            </span>
          </div>

          {/* Classmates' focus bubbles */}
          {DEFAULT_PEER_NOTES.map((peer) => (
            <div
              key={peer.id}
              onClick={() => onSelectConversation(peer.convId)}
              className="flex flex-col items-center gap-1 cursor-pointer group shrink-0"
              title={`${peer.name}: ${peer.focus}`}
            >
              <div className="relative">
                <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-emerald-400 to-teal-500 group-hover:scale-105 transition-transform">
                  <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center">
                    {peer.avatar && !imgFailedMap[peer.id] ? (
                      <img
                        src={peer.avatar}
                        alt={peer.name}
                        onError={() => setImgFailedMap(prev => ({ ...prev, [peer.id]: true }))}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {getInitials(peer.name)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-[#111b21]" />
              </div>
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 max-w-[54px] truncate">
                {peer.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. SEARCH BAR */}
      <div className="px-3.5 pt-2.5 pb-1.5 shrink-0">
        <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/60 rounded-xl flex items-center gap-2.5 border border-transparent focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search classmate, study room, or message..."
            className="bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none w-full min-w-0"
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

      {/* 4. FILTER SEGMENTED BUTTONS ROW */}
      <div className="px-3.5 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 border-b border-slate-100 dark:border-slate-800/40">
        {[
          { key: 'all', label: 'All' },
          { key: 'groups', label: 'Study Rooms', icon: Users },
          { key: 'direct', label: 'Direct', icon: User },
          { key: 'unread', label: `Unread (${totalUnreadCount || 0})` },
          { key: 'favourites', label: 'Pinned', icon: Pin },
        ].map((tab) => {
          const isActive = activeFilter === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {Icon && <Icon className="w-3 h-3" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 5. CONVERSATIONS LIST */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 select-none">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <p className="text-sm font-semibold">No discussions found</p>
            <p className="text-xs">Try adjusting your search or join a study room.</p>
            <button
              onClick={onOpenFindFriends}
              className="mt-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Find Classmates
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
            const timeDisplay = conv.updatedAt || '12:00 PM';
            const hasVoice = lastMsg?.attachment?.type === 'voice';
            const hasNote = lastMsg?.attachment?.type === 'note';
            const hasCode = lastMsg?.attachment?.type === 'code';
            const hasBook = lastMsg?.attachment?.type === 'book';

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`px-3.5 py-3 flex items-center gap-3 cursor-pointer transition-colors relative ${
                  isSelected
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-l-3 border-indigo-600'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                {/* Left: Avatar with Status */}
                <div className="relative shrink-0">
                  {isGroup ? (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg shadow-2xs font-bold">
                      {conv.groupAvatar || '👥'}
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                      {partner?.avatar && !imgFailedMap[partner.id] ? (
                        <img
                          src={partner.avatar}
                          alt={title}
                          onError={() => setImgFailedMap(prev => ({ ...prev, [partner.id]: true }))}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {getInitials(title)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Online Indicator */}
                  {!isGroup && partner?.status === 'online' && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-[#111b21]" />
                  )}
                </div>

                {/* Center: Title & Last Message preview */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {title}
                      </h2>
                      {conv.isPinned && (
                        <Pin className="w-3 h-3 text-indigo-500 shrink-0" />
                      )}
                      {!isGroup && partner?.role === 'teacher' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 shrink-0">
                          Teacher
                        </span>
                      )}
                    </div>
                    
                    {/* Timestamp */}
                    <span className={`text-[11px] font-medium shrink-0 ml-1.5 ${
                      unread > 0 
                        ? 'text-indigo-600 dark:text-indigo-400 font-bold' 
                        : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {timeDisplay}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    {/* Message Preview snippet */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 min-w-0">
                      {isSentByMe && (
                        <CheckCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0 inline-block" />
                      )}
                      {hasVoice && <span className="text-indigo-500 shrink-0">🎙️ Voice Note</span>}
                      {hasNote && <span className="text-purple-500 shrink-0">📝 Study Note</span>}
                      {hasCode && <span className="text-blue-500 shrink-0">💻 Formula / Code</span>}
                      {hasBook && <span className="text-amber-500 shrink-0">📖 Textbook</span>}
                      {!hasVoice && !hasNote && !hasCode && !hasBook && (
                        <span className="truncate">
                          {lastMsg?.content || 'No messages yet'}
                        </span>
                      )}
                    </p>

                    {/* Unread Counter Badge */}
                    {unread > 0 && (
                      <span className="min-w-[18px] h-4.5 px-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 shadow-xs ml-1">
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

      {/* Edit Study Status Modal */}
      {isEditingStatus && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a2730] rounded-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                What are you studying right now?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Your study status lets classmates know what subjects or chapters you're active on.
              </p>
            </div>

            <form onSubmit={handleSaveStatus} className="space-y-3">
              <input
                type="text"
                value={tempStatus}
                onChange={(e) => setTempStatus(e.target.value)}
                placeholder="e.g. Solving Physics Mechanics Chapter 4 ⚡"
                maxLength={60}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />

              <div className="flex items-center gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingStatus(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
