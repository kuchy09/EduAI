import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  supabase,
  ensureSupabaseRuntimeConfig,
  getSupabaseClient,
  authorizeInteractiveSession,
  isInteractiveSessionAuthorized,
  revokeInteractiveSession,
  consumeOAuthRedirectPending,
  hasValidOAuthRedirectPending,
  getPersistedDeviceSession,
} from './lib/supabase';
import { setActiveSocialTokens, SOCIAL_SESSION_REFRESHED_EVENT } from './lib/socialChatClient';
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
import { EduLab } from './components/EduLab';
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
  Home, ArrowRight, X, Wrench, AlertTriangle, Check, Trophy
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
  saveUserReadingProgressToSupabase,
  setupHomeRealtimeSubscriptions 
} from './lib/userHomeDataService';
import { AcademicPreferencesModal } from './components/AcademicPreferencesModal';
import { extractUserAcademicProfile, saveStoredAcademicPrefs } from './lib/bookPersonalization';
import {
  ACCOUNT_SYNC_EVENT,
  hydrateAccountSync,
  pushAccountSyncPatch,
  saveBookmarkToCloud,
  clearAccountLocalCaches,
  getUnlockedBooksStorageKey,
  getBookmarksStorageKey,
  getReadingProgressMapStorageKey,
  mergeBooksLists,
  mergeBookmarksLists,
  mergeReadingProgressMaps,
} from './lib/accountSyncService';
import {
  mergeIncomingSystemNotification,
  syncSystemNotificationsFromServer,
} from './lib/notifications';
import {
  GLOBAL_BOOK_COVERS_EVENT,
  applyGlobalCoverToBook,
  applyGlobalCoversToBooks,
  fetchGlobalBookCoversFromServer,
  setGlobalBookCovers,
} from './lib/globalBookCoversService';
import { isSystemBookConfigRow } from '../shared/canonicalBookCovers';
import {
  fetchSocialBootstrap,
  pushPeerActivityNotification,
  socialWsClient,
} from './lib/socialChatClient';
import {
  AchievementBadgeDefinition,
  EDU_POINTS_AWARDED_EVENT,
  reconcileAchievementsSnapshot,
  recordBookCompleted,
} from './lib/achievementsService';

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
  'dashboard', 'library', 'learning-path', 'edulab', 'ai-tutor', 'quizzes', 'community', 
  'chat', 'users-portal', 'settings', 'support', 'developer', 'reader', 
  'profile', 'workspace', 'admin', 'progress', 'book-store', 'audiobooks', 'notifications'
]);

