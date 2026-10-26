import { Mail, MapPin, Building, Calendar, BookOpen, GraduationCap, BarChart2, LogOut, Award, Star, Clock, Camera, Loader2 } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { supabase, clearStaleSupabaseTokens } from '../lib/supabase';
import { saveUserAvatarLocally, useUserAvatar, getPublicAvatarUrl } from '../lib/userAvatarService';

export interface ProfileProps {
  user?: any;
  profile?: any;
  onNavigate?: (view: string) => void;
  onSignOut?: () => void;
}

export function Profile({ user: propUser, profile: propProfile, onNavigate, onSignOut }: ProfileProps = {}) {
  const [user, setUser] = useState<any>(propUser || null);
  const [profile, setProfile] = useState<any>(propProfile || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarUrl = useUserAvatar(user);
  const [avatarFailed, setAvatarFailed] = useState(false);

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
    if (!supabase) return;

    let isMounted = true;

    const loadUserData = async () => {
      try {
        const res = await supabase.auth.getUser();
        if (res?.error) {
          if (res.error.message?.includes('Refresh Token') || res.error.message?.includes('refresh_token')) {
            clearStaleSupabaseTokens();
          }
          if (isMounted) setUser(null);
          return;
        }
        const user = res?.data?.user || null;
        if (!isMounted) return;
        setUser(user);
        if (user) {
          try {
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (!isMounted) return;
            if (data) {
              setProfile(data);
              if (data.avatar_url) {
                const existingData = localStorage.getItem('user_avatar_data_url') || undefined;
                saveUserAvatarLocally(data.avatar_url, existingData);
              }
            } else {
              try {
                const { data: newProfile } = await supabase.from('profiles').insert([{ id: user.id }]).select().single();
                if (isMounted && newProfile) setProfile(newProfile);
              } catch (e) {
                console.warn("Profile insert error ignored:", e);
              }
            }
          } catch (e) {
            console.warn("Profile select error ignored:", e);
          }
        }
      } catch (e) {
        console.warn("GetUser error ignored:", e);
      }
    };

    loadUserData();

    return () => { isMounted = false; };
  }, []);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    let previewDataUrl = '';

    try {
      setIsUploading(true);
      
      // 1. Read locally first for guaranteed instant 0ms preview and offline persistence
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const res = e.target?.result as string;
          if (res) {
            previewDataUrl = res;
            saveUserAvatarLocally(res, res);
            setProfile((prev: any) => ({ ...(prev || {}), avatar_url: res }));
          }
          resolve();
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(file);
      });

      // 2. Upload directly to our backend which then puts it to persistent disk and B2
      const uploadRes = await fetch(`/api/upload-direct?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadRes.ok) {
        console.warn(`Upload to server completed with status ${uploadRes.status}, local photo retained.`);
      } else {
        const data = await uploadRes.json();
        const fileKey = data?.key;
        if (fileKey) {
          saveUserAvatarLocally(fileKey, previewDataUrl);
          setProfile((prev: any) => ({ ...(prev || {}), avatar_url: fileKey }));

          // Also update Supabase metadata if logged in
          if (supabase && user) {
            try {
              await supabase.auth.updateUser({
                data: { avatar_url: fileKey, profile_photo_key: fileKey }
              });
            } catch (e) {
              console.warn("Auth updateUser error:", e);
            }

            try {
              const { data: updatedProfile, error } = await supabase.from('profiles').update({
                avatar_url: fileKey
              }).eq('id', user.id).select().single();
              if (!error && updatedProfile) {
                setProfile(updatedProfile);
              }
            } catch (e) {
              console.warn("Profiles update error:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during photo upload:', error);
      // Even if network failed, the preview was saved locally so user doesn't lose their avatar
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
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
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
              <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white p-1.5 rounded-full z-10 shadow-md relative overflow-hidden">
                {avatarUrl && !avatarFailed ? (
                  <img 
                    src={avatarUrl} 
                    alt="Profile" 
                    className="w-full h-full rounded-full object-cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : profile?.avatar_url && !avatarFailed ? (
                  <img 
                    src={getPublicUrl(profile.avatar_url)} 
                    alt="Profile" 
                    className="w-full h-full rounded-full object-cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : user?.user_metadata?.profile_photo_key && !avatarFailed ? (
                  <img 
                    src={getPublicUrl(user.user_metadata.profile_photo_key)} 
                    alt="Profile" 
                    className="w-full h-full rounded-full object-cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-brand-100 rounded-full flex items-center justify-center text-4xl font-display font-bold text-brand-600">
                    {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                
                {/* Overlay for uploading */}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
                </div>
              </div>
            </div>
            
            <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm hidden sm:block">
              Edit Profile
            </button>
          </div>

          {/* Name & Badge */}
          <div className="space-y-1 sm:space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
                {profile?.full_name || user?.user_metadata?.full_name || 'Edu AI Learner'}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-full w-fit">
                <GraduationCap className="w-3.5 h-3.5" />
                {profile?.education_level || user?.user_metadata?.education_level || 'Active Student'} {user?.user_metadata?.role ? `• ${user.user_metadata.role}` : ''}
              </span>
            </div>
            <p className="text-slate-500 max-w-2xl text-sm md:text-base">
              {profile?.field_of_study || user?.user_metadata?.field_of_study 
                ? `Specializing in ${profile?.field_of_study || user?.user_metadata?.field_of_study}. ` 
                : 'Passionate learner exploring new concepts and advancing education. '}
              User ID: <span className="font-mono text-xs">{user?.id || '...'}</span>
            </p>
          </div>
          
          <button className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm md:hidden">
            Edit Profile
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
                <span>{profile?.country || user?.user_metadata?.country || 'Edu AI Global Access'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-[#c4c4c8]">
                <Building className="w-4 h-4 text-slate-400 dark:text-[#8e8e93] shrink-0" />
                <span>{profile?.education_level || user?.user_metadata?.education_level || 'Online Learning Platform'}</span>
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
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h3 className="font-bold text-slate-900">Education System</h3>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-900">
                  {profile?.curriculum || user?.user_metadata?.curriculum ? 'Curriculum' : 'Study Path'}
                </span>
                <span className="text-xs font-semibold px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md">
                  {profile?.curriculum || user?.user_metadata?.curriculum || profile?.field_of_study || user?.user_metadata?.field_of_study || 'General'}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {profile?.curriculum || user?.user_metadata?.curriculum 
                  ? `Following the ${profile?.curriculum || user?.user_metadata?.curriculum} academic framework.` 
                  : `Focusing on ${profile?.field_of_study || user?.user_metadata?.field_of_study || 'comprehensive'} studies.`}
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
              <button className="px-3.5 py-1.5 rounded-xl bg-transparent hover:bg-[#f5f5f7] dark:bg-[#242429] dark:hover:bg-[#2e2e35] border border-transparent dark:border-[#34343c] text-brand-600 dark:text-[#b8a5f0] text-sm font-medium hover:text-brand-700 dark:hover:text-[#d8cef6] transition-colors cursor-pointer">
                Manage
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(profile?.subjects || user?.user_metadata?.subjects) ? (
                (profile?.subjects || user?.user_metadata?.subjects).split(',').map((subj: string, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200/80 dark:border-[#2e2e34] hover:border-slate-300 dark:hover:border-[#3f3f46] transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-[#b8a5f0]">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-[#ededed] text-sm truncate">{subj.trim()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#a1a1aa] mb-2">
                      <span>Course Progress</span>
                      <span className="font-medium text-slate-900 dark:text-[#ededed]">0%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#e5e5ea] dark:bg-[#2e2e34] rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full w-0" />
                    </div>
                  </div>
                ))
              ) : (
                ['General Mathematics', 'Basic Science', 'Language Arts'].map((subj, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200/80 dark:border-[#2e2e34] hover:border-slate-300 dark:hover:border-[#3f3f46] transition-colors opacity-75 dark:opacity-85">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#ebebf0] dark:bg-[#2c2c32] text-slate-500 dark:text-[#a1a1aa]">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-[#ededed] text-sm">{subj}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Learning Statistics */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900">Learning Statistics</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-1">
                  <Award className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-slate-900">0</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Certificates</div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-1">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-slate-900">0</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Books Read</div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-1">
                  <Star className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-slate-900">0</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Quiz Score</div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-1">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-slate-900">0h</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Study Time</div>
              </div>
            </div>
            
            {/* Extended Stats */}
            <div className="p-5 border border-slate-100 rounded-xl flex flex-col sm:flex-row items-center gap-4">
              <div className="p-3 bg-brand-50 text-brand-600 rounded-xl shrink-0">
                <BarChart2 className="w-6 h-6" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h4 className="font-semibold text-slate-900">Start Your Journey!</h4>
                <p className="text-sm text-slate-500 mt-1">You're ready to start learning. Pick a book or course to begin tracking your progress.</p>
              </div>
              <button className="text-sm font-medium text-brand-600 hover:text-brand-700 whitespace-nowrap bg-brand-50 px-4 py-2 rounded-lg">
                View Library
              </button>
            </div>
          </div>
          
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
