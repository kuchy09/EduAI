import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Search, Users, BookOpen, School, 
  UserPlus, Clock, Check, X, 
  MapPin, MessageSquare, RefreshCw, CheckCircle2,
  Edit3, Send, Database, UserMinus
} from 'lucide-react';
import { ChatUser, UserRole } from './chat/types';
import { AvatarBadge } from './chat/AvatarBadge';
import { 
  fetchSearchableUsersFromSupabase, 
  sendSupabaseFriendRequest, 
  respondToSupabaseFriendRequest, 
  cancelOrRemoveSupabaseFriendship, 
  syncCurrentUserToSupabase 
} from '../lib/userDirectoryService';
import { socialWsClient, SocialWsEvent, SOCIAL_SESSION_REFRESHED_EVENT } from '../lib/socialChatClient';
import { getPersistedDeviceSession, getSupabaseClient, supabase } from '../lib/supabase';
import { getStoredUserAvatar, useUserAvatar } from '../lib/userAvatarService';
import { safeStorage } from '../lib/safeStorage';
import { getPeerCurrentUserStorageKey, pushAccountSyncPatch } from '../lib/accountSyncService';

interface UserPortalProps {
  user?: any;
  profile?: any;
  onStartChat?: (userId: string) => void;
  onNavigate?: (view: string) => void;
}

