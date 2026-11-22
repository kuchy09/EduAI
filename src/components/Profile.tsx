import { Mail, MapPin, Building, Calendar, BookOpen, GraduationCap, BarChart2, LogOut, Award, Star, Clock, Camera, Loader2 } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { supabase, clearStaleSupabaseTokens, getPersistedDeviceSession } from '../lib/supabase';
import { saveUserAvatarLocally, useUserAvatar, getPublicAvatarUrl, uploadAndSyncUserAvatar, markAvatarUrlFailed } from '../lib/userAvatarService';
import { extractUserAcademicProfile, ACADEMIC_PREFS_EVENT } from '../lib/bookPersonalization';
import { ACCOUNT_SYNC_EVENT, pushAccountSyncPatch } from '../lib/accountSyncService';
import {
  getStoredAchievements,
  ACHIEVEMENTS_UPDATED_EVENT,
  UserAchievementState,
  getScholarRank,
} from '../lib/achievementsService';
import { getDailyGoal, GOAL_EVENT_NAME } from '../lib/readingGoal';
import { BadgesShowcase } from './BadgesShowcase';

export interface ProfileProps {
  user?: any;
  profile?: any;
  onNavigate?: (view: string) => void;
  onSignOut?: () => void;
  onOpenAcademicPrefs?: () => void;
}

