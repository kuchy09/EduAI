import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";
import { generateKLBPhysicsPdf } from "./server/klbPhysicsPdf";
import { generateEducationalEpub } from "./server/epubBuilder";
import {
  generateAudiobookChapterScript,
  synthesizeAudiobookSpeech,
} from "./server/audiobookEngine";
import {
  BookCoverOverride,
  CANONICAL_BOOK_COVERS,
  GLOBAL_BOOK_COVERS_ROW_ID,
  GLOBAL_BOOK_COVERS_ROW_TITLE,
  SYSTEM_NOTIFICATIONS_ROW_ID,
  SYSTEM_NOTIFICATIONS_ROW_TITLE,
  applyGlobalBookCover,
  isSystemBookConfigRow,
  mergeGlobalBookCoversMaps,
  normalizeBookCoverTitleKey,
} from "./shared/canonicalBookCovers";
import { ADMIN_EMAILS, isAuthorizedAdminEmail } from "./shared/adminAuth";
import {
  addCommunityReplyAction,
  addGroupMemberAction,
  createCommunityPostAction,
  createGroupConversationAction,
  deleteChatMessageAction,
  formatDirectoryUserForViewer,
  getBootstrapDataForUser,
  getConversationIfParticipant,
  getMessagesForConversation,
  hydrateDirectoryFromSupabase,
  hydrateFriendRequestsFromSupabase,
  hydrateSocialCloudState,
  listCommunityPosts,
  markConversationReadAction,
  matchesDirectorySearchQuery,
  openOrCreateDirectConversation,
  persistSocialCloudState,
  registerSocialSupabaseClient,
  removeFriendshipAction,
  respondToFriendRequestAction,
  sendChatMessageAction,
  sendFriendRequestAction,
  syncUserProfileToStoreAndSupabase,
  backfillFriendRequestsToSupabase,
  toggleCommunityPostLikeAction,
  toggleMessageReactionAction,
  parseSubjectsList,
  normalizeRole,
} from "./server/socialStore";

const UPLOADS_DIR = process.env.VERCEL ? path.join("/tmp", "uploads") : path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const BOOKS_CATALOG_FILE = path.join(UPLOADS_DIR, "books-catalog.json");
const DELETED_BOOKS_FILE = path.join(UPLOADS_DIR, "deleted-books.json");
const GLOBAL_BOOK_COVERS_FILE = path.join(UPLOADS_DIR, "global-book-covers.json");
const SYSTEM_NOTIFICATIONS_FILE = path.join(UPLOADS_DIR, "system-notifications.json");

function readLocalBooksCatalog(): any[] {
  try {
    if (fs.existsSync(BOOKS_CATALOG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(BOOKS_CATALOG_FILE, "utf-8"));
      return Array.isArray(parsed) ? parsed.filter((b: any) => b && b.id && b.title && !isSystemBookConfigRow(b)) : [];
    }
  } catch (err) {
    console.warn("[Catalog] Failed to read books-catalog.json:", err);
  }
  return [];
}

function writeLocalBooksCatalog(books: any[]): void {
  try {
    const clean = (Array.isArray(books) ? books : []).filter((b: any) => b && b.id && b.title && !isSystemBookConfigRow(b));
    fs.writeFileSync(BOOKS_CATALOG_FILE, JSON.stringify(clean, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Catalog] Failed to write books-catalog.json:", err);
  }
}

function readDeletedBookIds(): string[] {
  try {
    if (fs.existsSync(DELETED_BOOKS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DELETED_BOOKS_FILE, "utf-8"));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn("[Catalog] Failed to read deleted-books.json:", err);
  }
  return [];
}

function writeDeletedBookIds(ids: string[]): void {
  try {
    fs.writeFileSync(DELETED_BOOKS_FILE, JSON.stringify(Array.from(new Set(ids)), null, 2), "utf-8");
  } catch (err) {
    console.warn("[Catalog] Failed to write deleted-books.json:", err);
  }
}

function readGlobalBookCoversFromDisk(): Record<string, BookCoverOverride> {
  let diskCovers: Record<string, BookCoverOverride> = {};
  try {
    if (fs.existsSync(GLOBAL_BOOK_COVERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(GLOBAL_BOOK_COVERS_FILE, "utf-8"));
      if (parsed && typeof parsed === "object") {
        diskCovers = parsed;
      }
    }
  } catch (err) {
    console.warn("[Catalog] Failed to read global-book-covers.json:", err);
  }

  // Promote any cover overrides from local user-sync snapshots so all accounts stay unified
  const userSyncCovers: Array<Record<string, BookCoverOverride>> = [];
  try {
    if (fs.existsSync(USER_SYNC_DIR)) {
      for (const fname of fs.readdirSync(USER_SYNC_DIR)) {
        if (!fname.endsWith(".json")) continue;
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(USER_SYNC_DIR, fname), "utf-8"));
          if (parsed?.bookCoverOverrides && typeof parsed.bookCoverOverrides === "object") {
            userSyncCovers.push(parsed.bookCoverOverrides);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  return mergeGlobalBookCoversMaps(CANONICAL_BOOK_COVERS, ...userSyncCovers, diskCovers);
}

function writeGlobalBookCoversToDisk(covers: Record<string, BookCoverOverride>): void {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const tmp = `${GLOBAL_BOOK_COVERS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(covers, null, 2), "utf-8");
    fs.renameSync(tmp, GLOBAL_BOOK_COVERS_FILE);
  } catch (err) {
    console.warn("[Catalog] Failed to write global-book-covers.json:", err);
  }
}

async function readGlobalBookCovers(sb?: SupabaseClient | null): Promise<Record<string, BookCoverOverride>> {
  const localMerged = readGlobalBookCoversFromDisk();
  if (!sb) return localMerged;

  let cloudMap: Record<string, BookCoverOverride> = {};
  try {
    const { data, error } = await sb
      .from("books")
      .select("id, description")
      .eq("id", GLOBAL_BOOK_COVERS_ROW_ID)
      .maybeSingle();
    if (!error && data?.description) {
      const parsed = JSON.parse(data.description);
      if (parsed && typeof parsed === "object") {
        cloudMap = parsed;
      }
    }
  } catch (_) {}

  const merged = mergeGlobalBookCoversMaps(localMerged, cloudMap);
  if (Object.keys(merged).length > Object.keys(localMerged).length || JSON.stringify(merged) !== JSON.stringify(localMerged)) {
    writeGlobalBookCoversToDisk(merged);
  }
  return merged;
}

async function persistGlobalBookCoversBatch(
  incoming: Record<string, BookCoverOverride>,
  sb?: SupabaseClient | null
): Promise<Record<string, BookCoverOverride>> {
  const existing = await readGlobalBookCovers(sb);
  const next = mergeGlobalBookCoversMaps(existing, incoming);
  writeGlobalBookCoversToDisk(next);

  if (sb) {
    try {
      const { error } = await sb.from("books").upsert(
        {
          id: GLOBAL_BOOK_COVERS_ROW_ID,
          title: GLOBAL_BOOK_COVERS_ROW_TITLE,
          author: "Edu AI System",
          category: "__SYSTEM_CONFIG__",
          description: JSON.stringify(next),
          cover_image: "",
        },
        { onConflict: "id" }
      );
      if (error) {
        console.warn("[Catalog] Supabase global covers sync notice:", error.message);
      }
    } catch (err) {
      console.warn("[Catalog] Supabase global covers sync warning:", err);
    }
  }

  return next;
}

async function persistGlobalBookCoverUpdate(
  bookId: string,
  override: BookCoverOverride,
  sb?: SupabaseClient | null,
  bookMeta?: any
): Promise<Record<string, BookCoverOverride>> {
  const titleKey = override.titleKey || normalizeBookCoverTitleKey(bookMeta?.title);
  const entry: BookCoverOverride = {
    ...override,
    ...(titleKey ? { titleKey } : {}),
    updatedAt: override.updatedAt || new Date().toISOString(),
  };

  const next = await persistGlobalBookCoversBatch({ [bookId]: entry }, sb);

  if (sb && bookId && bookId !== GLOBAL_BOOK_COVERS_ROW_ID) {
    try {
      const fullPatch: Record<string, any> = {
        cover_image: entry.coverImage || "",
      };
      if (entry.coverMode) fullPatch.cover_mode = entry.coverMode;
      if (entry.pdfCoverPage !== undefined) fullPatch.pdf_cover_page = entry.pdfCoverPage;
      if (entry.customCover !== undefined) fullPatch.custom_cover = entry.customCover;

      const { error: richErr } = await sb.from("books").update(fullPatch).eq("id", bookId);
      if (richErr) {
        await sb.from("books").update({ cover_image: entry.coverImage || "" }).eq("id", bookId);
      }
    } catch (_) {}

    if (entry.coverImage !== undefined) {
      try {
        await sb
          .from("curriculum_books")
          .update({ cover_image_url: entry.coverImage || "" })
          .eq("id", bookId);
      } catch (_) {}
    }
  }

  return next;
}

function mergeSystemNotificationsLists(...lists: Array<any[] | undefined | null>): any[] {
  const byId = new Map<string, any>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== "object" || !item.id || !item.title) continue;
      const prev = byId.get(String(item.id));
      if (!prev) {
        byId.set(String(item.id), { ...item });
      } else {
        const prevTs = Number(prev.createdAt) || 0;
        const nextTs = Number(item.createdAt) || 0;
        byId.set(String(item.id), nextTs >= prevTs ? { ...prev, ...item } : { ...item, ...prev });
      }
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    .slice(0, 60);
}

function readSystemNotificationsFromDisk(): any[] {
  try {
    if (fs.existsSync(SYSTEM_NOTIFICATIONS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SYSTEM_NOTIFICATIONS_FILE, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("[SystemNotifications] Failed reading disk file:", err);
  }
  return [];
}

function writeSystemNotificationsToDisk(notifs: any[]): void {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const tmp = `${SYSTEM_NOTIFICATIONS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(notifs, null, 2), "utf-8");
    fs.renameSync(tmp, SYSTEM_NOTIFICATIONS_FILE);
  } catch (err) {
    console.warn("[SystemNotifications] Failed writing disk file:", err);
  }
}

async function readSystemNotifications(sb?: SupabaseClient | null): Promise<any[]> {
  const local = readSystemNotificationsFromDisk();
  if (!sb) return local;
  let cloud: any[] = [];
  try {
    const { data, error } = await sb
      .from("books")
      .select("id, description")
      .eq("id", SYSTEM_NOTIFICATIONS_ROW_ID)
      .maybeSingle();
    if (!error && data?.description) {
      const parsed = JSON.parse(data.description);
      if (Array.isArray(parsed)) cloud = parsed;
    }
  } catch (_) {}

  const merged = mergeSystemNotificationsLists(local, cloud);
  if (merged.length !== local.length || JSON.stringify(merged) !== JSON.stringify(local)) {
    writeSystemNotificationsToDisk(merged);
  }
  return merged;
}

async function persistSystemNotification(
  notification: any,
  sb?: SupabaseClient | null
): Promise<any[]> {
  const existing = await readSystemNotifications(sb);
  const next = mergeSystemNotificationsLists([notification], existing);
  writeSystemNotificationsToDisk(next);

  const writeSb = getServerSupabase() || sb;
  if (writeSb) {
    try {
      await writeSb.from("books").upsert(
        {
          id: SYSTEM_NOTIFICATIONS_ROW_ID,
          title: SYSTEM_NOTIFICATIONS_ROW_TITLE,
          author: "Edu AI System",
          category: "__SYSTEM_CONFIG__",
          description: JSON.stringify(next),
          cover_image: "",
        },
        { onConflict: "id" }
      );
    } catch (_) {}
  }

  return next;
}

function isRealUrlEnv(val?: string): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed.startsWith("http") &&
    !trimmed.includes("placeholder") &&
    !trimmed.includes("your-project") &&
    !trimmed.includes("your_") &&
    !trimmed.startsWith("MY_")
  );
}

function isRealKeyEnv(val?: string): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed.length > 15 &&
    !trimmed.includes("placeholder") &&
    !trimmed.includes("your-key") &&
    !trimmed.includes("your_") &&
    !trimmed.startsWith("MY_")
  );
}

function getResolvedSupabaseUrlEnv(): string {
  return (
    [
      process.env.VITE_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_URL,
    ].find(isRealUrlEnv) || ""
  );
}

function getPublicSupabaseAnonKeyEnv(): string {
  return (
    [
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      process.env.VITE_SUPABASE_ANON_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      process.env.SUPABASE_ANON_KEY,
    ].find(isRealKeyEnv) || ""
  );
}

function getServerSupabaseKeyEnv(): string {
  return (
    [
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.SUPABASE_SECRET_KEY,
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      process.env.VITE_SUPABASE_ANON_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      process.env.SUPABASE_ANON_KEY,
    ].find(isRealKeyEnv) || ""
  );
}

function getServerSupabase(userJwt?: string): SupabaseClient | null {
  const sbUrl = getResolvedSupabaseUrlEnv();
  const serviceKey = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY].find(isRealKeyEnv) || "";
  const sbKey = serviceKey || getServerSupabaseKeyEnv();
  if (!sbUrl || !sbKey) return null;

  const options: any = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  if (!serviceKey && userJwt) {
    options.global = {
      headers: { Authorization: `Bearer ${userJwt}` },
    };
  }
  return createClient(sbUrl, sbKey, options);
}

const USER_SYNC_DIR = path.join(UPLOADS_DIR, "user-sync");
if (!fs.existsSync(USER_SYNC_DIR)) {
  try {
    fs.mkdirSync(USER_SYNC_DIR, { recursive: true });
  } catch (_) {}
}

function getSafeUserSyncId(userId: string): string {
  return String(userId || "").replace(/[^a-zA-Z0-9_-]/g, "");
}

const SYNC_WORKSPACE_FILE_NAME = "__edu_account_sync__.json";
const SYNC_WORKSPACE_FILE_TYPE = "application/vnd.eduai.sync+json";

function computeServerSyncDigest(snap: any): string {
  if (!snap || typeof snap !== "object") return "{}";
  const safeSessions = (Array.isArray(snap.aiChatSessions) ? snap.aiChatSessions : []).map((s: any) => ({
    id: s?.id || "",
    title: s?.title || "",
    msgs: (Array.isArray(s?.messages) ? s.messages : []).map(
      (m: any) => `${m?.id || ""}:${String(m?.content || "").length}`
    ),
  }));
  const delKeys = Object.entries(snap.deletedAiSessions || {}).sort(([a], [b]) => a.localeCompare(b));
  const readerKeys = Object.keys(snap.readerChats || {})
    .sort()
    .map((k) => [k, Array.isArray(snap.readerChats[k]) ? snap.readerChats[k].length : 0]);
  const peerConvs = (Array.isArray(snap.peerConversations) ? snap.peerConversations : [])
    .map((c: any) => c?.id || "")
    .sort();
  const peerMsgCounts = Object.keys(snap.peerMessages || {})
    .sort()
    .map((k) => [k, Array.isArray(snap.peerMessages[k]) ? snap.peerMessages[k].length : 0]);
  const bookIds = (Array.isArray(snap.unlockedBooks) ? snap.unlockedBooks : [])
    .map((b: any) => b?.id || "")
    .sort();
  const coverKeys = Object.keys(snap.bookCoverOverrides || {})
    .sort()
    .map((id) => {
      const o = snap.bookCoverOverrides[id] || {};
      return [id, o.coverMode || "", typeof o.coverImage === "string" ? o.coverImage.length : 0, o.pdfCoverPage || 0, o.updatedAt || ""];
    });
  const bmKeys = (Array.isArray(snap.bookmarks) ? snap.bookmarks : [])
    .map((bm: any) => `${bm?.bookId || ""}::${bm?.chapter || ""}`)
    .sort();
  const profKeys = Object.keys(snap.profileSnapshot || {})
    .filter((k) => k !== "updated_at")
    .sort()
    .map((k) => [k, snap.profileSnapshot[k]]);
  const ach = snap.achievements && typeof snap.achievements === "object" ? snap.achievements : null;
  const achDigest = ach
    ? [
        Number(ach.totalEduPoints || 0),
        Object.keys(ach.earnedBadges || {}).sort().length,
        Array.isArray(ach.completedBookIds) ? ach.completedBookIds.length : 0,
        Object.keys(ach.completedQuizIds || {}).sort().length,
        Array.isArray(ach.completedPathSteps) ? ach.completedPathSteps.length : 0,
      ]
    : null;
  const lpCount = Array.isArray(snap.learningPathSteps)
    ? snap.learningPathSteps.map((s: any) => `${s?.id || s?.title || ""}:${s?.status || ""}`)
    : [];
  const quizDigest = Array.isArray(snap.generatedQuizzes)
    ? snap.generatedQuizzes.map((q: any) => `${q?.id || ""}:${q?.status || ""}:${q?.score ?? ""}`)
    : [];
  const settingsDigest = snap.userSettings || null;
  const progressKeys = Object.keys(snap.readingProgress || {})
    .sort()
    .map((k) => [k, snap.readingProgress[k]]);
  return JSON.stringify({
    s: safeSessions,
    d: delKeys,
    a: snap.activeAiSessionId || "",
    r: readerKeys,
    pc: peerConvs,
    pm: peerMsgCounts,
    bk: bookIds,
    bc: coverKeys,
    bm: bmKeys,
    pr: profKeys,
    rp: progressKeys,
    dg: snap.dailyGoal || null,
    ac: achDigest,
    lp: lpCount,
    qz: quizDigest,
    st: settingsDigest,
  });
}

function hasMeaningfulSyncState(snap: any): boolean {
  if (!snap || typeof snap !== "object") return false;
  const aiMeaningful =
    Array.isArray(snap.aiChatSessions) && snap.aiChatSessions.some((s: any) => !isTrivialDefaultAiSession(s));
  const hasDeleted = snap.deletedAiSessions && Object.keys(snap.deletedAiSessions).length > 0;
  const hasReader = snap.readerChats && Object.keys(snap.readerChats).length > 0;
  const hasPeer =
    (Array.isArray(snap.peerConversations) && snap.peerConversations.length > 0) ||
    (snap.peerMessages && Object.keys(snap.peerMessages).length > 0);
  const hasBooks = Array.isArray(snap.unlockedBooks) && snap.unlockedBooks.length > 0;
  const hasCoverOverrides = snap.bookCoverOverrides && Object.keys(snap.bookCoverOverrides).length > 0;
  const hasBookmarks = Array.isArray(snap.bookmarks) && snap.bookmarks.length > 0;
  const hasProfile = snap.profileSnapshot && Object.keys(snap.profileSnapshot).length > 0;
  const hasGoal = Boolean(snap.dailyGoal);
  const hasProgress = snap.readingProgress && Object.keys(snap.readingProgress).length > 0;
  const hasAchievements =
    snap.achievements &&
    typeof snap.achievements === "object" &&
    (Number(snap.achievements.totalEduPoints || 0) > 0 ||
      Object.keys(snap.achievements.earnedBadges || {}).length > 0 ||
      (Array.isArray(snap.achievements.completedBookIds) && snap.achievements.completedBookIds.length > 0));
  const hasLearningPath = Array.isArray(snap.learningPathSteps) && snap.learningPathSteps.length > 0;
  const hasQuizzes = Array.isArray(snap.generatedQuizzes) && snap.generatedQuizzes.length > 0;
  const hasSettings = Boolean(snap.userSettings && typeof snap.userSettings === "object");
  return Boolean(
    aiMeaningful ||
      hasDeleted ||
      hasReader ||
      hasPeer ||
      hasBooks ||
      hasCoverOverrides ||
      hasBookmarks ||
      hasProfile ||
      hasGoal ||
      hasProgress ||
      hasAchievements ||
      hasLearningPath ||
      hasQuizzes ||
      hasSettings
  );
}

async function mirrorStateToWorkspaceFiles(
  userId: string,
  nextState: any,
  sb: SupabaseClient
): Promise<void> {
  try {
    const { data: existingRows, error: selErr } = await sb
      .from("workspace_files")
      .select("id")
      .eq("user_id", userId)
      .eq("type", SYNC_WORKSPACE_FILE_TYPE);
    if (selErr) return;

    const oldIds = Array.isArray(existingRows) ? existingRows.map((r: any) => r?.id).filter(Boolean) : [];
    const serialized = JSON.stringify(nextState);
    const { error: insErr } = await sb.from("workspace_files").insert({
      user_id: userId,
      name: SYNC_WORKSPACE_FILE_NAME,
      type: SYNC_WORKSPACE_FILE_TYPE,
      size: Buffer.byteLength(serialized, "utf8"),
      s3_key: serialized,
    });

    if (!insErr && oldIds.length > 0) {
      await sb.from("workspace_files").delete().eq("user_id", userId).in("id", oldIds);
    }
  } catch (_) {}
}

function isTrivialDefaultAiSession(session: any): boolean {
  return Boolean(
    session &&
      typeof session === "object" &&
      session.id === "default_session" &&
      Array.isArray(session.messages) &&
      session.messages.length <= 1
  );
}

function parseSyncMessageOrder(msgId: any, fallbackIdx: number): number {
  if (typeof msgId === "string" || typeof msgId === "number") {
    const str = String(msgId);
    if (str === "1" || str === "welcome") return 0;
    const match = str.match(/^(\d{10,})/);
    if (match) {
      const ts = Number(match[1]);
      if (Number.isFinite(ts)) {
        // Put assistant replies at the same millisecond slightly after user prompts
        return ts * 10 + (str.endsWith("ai") || str.endsWith("err") || str.endsWith("err2") ? 1 : 0);
      }
    }
  }
  return 10_000_000_000_000 + fallbackIdx;
}

