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
    roleStr === 'admin' || roleStr === 'super_admin'
      ? 'admin'
      : roleStr.includes('teach') || roleStr.includes('educat')
      ? 'teacher'
      : 'student';

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
      (normalizedRole === 'admin'
        ? 'Platform Administrator'
        : meta.field_of_study
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
): Promise<{ users: ChatUser[]; isLive: boolean; error?: string }> {
  try {
    const res = await searchSocialDirectory(searchQuery, roleFilter);
    const cleaned = (res.users || [])
      .filter((u) => u.id !== currentUserId)
      .map((u) => ({
        ...u,
        subjects: Array.isArray(u.subjects) ? u.subjects : [],
        avatar: u.avatar && !u.avatar.includes('unsplash.com') ? u.avatar : '',
      }));
    return { users: cleaned, isLive: true };
  } catch (err: any) {
    // Fallback to querying Supabase public.profiles directly if browser client is active
    if (supabase) {
      try {
        const { data: profileRows, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', currentUserId)
          .limit(500);

        let reqRows: any[] | null = null;
        try {
          const { data: fqData, error: fqErr } = await supabase
            .from('friend_requests')
            .select('sender_id, receiver_id, status')
            .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);
          if (!fqErr && Array.isArray(fqData)) {
            reqRows = fqData;
          }
        } catch (_) {}

        if (!profErr && Array.isArray(profileRows) && profileRows.length > 0) {
          const reqList = Array.isArray(reqRows) ? reqRows : [];
          const q = searchQuery.trim().toLowerCase();
          const mapped: ChatUser[] = profileRows
            .filter((row: any) => row?.id && row.id !== currentUserId)
            .map((row: any): ChatUser => {
              const rawRole = String(row.role || 'student').toLowerCase();
              const role: UserRole =
                rawRole === 'admin' || rawRole === 'super_admin'
                  ? 'admin'
                  : rawRole.includes('teach') || rawRole.includes('educat')
                  ? 'teacher'
                  : 'student';
              const subjects = Array.isArray(row.subjects)
                ? row.subjects
                : typeof row.subjects === 'string'
                ? row.subjects.split(',').map((s: string) => s.trim()).filter(Boolean)
                : ['General Studies'];

              let friendStatus: ChatUser['friendStatus'] = 'none';
              const accepted = reqList.find(
                (r: any) =>
                  r.status === 'accepted' &&
                  ((r.sender_id === currentUserId && r.receiver_id === row.id) ||
                    (r.sender_id === row.id && r.receiver_id === currentUserId))
              );
              if (accepted) {
                friendStatus = 'friends';
              } else {
                const pending = reqList.find(
                  (r: any) =>
                    r.status === 'pending' &&
                    ((r.sender_id === currentUserId && r.receiver_id === row.id) ||
                      (r.sender_id === row.id && r.receiver_id === currentUserId))
                );
                if (pending) {
                  friendStatus = pending.sender_id === currentUserId ? 'pending_sent' : 'pending_received';
                }
              }

              const avatarRaw = typeof row.avatar_url === 'string' ? row.avatar_url.trim() : '';
              return {
                id: row.id,
                name: row.full_name || row.username || (row.email ? row.email.split('@')[0] : 'Edu AI Member'),
                email: row.email || '',
                phone: row.phone || '',
                avatar: avatarRaw && !avatarRaw.includes('unsplash.com') ? avatarRaw : '',
                role,
                title: row.title || (role === 'admin' ? 'Platform Administrator' : role === 'teacher' ? 'Faculty Educator' : 'Academic Member'),
                institution: row.institution || 'Edu AI Learning Network',
                status: row.status === 'online' ? 'online' : row.status === 'away' ? 'away' : 'offline',
                lastSeen: row.updated_at || 'Recently',
                subjects,
                friendStatus,
                bio: row.bio || 'Active Edu AI learner.',
                location: row.location || row.country || '',
              };
            })
            .filter((u) => {
              if (roleFilter === 'teacher' && u.role !== 'teacher' && u.role !== 'educator') return false;
              if (roleFilter === 'student' && u.role !== 'student') return false;
              if (roleFilter === 'friends' && u.friendStatus !== 'friends') return false;
              if (roleFilter === 'pending' && u.friendStatus !== 'pending_received' && u.friendStatus !== 'pending_sent') return false;
              if (!q) return true;
              const emailLower = (u.email || '').toLowerCase();
              const emailHandle = emailLower.includes('@') ? emailLower.split('@')[0] : '';
              const hay = `${u.name} ${emailLower} ${emailHandle} ${u.phone || ''} ${u.institution} ${u.title} ${u.subjects.join(' ')} ${u.bio || ''} ${u.location || ''} ${u.role}`.toLowerCase();
              return hay.includes(q) || q.split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
            });

          return { users: mapped, isLive: true };
        }
      } catch (_) {}
    }

    return { users: [], isLive: false, error: err?.message || 'Unable to load directory.' };
  }
}

export async function fetchSearchableUsersFromSupabase(
  currentUserId: string,
  options?: { search?: string; role?: string }
): Promise<{ users: ChatUser[]; isSupabaseLive: boolean; error?: string }> {
  const roleVal = (options?.role || 'all') as 'all' | 'teacher' | 'student' | 'friends' | 'pending';
  const res = await searchSupabaseDirectory(currentUserId, options?.search || '', roleVal);
  return { users: res.users, isSupabaseLive: res.isLive, error: res.error };
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