export function Profile({ user: propUser, profile: propProfile, onNavigate, onSignOut, onOpenAcademicPrefs }: ProfileProps = {}) {
  const [user, setUser] = useState<any>(propUser || null);
  const [profile, setProfile] = useState<any>(propProfile || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarUrl = useUserAvatar(user, profile);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [prefsTick, setPrefsTick] = useState(0);
  const [achievements, setAchievements] = useState<UserAchievementState>(() =>
    getStoredAchievements(propUser?.id)
  );
  const [studyMinutes, setStudyMinutes] = useState<number>(() => {
    const g = getDailyGoal();
    return Object.values(g.history || {}).reduce((acc, h) => acc + (h.minutes || 0), 0);
  });

  useEffect(() => {
    setAchievements(getStoredAchievements(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const onPrefsUpdated = () => setPrefsTick((t) => t + 1);
    const onAccountSync = (e: any) => {
      if (e?.detail?.profile) {
        setProfile((prev: any) => ({ ...(prev || {}), ...e.detail.profile }));
      }
      setAchievements(getStoredAchievements(user?.id));
      setPrefsTick((t) => t + 1);
    };
    const onAchievementsUpdated = () => {
      setAchievements(getStoredAchievements(user?.id));
    };
    const onGoalUpdated = () => {
      const g = getDailyGoal();
      setStudyMinutes(Object.values(g.history || {}).reduce((acc, h) => acc + (h.minutes || 0), 0));
    };
    window.addEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
    window.addEventListener(ACCOUNT_SYNC_EVENT, onAccountSync);
    window.addEventListener(ACHIEVEMENTS_UPDATED_EVENT, onAchievementsUpdated);
    window.addEventListener(GOAL_EVENT_NAME, onGoalUpdated);
    return () => {
      window.removeEventListener(ACADEMIC_PREFS_EVENT, onPrefsUpdated);
      window.removeEventListener(ACCOUNT_SYNC_EVENT, onAccountSync);
      window.removeEventListener(ACHIEVEMENTS_UPDATED_EVENT, onAchievementsUpdated);
      window.removeEventListener(GOAL_EVENT_NAME, onGoalUpdated);
    };
  }, [user?.id]);

  const academicProfile = React.useMemo(
    () => extractUserAcademicProfile(profile, user),
    [profile, user, prefsTick]
  );

  const scholarRank = React.useMemo(
    () => getScholarRank(achievements.totalEduPoints),
    [achievements.totalEduPoints]
  );

  const earnedBadgesCount = Object.keys(achievements.earnedBadges).length;
  const completedQuizzes = Object.values(achievements.completedQuizIds);
  const avgQuizScore =
    completedQuizzes.length > 0
      ? Math.round(completedQuizzes.reduce((acc, q) => acc + q.bestScore, 0) / completedQuizzes.length)
      : 0;
  const studyHoursDisplay = studyMinutes >= 60 ? `${Math.round((studyMinutes / 60) * 10) / 10}h` : `${studyMinutes}m`;

  useEffect(() => {
    if (propUser) setUser(propUser);
  }, [propUser]);

  useEffect(() => {
    if (propProfile) setProfile(propProfile);
  }, [propProfile]);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    let isMounted = true;

    const loadUserData = async () => {
      try {
        let activeUser = propUser || null;
        if (supabase) {
          const res = await supabase.auth.getUser();
          if (res?.error) {
            if (res.error.message?.includes('Refresh Token') || res.error.message?.includes('refresh_token')) {
              clearStaleSupabaseTokens();
            }
          } else if (res?.data?.user) {
            activeUser = res.data.user;
          }
        }

        if (!isMounted || !activeUser?.id) return;
        setUser(activeUser);

        // Fetch canonical profile via backend /api/auth/user (backfills missing/partial existing accounts automatically)
        const session = getPersistedDeviceSession();
        if (session?.access_token && session.access_token !== 'demo_token' && session.access_token !== 'local_token') {
          try {
            const authRes = await fetch('/api/auth/user', {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                ...(session.refresh_token ? { 'x-refresh-token': session.refresh_token } : {}),
              },
            });
            if (authRes.ok && isMounted) {
              const authJson = await authRes.json().catch(() => ({}));
              if (authJson?.user) setUser(authJson.user);
              if (authJson?.profile) {
                setProfile((prev: any) => ({ ...(prev || {}), ...authJson.profile }));
                if (authJson.profile.avatar_url) {
                  saveUserAvatarLocally(authJson.profile.avatar_url, undefined, activeUser.id);
                }
              }
            }
          } catch (_) {}
        }

        if (supabase) {
          try {
            const { data } = await supabase.from('profiles').select('*').eq('id', activeUser.id).maybeSingle();
            if (!isMounted) return;
            if (data) {
              setProfile((prev: any) => ({ ...(prev || {}), ...data }));
              if (data.avatar_url) {
                saveUserAvatarLocally(data.avatar_url, undefined, activeUser.id);
              }
            } else {
              const meta = activeUser.user_metadata || {};
              const canonicalSeed: Record<string, any> = {
                id: activeUser.id,
                email: activeUser.email || null,
                full_name: meta.full_name || meta.name || (activeUser.email ? activeUser.email.split('@')[0] : 'Edu AI Learner'),
                avatar_url: meta.avatar_url || meta.picture || null,
                role: meta.role || 'student',
                country: meta.country || meta.location || null,
                education_level: meta.education_level || null,
                curriculum: meta.curriculum || null,
                field_of_study: meta.field_of_study || null,
                subjects: meta.subjects || null,
                updated_at: new Date().toISOString(),
              };
              try {
                const { data: newProfile } = await supabase
                  .from('profiles')
                  .upsert(canonicalSeed, { onConflict: 'id' })
                  .select()
                  .maybeSingle();
                if (isMounted && newProfile) {
                  setProfile((prev: any) => ({ ...(prev || {}), ...newProfile }));
                  pushAccountSyncPatch(activeUser.id, { profileSnapshot: newProfile }, session?.access_token, { immediate: true });
                }
              } catch (e) {
                console.warn('Profile upsert error ignored:', e);
              }
            }
          } catch (e) {
            console.warn('Profile select error ignored:', e);
          }
        }
      } catch (e) {
        console.warn('GetUser error ignored:', e);
      }
    };

    loadUserData();

    return () => { isMounted = false; };
  }, [propUser?.id]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const permanentUrl = await uploadAndSyncUserAvatar(file, user);
      if (permanentUrl) {
        setAvatarFailed(false);
        setProfile((prev: any) => ({ ...(prev || {}), avatar_url: permanentUrl }));
      }
    } catch (error) {
      console.error('Error during photo upload:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getPublicUrl = (key: string) => {
    return getPublicAvatarUrl(key) || `/api/download?key=${encodeURIComponent(key)}`;
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* Cover & Profile Header */}
      <div className="bg-white dark:bg-[#1a1a1d] rounded-3xl border border-slate-200 dark:border-[#2e2e32] overflow-hidden shadow-sm">
        {/* Cover Photo */}
        <div className="h-48 xl:h-64 bg-gradient-to-r from-brand-500 to-indigo-600 relative">
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
        </div>
        
        <div className="px-6 pb-8 sm:px-10 relative">
          {/* Profile Photo */}
          <div className="flex justify-between items-end -mt-16 mb-4 sm:-mt-20 sm:mb-6">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                className="hidden" 
                accept="image/*" 
              />
              <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white dark:bg-[#1a1a1d] p-1.5 rounded-full z-10 shadow-md relative overflow-hidden">
                {(() => {
                  const resolvedProfileUrl = getPublicUrl(profile?.avatar_url);
                  const resolvedMetaPhoto = getPublicUrl(user?.user_metadata?.profile_photo_key);
                  const displayUrl = avatarUrl || resolvedProfileUrl || resolvedMetaPhoto;
                  if (displayUrl && !avatarFailed) {
                    return (
                      <img 
                        src={displayUrl} 
                        alt="Profile" 
                        className="w-full h-full rounded-full object-cover"
                        onError={() => {
                          const nextCandidate = markAvatarUrlFailed(displayUrl, user, profile);
                          if (nextCandidate && nextCandidate !== displayUrl) {
                            setAvatarFailed(false);
                          } else {
                            setAvatarFailed(true);
                          }
                        }}
                      />
                    );
                  }
                  return (
                    <div className="w-full h-full bg-brand-100 dark:bg-brand-950 rounded-full flex items-center justify-center text-4xl font-display font-bold text-brand-600 dark:text-brand-300">
                      {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                    </div>
                  );
                })()}
                
                {/* Overlay for uploading */}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
                </div>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => onOpenAcademicPrefs?.()}
              className="bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-700 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm hidden sm:block cursor-pointer"
            >
              Edit Academic Profile
            </button>
          </div>

          {/* Name & Scholar Metadata */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                {profile?.full_name || user?.user_metadata?.full_name || 'Edu AI Learner'}
              </h1>
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-300 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {academicProfile.educationLevel || 'Active Student'}
                  {user?.user_metadata?.role ? ` · ${user.user_metadata.role}` : ''}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-[#c4c4c8] font-medium">
              <span className="font-semibold text-brand-700 dark:text-[#b8a5f0] tabular-nums">
                {achievements.totalEduPoints.toLocaleString()} Edu Points
              </span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span>{scholarRank.title}</span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span className="tabular-nums">{earnedBadgesCount} {earnedBadgesCount === 1 ? 'Badge' : 'Badges'} Earned</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl text-sm md:text-base">
              {academicProfile.isConfigured
                ? `Studying under ${academicProfile.summaryLabel}. `
                : 'Personalize your country, curriculum, level, and subjects to tailor your shelves. '}
              User ID: <span className="font-mono text-xs">{user?.id || '...'}</span>
            </p>
          </div>
          
          <button
            type="button"
            onClick={() => onOpenAcademicPrefs?.()}
            className="w-full mt-6 bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-700 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm md:hidden cursor-pointer"
          >
            Edit Academic Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Left Column: Personal info & Education System */}
        <div className="lg:col-span-1 space-y-6 md:space-y-8">
          {/* Personal Information */}
          <div className="bg-white dark:bg-[#1a1a1d] p-6 rounded-2xl border border-slate-200 dark:border-[#2e2e32] shadow-sm dark:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.55)] space-y-5">
            <h3 className="font-bold text-slate-900 dark:text-[#ededed]">Personal Information</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-[#c4c4c8]">
                <Mail className="w-4 h-4 text-slate-400 dark:text-[#8e8e93] shrink-0" />
                <span className="truncate">{user?.email || 'Loading email...'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-[#c4c4c8]">
                <MapPin className="w-4 h-4 text-slate-400 dark:text-[#8e8e93] shrink-0" />
                <span>{academicProfile.country || 'Not selected yet'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-[#c4c4c8]">
                <Building className="w-4 h-4 text-slate-400 dark:text-[#8e8e93] shrink-0" />
                <span>{academicProfile.educationLevel || 'Select level of education'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-[#c4c4c8]">
                <Calendar className="w-4 h-4 text-slate-400 dark:text-[#8e8e93] shrink-0" />
                <span>Joined {user?.user_metadata?.join_date ? new Date(user.user_metadata.join_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently'}</span>
              </div>
              {user?.user_metadata?.dob && (
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-[#c4c4c8]">
                  <Clock className="w-4 h-4 text-slate-400 dark:text-[#8e8e93] shrink-0" />
                  <span>Born {new Date(user.user_metadata.dob).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Education System */}
          <div className="bg-white dark:bg-[#1a1a1d] p-6 rounded-2xl border border-slate-200 dark:border-[#2e2e32] shadow-sm space-y-5">
            <h3 className="font-bold text-slate-900 dark:text-[#ededed]">Education System</h3>
            <div className="p-4 bg-slate-50 dark:bg-[#222226] rounded-xl border border-slate-100 dark:border-[#2e2e34]">
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                  {academicProfile.isSchoolLevel ? 'Curriculum' : 'Study Path'}
                </span>
                <span className="text-xs font-semibold px-2 py-1 bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 rounded-md truncate max-w-[160px]">
                  {academicProfile.curriculum || academicProfile.fieldOfStudy || 'Set Intake'}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {academicProfile.curriculum 
                  ? `Following the ${academicProfile.curriculum} academic framework${academicProfile.country ? ` in ${academicProfile.country}` : ''}.` 
                  : academicProfile.fieldOfStudy
                    ? `Focusing on ${academicProfile.fieldOfStudy} studies.`
                    : 'Click Manage to choose your curriculum and subjects.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Subjects & Stats */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {/* Subjects Intakes */}
          <div className="bg-white dark:bg-[#1a1a1d] p-6 rounded-2xl border border-slate-200 dark:border-[#2e2e32] shadow-sm dark:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.55)] space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-[#ededed]">Subjects & Intakes</h3>
              <button
                type="button"
                onClick={() => onOpenAcademicPrefs?.()}
                className="px-3.5 py-1.5 rounded-xl bg-transparent hover:bg-[#f5f5f7] dark:bg-[#242429] dark:hover:bg-[#2e2e35] border border-slate-200 dark:border-[#34343c] text-brand-600 dark:text-[#b8a5f0] text-sm font-medium hover:text-brand-700 dark:hover:text-[#d8cef6] transition-colors cursor-pointer"
              >
                Manage
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {academicProfile.subjects.length > 0 ? (
                academicProfile.subjects.map((subj: string, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200/80 dark:border-[#2e2e34] hover:border-slate-300 dark:hover:border-[#3f3f46] transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-[#b8a5f0]">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-[#ededed] text-sm truncate">{subj}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#a1a1aa] mb-2">
                      <span>Course Progress</span>
                      <span className="font-medium text-slate-900 dark:text-[#ededed]">Active</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#e5e5ea] dark:bg-[#2e2e34] rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full w-1/4" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full p-6 rounded-2xl bg-slate-50 dark:bg-[#222226] border border-dashed border-slate-300 dark:border-[#34343c] text-center space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    No subjects selected yet. Choose your country, curriculum, level, and subjects to personalize your books.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenAcademicPrefs?.()}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Select Subjects Now
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Learning Statistics */}
          <div className="bg-white dark:bg-[#1a1a1d] p-6 rounded-2xl border border-slate-200 dark:border-[#2e2e32] shadow-sm dark:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.55)] space-y-6">
            <h3 className="font-bold text-slate-900 dark:text-[#ededed]">Learning Statistics</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-[#222226] rounded-xl border border-slate-100 dark:border-[#2e2e34] flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-1">
                  <Award className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-[#ededed] tabular-nums">{achievements.totalEduPoints.toLocaleString()}</div>
                <div className="text-xs font-medium text-slate-500 dark:text-[#a1a1aa]">Edu Points</div>
              </div>
              
              <div className="p-4 bg-slate-50 dark:bg-[#222226] rounded-xl border border-slate-100 dark:border-[#2e2e34] flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-1">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-[#ededed] tabular-nums">{achievements.completedBookIds.length}</div>
                <div className="text-xs font-medium text-slate-500 dark:text-[#a1a1aa]">Books Completed</div>
              </div>
              
              <div className="p-4 bg-slate-50 dark:bg-[#222226] rounded-xl border border-slate-100 dark:border-[#2e2e34] flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-1">
                  <Star className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-[#ededed] tabular-nums">{avgQuizScore}%</div>
                <div className="text-xs font-medium text-slate-500 dark:text-[#a1a1aa]">Avg Quiz Score</div>
              </div>
              
              <div className="p-4 bg-slate-50 dark:bg-[#222226] rounded-xl border border-slate-100 dark:border-[#2e2e34] flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mb-1">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-[#ededed] tabular-nums">{studyHoursDisplay}</div>
                <div className="text-xs font-medium text-slate-500 dark:text-[#a1a1aa]">Study Time</div>
              </div>
            </div>
            
            {/* Extended Stats */}
            <div className="p-5 border border-slate-100 dark:border-[#2e2e34] dark:bg-[#222226] rounded-xl flex flex-col sm:flex-row items-center gap-4">
              <div className="p-3 bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-[#b8a5f0] rounded-xl shrink-0">
                <BarChart2 className="w-6 h-6" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h4 className="font-semibold text-slate-900 dark:text-[#ededed]">
                  {earnedBadgesCount > 0
                    ? `${earnedBadgesCount} Badges Unlocked · ${scholarRank.title}`
                    : 'Start Your Journey!'}
                </h4>
                <p className="text-sm text-slate-500 dark:text-[#a1a1aa] mt-1">
                  {earnedBadgesCount > 0
                    ? 'Keep completing textbooks, practice quizzes, and learning paths to climb to the next scholar tier.'
                    : 'Pick a textbook, quiz, or learning path milestone to earn Edu Points and unlock profile badges.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('library')}
                className="text-sm font-medium text-brand-600 dark:text-[#b8a5f0] hover:text-brand-700 dark:hover:text-[#d8cef6] whitespace-nowrap bg-brand-50 dark:bg-brand-500/20 dark:hover:bg-brand-500/30 px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                View Library
              </button>
            </div>
          </div>

          {/* Badges & Achievements Showcase */}
          <BadgesShowcase achievements={achievements} onNavigate={onNavigate} />
          
        </div>
      </div>
      
      {/* Sign Out Button */}
      <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
        <button 
          onClick={async () => {
            if (onSignOut) {
              onSignOut();
              return;
            }
            const { supabase, clearStaleSupabaseTokens } = await import('../lib/supabase');
            if (supabase) {
              try {
                await supabase.auth.signOut({ scope: 'local' });
              } catch (_) {}
            }
            clearStaleSupabaseTokens();
            try {
              localStorage.removeItem('edu_ai_guest_mode');
              sessionStorage.removeItem('edu_ai_guest_mode');
              localStorage.setItem('edu_ai_guest_mode', 'false');
            } catch (_) {}
            if (onNavigate) onNavigate('dashboard');
          }}
          className="flex items-center gap-2 px-5 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl font-medium transition-colors text-sm cursor-pointer shadow-xs"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

    </div>
  );
}