function mergeSyncMessagesArray(msgsA: any[], msgsB: any[]): any[] {
  const combined = [...(Array.isArray(msgsA) ? msgsA : []), ...(Array.isArray(msgsB) ? msgsB : [])];
  const byKey = new Map<string, { msg: any; order: number }>();

  combined.forEach((m, idx) => {
    if (!m || typeof m !== "object") return;
    const idStr = m.id ? String(m.id) : "";
    const isStarter = idStr === "1" || idStr === "welcome";
    const key = isStarter ? "__starter_greeting__" : idStr || `${m.role || "msg"}::${String(m.content || "").slice(0, 120)}::${idx}`;
    const order = parseSyncMessageOrder(m.id, idx);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { msg: m, order });
    } else {
      const prevLen = String(existing.msg?.content || "").length;
      const nextLen = String(m?.content || "").length;
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

function mergeDeletedAiSessionsMap(
  mapA?: Record<string, string>,
  mapB?: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const src of [mapA, mapB]) {
    if (!src || typeof src !== "object") continue;
    for (const [id, iso] of Object.entries(src)) {
      if (!id || typeof iso !== "string") continue;
      const prevTs = result[id] ? Date.parse(result[id]) || 0 : 0;
      const nextTs = Date.parse(iso) || 0;
      if (!result[id] || nextTs >= prevTs) {
        result[id] = iso;
      }
    }
  }
  return result;
}

function serverMergeAiChatSessions(
  listA: any[],
  listB: any[],
  deletedMap?: Record<string, string>
): any[] {
  const safeA = Array.isArray(listA) ? listA : [];
  const safeB = Array.isArray(listB) ? listB : [];

  const isDeleted = (s: any) => {
    if (!s?.id || !deletedMap || !deletedMap[s.id]) return false;
    const delTs = Date.parse(deletedMap[s.id]) || 0;
    const sessTs = s.updatedAt ? Date.parse(s.updatedAt) || 0 : 0;
    return sessTs <= delTs;
  };

  const nonDefaultA = safeA.filter((s) => s?.id && !isTrivialDefaultAiSession(s) && !isDeleted(s));
  const nonDefaultB = safeB.filter((s) => s?.id && !isTrivialDefaultAiSession(s) && !isDeleted(s));

  if (nonDefaultA.length === 0 && nonDefaultB.length === 0) {
    const fallback = [...safeA, ...safeB].filter((s) => s?.id && !isDeleted(s));
    return fallback.length > 0 ? [fallback[0]] : [];
  }

  const byId = new Map<string, any>();
  for (const s of [...nonDefaultA, ...nonDefaultB]) {
    if (!s?.id) continue;
    const prev = byId.get(s.id);
    if (!prev) {
      byId.set(s.id, {
        ...s,
        messages: mergeSyncMessagesArray([], s.messages || []),
      });
      continue;
    }

    const mergedMessages = mergeSyncMessagesArray(prev.messages || [], s.messages || []);
    const prevUpdated = prev.updatedAt ? Date.parse(prev.updatedAt) || 0 : 0;
    const nextUpdated = s.updatedAt ? Date.parse(s.updatedAt) || 0 : 0;
    const isGenericTitle = (t?: string) => !t || t === "Introduction with Sage" || t === "New Conversation";
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
      const m = String(msgs[i]?.id || "").match(/^(\d{10,})/);
      if (m) return Number(m[1]);
    }
    const idMatch = String(s?.id || "").match(/^(\d{10,})/);
    return idMatch ? Number(idMatch[1]) : 0;
  };

  return Array.from(byId.values()).sort((a, b) => getActivityMs(b) - getActivityMs(a));
}

function serverMergeReaderChats(
  mapA: Record<string, any[]> = {},
  mapB: Record<string, any[]> = {}
): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  const allBooks = new Set([...Object.keys(mapA || {}), ...Object.keys(mapB || {})]);
  for (const bookId of allBooks) {
    const merged = mergeSyncMessagesArray(mapA?.[bookId] || [], mapB?.[bookId] || []);
    if (merged.length > 0) result[bookId] = merged;
  }
  return result;
}

function serverMergeById(listA: any[] = [], listB: any[] = [], keyFn?: (item: any) => string): any[] {
  const map = new Map<string, any>();
  for (const item of [...(Array.isArray(listA) ? listA : []), ...(Array.isArray(listB) ? listB : [])]) {
    if (!item || typeof item !== "object") continue;
    const k = keyFn ? keyFn(item) : String(item.id || "");
    if (!k) continue;
    const prev = map.get(k);
    if (!prev) {
      map.set(k, item);
    } else {
      const prevTs = prev.updatedAt ? Date.parse(prev.updatedAt) || 0 : prev.timestamp || 0;
      const nextTs = item.updatedAt ? Date.parse(item.updatedAt) || 0 : item.timestamp || 0;
      map.set(k, nextTs >= prevTs ? { ...prev, ...item } : { ...item, ...prev });
    }
  }
  return Array.from(map.values());
}

function serverMergePeerMessages(
  mapA: Record<string, any[]> = {},
  mapB: Record<string, any[]> = {},
  deletedPeerMessages?: Record<string, string>
): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  const delSet = deletedPeerMessages && typeof deletedPeerMessages === "object" ? deletedPeerMessages : {};
  const ids = new Set([...Object.keys(mapA || {}), ...Object.keys(mapB || {})]);
  for (const convId of ids) {
    const merged = serverMergeById(mapA?.[convId] || [], mapB?.[convId] || []).filter(
      (m) => m?.id && !delSet[m.id]
    );
    merged.sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) || 0 : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) || 0 : 0;
      return ta - tb;
    });
    result[convId] = merged;
  }
  return result;
}

