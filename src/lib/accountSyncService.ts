import { safeStorage } from './safeStorage';
import { getSupabaseClient, getPersistedDeviceSession } from './supabase';
import { saveStoredAcademicPrefs } from './bookPersonalization';
import { saveDailyGoal, DailyReadingGoal } from './readingGoal';
import { Book, Bookmark } from '../types';

export const ACCOUNT_SYNC_EVENT = 'edu-account-sync-updated';
export const SYNC_WORKSPACE_FILE_NAME = '__edu_account_sync__.json';
export const SYNC_WORKSPACE_FILE_TYPE = 'application/vnd.eduai.sync+json';

export interface BookCoverOverride {
  coverMode?: 'auto' | 'image' | 'visual' | 'pdf';
  coverImage?: string;
  pdfCoverPage?: number;
  customCover?: any;
  updatedAt?: string;
}

export interface AccountSyncPayload {
  aiChatSessions?: any[];
  activeAiSessionId?: string;
  deletedAiSessions?: Record<string, string>;
  readerChats?: Record<string, any[]>;
  peerConversations?: any[];
  peerMessages?: Record<string, any[]>;
  unlockedBooks?: Book[];
  bookCoverOverrides?: Record<string, BookCoverOverride>;
  bookmarks?: Bookmark[];
  profileSnapshot?: Record<string, any>;
  readingProgress?: Record<string, number>;
  dailyGoal?: DailyReadingGoal;
  updatedAt?: string;
}

const pendingPatches = new Map<string, AccountSyncPayload>();
const patchTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlightFlushes = new Map<string, Promise<void>>();
const inFlightHydrates = new Map<string, Promise<any>>();

async function resolveBearerToken(explicitToken?: string): Promise<string> {
  if (explicitToken && explicitToken !== 'demo_token' && explicitToken !== 'local_token') {
    return explicitToken;
  }
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client.auth.getSession();
      if (data?.session?.access_token) return data.session.access_token;
    } catch (_) {}
  }
  const persisted = getPersistedDeviceSession();
  return persisted?.access_token || '';
}

export function getAiChatsStorageKey(userId?: string): string {
  return `sage_ai_chats_${userId || 'guest'}`;
}

export function getAiLastActiveStorageKey(userId?: string): string {
  return `sage_ai_last_active_${userId || 'guest'}`;
}

export function getAiDeletedStorageKey(userId?: string): string {
  return `sage_ai_deleted_${userId || 'guest'}`;
}

export function getReaderChatStorageKey(bookId: string, userId?: string): string {
  return `sage_reader_chat_${userId || 'guest'}_${bookId}`;
}

export function getPeerConversationsStorageKey(userId?: string): string {
  return userId ? `eduai_chat_conversations_${userId}` : 'eduai_chat_conversations';
}

export function getPeerMessagesStorageKey(userId?: string): string {
  return userId ? `eduai_chat_messages_${userId}` : 'eduai_chat_messages';
}

export function getPeerCurrentUserStorageKey(userId?: string): string {
  return userId ? `eduai_chat_current_user_${userId}` : 'eduai_chat_current_user';
}

export function getUnlockedBooksStorageKey(userId?: string): string {
  return userId ? `edu_unlocked_books_${userId}` : 'custom_uploaded_books';
}

export const BOOK_COVER_OVERRIDES_KEY = 'edu_ai_book_cover_overrides';

export function getBookCoverOverridesStorageKey(userId?: string): string {
  return userId ? `edu_ai_book_cover_overrides_${userId}` : BOOK_COVER_OVERRIDES_KEY;
}

export function getBookmarksStorageKey(userId?: string): string {
  return userId ? `edu_bookmarks_${userId}` : 'edu_bookmarks_active';
}

function isDefaultGreetingSession(session: any): boolean {
  if (!session || typeof session !== 'object') return false;
  if (session.id === 'default_session' && Array.isArray(session.messages) && session.messages.length <= 1) {
    return true;
  }
  return false;
}

function parseMessageSortOrder(msgId: any, fallbackIdx: number): number {
  if (typeof msgId === 'string' || typeof msgId === 'number') {
    const str = String(msgId);
    if (str === '1' || str === 'welcome') return 0;
    const match = str.match(/^(\d{10,})/);
    if (match) {
      const ts = Number(match[1]);
      if (Number.isFinite(ts)) {
        return ts * 10 + (str.endsWith('ai') || str.endsWith('err') || str.endsWith('err2') ? 1 : 0);
      }
    }
  }
  return 10_000_000_000_000 + fallbackIdx;
}

export function mergeChatMessagesArray(msgsA: any[], msgsB: any[]): any[] {
  const combined = [...(Array.isArray(msgsA) ? msgsA : []), ...(Array.isArray(msgsB) ? msgsB : [])];
  const byKey = new Map<string, { msg: any; order: number }>();

  combined.forEach((m, idx) => {
    if (!m || typeof m !== 'object') return;
    const idStr = m.id ? String(m.id) : '';
    const isStarter = idStr === '1' || idStr === 'welcome';
    const key = isStarter
      ? '__starter_greeting__'
      : idStr || `${m.role || 'msg'}::${String(m.content || '').slice(0, 120)}::${idx}`;
    const order = parseMessageSortOrder(m.id, idx);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { msg: m, order });
    } else {
      const prevLen = String(existing.msg?.content || '').length;
      const nextLen = String(m?.content || '').length;
      byKey.set(key, {
        msg: nextLen >= prevLen ? { ...existing.msg, ...m } : existing.msg,
        order: Math.min(existing.order, order),
      });
    }
  });

  return Array.from(byKey.values())
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.msg);
}

export function mergeDeletedAiSessionsMap(
  mapA?: Record<string, string>,
  mapB?: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const src of [mapA, mapB]) {
    if (!src || typeof src !== 'object') continue;
    for (const [id, iso] of Object.entries(src)) {
      if (!id || typeof iso !== 'string') continue;
      const prevTs = result[id] ? Date.parse(result[id]) || 0 : 0;
      const nextTs = Date.parse(iso) || 0;
      if (!result[id] || nextTs >= prevTs) {
        result[id] = iso;
      }
    }
  }
  return result;
}

