import React, { useState } from 'react';
import { 
  Search, Plus, TrendingUp, SquarePen, Menu, ChevronDown, 
  Camera, SlidersHorizontal, MapPin, Globe, Sparkles, 
  X, Check, Music2, ShieldCheck, UserCheck, MessageSquarePlus,
  Compass, Radio, Send, Bell
} from 'lucide-react';
import { ChatUser, Conversation, UserRole, UserNote } from './types';
import { INITIAL_NOTES } from './initialData';

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
  const [activeFilterPill, setActiveFilterPill] = useState<'primary' | 'requests' | 'general' | 'channels'>('primary');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  
  // Notes state
  const [notes, setNotes] = useState<UserNote[]>(() => {
    const saved = localStorage.getItem('eduai_chat_notes');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_NOTES;
  });

  // Note creation modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [myNoteText, setMyNoteText] = useState(notes.find(n => n.userId === 'me')?.bubbleText || '');
  const [myNoteMusic, setMyNoteMusic] = useState(notes.find(n => n.userId === 'me')?.musicOrSubject || '');
  const [myLocationOn, setMyLocationOn] = useState(false);

  // Map modal
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // Pending requests modal
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);

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

    if (activeFilterPill === 'requests') {
      return partner?.friendStatus === 'pending_received' || partner?.friendStatus === 'pending_sent';
    }
    if (activeFilterPill === 'general') {
      return conv.type === 'group' || partner?.role === 'teacher';
    }
    if (activeFilterPill === 'channels') {
      return conv.type === 'group';
    }
    return true; // Primary
  });

  const pendingRequestsCount = allUsers.filter(u => u.friendStatus === 'pending_received').length || 2;

  // Handle saving user's note
  const handleSaveMyNote = () => {
    const updatedNotes = notes.map(n => {
      if (n.userId === 'me') {
        return {
          ...n,
          bubbleText: myNoteText.trim() || 'Make this space yours...',
          musicOrSubject: myNoteMusic.trim() || undefined,
          location: myLocationOn ? 'Nairobi Hub' : 'Location off',
          createdAt: 'Just now'
        };
      }
      return n;
    });
    setNotes(updatedNotes);
    localStorage.setItem('eduai_chat_notes', JSON.stringify(updatedNotes));
    setIsNoteModalOpen(false);
  };

  const userNote = notes.find(n => n.userId === 'me') || notes[0];
  const otherNotes = notes.filter(n => n.userId !== 'me');

  return (
    <div className="w-full md:w-80 lg:w-[380px] bg-[#0b0d13] text-white border-r border-[#1e222d] flex flex-col h-full shrink-0 select-none min-w-0 font-sans">
      
      {/* 1. TOP HEADER (Instagram Direct Style) */}
      <div className="px-4 py-3 border-b border-[#1a1e28] flex items-center justify-between gap-3 bg-[#0b0d13]">
        {/* Left: Menu Icon */}
        <button 
          onClick={onOpenFindFriends}
          className="p-1.5 -ml-1 text-zinc-300 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer"
          title="Menu & Study Directory"
        >
          <div className="flex flex-col gap-1 w-5 justify-center items-start">
            <div className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-white"></span>
              <span className="w-3.5 h-0.5 bg-white rounded-full"></span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-white"></span>
              <span className="w-3.5 h-0.5 bg-white rounded-full"></span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-white"></span>
              <span className="w-3.5 h-0.5 bg-white rounded-full"></span>
            </div>
          </div>
        </button>

        {/* Center: Username + Chevron */}
        <div className="relative">
          <button 
            onClick={() => setShowAccountDropdown(prev => !prev)}
            className="flex items-center gap-1.5 text-base font-bold tracking-tight text-white hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <span>{currentUser.name || 'wolter_kuch'}</span>
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </button>

          {/* Account & Role Switcher Dropdown */}
          {showAccountDropdown && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-[#181b24] border border-[#2c3242] rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95">
              <div className="p-2 border-b border-zinc-700/60 mb-1">
                <p className="text-xs font-semibold text-white">{currentUser.name}</p>
                <p className="text-[10px] text-zinc-400 capitalize">{currentUser.role} · {currentUser.institution}</p>
              </div>
              <button
                onClick={() => {
                  onToggleUserRole(currentUser.role === 'teacher' ? 'student' : 'teacher');
                  setShowAccountDropdown(false);
                }}
                className="w-full text-left px-2.5 py-2 text-xs text-zinc-200 hover:bg-white/10 rounded-xl flex items-center justify-between transition-colors"
              >
                <span>Switch to {currentUser.role === 'teacher' ? 'Student View' : 'Teacher View'}</span>
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
              </button>
              <button
                onClick={() => {
                  onOpenFindFriends();
                  setShowAccountDropdown(false);
                }}
                className="w-full text-left px-2.5 py-2 text-xs text-zinc-200 hover:bg-white/10 rounded-xl flex items-center justify-between transition-colors"
              >
                <span>Find & Add Study Buddies</span>
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Insights & Compose Icons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMapModalOpen(true)}
            className="p-1.5 text-zinc-300 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer"
            title="Insights & Study Analytics"
          >
            <TrendingUp className="w-5 h-5" />
          </button>
          <button 
            onClick={onOpenFindFriends}
            className="p-1.5 text-zinc-300 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer"
            title="New Chat / Find Friends"
          >
            <SquarePen className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. SEARCH BAR ("Search or ask Meta AI / Edu AI") */}
      <div className="px-4 py-2.5">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3.5 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or ask Meta AI"
            className="w-full pl-10 pr-9 py-2 bg-[#1b1f2b] text-sm text-white placeholder:text-zinc-400 rounded-full border border-transparent focus:border-zinc-600 focus:outline-none transition-all shadow-inner"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 text-zinc-400 hover:text-white p-0.5 rounded-full text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. NOTES / STORIES HORIZONTAL STRIP */}
      <div className="px-4 py-3 border-b border-[#1a1e28] flex items-start gap-4 overflow-x-auto scrollbar-none">
        
        {/* User Note (Your note) */}
        <div 
          onClick={() => setIsNoteModalOpen(true)}
          className="flex flex-col items-center gap-1 cursor-pointer shrink-0 group relative min-w-[72px]"
        >
          {/* Floating speech bubble */}
          <div className="relative mb-1">
            <div className="bg-[#1f2433] hover:bg-[#282e40] text-zinc-200 text-[10px] leading-tight px-2.5 py-1 rounded-2xl max-w-[80px] text-center border border-zinc-700/60 shadow-lg line-clamp-2 transition-all">
              {userNote.bubbleText || 'Make this space yours...'}
            </div>
            {/* Speech bubble pointer */}
            <div className="w-2 h-2 bg-[#1f2433] rotate-45 mx-auto -mt-1 border-r border-b border-zinc-700/60"></div>
          </div>

          {/* User Avatar with + badge */}
          <div className="relative">
            <img 
              src={currentUser.avatar || userNote.userAvatar} 
              alt="Your Note"
              className="w-14 h-14 rounded-full object-cover ring-2 ring-zinc-700 group-hover:scale-105 transition-transform"
            />
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-white text-black rounded-full flex items-center justify-center font-bold text-xs shadow-md">
              <Plus className="w-3.5 h-3.5 text-black stroke-[3]" />
            </div>
          </div>

          {/* Labels */}
          <span className="text-xs text-zinc-200 font-medium mt-0.5 truncate max-w-[74px]">Your note</span>
          <div className="flex items-center gap-0.5 text-[10px] text-red-400 font-normal">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate max-w-[64px]">{userNote.location || 'Location off'}</span>
          </div>
        </div>

        {/* Itz mulla Note (From screenshot) */}
        {otherNotes.find(n => n.userName.toLowerCase().includes('mulla')) && (
          <div 
            onClick={() => {
              const conv = conversations.find(c => c.id === 'conv-itz-mulla');
              if (conv) onSelectConversation(conv.id);
            }}
            className="flex flex-col items-center gap-1 cursor-pointer shrink-0 group relative min-w-[76px]"
          >
            {/* Note Speech Bubble with Song Info & Status */}
            <div className="relative mb-1">
              <div className="bg-[#1f2433] hover:bg-[#282e40] text-zinc-100 text-[10px] px-2.5 py-1 rounded-2xl max-w-[90px] text-center border border-zinc-700/60 shadow-lg transition-all flex flex-col items-center">
                <div className="flex items-center gap-1 text-[9px] text-zinc-300 font-semibold truncate max-w-[80px]">
                  <span className="text-[10px] tracking-tighter">ıllı</span>
                  <span className="truncate">Leavin</span>
                  <span className="text-[7px] bg-zinc-600 px-1 py-0.2 rounded text-white font-bold">E</span>
                </div>
                <span className="text-[8px] text-zinc-400 truncate max-w-[80px]">Rod Wave</span>
                <span className="text-[10px] font-medium text-white mt-0.5 truncate max-w-[80px]">Amazing week ❤️</span>
              </div>
              <div className="w-2 h-2 bg-[#1f2433] rotate-45 mx-auto -mt-1 border-r border-b border-zinc-700/60"></div>
            </div>

            {/* Avatar */}
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80" 
                alt="Itz mulla"
                className="w-14 h-14 rounded-full object-cover ring-2 ring-indigo-500/40 group-hover:scale-105 transition-transform"
              />
            </div>
            <span className="text-xs text-zinc-200 font-medium mt-0.5 truncate max-w-[74px]">Itz mulla</span>
          </div>
        )}

        {/* Map Hub Icon (From screenshot) */}
        <div 
          onClick={() => setIsMapModalOpen(true)}
          className="flex flex-col items-center gap-1 cursor-pointer shrink-0 group relative min-w-[64px]"
        >
          <div className="h-9"></div> {/* spacing alignment */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-900/80 via-cyan-900/60 to-blue-900/90 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-md group-hover:scale-105 transition-transform">
            <Globe className="w-7 h-7 text-cyan-400" />
          </div>
          <span className="text-xs text-zinc-200 font-medium mt-0.5">Map</span>
        </div>

        {/* Majak Note */}
        {otherNotes.find(n => n.userName.toLowerCase().includes('majak')) && (
          <div 
            onClick={() => {
              const conv = conversations.find(c => c.id === 'conv-majak');
              if (conv) onSelectConversation(conv.id);
            }}
            className="flex flex-col items-center gap-1 cursor-pointer shrink-0 group relative min-w-[72px]"
          >
            <div className="relative mb-1">
              <div className="bg-[#1f2433] hover:bg-[#282e40] text-zinc-100 text-[10px] px-2.5 py-1 rounded-2xl max-w-[80px] text-center border border-zinc-700/60 shadow-lg truncate">
                Physics past... 💯
              </div>
              <div className="w-2 h-2 bg-[#1f2433] rotate-45 mx-auto -mt-1 border-r border-b border-zinc-700/60"></div>
            </div>
            <img 
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" 
              alt="Majak"
              className="w-14 h-14 rounded-full object-cover ring-2 ring-zinc-700 group-hover:scale-105 transition-transform"
            />
            <span className="text-xs text-zinc-200 font-medium mt-0.5 truncate max-w-[70px]">Majak</span>
          </div>
        )}

        {/* awien.diar Note */}
        {otherNotes.find(n => n.userName.toLowerCase().includes('awien')) && (
          <div 
            onClick={() => {
              const conv = conversations.find(c => c.id === 'conv-awien');
              if (conv) onSelectConversation(conv.id);
            }}
            className="flex flex-col items-center gap-1 cursor-pointer shrink-0 group relative min-w-[72px]"
          >
            <div className="relative mb-1">
              <div className="bg-[#1f2433] hover:bg-[#282e40] text-zinc-100 text-[10px] px-2.5 py-1 rounded-2xl max-w-[80px] text-center border border-zinc-700/60 shadow-lg truncate">
                Reading Dirac 📚
              </div>
              <div className="w-2 h-2 bg-[#1f2433] rotate-45 mx-auto -mt-1 border-r border-b border-zinc-700/60"></div>
            </div>
            <img 
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80" 
              alt="awien.diar"
              className="w-14 h-14 rounded-full object-cover ring-2 ring-zinc-700 group-hover:scale-105 transition-transform"
            />
            <span className="text-xs text-zinc-200 font-medium mt-0.5 truncate max-w-[70px]">awien.diar</span>
          </div>
        )}
      </div>

      {/* 4. FILTER PILLS (Primary | Requests | General | Channels) */}
      <div className="px-4 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none bg-[#0b0d13]">
        {/* Sliders Icon */}
        <button 
          onClick={onOpenFindFriends}
          className="p-1.5 text-zinc-400 hover:text-white rounded-full flex items-center gap-0.5"
          title="Filter Preferences"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <ChevronDown className="w-3 h-3" />
        </button>

        {/* Primary Pill */}
        <button
          onClick={() => {
            setActiveFilterPill('primary');
            setFilterTab('all');
          }}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
            activeFilterPill === 'primary'
              ? 'bg-[#222736] text-white border border-zinc-700'
              : 'text-zinc-400 hover:text-white hover:bg-[#181b24]'
          }`}
        >
          Primary
        </button>

        {/* Requests Pill with Red Dot */}
        <button
          onClick={() => {
            setActiveFilterPill('requests');
            setIsRequestsModalOpen(true);
          }}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeFilterPill === 'requests'
              ? 'bg-[#222736] text-white border border-zinc-700'
              : 'text-zinc-400 hover:text-white hover:bg-[#181b24]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          <span>Requests {pendingRequestsCount}</span>
        </button>

        {/* General Pill */}
        <button
          onClick={() => {
            setActiveFilterPill('general');
            setFilterTab('teachers');
          }}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
            activeFilterPill === 'general'
              ? 'bg-[#222736] text-white border border-zinc-700'
              : 'text-zinc-400 hover:text-white hover:bg-[#181b24]'
          }`}
        >
          General
        </button>

        {/* Channels Pill */}
        <button
          onClick={() => {
            setActiveFilterPill('channels');
            setFilterTab('groups');
          }}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
            activeFilterPill === 'channels'
              ? 'bg-[#222736] text-white border border-zinc-700'
              : 'text-zinc-400 hover:text-white hover:bg-[#181b24]'
          }`}
        >
          Channels
        </button>
      </div>

      {/* 5. CONVERSATION LIST (Matching Instagram DM screenshot layout) */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#151822]">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 text-zinc-400 flex items-center justify-center mb-3">
              <MessageSquarePlus className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-white">No messages</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-[200px]">
              Tap the write icon above to start chatting with study partners.
            </p>
          </div>
        ) : (
          filteredConversations.map(conv => {
            const isGroup = conv.type === 'group';
            const partner = getPartner(conv);
            const isActive = conv.id === activeConversationId;
            const partnerName = isGroup ? conv.name : partner?.name || 'User';

            // Calculate formatted time
            let timeStr = 'now';
            if (conv.lastMessage?.createdAt) {
              const diffMs = Date.now() - new Date(conv.lastMessage.createdAt).getTime();
              const diffMins = Math.floor(diffMs / (1000 * 60));
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              const diffWeeks = Math.floor(diffDays / 7);

              if (diffWeeks > 0) timeStr = `${diffWeeks}w`;
              else if (diffDays > 0) timeStr = `${diffDays}d`;
              else if (diffHours > 0) timeStr = `${diffHours}h`;
              else if (diffMins > 0) timeStr = `${diffMins}m`;
            }

            // Message text preview formatted like screenshot
            let messageSnippet = '';
            if (conv.lastMessage) {
              if (conv.lastMessage.content.toLowerCase().includes('reacted to your')) {
                messageSnippet = `${conv.lastMessage.content} · ${timeStr}`;
              } else if (conv.lastMessage.content.toLowerCase().includes('seen')) {
                messageSnippet = `Seen · ${timeStr}`;
              } else if (conv.lastMessage.content.toLowerCase().includes('sent')) {
                messageSnippet = `Sent · ${timeStr}`;
              } else {
                messageSnippet = `${conv.lastMessage.content} · ${timeStr}`;
              }
            }

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  isActive 
                    ? 'bg-[#181c28]' 
                    : 'hover:bg-[#131620]'
                }`}
              >
                {/* Left: Avatar + Details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {isGroup ? (
                      <div className="w-13 h-13 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white text-xl shadow-sm">
                        {conv.groupAvatar || '👥'}
                      </div>
                    ) : partner?.avatar ? (
                      <img 
                        src={partner.avatar} 
                        alt={partnerName}
                        className="w-13 h-13 rounded-full object-cover ring-1 ring-zinc-700" 
                      />
                    ) : (
                      // Default Instagram style silhouette
                      <div className="w-13 h-13 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300">
                        <div className="w-6 h-6 rounded-full border-2 border-zinc-400 mb-1"></div>
                      </div>
                    )}
                  </div>

                  {/* Text Information */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {partnerName}
                    </h3>
                    <p className={`text-xs truncate mt-0.5 ${
                      conv.unreadCount > 0 
                        ? 'font-bold text-white' 
                        : 'text-zinc-400'
                    }`}>
                      {messageSnippet || `${partner?.title || 'Active study buddy'}`}
                    </p>
                  </div>
                </div>

                {/* Right: Camera Action Icon */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectConversation(conv.id);
                  }}
                  className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Send Photo / Camera"
                >
                  <Camera className="w-5 h-5 stroke-[1.5]" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 6. FLOATING ACTION PILL (+ BUTTON) */}
      <div className="p-3 bg-[#0b0d13] border-t border-[#1a1e28] flex justify-end">
        <button
          onClick={onOpenFindFriends}
          className="w-11 h-11 bg-white hover:bg-zinc-200 text-black rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer"
          title="New Message"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {/* 7. NOTE CREATOR MODAL ("Share a note...") */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#181b24] border border-[#2c3242] rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Share a note</h3>
              <button 
                onClick={() => setIsNoteModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Note Bubble preview */}
            <div className="flex flex-col items-center mb-5">
              <div className="bg-[#242938] text-white text-xs px-4 py-2 rounded-2xl border border-zinc-700/80 mb-1 max-w-[200px] text-center shadow-lg">
                {myNoteText.trim() || 'Share a thought... (60 chars)'}
              </div>
              <div className="w-2.5 h-2.5 bg-[#242938] rotate-45 -mt-1.5 border-r border-b border-zinc-700/80 mb-2"></div>
              <img 
                src={currentUser.avatar} 
                alt="Me" 
                className="w-16 h-16 rounded-full object-cover ring-2 ring-indigo-500"
              />
            </div>

            {/* Input fields */}
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-400 font-medium block mb-1">Your status thought</label>
                <input
                  type="text"
                  maxLength={60}
                  value={myNoteText}
                  onChange={(e) => setMyNoteText(e.target.value)}
                  placeholder="e.g. Studying Dirac Chapter 3 📚"
                  className="w-full px-3.5 py-2.5 bg-[#202534] rounded-xl text-xs text-white placeholder:text-zinc-500 border border-zinc-700 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 font-medium block mb-1">Current Study Track / Mood</label>
                <div className="flex items-center gap-2">
                  <Music2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    value={myNoteMusic}
                    onChange={(e) => setMyNoteMusic(e.target.value)}
                    placeholder="e.g. Leavin · Rod Wave"
                    className="w-full px-3.5 py-2 bg-[#202534] rounded-xl text-xs text-white placeholder:text-zinc-500 border border-zinc-700 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <MapPin className={`w-4 h-4 ${myLocationOn ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span className="text-xs text-zinc-300">Share study location</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMyLocationOn(prev => !prev)}
                  className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                    myLocationOn ? 'bg-emerald-600' : 'bg-zinc-700'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    myLocationOn ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMyNote}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200"
              >
                Share Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. STUDY MAP MODAL */}
      {isMapModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181b24] border border-[#2c3242] rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Live Study Map & Hubs</h3>
              </div>
              <button 
                onClick={() => setIsMapModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full h-48 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-zinc-700/80 relative overflow-hidden flex items-center justify-center mb-4">
              {/* Decorative grid */}
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>
              
              {/* Pins on map */}
              <div className="absolute top-8 left-12 flex flex-col items-center">
                <div className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold shadow-md">Nairobi Hub (14)</div>
                <div className="w-3 h-3 bg-indigo-500 rounded-full ring-4 ring-indigo-500/30 animate-pulse"></div>
              </div>

              <div className="absolute bottom-10 right-16 flex flex-col items-center">
                <div className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold shadow-md">Mombasa STEM (8)</div>
                <div className="w-3 h-3 bg-emerald-500 rounded-full ring-4 ring-emerald-500/30"></div>
              </div>

              <div className="absolute top-16 right-20 flex flex-col items-center">
                <div className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[9px] font-bold shadow-md">Nakuru Library (5)</div>
                <div className="w-3 h-3 bg-purple-500 rounded-full ring-4 ring-purple-500/30"></div>
              </div>

              <span className="text-xs text-cyan-300 font-medium bg-black/50 px-3 py-1.5 rounded-full border border-cyan-500/30">
                🗺️ 27 Active Students in Kenya Region
              </span>
            </div>

            <div className="space-y-2">
              <div className="p-3 bg-[#202534] rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">Alliance Academic Center</p>
                  <p className="text-[10px] text-zinc-400">12 Study Groups active now</p>
                </div>
                <button 
                  onClick={() => setIsMapModalOpen(false)}
                  className="px-3 py-1 bg-white text-black text-xs font-bold rounded-lg hover:bg-zinc-200"
                >
                  Join Hub
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. PENDING REQUESTS MODAL */}
      {isRequestsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181b24] border border-[#2c3242] rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <h3 className="text-base font-bold text-white">Study Requests (2)</h3>
              </div>
              <button 
                onClick={() => setIsRequestsModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              {/* Request 1 */}
              <div className="p-3 bg-[#202534] rounded-2xl flex items-center justify-between gap-3 border border-zinc-700/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img 
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" 
                    alt="NEVER BROKE AGAIN"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">NEVER BROKE AGAIN</p>
                    <p className="text-[10px] text-zinc-400">Wants to study Business & STEM</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => {
                      onSelectConversation('conv-nba');
                      setIsRequestsModalOpen(false);
                    }}
                    className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                  >
                    Accept
                  </button>
                  <button 
                    onClick={() => setIsRequestsModalOpen(false)}
                    className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 text-xs hover:bg-zinc-700"
                  >
                    Decline
                  </button>
                </div>
              </div>

              {/* Request 2 */}
              <div className="p-3 bg-[#202534] rounded-2xl flex items-center justify-between gap-3 border border-zinc-700/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img 
                    src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80" 
                    alt="mrw_mb251"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">mrw_mb251</p>
                    <p className="text-[10px] text-zinc-400">J'aime o follow please</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => {
                      onSelectConversation('conv-mrw');
                      setIsRequestsModalOpen(false);
                    }}
                    className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                  >
                    Accept
                  </button>
                  <button 
                    onClick={() => setIsRequestsModalOpen(false)}
                    className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400 text-xs hover:bg-zinc-700"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
