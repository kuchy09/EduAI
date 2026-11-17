import fs from "fs";
import path from "path";
import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";

export type SocialRole = "teacher" | "student" | "educator";
export type FriendRelationStatus = "friends" | "pending_sent" | "pending_received" | "none";

export interface SocialUserProfile {
  id: string;
  name: string;
  email: string;
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
  conversations: Record<string, SocialConversationRecord>;
  messages: Record<string, SocialMessageRecord[]>;
  unreadCounts: Record<string, Record<string, number>>; // convId -> { userId: count }
  communityPosts: CommunityPostRecord[];
  updatedAt: string;
}

const UPLOADS_DIR = process.env.VERCEL ? path.join("/tmp", "uploads") : path.join(process.cwd(), "uploads");
const SOCIAL_STATE_FILE = path.join(UPLOADS_DIR, "social-state.json");

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
    conversations: {},
    messages: {},
    unreadCounts: {},
    communityPosts: createInitialCommunityPosts(),
    updatedAt: new Date().toISOString(),
  };
}

let cachedState: SocialStateDisk | null = null;

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
          conversations: parsed.conversations && typeof parsed.conversations === "object" ? parsed.conversations : {},
          messages: parsed.messages && typeof parsed.messages === "object" ? parsed.messages : {},
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

export function normalizeRole(rawRole: any): SocialRole {
  const val = String(rawRole || "").trim().toLowerCase();
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

export function mapAuthUserToSocialProfile(authUser: any, existing?: SocialUserProfile): SocialUserProfile {
  const meta = authUser?.user_metadata || {};
  const role = normalizeRole(meta.role || existing?.role || "student");
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    existing?.name ||
    (typeof authUser?.email === "string" && authUser.email.split("@")[0]) ||
    "Edu AI Scholar";

  const avatar =
    (typeof meta.avatar_url === "string" && !meta.avatar_url.includes("unsplash.com") && meta.avatar_url.trim()) ||
    (existing?.avatar && !existing.avatar.includes("unsplash.com") ? existing.avatar : "") ||
    "";

  const subjects =
    parseSubjectsList(meta.subjects).length > 0
      ? parseSubjectsList(meta.subjects)
      : existing?.subjects?.length
      ? existing.subjects
      : ["Mathematics", "Sciences"];

  return {
    id: authUser.id,
    name: fullName,
    email: authUser.email || existing?.email || "",
    avatar,
    role,
    title:
      (typeof meta.title === "string" && meta.title.trim()) ||
      existing?.title ||
      (meta.field_of_study ? `${meta.field_of_study} Scholar` : meta.curriculum ? `${meta.curriculum} Learner` : role === "teacher" ? "Faculty Educator" : "Academic Student"),
    institution:
      (typeof meta.institution === "string" && meta.institution.trim()) ||
      existing?.institution ||
      (meta.education_level ? `${meta.education_level} • Edu AI` : "Edu AI Learning Network"),
    subjects,
    bio:
      (typeof meta.bio === "string" && meta.bio.trim()) ||
      existing?.bio ||
      `Collaborating on ${subjects.slice(0, 2).join(" & ")} in Edu AI.`,
    location:
      (typeof meta.location === "string" && meta.location.trim()) ||
      (typeof meta.country === "string" && meta.country.trim()) ||
      existing?.location ||
      "",
    lastSeen: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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

  const merged: SocialUserProfile = {
    ...base,
    ...patch,
    id: authUser.id,
    email: patch?.email || base.email,
    subjects: patch?.subjects && patch.subjects.length > 0 ? patch.subjects : base.subjects,
    role: patch?.role ? normalizeRole(patch.role) : base.role,
    lastSeen: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.users[authUser.id] = merged;
  writeDiskState(state);

  // Best-effort sync to Supabase public.profiles so cross-instance queries find this member
  if (sb) {
    try {
      await sb.from("profiles").upsert(
        {
          id: merged.id,
          full_name: merged.name,
          email: merged.email || null,
          avatar_url: merged.avatar || null,
          role: merged.role,
          title: merged.title,
          institution: merged.institution,
          subjects: merged.subjects.join(", "),
          bio: merged.bio,
          location: merged.location || null,
          updated_at: merged.updatedAt,
        },
        { onConflict: "id" }
      );
    } catch (_) {}
  }

  return merged;
}

export async function hydrateDirectoryFromSupabase(sb?: SupabaseClient | null): Promise<void> {
  if (!sb) return;
  try {
    const { data, error } = await sb
      .from("profiles")
      .select("id, full_name, email, avatar_url, role, title, institution, subjects, bio, location, updated_at")
      .limit(200);

    if (error || !Array.isArray(data)) return;
    const state = readDiskState();
    let changed = false;

    for (const row of data) {
      if (!row?.id) continue;
      const existing = state.users[row.id];
      const subjects = parseSubjectsList(row.subjects);
      const safeAvatar =
        typeof row.avatar_url === "string" && !row.avatar_url.includes("unsplash.com")
          ? row.avatar_url.trim()
          : existing?.avatar || "";

      const rowUpdatedAt = row.updated_at || "";
      if (!existing || (rowUpdatedAt && rowUpdatedAt > existing.updatedAt)) {
        state.users[row.id] = {
          id: row.id,
          name: row.full_name || existing?.name || (row.email ? String(row.email).split("@")[0] : "Edu AI Scholar"),
          email: row.email || existing?.email || "",
          avatar: safeAvatar,
          role: normalizeRole(row.role || existing?.role || "student"),
          title: row.title || existing?.title || "Academic Member",
          institution: row.institution || existing?.institution || "Edu AI Network",
          subjects: subjects.length > 0 ? subjects : existing?.subjects || ["General Studies"],
          bio: row.bio || existing?.bio || "Active Edu AI learner.",
          location: row.location || existing?.location || "",
          lastSeen: rowUpdatedAt || existing?.lastSeen || new Date().toISOString(),
          updatedAt: rowUpdatedAt || existing?.updatedAt || new Date().toISOString(),
        };
        changed = true;
      }
    }

    if (changed) {
      writeDiskState(state);
    }
  } catch (_) {}
}

export async function hydrateFriendRequestsFromSupabase(userId: string, sb?: SupabaseClient | null): Promise<void> {
  if (!sb || !userId) return;
  try {
    const { data, error } = await sb
      .from("friend_requests")
      .select("id, sender_id, receiver_id, status, created_at, updated_at")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error || !Array.isArray(data)) return;
    const state = readDiskState();
    let changed = false;

    for (const row of data) {
      if (!row?.sender_id || !row?.receiver_id) continue;
      const status = row.status === "accepted" || row.status === "declined" ? row.status : "pending";
      const existing = state.friendRequests.find(
        (fr) =>
          (fr.senderId === row.sender_id && fr.receiverId === row.receiver_id) ||
          (fr.senderId === row.receiver_id && fr.receiverId === row.sender_id)
      );
      if (!existing) {
        state.friendRequests.push({
          id: row.id || `fr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          senderId: row.sender_id,
          receiverId: row.receiver_id,
          status,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
        });
        changed = true;
      }
    }

    if (changed) {
      writeDiskState(state);
    }
  } catch (_) {}
}

export function getFriendRelationStatus(
  state: SocialStateDisk,
  viewerId: string,
  targetId: string
): FriendRelationStatus {
  if (!viewerId || !targetId || viewerId === targetId) return "none";

  const match = state.friendRequests.find(
    (fr) =>
      fr.status !== "declined" &&
      ((fr.senderId === viewerId && fr.receiverId === targetId) ||
        (fr.senderId === targetId && fr.receiverId === viewerId))
  );

  if (!match) return "none";
  if (match.status === "accepted") return "friends";
  if (match.senderId === viewerId) return "pending_sent";
  return "pending_received";
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
        const now = new Date().toISOString();
        state.conversations[dmId] = {
          id: dmId,
          type: "direct",
          participants: [fr.senderId, fr.receiverId],
          createdBy: fr.senderId,
          createdAt: fr.createdAt || now,
          updatedAt: fr.updatedAt || now,
        };
        if (!state.messages[dmId]) state.messages[dmId] = [];
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

  for (const conv of Object.values(state.conversations)) {
    if (!conv.participants.includes(viewerId)) continue;
    const convMsgs = (state.messages[conv.id] || []).map((m) => ({
      id: m.id,
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
    onlineUserIds: Array.from(onlineUserIds),
  };
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
  const state = readDiskState();
  if (!state.users[receiverId]) {
    await hydrateDirectoryFromSupabase(sb);
  }
  if (!state.users[receiverId]) {
    return { ok: false, status: "pending", request: null as any, error: "User not found." };
  }

  // Check if reverse request already pending — if so, auto-accept!
  const reverse = state.friendRequests.find(
    (fr) => fr.senderId === receiverId && fr.receiverId === senderId && fr.status === "pending"
  );
  if (reverse) {
    const res = await respondToFriendRequestAction(senderId, receiverId, "accept", sb);
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
      return { ok: true, status: "accepted", request: existing };
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

  if (sb) {
    try {
      await sb.from("friend_requests").upsert(
        {
          sender_id: senderId,
          receiver_id: receiverId,
          status: "pending",
          updated_at: now,
        },
        { onConflict: "sender_id,receiver_id" }
      );
    } catch (_) {}
  }

  return { ok: true, status: "pending", request };
}

export async function respondToFriendRequestAction(
  responderId: string,
  senderId: string,
  action: "accept" | "decline",
  sb?: SupabaseClient | null
): Promise<{ ok: boolean; request?: FriendRequestRecord; conversation?: any; error?: string }> {
  const state = readDiskState();
  const reqRecord = state.friendRequests.find(
    (fr) => fr.senderId === senderId && fr.receiverId === responderId
  );

  if (!reqRecord) {
    return { ok: false, error: "Incoming friend request not found." };
  }

  const now = new Date().toISOString();
  reqRecord.status = action === "accept" ? "accepted" : "declined";
  reqRecord.updatedAt = now;

  let conversation: any = undefined;
  if (action === "accept") {
    const dmId = buildDirectConvId(reqRecord.senderId, reqRecord.receiverId);
    if (!state.conversations[dmId]) {
      state.conversations[dmId] = {
        id: dmId,
        type: "direct",
        participants: [reqRecord.senderId, reqRecord.receiverId],
        createdBy: reqRecord.senderId,
        createdAt: now,
        updatedAt: now,
      };
      if (!state.messages[dmId]) {
        state.messages[dmId] = [];
      }
    }
    const conv = state.conversations[dmId];
    conversation = {
      ...conv,
      unreadCount: 0,
      lastMessage: (state.messages[dmId] || []).slice(-1)[0],
    };
  }

  writeDiskState(state);

  if (sb) {
    try {
      await sb
        .from("friend_requests")
        .update({ status: reqRecord.status, updated_at: now })
        .or(`and(sender_id.eq.${senderId},receiver_id.eq.${responderId}),and(sender_id.eq.${responderId},receiver_id.eq.${senderId})`);
    } catch (_) {}
  }

  return { ok: true, request: reqRecord, conversation };
}

export async function removeFriendshipAction(
  actorId: string,
  targetId: string,
  sb?: SupabaseClient | null
): Promise<{ ok: boolean }> {
  const state = readDiskState();
  state.friendRequests = state.friendRequests.filter(
    (fr) =>
      !(
        (fr.senderId === actorId && fr.receiverId === targetId) ||
        (fr.senderId === targetId && fr.receiverId === actorId)
      )
  );
  writeDiskState(state);

  if (sb) {
    try {
      await sb
        .from("friend_requests")
        .delete()
        .or(`and(sender_id.eq.${actorId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${actorId})`);
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
  const now = new Date().toISOString();
  if (!state.conversations[dmId]) {
    state.conversations[dmId] = {
      id: dmId,
      type: "direct",
      participants: [requesterId, partnerId],
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    };
    state.messages[dmId] = state.messages[dmId] || [];
    writeDiskState(state);
  }

  const conv = state.conversations[dmId];
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
): { ok: boolean; messages?: any[]; error?: string } {
  const state = readDiskState();
  const conv = state.conversations[conversationId];
  if (!conv || !conv.participants.includes(viewerId)) {
    return { ok: false, error: "Conversation not found or access denied." };
  }
  return {
    ok: true,
    messages: state.messages[conversationId] || [],
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
  return { ok: true, post, reply };
}
