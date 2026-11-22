import {
  Bell, MoreHorizontal, ArrowRight,
  BookmarkCheck, MessageCircle, Moon, Sun, User, Camera, Loader2,
  MessageSquare, LogOut, Award
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Book, ViewState } from '../types';
import { getStoredNotifications } from '../lib/notifications';
import { triggerCapsuleFeedback } from '../lib/feedback';
import { useUserAvatar, saveUserAvatarLocally, uploadAndSyncUserAvatar, markAvatarUrlFailed } from '../lib/userAvatarService';
import { safeStorage } from '../lib/safeStorage';
import {
  ACHIEVEMENT_BADGES,
  ACHIEVEMENTS_UPDATED_EVENT,
  getStoredAchievements,
  UserAchievementState,
} from '../lib/achievementsService';
import { ACCOUNT_SYNC_EVENT, pushAccountSyncPatch } from '../lib/accountSyncService';

interface HeaderProps {
  currentView?: ViewState;
  onMenuClick: () => void;
  onBookSelect?: (book: Book) => void;
  onNavigate: (view: ViewState) => void;
  onAddBookToLibrary?: (book: Book) => void;
  user?: any;
  profile?: any;
  books?: Book[];
  onToggleSageSidebar?: () => void;
  isSageSidebarOpen?: boolean;
  onSignOut?: () => void;
}

