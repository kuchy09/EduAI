import React, { useState, useRef, useEffect } from 'react';
import { 
  Phone, Video, Info, Search, MoreVertical, 
  CheckCheck, Check, Smile, BookOpen, Play, 
  Pause, Copy, ExternalLink, Download, Sparkles,
  UserCheck, UserPlus, Users, ArrowLeft, ShieldAlert,
  Lightbulb, X, Brain, Send, Pin
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
  const [aiExplainModal, setAiExplainModal] = useState<{
    isOpen: boolean;
    question: string;
    explanation: string;
    sender: string;
  } | null>(null);
  const [imgFailedMap, setImgFailedMap] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isGroup = conversation.type === 'group';
  const isFriends = isGroup || (partner && partner.friendStatus === 'friends');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPartnerTyping]);

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
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

  const handleAskAiAboutMessage = (msg: ChatMessage) => {
    // Generate an educational breakdown for the message
    let explanation = '';
    const content = msg.content.toLowerCase();

    if (content.includes('momentum') || content.includes('collision')) {
      explanation = `### Conservation of Linear Momentum\n\n**Core Principle:** In an isolated system with no external resultant force, total momentum before collision equals total momentum after collision:\n\n$$\\sum p_{\\text{initial}} = \\sum p_{\\text{final}} \\implies m_1 u_1 + m_2 u_2 = m_1 v_1 + m_2 v_2$$\n\n- **Elastic Collision:** Kinetic energy is conserved ($\\Delta KE = 0$).\n- **Inelastic Collision:** Kinetic energy is partially converted into internal heat and sound. Objects may stick together ($v_1 = v_2$).\n\n💡 *Study Tip:* Always check if signs (+ or -) are assigned consistently to left/right velocity vectors.`;
    } else if (content.includes('derivative') || content.includes('limit') || content.includes('calculus')) {
      explanation = `### First Principles Limit Proof\n\n**Definition:** The derivative of $f(x)$ from first principles is:\n\n$$f'(x) = \\lim_{h \\to 0} \\frac{f(x + h) - f(x)}{h}$$\n\nFor $f(x) = \\ln(x)$:\n$$\\frac{\\ln(x + h) - \\ln(x)}{h} = \\frac{1}{h} \\ln\\left(1 + \\frac{h}{x}\\right) = \\ln\\left(1 + \\frac{h}{x}\\right)^{1/h}$$\n\nLetting $u = \\frac{h}{x}$, as $h \\to 0$, $(1 + u)^{1/u} \\to e$, yielding $\\ln(e^{1/x}) = \\frac{1}{x}$.`;
    } else {
      explanation = `### Educational Concept Overview\n\n**Key Takeaway:** Peer question posted by **${msg.senderName}**:\n> "${msg.content}"\n\n**Edu AI Guidance:**\n- Relate this concept back to your core textbook chapter.\n- Break down multi-step problems into known givens and target unknowns.\n- Practice explaining this concept back to a peer in your study group to consolidate mastery.`;
    }

    setAiExplainModal({
      isOpen: true,
      question: msg.content,
      explanation,
      sender: msg.senderName
    });
  };

  const reactionEmojis = ['👍', '❤️', '💡', '👏', '🔥', '😮'];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0f171c] min-w-0 w-full overflow-hidden">
      {/* Top Messenger Navigation Bar */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-[#111b21] border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-xs z-10 w-full min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {onBackToList && (
            <button
              onClick={onBackToList}
              className="md:hidden p-1.5 -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer shrink-0"
              title="Back to all chats"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Avatar with Status */}
          <div className="relative shrink-0">
            {isGroup ? (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg shadow-2xs font-bold">
                {conversation.groupAvatar || '👥'}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                {partner?.avatar && !imgFailedMap[partner.id] ? (
                  <img 
                    src={partner.avatar} 
                    alt={partner.name} 
                    onError={() => setImgFailedMap(prev => ({ ...prev, [partner.id]: true }))}
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {getInitials(partner?.name)}
                  </span>
                )}
                {partner?.status === 'online' && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-[#111b21]" />
                )}
              </div>
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
                    : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                }`}>
                  {partner.role}
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
              {isGroup ? (
                <span>{conversation.participants.length} members active • Study Room</span>
              ) : (
                <>
                  <span className={partner?.status === 'online' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}>
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
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-1">
          {onOpenSharedNotes && (
            <button
              onClick={onOpenSharedNotes}
              className="p-1.5 sm:p-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer flex items-center gap-1.5"
              title="View & Share Book Takeaways"
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-xs font-semibold hidden lg:inline">Takeaways</span>
            </button>
          )}

          {!isGroup && (
            <>
              <button
                onClick={() => onStartCall('audio')}
                disabled={!isFriends}
                className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
                title="Start Audio Call"
              >
                <Phone className="w-4 h-4" />
              </button>

              <button
                onClick={() => onStartCall('video')}
                disabled={!isFriends}
                className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
                title="Start Video Classroom Call"
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={onToggleInfoDrawer}
            className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer ${
              isInfoDrawerOpen 
                ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400' 
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Profile & Conversation Info"
          >
            <Info className="w-4 h-4" />
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
                : `Connect with ${partner.name} to message and collaborate directly.`}
            </span>
          </div>
          {partner.friendStatus === 'none' && (
            <button
              onClick={() => onSendFriendRequest(partner.id)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shrink-0 transition-colors cursor-pointer"
            >
              Add Friend
            </button>
          )}
        </div>
      )}

      {/* Message Feed Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Conversation Starter Hero Banner */}
        <div className="py-6 text-center flex flex-col items-center border-b border-slate-200/60 dark:border-slate-800/60 mb-2">
          <div className="w-14 h-14 rounded-2xl overflow-hidden mb-2.5 ring-4 ring-indigo-500/10 shadow-sm flex items-center justify-center bg-white dark:bg-slate-800">
            {isGroup ? (
              <span className="text-2xl">{conversation.groupAvatar || '👥'}</span>
            ) : (
              partner?.avatar && !imgFailedMap[partner.id] ? (
                <img 
                  src={partner.avatar} 
                  alt={partner.name} 
                  onError={() => setImgFailedMap(prev => ({ ...prev, [partner.id]: true }))}
                  className="w-full h-full object-cover" 
                />
              ) : (
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {getInitials(partner?.name)}
                </span>
              )
            )}
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
            {isGroup ? conversation.name : partner?.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">
            {isGroup 
              ? 'Collaborate on syllabus topics, exchange practice problems, and share highlights.' 
              : `Connected on Edu AI. Discuss homework questions, review chapters, and share notes.`}
          </p>
        </div>

        {/* Messages List */}
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

              <div className="flex items-end gap-2 max-w-[88%] sm:max-w-[75%]">
                {/* Left Avatar for partner */}
                {!isMe && (
                  <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mb-1 bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    {showAvatar ? (
                      msg.senderAvatar && !imgFailedMap[msg.senderId] ? (
                        <img 
                          src={msg.senderAvatar} 
                          alt={msg.senderName} 
                          onError={() => setImgFailedMap(prev => ({ ...prev, [msg.senderId]: true }))}
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          {getInitials(msg.senderName)}
                        </span>
                      )
                    ) : <div className="w-7 h-7" />}
                  </div>
                )}

                {/* Message Bubble Container */}
                <div className="relative group/bubble">
                  {/* Hover Quick Action Pill (Ask AI Tutor & React) */}
                  <div className={`absolute -top-7 ${isMe ? 'right-0' : 'left-0'} hidden group-hover/bubble:flex items-center gap-1 p-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md z-20`}>
                    <button
                      onClick={() => handleAskAiAboutMessage(msg)}
                      className="px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/60 rounded-full flex items-center gap-1 cursor-pointer transition-colors"
                      title="Ask AI Tutor to explain this concept"
                    >
                      <Sparkles className="w-3 h-3 text-purple-500" />
                      <span>Ask AI Tutor</span>
                    </button>
                    <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
                    {reactionEmojis.slice(0, 4).map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => onReactToMessage(msg.id, emoji)}
                        className="w-5 h-5 flex items-center justify-center text-xs hover:scale-120 transition-transform cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <div
                    className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs transition-all ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-br-xs'
                        : 'bg-white dark:bg-[#1a2730] text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs'
                    }`}
                  >
                    {/* Attachment: Shared Book Takeaway Note */}
                    {msg.attachment?.type === 'note' && (
                      <div 
                        onClick={() => msg.attachment?.noteId && onSelectSharedNote && onSelectSharedNote(msg.attachment.noteId)}
                        className="mb-2 p-3 rounded-xl bg-indigo-950/20 dark:bg-slate-900/80 border border-indigo-300/40 dark:border-slate-700 hover:border-indigo-400 transition-all cursor-pointer shadow-xs text-left"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            Book Takeaways • {msg.attachment.notePermission || 'Shared'}
                          </span>
                          <span className="text-[10px] text-indigo-300 font-semibold hover:underline flex items-center gap-0.5">
                            Open Note <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold truncate">
                          {msg.attachment.name || 'Shared Book Takeaway'}
                        </h4>
                        <p className="text-[11px] opacity-80 mt-0.5 truncate">
                          📖 {msg.attachment.bookTitle || 'Textbook'}
                        </p>
                      </div>
                    )}

                    {/* Attachment: Book Card */}
                    {msg.attachment?.type === 'book' && (
                      <div className="mb-2 p-2.5 rounded-xl bg-indigo-950/20 dark:bg-slate-900/60 border border-indigo-300/30 dark:border-slate-700 flex items-center gap-3">
                        <div className="w-9 h-12 bg-indigo-500 rounded flex items-center justify-center text-white text-lg shadow-xs shrink-0">
                          📖
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">
                            Textbook Citation
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
                      <div className="mb-2 p-2 rounded-xl bg-black/10 dark:bg-white/5 flex items-center gap-3">
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
                                className={`w-1 rounded-full ${playingVoiceId === msg.id ? 'bg-amber-400 animate-pulse' : 'bg-current opacity-40'}`}
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
                          <span>{msg.attachment.name || 'formula_snippet.ts'}</span>
                          <button
                            onClick={() => handleCopyCode(msg.id, msg.attachment!.codeSnippet!)}
                            className="flex items-center gap-1 hover:text-white cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedCodeId === msg.id ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre className="text-[11px] whitespace-pre-wrap">{msg.attachment.codeSnippet}</pre>
                      </div>
                    )}

                    {/* Message Body Content */}
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
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

              {/* Timestamp & Status */}
              <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 dark:text-slate-500 px-1">
                <span>
                  {msg.createdAt || '12:00 PM'}
                </span>
                {isMe && (
                  <span>
                    {msg.status === 'read' ? (
                      <CheckCheck className="w-3.5 h-3.5 text-indigo-500 inline" />
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
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <span className="text-[10px] font-bold text-indigo-600">
                {getInitials(partner?.name)}
              </span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-xs">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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

      {/* AI Concept Explanation Modal */}
      {aiExplainModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a2730] rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>Edu AI Tutor • Concept Explanation</span>
              </div>
              <button
                onClick={() => setAiExplainModal(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                Message from {aiExplainModal.sender}
              </div>
              <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 font-medium">
                "{aiExplainModal.question}"
              </p>
            </div>

            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-3 leading-relaxed max-h-72 overflow-y-auto pr-1">
              <div className="whitespace-pre-wrap">{aiExplainModal.explanation}</div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">Available 24/7 in Edu AI Study Lounge</span>
              <button
                onClick={() => setAiExplainModal(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
