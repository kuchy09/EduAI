import { ChatAttachment, ChatMessage, ChatUser, Conversation, FriendRequestRecord, CommunityPost } from '../components/chat/types';
import {
  authorizeInteractiveSession,
  ensureSupabaseRuntimeConfig,
  getPersistedDeviceSession,
  getSupabaseClient,
  supabase,
} from './supabase';
import { getStoredNotifications, saveStoredNotifications, AppNotification } from './notifications';

export const SOCIAL_SESSION_REFRESHED_EVENT = 'eduai_session_refreshed';

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
  | { type: 'social:directory-updated'; userId?: string; updatedAt?: string }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'chat:typing'; conversationId: string; userId: string; name: string; isTyping: boolean }
  | { type: 'chat:read'; conversationId: string; readerId: string; messageIds: string[]; seenAt: string }
  | { type: 'chat:reaction'; conversationId: string; messageId: string; reactions: Record<string, string[]> }
  | { type: 'chat:conversation'; conversation: Conversation }
  | { type: 'friend:request'; request: FriendRequestRecord; sender: Partial<ChatUser> }
  | { type: 'friend:responded'; action: 'accept' | 'decline'; request: FriendRequestRecord; conversation?: Conversation; actor?: Partial<ChatUser> }
  | { type: 'friend:removed'; actorId: string; targetId: string }
  | { type: 'system:books-updated'; bookId?: string; action?: string; updatedAt?: string }
  | { type: 'system:covers-updated'; bookId?: string; covers?: Record<string, any>; updatedAt?: string }
  | { type: 'system:notification'; notification: AppNotification; updatedAt?: string }
  | { type: 'account:sync-updated'; userId: string; updatedAt?: string };

let refreshInFlight: Promise<string> | null = null;
let inMemorySocialSession: { accessToken: string; refreshToken: string; userId?: string } | null = null;

function cleanAccessTokenVal(token: any): string {
  const s = typeof token === 'string' ? token.replace(/[\r\n]+/g, '').trim() : '';
  return s && s !== 'demo_token' && s !== 'local_token' ? s : '';
}

function isOversizedJwtToken(token: string): boolean {
  return token.length > 3500;
}

export function setActiveSocialTokens(
  tokens: { accessToken?: string | null; refreshToken?: string | null; userId?: string | null } | null
): void {
  if (!tokens) {
    inMemorySocialSession = null;
    socialWsClient.handleSessionChange(null, undefined);
    return;
  }
  const cleanAccess = cleanAccessTokenVal(tokens.accessToken);
  if (!cleanAccess) {
    inMemorySocialSession = null;
    socialWsClient.handleSessionChange(null, undefined);
    return;
  }
  const uid = tokens.userId ? String(tokens.userId) : undefined;
  inMemorySocialSession = {
    accessToken: cleanAccess,
    refreshToken: typeof tokens.refreshToken === 'string' ? tokens.refreshToken.replace(/[\r\n]+/g, '').trim() : '',
    userId: uid,
  };
  socialWsClient.handleSessionChange(cleanAccess, uid);
}

function emitRefreshedSession(nextSession: any): void {
  if (typeof window === 'undefined' || !nextSession?.user?.id || !nextSession?.access_token) return;
  try {
    window.dispatchEvent(
      new CustomEvent(SOCIAL_SESSION_REFRESHED_EVENT, {
        detail: { session: nextSession },
      })
    );
  } catch (_) {}
}