export function mergeAiChatSessions(
  localList: any[],
  cloudList: any[],
  deletedMap?: Record<string, string>
): any[] {
  const safeLocal = Array.isArray(localList) ? localList : [];
  const safeCloud = Array.isArray(cloudList) ? cloudList : [];

  const isDeleted = (s: any) => {
    if (!s?.id || !deletedMap || !deletedMap[s.id]) return false;
    const delTs = Date.parse(deletedMap[s.id]) || 0;
    const sessTs = s.updatedAt ? Date.parse(s.updatedAt) || 0 : 0;
    return sessTs <= delTs;
  };

  const nonDefaultLocal = safeLocal.filter((s) => s?.id && !isDefaultGreetingSession(s) && !isDeleted(s));
  const nonDefaultCloud = safeCloud.filter((s) => s?.id && !isDefaultGreetingSession(s) && !isDeleted(s));

  if (nonDefaultLocal.length === 0 && nonDefaultCloud.length === 0) {
    const candidates = [...safeCloud, ...safeLocal].filter((s) => s?.id && !isDeleted(s));
    return candidates.length > 0 ? [candidates[0]] : [];
  }

  const byId = new Map<string, any>();
  for (const s of [...nonDefaultCloud, ...nonDefaultLocal]) {
    if (!s?.id) continue;
    const prev = byId.get(s.id);
    if (!prev) {
      byId.set(s.id, {
        ...s,
        messages: mergeChatMessagesArray([], s.messages || []),
      });
      continue;
    }

    const mergedMessages = mergeChatMessagesArray(prev.messages || [], s.messages || []);
    const prevUpdated = prev.updatedAt ? Date.parse(prev.updatedAt) || 0 : 0;
    const nextUpdated = s.updatedAt ? Date.parse(s.updatedAt) || 0 : 0;
    const isGenericTitle = (t?: string) => !t || t === 'Introduction with Sage' || t === 'New Conversation';
    const chosenTitle =
      !isGenericTitle(s.title) && (isGenericTitle(prev.title) || nextUpdated >= prevUpdated)
        ? s.title
        : !isGenericTitle(prev.title)
          ? prev.title
          : s.title || prev.title;

    const maxUpdatedIso =
      nextUpdated >= prevUpdated ? s.updatedAt || prev.updatedAt : prev.updatedAt || s.updatedAt;

    byId.set(s.id, {
      ...prev,
      ...s,
      title: chosenTitle,
      createdAt: prev.createdAt || s.createdAt,
      updatedAt: maxUpdatedIso,
      messages: mergedMessages,
    });
  }

  const getActivityMs = (s: any): number => {
    const upd = s?.updatedAt ? Date.parse(s.updatedAt) || 0 : 0;
    if (upd > 0) return upd;
    const msgs = Array.isArray(s?.messages) ? s.messages : [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = String(msgs[i]?.id || '').match(/^(\d{10,})/);
      if (m) return Number(m[1]);
    }
    const idMatch = String(s?.id || '').match(/^(\d{10,})/);
    return idMatch ? Number(idMatch[1]) : 0;
  };

  return Array.from(byId.values()).sort((a, b) => getActivityMs(b) - getActivityMs(a));
}

export function mergeReaderChatsMap(
  localMap: Record<string, any[]> = {},
  cloudMap: Record<string, any[]> = {}
): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  const allBooks = new Set([...Object.keys(localMap || {}), ...Object.keys(cloudMap || {})]);
  for (const bookId of allBooks) {
    const merged = mergeChatMessagesArray(localMap?.[bookId] || [], cloudMap?.[bookId] || []);
    if (merged.length > 0) result[bookId] = merged;
  }
  return result;
}

export function computeAiSyncDigest(
  sessions?: any[],
  deletedMap?: Record<string, string>,
  activeSessionId?: string
): string {
  const safeSessions = (Array.isArray(sessions) ? sessions : []).map((s) => ({
    id: s?.id || '',
    title: s?.title || '',
    msgs: (Array.isArray(s?.messages) ? s.messages : []).map((m: any) => `${m?.id || ''}:${String(m?.content || '').length}`),
  }));
  const delKeys = Object.entries(deletedMap || {}).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({ s: safeSessions, d: delKeys, a: activeSessionId || '' });
}

export function mergePeerConversations(localConvs: any[], cloudConvs: any[]): any[] {
  const safeLocal = Array.isArray(localConvs) ? localConvs : [];
  const safeCloud = Array.isArray(cloudConvs) ? cloudConvs : [];
  const map = new Map<string, any>();

  for (const conv of [...safeLocal, ...safeCloud]) {
    if (!conv?.id) continue;
    const prev = map.get(conv.id);
    if (!prev) {
      map.set(conv.id, conv);
      continue;
    }
    const prevTime = prev.updatedAt ? Date.parse(prev.updatedAt) || 0 : 0;
    const nextTime = conv.updatedAt ? Date.parse(conv.updatedAt) || 0 : 0;
    map.set(conv.id, nextTime >= prevTime ? { ...prev, ...conv } : { ...conv, ...prev });
  }

  return Array.from(map.values()).sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) || 0 : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) || 0 : 0;
    return tb - ta;
  });
}

export function mergePeerMessagesMap(
  localMap: Record<string, any[]>,
  cloudMap: Record<string, any[]>
): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  const allConvIds = new Set([...Object.keys(localMap || {}), ...Object.keys(cloudMap || {})]);

  for (const convId of allConvIds) {
    const listA = Array.isArray(localMap?.[convId]) ? localMap[convId] : [];
    const listB = Array.isArray(cloudMap?.[convId]) ? cloudMap[convId] : [];
    const msgMap = new Map<string, any>();
    for (const msg of [...listA, ...listB]) {
      if (!msg?.id) continue;
      const existing = msgMap.get(msg.id);
      msgMap.set(msg.id, existing ? { ...existing, ...msg } : msg);
    }
    result[convId] = Array.from(msgMap.values()).sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) || 0 : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) || 0 : 0;
      return ta - tb;
    });
  }

  return result;
}