function serverMergeBookCoverOverrides(
  mapA?: Record<string, any>,
  mapB?: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const src of [mapA, mapB]) {
    if (!src || typeof src !== "object") continue;
    for (const [bookId, raw] of Object.entries(src)) {
      if (!bookId || !raw || typeof raw !== "object") continue;
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

function serverMergeAchievements(a?: any, b?: any): any {
  const safeA = a && typeof a === "object" ? a : {};
  const safeB = b && typeof b === "object" ? b : {};
  if (!Object.keys(safeA).length && !Object.keys(safeB).length) return undefined;

  const earnedBadges: Record<string, any> = { ...(safeA.earnedBadges || {}) };
  for (const [badgeId, unlock] of Object.entries(safeB.earnedBadges || {})) {
    if (!unlock || typeof unlock !== "object") continue;
    const prev = earnedBadges[badgeId];
    if (!prev || String((unlock as any).unlockedAt || "") < String(prev.unlockedAt || "")) {
      earnedBadges[badgeId] = unlock;
    }
  }

  const completedBookIds = Array.from(
    new Set([
      ...(Array.isArray(safeA.completedBookIds) ? safeA.completedBookIds : []),
      ...(Array.isArray(safeB.completedBookIds) ? safeB.completedBookIds : []),
    ])
  );

  const completedQuizIds: Record<string, any> = { ...(safeA.completedQuizIds || {}) };
  for (const [qId, rec] of Object.entries(safeB.completedQuizIds || {})) {
    if (!rec || typeof rec !== "object") continue;
    const prev = completedQuizIds[qId];
    if (!prev) {
      completedQuizIds[qId] = rec;
    } else {
      completedQuizIds[qId] = {
        bestScore: Math.max(Number(prev.bestScore || 0), Number((rec as any).bestScore || 0)),
        completedAt: prev.completedAt || (rec as any).completedAt || new Date().toISOString(),
        pointsAwarded: Math.max(Number(prev.pointsAwarded || 0), Number((rec as any).pointsAwarded || 0)),
      };
    }
  }

  const completedPathSteps = Array.from(
    new Set([
      ...(Array.isArray(safeA.completedPathSteps) ? safeA.completedPathSteps : []),
      ...(Array.isArray(safeB.completedPathSteps) ? safeB.completedPathSteps : []),
    ])
  );

  const ledgerMap = new Map<string, any>();
  for (const ev of [
    ...(Array.isArray(safeA.rewardHistory) ? safeA.rewardHistory : []),
    ...(Array.isArray(safeB.rewardHistory) ? safeB.rewardHistory : []),
  ]) {
    if (!ev || !ev.id) continue;
    if (!ledgerMap.has(ev.id)) ledgerMap.set(ev.id, ev);
  }
  const rewardHistory = Array.from(ledgerMap.values())
    .sort((x, y) => String(y.timestamp || "").localeCompare(String(x.timestamp || "")))
    .slice(0, 60);

  const ledgerSum = Array.from(ledgerMap.values()).reduce((sum, ev) => sum + Number(ev.points || 0), 0);
  const totalEduPoints = Math.max(
    Number(safeA.totalEduPoints || 0),
    Number(safeB.totalEduPoints || 0),
    ledgerSum
  );

  const updA = String(safeA.updatedAt || "");
  const updB = String(safeB.updatedAt || "");
  return {
    totalEduPoints,
    earnedBadges,
    completedBookIds,
    completedQuizIds,
    completedPathSteps,
    rewardHistory,
    updatedAt: updB >= updA ? updB || updA || new Date().toISOString() : updA,
  };
}

function serverMergeQuizzes(listA: any[] = [], listB: any[] = []): any[] {
  const byId = new Map<string, any>();
  for (const q of [...(Array.isArray(listA) ? listA : []), ...(Array.isArray(listB) ? listB : [])]) {
    if (!q || typeof q !== "object" || !q.id) continue;
    const prev = byId.get(q.id);
    if (!prev) {
      byId.set(q.id, q);
      continue;
    }
    const prevDone = prev.status === "completed";
    const nextDone = q.status === "completed";
    if (nextDone && !prevDone) {
      byId.set(q.id, { ...prev, ...q });
    } else if (prevDone && !nextDone) {
      byId.set(q.id, prev);
    } else if (prevDone && nextDone) {
      const prevScore = Number(prev.score ?? -1);
      const nextScore = Number(q.score ?? -1);
      byId.set(q.id, nextScore >= prevScore ? { ...prev, ...q } : { ...q, ...prev });
    } else {
      byId.set(q.id, { ...prev, ...q });
    }
  }
  return Array.from(byId.values());
}

function mergeSyncSnapshots(snapshots: any[]): any {
  const valid = snapshots.filter((c) => c && typeof c === "object");
  if (valid.length === 0) return {};

  // Sort oldest -> newest so newer scalar values win while collection fields union cleanly
  const ordered = [...valid].sort((a, b) => {
    const ta = a?.updatedAt ? Date.parse(a.updatedAt) || 0 : 0;
    const tb = b?.updatedAt ? Date.parse(b.updatedAt) || 0 : 0;
    return ta - tb;
  });

  let deletedAiSessions: Record<string, string> = {};
  let deletedPeerMessages: Record<string, string> = {};
  for (const snap of ordered) {
    deletedAiSessions = mergeDeletedAiSessionsMap(deletedAiSessions, snap.deletedAiSessions);
    deletedPeerMessages = mergeDeletedAiSessionsMap(deletedPeerMessages, snap.deletedPeerMessages);
  }

  const acc: any = {
    deletedAiSessions,
    deletedPeerMessages,
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

  for (const snap of ordered) {
    if (Array.isArray(snap.aiChatSessions)) {
      acc.aiChatSessions = serverMergeAiChatSessions(acc.aiChatSessions, snap.aiChatSessions, deletedAiSessions);
    }
    if (snap.activeAiSessionId) {
      acc.activeAiSessionId = snap.activeAiSessionId;
    }
    if (snap.readerChats && typeof snap.readerChats === "object") {
      acc.readerChats = serverMergeReaderChats(acc.readerChats, snap.readerChats);
    }
    if (Array.isArray(snap.peerConversations)) {
      acc.peerConversations = serverMergeById(acc.peerConversations, snap.peerConversations);
    }
    if (snap.peerMessages && typeof snap.peerMessages === "object") {
      acc.peerMessages = serverMergePeerMessages(acc.peerMessages, snap.peerMessages, deletedPeerMessages);
    }
    if (Array.isArray(snap.unlockedBooks)) {
      acc.unlockedBooks = serverMergeById(acc.unlockedBooks, snap.unlockedBooks);
    }
    if (snap.bookCoverOverrides && typeof snap.bookCoverOverrides === "object") {
      acc.bookCoverOverrides = serverMergeBookCoverOverrides(acc.bookCoverOverrides, snap.bookCoverOverrides);
    }
    if (Array.isArray(snap.bookmarks)) {
      acc.bookmarks = serverMergeById(
        acc.bookmarks,
        snap.bookmarks,
        (bm) => (bm?.bookId ? `${bm.bookId}::${bm.chapter || ""}` : "")
      );
    }
    if (snap.profileSnapshot && typeof snap.profileSnapshot === "object") {
      acc.profileSnapshot = { ...acc.profileSnapshot, ...snap.profileSnapshot };
    }
    if (snap.readingProgress && typeof snap.readingProgress === "object") {
      for (const [bookId, pct] of Object.entries(snap.readingProgress)) {
        const val = Number(pct);
        if (Number.isFinite(val)) {
          acc.readingProgress[bookId] = Math.max(Number(acc.readingProgress[bookId] || 0), val);
        }
      }
    }
    if (snap.dailyGoal && typeof snap.dailyGoal === "object") {
      acc.dailyGoal = snap.dailyGoal;
    }
    if (snap.achievements && typeof snap.achievements === "object") {
      acc.achievements = serverMergeAchievements(acc.achievements, snap.achievements);
    }
    if (Array.isArray(snap.learningPathSteps) && snap.learningPathSteps.length > 0) {
      acc.learningPathSteps = snap.learningPathSteps;
    }
    if (Array.isArray(snap.generatedQuizzes) && snap.generatedQuizzes.length > 0) {
      acc.generatedQuizzes = serverMergeQuizzes(acc.generatedQuizzes || [], snap.generatedQuizzes);
    }
    if (snap.userSettings && typeof snap.userSettings === "object") {
      const prevTs = acc.userSettings?.updatedAt ? Date.parse(acc.userSettings.updatedAt) || 0 : 0;
      const nextTs = snap.userSettings.updatedAt ? Date.parse(snap.userSettings.updatedAt) || 0 : 0;
      acc.userSettings =
        nextTs >= prevTs
          ? { ...(acc.userSettings || {}), ...snap.userSettings }
          : { ...snap.userSettings, ...(acc.userSettings || {}) };
    }
    if (snap.updatedAt) {
      acc.updatedAt = snap.updatedAt;
    }
  }

  return acc;
}

async function readServerUserSyncWithMeta(
  userId: string,
  sb?: SupabaseClient | null
): Promise<{ state: any; wfRowCount: number; wfDigest: string; mergedDigest: string }> {
  const safeId = getSafeUserSyncId(userId);
  if (!safeId) return { state: {}, wfRowCount: 0, wfDigest: "{}", mergedDigest: "{}" };
  const localPath = path.join(USER_SYNC_DIR, `${safeId}.json`);
  const candidates: any[] = [];
  const wfCandidates: any[] = [];
  let wfRowCount = 0;

  try {
    if (fs.existsSync(localPath)) {
      const parsed = JSON.parse(fs.readFileSync(localPath, "utf-8"));
      if (parsed && typeof parsed === "object") candidates.push(parsed);
    }
  } catch (_) {}

  if (sb) {
    // 1. Live Postgres 'workspace_files' table (available in both AI Studio & Vercel)
    try {
      const { data: wfRows, error: wfErr } = await sb
        .from("workspace_files")
        .select("id, s3_key, created_at")
        .eq("user_id", userId)
        .eq("type", SYNC_WORKSPACE_FILE_TYPE)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!wfErr && Array.isArray(wfRows)) {
        wfRowCount = wfRows.length;
        for (const row of wfRows) {
          if (!row?.s3_key || typeof row.s3_key !== "string") continue;
          try {
            const parsed = JSON.parse(row.s3_key);
            if (parsed && typeof parsed === "object") {
              const snap = { ...parsed, updatedAt: parsed.updatedAt || row.created_at };
              candidates.push(snap);
              wfCandidates.push(snap);
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 2. Optional user_account_sync table
    try {
      const { data, error } = await sb
        .from("user_account_sync")
        .select("*")
        .eq("user_id", userId)
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

    // 3. Optional Supabase Storage bucket
    try {
      const { data: blobData, error: storageErr } = await sb.storage
        .from("workspace-files")
        .download(`${userId}/account-sync.json`);
      if (!storageErr && blobData) {
        const text = await blobData.text();
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") candidates.push(parsed);
      }
    } catch (_) {}

    // 4. Optional learning_paths fallback table
    try {
      const { data: lpData, error: lpErr } = await sb
        .from("learning_paths")
        .select("steps, updated_at")
        .eq("user_id", userId)
        .eq("title", "__edu_account_sync__")
        .maybeSingle();
      if (!lpErr && lpData?.steps && typeof lpData.steps === "object" && !Array.isArray(lpData.steps)) {
        candidates.push({ ...lpData.steps, updatedAt: lpData.steps.updatedAt || lpData.updated_at });
      }
    } catch (_) {}
  }

  const s3 = getS3Client();
  if (s3 && B2_BUCKET_NAME) {
    try {
      const obj = await s3.send(new GetObjectCommand({ Bucket: B2_BUCKET_NAME, Key: `user-sync/${safeId}.json` }));
      if (obj.Body) {
        const chunks: any[] = [];
        for await (const chunk of obj.Body as any) chunks.push(chunk);
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        if (parsed && typeof parsed === "object") candidates.push(parsed);
      }
    } catch (_) {}
  }

  const state = mergeSyncSnapshots(candidates);
  const wfState = wfCandidates.length > 0 ? mergeSyncSnapshots(wfCandidates) : {};
  return {
    state,
    wfRowCount,
    wfDigest: computeServerSyncDigest(wfState),
    mergedDigest: computeServerSyncDigest(state),
  };
}

async function readServerUserSync(userId: string, sb?: SupabaseClient | null): Promise<any> {
  const { state } = await readServerUserSyncWithMeta(userId, sb);
  return state;
}

async function writeServerUserSync(userId: string, patch: any, sb?: SupabaseClient | null): Promise<any> {
  const safeId = getSafeUserSyncId(userId);
  if (!safeId) return {};
  const existing = await readServerUserSync(userId, sb);
  const nowIso = new Date().toISOString();

  const nextState = mergeSyncSnapshots([
    existing,
    {
      ...patch,
      updatedAt: nowIso,
    },
  ]);
  nextState.updatedAt = nowIso;

  const localPath = path.join(USER_SYNC_DIR, `${safeId}.json`);
  try {
    if (!fs.existsSync(USER_SYNC_DIR)) fs.mkdirSync(USER_SYNC_DIR, { recursive: true });
    fs.writeFileSync(localPath, JSON.stringify(nextState), "utf-8");
  } catch (fsErr) {
    console.warn("[AccountSync] Local disk write warning:", fsErr);
  }

  if (sb) {
    // 1. Primary live Postgres persistence via workspace_files table (insert-then-delete old rows)
    await mirrorStateToWorkspaceFiles(userId, nextState, sb);

    // 2. Optional user_account_sync table
    try {
      const { error: tblErr } = await sb.from("user_account_sync").upsert(
        {
          user_id: userId,
          ai_chat_sessions: nextState.aiChatSessions || [],
          active_ai_session_id: nextState.activeAiSessionId || null,
          reader_chats: nextState.readerChats || {},
          peer_conversations: nextState.peerConversations || [],
          peer_messages: nextState.peerMessages || {},
          unlocked_books: nextState.unlockedBooks || [],
          profile_snapshot: nextState.profileSnapshot || {},
          updated_at: nowIso,
        },
        { onConflict: "user_id" }
      );
      if (
        tblErr &&
        !String(tblErr.message || "").includes("schema cache") &&
        !String(tblErr.message || "").includes("does not exist")
      ) {
        console.warn("[AccountSync] user_account_sync upsert notice:", tblErr.message);
      }
    } catch (_) {}

    // 3. Optional Supabase Storage bucket
    try {
      await sb.storage
        .from("workspace-files")
        .upload(`${userId}/account-sync.json`, Buffer.from(JSON.stringify(nextState), "utf-8"), {
          contentType: "application/json",
          upsert: true,
        });
    } catch (_) {}

    // 4. Optional learning_paths fallback
    try {
      const { data: existingLp, error: lpSelErr } = await sb
        .from("learning_paths")
        .select("id")
        .eq("user_id", userId)
        .eq("title", "__edu_account_sync__")
        .maybeSingle();
      if (!lpSelErr) {
        if (existingLp?.id) {
          await sb
            .from("learning_paths")
            .update({ steps: nextState, updated_at: nowIso })
            .eq("id", existingLp.id);
        } else {
          await sb.from("learning_paths").insert({
            user_id: userId,
            title: "__edu_account_sync__",
            plan_mode: "roadmap",
            steps: nextState,
            is_active: false,
            updated_at: nowIso,
          });
        }
      }
    } catch (_) {}
  }

  const s3 = getS3Client();
  if (s3 && B2_BUCKET_NAME) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: `user-sync/${safeId}.json`,
          ContentType: "application/json",
          Body: Buffer.from(JSON.stringify(nextState), "utf-8"),
        })
      );
    } catch (_) {}
  }

  return nextState;
}

const ADMIN_EMAIL_SET = new Set(ADMIN_EMAILS.map((e) => e.toLowerCase()));

function normalizeCanonicalProfileRole(rawRole: any, email?: string): string {
  const emailLower = String(email || "").trim().toLowerCase();
  if (emailLower && (ADMIN_EMAIL_SET.has(emailLower) || isAuthorizedAdminEmail(emailLower))) return "admin";
  const val = String(rawRole || "").trim().toLowerCase();
  if (val === "admin" || val === "teacher" || val === "educator" || val === "parent" || val === "student") {
    return val;
  }
  return "student";
}

function firstNonEmptyString(...vals: any[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) {
      return v.trim();
    }
  }
  return null;
}

async function ensureCanonicalUserProfile(
  authUser: any,
  sb?: SupabaseClient | null,
  options?: { extraPatch?: Record<string, any>; existingSync?: any }
): Promise<any> {
  if (!authUser?.id) return null;
  const userId = authUser.id;
  const meta = authUser.user_metadata && typeof authUser.user_metadata === "object" ? authUser.user_metadata : {};
  const extra = options?.extraPatch && typeof options.extraPatch === "object" ? options.extraPatch : {};
  const privSb = getServerSupabase() || sb || null;

  let existingProf: any = null;
  if (privSb) {
    try {
      const { data } = await privSb.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (data) existingProf = data;
    } catch (_) {}
  }

  let syncState = options?.existingSync;
  if (!syncState) {
    try {
      syncState = await readServerUserSync(userId, sb || privSb);
    } catch (_) {
      syncState = {};
    }
  }
  const snap = syncState?.profileSnapshot && typeof syncState.profileSnapshot === "object" ? syncState.profileSnapshot : {};

  const email = firstNonEmptyString(extra.email, existingProf?.email, snap.email, authUser.email, meta.email);
  const phone = firstNonEmptyString(extra.phone, existingProf?.phone, snap.phone, authUser.phone);

  const metaComposedName = firstNonEmptyString(
    meta.full_name,
    meta.name,
    [meta.given_name, meta.family_name].filter(Boolean).join(" ").trim(),
    meta.preferred_username,
    meta.user_name
  );
  const fullName =
    firstNonEmptyString(
      extra.full_name,
      existingProf?.full_name,
      snap.full_name,
      metaComposedName,
      email ? email.split("@")[0] : null,
      phone
    ) || "Edu AI Scholar";

  const isRelativeUploadKey = (val: string) =>
    !val.startsWith("http://") &&
    !val.startsWith("https://") &&
    !val.startsWith("data:") &&
    !val.startsWith("blob:") &&
    !val.startsWith("/api/");

  const avatarCandidates = [
    extra.avatar_url,
    existingProf?.avatar_url,
    snap.avatar_url,
    meta.avatar_url,
    meta.picture,
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0 && !v.includes("unsplash.com") && !v.includes("photo-1534528741775-53994a69daeb"))
    .map((v) => v.trim());

  let avatarUrl: string | null = extra.avatar_url ? avatarCandidates[0] || null : null;
  if (!avatarUrl && avatarCandidates.length > 0) {
    // Prefer direct portable URLs (https://, data:image/...) if a candidate is a missing local upload key
    for (const cand of avatarCandidates) {
      if (!isRelativeUploadKey(cand)) {
        avatarUrl = cand;
        break;
      }
      const cleanRel = cand.replace(/^\/+/, "").replace(/^uploads\/+/, "");
      const existsOnDisk =
        fs.existsSync(path.join(UPLOADS_DIR, cand)) ||
        fs.existsSync(path.join(UPLOADS_DIR, cleanRel));
      if (existsOnDisk) {
        avatarUrl = cand;
        break;
      }
      // Check Supabase Storage if available before skipping relative key
      let existsInSupabase = false;
      if (privSb) {
        const cleanVariants = Array.from(new Set([cand.replace(/^\/+/, ""), cleanRel]));
        for (const bucket of ["avatars", "workspace-files", "uploads"]) {
          for (const pathKey of cleanVariants) {
            try {
              const { data: dl } = await privSb.storage.from(bucket).download(pathKey);
              if (dl) {
                existsInSupabase = true;
                break;
              }
            } catch (_) {}
          }
          if (existsInSupabase) break;
        }
      }
      if (existsInSupabase) {
        avatarUrl = cand;
        break;
      }
    }
    if (!avatarUrl) {
      avatarUrl = avatarCandidates[0] || null;
    }
  }

  const role = normalizeCanonicalProfileRole(
    extra.role || existingProf?.role || snap.role || meta.role,
    email || undefined
  );

  const country = firstNonEmptyString(extra.country, existingProf?.country, snap.country, meta.country, existingProf?.location, snap.location, meta.location);
  const location = firstNonEmptyString(extra.location, existingProf?.location, snap.location, meta.location, country);
  const educationLevel = firstNonEmptyString(
    extra.education_level,
    existingProf?.education_level,
    snap.education_level,
    meta.education_level
  );
  const curriculum = firstNonEmptyString(extra.curriculum, existingProf?.curriculum, snap.curriculum, meta.curriculum);
  const fieldOfStudy = firstNonEmptyString(
    extra.field_of_study,
    existingProf?.field_of_study,
    snap.field_of_study,
    meta.field_of_study
  );
  const rawSubjects =
    extra.subjects !== undefined
      ? Array.isArray(extra.subjects)
        ? extra.subjects.map((s: any) => String(s).trim()).filter(Boolean).join(", ")
        : extra.subjects
      : existingProf?.subjects || snap.subjects || meta.subjects;
  const subjects = typeof rawSubjects === "string" && rawSubjects.trim() ? rawSubjects.trim() : null;
  const dob = firstNonEmptyString(extra.dob, existingProf?.dob, snap.dob, meta.dob);
  const title = firstNonEmptyString(
    extra.title,
    existingProf?.title,
    snap.title,
    meta.title,
    fieldOfStudy ? `${fieldOfStudy} Scholar` : curriculum ? `${curriculum} Learner` : role === "teacher" ? "Faculty Educator" : null
  );
  const institution = firstNonEmptyString(
    extra.institution,
    existingProf?.institution,
    snap.institution,
    meta.institution,
    educationLevel ? `${educationLevel} • Edu AI` : null
  );
  const bio = firstNonEmptyString(extra.bio, existingProf?.bio, snap.bio, meta.bio);
  const username =
    firstNonEmptyString(existingProf?.username, snap.username, meta.user_name, meta.preferred_username) ||
    `${fullName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "learner"}_${String(userId).slice(0, 6)}`;

  const nowIso = new Date().toISOString();
  const canonical: Record<string, any> = {
    id: userId,
    username,
    full_name: fullName,
    email,
    phone,
    dob,
    avatar_url: avatarUrl,
    role,
    country,
    location,
    education_level: educationLevel,
    curriculum,
    field_of_study: fieldOfStudy,
    subjects,
    title,
    institution,
    bio,
    status: "online",
    updated_at: nowIso,
  };

  const needsDbUpsert =
    !existingProf ||
    Object.keys(extra).length > 0 ||
    existingProf.full_name !== canonical.full_name ||
    (canonical.email && existingProf.email !== canonical.email) ||
    existingProf.role !== canonical.role ||
    (canonical.avatar_url && !existingProf.avatar_url) ||
    (canonical.country && !existingProf.country) ||
    (canonical.education_level && !existingProf.education_level) ||
    (canonical.curriculum && !existingProf.curriculum) ||
    (canonical.field_of_study && !existingProf.field_of_study) ||
    (canonical.subjects && !existingProf.subjects) ||
    !existingProf.username;

  let persistedProfile = { ...(existingProf || {}), ...canonical };
  if (privSb && needsDbUpsert) {
    try {
      const dbRow: Record<string, any> = { ...canonical };
      // Omit optional columns if null to maximize compatibility across schemas
      if (!dbRow.dob) delete dbRow.dob;
      const { data: upserted, error: upsErr } = await privSb
        .from("profiles")
        .upsert(dbRow, { onConflict: "id" })
        .select("*")
        .maybeSingle();
      if (!upsErr && upserted) {
        persistedProfile = upserted;
      } else if (upsErr) {
        // Retry minimal safe column set in case optional columns differ
        const minimalRow: Record<string, any> = {
          id: userId,
          full_name: fullName,
          email,
          avatar_url: avatarUrl,
          role,
          country,
          location,
          education_level: educationLevel,
          curriculum,
          field_of_study: fieldOfStudy,
          subjects,
          updated_at: nowIso,
        };
        const { data: minData } = await privSb
          .from("profiles")
          .upsert(minimalRow, { onConflict: "id" })
          .select("*")
          .maybeSingle();
        if (minData) persistedProfile = { ...canonical, ...minData };
      }
    } catch (_) {}
  }

  const finalCanonical = {
    ...canonical,
    ...persistedProfile,
    role,
    full_name: persistedProfile.full_name || fullName,
    email: persistedProfile.email || email,
    avatar_url: persistedProfile.avatar_url || avatarUrl,
    country: persistedProfile.country || country,
    location: persistedProfile.location || location,
    education_level: persistedProfile.education_level || educationLevel,
    curriculum: persistedProfile.curriculum || curriculum,
    field_of_study: persistedProfile.field_of_study || fieldOfStudy,
    subjects: persistedProfile.subjects || subjects,
  };

  // Keep user_sync profileSnapshot aligned for offline / cross-device fallback
  const snapDiffers =
    !snap ||
    !snap.full_name ||
    snap.role !== finalCanonical.role ||
    snap.country !== finalCanonical.country ||
    snap.education_level !== finalCanonical.education_level ||
    snap.subjects !== finalCanonical.subjects ||
    snap.avatar_url !== finalCanonical.avatar_url ||
    Object.keys(extra).length > 0;
  if (snapDiffers) {
    try {
      await writeServerUserSync(userId, { profileSnapshot: finalCanonical }, sb || privSb);
    } catch (_) {}
  }

  // Keep social user directory synchronized for all existing & new accounts
  try {
    await syncUserProfileToStoreAndSupabase(
      {
        ...authUser,
        email: finalCanonical.email || authUser.email,
        user_metadata: {
          ...meta,
          full_name: finalCanonical.full_name,
          avatar_url: finalCanonical.avatar_url || undefined,
          role: finalCanonical.role,
          country: finalCanonical.country || undefined,
          location: finalCanonical.location || undefined,
          education_level: finalCanonical.education_level || undefined,
          curriculum: finalCanonical.curriculum || undefined,
          field_of_study: finalCanonical.field_of_study || undefined,
          subjects: finalCanonical.subjects || undefined,
          title: finalCanonical.title || undefined,
          institution: finalCanonical.institution || undefined,
          bio: finalCanonical.bio || undefined,
        },
      },
      null,
      {
        name: finalCanonical.full_name,
        email: finalCanonical.email || "",
        avatar: finalCanonical.avatar_url || "",
        location: finalCanonical.location || finalCanonical.country || "",
        subjects: parseSubjectsList(finalCanonical.subjects),
      }
    );
  } catch (_) {}

  return finalCanonical;
}

const rawEndpoint = process.env.B2_ENDPOINT || "https://s3.us-west-004.backblazeb2.com";
const endpoint = rawEndpoint.startsWith('http') ? rawEndpoint : `https://${rawEndpoint}`;

let s3ClientInstance: S3Client | null = null;
function getS3Client(): S3Client | null {
  const isB2Configured = Boolean(
    process.env.B2_ACCESS_KEY_ID && 
    !process.env.B2_ACCESS_KEY_ID.startsWith('your_') && 
    process.env.B2_SECRET_ACCESS_KEY && 
    !process.env.B2_SECRET_ACCESS_KEY.startsWith('your_') && 
    process.env.B2_BUCKET_NAME && 
    !process.env.B2_BUCKET_NAME.startsWith('your_')
  );

  if (!isB2Configured) return null;

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      endpoint,
      region: process.env.B2_REGION || "us-west-004",
      credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3ClientInstance;
}

const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || "";

const BOOK_CATALOG_TITLES: Record<string, string> = {
  '1': 'Advanced Science: Modern Physics',
  '2': 'Algorithms & Data Structures',
  '9': 'Essential Cybersecurity',
  '10': 'CBC Grade 9 Mathematics',
  '10b': 'KLB Secondary Physics Book 1',
  'klb-physics-1': 'KLB Secondary Physics Book 1',
  'klb_book_1_physics': 'KLB Secondary Physics Book 1',
  'klb_book_1_physics.pdf': 'KLB Secondary Physics Book 1',
  'klb_secondary_physics_book_1.pdf': 'KLB Secondary Physics Book 1',
  'cbc-g9-agri': 'CBC Grade 9 Agriculture & Nutrition',
  'cbc-g9-intscience': 'CBC Grade 9 Integrated Science',
  'cbc-g10-english': 'CBC Grade 10 English Literature & Literacy',
  'cbc-g9-kiswahili': 'CBC Kidato cha Kwanza: Kiswahili Sanifu',
  'cbc-g10-computerscience': 'CBC Grade 10 Computer Science',
  'cbc-g9-socialstudies': 'CBC Grade 9 Social Studies & Civics',
  '11': 'WASSCE Integrated Science',
  '12': 'A-Level Economics',
  '13': 'Modern Business Management',
  '14': 'Introduction to Law',
  'store-1': 'The Design of Everyday Things',
  'store-2': 'Syllabus Guide: East African Biology',
  'store-3': 'Introduction to Organic Chemistry',
  'store-4': 'Kenyan CBC Grade 10 Geography Notes',
  'store-5': 'Modern World History & Civics',
  'store-6': 'University Calculus Vol. 1',
  'store-7': 'Human Anatomy & Physiology Essentials',
  'store-8': 'Machine Learning & Deep Learning Foundations',
  'store-9': 'Microeconomic Theory & Applications',
  'store-10': 'Constitutional Law & Human Rights in Africa',
};

function isKLBPhysicsBook(keyOrTitle: string): boolean {
  const lower = keyOrTitle.toLowerCase();
  return (
    (lower.includes('klb') && lower.includes('physic')) ||
    lower.includes('10b') ||
    lower.includes('klb_book_1_physics') ||
    lower.includes('klb_secondary_physics') ||
    lower.includes('grade 9 physics') ||
    lower.includes('secondary physics book 1') ||
    lower.includes('form 1 physics')
  );
}

function getTitleFromKey(key: string): string {
  if (BOOK_CATALOG_TITLES[key]) {
    return BOOK_CATALOG_TITLES[key];
  }
  const filename = key.split('/').pop() || key;
  const withoutExt = filename.replace(/\.pdf$/i, '');
  if (BOOK_CATALOG_TITLES[withoutExt]) {
    return BOOK_CATALOG_TITLES[withoutExt];
  }
  const spaced = withoutExt.replace(/[_\-]/g, ' ');
  return spaced
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getSubjectTheme(title: string): { category: string; keyConcept: string; subtitle: string } {
  const lower = title.toLowerCase();
  if (lower.includes('physic') || lower.includes('science')) {
    return {
      category: 'Natural Sciences & STEM',
      keyConcept: 'Laws of Thermodynamics, Quantum Mechanics & Electromagnetism',
      subtitle: 'Comprehensive Theoretical & Experimental Study Guide',
    };
  } else if (lower.includes('math') || lower.includes('algebra') || lower.includes('calculus')) {
    return {
      category: 'Pure & Applied Mathematics',
      keyConcept: 'Polynomial Equations, Vector Calculus, & Geometric Proofs',
      subtitle: 'Core Curriculum & Problem-Solving Strategies',
    };
  } else if (lower.includes('algorithm') || lower.includes('computer') || lower.includes('cyber') || lower.includes('code')) {
    return {
      category: 'Information & Computer Sciences',
      keyConcept: 'Data Structures, Computational Complexity & Network Defense',
      subtitle: 'System Architecture & Algorithmic Design Handbook',
    };
  } else if (lower.includes('agri') || lower.includes('nutrit')) {
    return {
      category: 'Agriculture & Biosystems',
      keyConcept: 'Soil Conservation, Crop Biotechnology & Sustainable Food Security',
      subtitle: 'Modern Agricultural Practices & Ecological Stewardship',
    };
  } else if (lower.includes('kiswahili') || lower.includes('fasihi')) {
    return {
      category: 'Lugha na Fasihi',
      keyConcept: 'Sarufi ya Kiswahili, Uchambuzi wa Tamthilia na Ushairi',
      subtitle: 'Mwongozo Kamili wa Kiswahili Sanifu',
    };
  } else if (lower.includes('english') || lower.includes('literat')) {
    return {
      category: 'Literary Studies & Linguistics',
      keyConcept: 'Narrative Structures, Critical Analysis & Rhetorical Devices',
      subtitle: 'Classical & Contemporary Literature Studies',
    };
  }
  return {
    category: 'Competency Based Education',
    keyConcept: 'Foundational Knowledge, Inquiry-Based Learning & Skill Mastery',
    subtitle: 'Integrated Academic & Practical Reference Guide',
  };
}

function generateEducationalPdf(title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        try {
          // Add page numbers to all pages
          const range = doc.bufferedPageRange();
          for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fillColor('#78716C');
            doc.fontSize(8).font('Helvetica');
            doc.text(
              `Edu AI Study Reader  •  ${title}  •  Page ${i + 1} of ${range.count}`,
              48,
              doc.page.height - 36,
              { align: 'center', width: doc.page.width - 96 }
            );
          }
          resolve(Buffer.concat(chunks));
        } catch (e) {
          resolve(Buffer.concat(chunks));
        }
      });
      doc.on('error', (err) => reject(err));

      const theme = getSubjectTheme(title);

      // ==========================================
      // PAGE 1: TITLE & COURSE OVERVIEW
      // ==========================================
      doc.rect(48, 48, doc.page.width - 96, 4).fill('#0284C7'); // Accent top bar
      doc.moveDown(1.5);

      doc.fillColor('#0284C7');
      doc.fontSize(10).font('Helvetica-Bold').text(theme.category.toUpperCase(), { characterSpacing: 1.5 });
      doc.moveDown(0.4);

      doc.fillColor('#0F172A');
      doc.fontSize(22).font('Helvetica-Bold').text(title, { lineGap: 3 });
      doc.moveDown(0.4);

      doc.fillColor('#475569');
      doc.fontSize(12).font('Helvetica-Oblique').text(theme.subtitle);
      doc.moveDown(1.5);

      // Metadata card
      doc.rect(48, doc.y, doc.page.width - 96, 52).fillAndStroke('#F8FAFC', '#E2E8F0');
      const metaY = doc.y + 12;
      doc.fillColor('#0F172A');
      doc.fontSize(9).font('Helvetica-Bold').text('Curriculum:', 60, metaY);
      doc.font('Helvetica').text('Kenyan CBC & Regional Standards', 130, metaY);
      doc.font('Helvetica-Bold').text('Target Level:', 320, metaY);
      doc.font('Helvetica').text('Secondary / University Studies', 390, metaY);

      doc.font('Helvetica-Bold').text('Pedagogy:', 60, metaY + 18);
      doc.font('Helvetica').text('Inquiry, Analysis & Practice', 130, metaY + 18);
      doc.font('Helvetica-Bold').text('AI Integration:', 320, metaY + 18);
      doc.font('Helvetica').text('Sage AI Tutor Active', 390, metaY + 18);

      doc.y = metaY + 46;
      doc.moveDown(1.2);

      doc.fillColor('#0F172A');
      doc.fontSize(14).font('Helvetica-Bold').text('Table of Contents');
      doc.moveDown(0.6);

      const chapters = [
        { num: 'Chapter 1', name: 'Foundational Principles & Core Concepts', page: '2' },
        { num: 'Chapter 2', name: 'Theoretical Frameworks & Systematic Analysis', page: '3' },
        { num: 'Chapter 3', name: 'Practical Applications & Real-World Case Studies', page: '4' },
        { num: 'Chapter 4', name: 'Formative Assessment & Self-Evaluation Questions', page: '5' },
      ];

      chapters.forEach((ch) => {
        doc.fillColor('#1E293B');
        doc.fontSize(10).font('Helvetica-Bold').text(ch.num, 60, doc.y, { continued: true });
        doc.font('Helvetica').text(`  —  ${ch.name}`, { continued: true });
        doc.font('Helvetica-Bold').text(` ............................. Page ${ch.page}`, { align: 'right' });
        doc.moveDown(0.5);
      });

      doc.moveDown(1.2);
      doc.fillColor('#0369A1');
      doc.fontSize(12).font('Helvetica-Bold').text('Key Learning Objectives');
      doc.moveDown(0.4);

      const objectives = [
        `Understand the fundamental theorems and core axioms of ${title}.`,
        'Develop critical analytical competence to evaluate real-world problem sets.',
        'Apply domain methodologies and communicate findings with precision.',
        'Collaborate with Sage AI Tutor to explore nuanced questions and edge cases.',
      ];

      objectives.forEach((obj, idx) => {
        doc.fillColor('#334155');
        doc.fontSize(9.5).font('Helvetica').text(`${idx + 1}.  ${obj}`, 60, doc.y, { lineGap: 3 });
        doc.moveDown(0.4);
      });

      // ==========================================
      // PAGE 2: CHAPTER 1 - FOUNDATIONS
      // ==========================================
      doc.addPage();
      doc.fillColor('#0284C7');
      doc.fontSize(10).font('Helvetica-Bold').text('CHAPTER 1', { characterSpacing: 1.5 });
      doc.moveDown(0.2);
      doc.fillColor('#0F172A');
      doc.fontSize(18).font('Helvetica-Bold').text('Foundational Principles & Core Concepts');
      doc.moveDown(0.8);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        `The study of ${title} begins with establishing clear axioms and defining the primary structural units that govern the field. Historically, scholars and practitioners observed regularities in natural and synthetic phenomena, which led to the formulation of structured models.`,
        { lineGap: 4, align: 'justify' }
      );
      doc.moveDown();

      doc.text(
        `In modern curricula, deep conceptual mastery is prioritized over rote memorization. Understanding how ${theme.keyConcept} interacts with underlying environmental and computational variables enables learners to formulate rigorous hypotheses.`,
        { lineGap: 4, align: 'justify' }
      );
      doc.moveDown(1.2);

      // Callout box for Core Axiom
      doc.rect(48, doc.y, doc.page.width - 96, 68).fillAndStroke('#F0FDF4', '#BBF7D0');
      const boxY = doc.y + 12;
      doc.fillColor('#166534');
      doc.fontSize(10).font('Helvetica-Bold').text('CORE PRINCIPLE & DEFINITION', 60, boxY);
      doc.fillColor('#15803D');
      doc.fontSize(9.5).font('Helvetica-Oblique').text(
        `"Every observed system maintains equilibrium until unbalanced internal forces or external inputs shift its operational state. Systematic modeling requires identifying boundary conditions and isolating active state variables."`,
        60,
        boxY + 16,
        { width: doc.page.width - 120, lineGap: 2 }
      );

      doc.y = boxY + 62;
      doc.moveDown(1.2);

      doc.fillColor('#0F172A');
      doc.fontSize(12).font('Helvetica-Bold').text('1.1 Structural Decomposition');
      doc.moveDown(0.5);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        'When breaking down complex systems, researchers employ hierarchical decomposition. This approach isolates three interdependent layers:',
        { lineGap: 3 }
      );
      doc.moveDown(0.6);

      const layers = [
        { label: 'Primary Inputs:', desc: 'Baseline empirical data, physical constants, or sensory observations collected under standard conditions.' },
        { label: 'Transformative Engine:', desc: 'The mathematical, physical, or logical operators that process inputs according to established laws.' },
        { label: 'Measurable Outcomes:', desc: 'Predictable, verifiable responses that validate or refine the original conceptual model.' },
      ];

      layers.forEach((l) => {
        doc.fillColor('#0F172A');
        doc.fontSize(9.5).font('Helvetica-Bold').text(`•  ${l.label} `, 60, doc.y, { continued: true });
        doc.fillColor('#334155');
        doc.font('Helvetica').text(l.desc, { lineGap: 3 });
        doc.moveDown(0.4);
      });

      // ==========================================
      // PAGE 3: CHAPTER 2 - THEORETICAL FRAMEWORK
      // ==========================================
      doc.addPage();
      doc.fillColor('#0284C7');
      doc.fontSize(10).font('Helvetica-Bold').text('CHAPTER 2', { characterSpacing: 1.5 });
      doc.moveDown(0.2);
      doc.fillColor('#0F172A');
      doc.fontSize(18).font('Helvetica-Bold').text('Theoretical Frameworks & Systematic Analysis');
      doc.moveDown(0.8);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        `Analytical models in ${title} rely on rigorous methodologies that link empirical observation with theoretical deduction. By categorizing dynamic variables, we can predict system trajectories with high accuracy.`,
        { lineGap: 4, align: 'justify' }
      );
      doc.moveDown();

      doc.fillColor('#0F172A');
      doc.fontSize(12).font('Helvetica-Bold').text('2.1 Comparative System Metrics');
      doc.moveDown(0.6);

      // Draw a neat table
      const tableTop = doc.y;
      doc.rect(48, tableTop, doc.page.width - 96, 20).fill('#E2E8F0');
      doc.fillColor('#0F172A');
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Dimension / Category', 56, tableTop + 6);
      doc.text('Standard Protocol', 200, tableTop + 6);
      doc.text('Performance Impact', 360, tableTop + 6);

      const rowData = [
        { dim: 'Static Baseline', proto: 'Calibrated Reference State', impact: 'Establishes baseline parity' },
        { dim: 'Dynamic Feedback', proto: 'Continuous Feedback Loops', impact: 'Mitigates divergence & drift' },
        { dim: 'Optimization Vector', proto: 'Iterative Convergence Steps', impact: 'Maximizes system efficiency' },
        { dim: 'Safety & Redundancy', proto: 'Fail-Safe Isolation Bounds', impact: 'Guarantees structural safety' },
      ];

      let currY = tableTop + 20;
      rowData.forEach((row, rIdx) => {
        doc.rect(48, currY, doc.page.width - 96, 20).fillAndStroke(rIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC', '#E2E8F0');
        doc.fillColor('#1E293B');
        doc.fontSize(8.5).font('Helvetica-Bold').text(row.dim, 56, currY + 6);
        doc.font('Helvetica').text(row.proto, 200, currY + 6);
        doc.text(row.impact, 360, currY + 6);
        currY += 20;
      });

      doc.y = currY + 15;
      doc.moveDown();

      doc.fillColor('#0F172A');
      doc.fontSize(12).font('Helvetica-Bold').text('2.2 Mathematical & Logical Synthesis');
      doc.moveDown(0.5);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        'The relationship between system efficiency (E) and operational entropy (S) is modeled through exponential decay coefficients under bounded boundary constraints:',
        { lineGap: 3 }
      );
      doc.moveDown(0.8);

      // Formula block
      doc.rect(80, doc.y, doc.page.width - 160, 36).fillAndStroke('#FEF3C7', '#FDE68A');
      doc.fillColor('#92400E');
      doc.fontSize(11).font('Helvetica-Bold').text('$$\\Psi(t) = \\alpha \\cdot e^{-\\lambda t} + \\int_0^t \\Phi(\\tau) d\\tau$$', 80, doc.y - 28, { align: 'center' });
      doc.y += 24;
      doc.moveDown(1.2);

      doc.fillColor('#334155');
      doc.fontSize(9.5).font('Helvetica').text(
        'Here, lambda represents the systemic decay constant, while Phi(tau) encapsulates internal regenerative mechanisms across temporal cycles.',
        { lineGap: 3, align: 'justify' }
      );

      // ==========================================
      // PAGE 4: CHAPTER 3 - PRACTICAL APPLICATIONS
      // ==========================================
      doc.addPage();
      doc.fillColor('#0284C7');
      doc.fontSize(10).font('Helvetica-Bold').text('CHAPTER 3', { characterSpacing: 1.5 });
      doc.moveDown(0.2);
      doc.fillColor('#0F172A');
      doc.fontSize(18).font('Helvetica-Bold').text('Practical Applications & Case Studies');
      doc.moveDown(0.8);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        `Translating theoretical constructs into impactful solutions requires understanding the practical contexts in which ${title} is applied across modern industry and education.`,
        { lineGap: 4, align: 'justify' }
      );
      doc.moveDown();

      doc.fillColor('#0F172A');
      doc.fontSize(12).font('Helvetica-Bold').text('Case Study: Sustainable Regional Implementation');
      doc.moveDown(0.5);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        'In a prominent regional pilot project across East Africa, researchers deployed standardized CBC learning frameworks to evaluate knowledge retention among junior and senior students. Over a 12-month observation window, cohorts utilizing interactive synthesis exhibited a 34% increase in conceptual retention compared to traditional passive reading groups.',
        { lineGap: 4, align: 'justify' }
      );
      doc.moveDown(1.2);

      // AI Tutor integration highlight
      doc.rect(48, doc.y, doc.page.width - 96, 75).fillAndStroke('#EFF6FF', '#BFDBFE');
      const aiY = doc.y + 12;
      doc.fillColor('#1D4ED8');
      doc.fontSize(10).font('Helvetica-Bold').text('SAGE AI TUTOR INTERACTIVE PROMPT', 60, aiY);
      doc.fillColor('#1E40AF');
      doc.fontSize(9.5).font('Helvetica-Oblique').text(
        '"You can highlight any sentence or formula on this page, click Note or Sage AI Assistant in your reading menu, and ask Sage to provide an interactive real-world demonstration or step-by-step calculation!"',
        60,
        aiY + 16,
        { width: doc.page.width - 120, lineGap: 2 }
      );

      doc.y = aiY + 68;
      doc.moveDown(1.2);

      doc.fillColor('#0F172A');
      doc.fontSize(12).font('Helvetica-Bold').text('3.2 Best Practices for Research & Notes');
      doc.moveDown(0.5);

      const practices = [
        'Maintain a structured reading journal summarizing core definitions at the end of each session.',
        'Use the bookmark tool to flag complex diagrams and quantitative proofs for revision.',
        'Engage in peer discussion to test your ability to explain complex mechanisms in simple terms.',
      ];

      practices.forEach((p, idx) => {
        doc.fillColor('#334155');
        doc.fontSize(9.5).font('Helvetica').text(`${idx + 1}.  ${p}`, 60, doc.y, { lineGap: 3 });
        doc.moveDown(0.4);
      });

      // ==========================================
      // PAGE 5: CHAPTER 4 - SELF-ASSESSMENT & QUESTIONS
      // ==========================================
      doc.addPage();
      doc.fillColor('#0284C7');
      doc.fontSize(10).font('Helvetica-Bold').text('CHAPTER 4', { characterSpacing: 1.5 });
      doc.moveDown(0.2);
      doc.fillColor('#0F172A');
      doc.fontSize(18).font('Helvetica-Bold').text('Formative Assessment & Review Questions');
      doc.moveDown(0.8);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        'Test your understanding with these syllabus-aligned conceptual and analytical questions. Write out your responses or discuss them with Sage AI:',
        { lineGap: 3 }
      );
      doc.moveDown(1);

      const questions = [
        {
          q: '1. Conceptual Analysis:',
          text: `Explain how the foundational laws outlined in Chapter 1 differentiate this topic from adjacent disciplines. What assumptions are necessary for the model to hold?`,
        },
        {
          q: '2. Methodological Application:',
          text: `Using the comparative framework from Chapter 2, evaluate which optimization vector produces the highest stability in practical deployments.`,
        },
        {
          q: '3. Quantitative Proof:',
          text: 'Demonstrate mathematically why systemic entropy decay approaches a steady state when external inputs remain invariant over time.',
        },
        {
          q: '4. Critical Synthesis:',
          text: `How would you adapt the methodology of ${title} to solve an emerging contemporary challenge in your local community or industry?`,
        },
      ];

      questions.forEach((item) => {
        doc.fillColor('#0F172A');
        doc.fontSize(10).font('Helvetica-Bold').text(item.q, 60, doc.y);
        doc.moveDown(0.2);
        doc.fillColor('#334155');
        doc.fontSize(9.5).font('Helvetica').text(item.text, 72, doc.y, { lineGap: 3, width: doc.page.width - 132 });
        doc.moveDown(0.8);
      });

      doc.moveDown(1.5);
      doc.rect(48, doc.y, doc.page.width - 96, 40).fillAndStroke('#F1F5F9', '#CBD5E1');
      const endY = doc.y + 12;
      doc.fillColor('#475569');
      doc.fontSize(9).font('Helvetica-Bold').text('Edu AI Study Module Completed', doc.page.width / 2, endY, { align: 'center' });
      doc.font('Helvetica-Oblique').text('All notes, highlights, and bookmarks are automatically saved to your profile.', doc.page.width / 2, endY + 14, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function getMimeType(filename: string, defaultType = 'application/octet-stream'): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    case '.epub':
      return 'application/epub+zip';
    case '.opf':
      return 'application/oebps-package+xml';
    case '.ncx':
      return 'application/x-dtbncx+xml';
    case '.xhtml':
      return 'application/xhtml+xml';
    case '.txt':
      return 'text/plain';
    case '.json':
      return 'application/json';
    default:
      return defaultType;
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "5mb" }));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    cloudConnected: {
      supabase: Boolean(getServerSupabase()),
      b2: Boolean(getS3Client() && B2_BUCKET_NAME),
    },
  });
});

