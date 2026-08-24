import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Megaphone, 
  GraduationCap, 
  Sparkles, 
  Users, 
  Info, 
  Check, 
  CheckCheck, 
  Trash2, 
  PlusCircle, 
  Search, 
  ArrowRight, 
  Pin, 
  Clock, 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  Send, 
  BookOpen,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Copy,
  ExternalLink,
  Settings as SettingsIcon,
  RefreshCw,
  X,
  Layers
} from 'lucide-react';
import { 
  AppNotification, 
  NotificationType, 
  NotificationPriority,
  getStoredNotifications, 
  saveStoredNotifications, 
  INITIAL_NOTIFICATIONS 
} from '../lib/notifications';
import { ViewState } from '../types';
import { triggerCapsuleFeedback } from '../lib/feedback';

interface NotificationsProps {
  onNavigate: (view: ViewState) => void;
  user?: any;
}

export function Notifications({ onNavigate, user }: NotificationsProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getStoredNotifications());
  const [activeTab, setActiveTab] = useState<'all' | NotificationType>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<'all' | NotificationPriority>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sound preference
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('edu_notif_sound') !== 'false';
  });

  // Channel notification preferences
  const [channelPrefs, setChannelPrefs] = useState(() => {
    const saved = localStorage.getItem('edu_channel_prefs');
    return saved ? JSON.parse(saved) : {
      platform: true,
      teacher: true,
      ai_study: true,
      peer: true,
      audio_chime: true
    };
  });

  // Composer Form State
  const [newNotifType, setNewNotifType] = useState<NotificationType>('teacher');
  const [newAuthorName, setNewAuthorName] = useState(user?.user_metadata?.full_name ? `${user.user_metadata.full_name} (Instructor)` : 'Dr. Kamau (Physics)');
  const [newAuthorRole, setNewAuthorRole] = useState<'Teacher' | 'Developer' | 'Platform' | 'AI Tutor' | 'Classmate'>('Teacher');
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newActionLabel, setNewActionLabel] = useState('Start Practice Quiz');
  const [newActionView, setNewActionView] = useState<ViewState>('quizzes');
  const [newPriority, setNewPriority] = useState<NotificationPriority>('urgent');
  const [newTags, setNewTags] = useState('Physics, Assignment, KCSE');

  // Sync notifications on mount and window focus
  useEffect(() => {
    const handleUpdate = () => {
      setNotifications(getStoredNotifications());
    };
    window.addEventListener('notifications_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('notifications_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Stats calculations
  const totalCount = notifications.length;
  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);
  const teacherCount = useMemo(() => notifications.filter(n => n.type === 'teacher').length, [notifications]);
  const platformCount = useMemo(() => notifications.filter(n => n.type === 'platform').length, [notifications]);
  const aiCount = useMemo(() => notifications.filter(n => n.type === 'ai_study').length, [notifications]);
  const peerCount = useMemo(() => notifications.filter(n => n.type === 'peer').length, [notifications]);

  // Filtered and Sorted list (Pinned on top, then newest)
  const filteredNotifications = useMemo(() => {
    return notifications
      .filter(item => {
        if (activeTab !== 'all' && item.type !== activeTab) return false;
        if (unreadOnly && item.isRead) return false;
        if (selectedPriority !== 'all' && item.priority !== selectedPriority) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchMessage = item.message.toLowerCase().includes(q);
          const matchAuthor = item.author.name.toLowerCase().includes(q);
          const matchTags = item.tags?.some(t => t.toLowerCase().includes(q));
          if (!matchTitle && !matchMessage && !matchAuthor && !matchTags) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.createdAt - a.createdAt;
      });
  }, [notifications, activeTab, unreadOnly, selectedPriority, searchQuery]);

  // Handlers
  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (soundEnabled) triggerCapsuleFeedback({ pitch: 520, volume: 0.15, hapticDuration: 8 });
    const updated = notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
    setNotifications(updated);
    saveStoredNotifications(updated);
  };

  const handleToggleRead = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (soundEnabled) triggerCapsuleFeedback({ pitch: 480, volume: 0.12, hapticDuration: 10 });
    const updated = notifications.map(n => n.id === id ? { ...n, isRead: !n.isRead } : n);
    setNotifications(updated);
    saveStoredNotifications(updated);
    triggerToast('Notice status updated');
  };

  const handleTogglePin = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (soundEnabled) triggerCapsuleFeedback({ pitch: 600, volume: 0.15, hapticDuration: 12 });
    const updated = notifications.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n);
    setNotifications(updated);
    saveStoredNotifications(updated);
    triggerToast('Pin status updated');
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (soundEnabled) triggerCapsuleFeedback({ pitch: 360, volume: 0.15, hapticDuration: 15 });
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    saveStoredNotifications(updated);
    triggerToast('Notification dismissed');
  };

  const handleMarkAllRead = () => {
    if (soundEnabled) triggerCapsuleFeedback({ pitch: 620, volume: 0.2, hapticDuration: 18 });
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    setNotifications(updated);
    saveStoredNotifications(updated);
    triggerToast('All notifications marked as read');
  };

  const handleClearRead = () => {
    if (soundEnabled) triggerCapsuleFeedback({ pitch: 420, volume: 0.15, hapticDuration: 14 });
    const updated = notifications.filter(n => !n.isRead);
    setNotifications(updated);
    saveStoredNotifications(updated);
    triggerToast('Cleared read notifications');
  };

  const handleResetDefaults = () => {
    if (soundEnabled) triggerCapsuleFeedback({ pitch: 540, volume: 0.15, hapticDuration: 12 });
    setNotifications(INITIAL_NOTIFICATIONS);
    saveStoredNotifications(INITIAL_NOTIFICATIONS);
    triggerToast('Restored default notification feed');
  };

  const handleCopyNotice = (notif: AppNotification, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${notif.title}\n\n${notif.message}\n— ${notif.author.name}`);
    triggerToast('Notice copied to clipboard');
  };

  const handleActionClick = (notif: AppNotification) => {
    handleMarkAsRead(notif.id);
    if (notif.actionView) {
      onNavigate(notif.actionView);
    }
  };

  // Submit Broadcast Announcement
  const handleCreateNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newMessage.trim()) return;

    if (soundEnabled) triggerCapsuleFeedback({ pitch: 680, volume: 0.25, hapticDuration: 22 });

    const tagList = newTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const newNotification: AppNotification = {
      id: `notif-custom-${Date.now()}`,
      type: newNotifType,
      title: newTitle.trim(),
      message: newMessage.trim(),
      timestamp: 'Just now',
      createdAt: Date.now(),
      isRead: false,
      priority: newPriority,
      author: {
        name: newAuthorName.trim() || 'Instructor / Team',
        role: newAuthorRole,
        badge: newNotifType === 'platform' ? 'Platform Broadcast' : newNotifType === 'teacher' ? 'Classroom Broadcast' : newNotifType === 'ai_study' ? 'AI Mentor' : 'Study Group',
      },
      actionLabel: newActionLabel.trim() || undefined,
      actionView: newActionView || undefined,
      tags: tagList.length > 0 ? tagList : [newNotifType.toUpperCase(), 'Live Notice'],
      pinned: newNotifType === 'platform',
    };

    const updated = [newNotification, ...notifications];
    setNotifications(updated);
    saveStoredNotifications(updated);

    // Reset Form
    setNewTitle('');
    setNewMessage('');
    setShowComposer(false);
    triggerToast('Broadcast announcement published to feed');
  };

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'platform':
        return <Megaphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'teacher':
        return <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'ai_study':
        return <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />;
      case 'peer':
        return <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getTypeBadgeColor = (type: NotificationType) => {
    switch (type) {
      case 'platform':
        return 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60';
      case 'teacher':
        return 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60';
      case 'ai_study':
        return 'bg-violet-50 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 border-violet-200/60 dark:border-violet-800/60';
      case 'peer':
        return 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getPriorityBadge = (priority?: NotificationPriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            Due Soon / Urgent
          </span>
        );
      case 'high':
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
            <Flame className="w-2.5 h-2.5" />
            High Priority
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-sans">
      {/* Toast popup */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/90 text-white text-xs font-semibold shadow-xl backdrop-blur-md border border-white/20 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-700 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 relative">
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 shadow-sm animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Notifications & Broadcasts
                </h1>
                {unreadCount > 0 ? (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-800/70">
                    {unreadCount} Unread
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center gap-1">
                    <Check className="w-3 h-3" /> All caught up
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Platform releases, teacher-to-student assignments, AI study coach streaks & peer circles.
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center flex-wrap gap-2 pt-2 md:pt-0">
          <button
            onClick={() => setShowComposer(!showComposer)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
              showComposer 
                ? 'bg-slate-900 text-white dark:bg-indigo-600' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showComposer ? 'Close Composer' : 'Broadcast Notice'}</span>
          </button>

          <button
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Mark All Read</span>
          </button>

          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              localStorage.setItem('edu_notif_sound', String(next));
              if (next) triggerCapsuleFeedback({ pitch: 600, volume: 0.2, hapticDuration: 10 });
              triggerToast(next ? 'Notification chimes enabled' : 'Notification chimes muted');
            }}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title={soundEnabled ? 'Mute audio chimes' : 'Enable audio chimes'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Notification Preferences"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <button
          onClick={() => { setActiveTab('all'); setUnreadOnly(false); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'all' && !unreadOnly
              ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Total Feed</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">{totalCount}</div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5 font-medium">All active alerts</div>
        </button>

        <button
          onClick={() => { setActiveTab('platform'); setUnreadOnly(false); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'platform'
              ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Platform & Devs</span>
            <Megaphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">{platformCount}</div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5 font-medium">Curriculum & Releases</div>
        </button>

        <button
          onClick={() => { setActiveTab('teacher'); setUnreadOnly(false); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'teacher'
              ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Teachers & Classes</span>
            <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">{teacherCount}</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">Assignments & Grades</div>
        </button>

        <button
          onClick={() => { setActiveTab('ai_study'); setUnreadOnly(false); }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeTab === 'ai_study'
              ? 'bg-violet-50/70 dark:bg-violet-950/40 border-violet-300 dark:border-violet-800 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">AI & Study Goals</span>
            <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">{aiCount}</div>
          <div className="text-[11px] text-violet-600 dark:text-violet-400 mt-0.5 font-medium">Streaks & Adaptive Review</div>
        </button>
      </div>

      {/* Broadcast Notice Composer Modal / Section */}
      <AnimatePresence>
        {showComposer && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/60 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-800/80 shadow-md"
          >
            <div className="flex items-center justify-between pb-4 border-b border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Publish New Notification / Broadcast Announcement
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Send platform-wide updates, teacher-to-student homework drops, or AI reminders.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowComposer(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNotification} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Notification Category</label>
                  <select
                    value={newNotifType}
                    onChange={(e) => {
                      const t = e.target.value as NotificationType;
                      setNewNotifType(t);
                      if (t === 'teacher') {
                        setNewAuthorName('Dr. Kamau (Physics Instructor)');
                        setNewAuthorRole('Teacher');
                        setNewActionLabel('Start Practice Quiz');
                        setNewActionView('quizzes');
                        setNewTags('Physics, Assignment, KCSE');
                      } else if (t === 'platform') {
                        setNewAuthorName('Edu AI Core Dev Team');
                        setNewAuthorRole('Developer');
                        setNewActionLabel('Explore Library');
                        setNewActionView('library');
                        setNewTags('Platform Update, Kenya CBC, v2.5');
                      } else if (t === 'ai_study') {
                        setNewAuthorName('Edu AI Study Coach');
                        setNewAuthorRole('AI Tutor');
                        setNewActionLabel('Review Chapter with AI');
                        setNewActionView('ai-tutor');
                        setNewTags('Adaptive Review, Spaced Repetition');
                      } else {
                        setNewAuthorName('Grace Otieno (Study Lead)');
                        setNewAuthorRole('Classmate');
                        setNewActionLabel('Open Community Circle');
                        setNewActionView('community');
                        setNewTags('Study Circle, Peer Notes');
                      }
                    }}
                    className="w-full mt-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="teacher">👩‍🏫 Teacher to Students (Assignment / Homework / Grade)</option>
                    <option value="platform">📢 Platform & Developer Broadcast (Curriculum / Feature)</option>
                    <option value="ai_study">🤖 AI Study Coach (Goal / Streak / Review)</option>
                    <option value="peer">👥 Peer to Peer (Study Circle / Collaboration)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Sender / Author Name</label>
                  <input
                    type="text"
                    required
                    value={newAuthorName}
                    onChange={(e) => setNewAuthorName(e.target.value)}
                    placeholder="e.g. Mrs. Wanjiku (Chemistry Dept)"
                    className="w-full mt-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Priority Level</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as NotificationPriority)}
                    className="w-full mt-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="urgent">🚨 Urgent / Due Soon</option>
                    <option value="high">🔥 High Priority</option>
                    <option value="normal">Standard Priority</option>
                    <option value="low">Informational / Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Notice Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Mathematics Calculus: Integration by Substitution Homework Dropped"
                  className="w-full mt-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Announcement Details & Context</label>
                <textarea
                  required
                  rows={3}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Provide instructions, assignment objectives, deadlines, or release details..."
                  className="w-full mt-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Action Button Label</label>
                  <input
                    type="text"
                    value={newActionLabel}
                    onChange={(e) => setNewActionLabel(e.target.value)}
                    placeholder="e.g. Start Practice Quiz"
                    className="w-full mt-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Destination View</label>
                  <select
                    value={newActionView}
                    onChange={(e) => setNewActionView(e.target.value as ViewState)}
                    className="w-full mt-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  >
                    <option value="quizzes">Quizzes & Assessment Tests</option>
                    <option value="library">Textbook Library & CBC Books</option>
                    <option value="ai-tutor">AI Tutor & Smart Explanations</option>
                    <option value="workspace">Notebook & Workspace</option>
                    <option value="community">Community & Study Circles</option>
                    <option value="chat">Student Discussion Chat</option>
                    <option value="book-store">Book Store</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Hashtags (Comma-separated)</label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="e.g. Mathematics, Calculus, Homework"
                    className="w-full mt-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowComposer(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Publish Notice to Live Feed</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Filter Tabs & Search Controls */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { id: 'all', label: 'All Notifications', icon: <Bell className="w-4 h-4" />, count: totalCount },
              { id: 'platform', label: 'Platform & Devs', icon: <Megaphone className="w-4 h-4" />, count: platformCount },
              { id: 'teacher', label: 'Teachers & Classes', icon: <GraduationCap className="w-4 h-4" />, count: teacherCount },
              { id: 'ai_study', label: 'AI Study Coach', icon: <Sparkles className="w-4 h-4" />, count: aiCount },
              { id: 'peer', label: 'Peer Circles', icon: <Users className="w-4 h-4" />, count: peerCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (soundEnabled) triggerCapsuleFeedback({ pitch: 500, volume: 0.1, hapticDuration: 8 });
                  setActiveTab(tab.id as any);
                }}
                className={`px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white dark:bg-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Clear / Reset Controls */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <button
              onClick={handleClearRead}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Read</span>
            </button>
            <button
              onClick={handleResetDefaults}
              className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Samples</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search announcements, subjects, teachers, hashtags..."
              className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as any)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">🚨 Urgent / Due Soon</option>
              <option value="high">🔥 High Priority</option>
              <option value="normal">Standard Priority</option>
            </select>

            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
              />
              <span>Unread Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Main Notification Cards Feed */}
      <div className="space-y-3.5">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => (
            <motion.div
              key={notif.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              onClick={() => handleMarkAsRead(notif.id)}
              className={`p-5 rounded-3xl border transition-all relative overflow-hidden group cursor-pointer ${
                notif.isRead
                  ? 'bg-white/90 dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800/80 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-indigo-300/80 dark:border-indigo-800 shadow-md shadow-indigo-500/5 ring-1 ring-indigo-500/20'
              }`}
            >
              {/* Left Accent Bar for unread items */}
              {!notif.isRead && (
                <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-500 to-violet-600" />
              )}

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                {/* Notice Header: Icon, Author, Role, Timestamps */}
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-2xl shadow-xs shrink-0 ${
                    notif.type === 'platform' 
                      ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300' 
                      : notif.type === 'teacher' 
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' 
                      : notif.type === 'ai_study' 
                      ? 'bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300' 
                      : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                  }`}>
                    {getTypeIcon(notif.type)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {notif.author.name}
                      </span>
                      {notif.author.badge && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getTypeBadgeColor(notif.type)}`}>
                          {notif.author.badge}
                        </span>
                      )}
                      {getPriorityBadge(notif.priority)}
                      {notif.pinned && (
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Pin className="w-2.5 h-2.5 fill-current" /> Pinned
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{notif.timestamp}</span>
                    </div>
                  </div>
                </div>

                {/* Right Quick Controls */}
                <div className="flex items-center gap-1 self-end sm:self-auto opacity-90 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleTogglePin(notif.id, e)}
                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={notif.pinned ? 'Unpin notification' : 'Pin to top of feed'}
                  >
                    <Pin className={`w-4 h-4 ${notif.pinned ? 'text-indigo-600 fill-current' : ''}`} />
                  </button>

                  <button
                    onClick={(e) => handleCopyNotice(notif, e)}
                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Copy notice text"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => handleToggleRead(notif.id, e)}
                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={notif.isRead ? 'Mark as unread' : 'Mark as read'}
                  >
                    <Check className={`w-4 h-4 ${notif.isRead ? 'text-slate-300 dark:text-slate-600' : 'text-indigo-600 font-bold'}`} />
                  </button>

                  <button
                    onClick={(e) => handleDelete(notif.id, e)}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Dismiss notification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & Body */}
              <div className="mt-3.5 pl-0 sm:pl-12">
                <h3 className={`text-base font-bold leading-snug ${
                  notif.isRead ? 'text-slate-800 dark:text-slate-200' : 'text-slate-900 dark:text-white'
                }`}>
                  {notif.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-1.5">
                  {notif.message}
                </p>

                {/* Footer tags and action button */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {notif.tags?.map((tag) => (
                      <button
                        key={tag}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchQuery(tag);
                        }}
                        className="text-[11px] font-medium px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>

                  {notif.actionLabel && notif.actionView && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActionClick(notif);
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-2xl flex items-center gap-2 transition-all shadow-sm shadow-indigo-500/10 cursor-pointer ml-auto"
                    >
                      <span>{notif.actionLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          /* Empty state */
          <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {unreadOnly ? 'No unread notifications' : 'No notifications found'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {unreadOnly 
                ? 'You are all caught up! You have read all platform updates, teacher assignments, and AI reminders.'
                : 'No announcements match your current search or category filter.'}
            </p>
            <div className="flex items-center justify-center gap-2.5 mt-5">
              {unreadOnly && (
                <button
                  onClick={() => setUnreadOnly(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Show All Notifications
                </button>
              )}
              <button
                onClick={handleResetDefaults}
                className="px-4 py-2 text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Restore Sample Feed
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notification Preferences Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-[130] overflow-y-auto flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl z-10 relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <SettingsIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Notification Preferences
                    </h3>
                    <p className="text-xs text-slate-500">Manage what alerts you receive</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3.5">
                {[
                  { key: 'platform', label: 'Platform & Dev Updates', desc: 'Curriculum releases, offline sync improvements, and core AI engine upgrades.' },
                  { key: 'teacher', label: 'Teacher & Classroom Broadcasts', desc: 'Direct assignment drops, quiz deadlines, and graded homework feedback.' },
                  { key: 'ai_study', label: 'AI Study Coach & Streaks', desc: 'Daily reading goal progress, review flashcards, and spaced repetition.' },
                  { key: 'peer', label: 'Peer & Community Circles', desc: 'Study group invitations, shared quote highlights, and peer note discussions.' },
                  { key: 'audio_chime', label: 'Auditory Bell Chimes', desc: 'Play subtle acoustic sounds on new notifications.' },
                ].map((item) => (
                  <div key={item.key} className="flex items-start justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="pr-3">
                      <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">{item.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{item.desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={channelPrefs[item.key as keyof typeof channelPrefs] ?? true}
                        onChange={() => {
                          const updated = {
                            ...channelPrefs,
                            [item.key]: !(channelPrefs[item.key as keyof typeof channelPrefs] ?? true)
                          };
                          setChannelPrefs(updated);
                          localStorage.setItem('edu_channel_prefs', JSON.stringify(updated));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