export function mergeBookmarksLists(localList: Bookmark[], cloudList: Bookmark[]): Bookmark[] {
  const map = new Map<string, Bookmark>();
  for (const bm of [...(cloudList || []), ...(localList || [])]) {
    if (!bm?.bookId) continue;
    const key = `${bm.bookId}::${bm.chapter || ''}`;
    if (!map.has(key)) {
      map.set(key, bm);
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export function mergeBooksLists(localBooks: Book[], cloudBooks: Book[]): Book[] {
  const map = new Map<string, Book>();
  const pickCoverFields = (a: Book, b: Book): Book => {
    const aHasCover = Boolean(a.coverImage || a.customCover || a.coverMode);
    const bHasCover = Boolean(b.coverImage || b.customCover || b.coverMode);
    if (bHasCover && !aHasCover) {
      return { ...a, ...b };
    }
    if (b.coverImage && !a.coverImage) {
      return {
        ...a,
        ...b,
        coverImage: b.coverImage,
        coverMode: b.coverMode || a.coverMode,
        pdfCoverPage: b.pdfCoverPage ?? a.pdfCoverPage,
        customCover: b.customCover || a.customCover,
      };
    }
    return {
      ...b,
      ...a,
      coverImage: a.coverImage || b.coverImage || '',
      coverMode: a.coverMode || b.coverMode,
      pdfCoverPage: a.pdfCoverPage ?? b.pdfCoverPage,
      customCover: a.customCover || b.customCover,
    };
  };

  for (const b of [...(cloudBooks || []), ...(localBooks || [])]) {
    if (!b?.id) continue;
    const prev = map.get(b.id);
    if (!prev) {
      map.set(b.id, b);
    } else {
      map.set(b.id, pickCoverFields(prev, b));
    }
  }
  return Array.from(map.values());
}

export function mergeBookCoverOverridesMap(
  mapA?: Record<string, BookCoverOverride>,
  mapB?: Record<string, BookCoverOverride>
): Record<string, BookCoverOverride> {
  const result: Record<string, BookCoverOverride> = {};
  for (const src of [mapA, mapB]) {
    if (!src || typeof src !== 'object') continue;
    for (const [bookId, raw] of Object.entries(src)) {
      if (!bookId || !raw || typeof raw !== 'object') continue;
      const prev = result[bookId];
      if (!prev) {
        result[bookId] = { ...raw };
        continue;
      }
      const prevTs = prev.updatedAt ? Date.parse(prev.updatedAt) || 0 : 0;
      const nextTs = raw.updatedAt ? Date.parse(raw.updatedAt) || 0 : 0;
      result[bookId] = nextTs >= prevTs ? { ...prev, ...raw } : { ...raw, ...prev };
    }
  }
  return result;
}

export function computeBookCoverOverridesDigest(map?: Record<string, BookCoverOverride>): string {
  if (!map || typeof map !== 'object') return '{}';
  const entries = Object.keys(map)
    .sort()
    .map((id) => {
      const o = map[id] || {};
      return [
        id,
        o.coverMode || '',
        typeof o.coverImage === 'string' ? `${o.coverImage.slice(0, 48)}:${o.coverImage.length}` : '',
        o.pdfCoverPage || 0,
        o.customCover ? JSON.stringify(o.customCover) : '',
        o.updatedAt || '',
      ];
    });
  return JSON.stringify(entries);
}

export function getMergedBookCoverOverrides(userId?: string): Record<string, BookCoverOverride> {
  const perBookKeys: Record<string, BookCoverOverride> = {};
  if (typeof window !== 'undefined') {
    try {
      const ls = window.localStorage;
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i);
        if (key && key.startsWith('book_cover_override_')) {
          const bookId = key.slice('book_cover_override_'.length);
          const parsed = safeStorage.getJSON<BookCoverOverride | null>(key, null);
          if (bookId && parsed && typeof parsed === 'object') {
            perBookKeys[bookId] = parsed;
          }
        }
      }
    } catch (_) {}
  }

  const globalOverrides = safeStorage.getJSON<Record<string, BookCoverOverride>>(BOOK_COVER_OVERRIDES_KEY, {});
  const userOverrides = userId
    ? safeStorage.getJSON<Record<string, BookCoverOverride>>(getBookCoverOverridesStorageKey(userId), {})
    : {};

  return mergeBookCoverOverridesMap(
    mergeBookCoverOverridesMap(perBookKeys, globalOverrides),
    userOverrides
  );
}

export function saveBookCoverOverrideToSync(
  userId: string | undefined,
  bookId: string,
  override: BookCoverOverride,
  explicitToken?: string
): Record<string, BookCoverOverride> {
  const entry: BookCoverOverride = {
    ...override,
    updatedAt: override.updatedAt || new Date().toISOString(),
  };

  try {
    safeStorage.setJSON(`book_cover_override_${bookId}`, entry);
    const mergedGlobal = mergeBookCoverOverridesMap(
      safeStorage.getJSON<Record<string, BookCoverOverride>>(BOOK_COVER_OVERRIDES_KEY, {}),
      { [bookId]: entry }
    );
    safeStorage.setJSON(BOOK_COVER_OVERRIDES_KEY, mergedGlobal);

    if (userId) {
      const userKey = getBookCoverOverridesStorageKey(userId);
      const mergedUser = mergeBookCoverOverridesMap(
        safeStorage.getJSON<Record<string, BookCoverOverride>>(userKey, {}),
        { [bookId]: entry }
      );
      safeStorage.setJSON(userKey, mergedUser);
      pushAccountSyncPatch(
        userId,
        { bookCoverOverrides: { [bookId]: entry } },
        explicitToken,
        { immediate: true }
      );
      return mergedUser;
    }
    return mergedGlobal;
  } catch (_) {
    return { [bookId]: entry };
  }
}

function mergeSyncPayloads(candidates: AccountSyncPayload[]): AccountSyncPayload {
  const valid = candidates.filter((c) => c && typeof c === 'object');
  if (valid.length === 0) return {};

  const ordered = [...valid].sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) || 0 : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) || 0 : 0;
    return ta - tb;
  });

  let deletedAiSessions: Record<string, string> = {};
  for (const c of ordered) {
    deletedAiSessions = mergeDeletedAiSessionsMap(deletedAiSessions, c.deletedAiSessions);
  }

  const acc: AccountSyncPayload = {
    deletedAiSessions,
    aiChatSessions: [],
    readerChats: {},
    peerConversations: [],
    peerMessages: {},
    unlockedBooks: [],
    bookCoverOverrides: {},
    bookmarks: [],
    profileSnapshot: {},
    readingProgress: {},
  };

  for (const c of ordered) {
    if (Array.isArray(c.aiChatSessions)) {
      acc.aiChatSessions = mergeAiChatSessions(acc.aiChatSessions || [], c.aiChatSessions, deletedAiSessions);
    }
    if (c.activeAiSessionId) acc.activeAiSessionId = c.activeAiSessionId;
    if (c.readerChats && typeof c.readerChats === 'object') {
      acc.readerChats = mergeReaderChatsMap(acc.readerChats, c.readerChats);
    }
    if (Array.isArray(c.peerConversations)) {
      acc.peerConversations = mergePeerConversations(acc.peerConversations || [], c.peerConversations);
    }
    if (c.peerMessages && typeof c.peerMessages === 'object') {
      acc.peerMessages = mergePeerMessagesMap(acc.peerMessages || {}, c.peerMessages);
    }
    if (Array.isArray(c.unlockedBooks)) {
      acc.unlockedBooks = mergeBooksLists(acc.unlockedBooks || [], c.unlockedBooks);
    }
    if (c.bookCoverOverrides && typeof c.bookCoverOverrides === 'object') {
      acc.bookCoverOverrides = mergeBookCoverOverridesMap(acc.bookCoverOverrides, c.bookCoverOverrides);
    }
    if (Array.isArray(c.bookmarks)) {
      acc.bookmarks = mergeBookmarksLists(acc.bookmarks || [], c.bookmarks);
    }
    if (c.profileSnapshot && typeof c.profileSnapshot === 'object') {
      acc.profileSnapshot = { ...(acc.profileSnapshot || {}), ...c.profileSnapshot };
    }
    if (c.readingProgress && typeof c.readingProgress === 'object') {
      acc.readingProgress = { ...(acc.readingProgress || {}), ...c.readingProgress };
    }
    if (c.dailyGoal) acc.dailyGoal = c.dailyGoal;
    if (c.updatedAt) acc.updatedAt = c.updatedAt;
  }

  return acc;
}