// Public runtime Supabase config (strictly public URL + public anon/publishable key only — never secret/service-role keys)
app.get("/api/public-config", (_req, res) => {
  const supabaseUrl = getResolvedSupabaseUrlEnv();
  const supabaseAnonKey = getPublicSupabaseAnonKeyEnv();
  const serverAuthReady = Boolean(getServerSupabase());
  res.setHeader("Cache-Control", "no-store");
  res.json({
    supabaseUrl,
    supabaseAnonKey,
    serverAuthReady,
  });
});

// Verify OAuth / Supabase access_token and return session + user profile
app.post("/api/auth/session", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }
  const accessToken = typeof req.body?.access_token === "string" ? req.body.access_token.trim() : "";
  const refreshToken = typeof req.body?.refresh_token === "string" ? req.body.refresh_token.trim() : "";
  if (!accessToken) {
    return res.status(401).json({ error: "Missing access token." });
  }
  try {
    const { data: userData, error: userErr } = await sb.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid or expired session." });
    }
    const authedSb = getServerSupabase(accessToken) || sb;
    const profile = await ensureCanonicalUserProfile(userData.user, authedSb);
    await syncUserProfileToStoreAndSupabase(userData.user, getServerSupabase() || authedSb, profile ? {
      name: profile.full_name,
      role: normalizeRole(profile.role, profile.email),
      title: profile.title,
      institution: profile.institution,
      subjects: parseSubjectsList(profile.subjects),
      bio: profile.bio,
      location: profile.location || profile.country,
      avatar: profile.avatar_url,
    } : undefined).catch(() => {});

    return res.json({
      session: {
        access_token: accessToken,
        refresh_token: refreshToken || null,
        user: userData.user,
      },
      profile,
    });
  } catch (err) {
    console.error("[Auth] /api/auth/session verification failed:", err);
    return res.status(500).json({ error: "Could not verify authentication session." });
  }
});

function sanitizeMetadataForJwt(meta: Record<string, any> | null | undefined): {
  cleaned: Record<string, any>;
  hadBloat: boolean;
  extractedAvatar: string;
} {
  const src = meta && typeof meta === "object" ? meta : {};
  const cleaned: Record<string, any> = {};
  let hadBloat = false;
  let extractedAvatar = "";

  for (const [k, v] of Object.entries(src)) {
    if (
      (k === "avatar_url" || k === "profile_photo_key" || k === "picture") &&
      typeof v === "string"
    ) {
      const trimmed = v.trim();
      if (trimmed.startsWith("data:") || trimmed.length > 512) {
        hadBloat = true;
        if (!extractedAvatar && trimmed.startsWith("data:image/")) {
          extractedAvatar = trimmed;
        }
        continue;
      }
    }
    if (typeof v === "string" && v.length > 2048) {
      hadBloat = true;
      continue;
    }
    cleaned[k] = v;
  }
  return { cleaned, hadBloat, extractedAvatar };
}

async function scrubBloatedUserMetadata(user: any, sb?: SupabaseClient | null): Promise<boolean> {
  if (!user?.id) return false;
  const adminSb = getServerSupabase() || sb;
  if (!adminSb?.auth?.admin?.updateUserById) return false;
  const { cleaned, hadBloat, extractedAvatar } = sanitizeMetadataForJwt(user.user_metadata);
  if (!hadBloat) return false;

  try {
    if (extractedAvatar) {
      try {
        await adminSb
          .from("profiles")
          .upsert(
            {
              id: user.id,
              email: user.email || null,
              avatar_url: extractedAvatar,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );
      } catch {
        // Non-fatal: continue scrubbing user_metadata even if profiles upsert fails
      }
    }
    await adminSb.auth.admin.updateUserById(user.id, { user_metadata: cleaned });
    user.user_metadata = cleaned;
    return true;
  } catch (err) {
    console.warn("[Auth] scrubBloatedUserMetadata warning:", err);
    return false;
  }
}

function extractRequestAuthTokens(req: express.Request): { token: string; refreshToken: string; fromBody: boolean } {
  const authHeader = req.headers.authorization || "";
  const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const bodyToken =
    typeof req.body?.access_token === "string"
      ? req.body.access_token.trim()
      : typeof req.body?._accessToken === "string"
      ? req.body._accessToken.trim()
      : "";

  const headerRefresh = typeof req.headers["x-refresh-token"] === "string" ? req.headers["x-refresh-token"].trim() : "";
  const bodyRefresh =
    typeof req.body?.refresh_token === "string"
      ? req.body.refresh_token.trim()
      : typeof req.body?._refreshToken === "string"
      ? req.body._refreshToken.trim()
      : "";

  const token = (headerToken || bodyToken).replace(/[\r\n]+/g, "").trim();
  const refreshToken = (headerRefresh || bodyRefresh).replace(/[\r\n]+/g, "").trim();
  return {
    token,
    refreshToken,
    fromBody: !headerToken && Boolean(bodyToken),
  };
}

// Validate active Bearer JWT (or POST body token fallback) and optionally refresh via refreshToken
async function handleAuthUserRequest(req: express.Request, res: express.Response) {
  const { token, refreshToken } = extractRequestAuthTokens(req);

  const sb = getServerSupabase(token);
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    let activeUser: any = null;
    let activeAccessToken = token;
    let refreshedSession: any = null;

    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (!userErr && userData?.user) {
      activeUser = userData.user;
    } else if (refreshToken) {
      const refreshed = await refreshSupabaseSessionDeduped(refreshToken);
      if (refreshed?.user) {
        activeUser = refreshed.user;
        activeAccessToken = refreshed.access_token;
        refreshedSession = {
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          user: refreshed.user,
        };
      }
    }

    if (!activeUser) {
      return res.status(401).json({ error: "Session expired or invalid." });
    }

    // If caller sent an oversized bloated JWT (>3500 chars), strip base64 bloat from user_metadata & mint a compact token
    if (token.length > 3500) {
      const scrubbed = await scrubBloatedUserMetadata(activeUser, getServerSupabase());
      if (scrubbed && refreshToken) {
        const refreshed = await refreshSupabaseSessionDeduped(refreshToken);
        if (refreshed?.user?.id && refreshed?.access_token && refreshed.access_token.length < token.length) {
          activeUser = refreshed.user;
          activeAccessToken = refreshed.access_token;
          refreshedSession = {
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            user: refreshed.user,
          };
        }
      }
    }

    const authedSb = getServerSupabase(activeAccessToken) || sb;
    const profile = await ensureCanonicalUserProfile(activeUser, authedSb);

    return res.json({
      user: activeUser,
      profile,
      refreshedSession,
    });
  } catch (err) {
    console.error("[Auth] /api/auth/user failed:", err);
    return res.status(401).json({ error: "Session verification failed." });
  }
}

app.get("/api/auth/user", handleAuthUserRequest);
app.post("/api/auth/user", handleAuthUserRequest);

// Server-proxied Email Sign-In fallback when browser anon key env var is not yet injected
app.post("/api/auth/signin", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data?.session) {
      return res.status(401).json({ error: error?.message || "Invalid email or password." });
    }

    let finalSession = data.session;
    let finalUser = data.user;
    if (finalUser?.id && String(finalSession.access_token || "").length > 3500) {
      const scrubbed = await scrubBloatedUserMetadata(finalUser, sb);
      if (scrubbed && finalSession.refresh_token) {
        const refreshed = await refreshSupabaseSessionDeduped(finalSession.refresh_token);
        if (refreshed?.access_token && refreshed?.user) {
          finalSession = refreshed;
          finalUser = refreshed.user;
        }
      }
    }

    const profSb = getServerSupabase(finalSession.access_token) || sb;
    const profile = finalUser?.id ? await ensureCanonicalUserProfile(finalUser, profSb) : null;
    if (finalUser?.id) {
      await syncUserProfileToStoreAndSupabase(finalUser, getServerSupabase() || profSb, profile ? {
        name: profile.full_name,
        role: normalizeRole(profile.role, profile.email),
        title: profile.title,
        institution: profile.institution,
        subjects: parseSubjectsList(profile.subjects),
        bio: profile.bio,
        location: profile.location || profile.country,
        avatar: profile.avatar_url,
      } : undefined).catch(() => {});
    }

    return res.json({
      session: {
        access_token: finalSession.access_token,
        refresh_token: finalSession.refresh_token,
        user: finalUser,
      },
      profile,
    });
  } catch (err) {
    console.error("[Auth] /api/auth/signin error:", err);
    return res.status(500).json({ error: "Sign-in failed. Please try again." });
  }
});

// Server-proxied Email Sign-Up fallback
app.post("/api/auth/signup", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const metadata = req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};
  const emailRedirectTo = typeof req.body?.emailRedirectTo === "string" ? req.body.emailRedirectTo : undefined;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: metadata,
      },
    });
    if (error) {
      return res.status(400).json({ error: error.message || "Could not create account." });
    }

    let profile: any = null;
    if (data.user?.id) {
      const profSb = data.session?.access_token ? getServerSupabase(data.session.access_token) || sb : sb;
      profile = await ensureCanonicalUserProfile(data.user, profSb, {
        extraPatch: { ...metadata, email },
      });
      await syncUserProfileToStoreAndSupabase(data.user, getServerSupabase() || profSb, profile ? {
        name: profile.full_name,
        role: normalizeRole(profile.role, profile.email),
        title: profile.title,
        institution: profile.institution,
        subjects: parseSubjectsList(profile.subjects),
        bio: profile.bio,
        location: profile.location || profile.country,
        avatar: profile.avatar_url,
      } : undefined).catch(() => {});
      broadcastAllConnectedUsers({
        type: "social:directory-updated",
        userId: data.user.id,
        updatedAt: new Date().toISOString(),
      });
    }

    return res.json({
      session: data.session
        ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            user: data.user,
          }
        : null,
      user: data.user || null,
      profile,
    });
  } catch (err) {
    console.error("[Auth] /api/auth/signup error:", err);
    return res.status(500).json({ error: "Sign-up failed. Please try again." });
  }
});

// Server-proxied Phone OTP Send & Verify fallbacks
app.post("/api/auth/otp-send", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  if (!phone) {
    return res.status(400).json({ error: "Phone number is required." });
  }
  try {
    const { error } = await sb.auth.signInWithOtp({ phone });
    if (error) {
      return res.status(400).json({ error: error.message || "Could not send verification code." });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Auth] /api/auth/otp-send error:", err);
    return res.status(500).json({ error: "Could not send verification code." });
  }
});

app.post("/api/auth/otp-verify", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  if (!phone || !token) {
    return res.status(400).json({ error: "Phone number and code are required." });
  }
  try {
    const { data, error } = await sb.auth.verifyOtp({ phone, token, type: "sms" });
    if (error || !data?.session) {
      return res.status(401).json({ error: error?.message || "Invalid verification code." });
    }
    const profSb = getServerSupabase(data.session.access_token) || sb;
    const profile = data.user?.id ? await ensureCanonicalUserProfile(data.user, profSb) : null;
    if (data.user?.id) {
      await syncUserProfileToStoreAndSupabase(data.user, getServerSupabase() || profSb, profile ? {
        name: profile.full_name,
        role: normalizeRole(profile.role, profile.email),
        title: profile.title,
        institution: profile.institution,
        subjects: parseSubjectsList(profile.subjects),
        bio: profile.bio,
        location: profile.location || profile.country,
        avatar: profile.avatar_url,
      } : undefined).catch(() => {});
    }
    return res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: data.user,
      },
      profile,
    });
  } catch (err) {
    console.error("[Auth] /api/auth/otp-verify error:", err);
    return res.status(500).json({ error: "OTP verification failed." });
  }
});

