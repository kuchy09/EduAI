import { ChatAttachment, ChatMessage, ChatUser, Conversation, FriendRequestRecord, CommunityPost } from '../components/chat/types';
import { getPersistedDeviceSession } from './supabase';
import { getStoredNotifications, saveStoredNotifications, AppNotification } from './notifications';

export interface SocialBootstrapPayload {
  currentUser: ChatUser;
  users: ChatUser[];
  friendRequests: FriendRequestRecord[];
  conversations: Conversation[];
  messagesByConv: Record<string, ChatMessage[]>;
  onlineUserIds: string[];
}

export type SocialWsEvent =
  | { type: 'auth:ok'; userId: string; onlineUserIds: string[] }
  | { type: 'presence:update'; onlineUserIds: string[] }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'chat:typing'; conversationId: string; userId: string; name: string; isTyping: boolean }
  | { type: 'chat:read'; conversationId: string; readerId: string; messageIds: string[]; seenAt: string }
  | { type: 'chat:reaction'; conversationId: string; messageId: string; reactions: Record<string, string[]> }
  | { type: 'chat:conversation'; conversation: Conversation }
  | { type: 'friend:request'; request: FriendRequestRecord; sender: Partial<ChatUser> }
  | { type: 'friend:responded'; action: 'accept' | 'decline'; request: FriendRequestRecord; conversation?: Conversation; actor?: Partial<ChatUser> }
  | { type: 'friend:removed'; actorId: string; targetId: string };

function getAuthToken(): string {
  const sess = getPersistedDeviceSession();
  const token = sess?.access_token;
  if (!token || token === 'demo_token' || token === 'local_token') return '';
  return token;
}

async function socialFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchSocialBootstrap(): Promise<SocialBootstrapPayload> {
  const res = await socialFetch<SocialBootstrapPayload & { ok: boolean }>('/api/social/bootstrap');
  return res;
}

export async function searchSocialDirectory(q = '', role = 'all'): Promise<{ users: ChatUser[]; currentUser?: ChatUser }> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (role && role !== 'all') params.set('role', role);
  const query = params.toString();
  return socialFetch(`/api/social/users${query ? `?${query}` : ''}`);
}

