import { safeStorage } from './safeStorage';
import { getSupabaseClient, getPersistedDeviceSession } from './supabase';
import { saveStoredAcademicPrefs } from './bookPersonalization';
import { saveDailyGoal, DailyReadingGoal } from './readingGoal';
import { Book, Bookmark } from '../types';

export const ACCOUNT_SYNC_EVENT = 'edu-account-sync-updated';

export interface AccountSyncPayload {
  aiChatSessions?: any[];
  activeAiSessionId?: string;
  readerChats?: Record<string, any[]>;
  peerConversations?: any[];
  peerMessages?: Record<string, any[]>;
  unlockedBooks?: Book[];
  bookmarks?: Bookmark[];
  profileSnapshot?: Record<string, any>;
  readingProgress?: Record<string, number>;
  dailyGoal?: DailyReadingGoal;
  updatedAt?: string;
}

const pendingPatches = new Map<string, AccountSyncPayload>();
const patchTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

export function mergeAiChatSessions(localList: any[], cloudList: any[]): any[] {
  const safeLocal = Array.isArray(localList) ? localList : [];
  const safeCloud = Array.isArray(cloudList) ? cloudList : [];

  const nonDefaultLocal = safeLocal.filter((s) => s?.id && !isDefaultGreetingSession(s));
  const nonDefaultCloud = safeCloud.filter((s) => s?.id && !isDefaultGreetingSession(s));

  if (nonDefaultLocal.length === 0 && nonDefaultCloud.length === 0) {
    return safeCloud.length > 0 ? safeCloud : safeLocal;
  }

  const byId = new Map<string, any>();
  for (const s of [...nonDefaultCloud, ...nonDefaultLocal]) {
    if (!s?.id) continue;
    const prev = byId.get(s.id);
    if (!prev) {
      byId.set(s.id, s);
      continue;
    }
    const prevMsgs = Array.isArray(prev.messages) ? prev.messages : [];
    const nextMsgs = Array.isArray(s.messages) ? s.messages : [];
    // Keep whichever thread has more messages (or merge unique messages by id)
    if (nextMsgs.length > prevMsgs.length) {
      byId.set(s.id, s);
    } else if (nextMsgs.length === prevMsgs.length && nextMsgs.length > 0) {
      const msgMap = new Map<string, any>();
      [...prevMsgs, ...nextMsgs].forEach((m: any) => {
        if (m?.id) msgMap.set(m.id, m);
      });
      byId.set(s.id, { ...prev, ...s, messages: Array.from(msgMap.values()) });
    }
  }

  return Array.from(byId.values());
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
  for (const b of [...(cloudBooks || []), ...(localBooks || [])]) {
    if (!b?.id) continue;
    if (!map.has(b.id)) {
      map.set(b.id, b);
    }
  }
  return Array.from(map.values());
}

async function flushAccountSyncPatch(userId: string, explicitToken?: string): Promise<void> {
  const patch = pendingPatches.get(userId);
  if (!patch) return;
  pendingPatches.delete(userId);

  const token = await resolveBearerToken(explicitToken);
  if (token) {
    try {
      await fetch('/api/account/sync', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      console.warn('[accountSyncService] Server sync push notice:', err);
    }
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const rowPatch: Record<string, any> = {
        user_id: userId,
        updated_at: new Date().toISOString(),
      };
      if (patch.aiChatSessions !== undefined) rowPatch.ai_chat_sessions = patch.aiChatSessions;
      if (patch.activeAiSessionId !== undefined) rowPatch.active_ai_session_id = patch.activeAiSessionId;
      if (patch.readerChats !== undefined) rowPatch.reader_chats = patch.readerChats;
      if (patch.peerConversations !== undefined) rowPatch.peer_conversations = patch.peerConversations;
      if (patch.peerMessages !== undefined) rowPatch.peer_messages = patch.peerMessages;
      if (patch.unlockedBooks !== undefined) rowPatch.unlocked_books = patch.unlockedBooks;
      if (patch.profileSnapshot !== undefined) rowPatch.profile_snapshot = patch.profileSnapshot;

      await client.from('user_account_sync').upsert(rowPatch, { onConflict: 'user_id' });
    } catch (_) {}
  }
}

