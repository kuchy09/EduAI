import fs from "fs";
import path from "path";
import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  GLOBAL_SOCIAL_GRAPH_ROW_ID,
  GLOBAL_SOCIAL_GRAPH_ROW_TITLE,
  GLOBAL_SOCIAL_MESSAGES_ROW_ID,
  GLOBAL_SOCIAL_MESSAGES_ROW_TITLE,
} from "../shared/canonicalBookCovers";

export type SocialRole = "teacher" | "student" | "educator" | "admin";
export type FriendRelationStatus = "friends" | "pending_sent" | "pending_received" | "none";

export interface SocialUserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar: string;
  role: SocialRole;
  title: string;
  institution: string;
  subjects: string[];
  bio: string;
  location?: string;
  lastSeen: string;
  updatedAt: string;
}

export interface FriendRequestRecord {
  id: string;
  senderId: string;
  receiverId: string;
  status: "pending" | "accepted" | "declined";
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialMessageRecord {
  id: string;
  clientMessageId?: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: SocialRole;
  senderAvatar?: string;
  content: string;
  createdAt: string;
  status: "sent" | "delivered" | "read";
  seenAt?: string;
  readBy: string[];
  reactions: Record<string, string[]>;
  attachment?: any;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
}

export interface SocialConversationRecord {
  id: string;
  type: "direct" | "group";
  participants: string[];
  name?: string;
  description?: string;
  groupRoleType?: "teacher-to-teacher" | "teacher-to-student" | "student-to-student" | "study-group";
  subjectTag?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityReplyRecord {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

export interface CommunityPostRecord {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  title: string;
  content: string;
  tags: string[];
  likedBy: string[];
  replies: CommunityReplyRecord[];
  createdAt: string;
}

interface SocialStateDisk {
  users: Record<string, SocialUserProfile>;
  friendRequests: FriendRequestRecord[];
  removedFriendPairs?: Record<string, string>;
  conversations: Record<string, SocialConversationRecord>;
  messages: Record<string, SocialMessageRecord[]>;
  deletedMessageIds?: Record<string, string>;
  unreadCounts: Record<string, Record<string, number>>; // convId -> { userId: count }
  communityPosts: CommunityPostRecord[];
  updatedAt: string;
}

const UPLOADS_DIR = process.env.VERCEL ? path.join("/tmp", "uploads") : path.join(process.cwd(), "uploads");
const USER_SYNC_DIR = path.join(UPLOADS_DIR, "user-sync");
const SOCIAL_STATE_FILE = path.join(UPLOADS_DIR, "social-state.json");
const CLOUD_SOCIAL_BUCKET = "workspace-files";
const CLOUD_SOCIAL_OBJECT_KEY = "_system/social-state.json";

function createInitialCommunityPosts(): CommunityPostRecord[] {
  const now = Date.now();
  return [
    {
      id: "post-welcome-study",
      authorId: "system-edu-faculty",
      authorName: "Dr. Wanjiku Njoroge",
      authorRole: "Educator",
      title: "Tips for organizing weekly CBC & STEM study circles",
      content:
        "Break each 45-minute peer session into 15 minutes of concept recap from your textbook, 20 minutes solving past-paper problems together, and 10 minutes writing shared takeaways you can revisit before exams.",
      tags: ["StudyHabits", "CBC", "STEM"],
      likedBy: [],
      replies: [
        {
          id: "reply-welcome-1",
          authorId: "system-edu-peer",
          authorName: "Grace Otieno",
          authorRole: "Student",
          content: "Adding shared takeaways right into our Study Group chat has helped our Physics revision stay structured!",
          createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        },
      ],
      createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function getDefaultState(): SocialStateDisk {
  return {
    users: {},
    friendRequests: [],
    removedFriendPairs: {},
    conversations: {},
    messages: {},
    deletedMessageIds: {},
    unreadCounts: {},
    communityPosts: createInitialCommunityPosts(),
    updatedAt: new Date().toISOString(),
  };
}

let cachedState: SocialStateDisk | null = null;
let registeredSocialSb: SupabaseClient | null = null;

export function registerSocialSupabaseClient(sb?: SupabaseClient | null): void {
  if (sb) {
    registeredSocialSb = sb;
  }
}

function readDiskState(): SocialStateDisk {
  if (cachedState) return cachedState;
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    if (fs.existsSync(SOCIAL_STATE_FILE)) {
      const raw = fs.readFileSync(SOCIAL_STATE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        cachedState = {
          users: parsed.users && typeof parsed.users === "object" ? parsed.users : {},
          friendRequests: Array.isArray(parsed.friendRequests) ? parsed.friendRequests : [],
          removedFriendPairs:
            parsed.removedFriendPairs && typeof parsed.removedFriendPairs === "object"
              ? parsed.removedFriendPairs
              : {},
          conversations: parsed.conversations && typeof parsed.conversations === "object" ? parsed.conversations : {},
          messages: parsed.messages && typeof parsed.messages === "object" ? parsed.messages : {},
          deletedMessageIds:
            parsed.deletedMessageIds && typeof parsed.deletedMessageIds === "object"
              ? parsed.deletedMessageIds
              : {},
          unreadCounts: parsed.unreadCounts && typeof parsed.unreadCounts === "object" ? parsed.unreadCounts : {},
          communityPosts:
            Array.isArray(parsed.communityPosts) && parsed.communityPosts.length > 0
              ? parsed.communityPosts
              : createInitialCommunityPosts(),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
        return cachedState;
      }
    }
  } catch (err) {
    console.warn("[SocialStore] Failed reading social-state.json:", err);
  }
  cachedState = getDefaultState();
  return cachedState;
}

function writeDiskState(state: SocialStateDisk): void {
  state.updatedAt = new Date().toISOString();
  cachedState = state;
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const tmpFile = `${SOCIAL_STATE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state), "utf-8");
    fs.renameSync(tmpFile, SOCIAL_STATE_FILE);
  } catch (err) {
    console.warn("[SocialStore] Failed writing social-state.json:", err);
  }
}

function buildFriendPairKey(idA: string, idB: string): string {
  return [String(idA || ""), String(idB || "")].sort().join("::");
}

function safeTimestampMs(iso?: string): number {
  if (!iso) return 0;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? ts : 0;
}

let friendRequestsTableAvailable: boolean | null = null;
let friendRequestsTableCheckedAt = 0;
let loggedMissingFriendRequestsNotice = false;
const FRIEND_REQUESTS_RECHECK_MS = 5 * 60 * 1000;

function isMissingFriendRequestsTableError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || "").trim();
  const msg = String(err.message || err || "").toLowerCase();
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache") ||
    (msg.includes("friend_requests") && msg.includes("does not exist"))
  );
}

function markFriendRequestsTableUnavailable(): void {
  friendRequestsTableAvailable = false;
  friendRequestsTableCheckedAt = Date.now();
  if (!loggedMissingFriendRequestsNotice) {
    loggedMissingFriendRequestsNotice = true;
    console.info("[SocialStore] public.friend_requests table not present; using Supabase cloud snapshot persistence.");
  }
}

function canQueryFriendRequestsTable(): boolean {
  if (friendRequestsTableAvailable === null) return true;
  if (friendRequestsTableAvailable === true) return true;
  return Date.now() - friendRequestsTableCheckedAt >= FRIEND_REQUESTS_RECHECK_MS;
}

let cloudBucketEnsured = false;
let lastCloudHydrateAt = 0;
let inFlightCloudHydrate: Promise<void> | null = null;
let cloudSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function mergeReactionsMaps(
  a?: Record<string, string[]>,
  b?: Record<string, string[]>
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const src of [a, b]) {
    if (!src || typeof src !== "object") continue;
    for (const [emoji, uids] of Object.entries(src)) {
      if (!Array.isArray(uids) || uids.length === 0) continue;
      result[emoji] = Array.from(new Set([...(result[emoji] || []), ...uids]));
    }
  }
  return result;
}

function mergeCloudSnapshotIntoState(state: SocialStateDisk, snapshot: any): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  let changed = false;

  if (!state.removedFriendPairs) state.removedFriendPairs = {};
  if (snapshot.removedFriendPairs && typeof snapshot.removedFriendPairs === "object") {
    for (const [pairKey, delIso] of Object.entries(snapshot.removedFriendPairs)) {
      if (!pairKey || typeof delIso !== "string") continue;
      const existingDel = state.removedFriendPairs[pairKey];
      if (!existingDel || safeTimestampMs(delIso) > safeTimestampMs(existingDel)) {
        state.removedFriendPairs[pairKey] = delIso;
        changed = true;
      }
    }
  }

  if (!state.deletedMessageIds) state.deletedMessageIds = {};
  if (snapshot.deletedMessageIds && typeof snapshot.deletedMessageIds === "object") {
    for (const [msgId, delIso] of Object.entries(snapshot.deletedMessageIds)) {
      if (!msgId || typeof delIso !== "string") continue;
      const existingDel = state.deletedMessageIds[msgId];
      if (!existingDel || safeTimestampMs(delIso) > safeTimestampMs(existingDel)) {
        state.deletedMessageIds[msgId] = delIso;
        changed = true;
      }
    }
  }

  // Enforce sender-deleted message tombstones across all local conversations so deleted messages never resurrect
  const deletedMsgKeys = Object.keys(state.deletedMessageIds);
  if (deletedMsgKeys.length > 0) {
    const delSet = new Set(deletedMsgKeys);
    for (const [convId, list] of Object.entries(state.messages)) {
      if (!Array.isArray(list) || list.length === 0) continue;
      const filtered = list.filter((m) => m?.id && !delSet.has(m.id));
      if (filtered.length !== list.length) {
        state.messages[convId] = filtered;
        changed = true;
      }
    }
  }

  // Prune any local friend requests older than a merged deletion marker
  const beforePruneLen = state.friendRequests.length;
  state.friendRequests = state.friendRequests.filter((fr) => {
    const pairKey = buildFriendPairKey(fr.senderId, fr.receiverId);
    const delMs = safeTimestampMs(state.removedFriendPairs?.[pairKey]);
    if (!delMs) return true;
    return safeTimestampMs(fr.updatedAt || fr.createdAt) > delMs;
  });
  if (state.friendRequests.length !== beforePruneLen) {
    changed = true;
  }

  if (Array.isArray(snapshot.friendRequests)) {
    for (const rawFr of snapshot.friendRequests) {
      if (!rawFr?.senderId || !rawFr?.receiverId) continue;
      const pairKey = buildFriendPairKey(rawFr.senderId, rawFr.receiverId);
      const delMs = safeTimestampMs(state.removedFriendPairs?.[pairKey]);
      const rawUpdatedAt = rawFr.updatedAt || rawFr.createdAt || new Date().toISOString();
      const rawUpdatedMs = safeTimestampMs(rawUpdatedAt);
      if (delMs && rawUpdatedMs <= delMs) continue;

      const status: FriendRequestRecord["status"] =
        rawFr.status === "accepted" || rawFr.status === "declined" ? rawFr.status : "pending";

      const existing = state.friendRequests.find(
        (fr) => buildFriendPairKey(fr.senderId, fr.receiverId) === pairKey
      );
      if (!existing) {
        state.friendRequests.push({
          id: rawFr.id || `fr_${crypto.randomUUID()}`,
          senderId: rawFr.senderId,
          receiverId: rawFr.receiverId,
          status,
          note: typeof rawFr.note === "string" && rawFr.note.trim() ? rawFr.note.trim() : undefined,
          createdAt: rawFr.createdAt || rawUpdatedAt,
          updatedAt: rawUpdatedAt,
        });
        changed = true;
      } else {
        const exUpdatedMs = safeTimestampMs(existing.updatedAt || existing.createdAt);
        if (
          rawUpdatedMs > exUpdatedMs ||
          (rawUpdatedMs === exUpdatedMs && status === "accepted" && existing.status !== "accepted")
        ) {
          existing.senderId = rawFr.senderId;
          existing.receiverId = rawFr.receiverId;
          existing.status = status;
          if (typeof rawFr.note === "string" && rawFr.note.trim()) {
            existing.note = rawFr.note.trim();
          }
          existing.updatedAt = rawUpdatedAt;
          changed = true;
        }
      }

      if (status === "accepted") {
        const dmId = buildDirectConvId(rawFr.senderId, rawFr.receiverId);
        if (!state.conversations[dmId]) {
          ensureDirectConversationInState(state, rawFr.senderId, rawFr.receiverId, rawFr.createdAt, rawUpdatedAt);
          changed = true;
        }
      }
    }
  }

  if (snapshot.conversations && typeof snapshot.conversations === "object") {
    for (const [convId, rawConv] of Object.entries<any>(snapshot.conversations)) {
      if (!convId || !rawConv || typeof rawConv !== "object") continue;
      const existing = state.conversations[convId];
      if (!existing) {
        state.conversations[convId] = { ...rawConv };
        changed = true;
      } else {
        const unionParticipants = Array.from(
          new Set([...(existing.participants || []), ...(Array.isArray(rawConv.participants) ? rawConv.participants : [])])
        );
        if (unionParticipants.length !== (existing.participants || []).length) {
          existing.participants = unionParticipants;
          changed = true;
        }
        if (safeTimestampMs(rawConv.updatedAt) > safeTimestampMs(existing.updatedAt)) {
          existing.updatedAt = rawConv.updatedAt;
          if (rawConv.name) existing.name = rawConv.name;
          if (rawConv.description) existing.description = rawConv.description;
          changed = true;
        }
      }
    }
  }

  if (snapshot.messages && typeof snapshot.messages === "object") {
    const deletedSet = state.deletedMessageIds || {};
    for (const [convId, rawList] of Object.entries<any>(snapshot.messages)) {
      if (!Array.isArray(rawList) || rawList.length === 0) continue;
      const currentList = state.messages[convId] || [];
      const byId = new Map<string, SocialMessageRecord>();
      const clientKeyToId = new Map<string, string>();
      for (const m of currentList) {
        if (!m?.id || deletedSet[m.id]) continue;
        byId.set(m.id, m);
        if (m.clientMessageId && m.senderId) {
          clientKeyToId.set(`${m.senderId}::${m.clientMessageId}`, m.id);
        }
      }
      let addedOrUpdated = false;
      for (const m of rawList) {
        if (!m?.id || deletedSet[m.id]) continue;
        const clientKey = m.clientMessageId && m.senderId ? `${m.senderId}::${m.clientMessageId}` : "";
        const mappedId = clientKey ? clientKeyToId.get(clientKey) : undefined;
        const lookupId = mappedId || m.id;
        const prev = byId.get(lookupId);
        if (!prev) {
          byId.set(m.id, m);
          if (clientKey) clientKeyToId.set(clientKey, m.id);
          addedOrUpdated = true;
        } else {
          const prevRead = Array.isArray(prev.readBy) ? prev.readBy.length : 0;
          const nextRead = Array.isArray(m.readBy) ? m.readBy.length : 0;
          const unionReadBy = Array.from(
            new Set([
              ...(Array.isArray(prev.readBy) ? prev.readBy : []),
              ...(Array.isArray(m.readBy) ? m.readBy : []),
            ])
          );
          const mergedReactions = mergeReactionsMaps(prev.reactions, m.reactions);
          const statusChanged = m.status === "read" && prev.status !== "read";
          const reactionChanged = JSON.stringify(mergedReactions) !== JSON.stringify(prev.reactions || {});
          const richerAttachment = !prev.attachment?.url && Boolean(m.attachment?.url);
          if (unionReadBy.length > prevRead || nextRead > prevRead || statusChanged || reactionChanged || richerAttachment) {
            byId.set(prev.id, {
              ...prev,
              ...m,
              id: prev.id,
              attachment: richerAttachment ? m.attachment : prev.attachment || m.attachment,
              readBy: unionReadBy,
              reactions: mergedReactions,
              status: prev.status === "read" || m.status === "read" ? "read" : m.status || prev.status,
              seenAt: prev.seenAt || m.seenAt,
            });
            addedOrUpdated = true;
          }
        }
      }
      if (addedOrUpdated) {
        state.messages[convId] = Array.from(byId.values()).sort(
          (a, b) => safeTimestampMs(a.createdAt) - safeTimestampMs(b.createdAt)
        );
        changed = true;
      }
    }
  }

  if (snapshot.unreadCounts && typeof snapshot.unreadCounts === "object") {
    for (const [convId, rawMap] of Object.entries<any>(snapshot.unreadCounts)) {
      if (!rawMap || typeof rawMap !== "object") continue;
      if (!state.unreadCounts[convId]) {
        state.unreadCounts[convId] = { ...rawMap };
        changed = true;
      } else {
        for (const [uid, cnt] of Object.entries(rawMap)) {
          if (state.unreadCounts[convId][uid] === undefined && typeof cnt === "number") {
            state.unreadCounts[convId][uid] = cnt;
            changed = true;
          }
        }
      }
    }
  }

  if (Array.isArray(snapshot.communityPosts)) {
    const existingIds = new Set(state.communityPosts.map((p) => p.id));
    for (const post of snapshot.communityPosts) {
      if (!post?.id) continue;
      if (!existingIds.has(post.id)) {
        state.communityPosts.push(post);
        existingIds.add(post.id);
        changed = true;
      }
    }
  }

  return changed;
}

async function ensureSocialStorageBucket(sb: SupabaseClient): Promise<void> {
  if (cloudBucketEnsured || !sb.storage?.createBucket) return;
  cloudBucketEnsured = true;
  try {
    await sb.storage.createBucket(CLOUD_SOCIAL_BUCKET, { public: false }).catch(() => {});
  } catch (_) {}
}

let cloudPersistChain: Promise<void> = Promise.resolve();

function buildPostgresMessagesBackupPayload(state: SocialStateDisk): string {
  const basePayload = {
    conversations: state.conversations,
    messages: state.messages,
    deletedMessageIds: state.deletedMessageIds || {},
    unreadCounts: state.unreadCounts,
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
  let serialized = JSON.stringify(basePayload);
  if (serialized.length <= 900_000) {
    return serialized;
  }

  // Strip oversized inline data URLs in Postgres backup fallback only if payload exceeds ~900KB
  const compactedMessages: Record<string, SocialMessageRecord[]> = {};
  for (const [cid, list] of Object.entries(state.messages || {})) {
    compactedMessages[cid] = (list || []).map((m) => {
      if (m?.attachment && typeof m.attachment.url === "string" && m.attachment.url.length > 32_768) {
        return {
          ...m,
          attachment: {
            ...m.attachment,
            url: undefined,
          },
        };
      }
      return m;
    });
  }
  serialized = JSON.stringify({
    ...basePayload,
    messages: compactedMessages,
  });
  return serialized;
}

export async function persistSocialCloudState(
  sb?: SupabaseClient | null,
  stateOverride?: SocialStateDisk
): Promise<void> {
  const client = sb || registeredSocialSb;
  if (!client) return;
  if (sb) registeredSocialSb = sb;

  const runPersist = async () => {
    const state = stateOverride || readDiskState();

    const compactGraph = {
      friendRequests: state.friendRequests,
      removedFriendPairs: state.removedFriendPairs || {},
      updatedAt: state.updatedAt || new Date().toISOString(),
    };

    const fullPayload = {
      friendRequests: state.friendRequests,
      removedFriendPairs: state.removedFriendPairs || {},
      conversations: state.conversations,
      messages: state.messages,
      deletedMessageIds: state.deletedMessageIds || {},
      unreadCounts: state.unreadCounts,
      communityPosts: state.communityPosts,
      updatedAt: state.updatedAt || new Date().toISOString(),
    };

    const messagesBackupJson = buildPostgresMessagesBackupPayload(state);

    // 1. Persist full social state JSON to Supabase Storage (durable across container restarts)
    const storageWrite = (async () => {
      try {
        await ensureSocialStorageBucket(client);
        const buf = Buffer.from(JSON.stringify(fullPayload), "utf-8");
        const { error: upErr } = await client.storage
          .from(CLOUD_SOCIAL_BUCKET)
          .upload(CLOUD_SOCIAL_OBJECT_KEY, buf, {
            contentType: "application/json",
            upsert: true,
          });
        if (upErr && String(upErr.message || "").toLowerCase().includes("bucket")) {
          cloudBucketEnsured = false;
          await ensureSocialStorageBucket(client);
          await client.storage.from(CLOUD_SOCIAL_BUCKET).upload(CLOUD_SOCIAL_OBJECT_KEY, buf, {
            contentType: "application/json",
            upsert: true,
          });
        }
      } catch (_) {}
    })();

    // 2. Persist compact friendRequests graph in Postgres books __SYSTEM_CONFIG__ row
    const graphDbWrite = (async () => {
      try {
        await client.from("books").upsert(
          {
            id: GLOBAL_SOCIAL_GRAPH_ROW_ID,
            title: GLOBAL_SOCIAL_GRAPH_ROW_TITLE,
            author: "Edu AI System",
            category: "__SYSTEM_CONFIG__",
            description: JSON.stringify(compactGraph),
            cover_image: "",
          },
          { onConflict: "id" }
        );
      } catch (_) {}
    })();

    // 3. Persist conversations, messages & deletedMessageIds backup in Postgres books __SYSTEM_CONFIG__ row
    const messagesDbWrite = (async () => {
      try {
        await client.from("books").upsert(
          {
            id: GLOBAL_SOCIAL_MESSAGES_ROW_ID,
            title: GLOBAL_SOCIAL_MESSAGES_ROW_TITLE,
            author: "Edu AI System",
            category: "__SYSTEM_CONFIG__",
            description: messagesBackupJson,
            cover_image: "",
          },
          { onConflict: "id" }
        );
      } catch (_) {}
    })();

    await Promise.allSettled([storageWrite, graphDbWrite, messagesDbWrite]);
  };

  cloudPersistChain = cloudPersistChain.then(runPersist, runPersist);
  return cloudPersistChain;
}

function scheduleCloudSocialSync(sb?: SupabaseClient | null): void {
  const client = sb || registeredSocialSb;
  if (!client) return;
  if (cloudSyncDebounceTimer) clearTimeout(cloudSyncDebounceTimer);
  cloudSyncDebounceTimer = setTimeout(() => {
    cloudSyncDebounceTimer = null;
    void persistSocialCloudState(client);
  }, 600);
}

export async function hydrateSocialCloudState(
  sb?: SupabaseClient | null,
  options?: { force?: boolean; minIntervalMs?: number }
): Promise<void> {
  const client = sb || registeredSocialSb;
  if (!client) return;
  if (sb) registeredSocialSb = sb;

  const minInterval = options?.minIntervalMs ?? 3000;
  if (!options?.force && Date.now() - lastCloudHydrateAt < minInterval) {
    return;
  }
  if (inFlightCloudHydrate) {
    return inFlightCloudHydrate;
  }

  inFlightCloudHydrate = (async () => {
    lastCloudHydrateAt = Date.now();
    try {
      const state = readDiskState();
      let changed = false;

      const [storageRes, graphDbRes, msgsDbRes] = await Promise.allSettled([
        client.storage.from(CLOUD_SOCIAL_BUCKET).download(CLOUD_SOCIAL_OBJECT_KEY),
        client
          .from("books")
          .select("description")
          .eq("id", GLOBAL_SOCIAL_GRAPH_ROW_ID)
          .maybeSingle(),
        client
          .from("books")
          .select("description")
          .eq("id", GLOBAL_SOCIAL_MESSAGES_ROW_ID)
          .maybeSingle(),
      ]);

      if (storageRes.status === "fulfilled") {
        const { data: blobData, error: dlErr } = storageRes.value;
        if (!dlErr && blobData) {
          try {
            const parsed = JSON.parse(await blobData.text());
            if (mergeCloudSnapshotIntoState(state, parsed)) {
              changed = true;
            }
          } catch (_) {}
        }
      }

      if (graphDbRes.status === "fulfilled") {
        const { data: rowData, error: rowErr } = graphDbRes.value;
        if (!rowErr && rowData?.description) {
          try {
            const parsed = JSON.parse(rowData.description);
            if (mergeCloudSnapshotIntoState(state, parsed)) {
              changed = true;
            }
          } catch (_) {}
        }
      }

      if (msgsDbRes.status === "fulfilled") {
        const { data: rowData, error: rowErr } = msgsDbRes.value;
        if (!rowErr && rowData?.description) {
          try {
            const parsed = JSON.parse(rowData.description);
            if (mergeCloudSnapshotIntoState(state, parsed)) {
              changed = true;
            }
          } catch (_) {}
        }
      }

      if (changed) {
        writeDiskState(state);
      }
    } catch (_) {
    } finally {
      inFlightCloudHydrate = null;
    }
  })();

  return inFlightCloudHydrate;
}

export function normalizeRole(rawRole: any, email?: string): SocialRole {
  const emailLower = String(email || "").trim().toLowerCase();
  if (emailLower === "eduai.platform@admin.com") {
    return "admin";
  }
  const val = String(rawRole || "").trim().toLowerCase();
  if (val === "admin" || val === "super_admin" || val === "superadmin") {
    return "admin";
  }
  if (val.includes("teach") || val.includes("educat") || val.includes("prof") || val.includes("faculty")) {
    return "teacher";
  }
  return "student";
}

export function parseSubjectsList(raw: any): string[] {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 12);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
}

function buildDirectConvId(userA: string, userB: string): string {
  const sorted = [userA, userB].sort();
  const hash = crypto.createHash("sha256").update(`${sorted[0]}::${sorted[1]}`).digest("hex").slice(0, 16);
  return `dm_${hash}`;
}

function cleanAvatarString(raw: any): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("unsplash.com") || trimmed.includes("photo-1534528741775-53994a69daeb")) {
    return "";
  }
  return trimmed;
}

function pickNonEmpty(...vals: any[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) {
      return v.trim();
    }
  }
  return "";
}

function isGenericName(name?: string): boolean {
  const clean = String(name || "").trim().toLowerCase();
  return !clean || clean === "edu ai scholar" || clean === "learner" || clean === "member";
}

function ensureDirectConversationInState(
  state: SocialStateDisk,
  userA: string,
  userB: string,
  createdAt?: string,
  updatedAt?: string
): SocialConversationRecord {
  const dmId = buildDirectConvId(userA, userB);
  const now = new Date().toISOString();
  if (!state.conversations[dmId]) {
    state.conversations[dmId] = {
      id: dmId,
      type: "direct",
      participants: [userA, userB],
      createdBy: userA,
      createdAt: createdAt || now,
      updatedAt: updatedAt || now,
    };
  } else {
    const participants = new Set(state.conversations[dmId].participants || []);
    participants.add(userA);
    participants.add(userB);
    state.conversations[dmId].participants = Array.from(participants);
  }
  if (!state.messages[dmId]) {
    state.messages[dmId] = [];
  }
  return state.conversations[dmId];
}

export function mapAuthUserToSocialProfile(authUser: any, existing?: SocialUserProfile): SocialUserProfile {
  const meta = authUser?.user_metadata && typeof authUser.user_metadata === "object" ? authUser.user_metadata : {};
  const email = pickNonEmpty(authUser?.email, meta.email, existing?.email);
  const phone = pickNonEmpty(authUser?.phone, meta.phone, existing?.phone);
  const role = normalizeRole(meta.role || existing?.role || "student", email);

  const composedName = pickNonEmpty(
    meta.full_name,
    meta.name,
    [meta.given_name, meta.family_name].filter(Boolean).join(" ").trim(),
    meta.preferred_username,
    meta.user_name,
    existing && !isGenericName(existing.name) ? existing.name : "",
    email ? email.split("@")[0] : "",
    phone
  );

  const fullName = composedName || "Edu AI Scholar";

  const avatar =
    cleanAvatarString(meta.avatar_url) ||
    cleanAvatarString(meta.picture) ||
    cleanAvatarString(existing?.avatar) ||
    "";

  const metaSubjects = parseSubjectsList(meta.subjects);
  const subjects =
    metaSubjects.length > 0
      ? metaSubjects
      : existing?.subjects?.length
      ? existing.subjects
      : ["Mathematics", "Sciences"];

  const defaultTitle =
    role === "admin"
      ? "Platform Administrator"
      : meta.field_of_study
      ? `${meta.field_of_study} Scholar`
      : meta.curriculum
      ? `${meta.curriculum} Learner`
      : role === "teacher"
      ? "Faculty Educator"
      : "Academic Student";

  return {
    id: authUser.id,
    name: fullName,
    email,
    phone: phone || undefined,
    avatar,
    role,
    title: pickNonEmpty(meta.title, existing?.title) || defaultTitle,
    institution:
      pickNonEmpty(meta.institution, existing?.institution) ||
      (meta.education_level ? `${meta.education_level} • Edu AI` : "Edu AI Learning Network"),
    subjects,
    bio:
      pickNonEmpty(meta.bio, existing?.bio) ||
      `Collaborating on ${subjects.slice(0, 2).join(" & ")} in Edu AI.`,
    location: pickNonEmpty(meta.location, meta.country, existing?.location),
    lastSeen: existing?.lastSeen || authUser?.last_sign_in_at || authUser?.created_at || new Date().toISOString(),
    updatedAt: existing?.updatedAt || authUser?.updated_at || authUser?.created_at || new Date().toISOString(),
  };
}

export async function syncUserProfileToStoreAndSupabase(
  authUser: any,
  sb?: SupabaseClient | null,
  patch?: Partial<SocialUserProfile>
): Promise<SocialUserProfile> {
  const state = readDiskState();
  const existing = state.users[authUser.id];
  const base = mapAuthUserToSocialProfile(authUser, existing);

  const patchAvatar = patch?.avatar !== undefined ? cleanAvatarString(patch.avatar) : "";
  const merged: SocialUserProfile = {
    ...base,
    ...patch,
    id: authUser.id,
    name: pickNonEmpty(patch?.name, base.name) || "Edu AI Scholar",
    email: pickNonEmpty(patch?.email, base.email),
    phone: pickNonEmpty(patch?.phone, base.phone) || undefined,
    avatar: patchAvatar || base.avatar,
    subjects: patch?.subjects && patch.subjects.length > 0 ? patch.subjects : base.subjects,
    role: patch?.role ? normalizeRole(patch.role, pickNonEmpty(patch?.email, base.email)) : base.role,
    lastSeen: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.users[authUser.id] = merged;
  writeDiskState(state);

  // Best-effort sync to Supabase public.profiles without failing if optional columns differ
  if (sb) {
    try {
      const { data: existingProf } = await sb
        .from("profiles")
        .select("*")
        .eq("id", merged.id)
        .maybeSingle();

      const existingRoleLower = String(existingProf?.role || authUser?.user_metadata?.role || "").trim().toLowerCase();
      const preservedRole =
        merged.email.toLowerCase() === "eduai.platform@admin.com"
          ? "admin"
          : existingRoleLower === "admin" || existingRoleLower === "parent"
          ? existingRoleLower
          : existingProf?.role || merged.role;

      const fullPayload: Record<string, any> = {
        id: merged.id,
        full_name: pickNonEmpty(patch?.name, existingProf?.full_name, merged.name),
        email: pickNonEmpty(merged.email, existingProf?.email) || null,
        avatar_url: pickNonEmpty(patchAvatar, merged.avatar, existingProf?.avatar_url) || null,
        role: preservedRole,
        title: pickNonEmpty(patch?.title, existingProf?.title, merged.title) || null,
        institution: pickNonEmpty(patch?.institution, existingProf?.institution, merged.institution) || null,
        subjects: pickNonEmpty(
          patch?.subjects?.join(", "),
          existingProf?.subjects,
          merged.subjects.join(", ")
        ) || null,
        bio: pickNonEmpty(patch?.bio, existingProf?.bio, merged.bio) || null,
        location: pickNonEmpty(patch?.location, existingProf?.location, merged.location) || null,
        updated_at: merged.updatedAt,
      };

      const { error: upsErr } = await sb.from("profiles").upsert(fullPayload, { onConflict: "id" });
      if (upsErr) {
        const minimalPayload: Record<string, any> = {
          id: merged.id,
          full_name: fullPayload.full_name,
          email: fullPayload.email,
          avatar_url: fullPayload.avatar_url,
          role: fullPayload.role,
          subjects: fullPayload.subjects,
          updated_at: merged.updatedAt,
        };
        await sb.from("profiles").upsert(minimalPayload, { onConflict: "id" });
      }
    } catch (_) {}
  }

  return merged;
}

function mergeUserSyncFilesIntoState(state: SocialStateDisk): boolean {
  let changed = false;
  try {
    if (!fs.existsSync(USER_SYNC_DIR)) return false;
    for (const fname of fs.readdirSync(USER_SYNC_DIR)) {
      if (!fname.endsWith(".json")) continue;
      const uid = fname.replace(/\.json$/, "");
      if (!uid || uid.length < 8) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(USER_SYNC_DIR, fname), "utf-8"));
        const snap = parsed?.profileSnapshot;
        if (!snap || typeof snap !== "object") continue;

        const targetId = typeof snap.id === "string" && snap.id.trim() ? snap.id.trim() : uid;
        const existing = state.users[targetId];
        const snapUpdatedAt = typeof snap.updated_at === "string" ? snap.updated_at : parsed.updatedAt || "";
        const email = pickNonEmpty(snap.email, existing?.email);
        const role = normalizeRole(snap.role || existing?.role || "student", email);
        const avatar = cleanAvatarString(snap.avatar_url) || cleanAvatarString(existing?.avatar);
        const subjects =
          parseSubjectsList(snap.subjects).length > 0
            ? parseSubjectsList(snap.subjects)
            : existing?.subjects || ["Mathematics", "Sciences"];
        const name = pickNonEmpty(snap.full_name, existing?.name, email ? email.split("@")[0] : "") || "Edu AI Scholar";

        if (
          !existing ||
          (isGenericName(existing.name) && !isGenericName(name)) ||
          (!existing.avatar && avatar) ||
          (!existing.email && email) ||
          (snapUpdatedAt && snapUpdatedAt > (existing.updatedAt || ""))
        ) {
          state.users[targetId] = {
            id: targetId,
            name,
            email,
            phone: pickNonEmpty(snap.phone, existing?.phone) || undefined,
            avatar,
            role,
            title:
              pickNonEmpty(snap.title, existing?.title) ||
              (snap.field_of_study
                ? `${snap.field_of_study} Scholar`
                : snap.curriculum
                ? `${snap.curriculum} Learner`
                : role === "admin"
                ? "Platform Administrator"
                : role === "teacher"
                ? "Faculty Educator"
                : "Academic Student"),
            institution:
              pickNonEmpty(snap.institution, existing?.institution) ||
              (snap.education_level ? `${snap.education_level} • Edu AI` : "Edu AI Learning Network"),
            subjects,
            bio: pickNonEmpty(snap.bio, existing?.bio) || `Collaborating on ${subjects.slice(0, 2).join(" & ")} in Edu AI.`,
            location: pickNonEmpty(snap.location, snap.country, existing?.location),
            lastSeen: existing?.lastSeen || snapUpdatedAt || new Date().toISOString(),
            updatedAt: snapUpdatedAt || existing?.updatedAt || new Date().toISOString(),
          };
          changed = true;
        }
      } catch (_) {}
    }
  } catch (_) {}
  return changed;
}

let lastBackfillAtMs = 0;

export async function backfillDirectoryProfilesToSupabase(
  sb: SupabaseClient,
  usersMap: Record<string, SocialUserProfile>,
  force = false
): Promise<void> {
  if (!sb || !sb.auth?.admin) return;
  const nowMs = Date.now();
  if (!force && nowMs - lastBackfillAtMs < 60_000) return;
  lastBackfillAtMs = nowMs;

  try {
    const entries = Object.values(usersMap).filter((u) => u?.id && u.id.length > 8);
    if (entries.length === 0) return;

    // Fetch existing profiles so we preserve any richer bio/subjects/institution already set in DB
    const existingById = new Map<string, any>();
    try {
      const { data: rows } = await sb.from("profiles").select("id, full_name, email, role, avatar_url").limit(500);
      if (Array.isArray(rows)) {
        for (const r of rows) {
          if (r?.id) existingById.set(r.id, r);
        }
      }
    } catch (_) {}

    const rowsToUpsert: any[] = [];
    for (const u of entries) {
      const ex = existingById.get(u.id);
      const missingRow = !ex;
      const missingFields =
        ex &&
        ((!ex.email && u.email) ||
          (isGenericName(ex.full_name) && !isGenericName(u.name)) ||
          (!ex.avatar_url && u.avatar));

      if (force || missingRow || missingFields) {
        rowsToUpsert.push({
          id: u.id,
          full_name: (!isGenericName(ex?.full_name) ? ex.full_name : u.name) || u.name,
          email: u.email || ex?.email || null,
          avatar_url: ex?.avatar_url || u.avatar || null,
          role: normalizeRole(ex?.role || u.role, u.email || ex?.email),
          title: u.title || null,
          institution: u.institution || null,
          subjects: Array.isArray(u.subjects) ? u.subjects.join(", ") : null,
          bio: u.bio || null,
          location: u.location || null,
          updated_at: u.updatedAt || new Date().toISOString(),
        });
      }
    }

    if (rowsToUpsert.length > 0) {
      const { error } = await sb.from("profiles").upsert(rowsToUpsert, { onConflict: "id" });
      if (error) {
        // Retry with minimal core columns if optional columns don't exist in older DB schema
        const minimalRows = rowsToUpsert.map((r) => ({
          id: r.id,
          full_name: r.full_name,
          email: r.email,
          avatar_url: r.avatar_url,
          role: r.role,
          subjects: r.subjects,
          updated_at: r.updated_at,
        }));
        await sb.from("profiles").upsert(minimalRows, { onConflict: "id" });
      }
    }
  } catch (err) {
    console.warn("[SocialStore] backfillDirectoryProfilesToSupabase notice:", err);
  }
}

export async function hydrateDirectoryFromSupabase(
  sb?: SupabaseClient | null,
  options?: { backfillProfiles?: boolean }
): Promise<void> {
  const state = readDiskState();
  let changed = mergeUserSyncFilesIntoState(state);

  if (!sb) {
    if (changed) writeDiskState(state);
    return;
  }

  // 1. Hydrate ALL registered users from Supabase Auth admin directory if service role is active
  try {
    if (sb.auth?.admin && typeof sb.auth.admin.listUsers === "function") {
      for (let page = 1; page <= 10; page++) {
        const { data: usersPage, error: listErr } = await sb.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) {
          console.warn("[SocialStore] auth.admin.listUsers warning:", listErr.message);
          break;
        }
        const batch = usersPage?.users || [];
        for (const authUser of batch) {
          if (!authUser?.id) continue;
          const existing = state.users[authUser.id];
          const mapped = mapAuthUserToSocialProfile(authUser, existing);
          if (
            !existing ||
            (isGenericName(existing.name) && !isGenericName(mapped.name)) ||
            (!existing.email && mapped.email) ||
            (!existing.avatar && mapped.avatar) ||
            existing.role !== mapped.role
          ) {
            state.users[authUser.id] = {
              ...mapped,
              // Keep richer existing profile fields unless auth user has newer non-generic data
              name: !isGenericName(existing?.name) ? existing!.name : mapped.name,
              avatar: existing?.avatar || mapped.avatar,
              title: existing?.title || mapped.title,
              institution: existing?.institution || mapped.institution,
              subjects: existing?.subjects?.length ? existing.subjects : mapped.subjects,
              bio: existing?.bio || mapped.bio,
              location: existing?.location || mapped.location,
            };
            changed = true;
          }
        }
        if (batch.length < 200) break;
      }
    }
  } catch (err) {
    console.warn("[SocialStore] auth.admin.listUsers notice:", err);
  }

  // 2. Hydrate public.profiles rows with schema-tolerant select("*") fallback
  try {
    let rows: any[] | null = null;
    const { data: richRows, error: richErr } = await sb
      .from("profiles")
      .select("id, full_name, email, avatar_url, role, title, institution, subjects, bio, location, education_level, field_of_study, curriculum, updated_at")
      .limit(500);

    if (!richErr && Array.isArray(richRows)) {
      rows = richRows;
    } else {
      if (richErr) {
        console.warn("[SocialStore] profiles rich select fallback triggered:", richErr.message);
      }
      const { data: starRows, error: starErr } = await sb.from("profiles").select("*").limit(500);
      if (!starErr && Array.isArray(starRows)) {
        rows = starRows;
      }
    }

    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (!row?.id) continue;
        const existing = state.users[row.id];
        const subjects = parseSubjectsList(row.subjects);
        const safeAvatar = cleanAvatarString(row.avatar_url) || cleanAvatarString(existing?.avatar);
        const rowEmail = pickNonEmpty(row.email, existing?.email);
        const rowRole = normalizeRole(row.role || existing?.role || "student", rowEmail);
        const rowName = pickNonEmpty(row.full_name, row.username, existing?.name, rowEmail ? rowEmail.split("@")[0] : "");
        const rowUpdatedAt = row.updated_at || "";

        const shouldUpdate =
          !existing ||
          (rowUpdatedAt && rowUpdatedAt > (existing.updatedAt || "")) ||
          (isGenericName(existing.name) && !isGenericName(rowName)) ||
          (!existing.avatar && Boolean(safeAvatar)) ||
          (!existing.email && Boolean(rowEmail)) ||
          existing.role !== rowRole;

        if (shouldUpdate) {
          const fallbackTitle =
            rowRole === "admin"
              ? "Platform Administrator"
              : row.field_of_study
              ? `${row.field_of_study} Scholar`
              : row.curriculum
              ? `${row.curriculum} Learner`
              : rowRole === "teacher"
              ? "Faculty Educator"
              : "Academic Member";

          state.users[row.id] = {
            id: row.id,
            name: (!isGenericName(rowName) ? rowName : existing?.name) || rowName || "Edu AI Scholar",
            email: rowEmail,
            phone: pickNonEmpty(row.phone, existing?.phone) || undefined,
            avatar: safeAvatar,
            role: rowRole,
            title: pickNonEmpty(row.title, existing?.title) || fallbackTitle,
            institution:
              pickNonEmpty(row.institution, existing?.institution) ||
              (row.education_level ? `${row.education_level} • Edu AI` : "Edu AI Network"),
            subjects: subjects.length > 0 ? subjects : existing?.subjects || ["General Studies"],
            bio: pickNonEmpty(row.bio, existing?.bio) || "Active Edu AI learner.",
            location: pickNonEmpty(row.location, row.country, existing?.location),
            lastSeen: rowUpdatedAt || existing?.lastSeen || new Date().toISOString(),
            updatedAt: rowUpdatedAt || existing?.updatedAt || new Date().toISOString(),
          };
          changed = true;
        }
      }
    }
  } catch (err) {
    console.warn("[SocialStore] hydrateDirectoryFromSupabase profiles warning:", err);
  }

  if (changed) {
    writeDiskState(state);
  }

  if (options?.backfillProfiles || changed) {
    await backfillDirectoryProfilesToSupabase(sb, state.users, Boolean(options?.backfillProfiles));
  }
}

export async function hydrateFriendRequestsFromSupabase(
  userId: string,
  sb?: SupabaseClient | null,
  options?: { forceCloudRead?: boolean }
): Promise<void> {
  const client = sb || registeredSocialSb;
  if (!client || !userId) return;
  if (sb) registeredSocialSb = sb;

  // Always hydrate durable Supabase cloud snapshot first (Storage + system config row)
  await hydrateSocialCloudState(client, { force: options?.forceCloudRead });

  if (!canQueryFriendRequestsTable()) return;

  try {
    let data: any[] | null = null;
    const { data: richData, error: richErr } = await client
      .from("friend_requests")
      .select("id, sender_id, receiver_id, status, note, created_at, updated_at")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (!richErr && Array.isArray(richData)) {
      friendRequestsTableAvailable = true;
      data = richData;
    } else if (richErr && isMissingFriendRequestsTableError(richErr)) {
      markFriendRequestsTableUnavailable();
      return;
    } else {
      const { data: minData, error: minErr } = await client
        .from("friend_requests")
        .select("*")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
      if (!minErr && Array.isArray(minData)) {
        friendRequestsTableAvailable = true;
        data = minData;
      } else if (minErr && isMissingFriendRequestsTableError(minErr)) {
        markFriendRequestsTableUnavailable();
        return;
      }
    }

    if (!Array.isArray(data)) return;
    const state = readDiskState();
    let changed = false;

    for (const row of data) {
      if (!row?.sender_id || !row?.receiver_id) continue;
      const pairKey = buildFriendPairKey(row.sender_id, row.receiver_id);
      const delMs = safeTimestampMs(state.removedFriendPairs?.[pairKey]);
      const status: FriendRequestRecord["status"] =
        row.status === "accepted" || row.status === "declined" ? row.status : "pending";
      const rowUpdatedAt = row.updated_at || row.created_at || new Date().toISOString();
      const rowUpdatedMs = rowUpdatedAt ? Date.parse(rowUpdatedAt) : 0;
      if (delMs && rowUpdatedMs <= delMs) continue;

      const existing = state.friendRequests.find(
        (fr) =>
          (fr.senderId === row.sender_id && fr.receiverId === row.receiver_id) ||
          (fr.senderId === row.receiver_id && fr.receiverId === row.sender_id)
      );

      const existingUpdatedMs = existing?.updatedAt ? Date.parse(existing.updatedAt) : 0;

      if (!existing) {
        state.friendRequests.push({
          id: row.id || `fr_${crypto.randomUUID()}`,
          senderId: row.sender_id,
          receiverId: row.receiver_id,
          status,
          note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : undefined,
          createdAt: row.created_at || rowUpdatedAt,
          updatedAt: rowUpdatedAt,
        });
        changed = true;
      } else if (
        (status === "accepted" && existing.status !== "accepted") ||
        (!Number.isNaN(rowUpdatedMs) && !Number.isNaN(existingUpdatedMs) && rowUpdatedMs > existingUpdatedMs)
      ) {
        existing.senderId = row.sender_id;
        existing.receiverId = row.receiver_id;
        existing.status = status;
        if (typeof row.note === "string" && row.note.trim()) {
          existing.note = row.note.trim();
        }
        existing.updatedAt = rowUpdatedAt;
        changed = true;
      }

      if (status === "accepted") {
        const before = Boolean(state.conversations[buildDirectConvId(row.sender_id, row.receiver_id)]);
        ensureDirectConversationInState(state, row.sender_id, row.receiver_id, row.created_at, rowUpdatedAt);
        if (!before) changed = true;
      }
    }

    if (changed) {
      writeDiskState(state);
    }
  } catch (err) {
    if (isMissingFriendRequestsTableError(err)) {
      markFriendRequestsTableUnavailable();
    } else {
      console.warn("[SocialStore] hydrateFriendRequestsFromSupabase warning:", err);
    }
  }
}

let lastFriendReqBackfillAt = 0;

export async function backfillFriendRequestsToSupabase(
  sb?: SupabaseClient | null,
  force = false
): Promise<void> {
  const client = sb || registeredSocialSb;
  if (!client) return;
  if (sb) registeredSocialSb = sb;

  const nowMs = Date.now();
  if (!force && nowMs - lastFriendReqBackfillAt < 60_000) return;
  lastFriendReqBackfillAt = nowMs;

  try {
    await hydrateSocialCloudState(client, { force });
    const state = readDiskState();
    if (state.friendRequests.length > 0 || Object.keys(state.conversations).length > 0) {
      await persistSocialCloudState(client, state);
    }

    if (!state.friendRequests.length || !canQueryFriendRequestsTable()) return;

    const { data: existingRows, error: fetchErr } = await client
      .from("friend_requests")
      .select("sender_id, receiver_id, status");

    if (fetchErr) {
      if (isMissingFriendRequestsTableError(fetchErr)) {
        markFriendRequestsTableUnavailable();
        return;
      }
      console.warn("[SocialStore] backfillFriendRequestsToSupabase read warning:", fetchErr.message);
    } else {
      friendRequestsTableAvailable = true;
    }

    const existingPairs = new Set<string>();
    if (Array.isArray(existingRows)) {
      for (const r of existingRows) {
        if (r?.sender_id && r?.receiver_id) {
          existingPairs.add(`${r.sender_id}:${r.receiver_id}`);
          existingPairs.add(`${r.receiver_id}:${r.sender_id}`);
        }
      }
    }

    for (const fr of state.friendRequests) {
      if (!fr.senderId || !fr.receiverId || fr.status === "declined") continue;
      if (existingPairs.has(`${fr.senderId}:${fr.receiverId}`)) continue;
      if (!canQueryFriendRequestsTable()) break;
      await upsertFriendRequestInSupabase(client, {
        senderId: fr.senderId,
        receiverId: fr.receiverId,
        status: fr.status,
        note: fr.note,
        updatedAt: fr.updatedAt || fr.createdAt || new Date().toISOString(),
      });
    }
  } catch (err) {
    if (isMissingFriendRequestsTableError(err)) {
      markFriendRequestsTableUnavailable();
    } else {
      console.warn("[SocialStore] backfillFriendRequestsToSupabase warning:", err);
    }
  }
}

export function getFriendRelationStatus(
  state: SocialStateDisk,
  viewerId: string,
  targetId: string
): FriendRelationStatus {
  if (!viewerId || !targetId || viewerId === targetId) return "none";

  const matches = state.friendRequests.filter(
    (fr) =>
      fr.status !== "declined" &&
      ((fr.senderId === viewerId && fr.receiverId === targetId) ||
        (fr.senderId === targetId && fr.receiverId === viewerId))
  );

  if (matches.length === 0) return "none";
  const accepted = matches.find((m) => m.status === "accepted");
  if (accepted) return "friends";
  const pending = matches.find((m) => m.status === "pending");
  if (!pending) return "none";
  if (pending.senderId === viewerId) return "pending_sent";
  return "pending_received";
}

export function matchesDirectorySearchQuery(user: {
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
  institution?: string;
  location?: string;
  bio?: string;
  subjects?: string[];
  role?: string;
}, query: string): boolean {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const emailVal = String(user.email || "").toLowerCase();
  const emailHandle = emailVal.includes("@") ? emailVal.split("@")[0] : "";
  const hay = [
    user.name || "",
    emailVal,
    emailHandle,
    user.phone || "",
    user.title || "",
    user.institution || "",
    user.location || "",
    user.bio || "",
    user.role || "",
    user.role === "teacher" ? "educator faculty" : user.role === "admin" ? "admin administrator" : "student scholar",
    Array.isArray(user.subjects) ? user.subjects.join(" ") : "",
  ]
    .join(" ")
    .toLowerCase();

  if (hay.includes(q)) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((tok) => hay.includes(tok));
}

export function formatDirectoryUserForViewer(
  user: SocialUserProfile,
  viewerId: string,
  state: SocialStateDisk,
  onlineUserIds: Set<string>
) {
  const isOnline = onlineUserIds.has(user.id);
  const friendStatus = getFriendRelationStatus(state, viewerId, user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    avatar: user.avatar,
    role: user.role,
    title: user.title,
    institution: user.institution,
    status: isOnline ? ("online" as const) : ("offline" as const),
    lastSeen: isOnline ? "Active now" : formatRelativeTime(user.lastSeen),
    subjects: user.subjects,
    friendStatus,
    bio: user.bio,
    location: user.location || "",
  };
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "Recently";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "Recently";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function getBootstrapDataForUser(viewerId: string, onlineUserIds: Set<string>) {
  const state = readDiskState();

  // Auto-ensure direct conversations exist for every accepted friend pair
  let stateDirty = false;
  for (const fr of state.friendRequests) {
    if (fr.status === "accepted" && (fr.senderId === viewerId || fr.receiverId === viewerId)) {
      const dmId = buildDirectConvId(fr.senderId, fr.receiverId);
      if (!state.conversations[dmId]) {
        ensureDirectConversationInState(state, fr.senderId, fr.receiverId, fr.createdAt, fr.updatedAt);
        stateDirty = true;
      }
    }
  }
  if (stateDirty) {
    writeDiskState(state);
  }

  const users = Object.values(state.users).map((u) =>
    formatDirectoryUserForViewer(u, viewerId, state, onlineUserIds)
  );

  const relevantRequests = state.friendRequests.filter(
    (fr) => fr.senderId === viewerId || fr.receiverId === viewerId
  );

  const conversations: any[] = [];
  const messagesByConv: Record<string, any[]> = {};

  const deletedSet = state.deletedMessageIds || {};
  for (const conv of Object.values(state.conversations)) {
    if (!conv.participants.includes(viewerId)) continue;
    const convMsgs = (state.messages[conv.id] || [])
      .filter((m) => m?.id && !deletedSet[m.id])
      .map((m) => ({
        id: m.id,
        clientMessageId: m.clientMessageId,
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderName: m.senderName,
        senderRole: m.senderRole,
        senderAvatar: state.users[m.senderId]?.avatar || m.senderAvatar || "",
        content: m.content,
        createdAt: m.createdAt,
        status: m.status,
        seenAt: m.seenAt,
        reactions: m.reactions || {},
        attachment: m.attachment,
        replyTo: m.replyTo,
      }));

    const unreadCount = state.unreadCounts[conv.id]?.[viewerId] || 0;
    const lastMessage = convMsgs.length > 0 ? convMsgs[convMsgs.length - 1] : undefined;

    conversations.push({
      id: conv.id,
      type: conv.type,
      participants: conv.participants,
      name: conv.name,
      description: conv.description,
      groupRoleType: conv.groupRoleType,
      lastMessage,
      unreadCount,
      updatedAt: lastMessage?.createdAt || conv.updatedAt,
    });
    messagesByConv[conv.id] = convMsgs;
  }

  conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const currentUser =
    users.find((u) => u.id === viewerId) || {
      id: viewerId,
      name: "Edu AI Scholar",
      email: "",
      avatar: "",
      role: "student" as const,
      title: "Academic Scholar",
      institution: "Edu AI Network",
      status: "online" as const,
      lastSeen: "Active now",
      subjects: ["General Studies"],
      friendStatus: "none" as const,
      bio: "",
    };

  return {
    currentUser,
    users,
    friendRequests: relevantRequests,
    conversations,
    messagesByConv,
    deletedMessageIds: state.deletedMessageIds || {},
    onlineUserIds: Array.from(onlineUserIds),
  };
}

async function upsertFriendRequestInSupabase(
  sb: SupabaseClient | null | undefined,
  record: { senderId: string; receiverId: string; status: string; note?: string; updatedAt: string }
): Promise<boolean> {
  if (!sb || !canQueryFriendRequestsTable()) return false;
  try {
    const withNote: Record<string, any> = {
      sender_id: record.senderId,
      receiver_id: record.receiverId,
      status: record.status,
      updated_at: record.updatedAt,
    };
    if (record.note) {
      withNote.note = record.note;
    }

    const { error } = await sb
      .from("friend_requests")
      .upsert(withNote, { onConflict: "sender_id,receiver_id" });

    if (!error) {
      friendRequestsTableAvailable = true;
      return true;
    }

    if (isMissingFriendRequestsTableError(error)) {
      markFriendRequestsTableUnavailable();
      return false;
    }

    console.warn("[SocialStore] upsertFriendRequestInSupabase primary error:", error.message);

    // Fallback 1: omit optional note in case table schema lacks note
    if (record.note) {
      const { error: noNoteErr } = await sb
        .from("friend_requests")
        .upsert(
          {
            sender_id: record.senderId,
            receiver_id: record.receiverId,
            status: record.status,
            updated_at: record.updatedAt,
          },
          { onConflict: "sender_id,receiver_id" }
        );
      if (!noNoteErr) {
        friendRequestsTableAvailable = true;
        return true;
      }
      if (isMissingFriendRequestsTableError(noNoteErr)) {
        markFriendRequestsTableUnavailable();
        return false;
      }
    }

    // Fallback 2: SELECT -> UPDATE / INSERT (works even without UNIQUE (sender_id, receiver_id))
    const { data: existingRow, error: selErr } = await sb
      .from("friend_requests")
      .select("id")
      .eq("sender_id", record.senderId)
      .eq("receiver_id", record.receiverId)
      .maybeSingle();

    if (selErr && isMissingFriendRequestsTableError(selErr)) {
      markFriendRequestsTableUnavailable();
      return false;
    }

    if (existingRow?.id) {
      const { error: updErr } = await sb
        .from("friend_requests")
        .update({
          status: record.status,
          updated_at: record.updatedAt,
          ...(record.note ? { note: record.note } : {}),
        })
        .eq("id", existingRow.id);
      if (!updErr) {
        friendRequestsTableAvailable = true;
        return true;
      }

      const { error: minUpdErr } = await sb
        .from("friend_requests")
        .update({ status: record.status })
        .eq("id", existingRow.id);
      if (!minUpdErr) {
        friendRequestsTableAvailable = true;
        return true;
      }
      return false;
    }

    const { error: insErr } = await sb.from("friend_requests").insert(withNote);
    if (!insErr) {
      friendRequestsTableAvailable = true;
      return true;
    }
    if (isMissingFriendRequestsTableError(insErr)) {
      markFriendRequestsTableUnavailable();
      return false;
    }

    const { error: minInsErr } = await sb.from("friend_requests").insert({
      sender_id: record.senderId,
      receiver_id: record.receiverId,
      status: record.status,
    });
    if (minInsErr) {
      if (isMissingFriendRequestsTableError(minInsErr)) {
        markFriendRequestsTableUnavailable();
      } else {
        console.warn("[SocialStore] upsertFriendRequestInSupabase insert fallback failed:", minInsErr.message);
      }
      return false;
    }
    friendRequestsTableAvailable = true;
    return true;
  } catch (err) {
    if (isMissingFriendRequestsTableError(err)) {
      markFriendRequestsTableUnavailable();
    } else {
      console.warn("[SocialStore] upsertFriendRequestInSupabase exception:", err);
    }
    return false;
  }
}

export async function sendFriendRequestAction(
  senderId: string,
  receiverId: string,
  note: string | undefined,
  sb?: SupabaseClient | null
): Promise<{ ok: boolean; status: "pending" | "accepted"; request: FriendRequestRecord; conversation?: any; error?: string }> {
  if (!senderId || !receiverId || senderId === receiverId) {
    return { ok: false, status: "pending", request: null as any, error: "Invalid recipient." };
  }
  const client = sb || registeredSocialSb;
  if (sb) registeredSocialSb = sb;

  let state = readDiskState();
  if (!state.users[receiverId]) {
    await hydrateDirectoryFromSupabase(client);
    state = readDiskState();
  }
  if (!state.users[receiverId] && client) {
    try {
      const { data: singleProf } = await client
        .from("profiles")
        .select("*")
        .eq("id", receiverId)
        .maybeSingle();
      if (singleProf?.id) {
        state.users[singleProf.id] = {
          id: singleProf.id,
          name: pickNonEmpty(singleProf.full_name, singleProf.username, singleProf.email?.split("@")?.[0]) || "Edu AI Scholar",
          email: pickNonEmpty(singleProf.email),
          avatar: cleanAvatarString(singleProf.avatar_url),
          role: normalizeRole(singleProf.role || "student", singleProf.email),
          title: pickNonEmpty(singleProf.title) || "Academic Member",
          institution: pickNonEmpty(singleProf.institution) || "Edu AI Network",
          subjects: parseSubjectsList(singleProf.subjects),
          bio: pickNonEmpty(singleProf.bio) || "Active Edu AI learner.",
          location: pickNonEmpty(singleProf.location, singleProf.country),
          lastSeen: singleProf.updated_at || new Date().toISOString(),
          updatedAt: singleProf.updated_at || new Date().toISOString(),
        };
        writeDiskState(state);
      }
    } catch (_) {}
  }

  await hydrateFriendRequestsFromSupabase(senderId, client, { forceCloudRead: true });
  state = readDiskState();

  if (!state.users[receiverId]) {
    return { ok: false, status: "pending", request: null as any, error: "User not found." };
  }

  // Clear deletion marker for this pair if previously removed
  const pairKey = buildFriendPairKey(senderId, receiverId);
  if (state.removedFriendPairs?.[pairKey]) {
    delete state.removedFriendPairs[pairKey];
  }

  // Check if reverse request already pending — if so, auto-accept!
  const reverse = state.friendRequests.find(
    (fr) => fr.senderId === receiverId && fr.receiverId === senderId && fr.status === "pending"
  );
  if (reverse) {
    const res = await respondToFriendRequestAction(senderId, receiverId, "accept", client);
    return {
      ok: res.ok,
      status: "accepted",
      request: res.request!,
      conversation: res.conversation,
    };
  }

  const existing = state.friendRequests.find(
    (fr) =>
      (fr.senderId === senderId && fr.receiverId === receiverId) ||
      (fr.senderId === receiverId && fr.receiverId === senderId)
  );

  const now = new Date().toISOString();
  let request: FriendRequestRecord;
  if (existing) {
    if (existing.status === "accepted") {
      const conv = ensureDirectConversationInState(state, existing.senderId, existing.receiverId, existing.createdAt, existing.updatedAt);
      writeDiskState(state);
      await persistSocialCloudState(client, state);
      return {
        ok: true,
        status: "accepted",
        request: existing,
        conversation: {
          ...conv,
          unreadCount: state.unreadCounts[conv.id]?.[senderId] || 0,
          lastMessage: (state.messages[conv.id] || []).slice(-1)[0],
        },
      };
    }
    existing.senderId = senderId;
    existing.receiverId = receiverId;
    existing.status = "pending";
    existing.note = note?.trim() || existing.note;
    existing.updatedAt = now;
    request = existing;
  } else {
    request = {
      id: `fr_${crypto.randomUUID()}`,
      senderId,
      receiverId,
      status: "pending",
      note: note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    state.friendRequests.push(request);
  }

  writeDiskState(state);

  await Promise.all([
    persistSocialCloudState(client, state),
    upsertFriendRequestInSupabase(client, {
      senderId,
      receiverId,
      status: "pending",
      note: request.note,
      updatedAt: now,
    }),
  ]);

  return { ok: true, status: "pending", request };
}

export async function respondToFriendRequestAction(
  responderId: string,
  senderId: string,
  action: "accept" | "decline",
  sb?: SupabaseClient | null
): Promise<{ ok: boolean; request?: FriendRequestRecord; conversation?: any; error?: string }> {
  const client = sb || registeredSocialSb;
  if (sb) registeredSocialSb = sb;

  await hydrateFriendRequestsFromSupabase(responderId, client, { forceCloudRead: true });
  let state = readDiskState();

  let reqRecord =
    state.friendRequests.find(
      (fr) => fr.senderId === senderId && fr.receiverId === responderId && fr.status === "pending"
    ) ||
    state.friendRequests.find(
      (fr) => fr.senderId === senderId && fr.receiverId === responderId
    );

  if (!reqRecord) {
    return { ok: false, error: "Incoming friend request not found." };
  }

  const now = new Date().toISOString();
  reqRecord.status = action === "accept" ? "accepted" : "declined";
  reqRecord.updatedAt = now;

  const pairKey = buildFriendPairKey(reqRecord.senderId, reqRecord.receiverId);
  if (action === "accept" && state.removedFriendPairs?.[pairKey]) {
    delete state.removedFriendPairs[pairKey];
  }

  let conversation: any = undefined;
  if (action === "accept") {
    const conv = ensureDirectConversationInState(state, reqRecord.senderId, reqRecord.receiverId, now, now);
    conversation = {
      ...conv,
      unreadCount: state.unreadCounts[conv.id]?.[responderId] || 0,
      lastMessage: (state.messages[conv.id] || []).slice(-1)[0],
    };
  }

  writeDiskState(state);

  await Promise.all([
    persistSocialCloudState(client, state),
    upsertFriendRequestInSupabase(client, {
      senderId: reqRecord.senderId,
      receiverId: reqRecord.receiverId,
      status: reqRecord.status,
      note: reqRecord.note,
      updatedAt: now,
    }),
  ]);

  return { ok: true, request: reqRecord, conversation };
}

export async function removeFriendshipAction(
  actorId: string,
  targetId: string,
  sb?: SupabaseClient | null
): Promise<{ ok: boolean }> {
  const client = sb || registeredSocialSb;
  if (sb) registeredSocialSb = sb;

  await hydrateSocialCloudState(client, { force: true });
  const state = readDiskState();
  const pairKey = buildFriendPairKey(actorId, targetId);
  if (!state.removedFriendPairs) state.removedFriendPairs = {};
  state.removedFriendPairs[pairKey] = new Date().toISOString();
  state.friendRequests = state.friendRequests.filter(
    (fr) =>
      !(
        (fr.senderId === actorId && fr.receiverId === targetId) ||
        (fr.senderId === targetId && fr.receiverId === actorId)
      )
  );
  writeDiskState(state);

  await persistSocialCloudState(client, state);

  if (client && canQueryFriendRequestsTable()) {
    try {
      const { error: delErr } = await client
        .from("friend_requests")
        .delete()
        .or(`and(sender_id.eq.${actorId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${actorId})`);
      if (delErr && isMissingFriendRequestsTableError(delErr)) {
        markFriendRequestsTableUnavailable();
      }
    } catch (_) {}
  }

  return { ok: true };
}

export function openOrCreateDirectConversation(
  requesterId: string,
  partnerId: string
): { ok: boolean; conversation?: any; messages?: any[]; error?: string } {
  const state = readDiskState();
  if (!state.users[partnerId]) {
    return { ok: false, error: "Recipient profile not found." };
  }
  const rel = getFriendRelationStatus(state, requesterId, partnerId);
  if (rel !== "friends") {
    return { ok: false, error: "Friend connection must be accepted before direct messaging." };
  }

  const dmId = buildDirectConvId(requesterId, partnerId);
  const hadConv = Boolean(state.conversations[dmId]);
  const conv = ensureDirectConversationInState(state, requesterId, partnerId);
  if (!hadConv) {
    writeDiskState(state);
    scheduleCloudSocialSync();
  }

  const msgs = state.messages[dmId] || [];
  return {
    ok: true,
    conversation: {
      ...conv,
      unreadCount: state.unreadCounts[dmId]?.[requesterId] || 0,
      lastMessage: msgs.slice(-1)[0],
    },
    messages: msgs,
  };
}

export function createGroupConversationAction(
  creatorId: string,
  params: {
    name: string;
    description?: string;
    participantIds: string[];
    groupRoleType?: "teacher-to-teacher" | "teacher-to-student" | "student-to-student" | "study-group";
    subjectTag?: string;
  }
): { ok: boolean; conversation?: any; error?: string } {
  const cleanName = String(params.name || "").trim();
  if (!cleanName) {
    return { ok: false, error: "Group name is required." };
  }

  const state = readDiskState();
  const uniqueMembers = Array.from(
    new Set([creatorId, ...(Array.isArray(params.participantIds) ? params.participantIds : [])])
  ).filter((uid) => Boolean(state.users[uid]));

  if (uniqueMembers.length < 2) {
    return { ok: false, error: "Select at least one classmate or educator to create a study group." };
  }

  const now = new Date().toISOString();
  const convId = `grp_${crypto.randomUUID()}`;
  const creator = state.users[creatorId];

  const newConv: SocialConversationRecord = {
    id: convId,
    type: "group",
    participants: uniqueMembers,
    name: cleanName,
    description: params.description?.trim() || `${params.subjectTag ? `${params.subjectTag} • ` : ""}Collaborative study group`,
    groupRoleType: params.groupRoleType || "study-group",
    subjectTag: params.subjectTag?.trim() || undefined,
    createdBy: creatorId,
    createdAt: now,
    updatedAt: now,
  };

  state.conversations[convId] = newConv;
  state.messages[convId] = [
    {
      id: `msg_${crypto.randomUUID()}`,
      conversationId: convId,
      senderId: creatorId,
      senderName: creator?.name || "Member",
      senderRole: creator?.role || "student",
      senderAvatar: creator?.avatar || "",
      content: `Created study group "${cleanName}"${params.description?.trim() ? ` — ${params.description.trim()}` : ""}.`,
      createdAt: now,
      status: "delivered",
      readBy: [creatorId],
      reactions: {},
    },
  ];

  state.unreadCounts[convId] = {};
  for (const uid of uniqueMembers) {
    state.unreadCounts[convId][uid] = uid === creatorId ? 0 : 1;
  }

  writeDiskState(state);
  scheduleCloudSocialSync();

  return {
    ok: true,
    conversation: {
      ...newConv,
      unreadCount: 0,
      lastMessage: state.messages[convId][0],
    },
  };
}

export function addGroupMemberAction(
  requesterId: string,
  conversationId: string,
  memberId: string
): { ok: boolean; conversation?: any; error?: string } {
  const state = readDiskState();
  const conv = state.conversations[conversationId];
  if (!conv || conv.type !== "group") {
    return { ok: false, error: "Group conversation not found." };
  }
  if (!conv.participants.includes(requesterId)) {
    return { ok: false, error: "Only group members can add peers." };
  }
  if (!state.users[memberId]) {
    return { ok: false, error: "Member not found." };
  }
  if (!conv.participants.includes(memberId)) {
    conv.participants.push(memberId);
    conv.updatedAt = new Date().toISOString();
    writeDiskState(state);
    scheduleCloudSocialSync();
  }
  return {
    ok: true,
    conversation: {
      ...conv,
      lastMessage: (state.messages[conversationId] || []).slice(-1)[0],
    },
  };
}

export function getConversationIfParticipant(
  conversationId: string,
  userId: string
): SocialConversationRecord | null {
  const state = readDiskState();
  const conv = state.conversations[conversationId];
  if (!conv || !conv.participants.includes(userId)) return null;
  return conv;
}

export function getMessagesForConversation(
  conversationId: string,
  viewerId: string
): { ok: boolean; messages?: any[]; deletedMessageIds?: Record<string, string>; error?: string } {
  const state = readDiskState();
  const conv = state.conversations[conversationId];
  if (!conv || !conv.participants.includes(viewerId)) {
    return { ok: false, error: "Conversation not found or access denied." };
  }
  const deletedSet = state.deletedMessageIds || {};
  return {
    ok: true,
    messages: (state.messages[conversationId] || []).filter((m) => m?.id && !deletedSet[m.id]),
    deletedMessageIds: deletedSet,
  };
}

export function sendChatMessageAction(
  senderId: string,
  params: {
    conversationId: string;
    clientMessageId?: string;
    content: string;
    attachment?: any;
    replyTo?: any;
  },
  onlineUserIds: Set<string>
): { ok: boolean; message?: SocialMessageRecord; participants?: string[]; deduplicated?: boolean; error?: string } {
  const state = readDiskState();
  const conv = state.conversations[params.conversationId];
  if (!conv || !conv.participants.includes(senderId)) {
    return { ok: false, error: "Conversation not found or access denied." };
  }

  if (conv.type === "direct") {
    const partnerId = conv.participants.find((id) => id !== senderId);
    if (partnerId && getFriendRelationStatus(state, senderId, partnerId) !== "friends") {
      return { ok: false, error: "You can only message accepted connections." };
    }
  }

  const list = state.messages[conv.id] || [];
  if (params.clientMessageId) {
    const existing = list.find((m) => m.clientMessageId === params.clientMessageId && m.senderId === senderId);
    if (existing) {
      return { ok: true, message: existing, participants: conv.participants, deduplicated: true };
    }
  }

  const cleanContent = String(params.content || "").trim();
  if (!cleanContent && !params.attachment) {
    return { ok: false, error: "Message cannot be empty." };
  }

  const senderProfile = state.users[senderId];
  const anyRecipientOnline = conv.participants.some((uid) => uid !== senderId && onlineUserIds.has(uid));
  const now = new Date().toISOString();

  const msg: SocialMessageRecord = {
    id: `msg_${crypto.randomUUID()}`,
    clientMessageId: params.clientMessageId,
    conversationId: conv.id,
    senderId,
    senderName: senderProfile?.name || "Edu AI Scholar",
    senderRole: senderProfile?.role || "student",
    senderAvatar: senderProfile?.avatar || "",
    content: cleanContent,
    createdAt: now,
    status: anyRecipientOnline ? "delivered" : "sent",
    readBy: [senderId],
    reactions: {},
    attachment: params.attachment || undefined,
    replyTo: params.replyTo || undefined,
  };

  if (!state.messages[conv.id]) state.messages[conv.id] = [];
  state.messages[conv.id].push(msg);
  conv.updatedAt = now;

  if (!state.unreadCounts[conv.id]) state.unreadCounts[conv.id] = {};
  for (const uid of conv.participants) {
    if (uid === senderId) {
      state.unreadCounts[conv.id][uid] = 0;
    } else {
      state.unreadCounts[conv.id][uid] = (state.unreadCounts[conv.id][uid] || 0) + 1;
    }
  }

  writeDiskState(state);
  scheduleCloudSocialSync();

  return {
    ok: true,
    message: msg,
    participants: conv.participants,
  };
}

export function markConversationReadAction(
  readerId: string,
  conversationId: string
): { ok: boolean; updatedMessageIds: string[]; seenAt: string; participants: string[] } {
  const state = readDiskState();
  const conv = state.conversations[conversationId];
  const seenAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (!conv || !conv.participants.includes(readerId)) {
    return { ok: false, updatedMessageIds: [], seenAt, participants: [] };
  }

  if (!state.unreadCounts[conversationId]) state.unreadCounts[conversationId] = {};
  state.unreadCounts[conversationId][readerId] = 0;

  const updatedMessageIds: string[] = [];
  const msgs = state.messages[conversationId] || [];
  for (const m of msgs) {
    if (m.senderId !== readerId) {
      if (!m.readBy.includes(readerId)) {
        m.readBy.push(readerId);
      }
      if (m.status !== "read") {
        m.status = "read";
        m.seenAt = seenAt;
        updatedMessageIds.push(m.id);
      }
    }
  }

  writeDiskState(state);
  scheduleCloudSocialSync();
  return {
    ok: true,
    updatedMessageIds,
    seenAt,
    participants: conv.participants,
  };
}

export function toggleMessageReactionAction(
  actorId: string,
  messageId: string,
  emoji: string
): {
  ok: boolean;
  conversationId?: string;
  messageId?: string;
  reactions?: Record<string, string[]>;
  participants?: string[];
  error?: string;
} {
  const state = readDiskState();
  const cleanEmoji = String(emoji || "").trim().slice(0, 8);
  if (!cleanEmoji) return { ok: false, error: "Invalid emoji." };

  for (const [convId, list] of Object.entries(state.messages)) {
    const conv = state.conversations[convId];
    if (!conv || !conv.participants.includes(actorId)) continue;
    const msg = list.find((m) => m.id === messageId);
    if (msg) {
      msg.reactions = msg.reactions || {};
      const existing = msg.reactions[cleanEmoji] || [];
      if (existing.includes(actorId)) {
        msg.reactions[cleanEmoji] = existing.filter((id) => id !== actorId);
        if (msg.reactions[cleanEmoji].length === 0) {
          delete msg.reactions[cleanEmoji];
        }
      } else {
        msg.reactions[cleanEmoji] = [...existing, actorId];
      }
      writeDiskState(state);
      scheduleCloudSocialSync();
      return {
        ok: true,
        conversationId: convId,
        messageId: msg.id,
        reactions: msg.reactions,
        participants: conv.participants,
      };
    }
  }

  return { ok: false, error: "Message not found." };
}

export async function deleteChatMessageAction(
  actorId: string,
  messageId: string,
  sb?: SupabaseClient | null
): Promise<{
  ok: boolean;
  statusCode?: number;
  conversationId?: string;
  messageId?: string;
  lastMessage?: SocialMessageRecord | null;
  participants?: string[];
  deletedAt?: string;
  error?: string;
}> {
  const client = sb || registeredSocialSb;
  if (sb) registeredSocialSb = sb;

  await hydrateSocialCloudState(client, { force: true });
  const state = readDiskState();

  for (const [convId, list] of Object.entries(state.messages)) {
    const conv = state.conversations[convId];
    if (!conv || !conv.participants.includes(actorId)) continue;
    const idx = list.findIndex(
      (m) => m.id === messageId || (m.senderId === actorId && m.clientMessageId === messageId)
    );
    if (idx === -1) continue;

    const target = list[idx];
    if (target.senderId !== actorId) {
      return {
        ok: false,
        statusCode: 403,
        error: "Only the sender can delete this message.",
      };
    }

    list.splice(idx, 1);
    const now = new Date().toISOString();
    if (!state.deletedMessageIds) state.deletedMessageIds = {};
    state.deletedMessageIds[target.id] = now;

    if (state.unreadCounts[convId]) {
      const readBySet = new Set(target.readBy || []);
      for (const uid of conv.participants) {
        if (uid !== target.senderId && !readBySet.has(uid) && typeof state.unreadCounts[convId][uid] === "number") {
          state.unreadCounts[convId][uid] = Math.max(0, state.unreadCounts[convId][uid] - 1);
        }
      }
    }

    const lastMessage = list.length > 0 ? list[list.length - 1] : null;
    conv.updatedAt = lastMessage?.createdAt || conv.createdAt || now;

    writeDiskState(state);
    await persistSocialCloudState(client, state);

    return {
      ok: true,
      conversationId: convId,
      messageId: target.id,
      lastMessage,
      participants: conv.participants,
      deletedAt: now,
    };
  }

  if (state.deletedMessageIds?.[messageId]) {
    return { ok: false, statusCode: 404, error: "Message has already been deleted." };
  }

  return { ok: false, statusCode: 404, error: "Message not found." };
}

export function listCommunityPosts(): CommunityPostRecord[] {
  const state = readDiskState();
  return [...state.communityPosts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function createCommunityPostAction(
  authorId: string,
  params: { title: string; content: string; tags?: string[] }
): { ok: boolean; post?: CommunityPostRecord; error?: string } {
  const title = String(params.title || "").trim();
  const content = String(params.content || "").trim();
  if (!title || !content) {
    return { ok: false, error: "Title and post content are required." };
  }
  const state = readDiskState();
  const author = state.users[authorId];
  const tags = Array.isArray(params.tags)
    ? params.tags.map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean).slice(0, 5)
    : [];

  const post: CommunityPostRecord = {
    id: `post_${crypto.randomUUID()}`,
    authorId,
    authorName: author?.name || "Edu AI Scholar",
    authorRole: author?.role === "teacher" ? "Educator" : "Student",
    authorAvatar: author?.avatar || "",
    title,
    content,
    tags: tags.length > 0 ? tags : ["Discussion"],
    likedBy: [],
    replies: [],
    createdAt: new Date().toISOString(),
  };

  state.communityPosts.unshift(post);
  writeDiskState(state);
  scheduleCloudSocialSync();
  return { ok: true, post };
}

export function toggleCommunityPostLikeAction(
  userId: string,
  postId: string
): { ok: boolean; post?: CommunityPostRecord; error?: string } {
  const state = readDiskState();
  const post = state.communityPosts.find((p) => p.id === postId);
  if (!post) return { ok: false, error: "Post not found." };

  if (post.likedBy.includes(userId)) {
    post.likedBy = post.likedBy.filter((id) => id !== userId);
  } else {
    post.likedBy.push(userId);
  }
  writeDiskState(state);
  scheduleCloudSocialSync();
  return { ok: true, post };
}

export function addCommunityReplyAction(
  userId: string,
  postId: string,
  content: string
): { ok: boolean; post?: CommunityPostRecord; reply?: CommunityReplyRecord; error?: string } {
  const clean = String(content || "").trim();
  if (!clean) return { ok: false, error: "Reply cannot be empty." };
  const state = readDiskState();
  const post = state.communityPosts.find((p) => p.id === postId);
  if (!post) return { ok: false, error: "Post not found." };

  const author = state.users[userId];
  const reply: CommunityReplyRecord = {
    id: `rep_${crypto.randomUUID()}`,
    authorId: userId,
    authorName: author?.name || "Edu AI Scholar",
    authorRole: author?.role === "teacher" ? "Educator" : "Student",
    authorAvatar: author?.avatar || "",
    content: clean,
    createdAt: new Date().toISOString(),
  };

  post.replies.push(reply);
  writeDiskState(state);
  scheduleCloudSocialSync();
  return { ok: true, post, reply };
}
