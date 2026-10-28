import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  supabase,
  clearStaleSupabaseTokens,
  ensureSupabaseRuntimeConfig,
  getSupabaseClient,
  SERVER_VERIFIED_SESSION_KEY,
} from './lib/supabase';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { Library } from './components/Library';
import { AiTutor } from './components/AiTutor';
import { Settings } from './components/Settings';
import { BookDetail } from './components/BookDetail';
import { Reader } from './components/Reader';
import { LearningPath } from './components/LearningPath';
import { Quizzes } from './components/Quizzes';
import { Community } from './components/Community';
import { Support } from './components/Support';
import { Developer } from './components/Developer';
import { Profile } from './components/Profile';
import { Workspace } from './components/Workspace';
import { Admin } from './components/Admin';
import { Chat } from './components/Chat';
import { UserPortal } from './components/UserPortal';
import { Progress } from './components/Progress';
import { BookStore } from './components/BookStore';
import { Audiobooks } from './components/Audiobooks';
import { Notifications } from './components/Notifications';
import { AppleBooksLibrary, AppleBooksAudiobooks, AppleBooksBookStore, AppleBooksHome, AppleBooksGeminiAI } from './components/icons/AppleIcons';
import { 
  Sparkles, ShoppingBag, Users, BookOpen, 
  Activity, CheckCircle2, AlertCircle, RefreshCw, 
  Wifi, WifiOff, Server, Database, ShieldCheck, 
  Home, ArrowRight, X, Wrench, AlertTriangle, Check
} from 'lucide-react';
import { mockBooks, categories as initialCategories } from './data';
import { ViewState, Book, Bookmark } from './types';
import { getCurriculumBooks } from './lib/kenyaCurriculumService';
import { safeStorage, safeSessionStorage } from './lib/safeStorage';
import { OfflineBanner } from './components/OfflineBanner';
import { BottomTabBar } from './components/BottomTabBar';
import { getAllReadingProgressLocal } from './lib/offlineManager';
import { 
  syncUserReadingProgressFromSupabase, 
  syncUserDailyGoalFromSupabase, 
  setupHomeRealtimeSubscriptions 
} from './lib/userHomeDataService';
import { AcademicPreferencesModal } from './components/AcademicPreferencesModal';
import { extractUserAcademicProfile } from './lib/bookPersonalization';

export interface SystemHealth {
  status: 'checking' | 'healthy' | 'degraded' | 'offline';
  backend: boolean;
  database: 'connected' | 'unreachable' | 'not_configured';
  storage: boolean;
  latencyMs: number | null;
  lastChecked: number;
  message?: string;
}

