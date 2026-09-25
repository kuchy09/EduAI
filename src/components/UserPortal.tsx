import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Users, GraduationCap, BookOpen, School, 
  UserPlus, UserCheck, Clock, Check, X, 
  Sparkles, Filter, ShieldCheck, MapPin, Mail, 
  MessageSquare, RefreshCw, Database, CheckCircle2,
  AlertCircle, Edit3, Send, ChevronRight, UserMinus
} from 'lucide-react';
import { ChatUser, FriendStatus, UserRole } from './chat/types';
import { 
  fetchSearchableUsersFromSupabase, 
  sendSupabaseFriendRequest, 
  respondToSupabaseFriendRequest, 
  cancelOrRemoveSupabaseFriendship, 
  syncCurrentUserToSupabase 
} from '../lib/userDirectoryService';
import { supabase } from '../lib/supabase';
import { getStoredUserAvatar } from '../lib/userAvatarService';

interface UserPortalProps {
  user?: any;
  profile?: any;
  onStartChat?: (userId: string) => void;
  onNavigate?: (view: string) => void;
}

export function UserPortal({ user, profile, onStartChat, onNavigate }: UserPortalProps) {
  // Current user's identity
  const [currentUser, setCurrentUser] = useState<ChatUser>(() => {
    const saved = localStorage.getItem('eduai_chat_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    const detectedRole: UserRole = (profile?.role || user?.user_metadata?.role || 'student') as UserRole;
    const customAvatar = getStoredUserAvatar(user);
    return {
      id: user?.id || 'me',
      name: profile?.full_name || user?.user_metadata?.full_name || 'Dickson Skello',
      email: user?.email || 'dicksonskello09@gmail.com',
      avatar: customAvatar || profile?.avatar_url || user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: detectedRole === 'teacher' ? 'teacher' : 'student',
      title: detectedRole === 'teacher' ? 'Senior Educator & Faculty Lead' : 'Senior High Student (Grade 12 CBC)',
      institution: 'Nairobi Academic Senior Secondary',
      status: 'online',
      lastSeen: 'Active now',
      subjects: ['Physics', 'Mathematics', 'Computer Science'],
      friendStatus: 'friends',
      bio: 'Passionate STEM student preparing for university engineering pathways.',
      location: 'Nairobi, Kenya'
    };
  });

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'student' | 'friends' | 'pending'>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [usersList, setUsersList] = useState<ChatUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupabaseLive, setIsSupabaseLive] = useState(false);
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
    location: currentUser.location || 'Nairobi, Kenya',
    subjects: currentUser.subjects.join(', '),
    bio: currentUser.bio
  });

  // Send request note modal
  const [requestTargetUser, setRequestTargetUser] = useState<ChatUser | null>(null);
  const [customRequestNote, setCustomRequestNote] = useState('');

  // Realtime avatar updates
  useEffect(() => {
    const handleAvatarChange = (e: any) => {
      const newAvatar = e?.detail?.avatarUrl;
      if (newAvatar) {
        setCurrentUser(prev => ({ ...prev, avatar: newAvatar }));
      }
    };
    window.addEventListener('user_avatar_changed', handleAvatarChange);
    return () => window.removeEventListener('user_avatar_changed', handleAvatarChange);
  }, []);

  // Initial Sync & Fetch
  useEffect(() => {
    const initPortal = async () => {
      setIsLoading(true);
      // 1. Sync current user to Supabase profiles
      if (user?.id) {
        await syncCurrentUserToSupabase(user, {
          name: currentUser.name,
          role: currentUser.role,
          title: currentUser.title,
          institution: currentUser.institution,
          subjects: currentUser.subjects,
          bio: currentUser.bio,
          avatar: currentUser.avatar,
          location: currentUser.location
        });
      }

      // 2. Fetch all searchable members from Supabase
      await reloadUsers();
      setIsLoading(false);
    };

    initPortal();
  }, [user?.id, currentUser.role]);

  // Realtime subscription for Supabase friend updates
  useEffect(() => {
    if (!supabase) return;
    try {
      const channel = supabase.channel('eduai-friendships-portal-channel', {
        config: { broadcast: { ack: false, self: false } }
      });

      channel.on('broadcast', { event: 'friend_request_sent' }, () => {
        reloadUsers();
      });

      channel.on('broadcast', { event: 'friend_request_responded' }, () => {
        reloadUsers();
      });

      channel.subscribe();

      return () => {
        if (supabase) supabase.removeChannel(channel);
      };
    } catch (e) {}
  }, []);

  const reloadUsers = async () => {
    const res = await fetchSearchableUsersFromSupabase(currentUser.id, {
      search: searchQuery,
      role: roleFilter === 'teacher' ? 'teacher' : roleFilter === 'student' ? 'student' : undefined
    });
    setUsersList(res.users);
    setIsSupabaseLive(res.isSupabaseLive);
  };

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
        const targetString = `${u.name} ${u.email || ''} ${u.institution} ${u.title} ${u.subjects.join(' ')} ${u.bio || ''} ${u.location || ''}`.toLowerCase();
        const matchesSearch = qTokens.every(token => targetString.includes(token)) || targetString.includes(q);
        if (!matchesSearch) return false;
      }

      // Role filter
      if (roleFilter === 'teacher' && u.role !== 'teacher') return false;
      if (roleFilter === 'student' && u.role !== 'student') return false;
      if (roleFilter === 'friends' && u.friendStatus !== 'friends') return false;
      if (roleFilter === 'pending' && u.friendStatus !== 'pending_received' && u.friendStatus !== 'pending_sent') return false;

      // Subject filter
      if (selectedSubject !== 'all') {
        if (!u.subjects.some(s => s.toLowerCase().includes(selectedSubject.toLowerCase()))) {
          return false;
        }
      }

      return true;
    });
  }, [usersList, currentUser.id, searchQuery, roleFilter, selectedSubject]);

  const pendingReceivedCount = usersList.filter(u => u.id !== currentUser.id && u.friendStatus === 'pending_received').length;
  const friendsCount = usersList.filter(u => u.id !== currentUser.id && u.friendStatus === 'friends').length;

  // Handlers
  const handleOpenSendRequest = (target: ChatUser) => {
    setRequestTargetUser(target);
    setCustomRequestNote(`Hello ${target.name}, let's connect on Edu AI for academic discussions and study collaboration.`);
  };

  const handleConfirmSendRequest = async () => {
    if (!requestTargetUser) return;
    const res = await sendSupabaseFriendRequest(requestTargetUser.id, currentUser.id, customRequestNote);
    if (res.success) {
      showToast(`Friend request sent to ${requestTargetUser.name}!`, 'success');
      setUsersList(prev => prev.map(u => u.id === requestTargetUser.id ? { ...u, friendStatus: 'pending_sent' } : u));
    }
    setRequestTargetUser(null);
  };

  const handleAcceptRequest = async (target: ChatUser) => {
    const res = await respondToSupabaseFriendRequest(target.id, currentUser.id, 'accepted');
    if (res.success) {
      showToast(`Connected with ${target.name}! You can now message them.`, 'success');
      setUsersList(prev => prev.map(u => u.id === target.id ? { ...u, friendStatus: 'friends' } : u));
    }
  };

  const handleDeclineRequest = async (target: ChatUser) => {
    const res = await respondToSupabaseFriendRequest(target.id, currentUser.id, 'declined');
    if (res.success) {
      showToast(`Declined friend request from ${target.name}.`, 'info');
      setUsersList(prev => prev.map(u => u.id === target.id ? { ...u, friendStatus: 'none' } : u));
    }
  };

  const handleCancelRequest = async (target: ChatUser) => {
    await cancelOrRemoveSupabaseFriendship(target.id, currentUser.id);
    showToast(`Cancelled friend request to ${target.name}.`, 'info');
    setUsersList(prev => prev.map(u => u.id === target.id ? { ...u, friendStatus: 'none' } : u));
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
    localStorage.setItem('eduai_chat_current_user', JSON.stringify(updatedUser));

    if (user?.id) {
      await syncCurrentUserToSupabase(user, {
        name: updatedUser.name,
        role: updatedUser.role,
        title: updatedUser.title,
        institution: updatedUser.institution,
        subjects: updatedUser.subjects,
        bio: updatedUser.bio,
        location: updatedUser.location
      });
    }

    setIsEditProfileOpen(false);
    showToast('Your Supabase search profile has been updated and is now discoverable!', 'success');
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
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Supabase Cloud Directory
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {isSupabaseLive ? 'Live PostgreSQL Synchronized' : 'Local & Offline Cached'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Academic Member Directory & Friend Portal
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                Discover, search, and connect with faculty educators, professors, and fellow students across the platform. Send friend requests to unlock direct messaging and study collaborations.
              </p>
            </div>

            {/* Current User Discoverability Card & Edit Profile Button */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 flex items-center gap-3">
                <img 
                  src={currentUser.avatar} 
                  alt={currentUser.name} 
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-indigo-500/30"
                />
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
                    <span className="text-[9px] px-1.5 py-0.2 font-semibold uppercase bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded">
                      {currentUser.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Discoverable in Supabase</p>
                </div>
                <button
                  onClick={() => setIsEditProfileOpen(true)}
                  className="p-2 rounded-xl bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition-colors shadow-xs"
                  title="Edit my searchable profile"
                >
                  <Edit3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Search, Filter Tabs & Subject Chips */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          
          {/* Main Search Input */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by educator name, student, subject (e.g. Physics, Calculus, Algorithms), institution, or bio..."
              className="w-full pl-12 pr-12 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
              {[
                { id: 'all', label: 'All Members', count: usersList.length - 1 },
                { id: 'teacher', label: 'Teachers & Faculty 🎓', count: usersList.filter(u => u.id !== currentUser.id && u.role === 'teacher').length },
                { id: 'student', label: 'Students & Peers 🎒', count: usersList.filter(u => u.id !== currentUser.id && u.role === 'student').length },
                { id: 'friends', label: `Friends (${friendsCount}) 🤝` },
                { 
                  id: 'pending', 
                  label: `Requests ${pendingReceivedCount > 0 ? `(${pendingReceivedCount} New)` : ''} 📬` 
                }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRoleFilter(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    roleFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredUsers.length}</span> members found
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

        {/* Directory Grid */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Searching Supabase directory...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No matching members found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              We couldn't find anyone matching your search criteria in the Supabase user directory. Try adjusting your search keyword or clearing subject filters.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedSubject('all'); setRoleFilter('all'); }}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredUsers.map(member => {
              const isTeacher = member.role === 'teacher';
              
              return (
                <div 
                  key={member.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800/80 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    {/* Top Row: Avatar, Online Dot, Name & Role Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img 
                            src={member.avatar} 
                            alt={member.name} 
                            className="w-13 h-13 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-slate-800 shadow-xs" 
                          />
                          {member.status === 'online' && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-xs" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 
                              onClick={() => setInspectUser(member)}
                              className="text-sm font-bold text-slate-900 dark:text-white truncate hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                            >
                              {member.name}
                            </h3>
                          </div>
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate mt-0.5">
                            {member.title}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 truncate mt-0.5">
                            <School className="w-3 h-3 shrink-0" />
                            <span>{member.institution}</span>
                          </p>
                        </div>
                      </div>

                      {/* Role Pill */}
                      <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        isTeacher 
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700' 
                          : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                      }`}>
                        {isTeacher ? 'Teacher' : 'Student'}
                      </span>
                    </div>

                    {/* Bio */}
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {member.bio}
                    </p>

                    {/* Subjects Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {member.subjects.slice(0, 3).map((s, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-medium"
                        >
                          {s}
                        </span>
                      ))}
                      {member.subjects.length > 3 && (
                        <span className="px-1.5 py-0.5 text-slate-400 text-[10px] font-medium">
                          +{member.subjects.length - 3} more
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
                <img 
                  src={requestTargetUser.avatar} 
                  alt={requestTargetUser.name} 
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-indigo-500/30"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Connect with {requestTargetUser.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {requestTargetUser.title} • {requestTargetUser.institution}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setRequestTargetUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSendRequest}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm shadow-indigo-500/20"
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
                <div className="relative">
                  <img 
                    src={inspectUser.avatar} 
                    alt={inspectUser.name} 
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-500/20"
                  />
                  {inspectUser.status === 'online' && (
                    <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
                  )}
                </div>
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
                  {inspectUser.subjects.map((s, idx) => (
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
                <button
                  onClick={() => {
                    setInspectUser(null);
                    if (onStartChat) onStartChat(inspectUser.id);
                    else if (onNavigate) onNavigate('chat');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Start Messaging
                </button>
              ) : inspectUser.friendStatus === 'none' ? (
                <button
                  onClick={() => {
                    setInspectUser(null);
                    handleOpenSendRequest(inspectUser);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Connect
                </button>
              ) : null}
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