// Save or update user's academic preferences & profile details — strictly verifies caller Bearer JWT
app.post("/api/auth/preferences", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sb = getServerSupabase(token);
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }

  try {
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const body = req.body || {};

    const profilePatch: Record<string, any> = {
      id: userId,
      email: userData.user.email || undefined,
      updated_at: new Date().toISOString(),
    };

    if (typeof body.country === "string") {
      profilePatch.country = body.country.trim() || null;
      profilePatch.location = body.country.trim() || null;
    }
    if (typeof body.location === "string" && body.location.trim()) {
      profilePatch.location = body.location.trim();
    }
    if (typeof body.education_level === "string") {
      profilePatch.education_level = body.education_level.trim() || null;
    }
    if (typeof body.curriculum === "string") {
      profilePatch.curriculum = body.curriculum.trim() || null;
    }
    if (typeof body.field_of_study === "string") {
      profilePatch.field_of_study = body.field_of_study.trim() || null;
    }
    if (body.subjects !== undefined) {
      const subjects = Array.isArray(body.subjects)
        ? body.subjects.map((s: any) => String(s).trim()).filter(Boolean).join(", ")
        : typeof body.subjects === "string"
          ? body.subjects.trim()
          : "";
      profilePatch.subjects = subjects || null;
    }
    if (typeof body.full_name === "string" && body.full_name.trim()) {
      profilePatch.full_name = body.full_name.trim();
    }
    if (body.avatar_url !== undefined) {
      profilePatch.avatar_url = typeof body.avatar_url === "string" ? body.avatar_url.trim() || null : null;
    }
    if (typeof body.bio === "string") {
      profilePatch.bio = body.bio.trim() || null;
    }
    if (typeof body.institution === "string") {
      profilePatch.institution = body.institution.trim() || null;
    }
    if (typeof body.title === "string") {
      profilePatch.title = body.title.trim() || null;
    }
    if (typeof body.role === "string" && body.role.trim()) {
      profilePatch.role = body.role.trim();
    }

    const updatedProfile = await ensureCanonicalUserProfile(userData.user, sb, {
      extraPatch: profilePatch,
    });

    // Opportunistically sync compact auth user_metadata (never store large data:image URLs inside JWT claims)
    try {
      const metaPatch: Record<string, any> = { ...(userData.user.user_metadata || {}) };
      for (const k of ["country", "education_level", "curriculum", "field_of_study", "subjects", "full_name", "avatar_url", "bio", "institution", "role"]) {
        if (profilePatch[k] !== undefined) {
          if (k === "avatar_url" && typeof profilePatch[k] === "string" && (profilePatch[k].startsWith("data:") || profilePatch[k].length > 512)) {
            continue;
          }
          metaPatch[k] = profilePatch[k];
        }
      }
      const { cleaned } = sanitizeMetadataForJwt(metaPatch);
      const adminSb = getServerSupabase();
      if (adminSb?.auth?.admin?.updateUserById) {
        await adminSb.auth.admin.updateUserById(userId, { user_metadata: cleaned });
      }
    } catch (_) {}

    await syncUserProfileToStoreAndSupabase(userData.user, getServerSupabase() || sb, {
      name: updatedProfile?.full_name || profilePatch.full_name,
      role: updatedProfile?.role ? normalizeRole(updatedProfile.role, updatedProfile.email) : undefined,
      title: updatedProfile?.title || profilePatch.title,
      institution: updatedProfile?.institution || profilePatch.institution,
      subjects: parseSubjectsList(updatedProfile?.subjects ?? profilePatch.subjects),
      bio: updatedProfile?.bio || profilePatch.bio,
      location: updatedProfile?.location || updatedProfile?.country || profilePatch.location || profilePatch.country,
      avatar: updatedProfile?.avatar_url ?? profilePatch.avatar_url,
    }).catch(() => {});

    sendWsPayloadToUser(userId, {
      type: "account:sync-updated",
      userId,
      updatedAt: new Date().toISOString(),
    });
    broadcastAllConnectedUsers({
      type: "social:directory-updated",
      userId,
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      profile: updatedProfile || profilePatch,
    });
  } catch (err) {
    console.error("[Auth] /api/auth/preferences error:", err);
    return res.status(500).json({ error: "Could not save profile preferences." });
  }
});

// Persistent avatar upload endpoint (stores in Supabase Storage avatars bucket + disk/B2 + profiles + sync)
app.post("/api/profile/avatar", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const sb = getServerSupabase(token);
  const adminSb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }

  try {
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = userData.user.id;
    const rawDataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl.trim() : "";
    const rawFilename = typeof req.body?.filename === "string" ? req.body.filename : "avatar.jpg";
    if (!rawDataUrl || !rawDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Valid image dataUrl is required." });
    }

    const match = rawDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: "Invalid base64 image payload." });
    }
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], "base64");
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const safeName = rawFilename.replace(/[^a-zA-Z0-9.\-_]/g, "_") || `avatar.${ext}`;
    const storageKey = `avatars/${userId}/${Date.now()}-${safeName.replace(/\.[^.]+$/, "")}.${ext}`;

    // 1. Save to local persistent disk
    try {
      const localPath = path.join(UPLOADS_DIR, storageKey);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, buffer);
    } catch (_) {}

    // 2. Upload to Supabase Storage ('avatars' bucket)
    let publicStorageUrl: string | null = null;
    const storageSb = adminSb || sb;
    try {
      if (adminSb?.storage?.createBucket) {
        await adminSb.storage.createBucket("avatars", { public: true }).catch(() => {});
      }
      const { error: upErr } = await storageSb.storage
        .from("avatars")
        .upload(storageKey, buffer, { contentType: mimeType, upsert: true });
      if (!upErr) {
        const { data: pub } = storageSb.storage.from("avatars").getPublicUrl(storageKey);
        if (pub?.publicUrl) {
          // Verify the public URL is actually readable before trusting it directly
          try {
            const probe = await fetch(pub.publicUrl, { method: "HEAD" });
            if (probe.ok) {
              publicStorageUrl = pub.publicUrl;
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    // Prefer verified public Storage URL or compact /api/download URL so JWT user_metadata never bloats; keep data URL fallback for DB/sync
    const compactLocalAvatarUrl = `/api/download?key=${encodeURIComponent(storageKey)}&inline=true`;
    const canonicalAvatarUrl = publicStorageUrl || compactLocalAvatarUrl || rawDataUrl;
    const jwtSafeAvatarUrl = publicStorageUrl || compactLocalAvatarUrl;

    const updatedProfile = await ensureCanonicalUserProfile(userData.user, sb, {
      extraPatch: { avatar_url: canonicalAvatarUrl },
    });

    try {
      if (adminSb?.auth?.admin?.updateUserById) {
        const { cleaned } = sanitizeMetadataForJwt({
          ...(userData.user.user_metadata || {}),
          avatar_url: jwtSafeAvatarUrl,
        });
        await adminSb.auth.admin.updateUserById(userId, {
          user_metadata: cleaned,
        });
      }
    } catch (_) {}

    await syncUserProfileToStoreAndSupabase(userData.user, adminSb || sb, {
      avatar: canonicalAvatarUrl,
    }).catch(() => {});

    sendWsPayloadToUser(userId, {
      type: "account:sync-updated",
      userId,
      updatedAt: new Date().toISOString(),
    });
    broadcastAllConnectedUsers({
      type: "social:directory-updated",
      userId,
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      avatarUrl: canonicalAvatarUrl,
      storageKey,
      profile: updatedProfile,
    });
  } catch (err: any) {
    console.error("[Avatar] POST /api/profile/avatar error:", err);
    return res.status(500).json({ error: err.message || "Failed to save profile photo" });
  }
});

// Unified cross-device account synchronization endpoints (JWT-verified)
app.get("/api/account/sync", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const sb = getServerSupabase(token);
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }

  try {
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const {
      state: syncState,
      wfRowCount,
      wfDigest,
      mergedDigest,
    } = await readServerUserSyncWithMeta(userId, sb);

    if (hasMeaningfulSyncState(syncState) && (wfRowCount === 0 || wfRowCount > 1 || wfDigest !== mergedDigest)) {
      await mirrorStateToWorkspaceFiles(userId, syncState, sb);
    }

    const profile = await ensureCanonicalUserProfile(userData.user, sb, { existingSync: syncState });
    const enrichedSync = profile
      ? {
          ...syncState,
          profileSnapshot: {
            ...(syncState?.profileSnapshot || {}),
            ...profile,
          },
        }
      : syncState;

    return res.json({
      ok: true,
      sync: enrichedSync,
      profile,
    });
  } catch (err) {
    console.error("[AccountSync] GET /api/account/sync error:", err);
    return res.status(500).json({ error: "Failed to load account sync state." });
  }
});

app.put("/api/account/sync", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const sb = getServerSupabase(token);
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }

  try {
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const nextState = await writeServerUserSync(userId, body, sb);

    if (body.bookCoverOverrides && typeof body.bookCoverOverrides === "object") {
      const updatedCovers = await persistGlobalBookCoversBatch(body.bookCoverOverrides, sb);
      broadcastAllConnectedUsers({
        type: "system:covers-updated",
        covers: updatedCovers,
        updatedAt: new Date().toISOString(),
      });
    }

    if (body.profileSnapshot && typeof body.profileSnapshot === "object") {
      try {
        await ensureCanonicalUserProfile(userData.user, sb, {
          extraPatch: body.profileSnapshot,
          existingSync: nextState,
        });
      } catch (_) {}
    }

    sendWsPayloadToUser(userId, {
      type: "account:sync-updated",
      userId,
      updatedAt: nextState.updatedAt || new Date().toISOString(),
    });

    return res.json({ ok: true, sync: nextState });
  } catch (err) {
    console.error("[AccountSync] PUT /api/account/sync error:", err);
    return res.status(500).json({ error: "Failed to save account sync state." });
  }
});

// Revoke caller's active Supabase session server-side on Sign Out (strictly verifies Bearer JWT)
app.post("/api/auth/signout", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      if (sb.auth?.admin?.signOut) {
        await sb.auth.admin.signOut(token);
      }
    } catch (revokeErr) {
      console.warn("[Auth] Admin token signOut notice:", revokeErr);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Auth] /api/auth/signout error:", err);
    return res.status(500).json({ error: "Could not complete sign out." });
  }
});

// ============================================================================
// REAL-TIME SOCIAL CHAT, DIRECTORY, FRIEND REQUESTS & COMMUNITY API
// ============================================================================
const socialSocketsByUser = new Map<string, Set<WebSocket>>();

function getOnlineUserIdSet(): Set<string> {
  const active = new Set<string>();
  for (const [uid, sockets] of socialSocketsByUser.entries()) {
    for (const sock of sockets) {
      if (sock.readyState === WebSocket.OPEN) {
        active.add(uid);
        break;
      }
    }
  }
  return active;
}

function sendWsPayloadToUser(userId: string, payload: Record<string, any>): void {
  const sockets = socialSocketsByUser.get(userId);
  if (!sockets || sockets.size === 0) return;
  const serialized = JSON.stringify(payload);
  for (const sock of sockets) {
    if (sock.readyState === WebSocket.OPEN) {
      try {
        sock.send(serialized);
      } catch (_) {}
    }
  }
}

function broadcastSocialEventToUsers(userIds: string[], payload: Record<string, any>, excludeUserId?: string): void {
  const unique = new Set(userIds);
  for (const uid of unique) {
    if (excludeUserId && uid === excludeUserId) continue;
    sendWsPayloadToUser(uid, payload);
  }
}

function broadcastPresenceUpdate(): void {
  const onlineUserIds = Array.from(getOnlineUserIdSet());
  const serialized = JSON.stringify({ type: "presence:update", onlineUserIds });
  for (const sockets of socialSocketsByUser.values()) {
    for (const sock of sockets) {
      if (sock.readyState === WebSocket.OPEN) {
        try {
          sock.send(serialized);
        } catch (_) {}
      }
    }
  }
}

function broadcastAllConnectedUsers(payload: Record<string, any>, excludeUserId?: string): void {
  const serialized = JSON.stringify(payload);
  for (const [uid, sockets] of socialSocketsByUser.entries()) {
    if (excludeUserId && uid === excludeUserId) continue;
    for (const sock of sockets) {
      if (sock.readyState === WebSocket.OPEN) {
        try {
          sock.send(serialized);
        } catch (_) {}
      }
    }
  }
}

const inFlightSupabaseRefreshes = new Map<string, Promise<any>>();
const recentSupabaseRefreshes = new Map<string, { session: any; expiresAt: number }>();

async function refreshSupabaseSessionDeduped(refreshToken: string): Promise<any | null> {
  const clean = String(refreshToken || "").trim();
  if (!clean) return null;

  const cached = recentSupabaseRefreshes.get(clean);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.session;
  }

  const existingPromise = inFlightSupabaseRefreshes.get(clean);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    const authSb = getServerSupabase();
    if (!authSb) return null;
    try {
      const { data: refreshData, error: refreshErr } = await authSb.auth.refreshSession({
        refresh_token: clean,
      });
      if (!refreshErr && refreshData?.session?.user?.id && refreshData?.session?.access_token) {
        const sess = refreshData.session;
        const expiresAt = Date.now() + 60_000;
        recentSupabaseRefreshes.set(clean, { session: sess, expiresAt });
        if (recentSupabaseRefreshes.size > 200) {
          const now = Date.now();
          for (const [k, v] of recentSupabaseRefreshes.entries()) {
            if (v.expiresAt <= now) recentSupabaseRefreshes.delete(k);
          }
        }
        return sess;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlightSupabaseRefreshes.delete(clean);
    }
  })();

  inFlightSupabaseRefreshes.set(clean, promise);
  return promise;
}

async function verifySocialToken(token: string): Promise<{ user: any; sb: SupabaseClient } | null> {
  if (!token || token === "demo_token" || token === "local_token") return null;
  const sb = getServerSupabase(token);
  if (!sb) return null;
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return { user: data.user, sb: getServerSupabase() || sb };
  } catch {
    return null;
  }
}

async function requireSocialAuth(req: express.Request, res: express.Response) {
  const { token, refreshToken } = extractRequestAuthTokens(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  let authResult: { user: any; sb: SupabaseClient; refreshedSession?: any } | null = null;
  const verified = await verifySocialToken(token);
  if (verified) {
    authResult = verified;
  } else if (refreshToken) {
    const refreshed = await refreshSupabaseSessionDeduped(refreshToken);
    const authSb = getServerSupabase();
    if (refreshed?.user?.id && authSb) {
      res.setHeader("x-refreshed-access-token", refreshed.access_token);
      if (refreshed.refresh_token) {
        res.setHeader("x-refreshed-refresh-token", refreshed.refresh_token);
      }
      authResult = {
        user: refreshed.user,
        sb: authSb,
        refreshedSession: {
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          user: refreshed.user,
        },
      };
    }
  }

  if (!authResult) {
    res.status(401).json({ error: "Session expired or invalid. Please sign in again." });
    return null;
  }

  // If the caller still holds an oversized JWT (>3500 chars), strip base64 bloat & mint a compact token
  if (token.length > 3500 && authResult.user?.id) {
    const scrubbed = await scrubBloatedUserMetadata(authResult.user, getServerSupabase() || authResult.sb);
    if (scrubbed && refreshToken && !authResult.refreshedSession) {
      const refreshed = await refreshSupabaseSessionDeduped(refreshToken);
      if (refreshed?.user?.id && refreshed?.access_token && refreshed.access_token.length < token.length) {
        res.setHeader("x-refreshed-access-token", refreshed.access_token);
        if (refreshed.refresh_token) {
          res.setHeader("x-refreshed-refresh-token", refreshed.refresh_token);
        }
        authResult.user = refreshed.user;
        authResult.refreshedSession = {
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          user: refreshed.user,
        };
      }
    }
  }

  return authResult;
}

async function handleSocialBootstrap(req: express.Request, res: express.Response) {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const privSb = getServerSupabase() || auth.sb;
    registerSocialSupabaseClient(privSb);
    await syncUserProfileToStoreAndSupabase(auth.user, privSb);
    await hydrateDirectoryFromSupabase(privSb);
    await hydrateFriendRequestsFromSupabase(auth.user.id, privSb);
    const data = getBootstrapDataForUser(auth.user.id, getOnlineUserIdSet());
    return res.json({
      ok: true,
      ...data,
      ...(auth.refreshedSession ? { _refreshedSession: auth.refreshedSession } : {}),
    });
  } catch (err) {
    console.error("[Social] /api/social/bootstrap error:", err);
    return res.status(500).json({ error: "Failed to load social workspace." });
  }
}

app.get("/api/social/bootstrap", handleSocialBootstrap);
app.post("/api/social/bootstrap", handleSocialBootstrap);

async function handleSocialUsersSearch(req: express.Request, res: express.Response) {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const privSb = getServerSupabase() || auth.sb;
    await syncUserProfileToStoreAndSupabase(auth.user, privSb);
    await hydrateDirectoryFromSupabase(privSb);
    await hydrateFriendRequestsFromSupabase(auth.user.id, privSb);
    const bootstrap = getBootstrapDataForUser(auth.user.id, getOnlineUserIdSet());

    const rawQ = req.method === "POST" ? req.body?.q ?? req.query.q : req.query.q;
    const rawRole = req.method === "POST" ? req.body?.role ?? req.query.role : req.query.role;
    const q = String(rawQ || "").trim().toLowerCase();
    const roleFilter = String(rawRole || "all").trim().toLowerCase();

    const filtered = bootstrap.users.filter((u: any) => {
      if (u.id === auth.user.id) return false;
      if (roleFilter === "teacher" && u.role !== "teacher" && u.role !== "educator") return false;
      if (roleFilter === "student" && u.role !== "student") return false;
      if (roleFilter === "friends" && u.friendStatus !== "friends") return false;
      if (roleFilter === "pending" && u.friendStatus !== "pending_received" && u.friendStatus !== "pending_sent") return false;
      if (q && !matchesDirectorySearchQuery(u, q)) return false;
      return true;
    });

    return res.json({
      ok: true,
      users: filtered,
      currentUser: bootstrap.currentUser,
      ...(auth.refreshedSession ? { _refreshedSession: auth.refreshedSession } : {}),
    });
  } catch (err) {
    console.error("[Social] /api/social/users error:", err);
    return res.status(500).json({ error: "Failed to search user directory." });
  }
}

app.get("/api/social/users", handleSocialUsersSearch);
app.post("/api/social/users/search", handleSocialUsersSearch);

app.post("/api/social/profile", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const privSb = getServerSupabase() || auth.sb;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const updated = await syncUserProfileToStoreAndSupabase(auth.user, privSb, {
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined,
      role: body.role ? normalizeRole(body.role, auth.user.email) : undefined,
      title: typeof body.title === "string" ? body.title.trim() : undefined,
      institution: typeof body.institution === "string" ? body.institution.trim() : undefined,
      subjects: body.subjects !== undefined ? parseSubjectsList(body.subjects) : undefined,
      bio: typeof body.bio === "string" ? body.bio.trim() : undefined,
      location: typeof body.location === "string" ? body.location.trim() : undefined,
      avatar: typeof body.avatar === "string" && !body.avatar.includes("unsplash.com") ? body.avatar.trim() : undefined,
    });
    broadcastAllConnectedUsers({
      type: "social:directory-updated",
      userId: auth.user.id,
      updatedAt: new Date().toISOString(),
    });
    return res.json({ ok: true, profile: updated });
  } catch (err) {
    console.error("[Social] POST /api/social/profile error:", err);
    return res.status(500).json({ error: "Failed to update social profile." });
  }
});

app.post("/api/social/friend-requests", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const privSb = getServerSupabase() || auth.sb;
    await hydrateDirectoryFromSupabase(privSb);
    const senderProfile = await syncUserProfileToStoreAndSupabase(auth.user, privSb);
    const receiverId = typeof req.body?.receiverId === "string" ? req.body.receiverId.trim() : "";
    const note = typeof req.body?.note === "string" ? req.body.note : undefined;

    const result = await sendFriendRequestAction(auth.user.id, receiverId, note, privSb);
    if (!result.ok) {
      return res.status(400).json({ error: result.error || "Could not send friend request." });
    }

    if (result.status === "accepted") {
      broadcastSocialEventToUsers([auth.user.id, receiverId], {
        type: "friend:responded",
        action: "accept",
        request: result.request,
        conversation: result.conversation,
        actor: { id: senderProfile.id, name: senderProfile.name, role: senderProfile.role, avatar: senderProfile.avatar },
      });
      if (result.conversation) {
        broadcastSocialEventToUsers([auth.user.id, receiverId], {
          type: "chat:conversation",
          conversation: result.conversation,
        });
      }
    } else {
      const compactAvatar =
        typeof senderProfile.avatar === "string" && !senderProfile.avatar.startsWith("data:") && senderProfile.avatar.length < 2048
          ? senderProfile.avatar
          : "";
      sendWsPayloadToUser(receiverId, {
        type: "friend:request",
        request: result.request,
        sender: {
          id: senderProfile.id,
          name: senderProfile.name,
          role: senderProfile.role,
          title: senderProfile.title,
          institution: senderProfile.institution,
          avatar: compactAvatar,
        },
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("[Social] POST /api/social/friend-requests error:", err);
    return res.status(500).json({ error: "Could not process friend request." });
  }
});

app.post("/api/social/friend-requests/respond", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const privSb = getServerSupabase() || auth.sb;
    await hydrateDirectoryFromSupabase(privSb);
    await hydrateFriendRequestsFromSupabase(auth.user.id, privSb);
    const responderProfile = await syncUserProfileToStoreAndSupabase(auth.user, privSb);
    const senderId = typeof req.body?.senderId === "string" ? req.body.senderId.trim() : "";
    const action = req.body?.action === "decline" ? "decline" : "accept";
    if (!senderId) {
      return res.status(400).json({ error: "senderId is required." });
    }

    const result = await respondToFriendRequestAction(auth.user.id, senderId, action, privSb);
    if (!result.ok) {
      return res.status(404).json({ error: result.error || "Friend request not found." });
    }

    broadcastSocialEventToUsers([auth.user.id, senderId], {
      type: "friend:responded",
      action,
      request: result.request,
      conversation: result.conversation,
      actor: {
        id: responderProfile.id,
        name: responderProfile.name,
        role: responderProfile.role,
        avatar: responderProfile.avatar,
      },
    });

    if (action === "accept" && result.conversation) {
      broadcastSocialEventToUsers([auth.user.id, senderId], {
        type: "chat:conversation",
        conversation: result.conversation,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("[Social] POST /api/social/friend-requests/respond error:", err);
    return res.status(500).json({ error: "Could not respond to friend request." });
  }
});

app.delete("/api/social/friend-requests/:targetId", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const privSb = getServerSupabase() || auth.sb;
    const targetId = String(req.params.targetId || "").trim();
    if (!targetId) {
      return res.status(400).json({ error: "Target user ID is required." });
    }
    await removeFriendshipAction(auth.user.id, targetId, privSb);
    broadcastSocialEventToUsers([auth.user.id, targetId], {
      type: "friend:removed",
      actorId: auth.user.id,
      targetId,
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Social] DELETE /api/social/friend-requests error:", err);
    return res.status(500).json({ error: "Could not remove connection." });
  }
});

app.post("/api/social/conversations/direct", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const privSb = getServerSupabase() || auth.sb;
    registerSocialSupabaseClient(privSb);
    await syncUserProfileToStoreAndSupabase(auth.user, privSb);
    await hydrateDirectoryFromSupabase(privSb);
    await hydrateFriendRequestsFromSupabase(auth.user.id, privSb, { forceCloudRead: true });
    const partnerId = typeof req.body?.partnerId === "string" ? req.body.partnerId.trim() : "";
    const result = openOrCreateDirectConversation(auth.user.id, partnerId);
    if (!result.ok) {
      return res.status(400).json({ error: result.error || "Could not open direct chat." });
    }
    await persistSocialCloudState(privSb);
    sendWsPayloadToUser(partnerId, {
      type: "chat:conversation",
      conversation: result.conversation,
    });
    return res.json(result);
  } catch (err) {
    console.error("[Social] POST /api/social/conversations/direct error:", err);
    return res.status(500).json({ error: "Failed to open conversation." });
  }
});