function combinePendingPatches(a: AccountSyncPayload, b: AccountSyncPayload): AccountSyncPayload {
  const deletedAiSessions = mergeDeletedAiSessionsMap(a.deletedAiSessions, b.deletedAiSessions);
  return {
    ...a,
    ...b,
    deletedAiSessions,
    ...(a.aiChatSessions || b.aiChatSessions
      ? {
          aiChatSessions: mergeAiChatSessions(
            a.aiChatSessions || [],
            b.aiChatSessions || [],
            deletedAiSessions
          ),
        }
      : {}),
    ...(a.profileSnapshot || b.profileSnapshot
      ? {
          profileSnapshot: {
            ...(a.profileSnapshot || {}),
            ...(b.profileSnapshot || {}),
          },
        }
      : {}),
    ...(a.readerChats || b.readerChats
      ? {
          readerChats: mergeReaderChatsMap(a.readerChats || {}, b.readerChats || {}),
        }
      : {}),
    ...(a.peerConversations || b.peerConversations
      ? {
          peerConversations: mergePeerConversations(a.peerConversations || [], b.peerConversations || []),
        }
      : {}),
    ...(a.peerMessages || b.peerMessages
      ? {
          peerMessages: mergePeerMessagesMap(a.peerMessages || {}, b.peerMessages || {}),
        }
      : {}),
    ...(a.unlockedBooks || b.unlockedBooks
      ? {
          unlockedBooks: mergeBooksLists(a.unlockedBooks || [], b.unlockedBooks || []),
        }
      : {}),
    ...(a.bookCoverOverrides || b.bookCoverOverrides
      ? {
          bookCoverOverrides: mergeBookCoverOverridesMap(a.bookCoverOverrides, b.bookCoverOverrides),
        }
      : {}),
    ...(a.bookmarks || b.bookmarks
      ? {
          bookmarks: mergeBookmarksLists(a.bookmarks || [], b.bookmarks || []),
        }
      : {}),
  };
}

function collectLocalReaderChats(userId: string): Record<string, any[]> {
  const collected: Record<string, any[]> = {};
  if (typeof window === 'undefined') return collected;
  try {
    const prefix = `sage_reader_chat_${userId}_`;
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (key && key.startsWith(prefix)) {
        const bookId = key.slice(prefix.length);
        const msgs = safeStorage.getJSON<any[]>(key, []);
        if (Array.isArray(msgs) && msgs.some((m) => m?.role === 'user')) {
          collected[bookId] = msgs;
        }
      }
    }
  } catch (_) {}
  return collected;
}

function claimLegacyAiChatsForUser(userId: string): any[] {
  if (!userId || userId === 'guest') return [];
  try {
    const ownerKey = 'sage_ai_legacy_owner';
    const currentOwner = safeStorage.getItem(ownerKey);
    if (currentOwner && currentOwner !== userId) {
      return [];
    }
    const legacy = safeStorage.getJSON<any[]>('sage_ai_chats', []);
    const legacyGuest = safeStorage.getJSON<any[]>('sage_ai_chats_guest', []);
    const combined = mergeAiChatSessions(
      Array.isArray(legacy) ? legacy : [],
      Array.isArray(legacyGuest) ? legacyGuest : []
    );
    const hasMeaningful = combined.some(
      (s) => s?.id !== 'default_session' || (Array.isArray(s?.messages) && s.messages.length > 1)
    );
    if (hasMeaningful) {
      safeStorage.setItem(ownerKey, userId);
      safeStorage.removeItem('sage_ai_chats');
      safeStorage.removeItem('sage_ai_chats_guest');
      return combined;
    }
  } catch (_) {}
  return [];
}