export default function App() {
  const [session, setSession] = useState<any>(() => getPersistedDeviceSession());
  const [profile, setProfile] = useState<any>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [isAcademicModalOpen, setIsAcademicModalOpen] = useState(false);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      const hasOAuthReturn =
        (search.includes('code=') || hash.includes('access_token=') || search.includes('access_token=')) &&
        hasValidOAuthRedirectPending();
      return hasOAuthReturn;
    } catch (_) {
      return false;
    }
  });
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
  const [rewardBanner, setRewardBanner] = useState<{
    pointsGained: number;
    totalEduPoints: number;
    reason: string;
    newlyUnlockedBadges: AchievementBadgeDefinition[];
  } | null>(null);

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

  const [audiobookTargetBookId, setAudiobookTargetBookId] = useState<string | null>(null);

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

  const handleListenBook = useCallback(
    (book: Book) => {
      setActiveBook(null);
      setAudiobookTargetBookId(book.id);
      changeView('audiobooks');
    },
    [changeView]
  );

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
  const handleToggleSageSidebar = useCallback(() => {
    setIsSageSidebarOpen(prev => !prev);
  }, []);
  const handleConsumeInitialBook = useCallback(() => {
    setAudiobookTargetBookId(null);
  }, []);
  const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState(0);
  const [pendingSocialBadgeCount, setPendingSocialBadgeCount] = useState(0);
  const getPersistedBooks = useCallback((baseBooks: Book[], userIdOverride?: string): Book[] => {
    const uid = userIdOverride || getPersistedDeviceSession()?.user?.id;
    const scopedProgress = uid
      ? safeStorage.getJSON<Record<string, number>>(getReadingProgressMapStorageKey(uid), {})
      : {};
    const withGlobalCovers = applyGlobalCoversToBooks(baseBooks);
    return withGlobalCovers.map(bookWithCover => {
      if (uid && typeof scopedProgress[bookWithCover.id] === 'number') {
        return { ...bookWithCover, readProgress: scopedProgress[bookWithCover.id] };
      }
      if (!uid) {
        const saved = safeStorage.getItem(`book_progress_${bookWithCover.id}`);
        if (saved !== null) {
          return { ...bookWithCover, readProgress: parseInt(saved, 10) };
        }
      }
      return bookWithCover;
    });
  }, []);

  const [books, setBooks] = useState<Book[]>(() => getPersistedBooks(mockBooks));
  const booksRef = useRef<Book[]>(books);
  useEffect(() => {
    booksRef.current = books;
  }, [books]);
  const [categories, setCategories] = useState<string[]>(initialCategories);

  const handleUpdateProgress = useCallback((bookId: string, progress: number) => {
    const bounded = Math.max(0, Math.min(100, Math.round(progress)));
    setBooks(prev => {
      const target = prev.find(b => b.id === bookId);
      if (!target || target.readProgress === bounded) return prev;
      return prev.map(b => b.id === bookId ? { ...b, readProgress: bounded } : b);
    });
    setActiveBook(prev => (prev && prev.id === bookId && prev.readProgress !== bounded ? { ...prev, readProgress: bounded } : prev));
    const uid = session?.user?.id;
    if (uid) {
      const progressKey = getReadingProgressMapStorageKey(uid);
      const prevMap = safeStorage.getJSON<Record<string, number>>(progressKey, {});
      const nextMap = { ...prevMap, [bookId]: Math.max(Number(prevMap[bookId] || 0), bounded) };
      safeStorage.setJSON(progressKey, nextMap);
      pushAccountSyncPatch(uid, { readingProgress: nextMap }, session?.access_token);
    }
    if (bounded >= 100 && uid) {
      const matched = booksRef.current.find(b => b.id === bookId);
      recordBookCompleted(
        uid,
        { id: bookId, title: matched?.title || 'Curriculum Textbook' },
        { accessToken: session.access_token }
      );
    }
  }, [session?.user?.id, session?.access_token]);

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

  // Listen for live Edu Points & Badge unlock events to show celebration banner
  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout> | null = null;
    const handlePointsAwarded = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail) return;
      if (detail.userId && session?.user?.id && detail.userId !== session.user.id) return;
      if (!detail.pointsGained && (!detail.newlyUnlockedBadges || detail.newlyUnlockedBadges.length === 0)) {
        return;
      }
      setRewardBanner({
        pointsGained: detail.pointsGained || 0,
        totalEduPoints: detail.totalEduPoints || 0,
        reason: detail.reason || 'Achievement progress updated',
        newlyUnlockedBadges: Array.isArray(detail.newlyUnlockedBadges)
          ? detail.newlyUnlockedBadges
          : [],
      });
      if (dismissTimer) clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => setRewardBanner(null), 6500);
    };

    window.addEventListener(EDU_POINTS_AWARDED_EVENT, handlePointsAwarded);
    return () => {
      window.removeEventListener(EDU_POINTS_AWARDED_EVENT, handlePointsAwarded);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [session?.user?.id]);

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
      revokeInteractiveSession();
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
      const localDeletedRaw = safeStorage.getJSON<string[]>('edu_ai_deleted_book_ids', []);
      let deletedIds = new Set<string>(Array.isArray(localDeletedRaw) ? localDeletedRaw : []);

      try {
        const res = await fetch('/api/books', { headers: { 'Cache-Control': 'no-cache' } });
        if (res.ok) {
          const payload = await res.json();
          if (Array.isArray(payload.books)) serverBooks = payload.books;
          if (payload.globalBookCovers && typeof payload.globalBookCovers === 'object') {
            setGlobalBookCovers(payload.globalBookCovers, { notify: false });
          }
          if (Array.isArray(payload.deletedIds)) {
            deletedIds = new Set(payload.deletedIds);
            safeStorage.setJSON('edu_ai_deleted_book_ids', payload.deletedIds);
          }
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
          dbGenericBooks = genericBooks
            .filter((b: any) => !isSystemBookConfigRow(b))
            .map((b: any) => {
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
                coverImage: b.cover_image || '',
                coverMode: b.cover_mode || undefined,
                pdfCoverPage: b.pdf_cover_page ?? undefined,
                customCover: b.custom_cover || undefined,
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
          coverImage: cb.coverImageUrl || '',
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
        const uid = getPersistedDeviceSession()?.user?.id;
        const scopedRaw = uid ? safeStorage.getJSON<Book[]>(getUnlockedBooksStorageKey(uid), []) : [];
        const rawLocal = safeStorage.getJSON<Book[]>('custom_uploaded_books', []);
        localUploadedBooks = mergeBooksLists(
          Array.isArray(scopedRaw) ? scopedRaw : [],
          Array.isArray(rawLocal) ? rawLocal : []
        );
      } catch (_) {}

      const candidates = [
        ...serverBooks,
        ...dbGenericBooks,
        ...mappedCurriculum,
        ...mockBooks,
        ...localUploadedBooks,
      ];

      const seenIds = new Set<string>();
      const seenTitles = new Set<string>();
      const deduped: Book[] = [];

      for (const candidate of candidates) {
        if (!candidate || !candidate.id || !candidate.title || isSystemBookConfigRow(candidate)) continue;
        const candFile = String(candidate.fileUrl || '').trim();
        if (
          deletedIds.has(candidate.id) ||
          (candFile && (deletedIds.has(`b2-${candFile}`) || deletedIds.has(`disk-${candFile}`)))
        ) {
          continue;
        }
        const normTitle = `${candidate.title.trim().toLowerCase()}::${(candidate.publisher || candidate.author || '').trim().toLowerCase()}`;
        if (seenIds.has(candidate.id) || seenTitles.has(normTitle)) continue;
        seenIds.add(candidate.id);
        seenTitles.add(normTitle);
        deduped.push(candidate);
      }

      const uid = getPersistedDeviceSession()?.user?.id;
      setBooks(getPersistedBooks(deduped, uid));

      const dbCategories = Array.from(new Set(deduped.map(b => b.category))).filter(Boolean);
      if (dbCategories.length > 0) {
        setCategories(Array.from(new Set(['All', ...initialCategories, ...dbCategories])));
      }
    } catch (err) {
      console.warn('[App] loadUnifiedCatalog notice:', err);
    }
  }, [getPersistedBooks]);

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

    const isExplicitAuthRejection = (err: any): boolean => {
      if (!err) return false;
      const status = err.status || err.code;
      const msg = String(err.message || err.error_description || '').toLowerCase();
      return (
        status === 401 ||
        status === 403 ||
        msg.includes('invalid refresh token') ||
        msg.includes('refresh token not found') ||
        msg.includes('refresh_token_not_found') ||
        msg.includes('refresh_token_already_used') ||
        msg.includes('user from sub claim') ||
        msg.includes('invalid jwt') ||
        msg.includes('session_not_found') ||
        msg.includes('user not found')
      );
    };

    const initAuth = async () => {
      // Timeout fallback to ensure the app never gets stuck on the loading spinner
      const timeoutId = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 2500);

      try {
        // Check URL hash or query ONLY for an actively initiated full-tab OAuth callback return
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

        const isLegitimateOAuthRedirect =
          Boolean(urlCode || urlAccessToken) && consumeOAuthRedirectPending();

        const runtimeCfg = await ensureSupabaseRuntimeConfig();
        const client = runtimeCfg.client || getSupabaseClient();

        if (client) {
          if (isLegitimateOAuthRedirect) {
            let exchangedSession: any = null;
            if (urlCode) {
              try {
                const { data } = await client.auth.exchangeCodeForSession(urlCode);
                exchangedSession = data?.session || null;
              } catch (_) {}
            } else if (urlAccessToken && urlRefreshToken) {
              try {
                const { data } = await client.auth.setSession({
                  access_token: urlAccessToken,
                  refresh_token: urlRefreshToken,
                });
                exchangedSession = data?.session || null;
              } catch (_) {}
            }

            if (exchangedSession?.user?.id && exchangedSession?.access_token) {
              const { data: verifiedUser, error: verifyErr } = await client.auth.getUser(
                exchangedSession.access_token
              );
              if (!verifyErr && verifiedUser?.user?.id) {
                authorizeInteractiveSession(verifiedUser.user.id, exchangedSession);
                if (isMounted) setSession(exchangedSession);
                try {
                  const { data: profileData, error: profileErr } = await client
                    .from('profiles')
                    .select('*')
                    .eq('id', verifiedUser.user.id)
                    .single();
                  if (isMounted && profileData && !profileErr) setProfile(profileData);
                } catch (_) {}
              } else {
                revokeInteractiveSession();
                if (isMounted) setSession(null);
              }
            } else {
              revokeInteractiveSession();
              if (isMounted) setSession(null);
            }
          } else {
            // Restore any verified credential session saved on this specific device (no auto-logout on reload/reopen)
            let restoredSession: any = null;
            try {
              const { data: sessData } = await client.auth.getSession();
              restoredSession = sessData?.session || null;
            } catch (_) {}

            if (!restoredSession) {
              const savedDeviceSession = getPersistedDeviceSession();
              if (savedDeviceSession?.access_token && savedDeviceSession?.refresh_token) {
                try {
                  const { data: setSessData } = await client.auth.setSession({
                    access_token: savedDeviceSession.access_token,
                    refresh_token: savedDeviceSession.refresh_token,
                  });
                  restoredSession = setSessData?.session || savedDeviceSession;
                } catch (_) {
                  restoredSession = savedDeviceSession;
                }
              } else if (savedDeviceSession?.user?.id && savedDeviceSession?.access_token) {
                restoredSession = savedDeviceSession;
              }
            }

            if (
              restoredSession?.user?.id &&
              restoredSession?.access_token &&
              restoredSession.access_token !== 'demo_token' &&
              restoredSession.access_token !== 'local_token'
            ) {
              authorizeInteractiveSession(restoredSession.user.id, restoredSession);
              if (isMounted) setSession(restoredSession);

              try {
                const { data: verifiedUser, error: verifyErr } = await client.auth.getUser(
                  restoredSession.access_token
                );
                if (!verifyErr && verifiedUser?.user?.id) {
                  const updatedSession = { ...restoredSession, user: verifiedUser.user };
                  authorizeInteractiveSession(verifiedUser.user.id, updatedSession);
                  if (isMounted) setSession(updatedSession);
                  try {
                    const { data: profileData, error: profileErr } = await client
                      .from('profiles')
                      .select('*')
                      .eq('id', verifiedUser.user.id)
                      .single();
                    if (isMounted && profileData && !profileErr) setProfile(profileData);
                  } catch (_) {}
                } else if (verifyErr) {
                  // Try refreshing silently before assuming the session was revoked
                  const { data: refreshed, error: refreshErr } = await client.auth.refreshSession();
                  if (!refreshErr && refreshed?.session?.user?.id) {
                    authorizeInteractiveSession(refreshed.session.user.id, refreshed.session);
                    if (isMounted) setSession(refreshed.session);
                    try {
                      const { data: profileData, error: profileErr } = await client
                        .from('profiles')
                        .select('*')
                        .eq('id', refreshed.session.user.id)
                        .single();
                      if (isMounted && profileData && !profileErr) setProfile(profileData);
                    } catch (_) {}
                  } else if (
                    isExplicitAuthRejection(refreshErr) ||
                    (refreshErr && isExplicitAuthRejection(verifyErr))
                  ) {
                    revokeInteractiveSession();
                    if (isMounted) {
                      setSession(null);
                      setProfile(null);
                    }
                  }
                }
              } catch (_) {
                // Keep valid device session during transient offline/network issues
              }
            } else {
              // Unauthenticated visitor on this device: stay strictly on Auth screen
              if (isMounted) {
                setSession(null);
                setProfile(null);
              }
            }
          }

          try {
            const { data: subData } = client.auth.onAuthStateChange(async (event, nextSession) => {
              if (!isMounted) return;
              if (event === 'SIGNED_OUT') {
                revokeInteractiveSession();
                setSession(null);
                setBookmarks([]);
                setActiveBook(null);
                setProfile(null);
                return;
              }
              if (!nextSession) {
                return;
              }
              if (
                !nextSession.user?.id ||
                !nextSession.access_token ||
                nextSession.access_token === 'demo_token' ||
                nextSession.access_token === 'local_token'
              ) {
                return;
              }
              authorizeInteractiveSession(nextSession.user.id, nextSession);
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
            });
            if (subData?.subscription) {
              unsubscribe = () => subData.subscription.unsubscribe();
            }
          } catch (err: any) {
            console.warn('onAuthStateChange error ignored:', err);
          }
        } else if (isLegitimateOAuthRedirect && urlAccessToken) {
          const verifyRes = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: urlAccessToken,
              refresh_token: urlRefreshToken,
            }),
          });
          const verifyJson = await verifyRes.json().catch(() => ({}));
          if (verifyRes.ok && verifyJson?.session?.user?.id) {
            authorizeInteractiveSession(verifyJson.session.user.id, verifyJson.session);
            if (isMounted) {
              setSession(verifyJson.session);
              if (verifyJson.profile) setProfile(verifyJson.profile);
            }
          } else {
            revokeInteractiveSession();
            if (isMounted) setSession(null);
          }
        } else {
          // Server-proxied fallback mode: restore persisted verified device session if present
          const savedDeviceSession = getPersistedDeviceSession();
          if (
            savedDeviceSession?.user?.id &&
            savedDeviceSession?.access_token &&
            savedDeviceSession.access_token !== 'demo_token' &&
            savedDeviceSession.access_token !== 'local_token'
          ) {
            authorizeInteractiveSession(savedDeviceSession.user.id, savedDeviceSession);
            if (isMounted) setSession(savedDeviceSession);

            try {
              const savedAccess = String(savedDeviceSession.access_token || '');
              let checkRes: Response | null = null;
              if (savedAccess.length <= 3500) {
                checkRes = await fetch('/api/auth/user', {
                  headers: {
                    Authorization: `Bearer ${savedAccess}`,
                    ...(savedDeviceSession.refresh_token
                      ? { 'x-refresh-token': savedDeviceSession.refresh_token }
                      : {}),
                  },
                }).catch(() => null);
              }
              if (!checkRes || checkRes.status === 400 || checkRes.status === 431) {
                checkRes = await fetch('/api/auth/user', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    access_token: savedAccess,
                    refresh_token: savedDeviceSession.refresh_token || undefined,
                  }),
                });
              }
              if (checkRes.ok) {
                const checkJson = await checkRes.json().catch(() => ({}));
                const updatedSession =
                  checkJson?.refreshedSession || {
                    ...savedDeviceSession,
                    user: checkJson?.user || savedDeviceSession.user,
                  };
                if (updatedSession?.user?.id) {
                  authorizeInteractiveSession(updatedSession.user.id, updatedSession);
                  if (isMounted) {
                    setSession(updatedSession);
                    if (checkJson?.profile) setProfile(checkJson.profile);
                  }
                }
              } else if (checkRes.status === 401 || checkRes.status === 403) {
                revokeInteractiveSession();
                if (isMounted) {
                  setSession(null);
                  setProfile(null);
                }
              }
            } catch (_) {
              // Keep valid device session during transient network errors
            }
          } else if (isMounted) {
            setSession(null);
            setProfile(null);
          }
        }
      } catch (err: any) {
        console.warn('Auth initialization check handled:', err);
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

  // Keep in-memory social auth tokens synced with active React session and listen for background refreshes
  useEffect(() => {
    if (session?.access_token && session?.user?.id) {
      setActiveSocialTokens({
        accessToken: session.access_token,
        refreshToken: session.refresh_token || '',
        userId: session.user.id,
      });
    } else if (!session) {
      setActiveSocialTokens(null);
    }
  }, [session?.access_token, session?.refresh_token, session?.user?.id]);

  useEffect(() => {
    const onRefreshed = (ev: any) => {
      const nextSess = ev?.detail?.session;
      if (nextSess?.access_token && nextSess?.user?.id) {
        setSession((prev: any) => ({
          ...(prev || {}),
          ...nextSess,
          user: nextSess.user?.email ? nextSess.user : prev?.user || nextSess.user,
        }));
      }
    };
    window.addEventListener(SOCIAL_SESSION_REFRESHED_EVENT, onRefreshed);
    return () => window.removeEventListener(SOCIAL_SESSION_REFRESHED_EVENT, onRefreshed);
  }, []);

  // Prompt newly signed-in OAuth / Phone users to select their Country, Curriculum, Level & Subjects if not configured yet
  useEffect(() => {
    const authed = Boolean(
      session?.user?.id &&
      session?.access_token &&
      isInteractiveSessionAuthorized(session.user.id) &&
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

  // Real-time synchronization for user reading progress, goals, chats, profile & books
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    let isMounted = true;

    // Seed academic preferences if profile or user metadata already has them
    const p = profile || session?.user?.user_metadata;
    if (p && (p.country || p.education_level || p.curriculum || p.field_of_study || p.subjects)) {
      saveStoredAcademicPrefs(userId, {
        country: p.country || p.location || '',
        education_level: p.education_level || '',
        curriculum: p.curriculum || '',
        field_of_study: p.field_of_study || '',
        subjects: p.subjects || '',
      });
    }

    // 1. Initial Cloud Sync on login / load
    const syncUserData = async () => {
      try {
        const [progressMap, hydrated] = await Promise.all([
          syncUserReadingProgressFromSupabase(userId),
          hydrateAccountSync(session.user, session.access_token),
          syncUserDailyGoalFromSupabase(userId),
          fetchGlobalBookCoversFromServer(),
          syncSystemNotificationsFromServer(userId),
        ]);

        if (!isMounted) return;

        if (hydrated?.profile) {
          setProfile((prev: any) => ({ ...(prev || {}), ...hydrated.profile }));
        }

        const syncedProgress = mergeReadingProgressMaps(
          safeStorage.getJSON<Record<string, number>>(getReadingProgressMapStorageKey(userId), {}),
          mergeReadingProgressMaps(hydrated?.sync?.readingProgress, progressMap)
        );
        if (Object.keys(syncedProgress).length > 0) {
          safeStorage.setJSON(getReadingProgressMapStorageKey(userId), syncedProgress);
        }

        const localSavedBookmarks = safeStorage.getJSON<Bookmark[]>(getBookmarksStorageKey(userId), []);
        const combinedBookmarks = mergeBookmarksLists(localSavedBookmarks, hydrated?.bookmarks || []);
        if (combinedBookmarks.length > 0) {
          setBookmarks(prev => mergeBookmarksLists(prev, combinedBookmarks));
        }

        const deletedList = safeStorage.getJSON<string[]>('edu_ai_deleted_book_ids', []);
        const deletedSet = new Set(Array.isArray(deletedList) ? deletedList : []);
        const notDeleted = (b: Book) => {
          const f = String(b?.fileUrl || '').trim();
          return !deletedSet.has(b.id) && !(f && (deletedSet.has(`b2-${f}`) || deletedSet.has(`disk-${f}`)));
        };

        setBooks(prev => {
          const filteredUnlocked = Array.isArray(hydrated?.unlockedBooks)
            ? hydrated.unlockedBooks.filter(notDeleted)
            : [];
          const withUnlocked =
            filteredUnlocked.length > 0
              ? mergeBooksLists(filteredUnlocked, prev.filter(notDeleted))
              : prev.filter(notDeleted);
          const withCovers = getPersistedBooks(withUnlocked, userId);
          return withCovers.map(book =>
            syncedProgress[book.id] !== undefined
              ? { ...book, readProgress: syncedProgress[book.id] }
              : book
          );
        });
        setActiveBook(prev => (prev && notDeleted(prev) ? getPersistedBooks([prev], userId)[0] : null));
      } catch (err) {
        console.warn('[App] Realtime initial sync notice:', err);
      }
    };

    syncUserData();

    const handleAccountSyncEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.userId && detail.userId !== userId) return;
      if (detail?.profile) {
        setProfile((prev: any) => ({ ...(prev || {}), ...detail.profile }));
      }
      setBooks(prev => getPersistedBooks(prev, userId));
      setActiveBook(prev => (prev ? getPersistedBooks([prev], userId)[0] : prev));
    };
    const handleGlobalCoversEvent = () => {
      setBooks(prev => applyGlobalCoversToBooks(prev));
      setActiveBook(prev => (prev ? applyGlobalCoverToBook(prev) : prev));
    };
    window.addEventListener(ACCOUNT_SYNC_EVENT, handleAccountSyncEvent);
    window.addEventListener(GLOBAL_BOOK_COVERS_EVENT, handleGlobalCoversEvent);

    let lastSocialSyncAt = 0;
    const syncSocialSummary = async (minIntervalMs = 0) => {
      const now = Date.now();
      if (now - lastSocialSyncAt < minIntervalMs) return;
      lastSocialSyncAt = now;
      try {
        const data = await fetchSocialBootstrap();
        if (!isMounted) return;
        const usersList = Array.isArray(data?.users) ? data.users : [];
        const reqsList = Array.isArray(data?.friendRequests) ? data.friendRequests : [];
        const incomingUsers = usersList.filter(
          (u) => u.id !== userId && u.friendStatus === 'pending_received'
        );
        const incomingReqs = reqsList.filter(
          (r) => r.receiverId === userId && r.status === 'pending'
        );
        const unreadMessages = (data?.conversations || []).reduce(
          (sum, c) => sum + Number(c.unreadCount || 0),
          0
        );
        const incomingCount = Math.max(incomingUsers.length, incomingReqs.length);
        setPendingFriendRequestsCount(incomingCount);
        setPendingSocialBadgeCount(incomingCount + unreadMessages);

        // Ensure every pending incoming request also has a persistent peer notification
        for (const req of incomingReqs) {
          const sender = usersList.find((u) => u.id === req.senderId);
          const senderName = sender?.name || sender?.email?.split('@')[0] || 'A classmate';
          pushPeerActivityNotification({
            id: `fr_${req.id}`,
            userId,
            title: `Friend Request from ${senderName}`,
            message: req.note || `${senderName} sent you a connection request on Edu AI.`,
            authorName: senderName,
            authorRole: sender?.role === 'teacher' || sender?.role === 'educator' ? 'Teacher' : 'Classmate',
            actionLabel: 'Review Request',
            actionView: 'users-portal',
            tags: ['Friend Request', 'Social'],
          });
        }

        window.dispatchEvent(
          new CustomEvent('eduai_social_updated', {
            detail: { userId, incomingCount, unreadMessages },
          })
        );
      } catch (_) {}
    };

    void syncSocialSummary(0);

    const handleLocalSocialCountsUpdate = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && typeof detail.incomingCount === 'number') {
        setPendingFriendRequestsCount(detail.incomingCount);
        const unread = typeof detail.unreadMessages === 'number' ? detail.unreadMessages : 0;
        setPendingSocialBadgeCount(detail.incomingCount + unread);
      } else {
        void syncSocialSummary(500);
      }
    };
    window.addEventListener('eduai_social_counts_updated', handleLocalSocialCountsUpdate);

    // Re-hydrate on tab focus or returning from background (throttled >= 8s) so PC and Phone stay in live sync
    let lastRefreshAt = Date.now();
    const refreshOnResume = (minIntervalMs = 8000) => {
      const now = Date.now();
      if (now - lastRefreshAt < minIntervalMs) return;
      lastRefreshAt = now;
      void syncUserData();
      void syncSocialSummary(3000);
    };
    const handleFocusRefresh = () => refreshOnResume(3000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshOnResume(3000);
      }
    };
    window.addEventListener('focus', handleFocusRefresh);
    document.addEventListener('visibilitychange', handleVisibility);

    const socialPollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncSocialSummary(14000);
      }
    }, 15000);

    // Live WebSocket sync across all connected clients (per-user & system-wide updates)
    socialWsClient.start();
    const unsubSocialWs = socialWsClient.subscribe((ev) => {
      if (!isMounted) return;
      if (ev.type === 'auth:ok') {
        void syncSocialSummary(1000);
      } else if (ev.type === 'system:books-updated') {
        void loadUnifiedCatalog();
      } else if (ev.type === 'system:covers-updated' && ev.covers && typeof ev.covers === 'object') {
        setGlobalBookCovers(ev.covers, { notify: true });
      } else if (ev.type === 'system:notification' && ev.notification) {
        mergeIncomingSystemNotification(ev.notification, userId);
      } else if (ev.type === 'account:sync-updated') {
        if (!ev.userId || ev.userId === userId) {
          refreshOnResume(1000);
        }
      } else if (ev.type === 'friend:request') {
        const senderName = ev.sender?.name || 'A classmate';
        pushPeerActivityNotification({
          id: `fr_${ev.request.id}`,
          userId,
          title: `Friend Request from ${senderName}`,
          message: ev.request.note || `${senderName} sent you a connection request on Edu AI.`,
          authorName: senderName,
          authorRole: ev.sender?.role === 'teacher' || ev.sender?.role === 'educator' ? 'Teacher' : 'Classmate',
          actionLabel: 'Review Request',
          actionView: 'users-portal',
          tags: ['Friend Request', 'Social'],
        });
        void syncSocialSummary(0);
      } else if (ev.type === 'friend:responded') {
        if (ev.action === 'accept' && ev.actor?.id && ev.actor.id !== userId) {
          pushPeerActivityNotification({
            id: `fr_acc_${ev.request.id}`,
            userId,
            title: `${ev.actor.name || 'Member'} accepted your friend request`,
            message: 'You can now message directly or form a study group.',
            authorName: ev.actor.name || 'Academic Peer',
            authorRole: ev.actor.role === 'teacher' ? 'Teacher' : 'Classmate',
            actionLabel: 'Start Chat',
            actionView: 'chat',
            tags: ['Friend Request', 'Connected'],
          });
        }
        void syncSocialSummary(0);
      } else if (ev.type === 'friend:removed' || ev.type === 'social:directory-updated' || ev.type === 'chat:message') {
        void syncSocialSummary(0);
      }
    });

    // 2. Realtime WebSocket subscriptions via Supabase Channels
    const cleanupSubscriptions = setupHomeRealtimeSubscriptions(userId, {
      onProgressChange: (bookId, progress) => {
        const progressKey = getReadingProgressMapStorageKey(userId);
        const prevMap = safeStorage.getJSON<Record<string, number>>(progressKey, {});
        const nextMap = { ...prevMap, [bookId]: Math.max(Number(prevMap[bookId] || 0), progress) };
        safeStorage.setJSON(progressKey, nextMap);

        setBooks(prev =>
          prev.map(book => {
            if (book.id === bookId) {
              return { ...book, readProgress: nextMap[bookId] };
            }
            return book;
          })
        );
        if (progress >= 100) {
          const matched = booksRef.current.find(b => b.id === bookId);
          recordBookCompleted(
            userId,
            { id: bookId, title: matched?.title || 'Curriculum Textbook' },
            { accessToken: session.access_token, silentToast: true }
          );
        }
      },
      onProfileChange: (newProfile) => {
        setProfile((prev: any) => ({ ...(prev || {}), ...newProfile }));
        if (newProfile) {
          saveStoredAcademicPrefs(userId, {
            country: newProfile.country || newProfile.location || '',
            education_level: newProfile.education_level || '',
            curriculum: newProfile.curriculum || '',
            field_of_study: newProfile.field_of_study || '',
            subjects: newProfile.subjects || '',
          });
        }
      },
      onBooksChange: async () => {
        await loadUnifiedCatalog();
      }
    });

    return () => {
      isMounted = false;
      window.clearInterval(socialPollTimer);
      window.removeEventListener('eduai_social_counts_updated', handleLocalSocialCountsUpdate);
      window.removeEventListener(ACCOUNT_SYNC_EVENT, handleAccountSyncEvent);
      window.removeEventListener(GLOBAL_BOOK_COVERS_EVENT, handleGlobalCoversEvent);
      window.removeEventListener('focus', handleFocusRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubSocialWs();
      cleanupSubscriptions();
    };
  }, [session?.user?.id, session?.access_token, loadUnifiedCatalog, getPersistedBooks]);

  // Silently reconcile any 100%-completed books into the achievements ledger after state commits
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    if (!books.some(b => (b.readProgress || 0) >= 100)) return;
    reconcileAchievementsSnapshot(
      userId,
      { books },
      { accessToken: session?.access_token, silentToast: true }
    );
  }, [books, session?.user?.id, session?.access_token]);

  const handleAddBookmark = useCallback((bookmark: Bookmark) => {
    setBookmarks(prev => {
      const updated = mergeBookmarksLists([bookmark], prev);
      void saveBookmarkToCloud(session?.user?.id, bookmark, updated, session?.access_token);
      return updated;
    });
  }, [session?.user?.id, session?.access_token]);

  const handleAddBookToLibrary = useCallback((newBook: Book) => {
    const userId = session?.user?.id;
    const unlockedKey = getUnlockedBooksStorageKey(userId);
    const normalizedBook = applyGlobalCoverToBook(newBook);
    setBooks(prev => {
      if (prev.some(b => b.id === normalizedBook.id)) return prev;
      const updated = [normalizedBook, ...prev];
      const existingUnlocked = safeStorage.getJSON<Book[]>(unlockedKey, []);
      const nextUnlocked = mergeBooksLists([normalizedBook], existingUnlocked);
      safeStorage.setJSON(unlockedKey, nextUnlocked);
      safeStorage.setJSON('custom_uploaded_books', nextUnlocked);
      if (userId) {
        pushAccountSyncPatch(
          userId,
          { unlockedBooks: nextUnlocked },
          session?.access_token,
          { immediate: true }
        );
      }
      return updated;
    });
  }, [session?.user?.id, session?.access_token]);

  const handleSignOut = useCallback(async (reasonNotice?: string) => {
    const tokenToRevoke = session?.access_token;
    const signingOutUserId = session?.user?.id;
    const activeSb = getSupabaseClient() || supabase;

    // Immediately revoke client interactive seal & React state so UI locks with 0ms delay
    socialWsClient.stop();
    revokeInteractiveSession();
    clearAccountLocalCaches(signingOutUserId);
    setSession(null);
    setProfile(null);
    setBookmarks([]);
    setActiveBook(null);
    setIsAcademicModalOpen(false);
    setCurrentView('dashboard');
    setSecurityNotice(typeof reasonNotice === 'string' ? reasonNotice : null);

    try {
      safeStorage.removeItem('edu_ai_guest_mode');
      safeSessionStorage.removeItem('edu_ai_guest_mode');
      safeStorage.removeItem('edu_search_prefill');
      safeStorage.removeItem('edu_demo_user');
      safeSessionStorage.removeItem('edu_ai_active_book');
      safeSessionStorage.removeItem('edu_ai_current_view');
    } catch (_) {}

    if (activeSb) {
      try {
        await activeSb.auth.signOut();
      } catch (err) {
        console.warn('Sign out notice:', err);
      }
    }

    if (tokenToRevoke) {
      try {
        await fetch('/api/auth/signout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenToRevoke}` },
        });
      } catch (_) {}
    }
  }, [session?.access_token]);

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
    isInteractiveSessionAuthorized(session.user.id) &&
    session.access_token !== 'demo_token' &&
    session.access_token !== 'local_token'
  );

  // Enforce strict authentication gate: unauthenticated visitors always stay on Sign In / Sign Up
  if (!isAuthenticated) {
    return (
      <Auth 
        securityNotice={securityNotice}
        onLoginSuccess={(newSession, incomingProfile) => {
          if (!newSession?.user?.id || !newSession?.access_token) return;
          authorizeInteractiveSession(newSession.user.id, newSession);
          setSecurityNotice(null);
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
              profile={profile}
              isGuest={isGuest}
              onSignOut={handleSignOut}
              pendingRequestsCount={pendingFriendRequestsCount}
            />
            
            <main className="flex-1 flex flex-col min-w-0 max-w-full w-full relative overflow-x-hidden">
              <Header 
                currentView={currentView}
                onMenuClick={() => setIsSidebarOpen(true)} 
                onBookSelect={(book) => { setActiveBook(book); }}
                onNavigate={(view) => changeView(view)}
                onAddBookToLibrary={handleAddBookToLibrary}
                user={session?.user}
                profile={profile}
                books={books}
                onToggleSageSidebar={handleToggleSageSidebar}
                isSageSidebarOpen={isSageSidebarOpen}
                onSignOut={handleSignOut}
                pendingChatBadgeCount={pendingSocialBadgeCount}
              />

              <OfflineBanner onNavigate={(view) => changeView(view as any)} />
              
              <div
                className={`flex-1 overflow-x-hidden w-full max-w-full relative z-0 ${
                  currentView === 'ai-tutor'
                    ? 'h-[100dvh] overflow-hidden pb-[52px] sm:pb-[60px]'
                    : currentView === 'chat'
                    ? 'h-[100dvh] overflow-hidden pb-[68px] sm:pb-[76px]'
                    : 'overflow-y-auto pt-14 sm:pt-16 pb-24'
                }`}
              >
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
                        onAddBookToLibrary={handleAddBookToLibrary}
                      />
                    )}
                    {currentView === 'progress' && (
                      <Progress
                        books={books}
                        user={session?.user}
                        onNavigate={(view) => changeView(view)}
                      />
                    )}
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
                        onListenBook={handleListenBook}
                        bookmarks={bookmarks} 
                        user={session?.user} 
                        profile={profile} 
                        onNavigate={(view) => changeView(view)}
                        onOpenAcademicPrefs={() => setIsAcademicModalOpen(true)}
                        onAddBookToLibrary={handleAddBookToLibrary}
                      />
                    )}
                    {currentView === 'learning-path' && <LearningPath user={session?.user} profile={profile} />}
                    {currentView === 'edulab' && (
                      <EduLab
                        user={session?.user}
                        profile={profile}
                        onNavigate={(view) => changeView(view)}
                      />
                    )}
                    {currentView === 'ai-tutor' && (
                      <AiTutor 
                        user={session?.user}
                        profile={profile}
                        isSidebarOpen={isSageSidebarOpen}
                        onToggleSidebar={handleToggleSageSidebar}
                        onSidebarStateChange={setIsSageSidebarOpen}
                      />
                    )}
                    {currentView === 'quizzes' && <Quizzes user={session?.user} profile={profile} books={books} />}
                    {currentView === 'community' && <Community />}
                    {currentView === 'users-portal' && (
                      <UserPortal
                        user={session?.user}
                        profile={profile}
                        onStartChat={(partnerId) => {
                          try {
                            safeSessionStorage.setItem('eduai_pending_chat_user_id', partnerId);
                            window.dispatchEvent(
                              new CustomEvent('eduai_open_chat_with_user', {
                                detail: { userId: partnerId },
                              })
                            );
                          } catch (_) {}
                          changeView('chat');
                        }}
                        onNavigate={(view) => changeView(view as any)}
                      />
                    )}
                    {currentView === 'chat' && <Chat user={session?.user} profile={profile} onNavigate={(view) => changeView(view as any)} />}
                    {currentView === 'settings' && <Settings user={session?.user} onNavigate={(view) => changeView(view as any)} onSignOut={handleSignOut} />}
                    {currentView === 'support' && <Settings user={session?.user} initialTab="support" onNavigate={(view) => changeView(view as any)} onSignOut={handleSignOut} />}
                    {currentView === 'developer' && <Settings user={session?.user} initialTab="developer" onNavigate={(view) => changeView(view as any)} onSignOut={handleSignOut} />}
                    {currentView === 'profile' && <Profile user={session?.user} profile={profile} onNavigate={(view) => changeView(view as any)} onSignOut={handleSignOut} onOpenAcademicPrefs={() => setIsAcademicModalOpen(true)} />}
                    {currentView === 'workspace' && <Workspace />}
                    {currentView === 'admin' && (
                      <Admin 
                        appBooks={books} 
                        user={session?.user}
                        onUpdateBook={(updatedBook) => {
                          if (
                            updatedBook.coverMode ||
                            updatedBook.coverImage !== undefined ||
                            updatedBook.pdfCoverPage !== undefined ||
                            updatedBook.customCover
                          ) {
                            setGlobalBookCovers({
                              [updatedBook.id]: {
                                coverMode: updatedBook.coverMode,
                                coverImage: updatedBook.coverImage ?? '',
                                pdfCoverPage: updatedBook.pdfCoverPage,
                                customCover: updatedBook.customCover,
                                updatedAt: new Date().toISOString(),
                              },
                            });
                          }
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
                        onDeleteBook={(deletedId, deletedFileUrl) => {
                          const matchesDeleted = (b: Book) =>
                            b.id === deletedId ||
                            (Boolean(deletedFileUrl) && String(b.fileUrl || '').trim() === deletedFileUrl);
                          setBooks(prev => prev.filter(b => !matchesDeleted(b)));
                          if (activeBook && matchesDeleted(activeBook)) {
                            setActiveBook(null);
                          }
                          try {
                            const existingCustom = safeStorage.getJSON<Book[]>('custom_uploaded_books', []);
                            if (Array.isArray(existingCustom)) {
                              safeStorage.setJSON('custom_uploaded_books', existingCustom.filter(b => !matchesDeleted(b)));
                            }
                            if (session?.user?.id) {
                              const unlockedKey = getUnlockedBooksStorageKey(session.user.id);
                              const existingUnlocked = safeStorage.getJSON<Book[]>(unlockedKey, []);
                              if (Array.isArray(existingUnlocked)) {
                                const nextUnlocked = existingUnlocked.filter(b => !matchesDeleted(b));
                                safeStorage.setJSON(unlockedKey, nextUnlocked);
                                if (nextUnlocked.length !== existingUnlocked.length) {
                                  pushAccountSyncPatch(session.user.id, { unlockedBooks: nextUnlocked }, session?.access_token);
                                }
                              }
                            }
                            const deletedList = safeStorage.getJSON<string[]>('edu_ai_deleted_book_ids', []);
                            const nextDeletedSet = new Set(Array.isArray(deletedList) ? deletedList : []);
                            nextDeletedSet.add(deletedId);
                            if (deletedFileUrl) {
                              nextDeletedSet.add(`b2-${deletedFileUrl}`);
                              nextDeletedSet.add(`disk-${deletedFileUrl}`);
                            }
                            safeStorage.setJSON('edu_ai_deleted_book_ids', Array.from(nextDeletedSet));
                          } catch (_) {}
                        }}
                      />
                    )}
                    {currentView === 'book-store' && (
                      <BookStore 
                        books={books} 
                        onBookSelect={(book) => { setActiveBook(book); }}
                        onAddBookToLibrary={handleAddBookToLibrary} 
                        user={session?.user} 
                        profile={profile} 
                        onNavigate={(view) => changeView(view)}
                        onOpenAcademicPrefs={() => setIsAcademicModalOpen(true)}
                      />
                    )}
                    {currentView === 'audiobooks' && (
                      <Audiobooks 
                        books={books} 
                        bookmarks={bookmarks}
                        initialBookId={audiobookTargetBookId}
                        onConsumeInitialBook={handleConsumeInitialBook}
                        onBookSelect={(book) => { setActiveBook(book); }} 
                        onOpenInReader={(book) => {
                          setActiveBook(book);
                          changeView('reader');
                        }}
                        onUpdateProgress={handleUpdateProgress}
                        onAddBookmark={handleAddBookmark}
                        onAskAiAboutBook={(_book, topicPrompt) => {
                          if (topicPrompt) {
                            safeStorage.setItem('ai_tutor_prefill', topicPrompt);
                          }
                          changeView('ai-tutor');
                        }}
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
                allBooks={books}
                onSelectBook={(nextBook) => setActiveBook(nextBook)}
                onClose={() => setActiveBook(null)}
                onDiscuss={() => {
                  setActiveBook(null);
                  changeView('ai-tutor');
                }}
                onRead={() => {
                  changeView('reader');
                }}
                onListen={() => handleListenBook(activeBook)}
                onMarkCompleted={(completedBook) => {
                  void saveUserReadingProgressToSupabase(session?.user?.id, completedBook.id, 100);
                  handleUpdateProgress(completedBook.id, 100);
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

      {/* Edu Points & Badge Celebration Toast */}
      <AnimatePresence>
        {rewardBanner && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-slate-900 dark:bg-[#191919] text-white p-4 rounded-2xl shadow-2xl border border-amber-400/40 backdrop-blur-md flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 tabular-nums">
                  <span>+{rewardBanner.pointsGained} Edu Points</span>
                  <span className="text-slate-400 font-normal">
                    ({rewardBanner.totalEduPoints.toLocaleString()} EP total)
                  </span>
                </div>
                <p className="text-xs text-slate-200 truncate mt-0.5">{rewardBanner.reason}</p>
                {rewardBanner.newlyUnlockedBadges.length > 0 && (
                  <p className="text-[11px] font-semibold text-emerald-300 truncate mt-0.5">
                    Unlocked:{' '}
                    {rewardBanner.newlyUnlockedBadges.map((b) => b.title).join(', ')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setRewardBanner(null);
                  changeView('profile');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
              >
                View Badges
              </button>
              <button
                type="button"
                onClick={() => setRewardBanner(null)}
                aria-label="Dismiss reward notification"
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          if (session?.user?.id && updatedProfile) {
            pushAccountSyncPatch(
              session.user.id,
              { profileSnapshot: updatedProfile },
              session?.access_token,
              { immediate: true }
            );
          }
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
              authorizeInteractiveSession(nextSess.user.id, nextSess);
              return nextSess;
            });
          }
        }}
      />
    </>
  );
}
