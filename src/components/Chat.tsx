import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ChatUser,
  Conversation,
  ChatMessage,
  CallSession,
  ChatAttachment,
  SharedBookNote,
  FriendRequestRecord,
} from './chat/types';
import { ChatSidebar } from './chat/ChatSidebar';
import { ChatWindow } from './chat/ChatWindow';
import { ChatEmptyState } from './chat/ChatEmptyState';
import { ChatInfoDrawer } from './chat/ChatInfoDrawer';
import { FindFriendsModal } from './chat/FindFriendsModal';
import { CreateGroupModal } from './chat/CreateGroupModal';
import { CallModal } from './chat/CallModal';
import { SharedNotesPanel } from './chat/SharedNotesPanel';
import { NoteEditorModal } from './chat/NoteEditorModal';
import { NoteDetailModal } from './chat/NoteDetailModal';
import {
  getStoredSharedNotes,
  saveStoredSharedNotes,
  syncNoteToSupabase,
  deleteNoteFromSupabase,
} from './chat/sharedNotesService';
import { getStoredUserAvatar, useUserAvatar } from '../lib/userAvatarService';
import { safeStorage, safeSessionStorage } from '../lib/safeStorage';
import {
  fetchSocialBootstrap,
  sendFriendRequestApi,
  respondFriendRequestApi,
  removeFriendshipApi,
  openDirectConversationApi,
  createGroupConversationApi,
  addGroupMemberApi,
  sendChatMessageApi,
  deleteChatMessageApi,
  markConversationReadApi,
  reactToMessageApi,
  updateSocialProfileApi,
  pushPeerActivityNotification,
  socialWsClient,
  SocialWsEvent,
  SOCIAL_SESSION_REFRESHED_EVENT,
} from '../lib/socialChatClient';
import { getPeerCurrentUserStorageKey } from '../lib/userDirectoryService';
import {
  getPeerConversationsStorageKey,
  getPeerMessagesStorageKey,
  getPeerDeletedMessagesStorageKey,
  pushAccountSyncPatch,
} from '../lib/accountSyncService';

function safeMsgTimeMs(iso?: string): number {
  if (!iso) return 0;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? ts : 0;
}

function mergeDeletedIdMaps(
  a?: Record<string, string> | null,
  b?: Record<string, string> | null
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const src of [a, b]) {
    if (!src || typeof src !== 'object') continue;
    for (const [id, iso] of Object.entries(src)) {
      if (!id || typeof iso !== 'string') continue;
      if (!out[id] || safeMsgTimeMs(iso) >= safeMsgTimeMs(out[id])) {
        out[id] = iso;
      }
    }
  }
  return out;
}

function mergeChatMessagesList(
  existingList: ChatMessage[],
  incomingList: ChatMessage[],
  deletedIds: Record<string, string>
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  const byClientKey = new Map<string, string>();

  const addOrMerge = (msg: ChatMessage, preferIncoming: boolean) => {
    if (!msg?.id || deletedIds[msg.id]) return;
    if (msg.clientMessageId && deletedIds[msg.clientMessageId]) return;
    const cKey = msg.clientMessageId ? `${msg.senderId || ''}::${msg.clientMessageId}` : '';
    const mappedId = cKey ? byClientKey.get(cKey) : undefined;

    // If an incoming server message confirms a local optimistic/failed message, replace the cmsg_ entry
    if (mappedId && mappedId !== msg.id) {
      const existingMapped = byId.get(mappedId);
      if (existingMapped && mappedId.startsWith('cmsg_') && !msg.id.startsWith('cmsg_')) {
        byId.delete(mappedId);
        byId.set(msg.id, msg);
        byClientKey.set(cKey, msg.id);
        return;
      }
      if (existingMapped && !mappedId.startsWith('cmsg_') && msg.id.startsWith('cmsg_')) {
        return;
      }
    }

    const existing = byId.get(msg.id);
    if (!existing) {
      byId.set(msg.id, msg);
      if (cKey) byClientKey.set(cKey, msg.id);
    } else if (preferIncoming) {
      byId.set(msg.id, {
        ...existing,
        ...msg,
        attachment: msg.attachment?.url ? msg.attachment : existing.attachment || msg.attachment,
        reactions: msg.reactions ?? existing.reactions,
      });
    }
  };

  for (const m of existingList || []) {
    addOrMerge(m, false);
  }
  for (const m of incomingList || []) {
    addOrMerge(m, true);
  }

  return Array.from(byId.values()).sort(
    (a, b) => safeMsgTimeMs(a.createdAt) - safeMsgTimeMs(b.createdAt)
  );
}

function mergeMessagesMapsSafe(
  prevMap: Record<string, ChatMessage[]>,
  incomingMap: Record<string, ChatMessage[]>,
  deletedIds: Record<string, string>
): Record<string, ChatMessage[]> {
  const result: Record<string, ChatMessage[]> = {};
  const convIds = new Set([
    ...Object.keys(prevMap || {}),
    ...Object.keys(incomingMap || {}),
  ]);
  for (const convId of convIds) {
    result[convId] = mergeChatMessagesList(
      prevMap?.[convId] || [],
      incomingMap?.[convId] || [],
      deletedIds
    );
  }
  return result;
}

function mergeConversationsSafe(
  prevConvs: Conversation[],
  incomingConvs: Conversation[],
  mergedMessagesMap: Record<string, ChatMessage[]>
): Conversation[] {
  const byId = new Map<string, Conversation>();
  for (const c of prevConvs || []) {
    if (c?.id) byId.set(c.id, c);
  }
  for (const c of incomingConvs || []) {
    if (!c?.id) continue;
    const prev = byId.get(c.id);
    byId.set(c.id, prev ? { ...prev, ...c } : c);
  }
  return Array.from(byId.values())
    .map((c) => {
      const msgs = mergedMessagesMap[c.id];
      if (Array.isArray(msgs)) {
        const latest = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
        return {
          ...c,
          lastMessage: latest,
          updatedAt: latest?.createdAt || c.updatedAt,
        };
      }
      return c;
    })
    .sort((a, b) => safeMsgTimeMs(b.updatedAt) - safeMsgTimeMs(a.updatedAt));
}