async function fetchDirectSupabaseSyncCandidates(
  userId: string
): Promise<{ candidates: AccountSyncPayload[]; profile: any | null; bookmarks: Bookmark[] }> {
  const client = getSupabaseClient();
  const candidates: AccountSyncPayload[] = [];
  let profile: any = null;
  let bookmarks: Bookmark[] = [];
  if (!client) return { candidates, profile, bookmarks };

  const tasks = [
    // Profile
    (async () => {
      try {
        const { data } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (data) profile = data;
      } catch (_) {}
    })(),
    // Bookmarks
    (async () => {
      try {
        const { data } = await client
          .from('bookmarks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (Array.isArray(data) && data.length > 0) {
          bookmarks = data.map((row: any) => ({
            id: row.id || `${row.book_id}-${row.page_number || 1}`,
            bookId: row.book_id,
            bookTitle: row.title || row.book_title || 'Saved Textbook',
            chapter: row.notes || 'Chapter 1: The Foundations',
            textSnippet: row.notes || 'Bookmarked study passage',
            timestamp: row.created_at ? Date.parse(row.created_at) || Date.now() : Date.now(),
          }));
        }
      } catch (_) {}
    })(),
    // workspace_files Postgres table (shared across AI Studio & Vercel)
    (async () => {
      try {
        const { data: wfRows, error } = await client
          .from('workspace_files')
          .select('id, s3_key, created_at')
          .eq('user_id', userId)
          .eq('type', SYNC_WORKSPACE_FILE_TYPE)
          .order('created_at', { ascending: false })
          .limit(5);
        if (!error && Array.isArray(wfRows)) {
          for (const row of wfRows) {
            if (!row?.s3_key || typeof row.s3_key !== 'string') continue;
            try {
              const parsed = JSON.parse(row.s3_key);
              if (parsed && typeof parsed === 'object') {
                candidates.push({
                  ...parsed,
                  updatedAt: parsed.updatedAt || row.created_at,
                });
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    })(),
    // user_account_sync table
    (async () => {
      try {
        const { data, error } = await client
          .from('user_account_sync')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        if (!error && data) {
          candidates.push({
            aiChatSessions: data.ai_chat_sessions,
            activeAiSessionId: data.active_ai_session_id,
            readerChats: data.reader_chats,
            peerConversations: data.peer_conversations,
            peerMessages: data.peer_messages,
            unlockedBooks: data.unlocked_books,
            profileSnapshot: data.profile_snapshot,
            updatedAt: data.updated_at,
          });
        }
      } catch (_) {}
    })(),
    // workspace-files storage bucket
    (async () => {
      try {
        const { data: blobData, error } = await client.storage
          .from('workspace-files')
          .download(`${userId}/account-sync.json`);
        if (!error && blobData) {
          const text = await blobData.text();
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object') {
            candidates.push(parsed);
          }
        }
      } catch (_) {}
    })(),
    // learning_paths hidden sync snapshot fallback
    (async () => {
      try {
        const { data, error } = await client
          .from('learning_paths')
          .select('steps, updated_at')
          .eq('user_id', userId)
          .eq('title', '__edu_account_sync__')
          .maybeSingle();
        if (!error && data?.steps && typeof data.steps === 'object' && !Array.isArray(data.steps)) {
          candidates.push({
            ...data.steps,
            updatedAt: (data.steps as any).updatedAt || data.updated_at,
          });
        }
      } catch (_) {}
    })(),
  ];

  await Promise.all(tasks);
  return { candidates, profile, bookmarks };
}

async function flushAccountSyncPatch(userId: string, explicitToken?: string): Promise<void> {
  const prevFlush = inFlightFlushes.get(userId);
  if (prevFlush) {
    try {
      await prevFlush;
    } catch (_) {}
  }

  const patch = pendingPatches.get(userId);
  if (!patch) return;
  pendingPatches.delete(userId);

  const run = (async () => {
    const nowIso = new Date().toISOString();
    let mergedSnapshot: AccountSyncPayload = { ...patch, updatedAt: nowIso };
    const token = await resolveBearerToken(explicitToken);

    if (token) {
      try {
        const res = await fetch('/api/account/sync', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patch),
        });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.sync && typeof json.sync === 'object') {
            mergedSnapshot = mergeSyncPayloads([json.sync, patch]);
            mergedSnapshot.updatedAt = json.sync.updatedAt || nowIso;
          }
        }
      } catch (err) {
        console.warn('[accountSyncService] Server sync push notice:', err);
      }
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        // Read existing remote cloud snapshot if we didn't get one from server, so client upload never clobbers
        const { candidates: existingRemote } = await fetchDirectSupabaseSyncCandidates(userId);
        if (existingRemote.length > 0) {
          mergedSnapshot = mergeSyncPayloads([...existingRemote, mergedSnapshot]);
        }
        mergedSnapshot.updatedAt = nowIso;

        const writeTasks: Promise<any>[] = [];

        // 0. Persist full sync snapshot into live 'workspace_files' Postgres table (insert-then-delete old rows)
        writeTasks.push(
          (async () => {
            try {
              const { data: existingRows, error: selErr } = await client
                .from('workspace_files')
                .select('id')
                .eq('user_id', userId)
                .eq('type', SYNC_WORKSPACE_FILE_TYPE);
              if (selErr) return;

              const oldIds = Array.isArray(existingRows)
                ? existingRows.map((r: any) => r?.id).filter(Boolean)
                : [];

              const serialized = JSON.stringify(mergedSnapshot);
              const byteSize = typeof Blob !== 'undefined' ? new Blob([serialized]).size : serialized.length;

              const { error: insErr } = await client.from('workspace_files').insert({
                user_id: userId,
                name: SYNC_WORKSPACE_FILE_NAME,
                type: SYNC_WORKSPACE_FILE_TYPE,
                size: byteSize,
                s3_key: serialized,
              });

              if (!insErr && oldIds.length > 0) {
                await client
                  .from('workspace_files')
                  .delete()
                  .eq('user_id', userId)
                  .in('id', oldIds);
              }
            } catch (_) {}
          })()
        );

        // 1. Optional Supabase Storage workspace-files bucket
        if (typeof Blob !== 'undefined') {
          const blob = new Blob([JSON.stringify(mergedSnapshot)], { type: 'application/json' });
          writeTasks.push(
            client.storage
              .from('workspace-files')
              .upload(`${userId}/account-sync.json`, blob, {
                contentType: 'application/json',
                upsert: true,
              })
              .then(() => undefined)
          );
        }

        // 2. Upsert into user_account_sync table
        const rowPatch: Record<string, any> = {
          user_id: userId,
          updated_at: nowIso,
        };
        if (mergedSnapshot.aiChatSessions !== undefined) rowPatch.ai_chat_sessions = mergedSnapshot.aiChatSessions;
        if (mergedSnapshot.activeAiSessionId !== undefined) rowPatch.active_ai_session_id = mergedSnapshot.activeAiSessionId;
        if (mergedSnapshot.readerChats !== undefined) rowPatch.reader_chats = mergedSnapshot.readerChats;
        if (mergedSnapshot.peerConversations !== undefined) rowPatch.peer_conversations = mergedSnapshot.peerConversations;
        if (mergedSnapshot.peerMessages !== undefined) rowPatch.peer_messages = mergedSnapshot.peerMessages;
        if (mergedSnapshot.unlockedBooks !== undefined) rowPatch.unlocked_books = mergedSnapshot.unlockedBooks;
        if (mergedSnapshot.profileSnapshot !== undefined) rowPatch.profile_snapshot = mergedSnapshot.profileSnapshot;

        writeTasks.push(
          Promise.resolve(
            client
              .from('user_account_sync')
              .upsert(rowPatch, { onConflict: 'user_id' })
          ).then(({ error }) => {
            if (error && !String(error.message || '').includes('schema cache') && !String(error.message || '').includes('does not exist')) {
              console.warn('[accountSyncService] user_account_sync upsert notice:', error.message);
            }
          })
        );

        // 3. Fallback mirror in learning_paths hidden row (works on 20261026 schema even if 20261115 migration isn't applied)
        writeTasks.push(
          (async () => {
            try {
              const { data: existingLp } = await client
                .from('learning_paths')
                .select('id')
                .eq('user_id', userId)
                .eq('title', '__edu_account_sync__')
                .maybeSingle();
              if (existingLp?.id) {
                await client
                  .from('learning_paths')
                  .update({ steps: mergedSnapshot, updated_at: nowIso })
                  .eq('id', existingLp.id);
              } else {
                await client.from('learning_paths').insert({
                  user_id: userId,
                  title: '__edu_account_sync__',
                  plan_mode: 'roadmap',
                  steps: mergedSnapshot,
                  is_active: false,
                  updated_at: nowIso,
                });
              }
            } catch (_) {}
          })()
        );

        await Promise.allSettled(writeTasks);
      } catch (err) {
        console.warn('[accountSyncService] Supabase client sync notice:', err);
      }
    }
  })();

  inFlightFlushes.set(userId, run);
  try {
    await run;
  } finally {
    if (inFlightFlushes.get(userId) === run) {
      inFlightFlushes.delete(userId);
    }
    // If more patches accumulated during flush, send them immediately
    if (pendingPatches.has(userId)) {
      void flushAccountSyncPatch(userId, explicitToken);
    }
  }
}

