import React, { useState, useRef, useEffect } from 'react';
import { 
  Phone, Video, Info, Search, MoreVertical, 
  CheckCheck, Check, Smile, BookOpen, Play, 
  Pause, Copy, ExternalLink, Download, Sparkles,
  UserCheck, UserPlus, Users, ArrowLeft, ShieldAlert,
  GraduationCap, MessageSquare, Send
} from 'lucide-react';
import { ChatUser, Conversation, ChatMessage, ChatAttachment } from './types';
import { ChatInput } from './ChatInput';

interface ChatWindowProps {
  currentUser: ChatUser;
  conversation: Conversation;
  partner?: ChatUser;
  messages: ChatMessage[];
  allUsers: ChatUser[];
  onSendMessage: (content: string, attachment?: ChatAttachment) => void;
  onReactToMessage: (messageId: string, emoji: string) => void;
  onStartCall: (type: 'audio' | 'video') => void;
  onToggleInfoDrawer: () => void;
  isInfoDrawerOpen: boolean;
  onBackToList?: () => void;
  onSendFriendRequest: (userId: string) => void;
  isPartnerTyping?: boolean;
  onOpenSharedNotes?: () => void;
  onSelectSharedNote?: (noteId: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  currentUser,
  conversation,
  partner,
  messages,
  allUsers,
  onSendMessage,
  onReactToMessage,
  onStartCall,
  onToggleInfoDrawer,
  isInfoDrawerOpen,
  onBackToList,
  onSendFriendRequest,
  isPartnerTyping = false,
  onOpenSharedNotes,
  onSelectSharedNote
}) => {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [activeReactionMenuId, setActiveReactionMenuId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isFirstOpenRef = useRef<boolean>(true);
  const currentConvIdRef = useRef<string>(conversation.id);

  const isGroup = conversation.type === 'group';
  const isFriends = isGroup || (partner && partner.friendStatus === 'friends');

  // Handle conversation changes
  useEffect(() => {
    if (currentConvIdRef.current !== conversation.id) {
      currentConvIdRef.current = conversation.id;
      isFirstOpenRef.current = true;
    }
  }, [conversation.id]);

  // First display of colleague profile vs scrolling as chats continue
  useEffect(() => {
    if (isFirstOpenRef.current) {
      isFirstOpenRef.current = false;
      // On opening the chat for the first time, keep the colleague profile as the first visible display
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    } else {
      // When user is texting with their colleague, scroll down to show new input/replies
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isPartnerTyping, conversation.id]);

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const reactionEmojis = ['👍', '❤️', '💡', '👏', '🔥', '😮'];

  // Format message timestamps safely
  const formatMessageTime = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('AM') || dateStr.includes('PM') || (dateStr.includes(':') && !dateStr.includes('T'))) {
      return dateStr;
    }
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch (_) {}
    return dateStr;
  };

  // Vanishing formula: Profile is most prominent on opening chat and keeps vanishing as chat continues
  const messageCount = messages.length;
  const profileOpacity = messageCount <= 1 
    ? 1 
    : messageCount <= 3 
    ? 0.78 
    : messageCount <= 5 
    ? 0.48 
    : messageCount <= 7 
    ? 0.22 
    : 0.10;

  const profileScale = messageCount <= 1 
    ? 1 
    : messageCount <= 3 
    ? 0.98 
    : messageCount <= 5 
    ? 0.95 
    : 0.92;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100/60 dark:bg-slate-950 min-w-0 w-full overflow-hidden">
      {/* Top Messenger Navigation Bar */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-xs z-10 w-full min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {onBackToList && (
            <button
              onClick={onBackToList}
              className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer shrink-0"
              title="Back to all chats"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Avatar with Status */}
          <div className="relative shrink-0">
            {isGroup ? (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-base sm:text-lg shadow-xs">
                {conversation.groupAvatar || '👥'}
              </div>
            ) : (
              <>
                <img 
                  src={partner?.avatar || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'} 
                  alt={partner?.name} 
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700" 
                />
                {partner?.status === 'online' && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
                )}
              </>
            )}
          </div>

          {/* User / Group Title */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {isGroup ? conversation.name : partner?.name}
              </h2>

              {!isGroup && partner && (
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                  partner.role === 'teacher' 
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700' 
                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                }`}>
                  {partner.role}
                </span>
              )}
            </div>

            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
              {isGroup ? (
                <span>{conversation.participants.length} members • {conversation.groupRoleType === 'teacher-to-teacher' ? 'Faculty' : 'Study Group'}</span>
              ) : (
                <>
                  <span className={partner?.status === 'online' ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                    {isPartnerTyping ? 'Typing...' : partner?.status === 'online' ? 'Active now' : partner?.lastSeen || 'Offline'}
                  </span>
                  {partner?.institution && (
                    <>
                      <span>•</span>
                      <span className="truncate">{partner.institution}</span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0 ml-1">
          {onOpenSharedNotes && (
            <button
              onClick={onOpenSharedNotes}
              className="p-1.5 sm:p-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer flex items-center gap-1"
              title="View & Share Book Takeaways"
            >
              <BookOpen className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="text-[11px] font-bold hidden lg:inline">Takeaways</span>
            </button>
          )}

          {!isGroup && (
            <>
              <button
                onClick={() => onStartCall('audio')}
                disabled={!isFriends}
                className="p-1.5 sm:p-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 disabled:opacity-40 transition-colors cursor-pointer"
                title="Start Audio Call"
              >
                <Phone className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              <button
                onClick={() => onStartCall('video')}
                disabled={!isFriends}
                className="p-1.5 sm:p-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 disabled:opacity-40 transition-colors cursor-pointer"
                title="Start Video Classroom Call"
              >
                <Video className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </>
          )}

          <button
            onClick={onToggleInfoDrawer}
            className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer ${
              isInfoDrawerOpen 
                ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600' 
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Profile & Conversation Info"
          >
            <Info className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>
      </div>

      {/* Non-Friend Notice Banner if applicable */}
      {!isGroup && partner && partner.friendStatus !== 'friends' && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              {partner.friendStatus === 'pending_sent' 
                ? `Connection request sent to ${partner.name}. Awaiting approval.` 
                : `You are not connected with ${partner.name} yet. Send a friend request to chat.`}
            </span>
          </div>
          {partner.friendStatus === 'none' && (
            <button
              onClick={() => onSendFriendRequest(partner.id)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shrink-0 transition-colors"
            >
              Add Friend
            </button>
          )}
        </div>
      )}

      {/* Message Feed Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
      >
        {/* Colleague Profile Hero Display - First display on opening chat, vanishing as chat continues */}
        {!isGroup && partner ? (
          <div 
            style={{
              opacity: profileOpacity,
              transform: `scale(${profileScale})`,
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out, max-height 0.6s ease-out, margin 0.6s ease-out'
            }}
            className={`w-full max-w-md mx-auto mb-6 bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 text-center shadow-xs transition-all ${
              messages.length >= 7 ? 'max-h-24 overflow-hidden py-3' : 'max-h-[500px]'
            }`}
          >
            {/* Header Badge */}
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-800/60 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                Colleague Profile
              </span>
              {partner.status === 'online' && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/60 dark:border-emerald-800/60 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active now
                </span>
              )}
            </div>

            {/* Colleague Avatar */}
            <div className="relative inline-block mx-auto mb-3">
              <img
                src={partner.avatar || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'}
                alt={partner.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-indigo-500/15 shadow-md mx-auto"
              />
              {partner.status === 'online' && (
                <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-3 ring-white dark:ring-slate-900" />
              )}
            </div>

            {/* Colleague Name & Role */}
            <h3 className="text-lg sm:text-xl font-bold font-display text-slate-900 dark:text-white">
              {partner.name}
            </h3>
            
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                partner.role === 'teacher'
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}>
                {partner.role === 'teacher' ? 'Faculty Educator' : 'Student Colleague'}
              </span>
              {partner.institution && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  • {partner.institution}
                </span>
              )}
            </div>

            {/* Title */}
            {partner.title && (
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1.5">
                {partner.title}
              </p>
            )}

            {/* Bio snippet */}
            {partner.bio && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed italic bg-slate-50/80 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                "{partner.bio}"
              </p>
            )}

            {/* Academic Subjects */}
            {partner.subjects && partner.subjects.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                {partner.subjects.map(s => (
                  <span key={s} className="px-2 py-0.5 rounded-lg bg-indigo-50/80 dark:bg-slate-800 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-100/60 dark:border-slate-700">
                    #{s}
                  </span>
                ))}
              </div>
            )}

            {/* Quick Greeting Chips for opening conversations */}
            {messageCount <= 1 && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-400 mb-2">Start texting with your colleague:</div>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <button
                    onClick={() => onSendMessage(`Hey ${partner.name}! How is your study session going? 👋`)}
                    className="px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Say Hello 👋
                  </button>
                  <button
                    onClick={() => onSendMessage(`Hi ${partner.name}, do you want to review our textbook notes together? 📚`)}
                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Review Notes 📚
                  </button>
                </div>
              </div>
            )}

            {/* Vanishing hint */}
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <span>Direct Academic Messaging</span>
              <span className="italic">
                {messageCount === 0 
                  ? 'Colleague profile displayed' 
                  : messageCount <= 3 
                  ? 'Vanishes as chats continue' 
                  : 'Active conversation'}
              </span>
            </div>
          </div>
        ) : isGroup ? (
          /* Study Group Hero Display */
          <div 
            style={{
              opacity: profileOpacity,
              transform: `scale(${profileScale})`,
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
            }}
            className="py-6 text-center flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-full overflow-hidden mb-3 ring-4 ring-indigo-500/20 shadow-md">
              <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-2xl">
                {conversation.groupAvatar || '👥'}
              </div>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {conversation.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Study group discussion. Collaborate on syllabus, share formulas, and discuss textbooks.
            </p>
          </div>
        ) : null}

        {/* Messages List: User's input on right (slightly-blue container) & Colleague reply on left (white-gray container) */}
        {messages.map((msg, index) => {
          const isMe = msg.senderId === currentUser.id;
          const showAvatar = !isMe && (index === 0 || messages[index - 1]?.senderId !== msg.senderId);

          return (
            <div 
              key={msg.id} 
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
            >
              {/* Sender Name in Groups */}
              {isGroup && !isMe && showAvatar && (
                <div className="flex items-center gap-1.5 mb-1 ml-9">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {msg.senderName}
                  </span>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                    msg.senderRole === 'teacher' 
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' 
                      : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                  }`}>
                    {msg.senderRole}
                  </span>
                </div>
              )}

              <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[75%] md:max-w-[70%]`}>
                {/* Left Avatar for colleague */}
                {!isMe && (
                  <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mb-1">
                    {showAvatar ? (
                      <img 
                        src={msg.senderAvatar || partner?.avatar || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'} 
                        alt={msg.senderName} 
                        className="w-full h-full object-cover ring-1 ring-slate-200 dark:ring-slate-700" 
                      />
                    ) : <div className="w-7 h-7" />}
                  </div>
                )}

                {/* Message Bubble Container */}
                <div className="relative group/bubble">
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs transition-all ${
                      isMe
                        /* User's input on the right in slightly-blue container */
                        ? 'bg-[#eef5ff] dark:bg-blue-950/60 text-slate-900 dark:text-blue-100 border border-[#cbe0ff] dark:border-blue-800/80 rounded-br-xs'
                        /* Colleague's reply on the left in white-gray container */
                        : 'bg-[#f8fafc] dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-bl-xs'
                    }`}
                  >
                    {/* Attachment: Shared Book Takeaway Note */}
                    {msg.attachment?.type === 'note' && (
                      <div 
                        onClick={() => msg.attachment?.noteId && onSelectSharedNote && onSelectSharedNote(msg.attachment.noteId)}
                        className={`mb-2 p-3 rounded-2xl border transition-all cursor-pointer shadow-xs text-left ${
                          isMe
                            ? 'bg-blue-100/60 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700/60 hover:border-blue-300'
                            : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Book Takeaways • {msg.attachment.notePermission || 'Shared'}
                          </span>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-300 font-semibold hover:underline flex items-center gap-0.5">
                            Open Note <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold truncate">
                          {msg.attachment.name || 'Shared Book Takeaway'}
                        </h4>
                        <p className="text-[11px] opacity-80 mt-0.5 truncate">
                          📖 {msg.attachment.bookTitle || 'Textbook'}
                        </p>
                        {msg.attachment.noteTakeaways && msg.attachment.noteTakeaways.length > 0 && (
                          <div className="mt-2 space-y-0.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                            {msg.attachment.noteTakeaways.slice(0, 2).map((pt, i) => (
                              <p key={i} className="text-[10px] sm:text-[11px] opacity-90 truncate flex items-start gap-1">
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">•</span>
                                <span>{pt}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Attachment: Book Card */}
                    {msg.attachment?.type === 'book' && (
                      <div className={`mb-2 p-2.5 rounded-xl border flex items-center gap-3 ${
                        isMe 
                          ? 'bg-blue-100/60 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700/60'
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700'
                      }`}>
                        <div className="w-10 h-14 bg-indigo-500 rounded flex items-center justify-center text-white text-xl shadow-xs shrink-0">
                          📖
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">
                            Textbook Reference
                          </span>
                          <h4 className="text-xs font-bold truncate">
                            {msg.attachment.bookTitle}
                          </h4>
                          <p className="text-[10px] opacity-75 truncate">
                            {msg.attachment.bookAuthor}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Attachment: Voice Note */}
                    {msg.attachment?.type === 'voice' && (
                      <div className={`mb-2 p-2 rounded-xl flex items-center gap-3 ${
                        isMe ? 'bg-blue-200/40 dark:bg-blue-900/40' : 'bg-slate-200/60 dark:bg-slate-700/60'
                      }`}>
                        <button
                          onClick={() => setPlayingVoiceId(playingVoiceId === msg.id ? null : msg.id)}
                          className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0 cursor-pointer"
                        >
                          {playingVoiceId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 h-4">
                            {[40, 80, 50, 90, 70, 40, 60, 95, 30].map((h, i) => (
                              <span
                                key={i}
                                style={{ height: `${h}%` }}
                                className={`w-1 rounded-full ${playingVoiceId === msg.id ? 'bg-indigo-600 animate-pulse' : 'bg-current opacity-40'}`}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] opacity-80 mt-0.5 block">
                            Audio Clip • {msg.attachment.duration || 30}s
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Attachment: Code / Formula Snippet */}
                    {msg.attachment?.type === 'code' && msg.attachment.codeSnippet && (
                      <div className="mb-2 rounded-xl bg-slate-900 text-slate-100 p-2.5 font-mono text-[11px] overflow-x-auto border border-slate-800">
                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800 text-slate-400 text-[10px]">
                          <span>{msg.attachment.name || 'code_snippet.ts'}</span>
                          <button
                            onClick={() => handleCopyCode(msg.id, msg.attachment!.codeSnippet!)}
                            className="flex items-center gap-1 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedCodeId === msg.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre className="text-[11px] whitespace-pre-wrap">{msg.attachment.codeSnippet}</pre>
                      </div>
                    )}

                    {/* Main Content Text */}
                    <p className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>

                  {/* Quick Reaction Hover Menu */}
                  <div className={`absolute top-0 -translate-y-1/2 ${isMe ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} hidden group-hover/bubble:flex items-center bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-0.5 gap-1 z-20`}>
                    {reactionEmojis.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => onReactToMessage(msg.id, emoji)}
                        className="text-xs hover:scale-125 transition-transform p-0.5"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Display Active Emoji Reactions */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                        <span
                          key={emoji}
                          onClick={() => onReactToMessage(msg.id, emoji)}
                          className="px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform"
                        >
                          <span>{emoji}</span>
                          <span className="text-[10px] font-bold text-slate-500">{userIds.length}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamp & Status (Sent/Delivered/Read) */}
              <div className={`flex items-center gap-1 mt-1 text-[10px] text-slate-400 dark:text-slate-500 px-1 ${
                isMe ? 'justify-end' : 'justify-start ml-9'
              }`}>
                <span>
                  {formatMessageTime(msg.createdAt)}
                </span>
                {isMe && (
                  <span>
                    {msg.status === 'read' ? (
                      <CheckCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 inline" />
                    ) : msg.status === 'delivered' ? (
                      <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline" />
                    ) : (
                      <Check className="w-3 h-3 text-slate-400 inline" />
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {isPartnerTyping && (
          <div className="flex items-center gap-2 ml-1">
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
              <img 
                src={partner?.avatar || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'} 
                alt="Typing..." 
                className="w-full h-full object-cover ring-1 ring-slate-200 dark:ring-slate-700" 
              />
            </div>
            <div className="px-3.5 py-2 rounded-2xl rounded-bl-xs bg-[#f8fafc] dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 flex items-center gap-1 shadow-xs">
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Interactive Input Toolbar */}
      <ChatInput
        onSendMessage={onSendMessage}
        disabled={!isFriends}
        disabledReason={
          partner?.friendStatus === 'pending_sent'
            ? 'Connection request pending. You can message once accepted.'
            : 'You must add this teacher/student as a friend to message directly.'
        }
        onSendFriendRequest={partner ? () => onSendFriendRequest(partner.id) : undefined}
        onOpenSharedNotes={onOpenSharedNotes}
      />
    </div>
  );
};
