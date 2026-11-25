import { User, Bell, Shield, Moon, Smartphone, Type, Monitor, LogOut, HardDrive, Wifi, WifiOff, RefreshCw, Trash2, CheckCircle2, BookOpen, Bookmark, Highlighter, Database, Layers, Sparkles, LifeBuoy, Code, HelpCircle, Lock, Copy } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase, clearStaleSupabaseTokens } from '../lib/supabase';
import { useOffline } from '../lib/useOffline';
import { getAllCachedBooks, CachedBookMeta } from '../lib/offlineManager';
import {
  ACCOUNT_SYNC_EVENT,
  getUserSettingsStorageKey,
  pushAccountSyncPatch,
  UserSettingsSync,
} from '../lib/accountSyncService';
import { safeStorage } from '../lib/safeStorage';
import { Support } from './Support';
import { Developer } from './Developer';

export type SettingsTab = 'appearance' | 'notifications' | 'privacy' | 'offline' | 'flutter' | 'support' | 'developer';

export interface SettingsProps {
  initialTab?: SettingsTab;
  onNavigate?: (view: any) => void;
  user?: any;
  onSignOut?: () => void;
}

export function Settings({ initialTab = 'appearance', onNavigate, user, onSignOut }: SettingsProps = {}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [theme, setTheme] = useState(((() => { try { return localStorage.getItem('theme'); } catch (e) { return null; } })()) || 'light');
  const [fontSize, setFontSize] = useState(((() => { try { return localStorage.getItem('fontSize'); } catch (e) { return null; } })()) || 'Medium');
  const { isOnline, storageStats, clearCache, triggerSync, isSyncing, lastSyncResult, deleteCachedBook, refreshOfflineState } = useOffline();
  const [cacheClearedToast, setCacheClearedToast] = useState(false);
  const [syncToast, setSyncToast] = useState(false);
  const [cachedBooksList, setCachedBooksList] = useState<CachedBookMeta[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [flutterManifest, setFlutterManifest] = useState<any>(null);
  const [loadingFlutterManifest, setLoadingFlutterManifest] = useState(false);
  const [copiedFlutterCmd, setCopiedFlutterCmd] = useState(false);

  useEffect(() => {
    if (activeTab === 'offline') {
      setIsLoadingBooks(true);
      getAllCachedBooks().then(books => {
        setCachedBooksList(books);
        setIsLoadingBooks(false);
      }).catch(() => {
        setIsLoadingBooks(false);
      });
    } else if (activeTab === 'flutter') {
      setLoadingFlutterManifest(true);
      fetch('/api/flutter/manifest')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          setFlutterManifest(data);
          setLoadingFlutterManifest(false);
        })
        .catch(() => setLoadingFlutterManifest(false));
    }
  }, [activeTab, storageStats.count]);
  
  const isUserInteractionRef = useRef(false);
  const [notifications, setNotifications] = useState(() => {
    const scoped = safeStorage.getJSON<UserSettingsSync | null>(getUserSettingsStorageKey(user?.id), null)?.notifyPrefs;
    return {
      study: scoped?.study ?? JSON.parse(((() => { try { return localStorage.getItem('notify_study'); } catch (e) { return null; } })()) ?? 'true'),
      mentions: scoped?.mentions ?? JSON.parse(((() => { try { return localStorage.getItem('notify_mentions'); } catch (e) { return null; } })()) ?? 'true'),
      recs: scoped?.recs ?? JSON.parse(((() => { try { return localStorage.getItem('notify_recs'); } catch (e) { return null; } })()) ?? 'false'),
      progress: scoped?.progress ?? JSON.parse(((() => { try { return localStorage.getItem('notify_progress'); } catch (e) { return null; } })()) ?? 'false'),
    };
  });

  const [privacy, setPrivacy] = useState(() => {
    const scoped = safeStorage.getJSON<UserSettingsSync | null>(getUserSettingsStorageKey(user?.id), null)?.privacyPrefs;
    return {
      public: scoped?.public ?? JSON.parse(((() => { try { return localStorage.getItem('privacy_public'); } catch (e) { return null; } })()) ?? 'true'),
      data: scoped?.data ?? JSON.parse(((() => { try { return localStorage.getItem('privacy_data'); } catch (e) { return null; } })()) ?? 'true'),
    };
  });

  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.userId && user?.id && detail.userId !== user.id) return;
      const s: UserSettingsSync | undefined =
        detail?.sync?.userSettings ||
        safeStorage.getJSON<UserSettingsSync | null>(getUserSettingsStorageKey(user?.id), null) ||
        undefined;
      if (!s) return;
      isUserInteractionRef.current = false;
      if (s.theme) setTheme(s.theme);
      if (s.fontSize) setFontSize(s.fontSize);
      if (s.notifyPrefs) {
        setNotifications((prev) => ({
          ...prev,
          ...(typeof s.notifyPrefs?.study === 'boolean' ? { study: s.notifyPrefs.study } : {}),
          ...(typeof s.notifyPrefs?.mentions === 'boolean' ? { mentions: s.notifyPrefs.mentions } : {}),
          ...(typeof s.notifyPrefs?.recs === 'boolean' ? { recs: s.notifyPrefs.recs } : {}),
          ...(typeof s.notifyPrefs?.progress === 'boolean' ? { progress: s.notifyPrefs.progress } : {}),
        }));
      }
      if (s.privacyPrefs) {
        setPrivacy((prev) => ({
          ...prev,
          ...(typeof s.privacyPrefs?.public === 'boolean' ? { public: s.privacyPrefs.public } : {}),
          ...(typeof s.privacyPrefs?.data === 'boolean' ? { data: s.privacyPrefs.data } : {}),
        }));
      }
    };
    window.addEventListener(ACCOUNT_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(ACCOUNT_SYNC_EVENT, handleSync);
  }, [user?.id]);

  const persistAndSyncSettings = (next: Partial<UserSettingsSync>) => {
    const payload: UserSettingsSync = {
      theme,
      fontSize,
      notifyPrefs: notifications,
      privacyPrefs: privacy,
      ...next,
      updatedAt: new Date().toISOString(),
    };
    safeStorage.setJSON(getUserSettingsStorageKey(user?.id), payload);
    if (user?.id) {
      pushAccountSyncPatch(user.id, { userSettings: payload });
    }
  };

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle(
      'dark',
      theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
    window.dispatchEvent(new Event('theme_changed'));
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('fontSize', fontSize);
    document.documentElement.setAttribute('data-font-size', fontSize.toLowerCase());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('notify_study', JSON.stringify(notifications.study));
    localStorage.setItem('notify_mentions', JSON.stringify(notifications.mentions));
    localStorage.setItem('notify_recs', JSON.stringify(notifications.recs));
    localStorage.setItem('notify_progress', JSON.stringify(notifications.progress));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('privacy_public', JSON.stringify(privacy.public));
    localStorage.setItem('privacy_data', JSON.stringify(privacy.data));
  }, [privacy]);

  const selectTheme = (nextTheme: string) => {
    setTheme(nextTheme);
    persistAndSyncSettings({ theme: nextTheme });
  };

  const selectFontSize = (nextSize: string) => {
    setFontSize(nextSize);
    persistAndSyncSettings({ fontSize: nextSize });
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      persistAndSyncSettings({ notifyPrefs: updated });
      return updated;
    });
  };

  const togglePrivacy = (key: keyof typeof privacy) => {
    setPrivacy(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      persistAndSyncSettings({ privacyPrefs: updated });
      return updated;
    });
  };

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
      return;
    }
    if (supabase) {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (e) {
        console.warn('Sign out error handled:', e);
      }
    }
    clearStaleSupabaseTokens();
    try {
      localStorage.removeItem('edu_ai_guest_mode');
      sessionStorage.removeItem('edu_ai_guest_mode');
      localStorage.setItem('edu_ai_guest_mode', 'false');
    } catch (_) {}
    if (onNavigate) onNavigate('dashboard');
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#EDEDED] tracking-tight mb-2">Settings</h2>
        <p className="text-slate-500 dark:text-[#A0A0A0]">Manage your account, preferences, and reading environment.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Settings Left Pane - Semi-transparent dark overlay pane */}
        <div className="md:col-span-1 space-y-4 bg-slate-50/60 dark:bg-[#161616]/75 dark:backdrop-blur-xl rounded-2xl p-4 border border-slate-200/60 dark:border-white/10 shadow-sm settings-pane">
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 dark:text-[#A0A0A0] uppercase tracking-wider px-3 pb-1 flex items-center justify-between">
              <span>Preferences</span>
              {activeTab === 'notifications' && (
                <span className="text-[10px] font-medium normal-case text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Bell className="w-3 h-3" /> Notifications active
                </span>
              )}
            </div>
            <button 
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'appearance' ? 'bg-slate-100 dark:bg-indigo-500/15 text-slate-900 dark:text-[#EDEDED] dark:border dark:border-indigo-500/30 font-semibold' : 'text-slate-600 dark:text-[#A0A0A0] hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#EDEDED]'}`}
            >
              <Monitor className="w-4 h-4" /> Appearance
            </button>
            <button 
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'notifications' ? 'bg-slate-100 dark:bg-indigo-500/15 text-slate-900 dark:text-[#EDEDED] dark:border dark:border-indigo-500/30 font-semibold shadow-xs' : 'text-slate-600 dark:text-[#A0A0A0] hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#EDEDED]'}`}
            >
              <div className="flex items-center gap-3">
                <Bell className={`w-4 h-4 ${activeTab === 'notifications' ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
                <span>Notifications</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-indigo-50 dark:bg-white/10 text-indigo-600 dark:text-indigo-300 border border-indigo-200/50 dark:border-white/10">
                Alerts
              </span>
            </button>
            <button 
              onClick={() => setActiveTab('privacy')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'privacy' ? 'bg-slate-100 dark:bg-indigo-500/15 text-slate-900 dark:text-[#EDEDED] dark:border dark:border-indigo-500/30 font-semibold' : 'text-slate-600 dark:text-[#A0A0A0] hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#EDEDED]'}`}
            >
              <Shield className="w-4 h-4" /> Privacy & Security
            </button>
            <button 
              onClick={() => setActiveTab('offline')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'offline' ? 'bg-slate-100 dark:bg-indigo-500/15 text-slate-900 dark:text-[#EDEDED] dark:border dark:border-indigo-500/30 font-semibold' : 'text-slate-600 dark:text-[#A0A0A0] hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#EDEDED]'}`}
            >
              <HardDrive className="w-4 h-4" /> Offline & Sync
            </button>
            <button 
              onClick={() => setActiveTab('flutter')}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'flutter' ? 'bg-slate-100 dark:bg-indigo-500/15 text-slate-900 dark:text-[#EDEDED] dark:border dark:border-indigo-500/30 font-semibold' : 'text-slate-600 dark:text-[#A0A0A0] hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#EDEDED]'}`}
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4" />
                <span>Flutter & EPUB</span>
              </div>
              <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">Mobile</span>
            </button>
          </div>

          <div className="space-y-1 pt-3 border-t border-slate-200 dark:border-white/10">
            <div className="text-[10px] font-bold text-slate-400 dark:text-[#A0A0A0] uppercase tracking-wider px-3 pb-1">
              Help & Platform
            </div>
            <button 
              onClick={() => setActiveTab('support')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'support' ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-[#EDEDED] dark:border dark:border-indigo-500/30 font-semibold' : 'text-slate-600 dark:text-[#A0A0A0] hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#EDEDED]'}`}
            >
              <LifeBuoy className="w-4 h-4 text-indigo-400" /> Support & Help
            </button>
            <button 
              onClick={() => setActiveTab('developer')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'developer' ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-[#EDEDED] dark:border dark:border-indigo-500/30 font-semibold' : 'text-slate-600 dark:text-[#A0A0A0] hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#EDEDED]'}`}
            >
              <Code className="w-4 h-4 text-purple-400" /> Developer & Architect
            </button>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          {activeTab === 'appearance' && (
            <>
              <div className="bg-white dark:bg-[#171E24] rounded-2xl border border-[#E2DDD3] dark:border-[#26313A] p-6 shadow-sm settings-overlay-card">
                 <h3 className="text-lg font-display font-bold text-slate-900 dark:text-[#F2EFE9] mb-2">Theme &amp; Appearance</h3>
                 <p className="text-xs text-slate-500 dark:text-[#98A4AF] mb-4">Choose your preferred reading and interface mode. Archival Light uses warm paper tones while Ink Dark sets a deep slate study canvas.</p>
                  <div className="grid grid-cols-3 gap-4">
                    <button 
                      onClick={() => selectTheme('light')}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-colors cursor-pointer ${theme === 'light' ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/30' : 'border-[#E2DDD3] dark:border-[#26313A] bg-[#FAF8F4] dark:bg-[#11161A] hover:border-brand-300 dark:hover:border-[#344350]'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${theme === 'light' ? 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300' : 'bg-[#EFECE4] dark:bg-[#1F2830] text-slate-600 dark:text-[#98A4AF]'}`}><User className="w-4 h-4" /></div>
                      <span className={`text-sm font-medium ${theme === 'light' ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-[#F2EFE9]'}`}>Archival Light</span>
                    </button>
                    <button 
                      onClick={() => selectTheme('dark')}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-colors cursor-pointer ${theme === 'dark' ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/30' : 'border-[#E2DDD3] dark:border-[#26313A] bg-[#FAF8F4] dark:bg-[#11161A] hover:border-brand-300 dark:hover:border-[#344350]'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-800 text-white'}`}><Moon className="w-4 h-4" /></div>
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-[#F2EFE9]'}`}>Ink Dark</span>
                    </button>
                    <button 
                      onClick={() => selectTheme('system')}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-colors cursor-pointer ${theme === 'system' ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/30' : 'border-[#E2DDD3] dark:border-[#26313A] bg-[#FAF8F4] dark:bg-[#11161A] hover:border-brand-300 dark:hover:border-[#344350]'}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#EFECE4] dark:bg-[#1F2830] flex items-center justify-center text-slate-600 dark:text-[#98A4AF] shrink-0"><Smartphone className="w-4 h-4" /></div>
                      <span className={`text-sm font-medium ${theme === 'system' ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-[#F2EFE9]'}`}>System</span>
                    </button>
                  </div>
               </div>

               <div className="bg-white dark:bg-[#171E24] rounded-2xl border border-[#E2DDD3] dark:border-[#26313A] p-6 shadow-sm settings-overlay-card">
                  <h3 className="text-lg font-display font-bold text-slate-900 dark:text-[#F2EFE9] mb-4">Reading Preferences</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-white/5">
                       <div className="flex items-center gap-3">
                         <Type className="w-5 h-5 text-slate-400 dark:text-[#8E8E93]" />
                         <div>
                           <div className="font-medium text-slate-900 dark:text-[#EDEDED]">Font Size</div>
                           <div className="text-sm text-slate-500 dark:text-[#A0A0A0]">Adjust the default text size for the reader</div>
                         </div>
                       </div>
                       <select 
                         value={fontSize} 
                         onChange={(e) => selectFontSize(e.target.value)}
                        className="bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-[#EDEDED] outline-none focus:border-brand-500"
                      >
                        <option>Small</option>
                        <option>Medium</option>
                        <option>Large</option>
                        <option>Extra Large</option>
                      </select>
                   </div>
                 </div>
              </div>
            </>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white dark:bg-[#161616]/75 dark:backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/10 p-6 shadow-sm dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] space-y-6 settings-overlay-card">
               <div>
                 <h3 className="text-lg font-bold text-slate-900 dark:text-[#EDEDED]">Notification Channels & Categories</h3>
                 <p className="text-xs text-slate-500 dark:text-[#A0A0A0] mt-1">Configure which alerts you receive across your Edu AI study sessions.</p>
               </div>

               <div className="space-y-3">
                 {[
                   { key: 'platform', title: '📢 Platform & Developer Announcements', desc: 'Syllabus releases, offline sync improvements, and core AI engine upgrades.', defaultVal: true },
                   { key: 'teachers', title: '👩‍🏫 Teacher & Classroom Broadcasts', desc: 'Direct assignment drops, quiz deadlines, and annotated feedback from your instructors.', defaultVal: true },
                   { key: 'study', title: '🤖 AI Study Coach & Streak Alerts', desc: 'Daily reading goal progress, personalized review prompts, and spaced repetition.', defaultVal: true },
                   { key: 'mentions', title: '👥 Peer & Community Mentions', desc: 'Study group invitations, shared quote highlights, and peer note discussions.', defaultVal: true },
                   { key: 'recs', title: '📚 New Course & Syllabus Recommendations', desc: 'Alerts about new syllabus textbooks matching your field of study.', defaultVal: false },
                   { key: 'progress', title: '📊 Weekly Performance Digest', desc: 'Weekly summaries of your reading velocity and assessment accuracy.', defaultVal: true }
                 ].map((item) => (
                   <div key={item.key} className="flex items-start justify-between p-4 border border-slate-100 dark:border-white/5 rounded-xl hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                      <div className="pr-4">
                        <div className="font-semibold text-sm text-slate-900 dark:text-[#EDEDED]">{item.title}</div>
                        <div className="text-xs text-slate-500 dark:text-[#A0A0A0] mt-0.5 leading-relaxed">{item.desc}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer mt-1 shrink-0">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={notifications[item.key as keyof typeof notifications] ?? item.defaultVal}
                          onChange={() => toggleNotification(item.key as keyof typeof notifications)}
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 dark:peer-checked:bg-[#7b5ecc]"></div>
                      </label>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="bg-white dark:bg-[#161616]/75 dark:backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/10 p-6 shadow-sm dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] space-y-8 settings-overlay-card">
               <div>
                 <h3 className="text-lg font-bold text-slate-900 dark:text-[#EDEDED] mb-4">Security</h3>
                 <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-white/5">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-[#EDEDED]">Change Password</div>
                        <div className="text-sm text-slate-500 dark:text-[#A0A0A0] mt-0.5">Update your password to keep your account secure</div>
                      </div>
                      <button className="px-4 py-2 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 rounded-lg text-sm font-medium text-slate-700 dark:text-[#EDEDED] transition-colors">
                        Update
                      </button>
                   </div>
                   <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-white/5">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-[#EDEDED]">Two-Factor Authentication</div>
                        <div className="text-sm text-slate-500 dark:text-[#A0A0A0] mt-0.5">Add an extra layer of security to your account</div>
                      </div>
                      <button className="px-4 py-2 bg-slate-900 dark:bg-indigo-600/80 hover:bg-slate-800 dark:hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors">
                        Enable
                      </button>
                   </div>
                 </div>
               </div>
               
                <div>
                 <h3 className="text-lg font-bold text-slate-900 dark:text-[#EDEDED] mb-4">Privacy</h3>
                 <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-white/5">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-[#EDEDED]">Public Profile</div>
                        <div className="text-sm text-slate-500 dark:text-[#A0A0A0] mt-0.5">Allow other members to see your reading progress</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={privacy.public}
                          onChange={() => togglePrivacy('public')}
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500 dark:peer-checked:bg-[#7b5ecc]"></div>
                      </label>
                   </div>
                   <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-white/5">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-[#EDEDED]">Data Sharing for AI Insights</div>
                        <div className="text-sm text-slate-500 dark:text-[#A0A0A0] mt-0.5">Allow AI models to learn from your study patterns</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={privacy.data}
                          onChange={() => togglePrivacy('data')}
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500 dark:peer-checked:bg-[#7b5ecc]"></div>
                      </label>
                   </div>
                 </div>
               </div>

               <div className="pt-4 border-t border-slate-100 dark:border-white/10">
                 <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl font-medium transition-colors"
                 >
                   <LogOut className="w-4 h-4" />
                   Sign Out
                 </button>
               </div>
            </div>
          )}

          {activeTab === 'offline' && (
            <div className="bg-white dark:bg-[#161616]/75 dark:backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/10 p-6 shadow-sm dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] space-y-6 settings-overlay-card">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#EDEDED] mb-1">Offline Reading & IndexedDB Layer</h3>
                <p className="text-sm text-slate-500 dark:text-[#A0A0A0]">Fast local database storage for book content, PDF documents, reading progress, and annotations.</p>
              </div>

              {/* Main Stat Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-indigo-500/20 text-brand-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-[#A0A0A0] uppercase tracking-wider font-semibold">Cached Books</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-[#EDEDED]">{storageStats.count} {storageStats.count === 1 ? 'Book' : 'Books'}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-[#A0A0A0] uppercase tracking-wider font-semibold">IndexedDB Data</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-[#EDEDED]">{storageStats.formattedSize}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-[#A0A0A0] uppercase tracking-wider font-semibold">Progress Records</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-[#EDEDED]">{storageStats.progressCount ?? 0} Tracked</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-[#A0A0A0] uppercase tracking-wider font-semibold">Network State</div>
                    <div className={`text-sm font-bold truncate ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
              </div>

              {/* IndexedDB Store Overview */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-slate-800 dark:text-[#EDEDED] uppercase tracking-wider">IndexedDB Architecture (v2 Active)</span>
                  </div>
                  {storageStats.quotaUsagePercent !== undefined && (
                    <span className="text-xs text-slate-500 dark:text-[#A0A0A0] font-medium">
                      Browser Storage Used: {storageStats.quotaUsagePercent}%
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-white dark:bg-[#1a1a1a] p-2.5 rounded-lg border border-slate-200/60 dark:border-white/10 shadow-2xs">
                    <div className="text-xs text-slate-500 dark:text-[#A0A0A0] flex items-center justify-center gap-1">
                      <BookOpen className="w-3 h-3 text-brand-600 dark:text-indigo-400" /> Books & Blobs
                    </div>
                    <div className="text-sm font-bold text-slate-800 dark:text-[#EDEDED] mt-1">{storageStats.count} stored</div>
                  </div>
                  <div className="bg-white dark:bg-[#1a1a1a] p-2.5 rounded-lg border border-slate-200/60 dark:border-white/10 shadow-2xs">
                    <div className="text-xs text-slate-500 dark:text-[#A0A0A0] flex items-center justify-center gap-1">
                      <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> Book Content
                    </div>
                    <div className="text-sm font-bold text-slate-800 dark:text-[#EDEDED] mt-1">{storageStats.contentCount ?? 0} cached</div>
                  </div>
                  <div className="bg-white dark:bg-[#1a1a1a] p-2.5 rounded-lg border border-slate-200/60 dark:border-white/10 shadow-2xs">
                    <div className="text-xs text-slate-500 dark:text-[#A0A0A0] flex items-center justify-center gap-1">
                      <Highlighter className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Highlights
                    </div>
                    <div className="text-sm font-bold text-slate-800 dark:text-[#EDEDED] mt-1">{storageStats.highlightsCount ?? 0} notes</div>
                  </div>
                  <div className="bg-white dark:bg-[#1a1a1a] p-2.5 rounded-lg border border-slate-200/60 dark:border-white/10 shadow-2xs">
                    <div className="text-xs text-slate-500 dark:text-[#A0A0A0] flex items-center justify-center gap-1">
                      <Bookmark className="w-3 h-3 text-rose-600 dark:text-rose-400" /> Bookmarks
                    </div>
                    <div className="text-sm font-bold text-slate-800 dark:text-[#EDEDED] mt-1">{storageStats.bookmarksCount ?? 0} saved</div>
                  </div>
                </div>
              </div>

              {/* Cached Books List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-[#EDEDED]">Downloaded Books on this Device</h4>
                  <button
                    onClick={async () => {
                      const books = await getAllCachedBooks();
                      setCachedBooksList(books);
                    }}
                    className="text-xs font-semibold text-brand-600 dark:text-indigo-400 hover:text-brand-700 dark:hover:text-indigo-300 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                {isLoadingBooks ? (
                  <div className="py-6 text-center text-xs text-slate-400">Loading cached books...</div>
                ) : cachedBooksList.length === 0 ? (
                  <div className="py-6 px-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-center text-xs text-slate-500 dark:text-[#A0A0A0]">
                    No books downloaded for offline use yet. Click the Download icon on any book card in your Library to cache it locally in IndexedDB.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/5 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-[#161616]/75">
                    {cachedBooksList.map(book => (
                      <div key={book.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          {book.coverImage ? (
                            <img src={book.coverImage} alt={book.title} className="w-10 h-14 object-cover rounded shadow-2xs shrink-0" />
                          ) : (
                            <div className="w-10 h-14 bg-brand-50 dark:bg-white/10 rounded border border-brand-100 dark:border-white/10 flex items-center justify-center text-brand-700 dark:text-indigo-300 font-bold text-xs shrink-0">
                              {book.title.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 dark:text-[#EDEDED] truncate">{book.title}</div>
                            <div className="text-xs text-slate-500 dark:text-[#A0A0A0] truncate">{book.author} • {book.category}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-brand-50 dark:bg-indigo-500/20 text-brand-700 dark:text-indigo-300 text-[10px] font-semibold">
                                {book.fileSizeFormatted || 'Cached'}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-[#8E8E93]">
                                {new Date(book.cachedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={async () => {
                            await deleteCachedBook(book.id);
                            setCachedBooksList(prev => prev.filter(b => b.id !== book.id));
                            refreshOfflineState();
                          }}
                          title="Remove from offline storage"
                          className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-[#EDEDED]">Purge Local IndexedDB Database</div>
                    <div className="text-sm text-slate-500 dark:text-[#A0A0A0] mt-0.5">Clears all downloaded books, cached text content, and resets offline storage.</div>
                  </div>
                  <button
                    onClick={async () => {
                      await clearCache();
                      setCachedBooksList([]);
                      setCacheClearedToast(true);
                      setTimeout(() => setCacheClearedToast(false), 3000);
                    }}
                    className="px-3.5 py-2 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear All Storage
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-[#EDEDED]">Sync Offline Progress & Notes</div>
                    <div className="text-sm text-slate-500 dark:text-[#A0A0A0] mt-0.5">
                      {lastSyncResult ? `Last synced ${lastSyncResult.count} items` : 'Synchronizes reading bookmarks, highlights, and page positions'}
                    </div>
                  </div>
                  <button
                    disabled={isSyncing || !isOnline}
                    onClick={async () => {
                      await triggerSync();
                      setSyncToast(true);
                      setTimeout(() => setSyncToast(false), 3500);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shrink-0 ${
                      isSyncing || !isOnline 
                        ? 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed' 
                        : 'bg-brand-600 hover:bg-brand-700 text-white'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                </div>
              </div>

              {cacheClearedToast && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800/40">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  IndexedDB storage and offline book cache cleared successfully.
                </div>
              )}

              {syncToast && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800/40">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Sync completed. All reading items are synchronized with the cloud!
                </div>
              )}
            </div>
          )}

          {/* Flutter Mobile & Publisher EPUB Tab */}
          {activeTab === 'flutter' && (
            <div className="bg-white dark:bg-[#161616]/75 dark:backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/10 p-6 shadow-sm dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] space-y-6 settings-overlay-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-[#EDEDED] flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-indigo-500" />
                    Flutter Mobile Reader &amp; Publisher EPUB Pipeline
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#A0A0A0] mt-1">
                    Reflowable EPUB, native PDF, and hardware-backed AES-256 offline storage synced across mobile and web.
                  </p>
                </div>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
                  {flutterManifest?.minSdk || 'Flutter >= 3.3.0'}
                </span>
              </div>

              {loadingFlutterManifest ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-[#A0A0A0]">
                  Loading Flutter integration manifest...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5">
                      <div className="text-xs font-medium text-slate-500 dark:text-[#A0A0A0]">EPUB Reader Engine</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-[#EDEDED] mt-1 font-mono">
                        {flutterManifest?.readerEngines?.epub?.package || 'epub_view: ^3.2.0'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-[#A0A0A0] mt-1">
                        Reflowable chapters · ToC · CFI resume
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5">
                      <div className="text-xs font-medium text-slate-500 dark:text-[#A0A0A0]">PDF Reader Engine</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-[#EDEDED] mt-1 font-mono">
                        {flutterManifest?.readerEngines?.pdf?.package || 'pdfx: ^2.6.0'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-[#A0A0A0] mt-1">
                        Pinch zoom · Page jump · Night mode
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5">
                      <div className="text-xs font-medium text-slate-500 dark:text-[#A0A0A0] flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-emerald-500" />
                        Offline Encryption
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-[#EDEDED] mt-1 font-mono">
                        {flutterManifest?.readerEngines?.offlineSecurity?.cipher || 'AES-256-CBC + SHA-256'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-[#A0A0A0] mt-1">
                        {flutterManifest?.readerEngines?.offlineSecurity?.keyStorage || 'Keychain / Android Keystore'}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-[#EDEDED]">
                        Run Flutter App Connected to This Backend
                      </span>
                      <span className="text-xs text-slate-500 dark:text-[#A0A0A0] tabular-nums">
                        {flutterManifest?.catalogStats?.epubBooks ?? 0} EPUB · {flutterManifest?.catalogStats?.pdfBooks ?? 0} PDF uploaded
                      </span>
                    </div>
                    <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto">
{`cd mobile && flutter pub get && flutter run \\
  --dart-define=SUPABASE_URL=<YOUR_SUPABASE_URL> \\
  --dart-define=SUPABASE_ANON_KEY=<YOUR_ANON_KEY> \\
  --dart-define=API_BASE_URL=${flutterManifest?.apiBaseUrl || window.location.origin}`}
                    </pre>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-xs text-slate-500 dark:text-[#A0A0A0]">
                        Publishers upload EPUB or PDF textbooks via Admin Platform; mobile &amp; web share identical canonical covers.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const cmd = `cd mobile && flutter pub get && flutter run --dart-define=API_BASE_URL=${flutterManifest?.apiBaseUrl || window.location.origin}`;
                          navigator.clipboard?.writeText(cmd);
                          setCopiedFlutterCmd(true);
                          setTimeout(() => setCopiedFlutterCmd(false), 2500);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedFlutterCmd ? 'Copied Command' : 'Copy Launch Command'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Support Tab View */}
          {activeTab === 'support' && (
            <Support embedded onNavigate={onNavigate} />
          )}

          {/* Developer Tab View */}
          {activeTab === 'developer' && (
            <Developer embedded />
          )}

          {/* Helpful Navigation Footer for preferences */}
          {['appearance', 'notifications', 'privacy', 'offline', 'flutter'].includes(activeTab) && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#161616]/75 dark:backdrop-blur-xl border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-2xs settings-overlay-card">
              <div className="text-slate-500 dark:text-[#A0A0A0] text-center sm:text-left">
                Need assistance with your account or curious about the project architect?
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => setActiveTab('support')}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-transparent dark:border-indigo-500/20"
                >
                  <LifeBuoy className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-300" /> Support & Help
                </button>
                <button 
                  onClick={() => setActiveTab('developer')}
                  className="px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/15 hover:bg-purple-100 dark:hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-transparent dark:border-purple-500/20"
                >
                  <Code className="w-3.5 h-3.5 text-purple-500 dark:text-purple-300" /> About Developer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