app.post("/api/social/conversations/group", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const privSb = getServerSupabase() || auth.sb;
    registerSocialSupabaseClient(privSb);
    await syncUserProfileToStoreAndSupabase(auth.user, privSb);
    await hydrateDirectoryFromSupabase(privSb);
    await hydrateSocialCloudState(privSb, { force: true });
    const result = createGroupConversationAction(auth.user.id, {
      name: req.body?.name,
      description: req.body?.description,
      participantIds: Array.isArray(req.body?.participantIds) ? req.body.participantIds : [],
      groupRoleType: req.body?.groupRoleType,
      subjectTag: req.body?.subjectTag,
    });
    if (!result.ok || !result.conversation) {
      return res.status(400).json({ error: result.error || "Could not create study group." });
    }
    await persistSocialCloudState(privSb);
    broadcastSocialEventToUsers(result.conversation.participants || [], {
      type: "chat:conversation",
      conversation: result.conversation,
    });
    return res.json(result);
  } catch (err) {
    console.error("[Social] POST /api/social/conversations/group error:", err);
    return res.status(500).json({ error: "Failed to create study group." });
  }
});

app.post("/api/social/conversations/:id/members", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const privSb = getServerSupabase() || auth.sb;
    registerSocialSupabaseClient(privSb);
    await hydrateDirectoryFromSupabase(privSb);
    await hydrateSocialCloudState(privSb, { force: true });
    const convId = String(req.params.id || "").trim();
    const memberId = typeof req.body?.memberId === "string" ? req.body.memberId.trim() : "";
    const result = addGroupMemberAction(auth.user.id, convId, memberId);
    if (!result.ok || !result.conversation) {
      return res.status(400).json({ error: result.error || "Could not add member." });
    }
    await persistSocialCloudState(privSb);
    broadcastSocialEventToUsers(result.conversation.participants || [], {
      type: "chat:conversation",
      conversation: result.conversation,
    });
    return res.json(result);
  } catch (err) {
    console.error("[Social] POST /api/social/conversations/:id/members error:", err);
    return res.status(500).json({ error: "Failed to add group member." });
  }
});

app.get("/api/social/conversations/:id/messages", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const privSb = getServerSupabase() || auth.sb;
    registerSocialSupabaseClient(privSb);
    await hydrateSocialCloudState(privSb);
    const convId = String(req.params.id || "").trim();
    const result = getMessagesForConversation(convId, auth.user.id);
    if (!result.ok) {
      return res.status(403).json({ error: result.error || "Forbidden" });
    }
    return res.json(result);
  } catch (err) {
    console.error("[Social] GET /api/social/conversations/:id/messages error:", err);
    return res.status(500).json({ error: "Failed to load conversation messages." });
  }
});

app.post("/api/social/messages", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const privSb = getServerSupabase() || auth.sb;
    registerSocialSupabaseClient(privSb);
    await syncUserProfileToStoreAndSupabase(auth.user, privSb);
    await hydrateFriendRequestsFromSupabase(auth.user.id, privSb, { forceCloudRead: true });
    const result = sendChatMessageAction(
      auth.user.id,
      {
        conversationId: String(req.body?.conversationId || "").trim(),
        clientMessageId: typeof req.body?.clientMessageId === "string" ? req.body.clientMessageId : undefined,
        content: String(req.body?.content || ""),
        attachment: req.body?.attachment,
        replyTo: req.body?.replyTo,
      },
      getOnlineUserIdSet()
    );

    if (!result.ok || !result.message) {
      return res.status(400).json({ error: result.error || "Could not send message." });
    }

    await persistSocialCloudState(privSb);

    if (!result.deduplicated) {
      broadcastSocialEventToUsers(result.participants || [], {
        type: "chat:message",
        message: result.message,
      });
    }

    return res.json({ ok: true, message: result.message });
  } catch (err) {
    console.error("[Social] POST /api/social/messages error:", err);
    return res.status(500).json({ error: "Failed to send message." });
  }
});

app.post("/api/social/conversations/:id/read", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  const privSb = getServerSupabase() || auth.sb;
  registerSocialSupabaseClient(privSb);
  const convId = String(req.params.id || "").trim();
  const result = markConversationReadAction(auth.user.id, convId);
  if (!result.ok) {
    return res.status(403).json({ error: "Conversation access denied." });
  }
  if (result.updatedMessageIds.length > 0) {
    void persistSocialCloudState(privSb);
    broadcastSocialEventToUsers(result.participants, {
      type: "chat:read",
      conversationId: convId,
      readerId: auth.user.id,
      messageIds: result.updatedMessageIds,
      seenAt: result.seenAt,
    });
  }
  return res.json({ ok: true, ...result });
});

app.post("/api/social/messages/:id/react", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  const privSb = getServerSupabase() || auth.sb;
  registerSocialSupabaseClient(privSb);
  const msgId = String(req.params.id || "").trim();
  const emoji = String(req.body?.emoji || "").trim();
  const result = toggleMessageReactionAction(auth.user.id, msgId, emoji);
  if (!result.ok) {
    return res.status(400).json({ error: result.error || "Could not react to message." });
  }
  await persistSocialCloudState(privSb);
  broadcastSocialEventToUsers(result.participants || [], {
    type: "chat:reaction",
    conversationId: result.conversationId,
    messageId: result.messageId,
    reactions: result.reactions,
  });
  return res.json({ ok: true, reactions: result.reactions });
});

async function handleDeleteChatMessage(req: express.Request, res: express.Response) {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const privSb = getServerSupabase() || auth.sb;
    registerSocialSupabaseClient(privSb);
    const msgId = String(req.params.id || "").trim();
    if (!msgId) {
      return res.status(400).json({ error: "Message ID is required." });
    }
    const result = await deleteChatMessageAction(auth.user.id, msgId, privSb);
    if (!result.ok) {
      return res.status(result.statusCode || 400).json({ error: result.error || "Could not delete message." });
    }
    broadcastSocialEventToUsers(result.participants || [], {
      type: "chat:message-deleted",
      conversationId: result.conversationId,
      messageId: result.messageId,
      lastMessage: result.lastMessage || null,
      deletedAt: result.deletedAt,
    });
    return res.json({
      ok: true,
      conversationId: result.conversationId,
      messageId: result.messageId,
      lastMessage: result.lastMessage || null,
      deletedAt: result.deletedAt,
    });
  } catch (err) {
    console.error("[Social] deleteChatMessage error:", err);
    return res.status(500).json({ error: "Failed to delete message." });
  }
}

app.delete("/api/social/messages/:id", handleDeleteChatMessage);
app.post("/api/social/messages/:id/delete", handleDeleteChatMessage);

app.get("/api/social/community/posts", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  return res.json({ ok: true, posts: listCommunityPosts() });
});

app.post("/api/social/community/posts", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  await syncUserProfileToStoreAndSupabase(auth.user, auth.sb);
  const result = createCommunityPostAction(auth.user.id, {
    title: req.body?.title,
    content: req.body?.content,
    tags: req.body?.tags,
  });
  if (!result.ok) {
    return res.status(400).json({ error: result.error || "Could not create post." });
  }
  return res.json(result);
});

app.post("/api/social/community/posts/:id/like", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  const result = toggleCommunityPostLikeAction(auth.user.id, String(req.params.id || "").trim());
  if (!result.ok) {
    return res.status(404).json({ error: result.error || "Post not found." });
  }
  return res.json(result);
});

app.post("/api/social/community/posts/:id/replies", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  await syncUserProfileToStoreAndSupabase(auth.user, auth.sb);
  const result = addCommunityReplyAction(
    auth.user.id,
    String(req.params.id || "").trim(),
    String(req.body?.content || "")
  );
  if (!result.ok) {
    return res.status(400).json({ error: result.error || "Could not post reply." });
  }
  return res.json(result);
});

// OAuth callback relay for Supabase Auth (Google, Apple, GitHub) — supports both popup mode (AI Studio iframe) and full-tab mode
app.get(["/auth/callback", "/auth/callback/"], (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Signing in to Edu AI...</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
      .card { text-align: center; padding: 24px 32px; background: #1e293b; border: 1px solid #334155; border-radius: 16px; max-width: 360px; }
      .spinner { width: 28px; height: 28px; border: 3px solid #334155; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 14px; }
      @keyframes spin { to { transform: rotate(360deg); } }
      p { margin: 0; font-size: 14px; color: #cbd5e1; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="spinner"></div>
      <p>Completing sign-in, this window will close automatically...</p>
    </div>
    <script>
      (function () {
        var searchParams = new URLSearchParams(window.location.search);
        var rawHash = window.location.hash ? window.location.hash.substring(1) : "";
        var hashParams = new URLSearchParams(rawHash);
        var payload = {
          type: "EDU_SUPABASE_OAUTH_CALLBACK",
          code: searchParams.get("code") || hashParams.get("code") || null,
          access_token: hashParams.get("access_token") || searchParams.get("access_token") || null,
          refresh_token: hashParams.get("refresh_token") || searchParams.get("refresh_token") || null,
          error: searchParams.get("error") || hashParams.get("error") || null,
          error_description: searchParams.get("error_description") || hashParams.get("error_description") || null
        };
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage(payload, window.location.origin);
          } catch (e) {
            window.opener.postMessage(payload, "*");
          }
          setTimeout(function () { window.close(); }, 120);
        } else {
          window.location.replace("/" + window.location.search + window.location.hash);
        }
      })();
    </script>
  </body>
</html>`);
});

// Unified Server-Persisted Books Catalog API (/api/books)
app.get("/api/books", async (req, res) => {
  try {
    const deletedIds = readDeletedBookIds();
    const deletedSet = new Set(deletedIds);
    let localCatalog = readLocalBooksCatalog();
    const knownFileUrls = new Set(localCatalog.map((b: any) => b.fileUrl).filter(Boolean));

    // Auto-discover any uploaded PDF or EPUB files on local disk not yet in books-catalog.json
    const scanDirs = ["books", "uploads", ""];
    let catalogUpdated = false;
    for (const sub of scanDirs) {
      const targetDir = sub ? path.join(UPLOADS_DIR, sub) : UPLOADS_DIR;
      if (!fs.existsSync(targetDir)) continue;
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      for (const entry of entries) {
        const lowerName = entry.name.toLowerCase();
        const isPdf = lowerName.endsWith(".pdf");
        const isEpub = lowerName.endsWith(".epub");
        if (!entry.isFile() || (!isPdf && !isEpub)) continue;
        const relKey = sub ? `${sub}/${entry.name}` : entry.name;
        if (knownFileUrls.has(relKey) || deletedSet.has(`disk-${relKey}`)) continue;
        const cleanName = entry.name.replace(/^\d+-/, "").replace(/\.(pdf|epub)$/i, "").replace(/[_\-]+/g, " ").trim();
        const inferredKlb = cleanName.toLowerCase().includes("klb");
        const discoveredBook = {
          id: `disk-${relKey}`,
          title: cleanName || getTitleFromKey(relKey),
          author: inferredKlb ? "Kenya Literature Bureau (KLB)" : "Uploaded Textbook",
          publisher: inferredKlb ? "Kenya Literature Bureau (KLB)" : undefined,
          isKicdApproved: inferredKlb,
          coverImage: "",
          category: "Textbook",
          rating: 4.8,
          description: isEpub
            ? "Reflowable EPUB curriculum textbook stored in platform library."
            : "Uploaded source PDF textbook stored in platform library.",
          level: "School",
          curriculum: inferredKlb ? ["CBC", "KCSE"] : ["General"],
          fileUrl: relKey,
          format: isEpub ? "epub" : "pdf",
          securityPolicy: {
            requireEncryptedOffline: true,
            watermarkUser: true,
            allowRawExport: !isEpub,
            offlineLeaseDays: 90,
          },
          createdAt: new Date().toISOString(),
        };
        localCatalog = [discoveredBook, ...localCatalog];
        knownFileUrls.add(relKey);
        catalogUpdated = true;
      }
    }
    if (catalogUpdated) {
      writeLocalBooksCatalog(localCatalog);
    }

    // Opportunistically fetch from Supabase if real credentials exist on server
    const sb = getServerSupabase();
    let cloudBooks: any[] = [];
    let cloudGlobalCovers: Record<string, BookCoverOverride> = {};
    if (sb) {
      try {
        const { data: sbBooks } = await sb.from("books").select("*").order("created_at", { ascending: false });
        if (Array.isArray(sbBooks)) {
          cloudBooks = sbBooks
            .filter((b: any) => {
              if (isSystemBookConfigRow(b)) {
                if ((b.id === GLOBAL_BOOK_COVERS_ROW_ID || b.title === GLOBAL_BOOK_COVERS_ROW_TITLE) && b?.description) {
                  try {
                    const parsed = JSON.parse(b.description);
                    if (parsed && typeof parsed === "object") {
                      cloudGlobalCovers = mergeGlobalBookCoversMaps(cloudGlobalCovers, parsed);
                    }
                  } catch (_) {}
                }
                return false;
              }
              return true;
            })
            .map((b: any) => {
              const isKlb =
                Boolean(b.publisher?.toLowerCase().includes("klb")) ||
                Boolean(b.author?.toLowerCase().includes("klb")) ||
                Boolean(b.title?.toLowerCase().includes("klb")) ||
                Boolean(b.author?.toLowerCase().includes("kenya literature bureau"));
              return {
                id: b.id,
                title: b.title,
                author: b.author || (isKlb ? "Kenya Literature Bureau (KLB)" : "Unknown"),
                publisher: b.publisher || (isKlb ? "Kenya Literature Bureau (KLB)" : undefined),
                isKicdApproved: b.is_kicd_approved ?? isKlb,
                isbn: b.isbn || undefined,
                coverImage: b.cover_image?.includes("unsplash.com") ? "" : b.cover_image || "",
                coverMode: b.cover_mode || undefined,
                pdfCoverPage: b.pdf_cover_page ?? undefined,
                customCover: b.custom_cover || undefined,
                category: b.category || "Textbook",
                rating: 4.8,
                description: b.description || "",
                level: b.education_level || "All",
                curriculum: b.curriculum ? (Array.isArray(b.curriculum) ? b.curriculum : [b.curriculum]) : (isKlb ? ["CBC", "KCSE"] : undefined),
                subjects: b.subjects ? (Array.isArray(b.subjects) ? b.subjects : b.subjects.split(",").map((s: string) => s.trim()).filter(Boolean)) : undefined,
                country: b.country
                  ? (Array.isArray(b.country) ? b.country : [b.country])
                  : b.description?.includes("Location: ")
                    ? [b.description.split("Location: ")[1].trim()]
                    : isKlb
                      ? ["Kenya"]
                      : undefined,
                fileUrl: b.file_url,
              };
            });
        }
      } catch (sbErr) {
        console.warn("[Catalog] Supabase books fetch warning:", sbErr);
      }
    }

    const globalCovers = mergeGlobalBookCoversMaps(readGlobalBookCoversFromDisk(), cloudGlobalCovers);

    // Opportunistically discover PDFs in Backblaze B2 if configured
    const normalizeCatalogBookKey = (val?: string) =>
      String(val || "")
        .toLowerCase()
        .replace(/^\d+[-_]?/, "")
        .replace(/\.pdf$/i, "")
        .replace(/[^a-z0-9]/g, "");

    const knownNormalizedKeys = new Set<string>();
    for (const b of [...localCatalog, ...cloudBooks]) {
      const titleKey = normalizeCatalogBookKey(b?.title);
      if (titleKey) knownNormalizedKeys.add(titleKey);
      const fileLeaf = b?.fileUrl ? String(b.fileUrl).split("/").pop() : "";
      const fileKey = normalizeCatalogBookKey(fileLeaf);
      if (fileKey) knownNormalizedKeys.add(fileKey);
    }

    const s3 = getS3Client();
    let b2Books: any[] = [];
    if (s3 && B2_BUCKET_NAME) {
      try {
        const listRes = await s3.send(new ListObjectsV2Command({ Bucket: B2_BUCKET_NAME, MaxKeys: 200 }));
        const cloudFileUrls = new Set([
          ...Array.from(knownFileUrls),
          ...cloudBooks.map((b: any) => b.fileUrl).filter(Boolean),
        ]);
        for (const obj of listRes.Contents || []) {
          const key = obj.Key || "";
          if (!key.toLowerCase().endsWith(".pdf") || cloudFileUrls.has(key) || deletedSet.has(`b2-${key}`)) continue;
          const filename = key.split("/").pop() || key;
          const cleanName = filename.replace(/^\d+-/, "").replace(/\.pdf$/i, "").replace(/[_\-]+/g, " ").trim();
          const normKey = normalizeCatalogBookKey(cleanName || filename);
          if (normKey && knownNormalizedKeys.has(normKey)) continue;
          if (normKey) knownNormalizedKeys.add(normKey);
          const inferredKlb = cleanName.toLowerCase().includes("klb");
          b2Books.push({
            id: `b2-${key}`,
            title: cleanName || getTitleFromKey(key),
            author: inferredKlb ? "Kenya Literature Bureau (KLB)" : "Cloud Library",
            publisher: inferredKlb ? "Kenya Literature Bureau (KLB)" : undefined,
            isKicdApproved: inferredKlb,
            coverImage: "",
            category: "Textbook",
            rating: 4.8,
            description: "Cloud-synced PDF study material.",
            level: "School",
            curriculum: inferredKlb ? ["CBC", "KCSE"] : undefined,
            fileUrl: key,
          });
        }
      } catch (b2Err) {
        console.warn("[Catalog] B2 list warning:", b2Err);
      }
    }

    // Deduplicate combined books (cloudBooks + localCatalog + b2Books) excluding deletedIds
    const mergedMap = new Map<string, any>();
    for (const book of [...cloudBooks, ...localCatalog, ...b2Books]) {
      if (!book || !book.id || !book.title || deletedSet.has(book.id) || isSystemBookConfigRow(book)) continue;
      const existing = mergedMap.get(book.id);
      if (!existing) {
        mergedMap.set(book.id, book);
      } else {
        mergedMap.set(book.id, {
          ...existing,
          ...book,
          coverImage: book.coverImage || existing.coverImage || "",
          coverMode: book.coverMode || existing.coverMode,
          pdfCoverPage: book.pdfCoverPage ?? existing.pdfCoverPage,
          customCover: book.customCover || existing.customCover,
        });
      }
    }

    const finalBooks = Array.from(mergedMap.values()).map((b) => {
      const withCover = applyGlobalBookCover(b, globalCovers);
      const inferredFormat =
        withCover.format === "epub" || String(withCover.fileUrl || "").toLowerCase().split("?")[0].endsWith(".epub")
          ? "epub"
          : "pdf";
      return {
        ...withCover,
        format: inferredFormat,
        securityPolicy: withCover.securityPolicy || {
          requireEncryptedOffline: true,
          watermarkUser: true,
          allowRawExport: inferredFormat !== "epub",
          offlineLeaseDays: 90,
        },
      };
    });

    res.json({
      books: finalBooks,
      globalBookCovers: globalCovers,
      deletedIds,
      cloudConnected: {
        supabase: Boolean(sb),
        b2: Boolean(s3 && B2_BUCKET_NAME),
      },
    });
  } catch (err: any) {
    console.error("[Catalog] GET /api/books error:", err);
    res.status(500).json({ error: err.message || "Failed to load books catalog" });
  }
});

// System-wide canonical book covers endpoints (shared identically across all users & devices)
app.get("/api/book-covers", async (_req, res) => {
  try {
    const sb = getServerSupabase();
    const covers = await readGlobalBookCovers(sb);
    res.json({ covers });
  } catch (err: any) {
    console.error("[Catalog] GET /api/book-covers error:", err);
    res.status(500).json({ error: "Failed to load global book covers" });
  }
});

app.put("/api/book-covers/:id", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const bookId = req.params.id;
    const rawOverride = req.body?.override || req.body || {};
    const bookMeta = req.body?.bookMeta;
    const override: BookCoverOverride = {
      coverMode: rawOverride.coverMode,
      coverImage: rawOverride.coverImage !== undefined ? String(rawOverride.coverImage || "") : undefined,
      pdfCoverPage: rawOverride.pdfCoverPage !== undefined ? Number(rawOverride.pdfCoverPage) : undefined,
      customCover: rawOverride.customCover,
      titleKey: rawOverride.titleKey || normalizeBookCoverTitleKey(bookMeta?.title),
      updatedAt: new Date().toISOString(),
    };

    const existingCatalog = readLocalBooksCatalog();
    const idx = existingCatalog.findIndex((b: any) => b.id === bookId);
    if (idx >= 0) {
      existingCatalog[idx] = {
        ...existingCatalog[idx],
        ...(override.coverMode ? { coverMode: override.coverMode } : {}),
        ...(override.coverImage !== undefined ? { coverImage: override.coverImage } : {}),
        ...(override.pdfCoverPage !== undefined ? { pdfCoverPage: override.pdfCoverPage } : {}),
        ...(override.customCover ? { customCover: override.customCover } : {}),
      };
      writeLocalBooksCatalog(existingCatalog);
    }

    const covers = await persistGlobalBookCoverUpdate(bookId, override, auth.sb, bookMeta);
    broadcastAllConnectedUsers({
      type: "system:covers-updated",
      bookId,
      covers,
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true, covers });
  } catch (err: any) {
    console.error("[Catalog] PUT /api/book-covers error:", err);
    res.status(500).json({ error: err.message || "Failed to update global book cover" });
  }
});

app.post("/api/books", async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.title) {
      return res.status(400).json({ error: "Book title is required" });
    }

    let createdBook: any = {
      id: payload.id || `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: String(payload.title).trim(),
      author: payload.author ? String(payload.author).trim() : (payload.publisher || "Unknown Author"),
      publisher: payload.publisher ? String(payload.publisher).trim() : undefined,
      isbn: payload.isbn ? String(payload.isbn).trim() : undefined,
      isKicdApproved: Boolean(payload.isKicdApproved),
      description: payload.description || "",
      category: payload.category || "Textbook",
      rating: typeof payload.rating === "number" ? payload.rating : 4.8,
      level: payload.level || "All",
      curriculum: Array.isArray(payload.curriculum)
        ? payload.curriculum
        : payload.curriculum
        ? [String(payload.curriculum)]
        : undefined,
      subjects: Array.isArray(payload.subjects)
        ? payload.subjects
        : typeof payload.subjects === "string" && payload.subjects.trim()
        ? payload.subjects.split(",").map((s: string) => s.trim()).filter(Boolean)
        : undefined,
      country: Array.isArray(payload.country) ? payload.country : undefined,
      coverImage: payload.coverImage || "",
      fileUrl: payload.fileUrl || "",
      format:
        payload.format === "epub" || String(payload.fileUrl || "").toLowerCase().split("?")[0].endsWith(".epub")
          ? "epub"
          : "pdf",
      securityPolicy: payload.securityPolicy || {
        requireEncryptedOffline: true,
        watermarkUser: true,
        allowRawExport: false,
        offlineLeaseDays: 90,
      },
      createdAt: new Date().toISOString(),
    };

    // Opportunistically insert into Supabase if real credentials exist
    const sb = getServerSupabase();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("books")
          .insert([
            {
              title: createdBook.title,
              author: createdBook.author,
              description: createdBook.description,
              category: createdBook.category,
              education_level: createdBook.level,
              curriculum: createdBook.curriculum?.[0] || null,
              subjects: createdBook.subjects?.join(", ") || null,
              cover_image: createdBook.coverImage,
              file_url: createdBook.fileUrl,
              publisher: createdBook.publisher || null,
              is_kicd_approved: createdBook.isKicdApproved,
              isbn: createdBook.isbn || null,
            },
          ])
          .select()
          .single();

        if (!error && data?.id) {
          createdBook = { ...createdBook, id: data.id };
        }
      } catch (sbErr) {
        console.warn("[Catalog] Supabase insert warning (persisted locally):", sbErr);
      }
    }

    // Persist in local books-catalog.json
    const existing = readLocalBooksCatalog().filter((b: any) => b.id !== createdBook.id);
    writeLocalBooksCatalog([createdBook, ...existing]);

    // Ensure it's not marked deleted
    const deletedIds = readDeletedBookIds().filter((id) => id !== createdBook.id);
    writeDeletedBookIds(deletedIds);

    broadcastAllConnectedUsers({
      type: "system:books-updated",
      bookId: createdBook.id,
      action: "create",
      updatedAt: new Date().toISOString(),
    });

    res.json({ book: createdBook, success: true });
  } catch (err: any) {
    console.error("[Catalog] POST /api/books error:", err);
    res.status(500).json({ error: err.message || "Failed to save book" });
  }
});

