import React, { useState, useEffect, useRef } from 'react';
import { 
  ChatUser, Conversation, ChatMessage, 
  ChatAttachment, CallSession, UserRole 
} from './chat/types';
import { 
  INITIAL_CURRENT_USER, INITIAL_USERS, 
  INITIAL_CONVERSATIONS, INITIAL_MESSAGES 
} from './chat/initialData';
import { ChatSidebar } from './chat/ChatSidebar';
import { ChatWindow } from './chat/ChatWindow';
import { ChatEmptyState } from './chat/ChatEmptyState';
import { ChatInfoDrawer } from './chat/ChatInfoDrawer';
import { FindFriendsModal } from './chat/FindFriendsModal';
import { CallModal } from './chat/CallModal';
import { supabase } from '../lib/supabase';
import { 
  fetchSearchableUsersFromSupabase, 
  sendSupabaseFriendRequest, 
  respondToSupabaseFriendRequest, 
  cancelOrRemoveSupabaseFriendship,
  syncCurrentUserToSupabase
} from '../lib/userDirectoryService';

interface ChatProps {
  user?: any;
  profile?: any;
  onNavigate?: (view: string) => void;
}

export function Chat({ user, profile, onNavigate }: ChatProps) {
  // 1. Current User State
  const [currentUser, setCurrentUser] = useState<ChatUser>(() => {
    const saved = localStorage.getItem('eduai_chat_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    const detectedRole: UserRole = (profile?.role || user?.user_metadata?.role || 'student') as UserRole;
    return {
      ...INITIAL_CURRENT_USER,
      id: user?.id || INITIAL_CURRENT_USER.id,
      name: profile?.full_name || user?.user_metadata?.full_name || INITIAL_CURRENT_USER.name,
      email: user?.email || INITIAL_CURRENT_USER.email,
      role: detectedRole === 'teacher' ? 'teacher' : 'student',
      title: detectedRole === 'teacher' ? 'Senior Educator & Faculty Lead' : 'Senior High Student (Grade 12 CBC)'
    };
  });

  // 2. All Users (Teachers & Students)
  const [allUsers, setAllUsers] = useState<ChatUser[]>(() => {
    const saved = localStorage.getItem('eduai_chat_users');
    let list = INITIAL_USERS;
    if (saved) {
      try {
        const parsed: ChatUser[] = JSON.parse(saved);
        const parsedNames = new Set(parsed.map(u => u.name.toLowerCase()));
        const missing = INITIAL_USERS.filter(u => !parsedNames.has(u.name.toLowerCase()));
        list = [...parsed, ...missing];
      } catch (e) {}
    }
    return list;
  });

  // Initial load from Supabase directory
  useEffect(() => {
    const loadDirectory = async () => {
      if (user?.id) {
        await syncCurrentUserToSupabase(user, {
          name: currentUser.name,
          role: currentUser.role,
          title: currentUser.title,
          institution: currentUser.institution,
          subjects: currentUser.subjects,
          bio: currentUser.bio,
          avatar: currentUser.avatar,
          location: currentUser.location
        });
      }
      const res = await fetchSearchableUsersFromSupabase(currentUser.id);
      if (res.users && res.users.length > 0) {
        setAllUsers(res.users);
      }
    };
    loadDirectory();
  }, [user?.id, currentUser.role]);

  // 3. Conversations List
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem('eduai_chat_conversations');
    if (saved) {
      try { 
        const parsed: Conversation[] = JSON.parse(saved);
        const parsedIds = new Set(parsed.map(c => c.id));
        const missing = INITIAL_CONVERSATIONS.filter(c => !parsedIds.has(c.id));
        if (missing.length > 0) {
          return [...INITIAL_CONVERSATIONS, ...parsed.filter(p => !INITIAL_CONVERSATIONS.some(ic => ic.id === p.id))];
        }
        return parsed;
      } catch (e) {}
    }
    return INITIAL_CONVERSATIONS;
  });

  // 4. Messages grouped by conversation ID
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>(() => {
    const saved = localStorage.getItem('eduai_chat_messages');
    if (saved) {
      try { 
        const parsed: Record<string, ChatMessage[]> = JSON.parse(saved);
        return { ...INITIAL_MESSAGES, ...parsed };
      } catch (e) {}
    }
    return INITIAL_MESSAGES;
  });

  // Empty string initially so the right side displays the screenshot's empty state
  const [activeConversationId, setActiveConversationId] = useState<string>('');

  // Mobile View Toggle: 'list' (Inbox/Threads) | 'chat' (Active conversation)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Modals and Drawers
  const [isFindFriendsOpen, setIsFindFriendsOpen] = useState(false);
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'direct' | 'teachers' | 'students' | 'groups'>('all');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  // Call Session State
  const [callSession, setCallSession] = useState<CallSession>({
    isActive: false,
    type: 'audio',
    partner: null,
    startTime: 0,
    isMuted: false,
    isVideoOff: false,
    status: 'connected'
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('eduai_chat_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('eduai_chat_users', JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    localStorage.setItem('eduai_chat_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('eduai_chat_messages', JSON.stringify(messagesMap));
  }, [messagesMap]);

  // Realtime Supabase Broadcast setup
  useEffect(() => {
    if (!supabase) return;
    try {
      const channel = supabase.channel('eduai-messenger-network', {
        config: { broadcast: { ack: false, self: false } }
      });

      channel.on('broadcast', { event: 'new_chat_message' }, (payload) => {
        const incoming: ChatMessage = payload.payload;
        if (!incoming || !incoming.conversationId) return;

        setMessagesMap(prev => {
          const currentList = prev[incoming.conversationId] || [];
          if (currentList.some(m => m.id === incoming.id)) return prev;
          return {
            ...prev,
            [incoming.conversationId]: [...currentList, incoming]
          };
        });

        setConversations(prev => prev.map(c => {
          if (c.id === incoming.conversationId) {
            return {
              ...c,
              lastMessage: incoming,
              updatedAt: incoming.createdAt,
              unreadCount: c.id === activeConversationId ? 0 : c.unreadCount + 1
            };
          }
          return c;
        }));
      }).subscribe();

      return () => {
        if (supabase) supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Realtime chat channel notice:', err);
    }
  }, [activeConversationId]);

  // Active Conversation & Partner
  const activeConversation = conversations.find(c => c.id === activeConversationId) || conversations[0];
  const partnerId = activeConversation?.type === 'direct' 
    ? activeConversation.participants.find(p => p !== currentUser.id) 
    : undefined;
  const activePartner = allUsers.find(u => u.id === partnerId);
  const activeMessages = activeConversation ? (messagesMap[activeConversation.id] || []) : [];

  // Reset unread count when switching conversation
  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
    setMobileView('chat');
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
  };

  // Toggle user role perspective (e.g. Test as Student or Teacher)
  const handleToggleUserRole = (newRole: UserRole) => {
    setCurrentUser(prev => ({
      ...prev,
      role: newRole,
      title: newRole === 'teacher' 
        ? 'Senior STEM Faculty & CBC Curriculum Lead' 
        : 'Senior High Student (Grade 12 CBC)'
    }));
  };

  // Send message
  const handleSendMessage = (content: string, attachment?: ChatAttachment) => {
    if (!activeConversation) return;

    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: activeConversation.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      senderAvatar: currentUser.avatar,
      content,
      createdAt: new Date().toISOString(),
      status: 'sent',
      attachment
    };

    // Update messages
    setMessagesMap(prev => ({
      ...prev,
      [activeConversation.id]: [...(prev[activeConversation.id] || []), newMessage]
    }));

    // Update conversation metadata
    setConversations(prev => prev.map(c => {
      if (c.id === activeConversation.id) {
        return {
          ...c,
          lastMessage: newMessage,
          updatedAt: newMessage.createdAt
        };
      }
      return c;
    }));

    // Broadcast message
    if (supabase) {
      try {
        const channel = supabase.channel('eduai-messenger-network');
        channel.send({
          type: 'broadcast',
          event: 'new_chat_message',
          payload: newMessage
        });
      } catch (e) {}
    }

    // Interactive Teacher / Peer auto-reply simulation for responsive UX
    if (activeConversation.type === 'direct' && activePartner && activePartner.friendStatus === 'friends') {
      setIsPartnerTyping(true);
      setTimeout(() => {
        setIsPartnerTyping(false);
        const replyText = generateContextualReply(content, activePartner, currentUser);
        const partnerReply: ChatMessage = {
          id: crypto.randomUUID(),
          conversationId: activeConversation.id,
          senderId: activePartner.id,
          senderName: activePartner.name,
          senderRole: activePartner.role,
          senderAvatar: activePartner.avatar,
          content: replyText,
          createdAt: new Date().toISOString(),
          status: 'read'
        };

        setMessagesMap(prev => ({
          ...prev,
          [activeConversation.id]: [...(prev[activeConversation.id] || []), partnerReply]
        }));

        setConversations(prev => prev.map(c => {
          if (c.id === activeConversation.id) {
            return {
              ...c,
              lastMessage: partnerReply,
              updatedAt: partnerReply.createdAt
            };
          }
          return c;
        }));
      }, 1400);
    }
  };

  // Helper: Generates realistic academic replies
  const generateContextualReply = (userPrompt: string, partner: ChatUser, me: ChatUser): string => {
    const prompt = userPrompt.toLowerCase();
    
    if (partner.role === 'teacher') {
      if (me.role === 'teacher') {
        // Teacher to Teacher response
        if (prompt.includes('syllabus') || prompt.includes('cbc') || prompt.includes('exam')) {
          return `I completely agree. I've updated the practical rubric to emphasize critical thinking and laboratory competencies for our upcoming assessments.`;
        }
        return `Thanks for sharing this, Colleague. Let's review the academic department goals during tomorrow's faculty briefing.`;
      } else {
        // Teacher to Student response
        if (prompt.includes('help') || prompt.includes('question') || prompt.includes('problem')) {
          return `Good question! Review the core theorems in Chapter 2. Make sure to clearly state your given variables and conversion factors before substituting.`;
        }
        if (prompt.includes('book') || prompt.includes('read') || prompt.includes('notes')) {
          return `Excellent initiative! That textbook gives great real-world applications. Try the diagnostic questions at the end of section 3.`;
        }
        return `Well noted! Keep up the consistent study effort. Feel free to reach out anytime if you hit a roadblock in your exercises. 🎓✨`;
      }
    } else {
      // Student to Student response
      if (prompt.includes('study') || prompt.includes('call') || prompt.includes('review')) {
        return `Sounds great! I'll open my study notes and flashcards. Let me know when you want to start reviewing together! 📚`;
      }
      if (prompt.includes('quiz') || prompt.includes('algorithm') || prompt.includes('physics')) {
        return `Nice! I just finished that problem set on Edu AI. The step-by-step solutions made it much clearer.`;
      }
      return `Got it! Thanks for sharing. Let's keep pushing for the top scores this semester! 🔥🚀`;
    }
  };

  // React to message
  const handleReactToMessage = (messageId: string, emoji: string) => {
    if (!activeConversation) return;
    setMessagesMap(prev => {
      const list = prev[activeConversation.id] || [];
      const updated = list.map(m => {
        if (m.id === messageId) {
          const reactions = { ...(m.reactions || {}) };
          const usersForEmoji = reactions[emoji] || [];
          if (usersForEmoji.includes(currentUser.id)) {
            // Remove reaction
            reactions[emoji] = usersForEmoji.filter(u => u !== currentUser.id);
            if (reactions[emoji].length === 0) delete reactions[emoji];
          } else {
            // Add reaction
            reactions[emoji] = [...usersForEmoji, currentUser.id];
          }
          return { ...m, reactions };
        }
        return m;
      });
      return { ...prev, [activeConversation.id]: updated };
    });
  };

  // Friend Request Actions
  const handleSendFriendRequest = async (targetUserId: string) => {
    setAllUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, friendStatus: 'pending_sent' } : u));
    await sendSupabaseFriendRequest(targetUserId, currentUser.id);
  };

  const handleAcceptFriendRequest = async (targetUserId: string) => {
    setAllUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, friendStatus: 'friends' } : u));
    await respondToSupabaseFriendRequest(targetUserId, currentUser.id, 'accepted');
    handleStartDirectChat(targetUserId);
  };

  const handleDeclineFriendRequest = async (targetUserId: string) => {
    setAllUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, friendStatus: 'none' } : u));
    await respondToSupabaseFriendRequest(targetUserId, currentUser.id, 'declined');
  };

  const handleUnfriend = async (targetUserId: string) => {
    setAllUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, friendStatus: 'none' } : u));
    await cancelOrRemoveSupabaseFriendship(targetUserId, currentUser.id);
  };

  // Start or jump to direct chat
  const handleStartDirectChat = (targetUserId: string) => {
    let existing = conversations.find(c => c.type === 'direct' && c.participants.includes(targetUserId));
    if (existing) {
      setActiveConversationId(existing.id);
      setMobileView('chat');
    } else {
      const targetUser = allUsers.find(u => u.id === targetUserId);
      const isBothTeachers = currentUser.role === 'teacher' && targetUser?.role === 'teacher';
      const isTeacherStudent = (currentUser.role === 'teacher' && targetUser?.role === 'student') || (currentUser.role === 'student' && targetUser?.role === 'teacher');
      
      const newConv: Conversation = {
        id: `conv-direct-${Date.now()}`,
        type: 'direct',
        participants: [currentUser.id, targetUserId],
        groupRoleType: isBothTeachers ? 'teacher-to-teacher' : isTeacherStudent ? 'teacher-to-student' : 'student-to-student',
        unreadCount: 0,
        updatedAt: new Date().toISOString()
      };

      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMobileView('chat');
      setMessagesMap(prev => ({
        ...prev,
        [newConv.id]: []
      }));
    }
  };

  // Call Handlers
  const handleStartCall = (type: 'audio' | 'video') => {
    if (!activePartner) return;
    setCallSession({
      isActive: true,
      type,
      partner: activePartner,
      startTime: Date.now(),
      isMuted: false,
      isVideoOff: false,
      status: 'connected'
    });
  };

  const handleEndCall = () => {
    setCallSession(prev => ({ ...prev, isActive: false, partner: null }));
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
      {/* Left Sidebar: Conversations & Active Friends (Full width on mobile when in 'list' view, hidden on mobile when in 'chat' view) */}
      <div className={`w-full md:w-[380px] lg:w-[420px] xl:w-[440px] flex-col shrink-0 h-full ${mobileView === 'list' ? 'flex' : 'hidden md:flex'}`}>
        <ChatSidebar
          currentUser={currentUser}
          conversations={conversations}
          allUsers={allUsers}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onOpenFindFriends={() => setIsFindFriendsOpen(true)}
          onOpenNewGroupModal={() => setIsFindFriendsOpen(true)}
          onToggleUserRole={handleToggleUserRole}
          filterTab={filterTab}
          setFilterTab={setFilterTab}
        />
      </div>

      {/* Center Main Chat Window (Full width on mobile when in 'chat' view, hidden on mobile when in 'list' view) */}
      <div className={`flex-1 flex-col h-full min-w-0 ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'}`}>
        {activeConversation ? (
          <ChatWindow
            currentUser={currentUser}
            conversation={activeConversation}
            partner={activePartner}
            messages={activeMessages}
            allUsers={allUsers}
            onSendMessage={handleSendMessage}
            onReactToMessage={handleReactToMessage}
            onStartCall={handleStartCall}
            onToggleInfoDrawer={() => setIsInfoDrawerOpen(prev => !prev)}
            isInfoDrawerOpen={isInfoDrawerOpen}
            onBackToList={() => {
              setActiveConversationId('');
              setMobileView('list');
            }}
            onSendFriendRequest={handleSendFriendRequest}
            isPartnerTyping={isPartnerTyping}
          />
        ) : (
          <ChatEmptyState
            onOpenFindContacts={() => setIsFindFriendsOpen(true)}
            onOpenAIHelp={() => {
              if (onNavigate) {
                onNavigate('sage');
              } else {
                handleSelectConversation('conv-meta-ai');
              }
            }}
          />
        )}
      </div>

      {/* Right Drawer: Profile & Shared Content Info */}
      {activeConversation && isInfoDrawerOpen && (
        <ChatInfoDrawer
          isOpen={isInfoDrawerOpen}
          onClose={() => setIsInfoDrawerOpen(false)}
          conversation={activeConversation}
          partner={activePartner}
          messages={activeMessages}
          onStartCall={handleStartCall}
          onUnfriend={activePartner ? handleUnfriend : undefined}
        />
      )}

      {/* Directory & Friendship Modal */}
      <FindFriendsModal
        isOpen={isFindFriendsOpen}
        onClose={() => setIsFindFriendsOpen(false)}
        currentUser={currentUser}
        users={allUsers}
        onSendFriendRequest={handleSendFriendRequest}
        onAcceptFriendRequest={handleAcceptFriendRequest}
        onDeclineFriendRequest={handleDeclineFriendRequest}
        onStartDirectChat={handleStartDirectChat}
      />

      {/* Audio / Video Classroom Calling Modal */}
      {callSession.isActive && (
        <CallModal
          callSession={callSession}
          onEndCall={handleEndCall}
          onToggleMute={() => setCallSession(prev => ({ ...prev, isMuted: !prev.isMuted }))}
          onToggleVideo={() => setCallSession(prev => ({ ...prev, isVideoOff: !prev.isVideoOff }))}
        />
      )}
    </div>
  );
}