export function pushAccountSyncPatch(
  userId: string | undefined,
  patch: AccountSyncPayload,
  explicitToken?: string,
  options?: { immediate?: boolean }
): void {
  if (!userId || userId === 'guest') return;

  const existing = pendingPatches.get(userId) || {};
  const mergedPatch: AccountSyncPayload = {
    ...existing,
    ...patch,
    ...(existing.profileSnapshot || patch.profileSnapshot
      ? {
          profileSnapshot: {
            ...(existing.profileSnapshot || {}),
            ...(patch.profileSnapshot || {}),
          },
        }
      : {}),
    ...(existing.readerChats || patch.readerChats
      ? {
          readerChats: {
            ...(existing.readerChats || {}),
            ...(patch.readerChats || {}),
          },
        }
      : {}),
    ...(existing.peerMessages || patch.peerMessages
      ? {
          peerMessages: mergePeerMessagesMap(existing.peerMessages || {}, patch.peerMessages || {}),
        }
      : {}),
  };
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
    }, 500);
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

  const token = await resolveBearerToken(explicitToken);
  const client = getSupabaseClient();
  let serverSync: AccountSyncPayload = {};
  let serverProfile: any = null;

  // 1. Fetch unified server sync snapshot
  if (token) {
    try {
      const res = await fetch('/api/account/sync', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json?.sync && typeof json.sync === 'object') serverSync = json.sync;
        if (json?.profile && typeof json.profile === 'object') serverProfile = json.profile;
      }
    } catch (_) {}
  }

  // 2. Also query Supabase directly for bookmarks, profile, and user_account_sync
  let cloudBookmarks: Bookmark[] = Array.isArray(serverSync.bookmarks) ? serverSync.bookmarks : [];
  if (client) {
    try {
      const { data: profData } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (profData) {
        serverProfile = {
          ...(serverProfile || {}),
          ...profData,
          avatar_url: profData.avatar_url || serverProfile?.avatar_url || user?.user_metadata?.avatar_url || null,
          country: profData.country || serverProfile?.country || user?.user_metadata?.country || null,
          education_level: profData.education_level || serverProfile?.education_level || user?.user_metadata?.education_level || null,
          curriculum: profData.curriculum || serverProfile?.curriculum || user?.user_metadata?.curriculum || null,
          field_of_study: profData.field_of_study || serverProfile?.field_of_study || user?.user_metadata?.field_of_study || null,
          subjects: profData.subjects || serverProfile?.subjects || user?.user_metadata?.subjects || null,
        };
      }
    } catch (_) {}

    try {
      const { data: bmRows } = await client
        .from('bookmarks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (Array.isArray(bmRows) && bmRows.length > 0) {
        const mapped: Bookmark[] = bmRows.map((row: any) => ({
          id: row.id || `${row.book_id}-${row.page_number || 1}`,
          bookId: row.book_id,
          bookTitle: row.title || row.book_title || 'Saved Textbook',
          chapter: row.notes || 'Chapter 1: The Foundations',
          textSnippet: row.notes || 'Bookmarked study passage',
          timestamp: row.created_at ? Date.parse(row.created_at) || Date.now() : Date.now(),
        }));
        cloudBookmarks = mergeBookmarksLists(cloudBookmarks, mapped);
      }
    } catch (_) {}

    try {
      const { data: tableSync } = await client
        .from('user_account_sync')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (tableSync) {
        const tableUpdated = tableSync.updated_at ? Date.parse(tableSync.updated_at) || 0 : 0;
        const serverUpdated = serverSync.updatedAt ? Date.parse(serverSync.updatedAt) || 0 : 0;
        if (tableUpdated >= serverUpdated) {
          serverSync = {
            ...serverSync,
            aiChatSessions: mergeAiChatSessions(serverSync.aiChatSessions || [], tableSync.ai_chat_sessions || []),
            activeAiSessionId: tableSync.active_ai_session_id || serverSync.activeAiSessionId,
            readerChats: { ...(serverSync.readerChats || {}), ...(tableSync.reader_chats || {}) },
            peerConversations: mergePeerConversations(serverSync.peerConversations || [], tableSync.peer_conversations || []),
            peerMessages: mergePeerMessagesMap(serverSync.peerMessages || {}, tableSync.peer_messages || {}),
            unlockedBooks: mergeBooksLists(serverSync.unlockedBooks || [], tableSync.unlocked_books || []),
          };
        }
      }
    } catch (_) {}
  }

  // 3. Hydrate and merge Sage AI chat sessions in user-scoped localStorage
  const localAiChats = safeStorage.getJSON<any[]>(getAiChatsStorageKey(userId), []);
  const mergedAiChats = mergeAiChatSessions(localAiChats, serverSync.aiChatSessions || []);
  if (mergedAiChats.length > 0) {
    safeStorage.setJSON(getAiChatsStorageKey(userId), mergedAiChats);
  }
  if (serverSync.activeAiSessionId) {
    const exists = mergedAiChats.some((s: any) => s?.id === serverSync.activeAiSessionId);
    if (exists) {
      safeStorage.setItem(getAiLastActiveStorageKey(userId), serverSync.activeAiSessionId);
    }
  }

  // 4. Hydrate Reader AI Hover Tutor chats per book
  if (serverSync.readerChats && typeof serverSync.readerChats === 'object') {
    for (const [bookId, cloudMsgs] of Object.entries(serverSync.readerChats)) {
      if (!Array.isArray(cloudMsgs) || cloudMsgs.length === 0) continue;
      const scopedKey = getReaderChatStorageKey(bookId, userId);
      const localMsgs = safeStorage.getJSON<any[]>(scopedKey, []);
      if (cloudMsgs.length >= localMsgs.length) {
        safeStorage.setJSON(scopedKey, cloudMsgs);
      }
    }
  }

  // 5. Hydrate Peer Chat conversations & messages
  const localPeerConvs = safeStorage.getJSON<any[]>(getPeerConversationsStorageKey(userId), []);
  const mergedPeerConvs = mergePeerConversations(localPeerConvs, serverSync.peerConversations || []);
  if (mergedPeerConvs.length > 0) {
    safeStorage.setJSON(getPeerConversationsStorageKey(userId), mergedPeerConvs);
  }

  const localPeerMsgs = safeStorage.getJSON<Record<string, any[]>>(getPeerMessagesStorageKey(userId), {});
  const mergedPeerMsgs = mergePeerMessagesMap(localPeerMsgs, serverSync.peerMessages || {});
  if (Object.keys(mergedPeerMsgs).length > 0) {
    safeStorage.setJSON(getPeerMessagesStorageKey(userId), mergedPeerMsgs);
  }

  // 6. Hydrate Unlocked / Custom Books
  const localUnlocked = safeStorage.getJSON<Book[]>(getUnlockedBooksStorageKey(userId), []);
  const mergedUnlocked = mergeBooksLists(localUnlocked, serverSync.unlockedBooks || []);
  if (mergedUnlocked.length > 0) {
    safeStorage.setJSON(getUnlockedBooksStorageKey(userId), mergedUnlocked);
  }

  // 7. Hydrate Bookmarks
  const localBookmarks = safeStorage.getJSON<Bookmark[]>(getBookmarksStorageKey(userId), []);
  const mergedBookmarks = mergeBookmarksLists(localBookmarks, cloudBookmarks);
  if (mergedBookmarks.length > 0) {
    safeStorage.setJSON(getBookmarksStorageKey(userId), mergedBookmarks);
  }

  // 8. Hydrate Daily Goal if cloud has newer/higher streak data
  if (serverSync.dailyGoal) {
    saveDailyGoal(serverSync.dailyGoal, false);
  }

  // 9. Hydrate Academic Preferences so shelves (Home, Library, BookStore, Audiobooks) match across devices
  const resolvedCountry = serverProfile?.country || serverProfile?.location || user?.user_metadata?.country || '';
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

  // 10. Notify mounted components to refresh from synced state
  const mergedSync: AccountSyncPayload = {
    ...serverSync,
    aiChatSessions: mergedAiChats,
    activeAiSessionId: serverSync.activeAiSessionId || safeStorage.getItem(getAiLastActiveStorageKey(userId)) || undefined,
    peerConversations: mergedPeerConvs,
    peerMessages: mergedPeerMsgs,
    unlockedBooks: mergedUnlocked,
    bookmarks: mergedBookmarks,
    profileSnapshot: serverProfile || serverSync.profileSnapshot,
  };

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
    ];
    sharedKeys.forEach((k) => safeStorage.removeItem(k));

    if (userId) {
      safeStorage.removeItem(`user_avatar_data_url_${userId}`);
      safeStorage.removeItem(`user_custom_avatar_${userId}`);
      safeStorage.removeItem(`user_profile_avatar_key_${userId}`);
    }
  } catch (_) {}
}
