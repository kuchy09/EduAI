import React, { useEffect, useState } from 'react';
import { BookOpen, Map, Users, Settings, LifeBuoy, Code, User, LineChart, X, UserPlus, Moon, Sun, LogOut } from 'lucide-react';
import { ViewState } from '../types';
import { supabase, clearStaleSupabaseTokens } from '../lib/supabase';
import { triggerCapsuleFeedback } from '../lib/feedback';
import { useUserAvatar } from '../lib/userAvatarService';
import { safeStorage } from '../lib/safeStorage';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  profile?: any;
  isGuest?: boolean;
  onSignOut?: () => void;
}

export function Sidebar({ currentView, onChangeView, isOpen, onClose, user: propUser, profile, isGuest, onSignOut }: SidebarProps) {
  const [user, setUser] = useState<any>(propUser || null);
  const avatarUrl = useUserAvatar(user, profile);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    if (propUser !== undefined) setUser(propUser);
  }, [propUser]);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = safeStorage.getItem('theme') || 'light';
      return saved === 'dark' || (saved === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) || document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    safeStorage.setItem('theme', nextDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', nextDark);
    triggerCapsuleFeedback({ pitch: nextDark ? 480 : 720, volume: 0.16, hapticDuration: 12 });
    window.dispatchEvent(new Event('theme_changed'));
  };

  useEffect(() => {
    const handleThemeSync = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    window.addEventListener('theme_changed', handleThemeSync);
    return () => window.removeEventListener('theme_changed', handleThemeSync);
  }, []);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getUser()
        .then((res) => {
          if (res?.error) {
            if (res.error.message?.includes('Refresh Token') || res.error.message?.includes('refresh_token')) {
              clearStaleSupabaseTokens();
            }
            setUser(null);
            return;
          }
          setUser(res?.data?.user || null);
        })
        .catch(err => {
          console.warn('Sidebar getUser error ignored:', err);
          setUser(null);
        });

      try {
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user || null);
        });
        return () => {
          data?.subscription?.unsubscribe();
        };
      } catch (err) {
        console.warn('Sidebar onAuthStateChange error ignored:', err);
      }
    }
  }, []);

  const navItems: { 
    id: ViewState; 
    label: string; 
    icon: React.ReactNode;
    subItems?: { id: ViewState; label: string; icon: React.ReactNode }[];
  }[] = [
    { id: 'progress', label: 'My Progress', icon: <LineChart className="w-5 h-5" /> },
    { id: 'learning-path', label: 'Learning Path', icon: <Map className="w-5 h-5" /> },
    { id: 'community', label: 'Community', icon: <Users className="w-5 h-5" /> },
    { id: 'users-portal', label: 'Find Members & Friends', icon: <UserPlus className="w-5 h-5" /> },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: <Settings className="w-5 h-5" />,
      subItems: [
        { id: 'support', label: 'Support & Help', icon: <LifeBuoy className="w-4 h-4" /> },
        { id: 'developer', label: 'Developer', icon: <Code className="w-4 h-4" /> }
      ]
    },
  ];

  if (user?.email?.toLowerCase().endsWith('@admin.com')) {
    navItems.push({ id: 'admin', label: 'Admin Platform', icon: <Code className="w-5 h-5" /> });
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-[10000] backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar content - Semi-transparent dark overlay pane */}
      <aside className={`fixed top-0 left-0 h-screen w-72 max-w-[85vw] bg-white dark:bg-[#161616]/75 dark:backdrop-blur-2xl border-r border-slate-200 dark:border-white/10 flex flex-col z-[10001] transition-transform duration-300 ease-out shadow-2xl dark:shadow-[0_25px_60px_rgba(0,0,0,0.85)] sidebar-pane ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand Logo Header */}
        <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 text-left select-none">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 p-0.5 shadow-sm shadow-indigo-500/20 flex items-center justify-center relative overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-violet-700 rounded-[10px] flex items-center justify-center relative">
                <BookOpen className="w-5 h-5 text-white stroke-[2.2]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-display font-black tracking-tight text-slate-900 dark:text-[#EDEDED]">
                  Edu AI
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-white/10 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-white/10">
                  Core
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-[#A0A0A0] font-medium">Smart Reading & Study Suite</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items list */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1.5">
          {navItems.map((item) => {
            const isSubActive = item.subItems?.some(sub => sub.id === currentView);
            const isSelfActive = currentView === item.id;
            const isHighlighted = isSelfActive || isSubActive;

            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => onChangeView(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    isSelfActive
                      ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-[#EDEDED] dark:border dark:border-indigo-500/30 font-semibold shadow-xs'
                      : isHighlighted
                      ? 'bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-[#EDEDED] font-medium'
                      : 'text-slate-600 dark:text-[#A0A0A0] hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#EDEDED]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1 rounded-lg ${isHighlighted ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 dark:text-[#8E8E93]'}`}>
                      {item.icon}
                    </div>
                    <span>{item.label}</span>
                  </div>
                </button>

                {/* Sub-items (Support and Developer in Setting) */}
                {item.subItems && (
                  <div className="ml-5 pl-3 border-l-2 border-slate-100 dark:border-white/10 space-y-1 pt-0.5 pb-1">
                    {item.subItems.map((sub) => {
                      const isThisSubActive = currentView === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => onChangeView(sub.id)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            isThisSubActive
                              ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-[#EDEDED] font-semibold'
                              : 'text-slate-500 dark:text-[#A0A0A0] hover:text-slate-900 dark:hover:text-[#EDEDED] hover:bg-slate-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <span className={isThisSubActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 dark:text-[#8E8E93]'}>
                            {sub.icon}
                          </span>
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User profile & Theme footer - Semi-transparent dark overlay pane */}
        <div className="p-3.5 border-t border-slate-100 dark:border-white/10 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#181818]/70 dark:backdrop-blur-md border border-slate-100 dark:border-white/10 text-slate-700 dark:text-[#EDEDED] hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer text-xs font-medium"
            title="Toggle theme"
          >
            <div className="flex items-center gap-2">
              {isDark ? <Moon className="w-4 h-4 text-indigo-300" /> : <Sun className="w-4 h-4 text-amber-500" />}
              <span>{isDark ? 'Deep Gray Dark' : 'Light Mode'}</span>
            </div>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white dark:bg-[#141414]/90 border border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-[#A0A0A0]">
              {isDark ? 'Deep Gray #121212' : 'Light'}
            </span>
          </button>

          <div className="flex items-center gap-1.5 w-full">
            <button 
              onClick={() => onChangeView('profile')}
              className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-2xl text-xs sm:text-sm font-medium transition-all cursor-pointer min-w-0 ${
                currentView === 'profile'
                  ? 'bg-indigo-50 dark:bg-white/10 text-indigo-600 dark:text-[#EDEDED] dark:border dark:border-white/10 shadow-xs'
                  : 'text-slate-600 dark:text-[#A0A0A0] hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#EDEDED]'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-sm overflow-hidden">
                {avatarUrl && !avatarFailed ? (
                  <img 
                    src={avatarUrl} 
                    alt="Profile" 
                    className="w-full h-full object-cover" 
                    onError={() => setAvatarFailed(true)}
                  />
                ) : user?.email ? (
                  user.email.charAt(0).toUpperCase()
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-slate-900 dark:text-[#EDEDED] font-medium text-xs sm:text-sm truncate">
                  {user?.user_metadata?.full_name || 'Edu AI Learner'}
                </p>
                <p className="text-slate-400 dark:text-[#8E8E93] text-[11px] truncate">
                  {user?.email || (isGuest ? 'Guest Learner' : 'Active Account')}
                </p>
              </div>
            </button>

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
