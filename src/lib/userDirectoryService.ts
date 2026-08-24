import { supabase } from './supabase';
import { ChatUser, FriendStatus, UserRole } from '../components/chat/types';
import { INITIAL_USERS } from '../components/chat/initialData';

export interface SupabaseProfileRecord {
  id: string;
  username?: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
  role?: string;
  title?: string;
  institution?: string;
  location?: string;
  bio?: string;
  subjects?: string | string[];
  education_level?: string;
  field_of_study?: string;
  curriculum?: string;
  status?: string;
  last_seen?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseFriendRequestRecord {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  note?: string;
  created_at: string;
  updated_at?: string;
}

// Local cache keys
const CACHE_PROFILES_KEY = 'eduai_cached_directory_profiles';
const CACHE_FRIENDSHIPS_KEY = 'eduai_cached_friend_requests';

/**
 * Ensures the currently logged-in user profile exists in Supabase public.profiles
 */
export async function syncCurrentUserToSupabase(
  user: any, 
  profileDetails?: {
    name?: string;
    role?: UserRole;
    title?: string;
    institution?: string;
    subjects?: string[];
    bio?: string;
    avatar?: string;
    location?: string;
  }
): Promise<boolean> {
  if (!user?.id) return false;

  const profileData = {
    id: user.id,
    email: user.email || profileDetails?.name || 'student@eduai.ac.ke',
    full_name: profileDetails?.name || user?.user_metadata?.full_name || 'Edu AI Learner',
    username: user.email ? user.email.split('@')[0] : `user_${user.id.slice(0, 6)}`,
    avatar_url: profileDetails?.avatar || user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: profileDetails?.role || user?.user_metadata?.role || 'student',
    title: profileDetails?.title || (profileDetails?.role === 'teacher' ? 'Senior Educator & Faculty Lead' : 'Senior High Student (Grade 12 CBC)'),
    institution: profileDetails?.institution || 'Nairobi Academic Senior Secondary',
    location: profileDetails?.location || 'Nairobi, Kenya',
    bio: profileDetails?.bio || 'Active participant on the Edu AI academic learning network.',
    subjects: Array.isArray(profileDetails?.subjects) ? profileDetails.subjects.join(', ') : (profileDetails?.subjects || 'Physics, Mathematics, Computer Science'),
    status: 'online',
    last_seen: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Sync to localStorage
  try {
    const cachedUsers: ChatUser[] = JSON.parse(localStorage.getItem('eduai_chat_users') || '[]');
    const existingIdx = cachedUsers.findIndex(u => u.id === user.id);
    const convertedChatUser: ChatUser = {
      id: user.id,
      name: profileData.full_name,
      email: profileData.email,
      avatar: profileData.avatar_url,
      role: (profileData.role as UserRole) || 'student',
      title: profileData.title,
      institution: profileData.institution,
      status: 'online',
      lastSeen: 'Active now',
      subjects: typeof profileData.subjects === 'string' ? profileData.subjects.split(',').map(s => s.trim()) : [],
      friendStatus: 'friends',
      bio: profileData.bio,
      location: profileData.location
    };

    if (existingIdx >= 0) {
      cachedUsers[existingIdx] = convertedChatUser;
    } else {
      cachedUsers.push(convertedChatUser);
    }
    localStorage.setItem('eduai_chat_users', JSON.stringify(cachedUsers));
  } catch (e) {}

  if (!supabase) return false;

  try {
    const { error } = await supabase.from('profiles').upsert(profileData, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase profile sync notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase profile sync error:', err);
    return false;
  }
}

/**
 * Search and retrieve users stored in Supabase with their relationship state to current user
 */
export async function fetchSearchableUsersFromSupabase(
  currentUserId: string,
  params?: {
    search?: string;
    role?: 'all' | 'teacher' | 'student' | 'educator';
    subject?: string;
  }
): Promise<{ users: ChatUser[]; totalCount: number; isSupabaseLive: boolean }> {
  let supabaseSuccess = false;
  let remoteProfiles: SupabaseProfileRecord[] = [];
  let friendRequests: SupabaseFriendRequestRecord[] = [];

  if (supabase) {
    try {
      // 1. Query profiles
      let query = supabase.from('profiles').select('*');

      if (params?.role && params.role !== 'all') {
        query = query.eq('role', params.role);
      }

      if (params?.search && params.search.trim()) {
        const term = params.search.trim();
        query = query.or(`full_name.ilike.%${term}%,username.ilike.%${term}%,institution.ilike.%${term}%,subjects.ilike.%${term}%,bio.ilike.%${term}%`);
      }

      const { data: profilesData, error: profilesError } = await query.order('full_name', { ascending: true }).limit(50);

      if (!profilesError && profilesData && profilesData.length > 0) {
        remoteProfiles = profilesData;
        supabaseSuccess = true;
      }

      // 2. Query friend requests involving current user
      if (currentUserId) {
        const { data: requestsData, error: reqError } = await supabase
          .from('friend_requests')
          .select('*')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

        if (!reqError && requestsData) {
          friendRequests = requestsData;
        }
      }
    } catch (err) {
      console.warn('Could not query remote Supabase profiles, falling back to local dataset:', err);
    }
  }

  // If Supabase has data, format it; otherwise use local fallback initialized data
  let baseList: ChatUser[] = [];

  if (supabaseSuccess && remoteProfiles.length > 0) {
    const mappedRemote: ChatUser[] = remoteProfiles.map(p => {
      let parsedSubjects: string[] = [];
      if (Array.isArray(p.subjects)) {
        parsedSubjects = p.subjects;
      } else if (typeof p.subjects === 'string') {
        parsedSubjects = p.subjects.split(',').map(s => s.trim()).filter(Boolean);
      }

      // Determine friendship status
      let status: FriendStatus = 'none';
      const matchingRequest = friendRequests.find(
        r => (r.sender_id === currentUserId && r.receiver_id === p.id) ||
             (r.sender_id === p.id && r.receiver_id === currentUserId)
      );

      if (matchingRequest) {
        if (matchingRequest.status === 'accepted') {
          status = 'friends';
        } else if (matchingRequest.status === 'pending') {
          status = matchingRequest.sender_id === currentUserId ? 'pending_sent' : 'pending_received';
        }
      }

      return {
        id: p.id,
        name: p.full_name || p.username || 'Edu AI Member',
        email: p.email || '',
        avatar: p.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        role: (p.role === 'teacher' || p.role === 'educator' ? 'teacher' : 'student') as UserRole,
        title: p.title || (p.role === 'teacher' ? 'Faculty Educator' : 'Senior Secondary Scholar'),
        institution: p.institution || 'Academic Hub Kenya',
        status: (p.status as any) || 'online',
        lastSeen: p.last_seen ? 'Active recently' : 'Active now',
        subjects: parsedSubjects.length > 0 ? parsedSubjects : ['General Science', 'Mathematics'],
        friendStatus: status,
        bio: p.bio || 'Studying and collaborating on the Edu AI platform.',
        location: p.location || 'Kenya'
      };
    });

    // Merge in any platform initial catalog users (e.g. Dut Nyok) that aren't yet in remote query
    const remoteNames = new Set(mappedRemote.map(u => u.name.toLowerCase()));
    const missingInitial = INITIAL_USERS.filter(u => !remoteNames.has(u.name.toLowerCase()));
    baseList = [...mappedRemote, ...missingInitial];
  } else {
    // Fallback to local storage merged with initial dataset
    const stored = localStorage.getItem('eduai_chat_users');
    let list: ChatUser[] = INITIAL_USERS;
    if (stored) {
      try {
        const parsed: ChatUser[] = JSON.parse(stored);
        const parsedNames = new Set(parsed.map(u => u.name.toLowerCase()));
        const missing = INITIAL_USERS.filter(u => !parsedNames.has(u.name.toLowerCase()));
        list = [...parsed, ...missing];
      } catch (e) {
        list = INITIAL_USERS;
      }
    }
    baseList = list;
  }

  // Filter in-memory for role and search query
  let result = baseList;
  if (params?.role && params.role !== 'all') {
    result = result.filter(u => u.role === params.role);
  }
  if (params?.search && params.search.trim()) {
    const q = params.search.trim().toLowerCase();
    const qTokens = q.split(/\s+/).filter(Boolean);
    result = result.filter(u => {
      const targetString = `${u.name} ${u.email || ''} ${u.institution} ${u.title} ${u.subjects.join(' ')} ${u.bio || ''} ${u.location || ''}`.toLowerCase();
      return qTokens.every(token => targetString.includes(token)) || targetString.includes(q);
    });
  }

  return {
    users: result,
    totalCount: result.length,
    isSupabaseLive: supabaseSuccess
  };
}

/**
 * Send a friend request stored in Supabase and broadcasted live
 */
export async function sendSupabaseFriendRequest(
  receiverId: string, 
  currentUserId: string,
  note?: string
): Promise<{ success: boolean; message: string }> {
  if (!currentUserId || !receiverId || currentUserId === receiverId) {
    return { success: false, message: 'Invalid target user' };
  }

  // 1. Try writing to Supabase
  if (supabase) {
    try {
      const { error } = await supabase.from('friend_requests').upsert({
        sender_id: currentUserId,
        receiver_id: receiverId,
        status: 'pending',
        note: note || 'Hi! I would like to connect with you on Edu AI for academic discussions.',
        updated_at: new Date().toISOString()
      }, { onConflict: 'sender_id,receiver_id' });

      if (!error) {
        // Broadcast Realtime Event
        try {
          const channel = supabase.channel('eduai-friendships-channel');
          channel.send({
            type: 'broadcast',
            event: 'friend_request_sent',
            payload: { sender_id: currentUserId, receiver_id: receiverId, status: 'pending', note }
          });
        } catch (e) {}

        return { success: true, message: 'Friend request sent via Supabase!' };
      }
    } catch (err) {
      console.warn('Supabase friend request write error:', err);
    }
  }

  // Local fallback storage
  try {
    const cachedUsers: ChatUser[] = JSON.parse(localStorage.getItem('eduai_chat_users') || '[]');
    const updated = cachedUsers.map(u => u.id === receiverId ? { ...u, friendStatus: 'pending_sent' as FriendStatus } : u);
    localStorage.setItem('eduai_chat_users', JSON.stringify(updated));
  } catch (e) {}

  return { success: true, message: 'Friend request recorded successfully' };
}

/**
 * Respond to an incoming friend request (Accept / Decline)
 */
export async function respondToSupabaseFriendRequest(
  targetUserId: string,
  currentUserId: string,
  action: 'accepted' | 'declined'
): Promise<{ success: boolean; message: string }> {
  if (!currentUserId || !targetUserId) return { success: false, message: 'Invalid user parameters' };

  if (supabase) {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: action, updated_at: new Date().toISOString() })
        .match({ sender_id: targetUserId, receiver_id: currentUserId });

      if (!error) {
        try {
          const channel = supabase.channel('eduai-friendships-channel');
          channel.send({
            type: 'broadcast',
            event: 'friend_request_responded',
            payload: { sender_id: targetUserId, receiver_id: currentUserId, status: action }
          });
        } catch (e) {}

        return { success: true, message: `Request ${action} successfully in Supabase` };
      }
    } catch (err) {
      console.warn('Supabase friend request update error:', err);
    }
  }

  // Local fallback
  try {
    const cachedUsers: ChatUser[] = JSON.parse(localStorage.getItem('eduai_chat_users') || '[]');
    const newStatus: FriendStatus = action === 'accepted' ? 'friends' : 'none';
    const updated = cachedUsers.map(u => u.id === targetUserId ? { ...u, friendStatus: newStatus } : u);
    localStorage.setItem('eduai_chat_users', JSON.stringify(updated));
  } catch (e) {}

  return { success: true, message: `Friendship ${action}` };
}

/**
 * Remove or cancel a friendship / friend request
 */
export async function cancelOrRemoveSupabaseFriendship(
  targetUserId: string,
  currentUserId: string
): Promise<{ success: boolean }> {
  if (supabase) {
    try {
      await supabase
        .from('friend_requests')
        .delete()
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`);
    } catch (e) {}
  }

  // Local fallback
  try {
    const cachedUsers: ChatUser[] = JSON.parse(localStorage.getItem('eduai_chat_users') || '[]');
    const updated = cachedUsers.map(u => u.id === targetUserId ? { ...u, friendStatus: 'none' as FriendStatus } : u);
    localStorage.setItem('eduai_chat_users', JSON.stringify(updated));
  } catch (e) {}

  return { success: true };
}
