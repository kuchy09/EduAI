import React, { useEffect, useState } from 'react';
import { Map, Users, Settings, LifeBuoy, Code, User, LineChart, X, UserPlus, Moon, Sun, LogOut, FlaskConical, BookOpen, Brain, Zap } from 'lucide-react';
import { ViewState } from '../types';
import { supabase, clearStaleSupabaseTokens } from '../lib/supabase';
import { triggerCapsuleFeedback } from '../lib/feedback';
import { useUserAvatar, markAvatarUrlFailed } from '../lib/userAvatarService';
import { safeStorage, safeSessionStorage } from '../lib/safeStorage';
import { isAdminLoginEmail } from '../../shared/adminAuth';
import { EduAiBrandMark } from './icons/EduAiBrandMark';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  profile?: any;
  isGuest?: boolean;
  onSignOut?: () => void;
  pendingRequestsCount?: number;
}

export function Sidebar({ currentView, onChangeView, isOpen, onClose, user: propUser, profile, isGuest, onSignOut, pendingRequestsCount = 0 }: SidebarProps) {
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
    { id: 'library', label: '01 · Learn (Library)', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'ai-tutor', label: '02 · Understand (Sage AI)', icon: <Brain className="w-5 h-5" /> },
    { id: 'edulab', label: '03 · Experiment (EduLab)', icon: <FlaskConical className="w-5 h-5" /> },
    { id: 'quizzes', label: '04 · Test (Quizzes)', icon: <Zap className="w-5 h-5" /> },
    { id: 'progress', label: '05 · Improve (Progress)', icon: <LineChart className="w-5 h-5" /> },
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

  if (isAdminLoginEmail(user?.email)) {
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

      {/* Sidebar content */}
      <aside className={`fixed top-0 left-0 h-screen w-72 max-w-[85vw] bg-[#FAF8F4] dark:bg-[#151B20] border-r border-[#E2DDD3] dark:border-[#26313A] flex flex-col z-[10001] transition-transform duration-300 ease-out shadow-2xl sidebar-pane ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand Logo Header */}
        <div className="p-5 border-b border-[#E2DDD3] dark:border-[#26313A] flex items-center justify-between">
          <div className="flex items-center gap-3 text-left select-none">
            <div className="w-10 h-10 rounded-xl bg-brand-600 dark:bg-brand-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <EduAiBrandMark className="w-6 h-6" />
            </div>
            <div>
              <span className="text-lg font-display font-semibold tracking-tight text-slate-900 dark:text-white block leading-tight">
                Edu AI
              </span>
              <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-slate-400 dark:text-slate-400 mt-0.5">
                Study Atelier
              </p>
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
                      ? 'bg-brand-50 dark:bg-brand-100/70 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-300/30 font-semibold'
                      : isHighlighted
                      ? 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white font-medium'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1 rounded-lg ${isHighlighted ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-400'}`}>
                      {item.icon}
                    </div>
                    <span>{item.label}</span>
                  </div>
                  {item.id === 'users-portal' && pendingRequestsCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-brand-600 text-white text-[10px] font-mono font-bold tabular-nums flex items-center justify-center">
                      {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                    </span>
                  )}
                </button>

                {/* Sub-items */}
                {item.subItems && (
                  <div className="ml-6 pl-3 border-l border-[#E2DDD3] dark:border-[#26313A] space-y-1 pt-0.5 pb-1">
                    {item.subItems.map((sub) => {
                      const isThisSubActive = currentView === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => onChangeView(sub.id)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            isThisSubActive
                              ? 'bg-brand-50 dark:bg-brand-100/60 text-brand-700 dark:text-brand-400 font-semibold'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/5'
                          }`}
                        >
                          <span className={isThisSubActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-400'}>
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

        {/* User profile & Theme footer */}
        <div className="p-3.5 border-t border-[#E2DDD3] dark:border-[#26313A] space-y-2">
          <PWAInstallButton
            variant="sidebar"
            onOpenAndroidSettings={() => {
              safeSessionStorage.setItem('edu_ai_settings_tab', 'flutter');
              onChangeView('settings');
              onClose();
            }}
            onActionDone={onClose}
          />
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-[#11161A] border border-[#E2DDD3] dark:border-[#26313A] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-white/5 transition-all cursor-pointer text-xs font-medium"
            title="Toggle theme"
          >
            <div className="flex items-center gap-2">
              {isDark ? <Moon className="w-4 h-4 text-brand-400" /> : <Sun className="w-4 h-4 text-amber-600" />}
              <span>{isDark ? 'Ink Dark' : 'Archival Light'}</span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isDark ? 'Dark' : 'Light'}
            </span>
          </button>

          <div className="flex items-center gap-1.5 w-full">
            <button 
              onClick={() => onChangeView('profile')}
              className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer min-w-0 ${
                currentView === 'profile'
                  ? 'bg-brand-50 dark:bg-white/10 text-brand-700 dark:text-white border border-brand-200 dark:border-white/10'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-brand-600 dark:bg-brand-500 text-white flex items-center justify-center shrink-0 font-semibold text-xs shadow-sm overflow-hidden">
                {avatarUrl && !avatarFailed ? (
                  <img 
                    src={avatarUrl} 
                    alt="Profile" 
                    className="w-full h-full object-cover" 
                    onError={() => {
                      const nextCandidate = markAvatarUrlFailed(avatarUrl, user, profile);
                      if (nextCandidate && nextCandidate !== avatarUrl) {
                        setAvatarFailed(false);
                      } else {
                        setAvatarFailed(true);
                      }
                    }}
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