export async function flushPendingAccountSync(
  userId?: string,
  explicitToken?: string
): Promise<void> {
  if (!userId || userId === 'guest') return;
  const timer = patchTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    patchTimers.delete(userId);
  }
  await flushAccountSyncPatch(userId, explicitToken);
}

export function pushAccountSyncPatch(
  userId: string | undefined,
  patch: AccountSyncPayload,
  explicitToken?: string,
  options?: { immediate?: boolean }
): void {
  if (!userId || userId === 'guest') return;

  const existing = pendingPatches.get(userId);
  const mergedPatch = existing ? combinePendingPatches(existing, patch) : patch;
  pendingPatches.set(userId, mergedPatch);

  const prevTimer = patchTimers.get(userId);
  if (prevTimer) {
    clearTimeout(prevTimer);
    patchTimers.delete(userId);
  }

  if (options?.immediate) {
    void flushAccountSyncPatch(userId, explicitToken);
  } else {
    const timer = setTimeout(() => {
      patchTimers.delete(userId);
      void flushAccountSyncPatch(userId, explicitToken);
    }, 350);
    patchTimers.set(userId, timer);
  }
}

export async function hydrateAccountSync(
  user: any,
  explicitToken?: string
): Promise<{
  sync: AccountSyncPayload;
  profile: any | null;
  bookmarks: Bookmark[];
  unlockedBooks: Book[];
}> {
  const userId = user?.id;
  if (!userId) {
    return { sync: {}, profile: null, bookmarks: [], unlockedBooks: [] };
  }

  const existingHydrate = inFlightHydrates.get(userId);
  if (existingHydrate) {
    return existingHydrate;
  }

  const promise = (async () => {
    const token = await resolveBearerToken(explicitToken);
    const cloudCandidates: AccountSyncPayload[] = [];
    let serverProfile: any = null;
    let directBookmarks: Bookmark[] = [];

    // 1. Fetch server sync & direct Supabase sources in parallel
    await Promise.all([
      (async () => {
        if (!token) return;
        try {
          const res = await fetch('/api/account/sync', {
            headers: {
              Authorization: `Bearer ${token}`,
              'Cache-Control': 'no-cache',
            },
          });
          if (res.ok) {
            const json = await res.json().catch(() => ({}));
            if (json?.sync && typeof json.sync === 'object') cloudCandidates.push(json.sync);
            if (json?.profile && typeof json.profile === 'object') serverProfile = json.profile;
          }
        } catch (_) {}
      })(),
      (async () => {
        const direct = await fetchDirectSupabaseSyncCandidates(userId);
        if (direct.candidates.length > 0) cloudCandidates.push(...direct.candidates);
        if (direct.bookmarks.length > 0) directBookmarks = direct.bookmarks;
        if (direct.profile) {
          serverProfile = {
            ...(serverProfile || {}),
            ...direct.profile,
            avatar_url:
              direct.profile.avatar_url || serverProfile?.avatar_url || user?.user_metadata?.avatar_url || null,
            country: direct.profile.country || serverProfile?.country || user?.user_metadata?.country || null,
            education_level:
              direct.profile.education_level ||
              serverProfile?.education_level ||
              user?.user_metadata?.education_level ||
              null,
            curriculum:
              direct.profile.curriculum || serverProfile?.curriculum || user?.user_metadata?.curriculum || null,
            field_of_study:
              direct.profile.field_of_study ||
              serverProfile?.field_of_study ||
              user?.user_metadata?.field_of_study ||
              null,
            subjects: direct.profile.subjects || serverProfile?.subjects || user?.user_metadata?.subjects || null,
          };
        }
      })(),
    ]);

    const cloudSync = mergeSyncPayloads(cloudCandidates);
    const cloudBookmarks = mergeBookmarksLists(
      Array.isArray(cloudSync.bookmarks) ? cloudSync.bookmarks : [],
      directBookmarks
    );

    // 2. Claim any legacy unscoped Sage AI chats owned by this user on initial login, then merge deleted map & sessions
    const legacyAiChats = claimLegacyAiChatsForUser(userId);
    const localDeletedAi = safeStorage.getJSON<Record<string, string>>(getAiDeletedStorageKey(userId), {});
    const mergedDeletedAi = mergeDeletedAiSessionsMap(localDeletedAi, cloudSync.deletedAiSessions);
    if (Object.keys(mergedDeletedAi).length > 0) {
      safeStorage.setJSON(getAiDeletedStorageKey(userId), mergedDeletedAi);
    }

    const localAiChats = mergeAiChatSessions(
      safeStorage.getJSON<any[]>(getAiChatsStorageKey(userId), []),
      legacyAiChats,
      mergedDeletedAi
    );
    const mergedAiChats = mergeAiChatSessions(localAiChats, cloudSync.aiChatSessions || [], mergedDeletedAi);
    if (mergedAiChats.length > 0 || Object.keys(mergedDeletedAi).length > 0) {
      safeStorage.setJSON(getAiChatsStorageKey(userId), mergedAiChats);
    }

    const localActiveAi = safeStorage.getItem(getAiLastActiveStorageKey(userId));
    let resolvedActiveAi = cloudSync.activeAiSessionId || localActiveAi || undefined;
    if (resolvedActiveAi && !mergedAiChats.some((s: any) => s?.id === resolvedActiveAi)) {
      resolvedActiveAi = mergedAiChats[0]?.id;
    }
    if (resolvedActiveAi) {
      safeStorage.setItem(getAiLastActiveStorageKey(userId), resolvedActiveAi);
    }

    // 3. Merge Reader AI Hover Tutor chats per book (both cloud -> local and local -> cloud)
    const localReaderChats = collectLocalReaderChats(userId);
    const mergedReaderChats = mergeReaderChatsMap(localReaderChats, cloudSync.readerChats || {});
    for (const [bookId, msgs] of Object.entries(mergedReaderChats)) {
      if (Array.isArray(msgs) && msgs.length > 0) {
        safeStorage.setJSON(getReaderChatStorageKey(bookId, userId), msgs);
      }
    }

    // 4. Hydrate Peer Chat conversations & messages
    const localPeerConvs = safeStorage.getJSON<any[]>(getPeerConversationsStorageKey(userId), []);
    const mergedPeerConvs = mergePeerConversations(localPeerConvs, cloudSync.peerConversations || []);
    if (mergedPeerConvs.length > 0) {
      safeStorage.setJSON(getPeerConversationsStorageKey(userId), mergedPeerConvs);
    }

    const localPeerMsgs = safeStorage.getJSON<Record<string, any[]>>(getPeerMessagesStorageKey(userId), {});
    const mergedPeerMsgs = mergePeerMessagesMap(localPeerMsgs, cloudSync.peerMessages || {});
    if (Object.keys(mergedPeerMsgs).length > 0) {
      safeStorage.setJSON(getPeerMessagesStorageKey(userId), mergedPeerMsgs);
    }

    // 5. Hydrate Unlocked / Custom Books & Book Cover Overrides
    const localUnlocked = safeStorage.getJSON<Book[]>(getUnlockedBooksStorageKey(userId), []);
    const mergedUnlocked = mergeBooksLists(localUnlocked, cloudSync.unlockedBooks || []);
    if (mergedUnlocked.length > 0) {
      safeStorage.setJSON(getUnlockedBooksStorageKey(userId), mergedUnlocked);
    }

    const localCoverOverrides = getMergedBookCoverOverrides(userId);
    const mergedCoverOverrides = mergeBookCoverOverridesMap(
      localCoverOverrides,
      cloudSync.bookCoverOverrides || {}
    );
    if (Object.keys(mergedCoverOverrides).length > 0) {
      safeStorage.setJSON(getBookCoverOverridesStorageKey(userId), mergedCoverOverrides);
      safeStorage.setJSON(BOOK_COVER_OVERRIDES_KEY, mergedCoverOverrides);
      for (const [bid, ov] of Object.entries(mergedCoverOverrides)) {
        safeStorage.setJSON(`book_cover_override_${bid}`, ov);
      }
    }

    // 6. Hydrate Bookmarks
    const localBookmarks = safeStorage.getJSON<Bookmark[]>(getBookmarksStorageKey(userId), []);
    const mergedBookmarks = mergeBookmarksLists(localBookmarks, cloudBookmarks);
    if (mergedBookmarks.length > 0) {
      safeStorage.setJSON(getBookmarksStorageKey(userId), mergedBookmarks);
    }

    // 7. Hydrate Daily Goal if cloud has data
    if (cloudSync.dailyGoal) {
      saveDailyGoal(cloudSync.dailyGoal, false);
    }

    // 8. Hydrate Academic Preferences
    const resolvedCountry =
      serverProfile?.country || serverProfile?.location || user?.user_metadata?.country || '';
    const resolvedLevel = serverProfile?.education_level || user?.user_metadata?.education_level || '';
    const resolvedCurr = serverProfile?.curriculum || user?.user_metadata?.curriculum || '';
    const resolvedField = serverProfile?.field_of_study || user?.user_metadata?.field_of_study || '';
    const resolvedSubjects = serverProfile?.subjects || user?.user_metadata?.subjects || '';

    if (resolvedLevel || resolvedCountry || resolvedSubjects || resolvedCurr || resolvedField) {
      saveStoredAcademicPrefs(userId, {
        country: resolvedCountry,
        education_level: resolvedLevel,
        curriculum: resolvedCurr,
        field_of_study: resolvedField,
        subjects: resolvedSubjects,
      });
    }

    const mergedSync: AccountSyncPayload = {
      ...cloudSync,
      deletedAiSessions: mergedDeletedAi,
      aiChatSessions: mergedAiChats,
      activeAiSessionId: resolvedActiveAi,
      readerChats: mergedReaderChats,
      peerConversations: mergedPeerConvs,
      peerMessages: mergedPeerMsgs,
      unlockedBooks: mergedUnlocked,
      bookCoverOverrides: mergedCoverOverrides,
      bookmarks: mergedBookmarks,
      profileSnapshot: serverProfile || cloudSync.profileSnapshot,
    };

    // 9. Backfill to cloud if local device had Sage AI chats, reader chats, peer chats, books, covers, or bookmarks missing from cloud
    const cloudAiDigest = computeAiSyncDigest(
      cloudSync.aiChatSessions,
      cloudSync.deletedAiSessions,
      cloudSync.activeAiSessionId
    );
    const mergedAiDigest = computeAiSyncDigest(mergedAiChats, mergedDeletedAi, resolvedActiveAi);
    const hasMeaningfulAi =
      mergedAiChats.some((s) => s?.id !== 'default_session' || (Array.isArray(s?.messages) && s.messages.length > 1)) ||
      Object.keys(mergedDeletedAi).length > 0;
    const aiNeedsBackfill = hasMeaningfulAi && cloudAiDigest !== mergedAiDigest;
    const readerNeedsBackfill =
      Object.keys(mergedReaderChats).length > Object.keys(cloudSync.readerChats || {}).length ||
      Object.entries(mergedReaderChats).some(
        ([bid, msgs]) => msgs.length > ((cloudSync.readerChats?.[bid] || []).length)
      );
    const peerNeedsBackfill =
      mergedPeerConvs.length > (cloudSync.peerConversations || []).length ||
      Object.keys(mergedPeerMsgs).some(
        (cid) => (mergedPeerMsgs[cid] || []).length > ((cloudSync.peerMessages?.[cid] || []).length)
      );
    const booksNeedBackfill = mergedUnlocked.length > (cloudSync.unlockedBooks || []).length;
    const coversNeedBackfill =
      Object.keys(mergedCoverOverrides).length > 0 &&
      computeBookCoverOverridesDigest(cloudSync.bookCoverOverrides) !==
        computeBookCoverOverridesDigest(mergedCoverOverrides);
    const bookmarksNeedBackfill = mergedBookmarks.length > cloudBookmarks.length;

    if (
      aiNeedsBackfill ||
      readerNeedsBackfill ||
      peerNeedsBackfill ||
      booksNeedBackfill ||
      coversNeedBackfill ||
      bookmarksNeedBackfill
    ) {
      pushAccountSyncPatch(
        userId,
        {
          ...(aiNeedsBackfill
            ? {
                aiChatSessions: mergedAiChats,
                activeAiSessionId: resolvedActiveAi,
                deletedAiSessions: mergedDeletedAi,
              }
            : {}),
          ...(readerNeedsBackfill ? { readerChats: mergedReaderChats } : {}),
          ...(peerNeedsBackfill
            ? { peerConversations: mergedPeerConvs, peerMessages: mergedPeerMsgs }
            : {}),
          ...(booksNeedBackfill ? { unlockedBooks: mergedUnlocked } : {}),
          ...(coversNeedBackfill ? { bookCoverOverrides: mergedCoverOverrides } : {}),
          ...(bookmarksNeedBackfill ? { bookmarks: mergedBookmarks } : {}),
        },
        explicitToken,
        { immediate: true }
      );
    }

    // 10. Notify mounted components to refresh from synced state
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ACCOUNT_SYNC_EVENT, {
          detail: { userId, sync: mergedSync, profile: serverProfile },
        })
      );
    }

    return {
      sync: mergedSync,
      profile: serverProfile,
      bookmarks: mergedBookmarks,
      unlockedBooks: mergedUnlocked,
    };
  })();

  inFlightHydrates.set(userId, promise);
  try {
    return await promise;
  } finally {
    if (inFlightHydrates.get(userId) === promise) {
      inFlightHydrates.delete(userId);
    }
  }
}