const VALID_VIEWS: Set<ViewState> = new Set([
  'dashboard', 'library', 'learning-path', 'ai-tutor', 'quizzes', 'community', 
  'chat', 'users-portal', 'settings', 'support', 'developer', 'reader', 
  'profile', 'workspace', 'admin', 'progress', 'book-store', 'audiobooks', 'notifications'
]);

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [isAcademicModalOpen, setIsAcademicModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const isGuest = false;

  // System Health & Diagnostics State
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    status: 'checking',
    backend: false,
    database: 'not_configured',
    storage: true,
    latencyMs: null,
    lastChecked: Date.now(),
    message: 'Initializing system health check...'
  });
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<{
    show: boolean;
    message: string;
    type: 'info' | 'success' | 'warning';
  }>({ show: false, message: '', type: 'info' });

  const [currentView, setCurrentView] = useState<ViewState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const viewParam = urlParams.get('view') as ViewState;
        if (viewParam && VALID_VIEWS.has(viewParam)) return viewParam;
      } catch (_) {}
    }
    try {
      const saved = safeSessionStorage.getItem('edu_ai_current_view') as ViewState;
      if (saved && VALID_VIEWS.has(saved)) return saved;
    } catch (_) {}
    return 'dashboard';
  });

  const [activeBook, setActiveBook] = useState<Book | null>(() => {
    try {
      const saved = safeSessionStorage.getItem('edu_ai_active_book');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {}
    return null;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handlePopState = () => {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const viewParam = urlParams.get('view') as ViewState;
          if (viewParam && VALID_VIEWS.has(viewParam)) {
            setCurrentView(viewParam);
          } else {
            setCurrentView('dashboard');
          }
        } catch (_) {
          setCurrentView('dashboard');
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const changeView = useCallback((view: ViewState) => {
    const targetView = VALID_VIEWS.has(view) ? view : 'dashboard';
    setCurrentView(targetView);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('view', targetView);
        window.history.pushState({ view: targetView }, '', url);
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    safeSessionStorage.setItem('edu_ai_current_view', currentView);
  }, [currentView]);

  useEffect(() => {
    if (activeBook) {
      safeSessionStorage.setItem('edu_ai_active_book', JSON.stringify(activeBook));
    } else {
      safeSessionStorage.removeItem('edu_ai_active_book');
    }
  }, [activeBook]);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSageSidebarOpen, setIsSageSidebarOpen] = useState(false);
  const getPersistedBooks = (baseBooks: Book[]): Book[] => {
    let overrides: Record<string, any> = {};
    try {
      overrides = JSON.parse(safeStorage.getItem('edu_ai_book_cover_overrides') || '{}');
    } catch (e) {
      console.warn('Failed to read cover overrides in App:', e);
    }

    return baseBooks.map(b => {
      let bookWithCover = { ...b };
      const override = overrides[b.id];
      if (override) {
        bookWithCover = {
          ...bookWithCover,
          coverMode: override.coverMode,
          coverImage: override.coverImage ?? bookWithCover.coverImage,
          pdfCoverPage: override.pdfCoverPage,
          customCover: override.customCover,
        };
      }

      const saved = safeStorage.getItem(`book_progress_${b.id}`);
      if (saved !== null) {
        return { ...bookWithCover, readProgress: parseInt(saved, 10) };
      }
      return bookWithCover;
    });
  };

  const [books, setBooks] = useState<Book[]>(() => getPersistedBooks(mockBooks));
  const [categories, setCategories] = useState<string[]>(initialCategories);

  const handleUpdateProgress = useCallback((bookId: string, progress: number) => {
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, readProgress: progress } : b));
    setActiveBook(prev => prev && prev.id === bookId ? { ...prev, readProgress: progress } : prev);
  }, []);

  // Hydrate reading progress from IndexedDB on startup & listen for live storage sync
  useEffect(() => {
    let isMounted = true;
    async function loadAllProgressFromIndexedDB() {
      try {
        const idbProgress = await getAllReadingProgressLocal();
        if (isMounted && Object.keys(idbProgress).length > 0) {
          setBooks(prev =>
            prev.map(b => {
              if (idbProgress[b.id] && typeof idbProgress[b.id].progress === 'number') {
                return { ...b, readProgress: idbProgress[b.id].progress };
              }
              return b;
            })
          );
        }
      } catch (err) {
        console.warn('[App] Error loading progress from IndexedDB:', err);
      }
    }

    loadAllProgressFromIndexedDB();

    const handleProgressEvent = (e: any) => {
      if (e.detail && e.detail.bookId) {
        handleUpdateProgress(e.detail.bookId, e.detail.progress);
      }
    };

    window.addEventListener('edu-ai-progress-updated', handleProgressEvent);
    return () => {
      isMounted = false;
      window.removeEventListener('edu-ai-progress-updated', handleProgressEvent);
    };
  }, [handleUpdateProgress]);

  // Comprehensive System Health Check
  const checkSystemHealth = useCallback(async (isInitial = false) => {
    setSystemHealth(prev => ({ ...prev, status: 'checking' }));
    const startTime = Date.now();
    let backendOk = false;
    let dbStatus: 'connected' | 'unreachable' | 'not_configured' = 'not_configured';
    let storageOk = false;
    let latency: number | null = null;
    let errorMsg = '';

    // 1. Safe storage verification
    try {
      const testKey = '__edu_health_test__';
      safeStorage.setItem(testKey, 'ok');
      const val = safeStorage.getItem(testKey);
      safeStorage.removeItem(testKey);
      storageOk = val === 'ok';
    } catch {
      storageOk = false;
    }

    // 2. Server API health check (/api/health with 2.5s AbortController)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('/api/health', {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        backendOk = true;
        latency = Date.now() - startTime;
        const healthPayload = await res.json().catch(() => null);
        if (healthPayload?.cloudConnected?.supabase) {
          dbStatus = 'connected';
        }
      } else {
        errorMsg = `Server returned HTTP ${res.status}`;
      }
    } catch (err: any) {
      backendOk = false;
      errorMsg = err.name === 'AbortError' ? 'Server ping timed out' : (err.message || 'Server unreachable');
    }

    // 3. Supabase verification (browser client check when available)
    const activeSb = getSupabaseClient() || supabase;
    if (activeSb) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const { error } = await activeSb.from('books').select('id').limit(1).abortSignal(controller.signal);
        clearTimeout(timeoutId);
        dbStatus = error ? 'unreachable' : 'connected';
      } catch {
        dbStatus = 'unreachable';
      }
    }

    let overall: 'healthy' | 'degraded' | 'offline' = 'healthy';
    if (!backendOk) {
      overall = 'offline';
    } else if (dbStatus === 'unreachable') {
      overall = 'degraded';
    }

    const newHealth: SystemHealth = {
      status: overall,
      backend: backendOk,
      database: dbStatus,
      storage: storageOk,
      latencyMs: latency,
      lastChecked: Date.now(),
      message: errorMsg || (overall === 'healthy' ? 'All core systems active' : 'Running in local offline-first mode')
    };

    setSystemHealth(newHealth);
    return newHealth;
  }, []);

  // Automatic Self-Repair & Emergency Error Recovery
  const handleEmergencyRecovery = useCallback((mode: 'soft' | 'full' = 'soft') => {
    try {
      clearStaleSupabaseTokens();
      safeStorage.removeItem('edu_ai_guest_mode');
      safeSessionStorage.removeItem('edu_ai_guest_mode');
      safeStorage.removeItem('edu_demo_user');
      safeSessionStorage.removeItem('edu_ai_active_book');
      safeSessionStorage.removeItem('edu_ai_current_view');
      setActiveBook(null);
      setCurrentView('dashboard');
      setSession(null);
      setProfile(null);
      setLoading(false);

      if (mode === 'full') {
        try {
          safeStorage.removeItem('edu_ai_book_cover_overrides');
          safeStorage.removeItem('custom_uploaded_books');
        } catch (_) {}
      }

      checkSystemHealth();

      setRecoveryNotice({
        show: true,
        type: 'success',
        message: mode === 'full' 
          ? 'Storage reset complete. Please sign in to continue.' 
          : 'Session cache repaired. Please sign in to continue.'
      });
      setTimeout(() => setRecoveryNotice(prev => ({ ...prev, show: false })), 4000);
    } catch (err: any) {
      console.warn('Recovery error caught:', err);
      setSession(null);
      setLoading(false);
    }
  }, [checkSystemHealth]);

  // Loading seconds timer
  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setInterval(() => {
        setLoadingSeconds(s => s + 1);
      }, 1000);
    } else {
      setLoadingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  // Startup Watchdog & Health Checks
  useEffect(() => {
    // 1. Initial health check
    checkSystemHealth(true);

    // 3. Periodic health verification (every 50s)
    const interval = setInterval(() => {
      checkSystemHealth();
    }, 50000);

    // 4. Online / Offline listeners
    const handleOnline = () => {
      checkSystemHealth();
      setRecoveryNotice({
        show: true,
        type: 'info',
        message: 'Network connection restored. Verifying server health...'
      });
      setTimeout(() => setRecoveryNotice(prev => ({ ...prev, show: false })), 3000);
    };

    const handleOffline = () => {
      setSystemHealth(prev => ({
        ...prev,
        status: 'offline',
        backend: false,
        message: 'Device went offline. Switched to offline reading mode.'
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 5. Strict Watchdog Timer: Guarantees loading state never stays stuck beyond 2.8s (falls through to Auth screen if unauthenticated)
    const watchdogTimer = setTimeout(() => {
      setLoading(false);
    }, 2800);

    return () => {
      clearInterval(interval);
      clearTimeout(watchdogTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkSystemHealth]);

  const loadUnifiedCatalog = useCallback(async () => {
    try {
      let serverBooks: Book[] = [];
      let deletedIds = new Set<string>();

      try {
        const res = await fetch('/api/books', { headers: { 'Cache-Control': 'no-cache' } });
        if (res.ok) {
          const payload = await res.json();
          if (Array.isArray(payload.books)) serverBooks = payload.books;
          if (Array.isArray(payload.deletedIds)) deletedIds = new Set(payload.deletedIds);
        }
      } catch (apiErr) {
        console.warn('[App] /api/books fetch notice:', apiErr);
      }

      let dbGenericBooks: Book[] = [];
      if (supabase) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('fetchBooks timeout')), 3000)
          );
          const genericBooksRes: any = await Promise.race([
            supabase.from('books').select('*').order('created_at', { ascending: false }),
            timeoutPromise,
          ]);
          const genericBooks = Array.isArray(genericBooksRes?.data) ? genericBooksRes.data : [];
          dbGenericBooks = genericBooks.map((b: any) => {
            let inferredPublisher = b.publisher || '';
            let kicd = b.is_kicd_approved ?? b.isKicdApproved ?? false;
            if (
              !inferredPublisher &&
              (b.author?.toLowerCase().includes('klb') ||
                b.title?.toLowerCase().includes('klb') ||
                b.author?.toLowerCase().includes('kenya literature bureau'))
            ) {
              inferredPublisher = 'Kenya Literature Bureau (KLB)';
              kicd = true;
            }
            return {
              id: b.id,
              title: b.title,
              author: b.author || 'Unknown',
              coverImage: b.cover_image?.includes('unsplash.com') ? '' : (b.cover_image || ''),
              category: b.category || 'General',
              rating: 4.5,
              description: b.description || '',
              level: b.education_level,
              curriculum: b.curriculum ? (Array.isArray(b.curriculum) ? b.curriculum : [b.curriculum]) : (kicd ? ['CBC', 'KCSE'] : undefined),
              subjects: b.subjects ? (Array.isArray(b.subjects) ? b.subjects : b.subjects.split(',').map((s: string) => s.trim())) : undefined,
              country: b.country
                ? (Array.isArray(b.country) ? b.country : [b.country])
                : b.description && b.description.includes('Location: ')
                  ? [b.description.split('Location: ')[1].trim()]
                  : kicd
                    ? ['Kenya']
                    : undefined,
              fileUrl: b.file_url,
              publisher: inferredPublisher || undefined,
              isKicdApproved: kicd,
              isbn: b.isbn || undefined,
            };
          });
        } catch (sbErr) {
          console.warn('[App] Supabase books query notice:', sbErr);
        }
      }

      let mappedCurriculum: Book[] = [];
      try {
        const curriculumBooks = await getCurriculumBooks();
        mappedCurriculum = (curriculumBooks || []).map(cb => ({
          id: cb.id,
          title: cb.title,
          author: cb.publisher,
          publisher: cb.publisher,
          isbn: cb.isbn,
          isKicdApproved: cb.isKicdApproved,
          coverImage: cb.coverImageUrl?.includes('unsplash.com') ? '' : (cb.coverImageUrl || ''),
          category: cb.category === 'PAST_PAPER' ? 'Natural Sciences, Mathematics, and Statistics' : 'Natural Sciences, Mathematics, and Statistics',
          rating: 4.9,
          description: cb.description || '',
          level: 'School' as const,
          curriculum: cb.gradeLevel?.curriculum?.name ? [cb.gradeLevel.curriculum.name] : ['CBC'],
          subjects: cb.subject?.name ? [cb.subject.name] : undefined,
          country: ['Kenya'],
          fileUrl: cb.pdfFileUrl,
        }));
      } catch (currErr) {
        console.warn('[App] getCurriculumBooks notice:', currErr);
      }

      let localUploadedBooks: Book[] = [];
      try {
        const rawLocal = safeStorage.getItem('custom_uploaded_books');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) localUploadedBooks = parsed;
        }
      } catch (_) {}

      const candidates = [
        ...serverBooks,
        ...dbGenericBooks,
        ...localUploadedBooks,
        ...mappedCurriculum,
        ...mockBooks,
      ];

      const seenIds = new Set<string>();
      const seenTitles = new Set<string>();
      const deduped: Book[] = [];

      for (const candidate of candidates) {
        if (!candidate || !candidate.id || deletedIds.has(candidate.id)) continue;
        const normTitle = `${candidate.title.trim().toLowerCase()}::${(candidate.publisher || candidate.author || '').trim().toLowerCase()}`;
        if (seenIds.has(candidate.id) || seenTitles.has(normTitle)) continue;
        seenIds.add(candidate.id);
        seenTitles.add(normTitle);
        deduped.push(candidate);
      }

      setBooks(getPersistedBooks(deduped));

      const dbCategories = Array.from(new Set(deduped.map(b => b.category))).filter(Boolean);
      if (dbCategories.length > 0) {
        setCategories(Array.from(new Set(['All', ...initialCategories, ...dbCategories])));
      }
    } catch (err) {
      console.warn('[App] loadUnifiedCatalog notice:', err);
    }
  }, []);

  useEffect(() => {
    // Purge any legacy guest or demo bypass flags so unauthenticated visitors never bypass login
    try {
      safeStorage.removeItem('edu_ai_guest_mode');
      safeSessionStorage.removeItem('edu_ai_guest_mode');
      safeStorage.removeItem('edu_demo_user');
    } catch (_) {}

    loadUnifiedCatalog();

    let unsubscribe = () => {};
    let isMounted = true;

    const initAuth = async () => {
      // Timeout fallback to ensure the app never gets stuck on the loading spinner
      const timeoutId = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 2500);

      try {
        const runtimeCfg = await ensureSupabaseRuntimeConfig();
        const client = runtimeCfg.client || getSupabaseClient();

        // Check URL hash or query for full-tab OAuth callback return
        let urlAccessToken = '';
        let urlRefreshToken = '';
        let urlCode = '';
        if (typeof window !== 'undefined') {
          try {
            const url = new URL(window.location.href);
            urlCode = url.searchParams.get('code') || '';
            const rawHash = window.location.hash ? window.location.hash.substring(1) : '';
            const hashParams = new URLSearchParams(rawHash);
            urlAccessToken = hashParams.get('access_token') || url.searchParams.get('access_token') || '';
            urlRefreshToken = hashParams.get('refresh_token') || url.searchParams.get('refresh_token') || '';

            if (urlCode || urlAccessToken) {
              url.searchParams.delete('code');
              url.searchParams.delete('state');
              url.searchParams.delete('access_token');
              url.searchParams.delete('refresh_token');
              window.history.replaceState({}, '', url.pathname + url.search);
            }
          } catch (_) {}
        }

        if (client) {
          if (urlCode) {
            try {
              await client.auth.exchangeCodeForSession(urlCode);
            } catch (_) {}
          } else if (urlAccessToken && urlRefreshToken) {
            try {
              await client.auth.setSession({
                access_token: urlAccessToken,
                refresh_token: urlRefreshToken,
              });
            } catch (_) {}
          }

          const { data, error } = await client.auth.getSession();
          if (error) {
            console.warn('Supabase getSession error (handling gracefully):', error.message);
            if (
              error.message?.includes('Refresh Token') ||
              error.message?.includes('refresh_token') ||
              error.message?.includes('Invalid') ||
              error.message?.includes('Failed to fetch')
            ) {
              try {
                await client.auth.signOut({ scope: 'local' });
              } catch (_) {}
              clearStaleSupabaseTokens();
            }
            if (isMounted) setSession(null);
          } else {
            const currentSession = data?.session || null;
            if (isMounted) setSession(currentSession);
            if (currentSession?.user) {
              try {
                const { data: profileData, error: profileErr } = await client
                  .from('profiles')
                  .select('*')
                  .eq('id', currentSession.user.id)
                  .single();
                if (isMounted && profileData && !profileErr) setProfile(profileData);
              } catch (err) {
                console.warn('Profile fetch ignored:', err);
              }
            }
          }

          try {
            const { data: subData } = client.auth.onAuthStateChange(async (event, nextSession) => {
              if (!isMounted) return;
              if (event === 'SIGNED_OUT' || !nextSession) {
                setSession(null);
                setBookmarks([]);
                setActiveBook(null);
                setProfile(null);
              } else if (nextSession) {
                setSession(nextSession);
                if (nextSession.user) {
                  try {
                    const { data: profileData } = await client
                      .from('profiles')
                      .select('*')
                      .eq('id', nextSession.user.id)
                      .single();
                    if (isMounted && profileData) setProfile(profileData);
                  } catch (err) {
                    console.warn('Profile fetch ignored:', err);
                  }
                }
              }
            });
            if (subData?.subscription) {
              unsubscribe = () => subData.subscription.unsubscribe();
            }
          } catch (err: any) {
            console.warn('onAuthStateChange error ignored:', err);
          }
        } else {
          // Server-verified Supabase session mode (when VITE_SUPABASE_URL + server Supabase are active)
          if (urlAccessToken) {
            const verifyRes = await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                access_token: urlAccessToken,
                refresh_token: urlRefreshToken,
              }),
            });
            const verifyJson = await verifyRes.json().catch(() => ({}));
            if (verifyRes.ok && verifyJson?.session?.user) {
              try {
                safeStorage.setItem(SERVER_VERIFIED_SESSION_KEY, JSON.stringify(verifyJson.session));
              } catch (_) {}
              if (isMounted) {
                setSession(verifyJson.session);
                if (verifyJson.profile) setProfile(verifyJson.profile);
              }
            } else if (isMounted) {
              setSession(null);
            }
          } else {
            let storedServerSession: any = null;
            try {
              const raw = safeStorage.getItem(SERVER_VERIFIED_SESSION_KEY);
              if (raw) storedServerSession = JSON.parse(raw);
            } catch (_) {}

            if (storedServerSession?.access_token) {
              const userRes = await fetch('/api/auth/user', {
                headers: {
                  Authorization: `Bearer ${storedServerSession.access_token}`,
                  ...(storedServerSession.refresh_token
                    ? { 'x-refresh-token': String(storedServerSession.refresh_token) }
                    : {}),
                },
              });
              const userJson = await userRes.json().catch(() => ({}));
              if (userRes.ok && userJson?.user) {
                const activeSess = userJson.refreshedSession || {
                  ...storedServerSession,
                  user: userJson.user,
                };
                try {
                  safeStorage.setItem(SERVER_VERIFIED_SESSION_KEY, JSON.stringify(activeSess));
                } catch (_) {}
                if (isMounted) {
                  setSession(activeSess);
                  if (userJson.profile) setProfile(userJson.profile);
                }
              } else {
                try {
                  safeStorage.removeItem(SERVER_VERIFIED_SESSION_KEY);
                } catch (_) {}
                if (isMounted) setSession(null);
              }
            } else if (isMounted) {
              setSession(null);
            }
          }
        }
      } catch (err: any) {
        console.warn('Failed to get Supabase session (handled):', err);
        const errMsg = err?.message || String(err || '');
        if (
          errMsg.includes('Refresh Token') ||
          errMsg.includes('refresh_token') ||
          errMsg.includes('Failed to fetch')
        ) {
          const client = getSupabaseClient();
          if (client) {
            try {
              await client.auth.signOut({ scope: 'local' });
            } catch (_) {}
          }
          clearStaleSupabaseTokens();
        }
        if (isMounted) setSession(null);
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) {
          setProfileChecked(true);
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadUnifiedCatalog]);

  // Prompt newly signed-in OAuth / Phone users to select their Country, Curriculum, Level & Subjects if not configured yet
  useEffect(() => {
    const authed = Boolean(
      session?.user?.id &&
      session?.access_token &&
      session.access_token !== 'demo_token' &&
      session.access_token !== 'local_token'
    );
    if (!authed || !profileChecked || loading) return;

    const academic = extractUserAcademicProfile(profile, session?.user);
    const promptDismissedKey = `edu_academic_prompted_${session.user.id}`;
    if (!academic.isConfigured && !safeSessionStorage.getItem(promptDismissedKey)) {
      setIsAcademicModalOpen(true);
      safeSessionStorage.setItem(promptDismissedKey, '1');
    }
  }, [session, profile, profileChecked, loading]);

  // Real-time synchronization for user reading progress & goals
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    let isMounted = true;

    // 1. Initial Cloud Sync on login / load
    const syncUserData = async () => {
      try {
        const [progressMap] = await Promise.all([
          syncUserReadingProgressFromSupabase(userId),
          syncUserDailyGoalFromSupabase(userId)
        ]);

        if (isMounted && Object.keys(progressMap).length > 0) {
          setBooks(prev =>
            prev.map(book => {
              if (progressMap[book.id] !== undefined) {
                return { ...book, readProgress: progressMap[book.id] };
              }
              return book;
            })
          );
        }
      } catch (err) {
        console.warn('[App] Realtime initial sync notice:', err);
      }
    };

    syncUserData();

    // 2. Realtime WebSocket subscriptions via Supabase Channels
    const cleanupSubscriptions = setupHomeRealtimeSubscriptions(userId, {
      onProgressChange: (bookId, progress) => {
        setBooks(prev =>
          prev.map(book => {
            if (book.id === bookId) {
              return { ...book, readProgress: progress };
            }
            return book;
          })
        );
      },
      onProfileChange: (newProfile) => {
        setProfile(newProfile);
      },
      onBooksChange: async () => {
        await loadUnifiedCatalog();
      }
    });

    return () => {
      isMounted = false;
      cleanupSubscriptions();
    };
  }, [session?.user?.id, loadUnifiedCatalog]);

  const handleAddBookmark = (bookmark: Bookmark) => {
    setBookmarks(prev => [bookmark, ...prev]);
  };

  const handleSignOut = useCallback(async () => {
    const activeSb = getSupabaseClient() || supabase;
    if (activeSb) {
      try {
        await activeSb.auth.signOut({ scope: 'local' });
      } catch (err) {
        console.warn('Sign out notice:', err);
      }
    }

    clearStaleSupabaseTokens();
    try {
      safeStorage.removeItem(SERVER_VERIFIED_SESSION_KEY);
      safeStorage.removeItem('edu_ai_guest_mode');
      safeSessionStorage.removeItem('edu_ai_guest_mode');
      safeStorage.removeItem('edu_search_prefill');
      safeStorage.removeItem('edu_demo_user');
    } catch (_) {}

    setSession(null);
    setProfile(null);
    setBookmarks([]);
    setActiveBook(null);
    setCurrentView('dashboard');
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Glow ambient background */}
        <div className="absolute w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none -top-20 -left-20"></div>
        <div className="absolute w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20"></div>

        <div className="max-w-md w-full relative z-10 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-6">
          {/* Logo badge */}
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 opacity-75 blur-md animate-pulse"></div>
            <div className="relative w-full h-full rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center shadow-lg border border-white/20">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-display">
              Edu AI
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Verifying library status, local study books, and active tutor modules...
            </p>
          </div>

          {/* Dynamic health check step indicator */}
          <div className="space-y-2.5 bg-slate-950/70 rounded-2xl p-4 text-left border border-slate-800/80 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <Server className="w-3.5 h-3.5 text-brand-400" /> Server Health:
              </span>
              <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1.5">
                {systemHealth.status === 'checking' ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-brand-400" /> Checking...
                  </>
                ) : systemHealth.backend ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Online {systemHealth.latencyMs ? `(${systemHealth.latencyMs}ms)` : ''}
                  </span>
                ) : (
                  <span className="text-amber-400">Offline / Local Mode</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Storage Subsystem:
              </span>
              <span className="font-mono text-[11px] text-emerald-400">Ready</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <Activity className="w-3.5 h-3.5 text-indigo-400" /> Startup Time:
              </span>
              <span className="font-mono text-[11px] text-slate-400">{loadingSeconds}s</span>
            </div>
          </div>

          {/* Progress Shimmer Bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full w-2/5 animate-pulse"></div>
          </div>

          {/* Interactive Recovery Action Panel */}
          <div className="pt-2 grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                setLoading(false);
              }}
              className="py-2.5 px-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-xs transition-all shadow-md shadow-brand-600/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 text-center"
            >
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Sign In</span>
            </button>

            <button
              onClick={() => handleEmergencyRecovery('soft')}
              className="py-2.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
            >
              <Wrench className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span className="truncate">Self-Repair</span>
            </button>
            <button
              onClick={() => handleEmergencyRecovery('full')}
              className="py-2.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0 text-brand-400" />
              <span className="truncate">Reset Storage</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isAuthenticated = Boolean(
    session?.user?.id &&
    session?.access_token &&
    session.access_token !== 'demo_token' &&
    session.access_token !== 'local_token'
  );

  // Enforce strict authentication gate: unauthenticated visitors always stay on Sign In / Sign Up
  if (!isAuthenticated) {
    return (
      <Auth 
        onLoginSuccess={(newSession, incomingProfile) => {
          if (!newSession?.user?.id || !newSession?.access_token) return;
          setSession(newSession);
          try {
            safeStorage.removeItem('edu_ai_guest_mode');
            safeSessionStorage.removeItem('edu_ai_guest_mode');
          } catch (_) {}
          if (incomingProfile) {
            setProfile(incomingProfile);
          } else if (newSession?.user) {
            setProfile({
              id: newSession.user.id,
              full_name: newSession.user.user_metadata?.full_name || newSession.user.user_metadata?.name || 'Edu AI Learner',
              email: newSession.user.email,
              country: newSession.user.user_metadata?.country || '',
              education_level: newSession.user.user_metadata?.education_level || '',
              curriculum: newSession.user.user_metadata?.curriculum || '',
              field_of_study: newSession.user.user_metadata?.field_of_study || '',
              subjects: newSession.user.user_metadata?.subjects || '',
              role: newSession.user.user_metadata?.role || 'student'
            });
          }
          setProfileChecked(true);
        }}
      />
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {currentView === 'reader' && activeBook ? (
          <motion.div
            key="reader-view"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 bg-[#F4ECD8] dark:bg-[#121212] transition-colors duration-250 main-canvas-bg"
          >
            <Reader 
              book={activeBook} 
              onClose={() => { setActiveBook(null); changeView('library'); }} 
              onOpenAi={() => {
                changeView('ai-tutor');
              }}
              onAddBookmark={handleAddBookmark}
              bookmarks={bookmarks.filter(b => b.bookId === activeBook.id)}
              user={session?.user}
              onUpdateProgress={handleUpdateProgress}
            />
          </motion.div>
        ) : (
          <motion.div
            key="main-view"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex min-h-screen min-h-[100dvh] flex-1 bg-slate-50 dark:bg-[#121212] font-sans text-slate-900 dark:text-[#EDEDED] border-x border-slate-50 dark:border-[#121212] w-full max-w-full overflow-x-hidden main-canvas-bg"
          >
            <Sidebar 
              currentView={currentView} 
              onChangeView={(view) => {
                changeView(view);
                setIsSidebarOpen(false);
              }} 
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              user={session?.user}
              isGuest={isGuest}
              onSignOut={handleSignOut}
            />
            
            <main className="flex-1 flex flex-col min-w-0 max-w-full w-full relative overflow-x-hidden">
              <Header 
                currentView={currentView}
                onMenuClick={() => setIsSidebarOpen(true)} 
                onBookSelect={(book) => { setActiveBook(book); }}
                onNavigate={(view) => changeView(view)}
                onAddBookToLibrary={(newBook) => {
                  setBooks(prev => {
                    if (prev.some(b => b.id === newBook.id)) return prev;
                    const updated = [newBook, ...prev];
                    safeStorage.setItem('custom_uploaded_books', JSON.stringify(updated.filter(b => b.id.startsWith('custom-') || b.id.startsWith('store-'))));
                    return updated;
                  });
                }}
                user={session?.user}
                profile={profile}
                books={books}
                onToggleSageSidebar={() => setIsSageSidebarOpen(prev => !prev)}
                isSageSidebarOpen={isSageSidebarOpen}
                onSignOut={handleSignOut}
              />

              <OfflineBanner onNavigate={(view) => changeView(view as any)} />
              
              <div className={`flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full relative z-0 ${currentView === 'ai-tutor' ? 'pb-[52px] sm:pb-[60px]' : 'pb-24'}`}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentView}
                    initial={{ opacity: 0, y: 14, filter: 'blur(8px)', scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
                    exit={{ opacity: 0, y: -14, filter: 'blur(8px)', scale: 0.99 }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 350, 
                      damping: 28, 
                      mass: 0.6 
                    }}
                    className="w-full h-full relative will-change-transform"
                  >
                    {currentView === 'dashboard' && (
                      <Dashboard 
                        books={books} 
                        onBookSelect={(book) => { setActiveBook(book); }} 
                        user={session?.user} 
                        profile={profile} 
                        onNavigate={(view) => changeView(view)}
                        onOpenAcademicPrefs={() => setIsAcademicModalOpen(true)}
                        onAddBookToLibrary={(newBook) => {
                          setBooks(prev => {
                            if (prev.some(b => b.id === newBook.id)) return prev;
                            return [newBook, ...prev];
                          });
                        }}
                      />
                    )}
                    {currentView === 'progress' && <Progress books={books} user={session?.user} />}
                    {currentView === 'notifications' && (
                      <Notifications 
                        onNavigate={(view) => changeView(view)} 
                        user={session?.user} 
                      />
                    )}
                    {currentView === 'library' && (
                      <Library 
                        books={books} 
                        categories={categories} 
                        onBookSelect={(book) => { setActiveBook(book); }} 
                        bookmarks={bookmarks} 
                        user={session?.user} 
                        profile={profile} 
                        onNavigate={(view) => changeView(view)}
                        onOpenAcademicPrefs={() => setIsAcademicModalOpen(true)}
                        onAddBookToLibrary={(newBook) => {
                          setBooks(prev => {
                            if (prev.some(b => b.id === newBook.id)) return prev;
                            return [newBook, ...prev];
                          });
                        }}
                      />
                    )}
                    {currentView === 'learning-path' && <LearningPath user={session?.user} profile={profile} />}
                    {currentView === 'ai-tutor' && (
                      <AiTutor 
                        user={session?.user} 
                        isSidebarOpen={isSageSidebarOpen}
                        onToggleSidebar={() => setIsSageSidebarOpen(prev => !prev)}
                        onSidebarStateChange={(open) => setIsSageSidebarOpen(open)}
                      />
                    )}
                    {currentView === 'quizzes' && <Quizzes user={session?.user} profile={profile} books={books} />}
                    {currentView === 'community' && <Community />}
                    {currentView === 'users-portal' && <UserPortal user={session?.user} profile={profile} onStartChat={(userId) => changeView('chat')} onNavigate={(view) => changeView(view as any)} />}
                    {currentView === 'chat' && <Chat user={session?.user} profile={profile} onNavigate={(view) => changeView(view as any)} />}
                    {currentView === 'settings' && <Settings user={session?.user} onNavigate={(view) => changeView(view as any)} onSignOut={handleSignOut} />}
                    {currentView === 'support' && <Settings user={session?.user} initialTab="support" onNavigate={(view) => changeView(view as any)} onSignOut={handleSignOut} />}
                    {currentView === 'developer' && <Settings user={session?.user} initialTab="developer" onNavigate={(view) => changeView(view as any)} onSignOut={handleSignOut} />}
                    {currentView === 'profile' && <Profile user={session?.user} profile={profile} onNavigate={(view) => changeView(view as any)} onSignOut={handleSignOut} onOpenAcademicPrefs={() => setIsAcademicModalOpen(true)} />}
                    {currentView === 'workspace' && <Workspace />}
                    {currentView === 'admin' && (
                      <Admin 
                        appBooks={books} 
                        onUpdateBook={(updatedBook) => {
                          setBooks(prev => {
                            const exists = prev.some(b => b.id === updatedBook.id);
                            return exists
                              ? prev.map(b => b.id === updatedBook.id ? updatedBook : b)
                              : [updatedBook, ...prev];
                          });
                          if (activeBook?.id === updatedBook.id) {
                            setActiveBook(updatedBook);
                          }
                        }}
                        onDeleteBook={(deletedId) => {
                          setBooks(prev => prev.filter(b => b.id !== deletedId));
                          if (activeBook?.id === deletedId) {
                            setActiveBook(null);
                          }
                        }}
                      />
                    )}
                    {currentView === 'book-store' && (
                      <BookStore 
                        books={books} 
                        onBookSelect={(book) => { setActiveBook(book); }}
                        onAddBookToLibrary={(newBook) => {
                          setBooks(prev => {
                            if (prev.some(b => b.id === newBook.id)) return prev;
                            return [newBook, ...prev];
                          });
                        }} 
                        user={session?.user} 
                        profile={profile} 
                        onNavigate={(view) => changeView(view)}
                        onOpenAcademicPrefs={() => setIsAcademicModalOpen(true)}
                      />
                    )}
                    {currentView === 'audiobooks' && (
                      <Audiobooks 
                        books={books} 
                        onBookSelect={(book) => { setActiveBook(book); }} 
                        user={session?.user} 
                        profile={profile} 
                        onOpenAcademicPrefs={() => setIsAcademicModalOpen(true)}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <BottomTabBar 
                currentView={currentView} 
                onChangeView={(view) => changeView(view)} 
              />
            </main>

            {activeBook && currentView !== 'reader' && (
              <BookDetail 
                book={activeBook} 
                onClose={() => setActiveBook(null)}
                onDiscuss={() => {
                  setActiveBook(null);
                  changeView('ai-tutor');
                }}
                onRead={() => {
                  changeView('reader');
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating System Health & Diagnostics Trigger Button */}
      {currentView !== 'reader' && (
        <div className="fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6">
          <button
            onClick={() => setIsDiagnosticsOpen(true)}
            title="System Health & Self-Healing Diagnostics"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium backdrop-blur-md shadow-lg border transition-all cursor-pointer bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:scale-105 active:scale-95 group"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                systemHealth.status === 'healthy' ? 'bg-emerald-400' : systemHealth.status === 'degraded' ? 'bg-amber-400' : 'bg-slate-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                systemHealth.status === 'healthy' ? 'bg-emerald-500' : systemHealth.status === 'degraded' ? 'bg-amber-500' : 'bg-slate-500'
              }`}></span>
            </span>
            <span className="text-[11px] font-mono">
              {systemHealth.status === 'healthy' 
                ? `System Healthy ${systemHealth.latencyMs ? `(${systemHealth.latencyMs}ms)` : ''}` 
                : systemHealth.status === 'checking' 
                  ? 'Testing Health...' 
                  : 'Local Offline Mode'}
            </span>
            <Wrench className="w-3 h-3 text-slate-400 group-hover:text-brand-500 transition-colors ml-0.5" />
          </button>
        </div>
      )}

      {/* Automatic Recovery Toast Notification */}
      <AnimatePresence>
        {recoveryNotice.show && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/60 backdrop-blur-md flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-200 leading-snug">{recoveryNotice.message}</span>
            </div>
            <button
              onClick={() => setRecoveryNotice(prev => ({ ...prev, show: false }))}
              className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diagnostics & Self-Healing Modal */}
      <AnimatePresence>
        {isDiagnosticsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 text-slate-900 dark:text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base font-display">System Health & Recovery</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Live connectivity & self-repair tools</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDiagnosticsOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status List */}
              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Server className="w-3.5 h-3.5 text-brand-500" /> Backend API:
                  </span>
                  <span className="font-mono font-medium flex items-center gap-1.5">
                    {systemHealth.backend ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Online {systemHealth.latencyMs ? `(${systemHealth.latencyMs}ms)` : ''}
                      </span>
                    ) : (
                      <span className="text-amber-500">Unreachable (Local Mode Active)</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Database className="w-3.5 h-3.5 text-indigo-500" /> Cloud Database:
                  </span>
                  <span className="font-mono font-medium">
                    {systemHealth.database === 'connected' ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Connected</span>
                    ) : systemHealth.database === 'not_configured' ? (
                      <span className="text-slate-400">Built-in Local Storage</span>
                    ) : (
                      <span className="text-amber-500">Offline / Fallback</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Local Storage & Cache:
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    {systemHealth.storage ? 'Healthy & Persistent' : 'Restricted (In-Memory)'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Users className="w-3.5 h-3.5 text-purple-500" /> Access State:
                  </span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                    {session?.user ? `Authenticated (${session.user.email || session.user.phone || 'Active'})` : 'Unauthenticated'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => checkSystemHealth()}
                  disabled={systemHealth.status === 'checking'}
                  className="py-2.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 text-center"
                >
                  <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${systemHealth.status === 'checking' ? 'animate-spin' : ''}`} />
                  <span className="truncate">{systemHealth.status === 'checking' ? 'Testing...' : 'Re-test'}</span>
                </button>

                <button
                  onClick={() => {
                    handleEmergencyRecovery('soft');
                    setIsDiagnosticsOpen(false);
                  }}
                  className="py-2.5 px-2 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 border border-brand-200 dark:border-brand-800/60 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <Wrench className="w-3.5 h-3.5 shrink-0 text-brand-500" />
                  <span className="truncate">Self-Repair</span>
                </button>

                <button
                  onClick={() => {
                    handleEmergencyRecovery('full');
                    setIsDiagnosticsOpen(false);
                  }}
                  className="py-2.5 px-2 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                  <span className="truncate">Reset Cache</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Academic Intake Setup & Personalization Modal */}
      <AcademicPreferencesModal
        isOpen={isAcademicModalOpen}
        onClose={() => setIsAcademicModalOpen(false)}
        canDismiss={true}
        user={session?.user}
        profile={profile}
        accessToken={session?.access_token}
        onSaved={(updatedProfile, updatedMeta) => {
          setProfile(updatedProfile);
          if (updatedMeta) {
            setSession((prev: any) => {
              if (!prev?.user) return prev;
              const nextSess = {
                ...prev,
                user: {
                  ...prev.user,
                  user_metadata: {
                    ...(prev.user.user_metadata || {}),
                    ...updatedMeta,
                  },
                },
              };
              try {
                if (safeStorage.getItem(SERVER_VERIFIED_SESSION_KEY)) {
                  safeStorage.setItem(SERVER_VERIFIED_SESSION_KEY, JSON.stringify(nextSess));
                }
              } catch (_) {}
              return nextSess;
            });
          }
        }}
      />
    </>
  );
}