function persistRefreshedSessionObject(nextSession: any, fallbackRefreshToken = '', fallbackUserId?: string): void {
  const cleanAccess = cleanAccessTokenVal(nextSession?.access_token);
  const uid = nextSession?.user?.id || fallbackUserId;
  if (!cleanAccess || !uid) return;
  const nextRefresh =
    typeof nextSession?.refresh_token === 'string' && nextSession.refresh_token.trim()
      ? nextSession.refresh_token.replace(/[\r\n]+/g, '').trim()
      : fallbackRefreshToken;
  const normalized = {
    ...nextSession,
    access_token: cleanAccess,
    refresh_token: nextRefresh,
    user: nextSession.user || { id: uid },
  };
  authorizeInteractiveSession(uid, normalized);
  setActiveSocialTokens({
    accessToken: cleanAccess,
    refreshToken: nextRefresh,
    userId: uid,
  });
  emitRefreshedSession(normalized);
}

function getSessionTokens(): { accessToken: string; refreshToken: string; userId?: string } {
  const sess = getPersistedDeviceSession();
  const cleanAccess = cleanAccessTokenVal(sess?.access_token);
  const cleanRefresh =
    typeof sess?.refresh_token === 'string' && sess.refresh_token.trim()
      ? sess.refresh_token.replace(/[\r\n]+/g, '').trim()
      : '';
  if (cleanAccess) {
    return {
      accessToken: cleanAccess,
      refreshToken: cleanRefresh || (inMemorySocialSession?.userId === sess?.user?.id ? inMemorySocialSession?.refreshToken || '' : ''),
      userId: sess?.user?.id,
    };
  }
  if (inMemorySocialSession?.accessToken) {
    return { ...inMemorySocialSession };
  }
  return {
    accessToken: '',
    refreshToken: cleanRefresh,
    userId: sess?.user?.id,
  };
}

function getAuthToken(): string {
  return getSessionTokens().accessToken;
}

async function getSessionTokensWithFallback(): Promise<{ accessToken: string; refreshToken: string; userId?: string }> {
  const existing = getSessionTokens();
  if (existing.accessToken) return existing;

  let client = getSupabaseClient() || supabase;
  if (!client) {
    try {
      const cfg = await ensureSupabaseRuntimeConfig();
      client = cfg.client || getSupabaseClient();
    } catch (_) {}
  }

  if (client) {
    try {
      const { data } = await client.auth.getSession();
      const sbSess = data?.session;
      const cleanAccess = cleanAccessTokenVal(sbSess?.access_token);
      if (sbSess?.user?.id && cleanAccess) {
        authorizeInteractiveSession(sbSess.user.id, sbSess);
        setActiveSocialTokens({
          accessToken: cleanAccess,
          refreshToken: sbSess.refresh_token || '',
          userId: sbSess.user.id,
        });
        return {
          accessToken: cleanAccess,
          refreshToken: sbSess.refresh_token || '',
          userId: sbSess.user.id,
        };
      }
    } catch (_) {}
  }

  return existing;
}