app.patch("/api/books/:id", async (req, res) => {
  try {
    const bookId = req.params.id;
    const updates = req.body || {};
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
    const sb = getServerSupabase() || getServerSupabase(token);

    const existing = readLocalBooksCatalog();
    const idx = existing.findIndex((b: any) => b.id === bookId);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...updates };
      writeLocalBooksCatalog(existing);
    } else if (updates && updates.title) {
      writeLocalBooksCatalog([{ id: bookId, ...updates }, ...existing]);
    }

    // Sync metadata updates to Supabase public.books so all accounts see canonical catalog updates
    if (sb && bookId && !isSystemBookConfigRow({ id: bookId })) {
      try {
        const dbPatch: Record<string, any> = {};
        if (updates.title !== undefined) dbPatch.title = updates.title;
        if (updates.author !== undefined) dbPatch.author = updates.author;
        if (updates.description !== undefined) dbPatch.description = updates.description;
        if (updates.category !== undefined) dbPatch.category = updates.category;
        if (updates.level !== undefined) dbPatch.education_level = updates.level;
        if (updates.curriculum !== undefined) {
          dbPatch.curriculum = Array.isArray(updates.curriculum) ? updates.curriculum[0] || null : updates.curriculum;
        }
        if (updates.subjects !== undefined) {
          dbPatch.subjects = Array.isArray(updates.subjects) ? updates.subjects.join(", ") : updates.subjects;
        }
        if (updates.coverImage !== undefined) dbPatch.cover_image = updates.coverImage;
        if (updates.fileUrl !== undefined) dbPatch.file_url = updates.fileUrl;
        if (updates.publisher !== undefined) dbPatch.publisher = updates.publisher;
        if (updates.isbn !== undefined) dbPatch.isbn = updates.isbn;
        if (updates.isKicdApproved !== undefined) dbPatch.is_kicd_approved = Boolean(updates.isKicdApproved);

        if (Object.keys(dbPatch).length > 0) {
          await sb.from("books").update(dbPatch).eq("id", bookId);
        }
      } catch (_) {}
    }

    let updatedCovers: Record<string, BookCoverOverride> | null = null;
    if (
      updates.coverImage !== undefined ||
      updates.coverMode !== undefined ||
      updates.pdfCoverPage !== undefined ||
      updates.customCover !== undefined
    ) {
      updatedCovers = await persistGlobalBookCoverUpdate(
        bookId,
        {
          coverMode: updates.coverMode,
          coverImage: updates.coverImage !== undefined ? updates.coverImage : undefined,
          pdfCoverPage: updates.pdfCoverPage,
          customCover: updates.customCover,
          titleKey: normalizeBookCoverTitleKey(updates.title || existing[idx]?.title),
          updatedAt: new Date().toISOString(),
        },
        sb,
        updates.title ? updates : existing[idx]
      );
    }

    broadcastAllConnectedUsers({
      type: "system:books-updated",
      bookId,
      action: "update",
      updatedAt: new Date().toISOString(),
    });
    if (updatedCovers) {
      broadcastAllConnectedUsers({
        type: "system:covers-updated",
        bookId,
        covers: updatedCovers,
        updatedAt: new Date().toISOString(),
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Catalog] PATCH /api/books error:", err);
    res.status(500).json({ error: err.message || "Failed to update book" });
  }
});

app.delete("/api/books/:id", async (req, res) => {
  try {
    const bookId = req.params.id;
    const existing = readLocalBooksCatalog().filter((b: any) => b.id !== bookId);
    writeLocalBooksCatalog(existing);

    const deletedIds = readDeletedBookIds();
    if (!deletedIds.includes(bookId)) {
      writeDeletedBookIds([...deletedIds, bookId]);
    }

    const sb = getServerSupabase();
    if (sb) {
      try {
        await sb.from("books").delete().eq("id", bookId);
      } catch (sbErr) {
        console.warn("[Catalog] Supabase delete warning:", sbErr);
      }
    }

    broadcastAllConnectedUsers({
      type: "system:books-updated",
      bookId,
      action: "delete",
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Catalog] DELETE /api/books error:", err);
    res.status(500).json({ error: err.message || "Failed to delete book" });
  }
});

// System-wide Notifications & Broadcasts API (synced across all existing & newly signed-up accounts)
app.get("/api/system/notifications", async (_req, res) => {
  try {
    const sb = getServerSupabase();
    const notifications = await readSystemNotifications(sb);
    res.json({ ok: true, notifications });
  } catch (err: any) {
    console.error("[SystemNotifications] GET error:", err);
    res.status(500).json({ error: "Failed to load system notifications" });
  }
});

app.post("/api/system/notifications", async (req, res) => {
  const auth = await requireSocialAuth(req, res);
  if (!auth) return;
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const title = String(body.title || "").trim();
    const message = String(body.message || "").trim();
    if (!title || !message) {
      return res.status(400).json({ error: "Notification title and message are required." });
    }

    const notification = {
      id: body.id || `notif-sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: body.type || "platform",
      title,
      message,
      timestamp: body.timestamp || "Just now",
      createdAt: Number(body.createdAt) || Date.now(),
      isRead: false,
      priority: body.priority || "normal",
      author: {
        name:
          body.author?.name ||
          auth.user?.user_metadata?.full_name ||
          auth.user?.email?.split("@")[0] ||
          "Edu AI Team",
        role: body.author?.role || "Platform",
        badge: body.author?.badge || "System Broadcast",
      },
      actionLabel: body.actionLabel || undefined,
      actionView: body.actionView || undefined,
      tags: Array.isArray(body.tags) ? body.tags : [],
      pinned: Boolean(body.pinned),
      systemWide: true,
      createdBy: auth.user.id,
    };

    const notifications = await persistSystemNotification(notification, auth.sb);
    broadcastAllConnectedUsers({
      type: "system:notification",
      notification,
      updatedAt: new Date().toISOString(),
    });

    res.json({ ok: true, notification, notifications });
  } catch (err: any) {
    console.error("[SystemNotifications] POST error:", err);
    res.status(500).json({ error: err.message || "Failed to publish system notification" });
  }
});

// Client error diagnostics endpoint
const clientLogs: any[] = [];
app.post("/api/client-log", (req, res) => {
  const bodyStr = JSON.stringify(req.body || {}).toLowerCase();
  if (bodyStr.includes('websocket') || bodyStr.includes('@vite/client') || bodyStr.includes('vite') || bodyStr.includes('hmr')) {
    return res.json({ received: true, ignored: true });
  }
  clientLogs.push({ time: new Date().toISOString(), ...req.body });
  if (clientLogs.length > 50) clientLogs.shift();
  console.warn("[Browser Diagnostics]", JSON.stringify(req.body));
  res.json({ received: true });
});
app.get("/api/client-log", (req, res) => {
  res.json({ logs: clientLogs });
});

// API Routes - Unified Direct Upload & Presigned Storage Flow
const handleDirectUpload = async (req: express.Request, res: express.Response) => {
  try {
    const filename = (req.query.filename as string) || `file-${Date.now()}`;
    const prefix = (req.query.prefix as string) || 'uploads';
    const customKey = (req.query.key as string);
    const headerContentType = (req.headers['content-type'] as string) || '';
    const contentType = headerContentType.split(';')[0] || getMimeType(filename);
    
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = customKey || `${prefix}/${Date.now()}-${sanitizedFilename}`;

    // 1. Always store to local persistent disk for guaranteed instant access
    const localFilePath = path.join(UPLOADS_DIR, key);
    const localDir = path.dirname(localFilePath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    // Check if body is a Buffer or stream
    let fileBuffer: Buffer = Buffer.from("");
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      fileBuffer = req.body;
    } else if (typeof req.body === 'string') {
      fileBuffer = Buffer.from(req.body);
    }
    fs.writeFileSync(localFilePath, fileBuffer);

    // 2. Opportunistically sync with Backblaze B2 cloud storage
    const s3 = getS3Client();
    if (s3 && B2_BUCKET_NAME) {
      try {
        const command = new PutObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: key,
          ContentType: contentType,
          Body: fileBuffer,
        });
        await s3.send(command);
        console.log(`[Storage] Successfully synced ${key} to B2 bucket ${B2_BUCKET_NAME}`);
      } catch (b2Err: any) {
        console.warn(`[Storage] B2 cloud sync notice for ${key}:`, b2Err.message || b2Err);
      }
    }

    // 3. Mirror uploads to Supabase Storage so images/files survive container restarts
    const sb = getServerSupabase();
    if (sb && fileBuffer.length > 0) {
      const targetBucket = key.startsWith("avatars") || contentType.startsWith("image/") ? "avatars" : "workspace-files";
      try {
        if (sb.storage?.createBucket) {
          await sb.storage.createBucket(targetBucket, { public: targetBucket === "avatars" }).catch(() => {});
        }
        await sb.storage.from(targetBucket).upload(key, fileBuffer, {
          contentType,
          upsert: true,
        });
      } catch (_) {}
    }

    res.json({ 
      key, 
      success: true, 
      url: `/api/download?key=${encodeURIComponent(key)}` 
    });
  } catch (error: any) {
    console.error("Error direct upload:", error);
    res.status(500).json({ error: "Failed to process upload: " + (error.message || "Unknown error") });
  }
};

app.post("/api/upload-direct", express.raw({ type: '*/*', limit: '100mb' }), handleDirectUpload);
app.put("/api/upload-direct", express.raw({ type: '*/*', limit: '100mb' }), handleDirectUpload);
app.post("/api/upload", express.raw({ type: '*/*', limit: '100mb' }), handleDirectUpload);
app.put("/api/upload", express.raw({ type: '*/*', limit: '100mb' }), handleDirectUpload);

app.post("/api/presigned-url", async (req, res) => {
  try {
    const { filename, fileType, operation, prefix = 'uploads' } = req.body;
    if (!filename || !fileType) {
      return res.status(400).json({ error: "filename and fileType are required" });
    }

    const key = `${prefix}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    const s3 = getS3Client();
    if (!s3 || !B2_BUCKET_NAME) {
      return res.json({ 
        presignedUrl: `/api/upload-direct?filename=${encodeURIComponent(filename)}&prefix=${encodeURIComponent(prefix)}&key=${encodeURIComponent(key)}`, 
        fileKey: key,
        directFallback: true 
      });
    }

    try {
      let command;
      if (operation === 'download') {
        command = new GetObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: filename,
        });
      } else {
        command = new PutObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: key,
          ContentType: fileType,
        });
      }

      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      res.json({ presignedUrl, fileKey: key });
    } catch (signErr) {
      console.warn("[Storage] S3 presign warning, falling back to direct upload route:", signErr);
      res.json({ 
        presignedUrl: `/api/upload-direct?filename=${encodeURIComponent(filename)}&prefix=${encodeURIComponent(prefix)}&key=${encodeURIComponent(key)}`, 
        fileKey: key,
        directFallback: true 
      });
    }
  } catch (error) {
    console.error("Error generating presigned url:", error);
    res.status(500).json({ error: "Failed to generate presigned URL" });
  }
});

