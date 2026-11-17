import { supabase } from './supabase';
import { ChatUser, UserRole } from '../components/chat/types';
import { safeStorage } from './safeStorage';
import {
  searchSocialDirectory,
  sendFriendRequestApi,
  respondFriendRequestApi,
  removeFriendshipApi,
  updateSocialProfileApi,
} from './socialChatClient';

export function getPeerCurrentUserStorageKey(userId?: string): string {
  return userId ? `eduai_chat_current_user_${userId}` : 'eduai_chat_current_user';
}

export async function syncCurrentUserToSupabase(
  user: any,
  customFields?: {
    name?: string;
    role?: UserRole;
    title?: string;
    institution?: string;
    subjects?: string[];
    bio?: string;
    avatar?: string;
    location?: string;
  }
): Promise<ChatUser | null> {
  if (!user?.id) return null;

  const meta = user.user_metadata || {};
  const roleStr = String(customFields?.role || meta.role || 'student').toLowerCase();
  const normalizedRole: UserRole =
    roleStr.includes('teach') || roleStr.includes('educat') ? 'teacher' : 'student';

  const fullName =
    customFields?.name ||
    meta.full_name ||
    meta.name ||
    (user.email ? user.email.split('@')[0] : 'Edu AI Learner');

  const rawAvatar = customFields?.avatar || meta.avatar_url || '';
  const safeAvatar = rawAvatar && !String(rawAvatar).includes('unsplash.com') ? rawAvatar : '';

  const subjects =
    customFields?.subjects && customFields.subjects.length > 0
      ? customFields.subjects
      : Array.isArray(meta.subjects)
      ? meta.subjects
      : typeof meta.subjects === 'string' && meta.subjects.trim()
      ? meta.subjects.split(',').map((s: string) => s.trim()).filter(Boolean)
      : ['Mathematics', 'Sciences'];

  const localUser: ChatUser = {
    id: user.id,
    name: fullName,
    email: user.email || '',
    avatar: safeAvatar,
    role: normalizedRole,
    title:
      customFields?.title ||
      (meta.field_of_study
        ? `${meta.field_of_study} Scholar`
        : normalizedRole === 'teacher'
        ? 'Faculty Educator'
        : 'Academic Student'),
    institution: customFields?.institution || meta.institution || 'Edu AI Learning Network',
    status: 'online',
    lastSeen: 'Active now',
    subjects,
    friendStatus: 'none',
    bio: customFields?.bio || meta.bio || `Studying ${subjects.slice(0, 2).join(' & ')} on Edu AI.`,
    location: customFields?.location || meta.location || meta.country || '',
  };

  safeStorage.setJSON(getPeerCurrentUserStorageKey(user.id), localUser);

  try {
    const synced = await updateSocialProfileApi(localUser);
    return { ...localUser, ...synced, status: 'online' };
  } catch {
    if (supabase) {
      try {
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            full_name: localUser.name,
            email: localUser.email || null,
            avatar_url: localUser.avatar || null,
            role: localUser.role,
            title: localUser.title,
            institution: localUser.institution,
            subjects: localUser.subjects.join(', '),
            bio: localUser.bio,
            location: localUser.location || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch (_) {}
    }
    return localUser;
  }
}

export async function searchSupabaseDirectory(
  currentUserId: string,
  searchQuery = '',
  roleFilter: 'all' | 'teacher' | 'student' | 'friends' | 'pending' = 'all'
): Promise<{ users: ChatUser[]; isLive: boolean }> {
  try {
    const res = await searchSocialDirectory(searchQuery, roleFilter);
    const cleaned = (res.users || [])
      .filter((u) => u.id !== currentUserId)
      .map((u) => ({
        ...u,
        avatar: u.avatar && !u.avatar.includes('unsplash.com') ? u.avatar : '',
      }));
    return { users: cleaned, isLive: true };
  } catch {
    return { users: [], isLive: false };
  }
}

export async function fetchSearchableUsersFromSupabase(
  currentUserId: string,
  options?: { search?: string; role?: string }
): Promise<{ users: ChatUser[]; isSupabaseLive: boolean }> {
  const roleVal = (options?.role || 'all') as 'all' | 'teacher' | 'student' | 'friends' | 'pending';
  const res = await searchSupabaseDirectory(currentUserId, options?.search || '', roleVal);
  return { users: res.users, isSupabaseLive: res.isLive };
}

export async function sendSupabaseFriendRequest(
  receiverId: string,
  _senderId: string,
  note?: string
): Promise<{ success: boolean; status?: 'pending' | 'accepted'; isLive: boolean; error?: string }> {
  try {
    const res = await sendFriendRequestApi(receiverId, note);
    return { success: res.ok, status: res.status, isLive: true };
  } catch (err: any) {
    return { success: false, isLive: false, error: err?.message || 'Failed to send request' };
  }
}

export async function respondToSupabaseFriendRequest(
  senderId: string,
  _receiverId: string,
  action: 'accept' | 'decline'
): Promise<{ success: boolean; isLive: boolean; error?: string }> {
  try {
    const res = await respondFriendRequestApi(senderId, action);
    return { success: res.ok, isLive: true };
  } catch (err: any) {
    return { success: false, isLive: false, error: err?.message || 'Failed to respond to request' };
  }
}

export async function cancelOrRemoveSupabaseFriendship(
  targetUserId: string,
  _currentUserId: string
): Promise<{ success: boolean; isLive: boolean }> {
  try {
    await removeFriendshipApi(targetUserId);
    return { success: true, isLive: true };
  } catch {
    return { success: false, isLive: false };
  }
}