export async function updateSocialProfileApi(patch: Partial<ChatUser>): Promise<ChatUser> {
  const res = await socialFetch<{ ok: boolean; profile: ChatUser }>('/api/social/profile', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
  return res.profile;
}

export async function sendFriendRequestApi(receiverId: string, note?: string) {
  return socialFetch<{
    ok: boolean;
    status: 'pending' | 'accepted';
    request: FriendRequestRecord;
    conversation?: Conversation;
  }>('/api/social/friend-requests', {
    method: 'POST',
    body: JSON.stringify({ receiverId, note }),
  });
}

export async function respondFriendRequestApi(senderId: string, action: 'accept' | 'decline') {
  return socialFetch<{
    ok: boolean;
    request: FriendRequestRecord;
    conversation?: Conversation;
  }>('/api/social/friend-requests/respond', {
    method: 'POST',
    body: JSON.stringify({ senderId, action }),
  });
}

export async function removeFriendshipApi(targetId: string) {
  return socialFetch<{ ok: boolean }>(`/api/social/friend-requests/${encodeURIComponent(targetId)}`, {
    method: 'DELETE',
  });
}

export async function openDirectConversationApi(partnerId: string) {
  return socialFetch<{ ok: boolean; conversation: Conversation; messages: ChatMessage[] }>(
    '/api/social/conversations/direct',
    {
      method: 'POST',
      body: JSON.stringify({ partnerId }),
    }
  );
}

export async function createGroupConversationApi(params: {
  name: string;
  description?: string;
  participantIds: string[];
  groupRoleType?: Conversation['groupRoleType'];
  subjectTag?: string;
}) {
  return socialFetch<{ ok: boolean; conversation: Conversation }>('/api/social/conversations/group', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function addGroupMemberApi(conversationId: string, memberId: string) {
  return socialFetch<{ ok: boolean; conversation: Conversation }>(
    `/api/social/conversations/${encodeURIComponent(conversationId)}/members`,
    {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    }
  );
}

export async function fetchConversationMessagesApi(conversationId: string) {
  return socialFetch<{ ok: boolean; messages: ChatMessage[] }>(
    `/api/social/conversations/${encodeURIComponent(conversationId)}/messages`
  );
}

export async function sendChatMessageApi(params: {
  conversationId: string;
  clientMessageId?: string;
  content: string;
  attachment?: ChatAttachment;
  replyTo?: ChatMessage['replyTo'];
}) {
  return socialFetch<{ ok: boolean; message: ChatMessage }>('/api/social/messages', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function markConversationReadApi(conversationId: string) {
  return socialFetch<{ ok: boolean; updatedMessageIds: string[]; seenAt: string }>(
    `/api/social/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: 'POST' }
  );
}

export async function reactToMessageApi(messageId: string, emoji: string) {
  return socialFetch<{ ok: boolean; reactions: Record<string, string[]> }>(
    `/api/social/messages/${encodeURIComponent(messageId)}/react`,
    {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }
  );
}

export async function fetchCommunityPostsApi(): Promise<CommunityPost[]> {
  const res = await socialFetch<{ ok: boolean; posts: CommunityPost[] }>('/api/social/community/posts');
  return res.posts || [];
}

export async function createCommunityPostApi(params: { title: string; content: string; tags?: string[] }): Promise<CommunityPost> {
  const res = await socialFetch<{ ok: boolean; post: CommunityPost }>('/api/social/community/posts', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.post;
}

export async function toggleCommunityLikeApi(postId: string): Promise<CommunityPost> {
  const res = await socialFetch<{ ok: boolean; post: CommunityPost }>(
    `/api/social/community/posts/${encodeURIComponent(postId)}/like`,
    { method: 'POST' }
  );
  return res.post;
}

export async function addCommunityReplyApi(postId: string, content: string): Promise<CommunityPost> {
  const res = await socialFetch<{ ok: boolean; post: CommunityPost }>(
    `/api/social/community/posts/${encodeURIComponent(postId)}/replies`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    }
  );
  return res.post;
}

export function pushPeerActivityNotification(params: {
  id?: string;
  title: string;
  message: string;
  authorName: string;
  authorRole?: 'Teacher' | 'Classmate';
  actionLabel?: string;
  actionView?: 'chat' | 'users-portal' | 'community';
  tags?: string[];
}) {
  try {
    const existing = getStoredNotifications();
    const id = params.id || `peer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (existing.some((n) => n.id === id)) return;

    const newNotif: AppNotification = {
      id,
      type: 'peer',
      title: params.title,
      message: params.message,
      timestamp: 'Just now',
      createdAt: Date.now(),
      isRead: false,
      priority: 'high',
      author: {
        name: params.authorName,
        role: params.authorRole || 'Classmate',
        badge: 'Direct Connection',
      },
      actionLabel: params.actionLabel || 'Open Chat',
      actionView: params.actionView || 'chat',
      tags: params.tags || ['Social', 'Connection'],
    };

    saveStoredNotifications([newNotif, ...existing.slice(0, 49)]);
  } catch (_) {}
}

type Listener = (event: SocialWsEvent) => void;
type StatusListener = (connected: boolean) => void;

class SocialWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private attempt = 0;
  private shouldRun = false;
  private connected = false;

  public start() {
    if (typeof window === 'undefined') return;
    this.shouldRun = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.connect();
  }

  public stop() {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.setConnected(false);
  }

  public isConnected() {
    return this.connected;
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  public subscribeStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    fn(this.connected);
    return () => {
      this.statusListeners.delete(fn);
    };
  }

  public sendTyping(conversationId: string, isTyping: boolean) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'typing', conversationId, isTyping }));
      } catch (_) {}
    }
  }

  public sendRead(conversationId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'read', conversationId }));
      } catch (_) {}
    }
  }

  private setConnected(val: boolean) {
    if (this.connected !== val) {
      this.connected = val;
      for (const fn of this.statusListeners) {
        try {
          fn(val);
        } catch (_) {}
      }
    }
  }

  private connect() {
    if (!this.shouldRun) return;
    const token = getAuthToken();
    if (!token) {
      this.scheduleReconnect();
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/chat?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.attempt = 0;
        this.setConnected(true);
        try {
          ws.send(JSON.stringify({ type: 'auth', token }));
        } catch (_) {}

        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping' }));
            } catch (_) {}
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload || typeof payload !== 'object' || payload.type === 'pong') return;
          for (const fn of this.listeners) {
            try {
              fn(payload as SocialWsEvent);
            } catch (_) {}
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }
        this.ws = null;
        this.setConnected(false);
        if (this.shouldRun) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = () => {
        // onclose handles backoff reconnect
      };
    } catch (_) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.shouldRun || this.reconnectTimer) return;
    const base = Math.min(15000, 1000 * Math.pow(1.6, this.attempt));
    const jitter = Math.floor(Math.random() * 400);
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, base + jitter);
  }
}

export const socialWsClient = new SocialWebSocketClient();
