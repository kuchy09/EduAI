import React, { useState, useRef, useEffect } from 'react';
import { 
  Phone, Video, Info, Search, MoreVertical, 
  CheckCheck, Check, Clock, Smile, BookOpen, Play, 
  Pause, Copy, ExternalLink, Download, Sparkles,
  UserCheck, UserPlus, Users, ArrowLeft, ShieldAlert,
  GraduationCap, MessageSquare, Send
} from 'lucide-react';
import { ChatUser, Conversation, ChatMessage, ChatAttachment } from './types';
import { ChatInput } from './ChatInput';
import { AvatarBadge } from './AvatarBadge';

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
  onAcceptFriendRequest?: (userId: string) => void;
  onDeclineFriendRequest?: (userId: string) => void;
  isPartnerTyping?: boolean;
  typingUserName?: string;
  onTyping?: (isTyping: boolean) => void;
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
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  isPartnerTyping = false,
  typingUserName,
  onTyping,
  onOpenSharedNotes,
  onSelectSharedNote
}) => {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [activeReactionMenuId, setActiveReactionMenuId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isFirstOpenRef = useRef<boolean>(true);
  const currentConvIdRef = useRef<string>(conversation.id);

  // Clean up audio & Web Speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const playSpeechSynthesis = (textToSpeak: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setTimeout(() => setPlayingVoiceId(null), 2500);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setPlayingVoiceId(null);
      utterance.onerror = () => setPlayingVoiceId(null);
      window.speechSynthesis.speak(utterance);
    } catch (_) {
      setPlayingVoiceId(null);
    }
  };

  const handleToggleVoicePlayback = (msg: ChatMessage) => {
    if (playingVoiceId === msg.id) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setPlayingVoiceId(null);
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setPlayingVoiceId(msg.id);

    // If recorded audio blob URL is available, play actual audio
    if (msg.attachment?.url && msg.attachment.url !== '#') {
      try {
        const audio = new Audio(msg.attachment.url);
        currentAudioRef.current = audio;
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => {
          const fallbackText = msg.attachment?.transcript || msg.content || 'Voice message';
          playSpeechSynthesis(fallbackText);
        };
        audio.play().catch(() => {
          const fallbackText = msg.attachment?.transcript || msg.content || 'Voice message';
          playSpeechSynthesis(fallbackText);
        });
        return;
      } catch (_) {}
    }

    // Playback using Web Speech API SpeechSynthesis for transcripts
    const textToSpeak = msg.attachment?.transcript || msg.content?.replace(/^🎙️\s*"?/, '').replace(/"?\s*\(\d+s\)$/, '').replace(/"$/, '') || 'Voice message';
    playSpeechSynthesis(textToSpeak);
  };

  const isGroup = conversation.type === 'group';
  const isFriends = isGroup || (partner && partner.friendStatus === 'friends');

  // Compute latest message sent by current user for seen receipt indicator
  const lastMyMessage = [...messages].reverse().find(m => m.senderId === currentUser.id);
  const lastMyMessageId = lastMyMessage?.id;

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

  // Format message timestamps safely to show exact time sent or received
  const formatExactMessageTime = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr === 'Just now') return 'Just now';

    // If it's an ISO timestamp or date parseable string
    if (dateStr.includes('T') || (dateStr.includes('-') && dateStr.length >= 10)) {
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        }
      } catch (_) {}
    }

    // Clean up commas if needed (e.g. "Yesterday 4:15 PM" -> "Yesterday, 4:15 PM")
    if (dateStr.includes('Yesterday') && dateStr.includes(':') && !dateStr.includes(',')) {
      return dateStr.replace('Yesterday ', 'Yesterday, ');
    }
    if (dateStr.includes('Monday') && dateStr.includes(':') && !dateStr.includes(',')) {
      return dateStr.replace('Monday ', 'Monday, ');
    }
    if (dateStr.includes('Sunday') && dateStr.includes(':') && !dateStr.includes(',')) {
      return dateStr.replace('Sunday ', 'Sunday, ');
    }

    // Standard clock formats
    if (dateStr.includes('AM') || dateStr.includes('PM') || dateStr.includes(':')) {
      return dateStr;
    }

    // Fallbacks for legacy date strings
    if (dateStr === 'Yesterday') return 'Yesterday, 3:30 PM';
    if (dateStr === 'Monday') return 'Mon, 2:14 PM';
    if (dateStr === 'Sunday') return 'Sun, 8:15 PM';

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
      <div className="px-3 sm:px-4 pt-16 sm:pt-[72px] pb-2.5 sm:pb-3 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-xs z-10 w-full min-w-0">
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
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                <Users className="w-5 h-5" />
              </div>
            ) : (
              <AvatarBadge
                name={partner?.name}
                avatarUrl={partner?.avatar}
                role={partner?.role}
                isOnline={partner?.status === 'online'}
                size="sm"
              />
            )}
          </div>

          {/* User / Group Title */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {isGroup ? conversation.name : partner?.name}
              </h2>

              {!isGroup && partner && (
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                  · {partner.role === 'teacher' ? 'Educator' : 'Student'}
                </span>
              )}
            </div>

            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
              {isGroup ? (
                isPartnerTyping ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {typingUserName ? `${typingUserName} is typing...` : 'typing...'}
                  </span>
                ) : (
                  <span>
                    {conversation.participants.length} members ·{' '}
                    {conversation.groupRoleType === 'teacher-to-teacher' ? 'Faculty' : 'Study Group'}
                  </span>
                )
              ) : (
                <>
                  {isPartnerTyping ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      typing...
                    </span>
                  ) : (
                    <span className={partner?.status === 'online' ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                      {partner?.status === 'online' ? 'Active now' : partner?.lastSeen || 'Offline'}
                    </span>
                  )}
                  {partner?.institution && !isPartnerTyping && (
                    <>
                      <span>·</span>
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
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate">
              {partner.friendStatus === 'pending_sent'
                ? `Connection request sent to ${partner.name}. Awaiting approval.`
                : partner.friendStatus === 'pending_received'
                ? `${partner.name} sent you a connection request.`
                : `You are not connected with ${partner.name} yet. Send a friend request to chat.`}
            </span>
          </div>
          {partner.friendStatus === 'pending_received' ? (
            <div className="flex items-center gap-1.5 shrink-0">
              {onAcceptFriendRequest && (
                <button
                  onClick={() => onAcceptFriendRequest(partner.id)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Accept
                </button>
              )}
              {onDeclineFriendRequest && (
                <button
                  onClick={() => onDeclineFriendRequest(partner.id)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Decline
                </button>
              )}
            </div>
          ) : partner.friendStatus === 'none' ? (
            <button
              onClick={() => onSendFriendRequest(partner.id)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shrink-0 transition-colors cursor-pointer"
            >
              Add Friend
            </button>
          ) : null}
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
            className={`w-full max-w-md mx-auto mb-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 text-center shadow-xs transition-all ${
              messages.length >= 7 ? 'max-h-24 overflow-hidden py-3' : 'max-h-[500px]'
            }`}
          >
            {/* Colleague Avatar */}
            <div className="mb-3 flex justify-center">
              <AvatarBadge
                name={partner.name}
                avatarUrl={partner.avatar}
                role={partner.role}
                isOnline={partner.status === 'online'}
                size="xl"
              />
            </div>

            {/* Colleague Name & Role */}
            <h3 className="text-lg sm:text-xl font-bold font-display text-slate-900 dark:text-white">
              {partner.name}
            </h3>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              {partner.role === 'teacher' ? 'Faculty Educator' : 'Student'}
              {partner.institution ? ` · ${partner.institution}` : ''}
              {partner.status === 'online' ? ' · Active now' : ''}
            </p>

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
                  <div className="w-7 h-7 shrink-0 mb-1">
                    {showAvatar ? (
                      <AvatarBadge
                        name={msg.senderName}
                        avatarUrl={msg.senderAvatar || partner?.avatar}
                        role={msg.senderRole}
                        size="xs"
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

                    {/* Attachment: Voice Note (Web Speech API) */}
                    {msg.attachment?.type === 'voice' && (
                      <div className={`mb-2 p-2.5 rounded-xl border flex flex-col gap-2 ${
                        isMe 
                          ? 'bg-blue-100/60 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700/60' 
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700'
                      }`}>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleVoicePlayback(msg)}
                            className={`w-8.5 h-8.5 rounded-full flex items-center justify-center shadow-xs shrink-0 cursor-pointer transition-all hover:scale-105 ${
                              playingVoiceId === msg.id 
                                ? 'bg-indigo-600 text-white animate-pulse' 
                                : isMe ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-800 text-white'
                            }`}
                            title={playingVoiceId === msg.id ? "Pause Voice Note" : "Play Voice Note (Web Speech)"}
                          >
                            {playingVoiceId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            {/* Equalizer Bars */}
                            <div className="flex items-center gap-1 h-4">
                              {[35, 75, 45, 90, 65, 40, 85, 95, 30, 60, 80, 50].map((h, i) => (
                                <span
                                  key={i}
                                  style={{ height: `${h}%` }}
                                  className={`w-1 rounded-full transition-all duration-300 ${
                                    playingVoiceId === msg.id 
                                      ? 'bg-indigo-600 dark:bg-indigo-400 animate-pulse' 
                                      : 'bg-slate-400 dark:bg-slate-600 opacity-60'
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-[10px] opacity-75 mt-1 font-mono">
                              <span className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                {playingVoiceId === msg.id ? 'Playing...' : 'Voice Note'}
                              </span>
                              <span>{msg.attachment.duration || 1}s</span>
                            </div>
                          </div>
                        </div>

                        {/* Transcription from Web Speech API */}
                        {msg.attachment.transcript && (
                          <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50 text-[11px] italic opacity-90 flex items-start gap-1">
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold not-italic">“</span>
                            <span className="line-clamp-3">{msg.attachment.transcript}</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold not-italic">”</span>
                          </div>
                        )}
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

                    {/* Subtle Timestamp Label directly attached to individual chat bubble */}
                    <div 
                      className={`flex items-center gap-1 justify-end mt-1.5 -mb-0.5 select-none ${
                        isMe 
                          ? 'text-blue-700/65 dark:text-blue-300/65' 
                          : 'text-slate-500/75 dark:text-slate-400/75'
                      }`}
                    >
                      <span 
                        className="text-[10px] font-medium tracking-tight"
                        title={isMe ? `Sent at ${formatExactMessageTime(msg.createdAt)}` : `Received at ${formatExactMessageTime(msg.createdAt)}`}
                      >
                        {formatExactMessageTime(msg.createdAt)}
                      </span>
                      {isMe && (
                        <div 
                          className="inline-flex items-center gap-0.5 ml-1 transition-all select-none cursor-default" 
                          title={
                            msg.status === 'read' 
                              ? `Seen by ${partner?.name || 'colleague'}${msg.seenAt ? ` • ${msg.seenAt}` : ''}`
                              : msg.status === 'delivered' 
                              ? `Delivered to ${partner?.name || 'colleague'}'s device`
                              : msg.status === 'sent' 
                              ? 'Sent to network' 
                              : 'Sending...'
                          }
                        >
                          {msg.status === 'read' ? (
                            <span className="inline-flex items-center gap-0.5 text-[#53bdeb] dark:text-[#38bdf8]">
                              <CheckCheck className="w-3.5 h-3.5 stroke-[2.3] inline drop-shadow-[0_0_1px_rgba(83,189,235,0.4)]" />
                              {msg.id === lastMyMessageId && (
                                <span className="text-[9px] font-bold tracking-tight uppercase scale-90 inline-block">
                                  Seen
                                </span>
                              )}
                            </span>
                          ) : msg.status === 'delivered' ? (
                            <span className="inline-flex items-center text-slate-400/80 dark:text-slate-400/70">
                              <CheckCheck className="w-3.5 h-3.5 stroke-[2] inline" />
                            </span>
                          ) : msg.status === 'sent' ? (
                            <span className="inline-flex items-center text-slate-400/80 dark:text-slate-400/70">
                              <Check className="w-3.5 h-3.5 stroke-[2] inline" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-slate-400/80 dark:text-slate-400/70">
                              <Clock className="w-3 h-3 inline animate-spin" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
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

            </div>
          );
        })}

        {/* Real-time Typing Indicator */}
        {isPartnerTyping && (
          <div className="flex flex-col items-start space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%]">
              <AvatarBadge
                name={typingUserName || partner?.name}
                avatarUrl={partner?.avatar}
                role={partner?.role}
                size="xs"
              />
              <div className="px-4 py-2.5 rounded-2xl rounded-bl-xs bg-[#f8fafc] dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 flex items-center gap-2 shadow-xs">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" />
                </div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 italic">
                  {typingUserName ? `${typingUserName} is typing...` : partner?.name ? `${partner.name} is typing...` : 'typing...'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Interactive Input Toolbar */}
      <ChatInput
        onSendMessage={onSendMessage}
        onTyping={onTyping}
        disabled={!isFriends}
        disabledReason={
          partner?.friendStatus === 'pending_sent'
            ? 'Connection request pending. You can message once accepted.'
            : partner?.friendStatus === 'pending_received'
            ? 'Accept this connection request above to start messaging.'
            : 'You must add this teacher or student as a friend to message directly.'
        }
        onSendFriendRequest={partner && partner.friendStatus === 'none' ? () => onSendFriendRequest(partner.id) : undefined}
        onOpenSharedNotes={onOpenSharedNotes}
      />
    </div>
  );
};