export async function refreshSocialSessionIfPossible(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const { accessToken, refreshToken, userId } = await getSessionTokensWithFallback();
      const client = getSupabaseClient() || supabase;
      if (client) {
        try {
          const { data } = await client.auth.refreshSession();
          if (data?.session?.access_token && data?.session?.user?.id) {
            persistRefreshedSessionObject(data.session, refreshToken, userId);
            return String(data.session.access_token);
          }
        } catch (_) {}
      }
      if (!accessToken || !refreshToken) return '';

      let res: Response | null = null;
      if (!isOversizedJwtToken(accessToken)) {
        res = await fetch('/api/auth/user', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'x-refresh-token': refreshToken,
          },
        }).catch(() => null);
      }

      if (!res || res.status === 400 || res.status === 431) {
        res = await fetch('/api/auth/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
          }),
        });
      }

      if (!res.ok) return '';
      const data = await res.json().catch(() => null);
      if (data?.refreshedSession?.access_token && data?.refreshedSession?.user?.id) {
        persistRefreshedSessionObject(data.refreshedSession, refreshToken, userId);
        return String(data.refreshedSession.access_token);
      }
      if (data?.user?.id) {
        setActiveSocialTokens({
          accessToken,
          refreshToken,
          userId: data.user.id || userId,
        });
        return accessToken;
      }
      return '';
    } catch {
      return '';
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function buildBodyAuthRequest(
  path: string,
  options: RequestInit,
  tok: string,
  refTok: string
): { url: string; init: RequestInit } | null {
  const method = String(options.method || 'GET').toUpperCase();
  if (path === '/api/social/bootstrap') {
    return {
      url: '/api/social/bootstrap',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...((options.headers as Record<string, string>) || {}),
        },
        body: JSON.stringify({ access_token: tok, refresh_token: refTok || undefined }),
      },
    };
  }
  if (path.startsWith('/api/social/users')) {
    const qIdx = path.indexOf('?');
    const params = qIdx >= 0 ? new URLSearchParams(path.slice(qIdx + 1)) : new URLSearchParams();
    return {
      url: '/api/social/users/search',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...((options.headers as Record<string, string>) || {}),
        },
        body: JSON.stringify({
          q: params.get('q') || '',
          role: params.get('role') || 'all',
          access_token: tok,
          refresh_token: refTok || undefined,
        }),
      },
    };
  }
  if (method === 'POST' || method === 'PUT') {
    let parsedBody: Record<string, any> = {};
    if (typeof options.body === 'string' && options.body.trim()) {
      try {
        parsedBody = JSON.parse(options.body);
      } catch (_) {}
    }
    return {
      url: path,
      init: {
        ...options,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...((options.headers as Record<string, string>) || {}),
        },
        body: JSON.stringify({
          ...parsedBody,
          _accessToken: tok,
          ...(refTok ? { _refreshToken: refTok } : {}),
        }),
      },
    };
  }
  return null;
}

