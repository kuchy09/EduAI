import { User, Bell, Shield, Moon, Smartphone, Type, Monitor, LogOut, HardDrive, Wifi, WifiOff, RefreshCw, Trash2, CheckCircle2, BookOpen, Bookmark, Highlighter, Database, Layers, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase, clearStaleSupabaseTokens } from '../lib/supabase';
import { useOffline } from '../lib/useOffline';
import { getAllCachedBooks, CachedBookMeta } from '../lib/offlineManager';

type Tab = 'appearance' | 'notifications' | 'privacy' | 'offline';

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('appearance');
  const [theme, setTheme] = useState(((() => { try { return localStorage.getItem('theme'); } catch (e) { return null; } })()) || 'light');
  const [fontSize, setFontSize] = useState(((() => { try { return localStorage.getItem('fontSize'); } catch (e) { return null; } })()) || 'Medium');
  const { isOnline, storageStats, clearCache, triggerSync, isSyncing, lastSyncResult, deleteCachedBook, refreshOfflineState } = useOffline();
  const [cacheClearedToast, setCacheClearedToast] = useState(false);
  const [syncToast, setSyncToast] = useState(false);
  const [cachedBooksList, setCachedBooksList] = useState<CachedBookMeta[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);

  useEffect(() => {
    if (activeTab === 'offline') {
      setIsLoadingBooks(true);
      getAllCachedBooks().then(books => {
        setCachedBooksList(books);
        setIsLoadingBooks(false);
      }).catch(() => {
        setIsLoadingBooks(false);
      });
    }
  }, [activeTab, storageStats.count]);
  
  const [notifications, setNotifications] = useState({
    study: JSON.parse(((() => { try { return localStorage.getItem('notify_study'); } catch (e) { return null; } })()) ?? 'true'),
    mentions: JSON.parse(((() => { try { return localStorage.getItem('notify_mentions'); } catch (e) { return null; } })()) ?? 'true'),
    recs: JSON.parse(((() => { try { return localStorage.getItem('notify_recs'); } catch (e) { return null; } })()) ?? 'false'),
    progress: JSON.parse(((() => { try { return localStorage.getItem('notify_progress'); } catch (e) { return null; } })()) ?? 'false'),
  });

  const [privacy, setPrivacy] = useState({
    public: JSON.parse(((() => { try { return localStorage.getItem('privacy_public'); } catch (e) { return null; } })()) ?? 'true'),
    data: JSON.parse(((() => { try { return localStorage.getItem('privacy_data'); } catch (e) { return null; } })()) ?? 'true'),
  });

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

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePrivacy = (key: keyof typeof privacy) => {
    setPrivacy(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSignOut = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Sign out error handled:', e);
      }
    }
    clearStaleSupabaseTokens();
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">Settings</h2>
        <p className="text-slate-500">Manage your account and preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-1">
          <button 
            onClick={() => setActiveTab('appearance')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'appearance' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Monitor className="w-4 h-4" /> Appearance
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Bell className="w-4 h-4" /> Notifications
          </button>
          <button 
            onClick={() => setActiveTab('privacy')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'privacy' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Shield className="w-4 h-4" /> Privacy & Security
          </button>
          <button 
            onClick={() => setActiveTab('offline')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'offline' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <HardDrive className="w-4 h-4" /> Offline & Sync
          </button>
        </div>

        <div className="md:col-span-2 space-y-6">
          {activeTab === 'appearance' && (
            <>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Theme & Appearance</h3>
                 <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Choose your preferred reading and interface mode. Dark theme uses obsidian styling matching the Chat interface.</p>
                 <div className="grid grid-cols-3 gap-4">
                   <button 
                     onClick={() => setTheme('light')}
                     className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-colors cursor-pointer ${theme === 'light' ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-200 dark:hover:border-slate-700'}`}
                   >
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${theme === 'light' ? 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}><User className="w-4 h-4" /></div>
                     <span className={`text-sm font-medium ${theme === 'light' ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>Light</span>
                   </button>
                   <button 
                     onClick={() => setTheme('dark')}
                     className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-colors cursor-pointer ${theme === 'dark' ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-200 dark:hover:border-slate-700'}`}
                   >
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-800 text-white'}`}><Moon className="w-4 h-4" /></div>
                     <span className={`text-sm font-medium ${theme === 'dark' ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>Dark (Chat)</span>
                   </button>
                   <button 
                     onClick={() => setTheme('system')}
                     className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-colors cursor-pointer ${theme === 'system' ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-200 dark:hover:border-slate-700'}`}
                   >
                     <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0"><Smartphone className="w-4 h-4" /></div>
                     <span className={`text-sm font-medium ${theme === 'system' ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>System</span>
                   </button>
                 </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Reading Preferences</h3>
                 <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Type className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">Font Size</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">Adjust the default text size for the reader</div>
                        </div>
                      </div>
                      <select 
                        value={fontSize} 
                        onChange={(e) => setFontSize(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500"
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
               <div>
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white">Notification Channels & Categories</h3>
                 <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure which alerts you receive across your Edu AI study sessions.</p>
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
                   <div key={item.key} className="flex items-start justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="pr-4">
                        <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{item.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{item.desc}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer mt-1 shrink-0">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={notifications[item.key as keyof typeof notifications] ?? item.defaultVal}
                          onChange={() => toggleNotification(item.key as keyof typeof notifications)}
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-8">
               <div>
                 <h3 className="text-lg font-bold text-slate-900 mb-4">Security</h3>
                 <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl">
                      <div>
                        <div className="font-medium text-slate-900">Change Password</div>
                        <div className="text-sm text-slate-500 mt-0.5">Update your password to keep your account secure</div>
                      </div>
                      <button className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700 transition-colors">
                        Update
                      </button>
                   </div>
                   <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl">
                      <div>
                        <div className="font-medium text-slate-900">Two-Factor Authentication</div>
                        <div className="text-sm text-slate-500 mt-0.5">Add an extra layer of security to your account</div>
                      </div>
                      <button className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors">
                        Enable
                      </button>
                   </div>
                 </div>
               </div>
               
                <div>
                 <h3 className="text-lg font-bold text-slate-900 mb-4">Privacy</h3>
                 <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl">
                      <div>
                        <div className="font-medium text-slate-900">Public Profile</div>
                        <div className="text-sm text-slate-500 mt-0.5">Allow other members to see your reading progress</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={privacy.public}
                          onChange={() => togglePrivacy('public')}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                      </label>
                   </div>
                   <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl">
                      <div>
                        <div className="font-medium text-slate-900">Data Sharing for AI Insights</div>
                        <div className="text-sm text-slate-500 mt-0.5">Allow AI models to learn from your study patterns</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={privacy.data}
                          onChange={() => togglePrivacy('data')}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                      </label>
                   </div>
                 </div>
               </div>

               <div className="pt-4 border-t border-slate-100">
                 <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors"
                 >
                   <LogOut className="w-4 h-4" />
                   Sign Out
                 </button>
               </div>
            </div>
          )}

          {activeTab === 'offline' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Offline Reading & IndexedDB Layer</h3>
                <p className="text-sm text-slate-500">Fast local database storage for book content, PDF documents, reading progress, and annotations.</p>
              </div>

              {/* Main Stat Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cached Books</div>
                    <div className="text-lg font-bold text-slate-900">{storageStats.count} {storageStats.count === 1 ? 'Book' : 'Books'}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">IndexedDB Data</div>
                    <div className="text-lg font-bold text-slate-900">{storageStats.formattedSize}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Progress Records</div>
                    <div className="text-lg font-bold text-slate-900">{storageStats.progressCount ?? 0} Tracked</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4 text-amber-600" />}
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Network State</div>
                    <div className={`text-sm font-bold truncate ${isOnline ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
              </div>

              {/* IndexedDB Store Overview */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">IndexedDB Architecture (v2 Active)</span>
                  </div>
                  {storageStats.quotaUsagePercent !== undefined && (
                    <span className="text-xs text-slate-500 font-medium">
                      Browser Storage Used: {storageStats.quotaUsagePercent}%
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-2xs">
                    <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
                      <BookOpen className="w-3 h-3 text-brand-600" /> Books & Blobs
                    </div>
                    <div className="text-sm font-bold text-slate-800 mt-1">{storageStats.count} stored</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-2xs">
                    <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
                      <Layers className="w-3 h-3 text-indigo-600" /> Book Content
                    </div>
                    <div className="text-sm font-bold text-slate-800 mt-1">{storageStats.contentCount ?? 0} cached</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-2xs">
                    <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
                      <Highlighter className="w-3 h-3 text-amber-600" /> Highlights
                    </div>
                    <div className="text-sm font-bold text-slate-800 mt-1">{storageStats.highlightsCount ?? 0} notes</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-2xs">
                    <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
                      <Bookmark className="w-3 h-3 text-rose-600" /> Bookmarks
                    </div>
                    <div className="text-sm font-bold text-slate-800 mt-1">{storageStats.bookmarksCount ?? 0} saved</div>
                  </div>
                </div>
              </div>

              {/* Cached Books List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">Downloaded Books on this Device</h4>
                  <button
                    onClick={async () => {
                      const books = await getAllCachedBooks();
                      setCachedBooksList(books);
                    }}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                {isLoadingBooks ? (
                  <div className="py-6 text-center text-xs text-slate-400">Loading cached books...</div>
                ) : cachedBooksList.length === 0 ? (
                  <div className="py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                    No books downloaded for offline use yet. Click the Download icon on any book card in your Library to cache it locally in IndexedDB.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {cachedBooksList.map(book => (
                      <div key={book.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          {book.coverImage ? (
                            <img src={book.coverImage} alt={book.title} className="w-10 h-14 object-cover rounded shadow-2xs shrink-0" />
                          ) : (
                            <div className="w-10 h-14 bg-brand-50 rounded border border-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs shrink-0">
                              {book.title.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">{book.title}</div>
                            <div className="text-xs text-slate-500 truncate">{book.author} • {book.category}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[10px] font-semibold">
                                {book.fileSizeFormatted || 'Cached'}
                              </span>
                              <span className="text-[10px] text-slate-400">
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
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
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
                <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="font-medium text-slate-900">Purge Local IndexedDB Database</div>
                    <div className="text-sm text-slate-500 mt-0.5">Clears all downloaded books, cached text content, and resets offline storage.</div>
                  </div>
                  <button
                    onClick={async () => {
                      await clearCache();
                      setCachedBooksList([]);
                      setCacheClearedToast(true);
                      setTimeout(() => setCacheClearedToast(false), 3000);
                    }}
                    className="px-3.5 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear All Storage
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="font-medium text-slate-900">Sync Offline Progress & Notes</div>
                    <div className="text-sm text-slate-500 mt-0.5">
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
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                </div>
              </div>

              {cacheClearedToast && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  IndexedDB storage and offline book cache cleared successfully.
                </div>
              )}

              {syncToast && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Sync completed. All reading items are synchronized with the cloud!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