export function SideNavToggleIcon({
  className = "w-8 h-8 sm:w-8.5 sm:h-8.5",
  title,
  ...props
}: React.SVGProps<SVGSVGElement> & { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id="sideNavIconGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8A95FF" />
          <stop offset="48%" stopColor="#5863FE" />
          <stop offset="100%" stopColor="#242CFE" />
        </linearGradient>
      </defs>
      {/* Left panel of split icon */}
      <path
        d="M 34,8 L 60,8 Q 63,8 63,11 L 63,89 Q 63,92 60,92 L 34,92 Q 8,92 8,66 L 8,34 Q 8,8 34,8 Z"
        fill="url(#sideNavIconGradient)"
      />
      {/* Right panel of split icon */}
      <path
        d="M 69,11 Q 69,8 72,8 Q 92,8 92,34 L 92,66 Q 92,92 72,92 Q 69,92 69,89 Z"
        fill="url(#sideNavIconGradient)"
      />
      {/* Right-pointing chevron in left panel */}
      <path
        d="M 36,37.5 L 49.5,50 L 36,62.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="9.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Header({
  currentView = 'dashboard',
  onMenuClick,
  onNavigate,
  user,
  profile,
  onToggleSageSidebar,
  isSageSidebarOpen: propIsSageSidebarOpen,
  onSignOut
}: HeaderProps) {
  const [internalSageSidebarOpen, setInternalSageSidebarOpen] = useState(false);

  // Sync Sage AI sidebar status
  useEffect(() => {
    const handleSageStatus = (e: any) => {
      if (typeof e?.detail?.isOpen === 'boolean') {
        setInternalSageSidebarOpen(e.detail.isOpen);
      }
    };
    window.addEventListener('sage-sidebar-state-change', handleSageStatus);
    return () => window.removeEventListener('sage-sidebar-state-change', handleSageStatus);
  }, []);

  const isSageOpen = propIsSageSidebarOpen !== undefined ? propIsSageSidebarOpen : internalSageSidebarOpen;

  const handleToggleSage = () => {
    window.dispatchEvent(new CustomEvent('toggle-sage-sidebar'));
    onToggleSageSidebar?.();
  };

  const [unreadNotifCount, setUnreadNotifCount] = useState(() => {
    return getStoredNotifications(user?.id).filter(n => !n.isRead).length;
  });
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = safeStorage.getItem('theme') || 'light';
      return saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) || document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [achievements, setAchievements] = useState<UserAchievementState>(() =>
    getStoredAchievements(user?.id)
  );

  useEffect(() => {
    setAchievements(getStoredAchievements(user?.id));
    const refreshAchievements = (e?: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.userId && user?.id && detail.userId !== user.id) return;
      setAchievements(getStoredAchievements(user?.id));
    };
    window.addEventListener(ACHIEVEMENTS_UPDATED_EVENT, refreshAchievements);
    window.addEventListener(ACCOUNT_SYNC_EVENT, refreshAchievements);
    return () => {
      window.removeEventListener(ACHIEVEMENTS_UPDATED_EVENT, refreshAchievements);
      window.removeEventListener(ACCOUNT_SYNC_EVENT, refreshAchievements);
    };
  }, [user?.id]);

  // Close profile menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isProfileMenuOpen]);

  const userAvatarUrl = useUserAvatar(user, profile);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const headerFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarImgFailed(false);
  }, [userAvatarUrl]);

  const handleHeaderPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingPhoto(true);
      const permanentUrl = await uploadAndSyncUserAvatar(file, user);
      if (permanentUrl) {
        setAvatarImgFailed(false);
      }
    } catch (err) {
      console.warn("Header photo upload error:", err);
    } finally {
      setIsUploadingPhoto(false);
      if (headerFileInputRef.current) headerFileInputRef.current.value = '';
    }
  };

  const userInitial = useMemo(() => {
    const name = user?.user_metadata?.full_name;
    if (name && name.trim().length > 0) return name.trim().charAt(0).toUpperCase();
    const email = user?.email;
    if (email && email.trim().length > 0) return email.trim().charAt(0).toUpperCase();
    return 'U';
  }, [user]);

  const handleToggleTheme = () => {
    const nextIsDark = !isDarkTheme;
    const nextTheme = nextIsDark ? 'dark' : 'light';
    setIsDarkTheme(nextIsDark);
    safeStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextIsDark);
    triggerCapsuleFeedback({ pitch: nextIsDark ? 480 : 720, volume: 0.16, hapticDuration: 12 });
    window.dispatchEvent(new Event('theme_changed'));
    if (user?.id) {
      pushAccountSyncPatch(user.id, {
        userSettings: {
          theme: nextTheme,
          updatedAt: new Date().toISOString(),
        },
      });
    }
  };

  useEffect(() => {
    const handleThemeSync = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkTheme(isDark);
    };
    window.addEventListener('theme_changed', handleThemeSync);
    return () => window.removeEventListener('theme_changed', handleThemeSync);
  }, []);

  // Keep unread count in sync per user
  useEffect(() => {
    const updateCount = () => {
      const count = getStoredNotifications(user?.id).filter(n => !n.isRead).length;
      setUnreadNotifCount(count);
    };

    updateCount();
    window.addEventListener('storage', updateCount);
    window.addEventListener('notifications_updated', updateCount);
    window.addEventListener(ACCOUNT_SYNC_EVENT, updateCount);
    const interval = setInterval(updateCount, 3000);
    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('notifications_updated', updateCount);
      window.removeEventListener(ACCOUNT_SYNC_EVENT, updateCount);
      clearInterval(interval);
    };
  }, [user?.id]);

  return (
    <header className="fixed top-0 inset-x-0 z-[100] pointer-events-none flex items-center justify-between gap-2 sm:gap-3 px-2.5 sm:px-5 md:px-7 pt-2.5 sm:pt-3.5 w-full max-w-full overflow-visible">
      <div className="flex items-center relative gap-2 sm:gap-2.5 min-w-0 overflow-visible pointer-events-none">
        <button
          type="button"
          onClick={() => {
            triggerCapsuleFeedback({ pitch: 540, volume: 0.16, hapticDuration: 12 });
            onMenuClick();
          }}
          className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full liquid-glass-dock hover:scale-105 active:scale-95 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer text-slate-700 dark:text-slate-200 shrink-0 pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 select-none"
          title="Open Navigation"
          aria-label="Open Navigation Menu"
        >
          <div className="absolute top-0 inset-x-2 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full" />
          <SideNavToggleIcon className="w-5 h-5 sm:w-5.5 sm:h-5.5 drop-shadow-[0_2px_6px_rgba(36,44,254,0.28)]" />
        </button>

        {currentView === 'ai-tutor' && (
          <button
            type="button"
            onClick={() => {
              triggerCapsuleFeedback({ pitch: 580, volume: 0.16, hapticDuration: 10 });
              handleToggleSage();
            }}
            className={`pointer-events-auto relative h-10 sm:h-11 px-3 sm:px-3.5 rounded-full liquid-glass-dock text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer shrink-0 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              isSageOpen
                ? 'ring-2 ring-brand-500/70 text-brand-700 dark:text-brand-200'
                : 'text-slate-700 dark:text-slate-200'
            }`}
            title={isSageOpen ? "Hide Sage Chat History" : "Open Sage Chat History"}
            aria-label={isSageOpen ? "Close Sage Chat History" : "Open Sage Chat History"}
          >
            <div className="absolute top-0 inset-x-3 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full" />
            <MessageSquare className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
            <span className="hidden xs:inline sm:inline">{isSageOpen ? 'Hide History' : 'Chat History'}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 pointer-events-auto">
        {/* Hovering Profile Button & Quick Menu */}
        <div className="relative" ref={profileMenuRef}>
          <input
            type="file"
            ref={headerFileInputRef}
            onChange={handleHeaderPhotoUpload}
            accept="image/*"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => {
              triggerCapsuleFeedback({ pitch: 650, volume: 0.16, hapticDuration: 12 });
              setIsProfileMenuOpen(prev => !prev);
            }}
            className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full liquid-glass-dock hover:scale-105 active:scale-95 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer text-slate-700 dark:text-slate-200 shrink-0 overflow-hidden p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              isProfileMenuOpen || currentView === 'profile'
                ? 'ring-2 ring-indigo-500/80 border-indigo-400 dark:border-indigo-500'
                : ''
            }`}
            title={`User Profile (${user?.user_metadata?.full_name || user?.email || 'Learner Account'})`}
            aria-label="User Profile"
          >
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
              {userAvatarUrl && !avatarImgFailed ? (
                <img
                  src={userAvatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover rounded-full"
                  onError={() => {
                    const nextCandidate = markAvatarUrlFailed(userAvatarUrl, user, profile);
                    if (nextCandidate && nextCandidate !== userAvatarUrl) {
                      setAvatarImgFailed(false);
                    } else {
                      setAvatarImgFailed(true);
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-indigo-600 via-brand-600 to-violet-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm font-display shadow-inner rounded-full">
                  {userInitial}
                </div>
              )}
            </div>
          </button>

          {/* User Profile Dropdown Card */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-3xl liquid-glass-dock border border-white/80 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
              {/* Header profile identity */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                <div
                  onClick={() => headerFileInputRef.current?.click()}
                  className="group relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-brand-600 to-violet-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 overflow-hidden cursor-pointer"
                  title="Click to change photo"
                >
                  {userAvatarUrl && !avatarImgFailed ? (
                    <img
                      src={userAvatarUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={() => {
                        const nextCandidate = markAvatarUrlFailed(userAvatarUrl, user, profile);
                        if (nextCandidate && nextCandidate !== userAvatarUrl) {
                          setAvatarImgFailed(false);
                        } else {
                          setAvatarImgFailed(true);
                        }
                      }}
                    />
                  ) : (
                    userInitial
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    {isUploadingPhoto ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 dark:text-white text-sm truncate font-display">
                    {user?.user_metadata?.full_name || 'Edu AI Learner'}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs truncate">
                    {user?.email || 'Active Account'}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                      {user?.user_metadata?.field_of_study || 'Active Scholar'}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
                      {achievements.totalEduPoints.toLocaleString()} EP
                    </span>
                  </div>
                </div>
              </div>

              {/* Action: Go to Profile & Shortcuts */}
              <div className="py-2.5 space-y-1">
                <button
                  onClick={() => headerFileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    {isUploadingPhoto ? (
                      <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 text-indigo-500" />
                    )}
                    <span>{isUploadingPhoto ? 'Uploading photo...' : 'Upload / Change Photo'}</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60">
                    Upload
                  </span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onNavigate('profile');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <User className="w-4 h-4 text-indigo-500" />
                    <span>View Profile &amp; Badges</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    <Award className="w-3.5 h-3.5" />
                    <span>
                      {Object.keys(achievements.earnedBadges).length}/{ACHIEVEMENT_BADGES.length}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onNavigate('workspace');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <BookmarkCheck className="w-4 h-4 text-brand-500" />
                    <span>My Notes & Workspace</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onNavigate('settings');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <MoreHorizontal className="w-4 h-4 text-slate-400" />
                    <span>Preferences & Settings</span>
                  </div>
                </button>

                {onSignOut && (
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <LogOut className="w-4 h-4 text-red-500" />
                      <span>Sign Out</span>
                    </div>
                  </button>
                )}
              </div>

              {/* Theme Locality: Dark & Light Mode Toggle inside User Profile Locality */}
              <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center justify-between p-2 rounded-2xl bg-white/60 dark:bg-black/40 border border-slate-200/60 dark:border-white/10">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {isDarkTheme ? (
                      <Moon className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-500" />
                    )}
                    <span>{isDarkTheme ? 'Dark Mode' : 'Light Mode'}</span>
                  </div>

                  <button
                    onClick={handleToggleTheme}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isDarkTheme ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                    title={isDarkTheme ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isDarkTheme ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hovering Chat Button */}
        <button
          type="button"
          onClick={() => {
            triggerCapsuleFeedback({ pitch: 620, volume: 0.18, hapticDuration: 12 });
            onNavigate('chat');
          }}
          className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full liquid-glass-dock hover:scale-105 active:scale-95 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
            currentView === 'chat'
              ? 'ring-2 ring-indigo-500/80 text-indigo-600 dark:text-indigo-400 border-indigo-400 dark:border-indigo-500'
              : 'text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400'
          }`}
          title="Student Chat & Study Groups"
          aria-label="Open Student Chat"
        >
          <div className="absolute top-0 inset-x-2 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full" />
          <MessageCircle className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
        </button>

        {/* Hovering Notification Bell Button */}
        <button
          type="button"
          onClick={() => {
            triggerCapsuleFeedback({ pitch: 580, volume: 0.18, hapticDuration: 12 });
            onNavigate('notifications');
          }}
          className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full liquid-glass-dock hover:scale-105 active:scale-95 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
            currentView === 'notifications'
              ? 'ring-2 ring-indigo-500/80 text-indigo-600 dark:text-indigo-400 border-indigo-400 dark:border-indigo-500'
              : 'text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400'
          }`}
          title="Notifications & Broadcasts Page"
          aria-label="Open Notifications"
        >
          <div className="absolute top-0 inset-x-2 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full" />
          <Bell className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          {unreadNotifCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs">
              {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