async function socialFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken, refreshToken, userId } = await getSessionTokensWithFallback();
  if (!accessToken) {
    throw new Error('Authentication required');
  }

  const performHeaderFetch = (tok: string, refTok: string) => {
    const method = String(options.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${tok}`,
      ...(refTok ? { 'x-refresh-token': refTok } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };
    if (options.body !== undefined && method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(path, {
      ...options,
      headers,
    });
  };

  const applyHeaderRefresh = (response: Response, refTok: string) => {
    const headerNewAccess = response.headers.get('x-refreshed-access-token');
    const headerNewRefresh = response.headers.get('x-refreshed-refresh-token');
    if (!headerNewAccess) return;
    const currentSess = getPersistedDeviceSession();
    const resolvedUserId = currentSess?.user?.id || userId;
    if (resolvedUserId) {
      persistRefreshedSessionObject(
        {
          ...(currentSess || { user: { id: resolvedUserId } }),
          access_token: headerNewAccess,
          refresh_token: headerNewRefresh || currentSess?.refresh_token || refTok,
        },
        refTok,
        resolvedUserId
      );
    }
  };

  let res: Response;
  const bodyAlt = buildBodyAuthRequest(path, options, accessToken, refreshToken);
  if (isOversizedJwtToken(accessToken) && bodyAlt) {
    res = await fetch(bodyAlt.url, bodyAlt.init);
  } else {
    res = await performHeaderFetch(accessToken, refreshToken);
    if ((res.status === 400 || res.status === 431) && bodyAlt) {
      res = await fetch(bodyAlt.url, bodyAlt.init);
    }
  }

  applyHeaderRefresh(res, refreshToken);

  if (res.status === 401 || ((res.status === 400 || res.status === 431) && !bodyAlt)) {
    const nextToken = await refreshSocialSessionIfPossible();
    if (nextToken && nextToken !== accessToken) {
      const latest = getSessionTokens();
      const nextRefresh = latest.refreshToken || refreshToken;
      const nextBodyAlt = buildBodyAuthRequest(path, options, nextToken, nextRefresh);
      if (isOversizedJwtToken(nextToken) && nextBodyAlt) {
        res = await fetch(nextBodyAlt.url, nextBodyAlt.init);
      } else {
        res = await performHeaderFetch(nextToken, nextRefresh);
        if ((res.status === 400 || res.status === 431) && nextBodyAlt) {
          res = await fetch(nextBodyAlt.url, nextBodyAlt.init);
        }
      }
      applyHeaderRefresh(res, nextRefresh);
    }
  }

  const data = await res.json().catch(() => ({}));
  if (data?._refreshedSession?.access_token) {
    persistRefreshedSessionObject(data._refreshedSession, refreshToken, userId);
  }
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
  userId?: string;
  title: string;
  message: string;
  authorName: string;
  authorRole?: 'Teacher' | 'Classmate';
  actionLabel?: string;
  actionView?: 'chat' | 'users-portal' | 'community';
  tags?: string[];
}) {
  try {
    const activeUserId = params.userId || getPersistedDeviceSession()?.user?.id;
    const existing = getStoredNotifications(activeUserId);
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

    saveStoredNotifications([newNotif, ...existing.slice(0, 49)], activeUserId);
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
  private activeToken = '';
  private activeUserId: string | undefined = undefined;

  public start() {
    if (typeof window === 'undefined') return;
    this.shouldRun = true;
    const { accessToken, userId } = getSessionTokens();
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (userId && this.activeUserId && userId !== this.activeUserId) {
        this.reconnectNow();
        return;
      }
      if (accessToken && accessToken !== this.activeToken && this.ws.readyState === WebSocket.OPEN) {
        this.activeToken = accessToken;
        this.activeUserId = userId;
        try {
          this.ws.send(JSON.stringify({ type: 'auth', token: accessToken }));
        } catch (_) {}
      }
      return;
    }
    this.connect();
  }

  public handleSessionChange(accessToken: string | null, userId?: string) {
    if (!this.shouldRun) return;
    if (!accessToken) {
      this.activeToken = '';
      this.activeUserId = undefined;
      return;
    }
    if (userId && this.activeUserId && userId !== this.activeUserId) {
      this.reconnectNow();
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN && accessToken !== this.activeToken) {
      this.activeToken = accessToken;
      this.activeUserId = userId || this.activeUserId;
      try {
        this.ws.send(JSON.stringify({ type: 'auth', token: accessToken }));
      } catch (_) {}
    } else if (!this.ws && !this.reconnectTimer) {
      this.connect();
    }
  }

  private reconnectNow() {
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
    this.attempt = 0;
    if (this.shouldRun) {
      this.connect();
    }
  }

  public stop() {
    this.shouldRun = false;
    this.activeToken = '';
    this.activeUserId = undefined;
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
    const { accessToken: token, userId } = getSessionTokens();
    if (!token) {
      this.scheduleReconnect();
      return;
    }

    this.activeToken = token;
    this.activeUserId = userId;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Avoid putting oversized legacy JWTs into the HTTP Upgrade URL query string; auth frame handles all token sizes
    const url =
      token.length <= 1500
        ? `${protocol}//${window.location.host}/ws/chat?token=${encodeURIComponent(token)}`
        : `${protocol}//${window.location.host}/ws/chat`;

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.attempt = 0;
        this.setConnected(true);
        try {
          const latest = getSessionTokens();
          const authTok = latest.accessToken || token;
          this.activeToken = authTok;
          this.activeUserId = latest.userId || userId;
          ws.send(JSON.stringify({ type: 'auth', token: authTok }));
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
          if (payload.type === 'auth:ok' && payload.userId) {
            this.activeUserId = String(payload.userId);
          }
          for (const fn of this.listeners) {
            try {
              fn(payload as SocialWsEvent);
            } catch (_) {}
          }
        } catch (_) {}
      };

      ws.onclose = (ev) => {
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }
        if (this.ws === ws) {
          this.ws = null;
          this.setConnected(false);
        }
        if (ev?.code === 4001) {
          void refreshSocialSessionIfPossible();
        }
        if (this.shouldRun && !this.ws) {
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