export async function saveBookmarkToCloud(
  userId: string | undefined,
  bookmark: Bookmark,
  allBookmarks: Bookmark[],
  explicitToken?: string
): Promise<void> {
  if (!userId) return;
  safeStorage.setJSON(getBookmarksStorageKey(userId), allBookmarks);
  pushAccountSyncPatch(userId, { bookmarks: allBookmarks }, explicitToken, { immediate: true });

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('bookmarks').upsert(
        {
          user_id: userId,
          book_id: bookmark.bookId,
          title: bookmark.bookTitle,
          notes: bookmark.chapter || bookmark.textSnippet,
          page_number: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,book_id,page_number' }
      );
    } catch (_) {}
  }
}

export function clearAccountLocalCaches(userId?: string): void {
  try {
    // Clear shared / legacy unscoped caches so switching accounts on the same browser never bleeds data
    const sharedKeys = [
      'user_avatar_data_url',
      'user_custom_avatar',
      'user_profile_avatar_key',
      'eduai_chat_current_user',
      'eduai_chat_conversations',
      'eduai_chat_messages',
      'edu_ai_daily_reading_goal',
      'sage_ai_chats',
      'sage_ai_chats_guest',
      'sage_ai_last_active',
      'sage_ai_last_active_guest',
      'sage_ai_deleted_guest',
      'edu_ai_book_cover_overrides',
      'workspace_files_local',
      'workspace_folders_local',
    ];
    sharedKeys.forEach((k) => safeStorage.removeItem(k));

    if (typeof window !== 'undefined') {
      const ls = window.localStorage;
      for (let i = ls.length - 1; i >= 0; i--) {
        const k = ls.key(i);
        if (k && k.startsWith('book_cover_override_')) {
          ls.removeItem(k);
        }
      }
    }

    if (userId) {
      safeStorage.removeItem(`user_avatar_data_url_${userId}`);
      safeStorage.removeItem(`user_custom_avatar_${userId}`);
      safeStorage.removeItem(`user_profile_avatar_key_${userId}`);
    }
  } catch (_) {}
}
