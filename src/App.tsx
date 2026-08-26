import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, clearStaleSupabaseTokens } from './lib/supabase';
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
import { Sparkles, ShoppingBag, Users, BookOpen } from 'lucide-react';
import { mockBooks, categories as initialCategories } from './data';
import { ViewState, Book, Bookmark } from './types';
import { OfflineBanner } from './components/OfflineBanner';
import { BottomTabBar } from './components/BottomTabBar';
import { getAllReadingProgressLocal } from './lib/offlineManager';


export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [currentView, setCurrentView] = useState<ViewState>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const viewParam = urlParams.get('view') as ViewState;
      if (viewParam) return viewParam;
    }
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('edu_ai_current_view');
      if (saved) return saved as ViewState;
    }
    return 'dashboard';
  });

  const [activeBook, setActiveBook] = useState<Book | null>(() => {
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('edu_ai_active_book');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handlePopState = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const viewParam = urlParams.get('view') as ViewState;
        if (viewParam) {
          setCurrentView(viewParam);
        } else {
          setCurrentView('dashboard');
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const changeView = useCallback((view: ViewState) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', view);
      window.history.pushState({ view }, '', url);
    }
  }, []);

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('edu_ai_current_view', currentView);
    }
  }, [currentView]);

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      if (activeBook) {
        sessionStorage.setItem('edu_ai_active_book', JSON.stringify(activeBook));
      } else {
        sessionStorage.removeItem('edu_ai_active_book');
      }
    }
  }, [activeBook]);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const getPersistedBooks = (baseBooks: Book[]): Book[] => {
    let overrides: Record<string, any> = {};
    try {
      overrides = JSON.parse(localStorage.getItem('edu_ai_book_cover_overrides') || '{}');
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

      const saved = localStorage.getItem(`book_progress_${b.id}`);
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

  useEffect(() => {
    // Register Service Worker for offline asset caching
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service Worker registration skipped/failed:', err);
      });
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("Supabase getSession error (handling gracefully):", error.message);
          if (
            error.message?.includes('Refresh Token') ||
            error.message?.includes('refresh_token') ||
            error.message?.includes('Invalid') ||
            error.message?.includes('Failed to fetch')
          ) {
            try {
              await supabase.auth.signOut({ scope: 'local' });
            } catch (_) {}
            clearStaleSupabaseTokens();
          }
          setSession(null);
        } else {
          const currentSession = data?.session || null;
          setSession(currentSession);
          if (currentSession?.user) {
            try {
              const { data: profileData, error: profileErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currentSession.user.id)
                .single();
              if (profileData && !profileErr) setProfile(profileData);
            } catch (err) {
              console.warn("Profile fetch ignored:", err);
            }
          }
        }
      } catch (err: any) {
        console.warn("Failed to get Supabase session (handled):", err);
        const errMsg = err?.message || String(err || '');
        if (
          errMsg.includes('Refresh Token') || 
          errMsg.includes('refresh_token') || 
          errMsg.includes('Failed to fetch')
        ) {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (_) {}
          clearStaleSupabaseTokens();
        }
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const fetchBooks = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false });
        if (!error && data && Array.isArray(data) && data.length > 0) {
          const apiBooks = data.map(b => ({
            id: b.id,
            title: b.title,
            author: b.author || 'Unknown',
            coverImage: b.cover_image?.includes('unsplash.com') ? '' : (b.cover_image || ''),
            category: b.category || 'General',
            rating: 4.5,
            description: b.description || '',
            level: b.education_level,
            curriculum: b.curriculum ? [b.curriculum] : undefined,
            subjects: b.subjects ? b.subjects.split(',').map((s: string) => s.trim()) : undefined,
            country: b.description && b.description.includes('Location: ') ? [b.description.split('Location: ')[1].trim()] : undefined,
            fileUrl: b.file_url 
          }));
          
          setBooks(getPersistedBooks([...apiBooks, ...mockBooks]));
          
          // update categories to include dynamic ones
          const dbCategories = Array.from(new Set(data.map(b => b.category))).filter(Boolean);
          if (dbCategories.length > 0) {
             setCategories(Array.from(new Set(['All', ...initialCategories, ...dbCategories])));
          }
        }
      } catch (err) {
        console.warn("fetchBooks error (ignoring):", err);
      }
    };
    
    fetchBooks();

    let unsubscribe = () => {};
    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setSession(null);
          setBookmarks([]);
          setActiveBook(null);
          setProfile(null);
        } else if (session) {
          setSession(session);
          if (session.user) {
            try {
              const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
              if (profileData) setProfile(profileData);
            } catch (err) {
              console.warn("Profile fetch ignored:", err);
            }
          }
        }
      });
      if (data?.subscription) {
        unsubscribe = () => data.subscription.unsubscribe();
      }
    } catch (err: any) {
      console.warn("onAuthStateChange error ignored:", err);
      if (err?.message?.includes('Refresh Token') || err?.message?.includes('Failed to fetch')) {
        clearStaleSupabaseTokens();
      }
    }

    return () => unsubscribe();
  }, []);

  const handleAddBookmark = (bookmark: Bookmark) => {
    setBookmarks(prev => [bookmark, ...prev]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // If supabase is configured but no session, require user authentication
  if (supabase && !session) {
    return <Auth />;
  }

  return (
    <AnimatePresence mode="wait">
      {currentView === 'reader' && activeBook ? (
        <motion.div
          key="reader-view"
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 bg-white"
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.3 }}
          className="flex min-h-screen bg-slate-50 font-sans text-slate-900 border-x border-slate-50 w-full max-w-full overflow-x-hidden"
        >
          <Sidebar 
            currentView={currentView} 
            onChangeView={(view) => {
              changeView(view);
              setIsSidebarOpen(false);
            }} 
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
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
                  localStorage.setItem('custom_uploaded_books', JSON.stringify(updated.filter(b => b.id.startsWith('custom-') || b.id.startsWith('store-'))));
                  return updated;
                });
              }}
              user={session?.user}
              books={books}
            />

            <OfflineBanner onNavigate={(view) => changeView(view as any)} />
            
            <div className={`flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full relative z-0 ${currentView === 'ai-tutor' ? 'pb-[52px] sm:pb-[60px]' : 'pb-24'}`}>
              {/* Liquid glass ambient background refraction lighting */}
              <motion.div 
                key={`liquid-glow-${currentView}`}
                layoutId="liquidGlassAmbientViewGlow"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`pointer-events-none absolute top-0 inset-x-0 h-96 -z-10 blur-3xl opacity-30 dark:opacity-20 transition-all duration-700 ${
                  currentView === 'ai-tutor' || currentView === 'chat'
                    ? 'bg-gradient-to-b from-indigo-400 via-purple-400 to-transparent'
                    : currentView === 'notifications'
                    ? 'bg-gradient-to-b from-indigo-500 via-violet-400 to-transparent'
                    : currentView === 'book-store'
                    ? 'bg-gradient-to-b from-amber-400 via-rose-300 to-transparent'
                    : currentView === 'audiobooks'
                    ? 'bg-gradient-to-b from-purple-400 via-pink-400 to-transparent'
                    : currentView === 'library'
                    ? 'bg-gradient-to-b from-sky-400 via-blue-400 to-transparent'
                    : 'bg-gradient-to-b from-emerald-400 via-brand-300 to-transparent'
                }`}
              />

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
                      onAddBookToLibrary={(newBook) => {
                        setBooks(prev => {
                          if (prev.some(b => b.id === newBook.id)) return prev;
                          return [newBook, ...prev];
                        });
                      }}
                    />
                  )}
                  {currentView === 'learning-path' && <LearningPath user={session?.user} />}
                  {currentView === 'ai-tutor' && <AiTutor user={session?.user} />}
                  {currentView === 'quizzes' && <Quizzes user={session?.user} books={books} />}
                  {currentView === 'community' && <Community />}
                  {currentView === 'users-portal' && <UserPortal user={session?.user} profile={profile} onStartChat={(userId) => changeView('chat')} onNavigate={(view) => changeView(view as any)} />}
                  {currentView === 'chat' && <Chat user={session?.user} profile={profile} onNavigate={(view) => changeView(view as any)} />}
                  {currentView === 'settings' && <Settings />}
                  {currentView === 'support' && <Support />}
                  {currentView === 'developer' && <Developer />}
                  {currentView === 'profile' && <Profile />}
                  {currentView === 'workspace' && <Workspace />}
                  {currentView === 'admin' && (
                    <Admin 
                      appBooks={books} 
                      onUpdateBook={(updatedBook) => {
                        setBooks(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
                        if (activeBook?.id === updatedBook.id) {
                          setActiveBook(updatedBook);
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
                    />
                  )}
                  {currentView === 'audiobooks' && (
                    <Audiobooks 
                      books={books} 
                      onBookSelect={(book) => { setActiveBook(book); }} 
                      user={session?.user} 
                      profile={profile} 
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
 );
}