app.get("/api/download", async (req, res) => {
  const { key, inline } = req.query;
  if (!key || typeof key !== 'string') {
    return res.status(400).send("Key is required");
  }

  const safeKey = key.replace(/^\/+/, "").replace(/\.\.(\/|\\|$)/g, "");
  const strippedUploadsKey = safeKey.replace(/^uploads\/+/, "");
  const filename = safeKey.split('/').pop() || 'download';
  const candidateLocalPaths = Array.from(
    new Set([
      path.join(UPLOADS_DIR, safeKey),
      path.join(UPLOADS_DIR, strippedUploadsKey),
    ])
  );
  const localFilePath = candidateLocalPaths[0];
  const existingLocalPath = candidateLocalPaths.find((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isFile();
    } catch (_) {
      return false;
    }
  });

  // 1. Check local persistent storage first
  if (existingLocalPath) {
    try {
      const mimeType = getMimeType(filename);
      const stat = fs.statSync(existingLocalPath);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (inline === 'true' || mimeType.startsWith('image/')) {
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      } else {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }
      return fs.createReadStream(existingLocalPath).pipe(res);
    } catch (readErr) {
      console.error("[Storage] Error streaming local file:", readErr);
    }
  }

  // 2. If not local, try remote B2 bucket
  const s3 = getS3Client();
  if (s3 && B2_BUCKET_NAME) {
    for (const s3Key of Array.from(new Set([safeKey, strippedUploadsKey]))) {
      try {
        const command = new GetObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: s3Key,
        });

        const response = await s3.send(command);
        
        const mimeType = response.ContentType || getMimeType(filename);
        res.setHeader('Content-Type', mimeType);
        if (response.ContentLength) res.setHeader('Content-Length', response.ContentLength);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        
        if (inline === 'true' || mimeType.startsWith('image/')) {
          res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        } else {
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }
        
        if (response.Body) {
          try {
            const chunks: any[] = [];
            for await (const chunk of (response.Body as any)) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            
            // Cache to local disk so future requests are instant 0ms
            try {
              const localDir = path.dirname(localFilePath);
              if (!fs.existsSync(localDir)) {
                fs.mkdirSync(localDir, { recursive: true });
              }
              fs.writeFileSync(localFilePath, buffer);
            } catch (cacheErr) {
              console.warn("[Storage] Error caching remote file to disk:", cacheErr);
            }

            return res.end(buffer);
          } catch (streamErr) {
            console.error("[Storage] Error reading stream from B2:", streamErr);
            return (response.Body as any).pipe(res);
          }
        }
      } catch (error: any) {
        console.warn(`[Storage] Remote B2 fetch for ${s3Key} notice:`, error.message || error);
      }
    }
  }

  // 2b. Check Supabase Storage buckets before returning 404
  const sb = getServerSupabase();
  if (sb) {
    const keyVariants = Array.from(new Set([safeKey, strippedUploadsKey, filename]));
    for (const bucket of ['avatars', 'workspace-files', 'uploads', 'public']) {
      for (const variant of keyVariants) {
        try {
          const { data: blobData, error: dlErr } = await sb.storage.from(bucket).download(variant);
          if (!dlErr && blobData) {
            const arrBuf = await blobData.arrayBuffer();
            const buffer = Buffer.from(arrBuf);
            const mimeType = blobData.type || getMimeType(filename);
            try {
              fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
              fs.writeFileSync(localFilePath, buffer);
            } catch (_) {}
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Content-Disposition', `${inline === 'true' || mimeType.startsWith('image/') ? 'inline' : 'attachment'}; filename="${filename}"`);
            return res.end(buffer);
          }
        } catch (_) {}
      }
    }
  }

    const mimeType = getMimeType(filename);
    if (mimeType.startsWith('image/')) {
      return res.status(404).send("Image not found");
    }

    // 3. Graceful fallback for study documents / syllabus materials (EPUB 3 or PDF)
    const title = getTitleFromKey(key);
    const wantsEpub =
      req.query.format === 'epub' ||
      filename.toLowerCase().endsWith('.epub') ||
      key.toLowerCase().endsWith('.epub');

    if (wantsEpub) {
      try {
        const epubBuffer = await generateEducationalEpub({
          id: key,
          title,
        });
        const epubFilename = filename.toLowerCase().endsWith('.epub')
          ? filename
          : `${filename.replace(/\.pdf$/i, '')}.epub`;
        res.setHeader('Content-Type', 'application/epub+zip');
        res.setHeader('Content-Length', epubBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Disposition', `inline; filename="${epubFilename}"`);
        return res.send(epubBuffer);
      } catch (epubErr) {
        console.error("[Storage] Error generating educational EPUB for " + title + ":", epubErr);
        return res.status(500).send("Error generating EPUB study material");
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    const downloadFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    res.setHeader('Content-Disposition', `inline; filename="${downloadFilename}"`);

    if (isKLBPhysicsBook(key) || isKLBPhysicsBook(title)) {
      try {
        const pdfBuffer = await generateKLBPhysicsPdf();
        return res.send(pdfBuffer);
      } catch (klbErr) {
        console.error("[Storage] Error generating KLB Physics PDF:", klbErr);
      }
    }

    try {
      const pdfBuffer = await generateEducationalPdf(title);
      return res.send(pdfBuffer);
    } catch (genErr) {
      console.error("[Storage] Error generating educational PDF for " + title + ":", genErr);
      return res.status(500).send("Error generating study material");
    }
  });

  // Flutter Mobile Companion & Publisher EPUB Readiness Manifest
  app.get("/api/flutter/manifest", (req, res) => {
    const localCatalog = readLocalBooksCatalog();
    const epubCount = localCatalog.filter(
      (b: any) => b?.format === "epub" || String(b?.fileUrl || "").toLowerCase().endsWith(".epub")
    ).length;
    const pdfCount = localCatalog.length - epubCount;
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.get("host") || "";
    const apiBaseUrl = host ? `${protocol}://${host}` : "";

    res.json({
      appId: "io.supabase.eduai",
      minSdk: "Flutter >= 3.3.0",
      apiBaseUrl,
      supabaseUrlConfigured: Boolean(getResolvedSupabaseUrlEnv()),
      readerEngines: {
        epub: {
          package: "epub_view: ^3.2.0",
          capabilities: ["reflowable-text", "toc-drawer", "cfi-resume", "offline-encrypted-bytes"],
        },
        pdf: {
          package: "pdfx: ^2.6.0",
          capabilities: ["pinch-zoom", "page-jump", "night-invert", "offline-encrypted-bytes"],
        },
        offlineSecurity: {
          packages: ["flutter_secure_storage: ^9.2.2", "encrypt: ^5.0.3", "crypto: ^3.0.3"],
          cipher: "AES-256-CBC + SHA-256",
          keyStorage: "Keychain (iOS) / Keystore (Android)",
        },
      },
      catalogStats: {
        uploadedBooks: localCatalog.length,
        epubBooks: epubCount,
        pdfBooks: pdfCount,
      },
      endpoints: {
        booksCatalog: "/api/books",
        bookCovers: "/api/book-covers",
        downloadStream: "/api/download?key={fileKey}&format=epub|pdf",
        aiTutorEdgeFunction: "{SUPABASE_URL}/functions/v1/ai-tutor",
      },
    });
  });

  const extractCleanApiError = (error: any, fallback: string) => {
    const raw = String(error?.message || fallback);
    if (raw.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.error?.message) return String(parsed.error.message);
      } catch (_) {}
    }
    return raw;
  };

  // Audiobook Tutor Script & Multimodal Concept Visualization Endpoint
  app.post("/api/audiobooks/script", async (req, res) => {
    try {
      const {
        bookId,
        title,
        author,
        publisher,
        category,
        level,
        curriculum,
        subjects,
        description,
        fileUrl,
        chapterIndex,
        chapterTitle,
        sourceText,
        chaptersList,
        academicSummary,
        forceRefresh,
      } = req.body || {};

      if (!bookId || !title) {
        return res.status(400).json({ error: "bookId and title are required." });
      }

      const script = await generateAudiobookChapterScript({
        uploadsDir: UPLOADS_DIR,
        bookId: String(bookId),
        title: String(title),
        author: author ? String(author) : undefined,
        publisher: publisher ? String(publisher) : undefined,
        category: category ? String(category) : undefined,
        level: level ? String(level) : undefined,
        curriculum: Array.isArray(curriculum) ? curriculum : undefined,
        subjects: Array.isArray(subjects) ? subjects : undefined,
        description: description ? String(description) : undefined,
        fileUrl: fileUrl ? String(fileUrl) : undefined,
        chapterIndex: typeof chapterIndex === "number" ? chapterIndex : Number(chapterIndex || 0),
        chapterTitle: chapterTitle ? String(chapterTitle) : undefined,
        sourceText: sourceText ? String(sourceText) : undefined,
        chaptersList: Array.isArray(chaptersList) ? chaptersList : undefined,
        academicSummary: academicSummary ? String(academicSummary) : undefined,
        forceRefresh: Boolean(forceRefresh),
      });

      return res.json(script);
    } catch (error: any) {
      const msg = extractCleanApiError(error, "Failed to generate audiobook narration script.");
      console.warn("[Audiobooks] /api/audiobooks/script notice:", msg);
      const status = msg.includes("GEMINI_API_KEY") ? 503 : error?.status || 500;
      return res.status(status).json({ error: msg });
    }
  });

  // Audiobook Gemini TTS Audio Synthesis Endpoint (returns complete WAV file)
  app.post("/api/audiobooks/tts", async (req, res) => {
    try {
      const { text, voiceId } = req.body || {};
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Narration text is required." });
      }

      const result = await synthesizeAudiobookSpeech({
        uploadsDir: UPLOADS_DIR,
        text,
        voiceId: voiceId ? String(voiceId) : "seraphina",
      });

      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Length", result.wavBuffer.length);
      res.setHeader("X-TTS-Voice", result.voiceName);
      res.setHeader("X-TTS-Cached", result.cached ? "1" : "0");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(result.wavBuffer);
    } catch (error: any) {
      const msg = extractCleanApiError(error, "Failed to synthesize audiobook speech.");
      console.warn("[Audiobooks] /api/audiobooks/tts notice:", msg);
      const status =
        error?.status ||
        (msg.includes("GEMINI_API_KEY") || msg.includes("API key") ? 503 : 500);
      return res.status(status).json({ error: msg, fallbackToDeviceSpeech: true });
    }
  });

  function getUsableServerGeminiKey(): { apiKey: string | null; reason?: string } {
    const raw = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
    if (!raw || raw === "MY_GEMINI_API_KEY" || raw.startsWith("your_") || raw.length < 16) {
      return {
        apiKey: null,
        reason: "Gemini API key is not configured. Please check GEMINI_API_KEY in Settings > Secrets.",
      };
    }
    return { apiKey: raw };
  }

  function isGeminiKeyOrPermissionError(err: any): boolean {
    const raw = String(err?.message || err || "");
    return (
      err?.status === 401 ||
      err?.status === 403 ||
      raw.includes("API_KEY_INVALID") ||
      raw.includes("API key not valid") ||
      raw.includes("PERMISSION_DENIED") ||
      raw.includes("UNAUTHENTICATED")
    );
  }

  function formatGeminiErrorPayload(err: any): { status: number; message: string } {
    const raw = String(err?.message || err || "");
    const lower = raw.toLowerCase();
    if (isGeminiKeyOrPermissionError(err)) {
      return {
        status: err?.status === 403 ? 403 : 400,
        message: "Your Gemini API key was rejected (API_KEY_INVALID). Please check or update GEMINI_API_KEY in Settings > Secrets.",
      };
    }
    if (err?.status === 429 || lower.includes("resource_exhausted") || lower.includes("quota") || lower.includes("429")) {
      return {
        status: 429,
        message: "Your Gemini API quota or credits are exhausted. Please check billing/quota in Settings > Secrets or retry shortly.",
      };
    }
    if (err?.status === 503 || lower.includes("unavailable") || lower.includes("503") || lower.includes("high demand")) {
      return {
        status: 503,
        message: "The AI model is temporarily experiencing high demand. Please retry in a few moments.",
      };
    }
    return {
      status: typeof err?.status === "number" && err.status >= 400 ? err.status : 500,
      message: "Could not complete AI request right now. Please try again shortly.",
    };
  }

  app.post("/api/learning-path", async (req, res) => {
    try {
      const { apiKey, reason } = getUsableServerGeminiKey();
      if (!apiKey) {
        return res.status(503).json({ error: reason || "GEMINI_API_KEY environment variable is missing" });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const { userStyle, readingHabits, currentProgress } = req.body;

      const prompt = `Generate a personalized learning path consisting of 3 steps based on the user's reading habits and style.
User Style: ${userStyle || "Visual learner, prefers concise explanations."}
Reading Habits: ${readingHabits || "General learning and core subjects."}
Current Progress: ${currentProgress || "Starting foundational topics."}

Return a JSON object with a single 'steps' array. Each step should have:
- title: A short title for the topic
- status: "completed", "current", or "upcoming"
- duration: The estimated duration to complete (e.g., "2 weeks")
`;

      const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
      let parsedSteps: any = null;
      let lastErr: any = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  steps: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        status: { type: Type.STRING },
                        duration: { type: Type.STRING },
                      },
                      required: ["title", "status", "duration"],
                    },
                  },
                },
                required: ["steps"],
              },
            },
          });

          const jsonStr = response.text?.trim() || "";
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed?.steps) && parsed.steps.length > 0) {
            parsedSteps = parsed.steps;
            break;
          }
        } catch (mErr: any) {
          lastErr = mErr;
          if (isGeminiKeyOrPermissionError(mErr)) {
            break;
          }
          console.warn(`[Learning Path] Model ${modelName} error, trying next fallback:`, mErr?.message || mErr);
        }
      }

      if (parsedSteps) {
        return res.json({ steps: parsedSteps });
      }

      const formatted = formatGeminiErrorPayload(lastErr);
      return res.status(formatted.status).json({ error: formatted.message });
    } catch (error: any) {
      const formatted = formatGeminiErrorPayload(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const {
        prompt,
        history,
        provider = 'gemini',
        allowDataCollection,
        bookContext,
        speedMode = 'fast', // 'fast' (default, low thinking latency) | 'deep' (extended thinking)
        stream = false
      } = req.body;

      const isStreamingRequested = Boolean(
        stream === true ||
        req.headers.accept?.includes('text/event-stream') ||
        req.query?.stream === 'true'
      );

      const studyPatternsText = allowDataCollection 
        ? "The user has allowed data collection for their learning patterns. Please analyze the user's progress implicitly, be encouraging about their reading habits, and adjust your tutoring style based on any apparent strengths or weaknesses in the conversation."
        : "The user has disabled data collection. Please act entirely statelessly and do not refer to or assume any longitudinal study patterns.";

      const bookGroundingText = bookContext ? `
You are currently acting as the on-the-spot Sage AI Reading Tutor directly hovering inside the user's active book/PDF reader:
- Current Book Title: "${bookContext.title || 'Educational Text'}"
${bookContext.author ? `- Author/Publisher: "${bookContext.author}"` : ''}
${bookContext.page ? `- Current Reading Page: Page ${bookContext.page}${bookContext.numPages ? ` of ${bookContext.numPages}` : ''}` : ''}
${bookContext.selectedText ? `- User Highlighted Selection: "${bookContext.selectedText}"` : ''}

CRITICAL READING HOVER TUTOR RULES:
1. The student is reading this book right now. Provide clear, direct, and well-structured explanations so they can immediately grasp the concept and continue reading.
2. Ground explanations strictly in the syllabus, concepts, formulas, or themes of this specific book.
3. Use bullet points with bold prefixes for key takeaways to ensure maximum scannability on a compact hovering card.
4. For formulas, math, or physics equations, always use LaTeX notation (e.g., $E = mc^2$ or $$\\Delta x = v_0 t + \\frac{1}{2} a t^2$$).
5. If the user asks about highlighted text, directly analyze and explain the highlighted excerpt.
` : '';

      // Prune history to the last 8 messages to prevent token bloat and reduce TTFT latency
      const recentHistory = (Array.isArray(history) ? history : []).slice(-8);

      const systemPrompt = `As Sage AI, you are an exceptionally intuitive, fast, supportive, and deeply analytical AI educational companion for students. Your core engineering goal is absolute personalization with high response speed: observe and adapt to the student's learning style, curriculum, and pace. Deliver immediate conceptual intuition first, followed by clear, structured, and scannable answers.

${studyPatternsText}
${bookGroundingText}

Core Pedagogical & Speed Rules:
- Direct Intuition First: Explain the 'why' behind a concept with immediate, vivid real-world metaphors or practical intuition before formal definitions.
- Crisp, Scannable Formatting: Use bold headings and bullet points for key takeaways. Keep explanations prompt, clear, and focused without unnecessary conversational preambles.
- Seamless LaTeX Integration: For any mathematical expressions, scientific formulas, constants, or variables, you MUST strictly format them using LaTeX delimiters: $$E = mc^2$$ or $f(x) = y$.
- Proactive Follow-Up: Conclude with a single brief, thought-provoking checkpoint question.

Behavioral Persona:
- Tone: Encouraging, expert, collaborative, and peer-like co-pilot.`;

      // Anthropic Handler
      if (provider === 'anthropic') {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: "ANTHROPIC_API_KEY environment variable is missing" });
        }

        const anthropic = new Anthropic({ apiKey });
        const anthropicMessages: any[] = [];
        for (const msg of recentHistory) {
          anthropicMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          });
        }
        anthropicMessages.push({ role: 'user', content: prompt });

        if (isStreamingRequested) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.flushHeaders?.();

          let clientAborted = false;
          res.on('close', () => {
            if (!res.writableEnded) {
              clientAborted = true;
            }
          });

          try {
            const streamResponse = anthropic.messages.stream({
              model: 'claude-3-7-sonnet-latest',
              max_tokens: 1024,
              system: systemPrompt,
              messages: anthropicMessages
            });

            for await (const chunk of streamResponse) {
              if (clientAborted) break;
              if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
                const text = chunk.delta.text;
                if (text) {
                  res.write(`data: ${JSON.stringify({ text })}\n\n`);
                }
              }
            }

            if (!clientAborted) {
              res.write(`data: [DONE]\n\n`);
              res.end();
            }
            return;
          } catch (anthropicErr: any) {
            console.error("[AI Tutor Anthropic Stream Error]:", anthropicErr?.message || anthropicErr);
            if (!clientAborted) {
              res.write(`data: ${JSON.stringify({ error: anthropicErr?.message || "Anthropic generation error" })}\n\n`);
              res.write(`data: [DONE]\n\n`);
              res.end();
            }
            return;
          }
        }

        const response = await anthropic.messages.create({
          model: 'claude-3-7-sonnet-latest',
          max_tokens: 1024,
          system: systemPrompt,
          messages: anthropicMessages
        });

        const replyText = response.content[0].type === 'text' ? response.content[0].text : '';
        return res.json({ reply: replyText });
      }

      // Default to Gemini with robust fallback cascade for transient model errors
      const { apiKey, reason } = getUsableServerGeminiKey();
      if (!apiKey) {
        return res.status(503).json({
          error: reason || "Gemini API key is not configured. Please check GEMINI_API_KEY in Settings > Secrets.",
        });
      }

      let chatContext = '';
      if (recentHistory.length > 0) {
        chatContext += recentHistory.map((m: any) => `${m.role === 'user' ? 'Student' : 'Sage AI'}: ${m.content}`).join('\n\n');
        chatContext += '\n\n';
      }
      chatContext += `Student: ${prompt}\n\nSage AI:`;

      // Model cascade:
      // In fast mode: prioritize gemini-3.1-flash-lite for immediate sub-second word-by-word streaming
      // In deep mode: prioritize gemini-4-hydrogen for extended chain-of-thought mathematical derivation
      const modelsToTry = speedMode === 'fast'
        ? ["gemini-3.1-flash-lite", "gemini-4-hydrogen"]
        : ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];

      // Helper to configure system instruction and thinking level for minimal latency
      const getModelConfig = (modelName: string) => {
        const config: any = {
          systemInstruction: systemPrompt
        };
        if (modelName === "gemini-4-hydrogen") {
          config.thinkingConfig = {
            thinkingLevel: speedMode === 'deep' ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW
          };
        }
        return config;
      };

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      // Real-time Server-Sent Events (SSE) Streaming
      if (isStreamingRequested) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();
        res.write(`: ping\n\n`);
        if (typeof (res as any).flush === 'function') (res as any).flush();

        let clientAborted = false;
        res.on('close', () => {
          if (!res.writableEnded) {
            clientAborted = true;
          }
        });

        let streamedAny = false;
        let lastModelErr: any = null;
        for (const modelName of modelsToTry) {
          if (clientAborted) break;
          try {
            const config = getModelConfig(modelName);
            const responseStream = await ai.models.generateContentStream({
              model: modelName,
              contents: chatContext,
              config,
            });

            for await (const chunk of responseStream) {
              if (clientAborted) break;

              const parts = chunk.candidates?.[0]?.content?.parts || [];
              let handledPart = false;

              for (const part of parts) {
                if ((part as any).thought && part.text) {
                  res.write(`data: ${JSON.stringify({ thought: part.text })}\n\n`);
                  if (typeof (res as any).flush === 'function') (res as any).flush();
                  handledPart = true;
                } else if (part.text && !(part as any).thought) {
                  res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
                  if (typeof (res as any).flush === 'function') (res as any).flush();
                  streamedAny = true;
                  handledPart = true;
                }
              }

              if (!handledPart && chunk.text) {
                res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
                if (typeof (res as any).flush === 'function') (res as any).flush();
                streamedAny = true;
              }
            }

            if (streamedAny) {
              break;
            }
          } catch (modelErr: any) {
            lastModelErr = modelErr;
            if (isGeminiKeyOrPermissionError(modelErr)) {
              break;
            }
            console.warn(`[AI Tutor Stream] Model ${modelName} transient error, trying next fallback:`, modelErr?.message || modelErr);
          }
        }

        if (!streamedAny && !clientAborted) {
          const formatted = formatGeminiErrorPayload(lastModelErr);
          res.write(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
        }

        if (!clientAborted) {
          res.write(`data: [DONE]\n\n`);
          res.end();
        }
        return;
      }

      // Standard non-streaming JSON generation
      let generatedText: string | null = null;
      let lastModelErr: any = null;
      for (const modelName of modelsToTry) {
        try {
          const config = getModelConfig(modelName);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: chatContext,
            config,
          });
          if (response?.text) {
            generatedText = response.text;
            break;
          }
        } catch (modelErr: any) {
          lastModelErr = modelErr;
          if (isGeminiKeyOrPermissionError(modelErr)) {
            break;
          }
          console.warn(`[AI Tutor] Model ${modelName} transient error, trying next fallback:`, modelErr?.message || modelErr);
        }
      }

      if (generatedText) {
        return res.json({ reply: generatedText });
      }

      const formatted = formatGeminiErrorPayload(lastModelErr);
      return res.status(formatted.status).json({ error: formatted.message });
    } catch (error: any) {
      const errorString = error?.toString() || JSON.stringify(error) || "";
      if ((error?.status === 400 || errorString.includes('400')) && errorString.includes('credit balance')) {
        return res.status(400).json({ error: "Your Anthropic API credit balance is too low. Please switch to the Gemini Model or add credits to your Anthropic account." });
      }
      const formatted = formatGeminiErrorPayload(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Vite middleware for development

function attachSocialWebSocketServer(httpServer: http.Server): void {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/chat" });

  wss.on("connection", async (ws, req) => {
    let authedUserId: string | null = null;
    let authedUserName = "Scholar";

    const registerUser = async (token: string) => {
      const verified = await verifySocialToken(token);
      if (!verified) {
        try {
          ws.send(JSON.stringify({ type: "error", code: 4001, message: "Invalid or expired token" }));
          ws.close(4001, "Unauthorized");
        } catch (_) {}
        return;
      }

      const uid = verified.user.id;
      if (authedUserId === uid && socialSocketsByUser.get(uid)?.has(ws)) {
        return;
      }
      if (authedUserId && authedUserId !== uid) {
        const oldSet = socialSocketsByUser.get(authedUserId);
        if (oldSet) {
          oldSet.delete(ws);
          if (oldSet.size === 0) {
            socialSocketsByUser.delete(authedUserId);
          }
        }
      }

      authedUserId = uid;
      const prof = await syncUserProfileToStoreAndSupabase(verified.user, verified.sb);
      authedUserName = prof.name;

      let set = socialSocketsByUser.get(uid);
      if (!set) {
        set = new Set();
        socialSocketsByUser.set(uid, set);
      }
      set.add(ws);

      try {
        ws.send(
          JSON.stringify({
            type: "auth:ok",
            userId: uid,
            onlineUserIds: Array.from(getOnlineUserIdSet()),
          })
        );
      } catch (_) {}
      broadcastPresenceUpdate();
    };

    try {
      const urlObj = new URL(req.url || "/ws/chat", "http://localhost");
      const queryToken = urlObj.searchParams.get("token");
      if (queryToken) {
        await registerUser(queryToken);
      }
    } catch (_) {}

    ws.on("message", async (rawData) => {
      let msg: any = null;
      try {
        msg = JSON.parse(rawData.toString("utf-8"));
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "auth" && typeof msg.token === "string") {
        await registerUser(msg.token);
        return;
      }

      if (msg.type === "ping") {
        try {
          ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        } catch (_) {}
        return;
      }

      if (!authedUserId) return;

      if (msg.type === "typing" && typeof msg.conversationId === "string") {
        const conv = getConversationIfParticipant(msg.conversationId, authedUserId);
        if (!conv) return;
        broadcastSocialEventToUsers(
          conv.participants,
          {
            type: "chat:typing",
            conversationId: conv.id,
            userId: authedUserId,
            name: authedUserName,
            isTyping: Boolean(msg.isTyping),
          },
          authedUserId
        );
        return;
      }

      if (msg.type === "read" && typeof msg.conversationId === "string") {
        const result = markConversationReadAction(authedUserId, msg.conversationId);
        if (result.ok && result.updatedMessageIds.length > 0) {
          broadcastSocialEventToUsers(result.participants, {
            type: "chat:read",
            conversationId: msg.conversationId,
            readerId: authedUserId,
            messageIds: result.updatedMessageIds,
            seenAt: result.seenAt,
          });
        }
      }
    });

    ws.on("close", () => {
      if (authedUserId) {
        const set = socialSocketsByUser.get(authedUserId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) {
            socialSocketsByUser.delete(authedUserId);
          }
        }
        broadcastPresenceUpdate();
      }
    });
  });
}

async function reconcileAdminProfilesOnBoot() {
  const sb = getServerSupabase();
  if (sb) {
    try {
      const nowIso = new Date().toISOString();
      const { data: rows } = await sb
        .from("profiles")
        .select("id, email, role")
        .or("email.ilike.eduai.platform@admin.com,email.ilike.wolter@admin.com");

      if (Array.isArray(rows)) {
        for (const row of rows) {
          const emailLower = String(row?.email || "").trim().toLowerCase();
          if (emailLower === "eduai.platform@admin.com" && row.role !== "admin") {
            await sb.from("profiles").update({ role: "admin", updated_at: nowIso }).eq("id", row.id);
            await sb.auth?.admin?.updateUserById?.(row.id, { user_metadata: { role: "admin" } }).catch(() => {});
          } else if (emailLower === "wolter@admin.com" && row.role === "admin") {
            await sb.from("profiles").update({ role: "student", updated_at: nowIso }).eq("id", row.id);
            await sb.auth?.admin?.updateUserById?.(row.id, { user_metadata: { role: "student" } }).catch(() => {});
          }
        }
      }

      // Also reconcile Supabase Auth user_metadata in case user exists in auth.users before profile row update
      try {
        let totalScanned = 0;
        let platformExists = false;
        let plaformExists = false;
        let platformConfirmed = false;
        let plaformConfirmed = false;

        for (let page = 1; page <= 10; page++) {
          const { data: usersPage } = await sb.auth.admin.listUsers({ page, perPage: 200 });
          const batch = usersPage?.users || [];
          totalScanned += batch.length;
          for (const u of batch) {
            // Scrub any bloated base64 avatar data from Supabase Auth user_metadata so JWTs stay compact (<1KB)
            await scrubBloatedUserMetadata(u, sb);

            const emailLower = String(u?.email || "").trim().toLowerCase();
            if (emailLower === "eduai.platform@admin.com") {
              platformExists = true;
              platformConfirmed = Boolean(u?.email_confirmed_at || u?.confirmed_at);
              const needsConfirm = !platformConfirmed;
              const needsRole = u?.user_metadata?.role !== "admin";
              if (needsConfirm || needsRole) {
                await sb.auth.admin.updateUserById(u.id, {
                  ...(needsConfirm ? { email_confirm: true } : {}),
                  user_metadata: { ...(u.user_metadata || {}), role: "admin" },
                }).catch(() => {});
                if (needsConfirm) platformConfirmed = true;
              }
              await sb.from("profiles").upsert({ id: u.id, email: u.email, role: "admin", updated_at: nowIso }, { onConflict: "id" });
            } else if (emailLower === "eduai.plaform@admin.com") {
              plaformExists = true;
              plaformConfirmed = Boolean(u?.email_confirmed_at || u?.confirmed_at);
            } else if (emailLower === "wolter@admin.com" && u?.user_metadata?.role === "admin") {
              await sb.auth.admin.updateUserById(u.id, {
                user_metadata: { ...(u.user_metadata || {}), role: "student" },
              }).catch(() => {});
              await sb.from("profiles").update({ role: "student", updated_at: nowIso }).eq("id", u.id);
            }
          }
          if (batch.length < 200) break;
        }
      } catch (_) {}
    } catch (err) {
      console.warn("[AdminMigration] Profile role reconciliation notice:", err);
    }
  }

  // Reconcile any cached user-sync files on local disk
  try {
    if (fs.existsSync(USER_SYNC_DIR)) {
      for (const fname of fs.readdirSync(USER_SYNC_DIR)) {
        if (!fname.endsWith(".json")) continue;
        const fpath = path.join(USER_SYNC_DIR, fname);
        try {
          const parsed = JSON.parse(fs.readFileSync(fpath, "utf-8"));
          const snapEmail = String(parsed?.profileSnapshot?.email || "").trim().toLowerCase();
          if (snapEmail === "eduai.platform@admin.com" && parsed.profileSnapshot.role !== "admin") {
            parsed.profileSnapshot.role = "admin";
            fs.writeFileSync(fpath, JSON.stringify(parsed, null, 2), "utf-8");
          } else if (snapEmail === "wolter@admin.com" && parsed.profileSnapshot.role === "admin") {
            parsed.profileSnapshot.role = "student";
            fs.writeFileSync(fpath, JSON.stringify(parsed, null, 2), "utf-8");
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  // Pre-hydrate ALL registered users into the social directory & sync Supabase cloud social graph on boot
  try {
    const bootSb = getServerSupabase();
    registerSocialSupabaseClient(bootSb);
    await hydrateDirectoryFromSupabase(bootSb, { backfillProfiles: true });
    await hydrateSocialCloudState(bootSb, { force: true });
    await backfillFriendRequestsToSupabase(bootSb, true);
  } catch (_) {}
}

async function startDevServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = http.createServer({ maxHeaderSize: 65536 }, app);
  httpServer.on("error", (err) => {
    console.error("[Server] HTTP server error:", err);
  });
  attachSocialWebSocketServer(httpServer);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} (HTTP + WS /ws/chat)`);
    void reconcileAdminProfilesOnBoot();
  });
}

startDevServer().catch((err) => {
  console.error("[Server] Failed to start dev server:", err);
  process.exit(1);
});

export default app;