interface ChatProps {
  user?: any;
  profile?: any;
  onNavigate?: (view: string) => void;
}

export const Chat: React.FC<ChatProps> = ({ user, profile }) => {
  const liveAvatarUrl = useUserAvatar(user, profile);

  const buildCurrentUser = useCallback((): ChatUser => {
    const saved = safeStorage.getJSON<Partial<ChatUser> | null>(
      getPeerCurrentUserStorageKey(user?.id),
      null
    );
    const meta = user?.user_metadata || {};
    const rawRole = String(profile?.role || meta.role || 'student').toLowerCase();
    const role =
      rawRole === 'admin' || rawRole === 'super_admin'
        ? 'admin'
        : rawRole.includes('teach') || rawRole.includes('educat')
        ? 'teacher'
        : 'student';

    const subjects =
      typeof profile?.subjects === 'string'
        ? profile.subjects.split(',').map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(profile?.subjects)
        ? profile.subjects
        : typeof meta.subjects === 'string'
        ? meta.subjects.split(',').map((s: string) => s.trim()).filter(Boolean)
        : saved?.subjects || ['Mathematics', 'Sciences'];

    const rawAvatar =
      liveAvatarUrl ||
      getStoredUserAvatar(user, profile) ||
      profile?.avatar_url ||
      meta.avatar_url ||
      '';
    const avatar = rawAvatar && !String(rawAvatar).includes('unsplash.com') ? rawAvatar : '';

    return {
      id: user?.id || 'me',
      name:
        profile?.full_name ||
        meta.full_name ||
        meta.name ||
        user?.email?.split('@')[0] ||
        saved?.name ||
        'Edu AI Scholar',
      email: user?.email || '',
      avatar,
      role,
      title:
        profile?.title ||
        meta.field_of_study ||
        (role === 'teacher' ? 'Faculty Educator' : 'Academic Student'),
      institution: profile?.institution || meta.institution || 'Edu AI Learning Network',
      status: 'online',
      lastSeen: 'Active now',
      subjects,
      friendStatus: 'none',
      bio: profile?.bio || meta.bio || 'Collaborating on Edu AI.',
      location: profile?.location || profile?.country || meta.country || '',
    };
  }, [user, profile, liveAvatarUrl]);

  const [currentUser, setCurrentUser] = useState<ChatUser>(buildCurrentUser);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequestRecord[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    user?.id ? safeStorage.getJSON<Conversation[]>(getPeerConversationsStorageKey(user.id), []) : []
  );
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>(() => {
    if (!user?.id) return {};
    const deleted = safeStorage.getJSON<Record<string, string>>(getPeerDeletedMessagesStorageKey(user.id), {});
    const raw = safeStorage.getJSON<Record<string, ChatMessage[]>>(getPeerMessagesStorageKey(user.id), {});
    return mergeMessagesMapsSafe({}, raw, deleted);
  });
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [typingByConversation, setTypingByConversation] = useState<
    Record<string, Record<string, { name: string; expiresAt: number }>>
  >({});
  const [isWsConnected, setIsWsConnected] = useState(socialWsClient.isConnected());
  const [isLoadingSocial, setIsLoadingSocial] = useState(true);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [toastBanner, setToastBanner] = useState<{ text: string; tone: 'info' | 'success' | 'error' } | null>(null);

  const deletedMessageIdsRef = useRef<Record<string, string>>(
    user?.id ? safeStorage.getJSON<Record<string, string>>(getPeerDeletedMessagesStorageKey(user.id), {}) : {}
  );

  // Mobile responsive view & drawers/modals
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);
  const [isFindFriendsOpen, setIsFindFriendsOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // Shared Book Notes Workspace states
  const [sharedNotes, setSharedNotes] = useState<SharedBookNote[]>(() => getStoredSharedNotes());
  const [isNotesPanelOpen, setIsNotesPanelOpen] = useState(false);
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<SharedBookNote | null>(null);
  const [selectedNoteForDetail, setSelectedNoteForDetail] = useState<SharedBookNote | null>(null);

  // Active call state
  const [callSession, setCallSession] = useState<CallSession>({
    isActive: false,
    type: 'audio',
    partner: null,
    startTime: 0,
    isMuted: false,
    isVideoOff: false,
    status: 'ended',
  });

  const activeConversationIdRef = useRef(activeConversationId);
  activeConversationIdRef.current = activeConversationId;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const messagesMapRef = useRef<Record<string, ChatMessage[]>>(messagesMap);
  messagesMapRef.current = messagesMap;

  const showToast = useCallback((text: string, tone: 'info' | 'success' | 'error' = 'info') => {
    setToastBanner({ text, tone });
    setTimeout(() => {
      setToastBanner((prev) => (prev?.text === text ? null : prev));
    }, 3200);
  }, []);

  const buildCurrentUserRef = useRef(buildCurrentUser);
  buildCurrentUserRef.current = buildCurrentUser;

  useEffect(() => {
    setCurrentUser((prev) => {
      const next = buildCurrentUser();
      if (
        prev.id === next.id &&
        prev.name === next.name &&
        prev.email === next.email &&
        prev.avatar === next.avatar &&
        prev.role === next.role &&
        prev.title === next.title &&
        prev.institution === next.institution &&
        prev.bio === next.bio &&
        prev.location === next.location &&
        JSON.stringify(prev.subjects) === JSON.stringify(next.subjects)
      ) {
        return prev;
      }
      return { ...prev, ...next };
    });
  }, [buildCurrentUser]);

  // Reload user-scoped cached peer chats immediately when signed-in user changes
  useEffect(() => {
    if (!user?.id) {
      deletedMessageIdsRef.current = {};
      setConversations([]);
      setMessagesMap({});
      return;
    }
    const del = safeStorage.getJSON<Record<string, string>>(getPeerDeletedMessagesStorageKey(user.id), {});
    deletedMessageIdsRef.current = del;
    const cachedConvs = safeStorage.getJSON<Conversation[]>(getPeerConversationsStorageKey(user.id), []);
    const cachedMsgs = safeStorage.getJSON<Record<string, ChatMessage[]>>(getPeerMessagesStorageKey(user.id), {});
    const cleanedMsgs = mergeMessagesMapsSafe({}, cachedMsgs, del);
    setMessagesMap(cleanedMsgs);
    setConversations(mergeConversationsSafe([], cachedConvs, cleanedMsgs));
  }, [user?.id]);

  // Persist user-scoped peer conversations and messages locally whenever updated
  useEffect(() => {
    if (!user?.id) return;
    safeStorage.setJSON(getPeerConversationsStorageKey(user.id), conversations);
    safeStorage.setJSON(getPeerMessagesStorageKey(user.id), messagesMap);
    safeStorage.setJSON(getPeerDeletedMessagesStorageKey(user.id), deletedMessageIdsRef.current);
  }, [user?.id, conversations, messagesMap]);

  // Persist shared book notes locally
  useEffect(() => {
    saveStoredSharedNotes(sharedNotes);
  }, [sharedNotes]);

  const hydrateFromServer = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingSocial(false);
      return;
    }
    try {
      const data = await fetchSocialBootstrap();
      setSocialError(null);
      if (data.currentUser) {
        setCurrentUser((prev) => ({ ...prev, ...data.currentUser, status: 'online' }));
      }
      const incomingSenderIds = new Set(
        (data.friendRequests || [])
          .filter((r) => r.receiverId === (data.currentUser?.id || user.id) && r.status === 'pending')
          .map((r) => r.senderId)
      );
      const normalizedUsers = (data.users || []).map((u) =>
        incomingSenderIds.has(u.id) && u.friendStatus === 'none'
          ? { ...u, friendStatus: 'pending_received' as const }
          : u
      );
      setAllUsers(normalizedUsers);
      setFriendRequests(data.friendRequests || []);

      const mergedDeleted = mergeDeletedIdMaps(deletedMessageIdsRef.current, data.deletedMessageIds);
      deletedMessageIdsRef.current = mergedDeleted;
      safeStorage.setJSON(getPeerDeletedMessagesStorageKey(user.id), mergedDeleted);

      const nextMergedMsgs = mergeMessagesMapsSafe(
        messagesMapRef.current,
        data.messagesByConv || {},
        mergedDeleted
      );
      messagesMapRef.current = nextMergedMsgs;
      setMessagesMap(nextMergedMsgs);
      setConversations((prev) =>
        mergeConversationsSafe(prev, data.conversations || [], nextMergedMsgs)
      );

      // Check if UserPortal requested opening a specific friend's direct chat
      const pendingPartnerId = safeSessionStorage.getItem('eduai_pending_chat_user_id');
      if (pendingPartnerId) {
        safeSessionStorage.removeItem('eduai_pending_chat_user_id');
        const targetConv = (data.conversations || []).find(
          (c) => c.type === 'direct' && c.participants.includes(pendingPartnerId)
        );
        if (targetConv) {
          setActiveConversationId(targetConv.id);
          setMobileView('chat');
          socialWsClient.sendRead(targetConv.id);
          void markConversationReadApi(targetConv.id).catch(() => {});
        } else {
          try {
            const res = await openDirectConversationApi(pendingPartnerId);
            if (res.conversation) {
              const updatedMsgs = mergeMessagesMapsSafe(
                messagesMapRef.current,
                { [res.conversation.id]: res.messages || [] },
                deletedMessageIdsRef.current
              );
              messagesMapRef.current = updatedMsgs;
              setMessagesMap(updatedMsgs);
              setConversations((cPrev) =>
                mergeConversationsSafe(cPrev, [res.conversation], updatedMsgs)
              );
              setActiveConversationId(res.conversation.id);
              setMobileView('chat');
            }
          } catch (_) {}
        }
      }
    } catch (err: any) {
      console.warn('[Chat] Bootstrap load notice:', err);
      setSocialError(err?.message || 'Unable to load member directory right now.');
    } finally {
      setIsLoadingSocial(false);
    }
  }, [user?.id]);

  // Sync user profile and bootstrap social workspace + start WebSocket client
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;

    (async () => {
      try {
        await updateSocialProfileApi(buildCurrentUserRef.current());
      } catch (_) {}
      if (mounted) {
        await hydrateFromServer();
      }
    })();

    socialWsClient.start();
    const unsubStatus = socialWsClient.subscribeStatus((connected) => {
      if (mounted) setIsWsConnected(connected);
    });

    const unsubEvents = socialWsClient.subscribe((ev: SocialWsEvent) => {
      if (!mounted) return;
      const myId = currentUserRef.current.id;

      if (ev.type === 'auth:ok') {
        const onlineSet = new Set(ev.onlineUserIds || []);
        setAllUsers((prev) =>
          prev.map((u) => ({
            ...u,
            status: onlineSet.has(u.id) ? 'online' : 'offline',
            lastSeen: onlineSet.has(u.id) ? 'Active now' : u.lastSeen,
          }))
        );
        void hydrateFromServer();
        return;
      }

      if (ev.type === 'presence:update') {
        const onlineSet = new Set(ev.onlineUserIds || []);
        setAllUsers((prev) =>
          prev.map((u) => ({
            ...u,
            status: onlineSet.has(u.id) ? 'online' : 'offline',
            lastSeen: onlineSet.has(u.id) ? 'Active now' : u.lastSeen,
          }))
        );
        return;
      }

      if (ev.type === 'social:directory-updated') {
        void hydrateFromServer();
        return;
      }

      if (ev.type === 'chat:message') {
        const msg = ev.message;
        if (deletedMessageIdsRef.current[msg.id]) return;
        const isCurrentActive = activeConversationIdRef.current === msg.conversationId;

        setMessagesMap((prev) => {
          const existing = prev[msg.conversationId] || [];
          const mergedList = mergeChatMessagesList(existing, [msg], deletedMessageIdsRef.current);
          return {
            ...prev,
            [msg.conversationId]: mergedList,
          };
        });

        setConversations((prev) => {
          const found = prev.some((c) => c.id === msg.conversationId);
          const updated = prev.map((c) => {
            if (c.id !== msg.conversationId) return c;
            const nextUnread =
              msg.senderId === myId || isCurrentActive ? 0 : (c.unreadCount || 0) + 1;
            return {
              ...c,
              lastMessage: msg,
              unreadCount: nextUnread,
              updatedAt: msg.createdAt,
            };
          });
          if (!found) {
            hydrateFromServer();
          }
          return updated;
        });

        // Clear sender typing indicator in that conversation
        setTypingByConversation((prev) => {
          const convMap = prev[msg.conversationId];
          if (!convMap || !convMap[msg.senderId]) return prev;
          const nextConv = { ...convMap };
          delete nextConv[msg.senderId];
          return { ...prev, [msg.conversationId]: nextConv };
        });

        if (isCurrentActive && msg.senderId !== myId) {
          socialWsClient.sendRead(msg.conversationId);
          markConversationReadApi(msg.conversationId).catch(() => {});
        } else if (!isCurrentActive && msg.senderId !== myId) {
          pushPeerActivityNotification({
            id: `msg_${msg.id}`,
            title: `New message from ${msg.senderName}`,
            message: msg.content || 'Sent an attachment',
            authorName: msg.senderName,
            authorRole: msg.senderRole === 'teacher' ? 'Teacher' : 'Classmate',
            actionLabel: 'Reply in Chat',
            actionView: 'chat',
          });
        }
        return;
      }

      if (ev.type === 'chat:message-deleted') {
        const deletedAt = ev.deletedAt || new Date().toISOString();
        deletedMessageIdsRef.current = {
          ...deletedMessageIdsRef.current,
          [ev.messageId]: deletedAt,
        };
        if (user?.id) {
          safeStorage.setJSON(getPeerDeletedMessagesStorageKey(user.id), deletedMessageIdsRef.current);
        }
        const currentList = messagesMapRef.current[ev.conversationId];
        if (currentList) {
          const nextList = currentList.filter(
            (m) => m.id !== ev.messageId && m.clientMessageId !== ev.messageId
          );
          const nextMap = {
            ...messagesMapRef.current,
            [ev.conversationId]: nextList,
          };
          messagesMapRef.current = nextMap;
          setMessagesMap(nextMap);
          setConversations((cPrev) =>
            cPrev.map((c) => {
              if (c.id !== ev.conversationId) return c;
              const fallbackLast = nextList.length > 0 ? nextList[nextList.length - 1] : undefined;
              const nextLast = ev.lastMessage ?? fallbackLast;
              return {
                ...c,
                lastMessage: nextLast || undefined,
                updatedAt: nextLast?.createdAt || c.updatedAt,
              };
            })
          );
        }
        return;
      }

      if (ev.type === 'chat:typing') {
        if (ev.userId === myId) return;
        setTypingByConversation((prev) => {
          const convMap = { ...(prev[ev.conversationId] || {}) };
          if (ev.isTyping) {
            convMap[ev.userId] = { name: ev.name, expiresAt: Date.now() + 4000 };
          } else {
            delete convMap[ev.userId];
          }
          return { ...prev, [ev.conversationId]: convMap };
        });
        return;
      }

      if (ev.type === 'chat:read') {
        const readSet = new Set(ev.messageIds || []);
        setMessagesMap((prev) => {
          const list = prev[ev.conversationId];
          if (!list) return prev;
          return {
            ...prev,
            [ev.conversationId]: list.map((m) =>
              readSet.has(m.id) ? { ...m, status: 'read', seenAt: ev.seenAt } : m
            ),
          };
        });
        return;
      }

      if (ev.type === 'chat:reaction') {
        setMessagesMap((prev) => {
          const list = prev[ev.conversationId];
          if (!list) return prev;
          return {
            ...prev,
            [ev.conversationId]: list.map((m) =>
              m.id === ev.messageId ? { ...m, reactions: ev.reactions } : m
            ),
          };
        });
        return;
      }

      if (ev.type === 'chat:conversation') {
        const conv = ev.conversation;
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === conv.id);
          if (exists) {
            return prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c));
          }
          return [conv, ...prev];
        });
        return;
      }

      if (ev.type === 'friend:request') {
        const senderId = ev.request.senderId;
        const senderName = ev.sender?.name || 'A classmate';
        setAllUsers((prev) => {
          const exists = prev.some((u) => u.id === senderId);
          if (exists) {
            return prev.map((u) =>
              u.id === senderId ? { ...u, friendStatus: 'pending_received' } : u
            );
          }
          hydrateFromServer();
          return prev;
        });
        setFriendRequests((prev) => [
          ev.request,
          ...prev.filter((r) => r.id !== ev.request.id),
        ]);
        showToast(`${senderName} sent you a connection request.`, 'info');
        pushPeerActivityNotification({
          id: `fr_${ev.request.id}`,
          title: `Connection Request from ${senderName}`,
          message: ev.request.note || `${senderName} would like to connect on Edu AI.`,
          authorName: senderName,
          authorRole: ev.sender?.role === 'teacher' ? 'Teacher' : 'Classmate',
          actionLabel: 'Review Request',
          actionView: 'chat',
        });
        return;
      }

      if (ev.type === 'friend:responded') {
        const { request, action, conversation, actor } = ev;
        const otherId = request.senderId === myId ? request.receiverId : request.senderId;
        setAllUsers((prev) =>
          prev.map((u) =>
            u.id === otherId
              ? { ...u, friendStatus: action === 'accept' ? 'friends' : 'none' }
              : u
          )
        );
        setFriendRequests((prev) =>
          prev.map((r) => (r.id === request.id ? request : r))
        );
        if (action === 'accept' && conversation) {
          setConversations((prev) => {
            if (prev.some((c) => c.id === conversation.id)) return prev;
            return [conversation, ...prev];
          });
          if (actor && actor.id !== myId) {
            showToast(`${actor.name || 'Connection'} accepted your friend request!`, 'success');
            pushPeerActivityNotification({
              id: `fr_acc_${request.id}`,
              title: `${actor.name || 'Member'} accepted your friend request`,
              message: 'You can now message directly or form a study group.',
              authorName: actor.name || 'Academic Peer',
              authorRole: actor.role === 'teacher' ? 'Teacher' : 'Classmate',
              actionLabel: 'Start Chat',
              actionView: 'chat',
            });
          }
        }
        return;
      }

      if (ev.type === 'friend:removed') {
        const otherId = ev.actorId === myId ? ev.targetId : ev.actorId;
        setAllUsers((prev) =>
          prev.map((u) => (u.id === otherId ? { ...u, friendStatus: 'none' } : u))
        );
      }
    });

    const onSessionRefreshed = () => {
      if (mounted) void hydrateFromServer();
    };
    const onSocialUpdated = () => {
      if (mounted) void hydrateFromServer();
    };
    const onFocusOrVisible = () => {
      if (mounted && document.visibilityState === 'visible') {
        void hydrateFromServer();
      }
    };
    window.addEventListener(SOCIAL_SESSION_REFRESHED_EVENT, onSessionRefreshed);
    window.addEventListener('eduai_social_updated', onSocialUpdated);
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    const pollTimer = window.setInterval(() => {
      if (mounted && document.visibilityState === 'visible') {
        void hydrateFromServer();
      }
    }, 12000);

    return () => {
      mounted = false;
      window.clearInterval(pollTimer);
      unsubStatus();
      unsubEvents();
      window.removeEventListener(SOCIAL_SESSION_REFRESHED_EVENT, onSessionRefreshed);
      window.removeEventListener('eduai_social_updated', onSocialUpdated);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [user?.id, hydrateFromServer, showToast]);

  // Periodically prune stale typing indicators (> 4s old)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingByConversation((prev) => {
        let changed = false;
        const next: Record<string, Record<string, { name: string; expiresAt: number }>> = {};
        for (const [convId, map] of Object.entries(prev)) {
          const filtered: Record<string, { name: string; expiresAt: number }> = {};
          for (const [uid, info] of Object.entries(map)) {
            if (info.expiresAt > now) {
              filtered[uid] = info;
            } else {
              changed = true;
            }
          }
          if (Object.keys(filtered).length > 0) {
            next[convId] = filtered;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleStartDirectChatRef = useRef<(targetUserId: string) => Promise<void>>(async () => {});

  // Listen for external "Start Chat with User" events (e.g. from UserPortal)
  useEffect(() => {
    const handler = async (e: any) => {
      const targetUserId = e?.detail?.userId;
      if (targetUserId) {
        await handleStartDirectChatRef.current(targetUserId);
      }
    };
    window.addEventListener('eduai_open_chat_with_user', handler);
    return () => window.removeEventListener('eduai_open_chat_with_user', handler);
  }, []);

  // Computed active chat state
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  const activePartner = useMemo(() => {
    if (!activeConversation || activeConversation.type === 'group') return undefined;
    const partnerId = activeConversation.participants.find((id) => id !== currentUser.id);
    return allUsers.find((u) => u.id === partnerId);
  }, [activeConversation, allUsers, currentUser.id]);

  const activeMessages = useMemo(() => {
    if (!activeConversationId) return [];
    return messagesMap[activeConversationId] || [];
  }, [messagesMap, activeConversationId]);

  const activeTypingUsers = useMemo(() => {
    if (!activeConversationId) return [];
    return Object.values(typingByConversation[activeConversationId] || {}).map((t) => t.name);
  }, [typingByConversation, activeConversationId]);

  const typingNamesMap = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [cid, map] of Object.entries(typingByConversation)) {
      const names = Object.values(map).map((t) => t.name);
      if (names.length > 0) out[cid] = names;
    }
    return out;
  }, [typingByConversation]);

  // Mark active conversation read cleanly when opened
  const handleSelectConversation = useCallback(async (convId: string) => {
    setActiveConversationId(convId);
    setMobileView('chat');
    setIsInfoDrawerOpen(false);
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
    );
    socialWsClient.sendRead(convId);
    try {
      await markConversationReadApi(convId);
    } catch (_) {}
  }, []);

  // Send message (optimistic + authoritative backend persistence + never vanish unless deleted by sender)
  const handleSendMessage = async (content: string, attachment?: ChatAttachment) => {
    if (!activeConversation) return;
    const convId = activeConversation.id;
    const clientMessageId = `cmsg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const optimisticMsg: ChatMessage = {
      id: clientMessageId,
      clientMessageId,
      conversationId: convId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      senderAvatar: currentUser.avatar,
      content,
      createdAt: new Date().toISOString(),
      status: 'sending',
      attachment,
    };

    setMessagesMap((prev) => ({
      ...prev,
      [convId]: [...(prev[convId] || []), optimisticMsg],
    }));

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId ? { ...c, lastMessage: optimisticMsg, updatedAt: optimisticMsg.createdAt } : c
      )
    );

    try {
      const res = await sendChatMessageApi({
        conversationId: convId,
        clientMessageId,
        content,
        attachment,
      });

      if (res.message) {
        setMessagesMap((prev) => {
          const list = prev[convId] || [];
          const updatedList = mergeChatMessagesList(list, [res.message], deletedMessageIdsRef.current);
          return {
            ...prev,
            [convId]: updatedList,
          };
        });
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, lastMessage: res.message, updatedAt: res.message.createdAt } : c
          )
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Message could not be sent yet. Tap Retry to resend.', 'error');
      setMessagesMap((prev) => ({
        ...prev,
        [convId]: (prev[convId] || []).map((m) =>
          m.id === clientMessageId ? { ...m, status: 'failed' as const } : m
        ),
      }));
    }
  };

  const handleRetryMessage = async (failedMsg: ChatMessage) => {
    if (!failedMsg || failedMsg.senderId !== currentUser.id) return;
    const convId = failedMsg.conversationId;
    const cId = failedMsg.clientMessageId || failedMsg.id;
    setMessagesMap((prev) => ({
      ...prev,
      [convId]: (prev[convId] || []).map((m) =>
        m.id === failedMsg.id ? { ...m, status: 'sending' as const } : m
      ),
    }));

    try {
      const res = await sendChatMessageApi({
        conversationId: convId,
        clientMessageId: cId,
        content: failedMsg.content,
        attachment: failedMsg.attachment,
        replyTo: failedMsg.replyTo,
      });
      if (res.message) {
        setMessagesMap((prev) => ({
          ...prev,
          [convId]: mergeChatMessagesList(prev[convId] || [], [res.message], deletedMessageIdsRef.current),
        }));
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, lastMessage: res.message, updatedAt: res.message.createdAt } : c
          )
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Still unable to send message. Tap Retry again.', 'error');
      setMessagesMap((prev) => ({
        ...prev,
        [convId]: (prev[convId] || []).map((m) =>
          m.id === failedMsg.id ? { ...m, status: 'failed' as const } : m
        ),
      }));
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeConversation) return;
    const convId = activeConversation.id;
    const list = messagesMap[convId] || [];
    const target = list.find((m) => m.id === messageId);
    if (!target) return;

    if (target.senderId !== currentUser.id) {
      showToast('Only the sender can delete this message.', 'error');
      return;
    }

    // Local-only unsent/failed draft message can be removed locally without server call
    if (target.id.startsWith('cmsg_') && (target.status === 'failed' || target.status === 'sending')) {
      const deletedAt = new Date().toISOString();
      deletedMessageIdsRef.current = {
        ...deletedMessageIdsRef.current,
        [target.id]: deletedAt,
      };
      const nextList = list.filter((m) => m.id !== target.id);
      setMessagesMap((prev) => ({ ...prev, [convId]: nextList }));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                lastMessage: nextList.length > 0 ? nextList[nextList.length - 1] : undefined,
                updatedAt: (nextList.length > 0 ? nextList[nextList.length - 1].createdAt : c.updatedAt),
              }
            : c
        )
      );
      showToast('Message removed.', 'info');
      return;
    }

    try {
      const res = await deleteChatMessageApi(target.id);
      const deletedAt = res.deletedAt || new Date().toISOString();
      const canonicalId = res.messageId || target.id;
      deletedMessageIdsRef.current = {
        ...deletedMessageIdsRef.current,
        [canonicalId]: deletedAt,
      };
      if (user?.id) {
        safeStorage.setJSON(getPeerDeletedMessagesStorageKey(user.id), deletedMessageIdsRef.current);
        pushAccountSyncPatch(
          user.id,
          { deletedPeerMessages: { [canonicalId]: deletedAt } },
          undefined,
          { immediate: true }
        );
      }

      const currentList = messagesMapRef.current[convId] || [];
      const nextList = currentList.filter(
        (m) => m.id !== canonicalId && m.id !== target.id
      );
      const nextMap = {
        ...messagesMapRef.current,
        [convId]: nextList,
      };
      messagesMapRef.current = nextMap;
      setMessagesMap(nextMap);
      setConversations((cPrev) =>
        cPrev.map((c) => {
          if (c.id !== convId) return c;
          const fallbackLast = nextList.length > 0 ? nextList[nextList.length - 1] : undefined;
          const nextLast = res.lastMessage ?? fallbackLast;
          return {
            ...c,
            lastMessage: nextLast || undefined,
            updatedAt: nextLast?.createdAt || c.updatedAt,
          };
        })
      );
      showToast('Message deleted.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Could not delete message.', 'error');
    }
  };

  const handleReactToMessage = async (messageId: string, emoji: string) => {
    if (!activeConversation) return;
    const convId = activeConversation.id;
    try {
      const res = await reactToMessageApi(messageId, emoji);
      if (res.reactions) {
        setMessagesMap((prev) => ({
          ...prev,
          [convId]: (prev[convId] || []).map((m) =>
            m.id === messageId ? { ...m, reactions: res.reactions } : m
          ),
        }));
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not save reaction.', 'error');
    }
  };

  // Friend Request lifecycle actions
  const handleSendFriendRequest = async (targetUserId: string, note?: string) => {
    try {
      const res = await sendFriendRequestApi(targetUserId, note);
      if (!res?.ok) {
        throw new Error('Could not send friend request.');
      }
      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === targetUserId
            ? { ...u, friendStatus: res.status === 'accepted' ? 'friends' : 'pending_sent' }
            : u
        )
      );
      if (res.request) {
        setFriendRequests((prev) => [
          res.request,
          ...prev.filter((r) => r.id !== res.request.id),
        ]);
      }
      if (res.conversation) {
        setConversations((prev) => [
          res.conversation!,
          ...prev.filter((c) => c.id !== res.conversation!.id),
        ]);
      }
      showToast(
        res.status === 'accepted'
          ? 'Connection accepted automatically!'
          : 'Friend request sent.',
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Could not send friend request.', 'error');
      throw err;
    }
  };

  const handleAcceptFriendRequest = async (senderId: string) => {
    try {
      const res = await respondFriendRequestApi(senderId, 'accept');
      setAllUsers((prev) =>
        prev.map((u) => (u.id === senderId ? { ...u, friendStatus: 'friends' } : u))
      );
      if (res.request) {
        setFriendRequests((prev) =>
          prev.map((r) => (r.id === res.request.id || (r.senderId === senderId && r.receiverId === currentUser.id) ? res.request : r))
        );
      }
      if (res.conversation) {
        setConversations((prev) => [
          res.conversation!,
          ...prev.filter((c) => c.id !== res.conversation!.id),
        ]);
        setActiveConversationId(res.conversation.id);
        setMobileView('chat');
      }
      showToast('Connection accepted. Direct messaging unlocked.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not accept friend request.', 'error');
      throw err;
    }
  };

  const handleDeclineFriendRequest = async (senderId: string) => {
    try {
      const res = await respondFriendRequestApi(senderId, 'decline');
      setAllUsers((prev) =>
        prev.map((u) => (u.id === senderId ? { ...u, friendStatus: 'none' } : u))
      );
      if (res.request) {
        setFriendRequests((prev) =>
          prev.map((r) => (r.id === res.request.id || (r.senderId === senderId && r.receiverId === currentUser.id) ? res.request : r))
        );
      }
      showToast('Friend request declined.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Could not decline friend request.', 'error');
      throw err;
    }
  };

  const handleCancelOrRemoveFriend = async (targetUserId: string) => {
    try {
      await removeFriendshipApi(targetUserId);
      setAllUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, friendStatus: 'none' } : u))
      );
      setFriendRequests((prev) =>
        prev.filter(
          (r) =>
            !(
              (r.senderId === currentUser.id && r.receiverId === targetUserId) ||
              (r.senderId === targetUserId && r.receiverId === currentUser.id)
            )
        )
      );
      showToast('Connection updated.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Could not update connection.', 'error');
      throw err;
    }
  };

  const handleStartDirectChat = useCallback(async (targetUserId: string) => {
    const existing = conversations.find(
      (c) => c.type === 'direct' && c.participants.includes(targetUserId)
    );
    if (existing) {
      setIsFindFriendsOpen(false);
      await handleSelectConversation(existing.id);
      return;
    }

    try {
      const res = await openDirectConversationApi(targetUserId);
      if (res.conversation) {
        setConversations((prev) => [
          res.conversation,
          ...prev.filter((c) => c.id !== res.conversation.id),
        ]);
        setMessagesMap((prev) => ({
          ...prev,
          [res.conversation.id]: res.messages || [],
        }));
        setIsFindFriendsOpen(false);
        await handleSelectConversation(res.conversation.id);
      }
    } catch (err: any) {
      showToast(err?.message || 'Connect as friends first to start chatting.', 'error');
    }
  }, [conversations, handleSelectConversation, showToast]);
  handleStartDirectChatRef.current = handleStartDirectChat;

  const handleCreateGroup = async (params: {
    name: string;
    description?: string;
    participantIds: string[];
    groupRoleType?: Conversation['groupRoleType'];
    subjectTag?: string;
  }) => {
    const res = await createGroupConversationApi(params);
    if (res.conversation) {
      setConversations((prev) => [
        res.conversation,
        ...prev.filter((c) => c.id !== res.conversation.id),
      ]);
      setActiveConversationId(res.conversation.id);
      setMobileView('chat');
      showToast(`Study group "${res.conversation.name}" created.`, 'success');
    }
  };

  const handleAddGroupMember = async (conversationId: string, memberId: string) => {
    try {
      const res = await addGroupMemberApi(conversationId, memberId);
      if (res.conversation) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, ...res.conversation } : c))
        );
        showToast('Member added to study group.', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not add group member.', 'error');
    }
  };

  // Call handlers
  const handleStartCall = (type: 'audio' | 'video') => {
    if (!activePartner) return;
    setCallSession({
      isActive: true,
      type,
      partner: activePartner,
      startTime: Date.now(),
      isMuted: false,
      isVideoOff: false,
      status: 'connected',
    });
  };

  const handleEndCall = () => {
    setCallSession((prev) => ({ ...prev, isActive: false, partner: null }));
  };

  // Shared Notes Action Handlers
  const handleSaveNote = async (savedNote: SharedBookNote) => {
    setSharedNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === savedNote.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = savedNote;
        return updated;
      }
      return [savedNote, ...prev];
    });
    setIsNoteEditorOpen(false);
    setNoteToEdit(null);
    await syncNoteToSupabase(savedNote);
  };

  const handleDeleteNote = async (noteId: string) => {
    setSharedNotes((prev) => prev.filter((n) => n.id !== noteId));
    setSelectedNoteForDetail(null);
    await deleteNoteFromSupabase(noteId);
  };

  const handleShareNoteToChat = (note: SharedBookNote) => {
    const convId = activeConversation?.id || conversations[0]?.id;
    if (!convId) {
      showToast('Select a conversation before sharing a book takeaway.', 'info');
      return;
    }

    const attachment: ChatAttachment = {
      type: 'note',
      name: note.title,
      bookId: note.bookId,
      bookTitle: note.bookTitle,
      bookAuthor: note.bookAuthor,
      noteId: note.id,
      noteTakeaways: note.keyTakeaways,
      notePermission: note.permissionType,
    };

    if (!activeConversation) {
      setActiveConversationId(convId);
      setMobileView('chat');
    }

    handleSendMessage(
      `Shared book takeaway: "${note.title}" (${note.bookTitle})`,
      attachment
    );

    setSelectedNoteForDetail(null);
    setIsNotesPanelOpen(false);
  };

  const handleOpenNoteDetail = (noteId: string) => {
    const found = sharedNotes.find((n) => n.id === noteId);
    if (found) setSelectedNoteForDetail(found);
  };

  const friendsCount = useMemo(
    () => allUsers.filter((u) => u.id !== currentUser.id && u.friendStatus === 'friends').length,
    [allUsers, currentUser.id]
  );

  const onlineCount = useMemo(
    () => allUsers.filter((u) => u.id !== currentUser.id && u.friendStatus === 'friends' && u.status === 'online').length,
    [allUsers, currentUser.id]
  );

  const pendingRequestsCount = useMemo(
    () => allUsers.filter((u) => u.id !== currentUser.id && u.friendStatus === 'pending_received').length,
    [allUsers, currentUser.id]
  );

  useEffect(() => {
    const unreadMessages = conversations.reduce((sum, c) => sum + Number(c.unreadCount || 0), 0);
    window.dispatchEvent(
      new CustomEvent('eduai_social_counts_updated', {
        detail: { incomingCount: pendingRequestsCount, unreadMessages },
      })
    );
  }, [pendingRequestsCount, conversations]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
      {/* Status Toast */}
      {toastBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[130] px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-150 bg-slate-900 text-white border-slate-700">
          {toastBanner.text}
        </div>
      )}

      {/* Left Sidebar */}
      <div className={`w-full md:w-80 lg:w-[348px] flex-col shrink-0 h-full ${mobileView === 'list' ? 'flex' : 'hidden md:flex'}`}>
        <ChatSidebar
          currentUser={currentUser}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onStartDirectChat={handleStartDirectChat}
          users={allUsers}
          friendRequests={friendRequests}
          onSendFriendRequest={(uid) => void handleSendFriendRequest(uid).catch(() => {})}
          onAcceptFriendRequest={(uid) => void handleAcceptFriendRequest(uid).catch(() => {})}
          onDeclineFriendRequest={(uid) => void handleDeclineFriendRequest(uid).catch(() => {})}
          onCancelFriendRequest={(uid) => void handleCancelOrRemoveFriend(uid).catch(() => {})}
          onOpenFindFriends={() => {
            setIsFindFriendsOpen(true);
            void hydrateFromServer();
          }}
          onOpenCreateGroup={() => {
            setIsCreateGroupOpen(true);
            void hydrateFromServer();
          }}
          onRefreshDirectory={() => void hydrateFromServer()}
          socialError={socialError}
          typingByConversation={typingNamesMap}
          isWsConnected={isWsConnected}
        />
      </div>

      {/* Main Conversation Window */}
      <div className={`flex-1 flex-col h-full min-w-0 ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'}`}>
        {activeConversation ? (
          <ChatWindow
            currentUser={currentUser}
            conversation={activeConversation}
            partner={activePartner}
            messages={activeMessages}
            allUsers={allUsers}
            onSendMessage={handleSendMessage}
            onRetryMessage={handleRetryMessage}
            onDeleteMessage={handleDeleteMessage}
            onReactToMessage={handleReactToMessage}
            onStartCall={handleStartCall}
            onToggleInfoDrawer={() => setIsInfoDrawerOpen((prev) => !prev)}
            isInfoDrawerOpen={isInfoDrawerOpen}
            onBackToList={() => {
              setActiveConversationId('');
              setMobileView('list');
            }}
            onSendFriendRequest={(uid) => void handleSendFriendRequest(uid).catch(() => {})}
            onAcceptFriendRequest={(uid) => void handleAcceptFriendRequest(uid).catch(() => {})}
            onDeclineFriendRequest={(uid) => void handleDeclineFriendRequest(uid).catch(() => {})}
            isPartnerTyping={activeTypingUsers.length > 0}
            typingUserName={activeTypingUsers[0]}
            onTyping={(isTyping) => socialWsClient.sendTyping(activeConversation.id, isTyping)}
            onOpenSharedNotes={() => setIsNotesPanelOpen(true)}
            onSelectSharedNote={handleOpenNoteDetail}
          />
        ) : (
          <ChatEmptyState
            onOpenFindFriends={() => setIsFindFriendsOpen(true)}
            onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
            onOpenSharedNotes={() => setIsNotesPanelOpen(true)}
            onlineCount={onlineCount}
            friendsCount={friendsCount}
            pendingRequestsCount={pendingRequestsCount}
          />
        )}
      </div>

      {/* Right Info Drawer */}
      {activeConversation && isInfoDrawerOpen && (
        <ChatInfoDrawer
          isOpen={isInfoDrawerOpen}
          onClose={() => setIsInfoDrawerOpen(false)}
          conversation={activeConversation}
          partner={activePartner}
          allUsers={allUsers}
          messages={activeMessages}
          onStartCall={handleStartCall}
          onUnfriend={activePartner ? (uid) => void handleCancelOrRemoveFriend(uid).catch(() => {}) : undefined}
          onAddGroupMember={handleAddGroupMember}
          onOpenSharedNotes={() => {
            setIsInfoDrawerOpen(false);
            setIsNotesPanelOpen(true);
          }}
        />
      )}

      {/* Slide-over Shared Notes Drawer */}
      {isNotesPanelOpen && (
        <>
          <div
            onClick={() => setIsNotesPanelOpen(false)}
            className="fixed inset-0 bg-black/40 z-[105] md:hidden backdrop-blur-xs transition-opacity"
          />
          <div className="fixed inset-y-0 right-0 z-[110] w-full sm:w-96 lg:w-100 border-l border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111b21] flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="h-full flex flex-col relative">
              <SharedNotesPanel
                currentUser={currentUser}
                notes={sharedNotes}
                activeConversation={activeConversation}
                onOpenCreateNote={() => {
                  setNoteToEdit(null);
                  setIsNoteEditorOpen(true);
                }}
                onSelectNote={(note) => setSelectedNoteForDetail(note)}
                onEditNote={(note) => {
                  setNoteToEdit(note);
                  setIsNoteEditorOpen(true);
                }}
                onShareNoteToChat={handleShareNoteToChat}
                onClose={() => setIsNotesPanelOpen(false)}
              />
              <button
                onClick={() => setIsNotesPanelOpen(false)}
                className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer text-xs font-bold"
                title="Close drawer"
              >
                ✕
              </button>
            </div>
          </div>
        </>
      )}

      {/* Note Editor & Detail Modals */}
      <NoteEditorModal
        isOpen={isNoteEditorOpen}
        onClose={() => {
          setIsNoteEditorOpen(false);
          setNoteToEdit(null);
        }}
        noteToEdit={noteToEdit}
        currentUser={currentUser}
        allUsers={allUsers}
        conversations={conversations}
        activeConversation={activeConversation}
        onSaveNote={handleSaveNote}
      />

      <NoteDetailModal
        isOpen={!!selectedNoteForDetail}
        onClose={() => setSelectedNoteForDetail(null)}
        note={selectedNoteForDetail}
        currentUser={currentUser}
        onEditNote={(note) => {
          setSelectedNoteForDetail(null);
          setNoteToEdit(note);
          setIsNoteEditorOpen(true);
        }}
        onDeleteNote={handleDeleteNote}
        onShareToChat={handleShareNoteToChat}
      />

      {/* Find Friends Directory Modal */}
      <FindFriendsModal
        isOpen={isFindFriendsOpen}
        onClose={() => setIsFindFriendsOpen(false)}
        currentUser={currentUser}
        users={allUsers}
        onSendRequest={handleSendFriendRequest}
        onAcceptRequest={handleAcceptFriendRequest}
        onDeclineRequest={handleDeclineFriendRequest}
        onCancelRequest={handleCancelOrRemoveFriend}
        onStartChat={handleStartDirectChat}
        onRefresh={() => hydrateFromServer()}
        isLoading={isLoadingSocial}
        error={socialError}
      />

      {/* Create Study Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        currentUser={currentUser}
        users={allUsers}
        onCreateGroup={handleCreateGroup}
        onOpenFindFriends={() => setIsFindFriendsOpen(true)}
      />

      {/* Call Modal */}
      {callSession.isActive && (
        <CallModal
          callSession={callSession}
          onEndCall={handleEndCall}
          onToggleMute={() => setCallSession((prev) => ({ ...prev, isMuted: !prev.isMuted }))}
          onToggleVideo={() => setCallSession((prev) => ({ ...prev, isVideoOff: !prev.isVideoOff }))}
        />
      )}
    </div>
  );
};