export function UserPortal({ user, profile, onStartChat, onNavigate }: UserPortalProps) {
  const liveAvatarUrl = useUserAvatar(user, profile);

  const buildPortalUser = (): ChatUser => {
    const saved = safeStorage.getJSON<Partial<ChatUser> | null>(getPeerCurrentUserStorageKey(user?.id), null);
    const rawRole = String(profile?.role || user?.user_metadata?.role || 'student').toLowerCase();
    const detectedRole: UserRole =
      rawRole === 'admin' || rawRole === 'super_admin'
        ? 'admin'
        : rawRole.includes('teach') || rawRole.includes('educat')
        ? 'teacher'
        : 'student';
    const subjectsList =
      typeof profile?.subjects === 'string'
        ? profile.subjects.split(',').map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(profile?.subjects)
          ? profile.subjects
          : typeof user?.user_metadata?.subjects === 'string'
            ? user.user_metadata.subjects.split(',').map((s: string) => s.trim()).filter(Boolean)
            : (saved?.id === user?.id && saved?.subjects) || [];

    return {
      id: user?.id || 'me',
      name:
        profile?.full_name ||
        user?.user_metadata?.full_name ||
        user?.email?.split('@')[0] ||
        (saved?.id === user?.id ? saved?.name : undefined) ||
        'Learner',
      email: user?.email || '',
      avatar: liveAvatarUrl || getStoredUserAvatar(user, profile) || profile?.avatar_url || user?.user_metadata?.avatar_url || '',
      role: detectedRole,
      title:
        profile?.title ||
        (detectedRole === 'admin'
          ? 'Platform Administrator'
          : detectedRole === 'teacher'
          ? 'Educator & Faculty Member'
          : profile?.education_level || user?.user_metadata?.education_level || 'Learner'),
      institution: profile?.institution || user?.user_metadata?.institution || (saved?.id === user?.id ? saved?.institution : '') || '',
      status: 'online',
      lastSeen: 'Active now',
      subjects: subjectsList,
      friendStatus: 'friends',
      bio: profile?.bio || user?.user_metadata?.bio || (saved?.id === user?.id ? saved?.bio : '') || '',
      location: profile?.location || profile?.country || user?.user_metadata?.country || (saved?.id === user?.id ? saved?.location : '') || '',
    };
  };

  // Current user's identity
  const [currentUser, setCurrentUser] = useState<ChatUser>(buildPortalUser);

  useEffect(() => {
    setCurrentUser((prev) => {
      const next = buildPortalUser();
      return { ...prev, ...next, avatar: next.avatar || prev.avatar };
    });
  }, [
    user?.id,
    user?.email,
    user?.user_metadata?.full_name,
    user?.user_metadata?.role,
    profile?.full_name,
    profile?.avatar_url,
    profile?.role,
    profile?.bio,
    profile?.institution,
    profile?.location,
    profile?.country,
    profile?.subjects,
    liveAvatarUrl,
  ]);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'student' | 'friends' | 'pending'>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [usersList, setUsersList] = useState<ChatUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSupabaseLive, setIsSupabaseLive] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Selected User for Details Modal
  const [inspectUser, setInspectUser] = useState<ChatUser | null>(null);

  // Profile Edit Modal State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: currentUser.name,
    role: currentUser.role,
    title: currentUser.title,
    institution: currentUser.institution,
    location: currentUser.location || '',
    subjects: currentUser.subjects.join(', '),
    bio: currentUser.bio
  });

  useEffect(() => {
    if (!isEditProfileOpen) {
      setEditFormData({
        name: currentUser.name,
        role: currentUser.role,
        title: currentUser.title,
        institution: currentUser.institution,
        location: currentUser.location || '',
        subjects: currentUser.subjects.join(', '),
        bio: currentUser.bio,
      });
    }
  }, [currentUser, isEditProfileOpen]);

  // Send request note modal
  const [requestTargetUser, setRequestTargetUser] = useState<ChatUser | null>(null);
  const [customRequestNote, setCustomRequestNote] = useState('');

  // Realtime avatar updates
  useEffect(() => {
    const handleAvatarChange = (e: any) => {
      const newAvatar = e?.detail?.avatarUrl;
      if (newAvatar !== undefined) {
        setCurrentUser(prev => ({ ...prev, avatar: newAvatar || '' }));
      }
    };
    window.addEventListener('user_avatar_changed', handleAvatarChange);
    return () => window.removeEventListener('user_avatar_changed', handleAvatarChange);
  }, []);

  const reloadUsers = useCallback(async (showSpinner = false) => {
    const activeId = user?.id || getPersistedDeviceSession()?.user?.id || currentUser.id;
    if (!activeId || activeId === 'me') {
      setDirectoryError('Waiting for verified user session. Click Retry Sync if you just signed in.');
      setIsSupabaseLive(false);
      if (showSpinner) setIsRefreshing(false);
      return;
    }
    if (showSpinner) setIsRefreshing(true);
    try {
      const res = await fetchSearchableUsersFromSupabase(activeId, {
        search: '',
        role: 'all',
      });
      if (res.isSupabaseLive) {
        setUsersList(res.users);
        setIsSupabaseLive(true);
        setDirectoryError(null);
      } else {
        setIsSupabaseLive(false);
        setDirectoryError(res.error || 'Could not reach member directory.');
      }
    } finally {
      if (showSpinner) setIsRefreshing(false);
    }
  }, [user?.id, currentUser.id]);

  const reloadUsersRef = useRef(reloadUsers);
  reloadUsersRef.current = reloadUsers;

  // Initial Sync & Fetch
  useEffect(() => {
    const initPortal = async () => {
      setIsLoading(true);
      // 1. Sync current user to Supabase profiles without mock overwrites
      if (user?.id && (profile || user?.user_metadata)) {
        await syncCurrentUserToSupabase(user, {
          name: currentUser.name,
          role: currentUser.role,
          title: currentUser.title,
          institution: profile?.institution || user?.user_metadata?.institution || currentUser.institution || undefined,
          subjects: currentUser.subjects.length ? currentUser.subjects : undefined,
          bio: profile?.bio || user?.user_metadata?.bio || currentUser.bio || undefined,
          avatar: liveAvatarUrl || profile?.avatar_url || user?.user_metadata?.avatar_url || currentUser.avatar || undefined,
          location: profile?.location || profile?.country || user?.user_metadata?.country || currentUser.location || undefined,
        });
      }

      // 2. Fetch all searchable members from Supabase & server directory
      await reloadUsersRef.current(false);
      setIsLoading(false);
    };

    initPortal();
  }, [user?.id, currentUser.role, liveAvatarUrl, profile?.avatar_url, profile?.full_name]);

  // Realtime subscription for WebSocket + Supabase friend_requests + focus/poll updates
  useEffect(() => {
    const activeId = user?.id || getPersistedDeviceSession()?.user?.id || currentUser.id;
    socialWsClient.start();
    const unsub = socialWsClient.subscribe((ev: SocialWsEvent) => {
      if (ev.type === 'auth:ok') {
        void reloadUsersRef.current(false);
        const onlineSet = new Set(ev.onlineUserIds || []);
        setUsersList(prev => prev.map(u => ({ ...u, status: onlineSet.has(u.id) ? 'online' : 'offline' })));
      } else if (ev.type === 'presence:update') {
        const onlineSet = new Set(ev.onlineUserIds || []);
        setUsersList(prev => prev.map(u => ({ ...u, status: onlineSet.has(u.id) ? 'online' : 'offline' })));
      } else if (
        ev.type === 'friend:request' ||
        ev.type === 'friend:responded' ||
        ev.type === 'friend:removed' ||
        ev.type === 'social:directory-updated'
      ) {
        void reloadUsersRef.current(false);
      }
    });

    const onSessionRefreshed = () => {
      void reloadUsersRef.current(false);
    };
    const onSocialUpdated = () => {
      void reloadUsersRef.current(false);
    };
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        void reloadUsersRef.current(false);
      }
    };

    window.addEventListener(SOCIAL_SESSION_REFRESHED_EVENT, onSessionRefreshed);
    window.addEventListener('eduai_social_updated', onSocialUpdated);
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    const pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void reloadUsersRef.current(false);
      }
    }, 12000);

    // Supabase Realtime subscription on friend_requests table for instant cross-instance sync
    let sbChannel: any = null;
    const sbClient = getSupabaseClient() || supabase;
    if (sbClient && activeId && activeId !== 'me') {
      try {
        sbChannel = sbClient
          .channel(`portal_friend_requests_${activeId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'friend_requests' },
            (payload: any) => {
              const row = payload?.new || payload?.old;
              if (!row || row.sender_id === activeId || row.receiver_id === activeId) {
                void reloadUsersRef.current(false);
              }
            }
          )
          .subscribe();
      } catch (_) {}
    }

    return () => {
      unsub();
      window.clearInterval(pollTimer);
      window.removeEventListener(SOCIAL_SESSION_REFRESHED_EVENT, onSessionRefreshed);
      window.removeEventListener('eduai_social_updated', onSocialUpdated);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
      if (sbChannel && sbClient) {
        try {
          void sbClient.removeChannel(sbChannel);
        } catch (_) {}
      }
    };
  }, [user?.id, currentUser.id]);

  // If user types a search query while directory failed or hasn't loaded yet, retry loading automatically (rate-limited)
  const lastSearchRetryAtRef = useRef(0);
  useEffect(() => {
    if (!searchQuery.trim() || isLoading || isRefreshing) return;
    const otherCount = usersList.filter((u) => u.id !== currentUser.id).length;
    if (otherCount > 0) return;
    const now = Date.now();
    if (now - lastSearchRetryAtRef.current < 3000) return;
    lastSearchRetryAtRef.current = now;
    void reloadUsersRef.current(false);
  }, [searchQuery, usersList, currentUser.id, isLoading, isRefreshing]);

  // Toast feedback helper
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Filtered Users computation
  const subjectsList = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 
    'Computer Science', 'Literature', 'English', 'ICT', 'Agriculture'
  ];

  const filteredUsers = useMemo(() => {
    return usersList.filter(u => {
      if (u.id === currentUser.id) return false;

      // Search match
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const qTokens = q.split(/\s+/).filter(Boolean);
        const emailLower = (u.email || '').toLowerCase();
        const emailHandle = emailLower.includes('@') ? emailLower.split('@')[0] : '';
        const roleKeywords =
          u.role === 'teacher' || u.role === 'educator'
            ? 'teacher educator faculty'
            : u.role === 'admin'
            ? 'admin administrator'
            : 'student scholar learner';
        const targetString = `${u.name || ''} ${emailLower} ${emailHandle} ${u.phone || ''} ${u.institution || ''} ${u.title || ''} ${(u.subjects || []).join(' ')} ${u.bio || ''} ${u.location || ''} ${roleKeywords}`.toLowerCase();
        const matchesSearch = qTokens.every(token => targetString.includes(token)) || targetString.includes(q);
        if (!matchesSearch) return false;
      }

      // Role filter
      if (roleFilter === 'teacher' && u.role !== 'teacher' && u.role !== 'educator') return false;
      if (roleFilter === 'student' && u.role !== 'student') return false;
      if (roleFilter === 'friends' && u.friendStatus !== 'friends') return false;
      if (roleFilter === 'pending' && u.friendStatus !== 'pending_received' && u.friendStatus !== 'pending_sent') return false;

      // Subject filter
      if (selectedSubject !== 'all') {
        if (!(u.subjects || []).some(s => s.toLowerCase().includes(selectedSubject.toLowerCase()))) {
          return false;
        }
      }

      return true;
    });
  }, [usersList, currentUser.id, searchQuery, roleFilter, selectedSubject]);

  const pendingReceivedUsers = useMemo(
    () => usersList.filter(u => u.id !== currentUser.id && u.friendStatus === 'pending_received'),
    [usersList, currentUser.id]
  );
  const pendingReceivedCount = pendingReceivedUsers.length;
  const friendsCount = usersList.filter(u => u.id !== currentUser.id && u.friendStatus === 'friends').length;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('eduai_social_counts_updated', {
        detail: { incomingCount: pendingReceivedCount },
      })
    );
  }, [pendingReceivedCount]);

  // Handlers
  const handleOpenSendRequest = (target: ChatUser) => {
    setRequestTargetUser(target);
    setCustomRequestNote(`Hello ${target.name}, let's connect on Edu AI for academic discussions and study collaboration.`);
  };

  const handleConfirmSendRequest = async () => {
    if (!requestTargetUser) return;
    const target = requestTargetUser;
    setRequestTargetUser(null);
    const res = await sendSupabaseFriendRequest(target.id, currentUser.id, customRequestNote);
    if (res.success) {
      const nextStatus = res.status === 'accepted' ? 'friends' : 'pending_sent';
      showToast(
        nextStatus === 'friends'
          ? `Connected with ${target.name}!`
          : `Friend request sent to ${target.name}!`,
        'success'
      );
      setUsersList(prev => prev.map(u => u.id === target.id ? { ...u, friendStatus: nextStatus } : u));
      void reloadUsers(false);
    } else {
      showToast(res.error || 'Could not send friend request.', 'error');
    }
  };

  const handleAcceptRequest = async (target: ChatUser) => {
    const res = await respondToSupabaseFriendRequest(target.id, currentUser.id, 'accept');
    if (res.success) {
      showToast(`Connected with ${target.name}! You can now message them.`, 'success');
      setUsersList(prev => prev.map(u => u.id === target.id ? { ...u, friendStatus: 'friends' } : u));
      if (inspectUser?.id === target.id) {
        setInspectUser({ ...inspectUser, friendStatus: 'friends' });
      }
      void reloadUsers(false);
    } else {
      showToast(res.error || 'Could not accept friend request.', 'error');
    }
  };

  const handleDeclineRequest = async (target: ChatUser) => {
    const res = await respondToSupabaseFriendRequest(target.id, currentUser.id, 'decline');
    if (res.success) {
      showToast(`Declined friend request from ${target.name}.`, 'info');
      setUsersList(prev => prev.map(u => u.id === target.id ? { ...u, friendStatus: 'none' } : u));
      if (inspectUser?.id === target.id) {
        setInspectUser({ ...inspectUser, friendStatus: 'none' });
      }
      void reloadUsers(false);
    } else {
      showToast(res.error || 'Could not decline friend request.', 'error');
    }
  };

  const handleCancelRequest = async (target: ChatUser, wasFriend = false) => {
    const res = await cancelOrRemoveSupabaseFriendship(target.id, currentUser.id);
    if (res.success) {
      showToast(
        wasFriend ? `Removed ${target.name} from your friends list.` : `Cancelled friend request to ${target.name}.`,
        'info'
      );
      setUsersList(prev => prev.map(u => u.id === target.id ? { ...u, friendStatus: 'none' } : u));
      if (inspectUser?.id === target.id) {
        setInspectUser({ ...inspectUser, friendStatus: 'none' });
      }
      void reloadUsers(false);
    } else {
      showToast('Could not update connection.', 'error');
    }
  };

  const handleSaveProfile = async () => {
    const updatedUser: ChatUser = {
      ...currentUser,
      name: editFormData.name,
      role: editFormData.role as UserRole,
      title: editFormData.title,
      institution: editFormData.institution,
      location: editFormData.location,
      subjects: editFormData.subjects.split(',').map(s => s.trim()).filter(Boolean),
      bio: editFormData.bio
    };

    setCurrentUser(updatedUser);
    safeStorage.setJSON(getPeerCurrentUserStorageKey(user?.id), updatedUser);

    if (user?.id) {
      await syncCurrentUserToSupabase(user, {
        name: updatedUser.name,
        role: updatedUser.role,
        title: updatedUser.title,
        institution: updatedUser.institution,
        subjects: updatedUser.subjects,
        bio: updatedUser.bio,
        avatar: updatedUser.avatar,
        location: updatedUser.location
      });

      const token = getPersistedDeviceSession()?.access_token || '';
      if (token) {
        try {
          await fetch('/api/auth/preferences', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              full_name: updatedUser.name,
              role: updatedUser.role,
              title: updatedUser.title,
              institution: updatedUser.institution,
              subjects: updatedUser.subjects.join(', '),
              bio: updatedUser.bio,
              location: updatedUser.location,
            }),
          });
        } catch (_) {}
      }

      pushAccountSyncPatch(
        user.id,
        {
          profileSnapshot: {
            full_name: updatedUser.name,
            role: updatedUser.role,
            title: updatedUser.title,
            institution: updatedUser.institution,
            subjects: updatedUser.subjects.join(', '),
            bio: updatedUser.bio,
            location: updatedUser.location,
            avatar_url: updatedUser.avatar,
          },
        },
        token,
        { immediate: true }
      );
    }

    setIsEditProfileOpen(false);
    showToast('Your profile has been synced across all devices!', 'success');
  };

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Toast Notification */}
        {statusMessage && (
          <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-semibold ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-500 text-white border-emerald-400' 
                : statusMessage.type === 'error'
                ? 'bg-rose-500 text-white border-rose-400'
                : 'bg-slate-900 text-white border-slate-700'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>{statusMessage.text}</span>
            </div>
          </div>
        )}

        {/* Portal Hero Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Academic Member Directory · {isSupabaseLive ? 'Live Cloud Directory' : 'Cached Directory'}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
                Classmates & Educators
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                Search and connect with faculty educators and fellow students across Edu AI. Accepted connections unlock direct messaging and study groups.
              </p>
            </div>

            {/* Current User Card & Edit Profile Button */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 flex items-center gap-3">
                <AvatarBadge
                  name={currentUser.name}
                  avatarUrl={currentUser.avatar}
                  role={currentUser.role}
                  isOnline={true}
                  size="md"
                />
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {currentUser.role === 'admin' ? 'Platform Admin' : currentUser.role === 'teacher' ? 'Educator' : 'Student'} · Discoverable
                  </p>
                </div>
                <button
                  onClick={() => setIsEditProfileOpen(true)}
                  className="p-2 rounded-xl bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition-colors cursor-pointer"
                  title="Edit my searchable profile"
                >
                  <Edit3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Search, Filter Tabs & Subject Chips */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          
          {/* Main Search Input */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by member name, email, subject (e.g. Physics, Calculus), or institution..."
              className="w-full pl-12 pr-12 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
              {[
                { id: 'all', label: `All Members (${Math.max(0, usersList.filter(u => u.id !== currentUser.id).length)})` },
                { id: 'teacher', label: `Teachers (${usersList.filter(u => u.id !== currentUser.id && (u.role === 'teacher' || u.role === 'educator')).length})` },
                { id: 'student', label: `Students (${usersList.filter(u => u.id !== currentUser.id && u.role === 'student').length})` },
                { id: 'friends', label: `Friends (${friendsCount})` },
                { 
                  id: 'pending', 
                  label: pendingReceivedCount > 0 ? `Requests (${pendingReceivedCount} New)` : 'Requests'
                }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRoleFilter(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer tabular-nums ${
                    roleFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <button
                type="button"
                onClick={() => void reloadUsers(true)}
                disabled={isRefreshing}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                title="Refresh registered members list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredUsers.length}</span> members found
              </span>
            </div>
          </div>

          {/* Subject Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pt-1">
            <span className="text-xs text-slate-400 font-medium shrink-0 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" /> Filter by Subject:
            </span>
            <button
              onClick={() => setSelectedSubject('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedSubject === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Subjects
            </button>
            {subjectsList.map(subj => (
              <button
                key={subj}
                onClick={() => setSelectedSubject(selectedSubject === subj ? 'all' : subj)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedSubject === subj
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {subj}
              </button>
            ))}
          </div>
        </div>

        {/* Incoming Friend Requests Spotlight Banner */}
        {pendingReceivedUsers.length > 0 && roleFilter !== 'pending' && (
          <div className="bg-indigo-50/90 dark:bg-indigo-950/35 rounded-3xl p-4 sm:p-5 border border-indigo-200/80 dark:border-indigo-800/70 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
                  Incoming Friend {pendingReceivedUsers.length === 1 ? 'Request' : 'Requests'} ({pendingReceivedUsers.length})
                </h2>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                  Accept a request to add them to your Friends list and start messaging immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoleFilter('pending')}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
              >
                View All Requests
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingReceivedUsers.map((sender) => (
                <div
                  key={`incoming_${sender.id}`}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-indigo-200/70 dark:border-indigo-800/60 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AvatarBadge
                      name={sender.name}
                      avatarUrl={sender.avatar}
                      role={sender.role}
                      isOnline={sender.status === 'online'}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {sender.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {sender.email || sender.institution || sender.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleAcceptRequest(sender)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeclineRequest(sender)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Decline request"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Directory Grid */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Loading registered members...</p>
          </div>
        ) : directoryError && usersList.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-amber-200 dark:border-amber-900/50 shadow-sm">
            <Users className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Unable to load directory right now</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {directoryError}
            </p>
            <button
              onClick={() => void reloadUsers(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Retry Sync
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          usersList.filter(u => u.id !== currentUser.id).length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No registered members loaded yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Click Refresh Directory to sync all registered students and educators from the server.
              </p>
              <button
                onClick={() => void reloadUsers(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh Directory
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No matching members found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                We couldn't find anyone matching your search criteria. Try adjusting your search keyword or clearing filters.
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedSubject('all'); setRoleFilter('all'); }}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredUsers.map(member => {
              const isTeacher = member.role === 'teacher' || member.role === 'educator';
              const isAdmin = member.role === 'admin';
              
              return (
                <div 
                  key={member.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800/80 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    {/* Top Row: Avatar, Name & Role */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <AvatarBadge
                          name={member.name}
                          avatarUrl={member.avatar}
                          role={member.role}
                          isOnline={member.status === 'online'}
                          size="lg"
                          shape="rounded"
                        />
                        <div className="min-w-0">
                          <h3 
                            onClick={() => setInspectUser(member)}
                            className="text-sm font-bold text-slate-900 dark:text-white truncate hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                          >
                            {member.name}
                          </h3>
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate mt-0.5">
                            {isAdmin ? 'Platform Admin' : isTeacher ? 'Educator' : 'Student'} · {member.title}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 truncate mt-0.5">
                            <School className="w-3 h-3 shrink-0" />
                            <span>{member.institution}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {member.bio}
                    </p>

                    {/* Subjects Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(member.subjects || []).slice(0, 3).map((s, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-medium"
                        >
                          {s}
                        </span>
                      ))}
                      {(member.subjects || []).length > 3 && (
                        <span className="px-1.5 py-0.5 text-slate-400 text-[10px] font-medium">
                          +{(member.subjects || []).length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Row */}
                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setInspectUser(member)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      View Profile
                    </button>

                    {/* Friend Status Decision Tree */}
                    {member.friendStatus === 'friends' ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <Check className="w-3.5 h-3.5" /> Friends
                        </span>
                        <button
                          onClick={() => {
                            if (onStartChat) onStartChat(member.id);
                            else if (onNavigate) onNavigate('chat');
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Message
                        </button>
                      </div>
                    ) : member.friendStatus === 'pending_received' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleAcceptRequest(member)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition-colors shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(member)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Decline"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : member.friendStatus === 'pending_sent' ? (
                      <button
                        onClick={() => handleCancelRequest(member)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 transition-colors"
                        title="Cancel sent request"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-500" /> Pending (Cancel)
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenSendRequest(member)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-950/60 dark:hover:bg-indigo-600 dark:text-indigo-300 dark:hover:text-white border border-indigo-200 dark:border-indigo-800 hover:border-indigo-600 flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Connect / Request
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 1. Personalized Send Request Modal */}
      {requestTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AvatarBadge
                  name={requestTargetUser.name}
                  avatarUrl={requestTargetUser.avatar}
                  role={requestTargetUser.role}
                  size="md"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Connect with {requestTargetUser.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {requestTargetUser.title} · {requestTargetUser.institution}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setRequestTargetUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Personalized Academic Note (Optional)
              </label>
              <textarea
                value={customRequestNote}
                onChange={(e) => setCustomRequestNote(e.target.value)}
                rows={3}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                placeholder="Include a short message with your friend request..."
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setRequestTargetUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSendRequest}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. User Detail Inspector Modal */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <AvatarBadge
                  name={inspectUser.name}
                  avatarUrl={inspectUser.avatar}
                  role={inspectUser.role}
                  isOnline={inspectUser.status === 'online'}
                  size="lg"
                  shape="rounded"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {inspectUser.name}
                    </h2>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      inspectUser.role === 'teacher' 
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' 
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                    }`}>
                      {inspectUser.role}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">{inspectUser.title}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <School className="w-3.5 h-3.5" /> {inspectUser.institution}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setInspectUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 py-2 border-y border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Academic Bio</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{inspectUser.bio}</p>
              </div>

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Subjects & Specializations</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(inspectUser.subjects || []).map((s, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {inspectUser.location && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{inspectUser.location}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setInspectUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
              {inspectUser.friendStatus === 'friends' ? (
                <>
                  <button
                    onClick={() => void handleCancelRequest(inspectUser, true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserMinus className="w-3.5 h-3.5" /> Remove Friend
                  </button>
                  <button
                    onClick={() => {
                      setInspectUser(null);
                      if (onStartChat) onStartChat(inspectUser.id);
                      else if (onNavigate) onNavigate('chat');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Start Messaging
                  </button>
                </>
              ) : inspectUser.friendStatus === 'pending_received' ? (
                <>
                  <button
                    onClick={() => void handleDeclineRequest(inspectUser)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => void handleAcceptRequest(inspectUser)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Accept Request
                  </button>
                </>
              ) : inspectUser.friendStatus === 'pending_sent' ? (
                <button
                  onClick={() => void handleCancelRequest(inspectUser, false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Cancel Pending Request
                </button>
              ) : (
                <button
                  onClick={() => {
                    setInspectUser(null);
                    handleOpenSendRequest(inspectUser);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Connect
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Edit My Directory Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Your Supabase Directory Profile
                  </h3>
                  <p className="text-xs text-slate-400">
                    Update how you appear to teachers and students searching the directory
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditProfileOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Academic Role</label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as any })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 outline-none"
                  >
                    <option value="student">Student / Scholar</option>
                    <option value="teacher">Teacher / Faculty Lead</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Title / Grade</label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    placeholder="e.g. Senior High (Grade 12)"
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">School / Institution</label>
                <input
                  type="text"
                  value={editFormData.institution}
                  onChange={(e) => setEditFormData({ ...editFormData, institution: e.target.value })}
                  placeholder="e.g. Nairobi Academic Senior Secondary"
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Subjects (comma-separated)</label>
                <input
                  type="text"
                  value={editFormData.subjects}
                  onChange={(e) => setEditFormData({ ...editFormData, subjects: e.target.value })}
                  placeholder="Physics, Mathematics, Computer Science"
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Academic Bio / Study Focus</label>
                <textarea
                  value={editFormData.bio}
                  onChange={(e) => setEditFormData({ ...editFormData, bio: e.target.value })}
                  rows={3}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm shadow-indigo-500/20"
              >
                <Check className="w-3.5 h-3.5" /> Save to Supabase
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
