import { 
  Search, Bell, MoreHorizontal, Book as BookIcon, Map, FileQuestion, 
  Headphones, ShoppingBag, X, CheckCircle2, Sparkles, ArrowRight,
  BookmarkCheck, Compass, HelpCircle, HardDriveDownload, TrendingUp,
  MessageCircle, Moon, Sun, User, Camera, Loader2, Mic, MicOff,
  Settings as SettingsIcon, Shield, MessageSquare, LogOut
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Book, ViewState } from '../types';
import { platformBookStoreCatalog } from '../data';
import { useOffline } from '../lib/useOffline';
import { getRelatedSearchSuggestions } from '../lib/searchSuggestions';
import { getStoredNotifications } from '../lib/notifications';
import { triggerCapsuleFeedback } from '../lib/feedback';
import { useUserAvatar, saveUserAvatarLocally } from '../lib/userAvatarService';
import { safeStorage } from '../lib/safeStorage';
import { supabase } from '../lib/supabase';

interface HeaderProps {
  currentView?: ViewState;
  onMenuClick: () => void;
  onBookSelect: (book: Book) => void;
  onNavigate: (view: ViewState) => void;
  onAddBookToLibrary?: (book: Book) => void;
  user?: any;
  books: Book[];
  onToggleSageSidebar?: () => void;
  isSageSidebarOpen?: boolean;
  onSignOut?: () => void;
}

export type SearchTabFilter = 'all' | 'library' | 'store' | 'related' | 'audiobooks' | 'paths' | 'quizzes';

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

const VIEW_TITLES: Record<string, { title: string; subtitle?: string; icon?: any }> = {
  'ai-tutor': { title: 'Sage AI Tutor', subtitle: 'Interactive Study Engine', icon: Sparkles },
  'audiobooks': { title: 'Audiobooks', subtitle: 'Immersive Audio Player & Library', icon: Headphones },
  'library': { title: 'My Library', subtitle: 'Saved Books & Reading List', icon: BookIcon },
  'book-store': { title: 'Bookstore', subtitle: 'Explore Catalog & Downloads', icon: ShoppingBag },
  'learning-path': { title: 'Learning Path', subtitle: 'Step-by-step Mastery', icon: Map },
  'quizzes': { title: 'Quizzes & Assessments', subtitle: 'Test Your Knowledge', icon: FileQuestion },
  'progress': { title: 'Learning Analytics', subtitle: 'Reading Stats & Milestones', icon: TrendingUp },
  'community': { title: 'Community', subtitle: 'Study Groups & Discussions', icon: BookmarkCheck },
  'chat': { title: 'Student Chat', subtitle: 'Direct Messages & Study Rooms', icon: MessageCircle },
  'users-portal': { title: 'Find Members & Friends', subtitle: 'Connect with Learners', icon: Compass },
  'notifications': { title: 'Notifications', subtitle: 'Activity & Updates', icon: Bell },
  'workspace': { title: 'Study Workspace', subtitle: 'Notes, Highlights & Flashcards', icon: BookmarkCheck },
  'settings': { title: 'Settings', subtitle: 'Preferences & Configurations', icon: SettingsIcon },
  'support': { title: 'Support & Help', subtitle: 'Support, FAQs & Assistance', icon: HelpCircle },
  'developer': { title: 'Developer Portal', subtitle: 'Developer & System Architect', icon: HardDriveDownload },
  'profile': { title: 'User Profile', subtitle: 'Account & Learning Track', icon: Compass },
  'admin': { title: 'Admin Platform', subtitle: 'System & Catalog Management', icon: Shield },
};

export function Header({ 
  currentView = 'dashboard',
  onMenuClick, 
  onBookSelect, 
  onNavigate, 
  onAddBookToLibrary, 
  user, 
  books,
  onToggleSageSidebar,
  isSageSidebarOpen: propIsSageSidebarOpen,
  onSignOut
}: HeaderProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchTabFilter>('all');
  const [addedBookIds, setAddedBookIds] = useState<Set<string>>(new Set());
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
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
    return getStoredNotifications().filter(n => !n.isRead).length;
  });
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = safeStorage.getItem('theme') || 'light';
      return saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) || document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { cachedBookIds } = useOffline();

  // Voice Search / Web SpeechRecognition API State
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const voiceNoticeTimeoutRef = useRef<any>(null);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      if (voiceNoticeTimeoutRef.current) {
        clearTimeout(voiceNoticeTimeoutRef.current);
      }
    };
  }, []);

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

  const userAvatarUrl = useUserAvatar(user);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const headerFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarImgFailed(false);
  }, [userAvatarUrl]);

  const handleHeaderPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    let previewDataUrl = '';
    try {
      setIsUploadingPhoto(true);

      // 1. Instant local base64 display across whole app
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const res = e.target?.result as string;
          if (res) {
            previewDataUrl = res;
            saveUserAvatarLocally(res, res);
            setAvatarImgFailed(false);
          }
          resolve();
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(file);
      });

      // 2. Upload to server disk & B2 for cloud sync
      const uploadRes = await fetch(`/api/upload-direct?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (uploadRes.ok) {
        const data = await uploadRes.json();
        if (data?.key) {
          saveUserAvatarLocally(data.key, previewDataUrl);
          if (supabase && user?.id) {
            try {
              await supabase.auth.updateUser({
                data: { avatar_url: data.key, profile_photo_key: data.key }
              });
              await supabase.from('profiles').update({ avatar_url: data.key }).eq('id', user.id);
            } catch (e) {
              console.warn("Supabase profile photo update notice:", e);
            }
          }
        }
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
    setIsDarkTheme(nextIsDark);
    safeStorage.setItem('theme', nextIsDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', nextIsDark);
    triggerCapsuleFeedback({ pitch: nextIsDark ? 480 : 720, volume: 0.16, hapticDuration: 12 });
    window.dispatchEvent(new Event('theme_changed'));
  };

  useEffect(() => {
    const handleThemeSync = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkTheme(isDark);
    };
    window.addEventListener('theme_changed', handleThemeSync);
    return () => window.removeEventListener('theme_changed', handleThemeSync);
  }, []);

  // Keep unread count in sync
  useEffect(() => {
    const updateCount = () => {
      const count = getStoredNotifications().filter(n => !n.isRead).length;
      setUnreadNotifCount(count);
    };

    updateCount();
    window.addEventListener('storage', updateCount);
    window.addEventListener('notifications_updated', updateCount);
    const interval = setInterval(updateCount, 3000);
    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('notifications_updated', updateCount);
      clearInterval(interval);
    };
  }, []);

  const fieldOfStudy = user?.user_metadata?.field_of_study || 'General Studies';
  const subjects = user?.user_metadata?.subjects || 'core concepts';

  const learningPaths = useMemo(() => [
    { id: 'path-1', title: `Foundations of ${fieldOfStudy}`, category: 'Path' },
    { id: 'path-2', title: `Advanced Topics in ${subjects}`, category: 'Path' },
    { id: 'path-3', title: 'Practical Applications & Projects', category: 'Path' },
    { id: 'path-4', title: 'Kenyan CBC Senior Secondary Core Pathway', category: 'Path' },
  ], [fieldOfStudy, subjects]);

  const quizzes = useMemo(() => [
    { id: 'quiz-1', title: `${fieldOfStudy}: Chapter 1 Review`, topic: fieldOfStudy },
    { id: 'quiz-2', title: `${subjects} Diagnostic Quiz`, topic: subjects },
    { id: 'quiz-3', title: 'Problem Solving & Critical Thinking', topic: 'General' },
    { id: 'quiz-4', title: 'CBC Grade 9 Science Assessment', topic: 'Science' },
  ], [fieldOfStudy, subjects]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(event.target as Node);
      const isOutsideDropdown = !dropdownRef.current || !dropdownRef.current.contains(event.target as Node);
      
      if (isOutsideContainer && isOutsideDropdown) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLow = query.toLowerCase().trim();

  // Combine Library Books and Bookstore Catalog into a comprehensive platform directory
  const { directLibraryBooks, directStoreBooks, relatedBooks } = useMemo(() => {
    if (!searchLow) {
      return { directLibraryBooks: [], directStoreBooks: [], relatedBooks: [] };
    }

    const libraryIds = new Set(books.map(b => b.id));

    // Match books in user's library
    const libMatches = books.filter(b => {
      const titleMatch = b.title.toLowerCase().includes(searchLow);
      const authorMatch = b.author.toLowerCase().includes(searchLow);
      const curriculumMatch = b.curriculum?.some(c => c.toLowerCase().includes(searchLow)) || false;
      const subjectsMatch = b.subjects?.some(s => s.toLowerCase().includes(searchLow)) || false;
      const categoryMatch = b.category.toLowerCase().includes(searchLow);
      const descMatch = b.description.toLowerCase().includes(searchLow);
      return titleMatch || authorMatch || curriculumMatch || subjectsMatch || categoryMatch || descMatch;
    });

    // Match books in the platform bookstore that are NOT in the library
    const storeMatches = platformBookStoreCatalog.filter(b => {
      if (libraryIds.has(b.id)) return false; // Already in library
      const titleMatch = b.title.toLowerCase().includes(searchLow);
      const authorMatch = b.author.toLowerCase().includes(searchLow);
      const curriculumMatch = b.curriculum?.some(c => c.toLowerCase().includes(searchLow)) || false;
      const subjectsMatch = b.subjects?.some(s => s.toLowerCase().includes(searchLow)) || false;
      const categoryMatch = b.category.toLowerCase().includes(searchLow);
      const descMatch = b.description.toLowerCase().includes(searchLow);
      return titleMatch || authorMatch || curriculumMatch || subjectsMatch || categoryMatch || descMatch;
    });

    // Extract subjects/categories from direct matches to find related books on the platform
    const matchedCategories = new Set<string>();
    const matchedSubjects = new Set<string>();

    [...libMatches, ...storeMatches].forEach(b => {
      matchedCategories.add(b.category.toLowerCase());
      b.subjects?.forEach(s => matchedSubjects.add(s.toLowerCase()));
    });

    const directIds = new Set([...libMatches.map(b => b.id), ...storeMatches.map(b => b.id)]);

    // Find related books on the platform that share category or subjects
    const allPlatformBooks = [...books, ...platformBookStoreCatalog.filter(b => !libraryIds.has(b.id))];
    
    const related: { book: Book; reason: string; inLibrary: boolean }[] = [];
    const seenRelatedIds = new Set<string>();

    allPlatformBooks.forEach(b => {
      if (directIds.has(b.id) || seenRelatedIds.has(b.id)) return;

      const hasCategoryRelation = matchedCategories.has(b.category.toLowerCase()) && matchedCategories.size > 0;
      const matchingSubject = b.subjects?.find(s => matchedSubjects.has(s.toLowerCase()));

      // Or if query loosely relates to book's subject / category
      const queryInSubject = b.subjects?.some(s => s.toLowerCase().includes(searchLow));
      const queryInCategory = b.category.toLowerCase().includes(searchLow);

      if (matchingSubject) {
        related.push({
          book: b,
          reason: `Related subject: ${matchingSubject}`,
          inLibrary: libraryIds.has(b.id)
        });
        seenRelatedIds.add(b.id);
      } else if (hasCategoryRelation) {
        related.push({
          book: b,
          reason: `Related category: ${b.category}`,
          inLibrary: libraryIds.has(b.id)
        });
        seenRelatedIds.add(b.id);
      } else if (queryInSubject || queryInCategory) {
        related.push({
          book: b,
          reason: `Related domain: ${b.category}`,
          inLibrary: libraryIds.has(b.id)
        });
        seenRelatedIds.add(b.id);
      }
    });

    return {
      directLibraryBooks: libMatches,
      directStoreBooks: storeMatches,
      relatedBooks: related.slice(0, 4)
    };
  }, [books, searchLow]);

  const filteredPaths = useMemo(() => {
    if (!searchLow) return [];
    return learningPaths.filter(p => p.title.toLowerCase().includes(searchLow));
  }, [learningPaths, searchLow]);

  const filteredQuizzes = useMemo(() => {
    if (!searchLow) return [];
    return quizzes.filter(q => q.title.toLowerCase().includes(searchLow) || q.topic.toLowerCase().includes(searchLow));
  }, [quizzes, searchLow]);

  const relatedSuggestions = useMemo(() => {
    return getRelatedSearchSuggestions(query, books);
  }, [query, books]);

  const showDropdown = isFocused;

  useLayoutEffect(() => {
    function updatePosition() {
      if (showDropdown && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isMobile = window.innerWidth < 640;
        
        if (isMobile) {
          setDropdownStyle({
            position: 'fixed',
            top: rect.bottom + 6,
            left: 8,
            right: 8,
            width: 'calc(100vw - 16px)',
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: `calc(100vh - ${Math.min(rect.bottom + 20, window.innerHeight - 80)}px)`,
            zIndex: 9999
          });
        } else {
          setDropdownStyle({
            position: 'fixed',
            top: rect.bottom + 8,
            left: rect.left,
            width: Math.max(rect.width, 460),
            maxWidth: `calc(100vw - ${rect.left + 16}px)`,
            maxHeight: '480px',
            zIndex: 9999
          });
        }
      }
    }
    
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showDropdown]);

  const totalBooksCount = directLibraryBooks.length + directStoreBooks.length;
  const hasResults = totalBooksCount > 0 || relatedBooks.length > 0 || filteredPaths.length > 0 || filteredQuizzes.length > 0;

  // Tab visibility flags
  const showLibrarySection = (searchFilter === 'all' || searchFilter === 'library' || searchFilter === 'books' as any) && directLibraryBooks.length > 0;
  const showStoreSection = (searchFilter === 'all' || searchFilter === 'store' || searchFilter === 'books' as any) && directStoreBooks.length > 0;
  const showRelatedSection = (searchFilter === 'all' || searchFilter === 'related') && relatedBooks.length > 0;
  const showAudiobooksSection = (searchFilter === 'all' || searchFilter === 'audiobooks') && directLibraryBooks.length > 0;
  const showPathsSection = (searchFilter === 'all' || searchFilter === 'paths') && filteredPaths.length > 0;
  const showQuizzesSection = (searchFilter === 'all' || searchFilter === 'quizzes') && filteredQuizzes.length > 0;

  const handleAddStoreBook = (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    if (onAddBookToLibrary) {
      onAddBookToLibrary(book);
    }
    setAddedBookIds(prev => new Set(prev).add(book.id));
  };

  const handleAskAiAboutTopic = () => {
    safeStorage.setItem('ai_tutor_prefill', `Can you provide a comprehensive summary, key chapter concepts, and study guide questions for "${query}"?`);
    onNavigate('ai-tutor');
    setIsFocused(false);
    setQuery('');
  };

  const handleToggleVoiceSearch = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (voiceNoticeTimeoutRef.current) {
      clearTimeout(voiceNoticeTimeoutRef.current);
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsListening(false);
      setVoiceNotice(null);
      return;
    }

    const SpeechRecognitionClass = 
      typeof window !== 'undefined' 
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition 
        : null;

    if (!SpeechRecognitionClass) {
      setVoiceNotice('Voice search is not supported in this browser.');
      voiceNoticeTimeoutRef.current = setTimeout(() => setVoiceNotice(null), 3500);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setIsFocused(true);
        setVoiceNotice('Listening... Speak a book title, topic or author');
        triggerCapsuleFeedback({ pitch: 620, volume: 0.2 });
      };

      recognition.onresult = (event: any) => {
        let currentFinal = '';
        let currentInterim = '';

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            currentFinal += item[0].transcript + ' ';
          } else {
            currentInterim += item[0].transcript;
          }
        }

        const spoken = (currentFinal || currentInterim).trim();
        if (spoken) {
          setQuery(spoken);
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('SpeechRecognition error:', err?.error || err);
        setIsListening(false);
        if (err?.error === 'not-allowed' || err?.error === 'service-not-allowed') {
          setVoiceNotice('Microphone access blocked. Please enable mic permissions.');
        } else if (err?.error !== 'no-speech') {
          setVoiceNotice(`Speech recognition error (${err?.error || 'failed'})`);
        } else {
          setVoiceNotice(null);
        }
        voiceNoticeTimeoutRef.current = setTimeout(() => setVoiceNotice(null), 3500);
      };

      recognition.onend = () => {
        setIsListening(false);
        voiceNoticeTimeoutRef.current = setTimeout(() => setVoiceNotice(null), 1500);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Could not start voice search:', err);
      setIsListening(false);
      setVoiceNotice('Could not start microphone');
      voiceNoticeTimeoutRef.current = setTimeout(() => setVoiceNotice(null), 3500);
    }
  };

  const isHomePage = currentView === 'dashboard';
  const currentViewInfo = VIEW_TITLES[currentView] || null;

  return (
    <header className="h-14 sm:h-16 liquid-glass-card border-b border-white/60 dark:border-white/10 flex items-center justify-between px-2.5 sm:px-4 md:px-8 sticky top-0 z-[100] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] w-full max-w-full overflow-visible">
      <div className="flex items-center flex-1 max-w-2xl relative gap-1.5 sm:gap-2.5 min-w-0 overflow-visible">
        <SideNavToggleIcon 
          onClick={() => {
            setIsFocused(false);
            onMenuClick();
          }} 
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsFocused(false);
              onMenuClick();
            }
          }}
          className="w-8 h-8 sm:w-8.5 sm:h-8.5 shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 drop-shadow-[0_2px_8px_rgba(36,44,254,0.25)] hover:drop-shadow-[0_4px_12px_rgba(36,44,254,0.38)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl select-none"
          title="Open Navigation"
          aria-label="Open Navigation Menu"
          role="button"
          tabIndex={0}
        />
        
        {/* Search bar is ONLY displayed on the Home page (dashboard) */}
        {isHomePage ? (
          <div ref={containerRef} className="relative flex-1 min-w-0 overflow-visible">
            <Search className={`w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
              isListening ? 'text-red-500 animate-pulse' : 'text-slate-400'
            }`} />
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  safeStorage.setItem('edu_search_prefill', query);
                  onNavigate('library');
                  setIsFocused(false);
                }
              }}
              placeholder={isListening ? "Listening... Speak now" : "Search books, syllabus, topics..."} 
              className={`w-full h-8.5 sm:h-[38px] pl-8 sm:pl-10 ${query ? 'pr-14 sm:pr-16' : 'pr-8 sm:pr-9'} bg-slate-100/60 dark:bg-slate-800/60 hover:bg-slate-100/90 dark:hover:bg-slate-800/90 focus:bg-white/95 dark:focus:bg-slate-900/95 border ${
                isListening 
                  ? 'border-red-500 ring-2 ring-red-500/30' 
                  : 'border-slate-200/60 dark:border-slate-700/60 focus:border-brand-500'
              } rounded-full text-xs sm:text-sm outline-none transition-all placeholder:text-slate-400 placeholder:truncate shadow-inner backdrop-blur-md min-w-0`}
            />

            {/* Clear Button */}
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-7 sm:right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Microphone Button (SpeechRecognition API) */}
            <button
              type="button"
              onClick={handleToggleVoiceSearch}
              className={`absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                isListening 
                  ? 'bg-red-500 text-white shadow-md shadow-red-500/40 ring-2 ring-red-400/60 animate-pulse scale-105' 
                  : 'text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 active:scale-95'
              }`}
              title={isListening ? "Listening... Click to stop" : "Voice search (Click and speak)"}
              aria-label={isListening ? "Stop listening" : "Search by voice"}
            >
              {isListening ? (
                <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white animate-bounce" />
              ) : (
                <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>

            {/* Voice Status Pill / Notice */}
            {voiceNotice && (
              <div className="absolute top-full left-0 mt-1.5 px-2.5 py-1 bg-slate-900/90 dark:bg-slate-950/95 text-white text-[11px] rounded-lg shadow-xl backdrop-blur-md z-[120] flex items-center gap-1.5 border border-white/10 animate-in fade-in slide-in-from-top-1">
                {isListening ? (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                ) : (
                  <MicOff className="w-3 h-3 text-slate-400 shrink-0" />
                )}
                <span className="truncate max-w-[240px] sm:max-w-xs">{voiceNotice}</span>
              </div>
            )}

          {/* Search Dropdown */}
          {showDropdown && createPortal(
            <div 
              ref={dropdownRef}
              style={dropdownStyle}
              className="bg-white/95 dark:bg-[#161616]/85 dark:backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/10 max-h-[480px] overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-150"
            >
              
              {/* If no query is entered yet, show popular suggestions & trending topics */}
              {!searchLow ? (
                <div className="p-4 space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                      <TrendingUp className="w-3.5 h-3.5 text-brand-500" />
                      <span>Trending & Recommended Searches</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Computer Science', icon: '💻' },
                        { label: 'Calculus & Physics', icon: '📐' },
                        { label: 'African Literature', icon: '🌍' },
                        { label: 'Kenyan CBC Grade 9', icon: '🇰🇪' },
                        { label: 'Data Structures & Algorithms', icon: '⚡' },
                        { label: 'Microbiology & Chemistry', icon: '🧬' },
                        { label: 'Business & Finance', icon: '📊' },
                        { label: 'Things Fall Apart', icon: '📖' },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => setQuery(item.label)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 dark:hover:text-brand-400 text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-slate-200/60 dark:border-slate-700/60"
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Shortcuts */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        onNavigate('library');
                        setIsFocused(false);
                      }}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors flex items-center gap-2.5 group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <BookIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600">Your Library</div>
                        <div className="text-[10px] text-slate-400">{books.length} books available</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        onNavigate('book-store');
                        setIsFocused(false);
                      }}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors flex items-center gap-2.5 group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">Bookstore Catalog</div>
                        <div className="text-[10px] text-slate-400">Official syllabuses & preps</div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Platform Availability Summary Banner */}
                  <div className="p-3 bg-gradient-to-r from-slate-50 to-brand-50/40 dark:from-slate-800/80 dark:to-slate-800/40 border-b border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                        <Compass className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                        <span>
                          Platform Search: <strong>"{query}"</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {directLibraryBooks.length} In Library
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          {directStoreBooks.length} in Bookstore
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Category Filter Chips inside dropdown */}
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {[
                      { id: 'all', label: 'All Results', count: totalBooksCount + relatedBooks.length + filteredPaths.length + filteredQuizzes.length },
                      { id: 'library', label: 'In Library', count: directLibraryBooks.length },
                      { id: 'store', label: 'In Bookstore', count: directStoreBooks.length },
                      { id: 'related', label: 'Related Books', count: relatedBooks.length },
                      { id: 'audiobooks', label: 'Audiobooks', count: directLibraryBooks.length },
                      { id: 'paths', label: 'Paths', count: filteredPaths.length },
                      { id: 'quizzes', label: 'Quizzes', count: filteredQuizzes.length },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setSearchFilter(tab.id as SearchTabFilter)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                          searchFilter === tab.id
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>{tab.label}</span>
                        {tab.count > 0 && (
                          <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                            searchFilter === tab.id ? 'bg-brand-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Related Searches & Keywords suggestion chips */}
                  {relatedSuggestions.length > 0 && (
                    <div className="px-3 py-2 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                        <TrendingUp className="w-3 h-3 text-brand-500" />
                        <span>Related Searches & Topics</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {relatedSuggestions.map((s, idx) => (
                          <button
                            key={`${s.text}-${idx}`}
                            onClick={() => setQuery(s.text)}
                            className="px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1 shadow-2xs cursor-pointer group active:scale-95"
                          >
                            <span className="text-[11px]">{s.icon || '🔍'}</span>
                            <span className="group-hover:underline">{s.text}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

              {hasResults ? (
                <div className="p-2 space-y-4">

                  {/* 1. Books in User's Library (Ready to Read) */}
                  {showLibrarySection && (
                    <div>
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>In Your Library ({directLibraryBooks.length})</span>
                        </div>
                        <button 
                          onClick={() => { 
                            if (query) safeStorage.setItem('edu_search_prefill', query);
                            onNavigate('library'); 
                            setIsFocused(false); 
                          }}
                          className="text-brand-600 dark:text-brand-400 font-medium hover:underline text-[10px] cursor-pointer"
                        >
                          Open Library →
                        </button>
                      </div>
                      <div className="space-y-1 mt-1">
                        {directLibraryBooks.slice(0, 4).map((book) => {
                          const isCached = cachedBookIds.has(book.id);
                          return (
                            <button
                              key={book.id}
                              onClick={() => {
                                onBookSelect(book);
                                setQuery('');
                                setIsFocused(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 rounded-xl text-left transition-colors cursor-pointer group border border-transparent hover:border-emerald-200/50"
                            >
                              <div className="w-8 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 font-bold shadow-sm">
                                <BookIcon className="w-4 h-4" />
                              </div>
                              <div className="truncate flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                                    {book.title}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-2 mt-0.5">
                                  <span>by {book.author}</span>
                                  <span>·</span>
                                  <span className="text-slate-400">{book.category}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isCached && (
                                  <span className="text-[10px] flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium" title="Saved offline">
                                    <HardDriveDownload className="w-3 h-3 text-emerald-500" /> Offline
                                  </span>
                                )}
                                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  Ready to Read
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2. Books Available in Platform Bookstore Catalog */}
                  {showStoreSection && (
                    <div>
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Available on Platform ({directStoreBooks.length})</span>
                        </div>
                        <button 
                          onClick={() => { 
                            if (query) safeStorage.setItem('edu_search_prefill', query);
                            onNavigate('book-store'); 
                            setIsFocused(false); 
                          }}
                          className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline text-[10px] cursor-pointer"
                        >
                          Visit Bookstore →
                        </button>
                      </div>
                      <div className="space-y-1 mt-1">
                        {directStoreBooks.slice(0, 4).map((book) => {
                          const isJustAdded = addedBookIds.has(book.id);
                          return (
                            <div
                              key={book.id}
                              onClick={() => {
                                onBookSelect(book);
                                setQuery('');
                                setIsFocused(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 rounded-xl text-left transition-colors cursor-pointer group border border-transparent hover:border-indigo-200/50"
                            >
                              <div className="w-8 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 font-bold shadow-sm">
                                <ShoppingBag className="w-4 h-4" />
                              </div>
                              <div className="truncate flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                                    {book.title}
                                  </span>
                                  {book.curriculum && book.curriculum.length > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 rounded font-medium">
                                      {book.curriculum.join(', ')}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-2 mt-0.5">
                                  <span>by {book.author}</span>
                                  <span>·</span>
                                  <span className="text-slate-400">{book.category}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {isJustAdded ? (
                                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Added
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => handleAddStoreBook(e, book)}
                                    className="text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-full flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                                  >
                                    <BookmarkCheck className="w-3.5 h-3.5" />
                                    Get Book
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 3. Related Books on Platform */}
                  {showRelatedSection && (
                    <div>
                      <div className="px-3 py-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Related Books on Platform ({relatedBooks.length})</span>
                        </div>
                      </div>
                      <div className="space-y-1 mt-1">
                        {relatedBooks.map(({ book, reason, inLibrary }) => (
                          <button
                            key={`related-${book.id}`}
                            onClick={() => {
                              onBookSelect(book);
                              setQuery('');
                              setIsFocused(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-amber-50/60 dark:hover:bg-amber-950/30 rounded-xl text-left transition-colors cursor-pointer group border border-transparent hover:border-amber-200/50"
                          >
                            <div className="w-8 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0 shadow-sm">
                              <BookIcon className="w-4 h-4" />
                            </div>
                            <div className="truncate flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                                  {book.title}
                                </span>
                              </div>
                              <div className="text-xs text-amber-700/80 dark:text-amber-400/90 truncate flex items-center gap-1.5 mt-0.5">
                                <span className="font-medium">{reason}</span>
                                <span>·</span>
                                <span>by {book.author}</span>
                              </div>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                              inLibrary 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' 
                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300'
                            }`}>
                              {inLibrary ? 'In Library' : 'Available in Store'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Audiobooks */}
                  {showAudiobooksSection && (
                    <div>
                      <div className="px-3 py-1.5 text-[11px] font-bold text-purple-500 uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Headphones className="w-3.5 h-3.5" />
                          <span>Audiobook Narrations</span>
                        </div>
                        <button 
                          onClick={() => { onNavigate('audiobooks'); setIsFocused(false); }}
                          className="text-purple-600 dark:text-purple-400 font-medium hover:underline text-[10px] cursor-pointer"
                        >
                          View All Audio →
                        </button>
                      </div>
                      <div className="space-y-1 mt-1">
                        {directLibraryBooks.slice(0, 2).map((book) => (
                          <button
                            key={`audio-${book.id}`}
                            onClick={() => {
                              onNavigate('audiobooks');
                              setQuery('');
                              setIsFocused(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-purple-50/70 dark:hover:bg-purple-950/40 rounded-xl text-left transition-colors cursor-pointer group"
                          >
                            <div className="w-7 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                              <Headphones className="w-4 h-4" />
                            </div>
                            <div className="truncate flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-purple-600 transition-colors">
                                {book.title} (Audio Edition)
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">Narrated · by {book.author}</div>
                            </div>
                            <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-2 py-0.5 rounded-full shrink-0">
                              Listen
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5. Learning Paths & Quizzes */}
                  {showPathsSection && (
                    <div>
                      <div className="px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <Map className="w-3 h-3" />
                        <span>Curriculum & Learning Paths</span>
                      </div>
                      <div className="space-y-1 mt-1">
                        {filteredPaths.slice(0, 2).map((path) => (
                          <button
                            key={path.id}
                            onClick={() => {
                              onNavigate('learning-path');
                              setQuery('');
                              setIsFocused(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 rounded-xl text-left transition-colors cursor-pointer"
                          >
                            <Map className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{path.title}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showQuizzesSection && (
                    <div>
                      <div className="px-3 py-1 text-[11px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                        <FileQuestion className="w-3 h-3" />
                        <span>Quizzes & Assessments</span>
                      </div>
                      <div className="space-y-1 mt-1">
                        {filteredQuizzes.slice(0, 2).map((quiz) => (
                          <button
                            key={quiz.id}
                            onClick={() => {
                              onNavigate('quizzes');
                              setQuery('');
                              setIsFocused(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-amber-50/70 dark:hover:bg-amber-950/40 rounded-xl text-left transition-colors cursor-pointer"
                          >
                            <FileQuestion className="w-4 h-4 text-amber-500 shrink-0" />
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{quiz.title}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Tutor Smart Assistant Shortcut */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={handleAskAiAboutTopic}
                      className="w-full p-3 bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950/40 border border-brand-200/60 dark:border-brand-800/40 rounded-xl flex items-center justify-between gap-3 text-left hover:brightness-95 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-xs">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                            <span>Ask Edu AI Tutor about "{query}"</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Generate on-demand summaries, textbook notes, and practice quizzes</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-brand-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  </div>

                </div>
              ) : (
                /* No direct results found state */
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    No exact textbook match for "{query}"
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    This specific title is not yet cataloged on the platform. You can ask the AI Tutor to generate study material or explore the bookstore for related subjects.
                  </p>

                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={handleAskAiAboutTopic}
                      className="w-full sm:w-auto px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate Study Guide with AI
                    </button>
                    <button
                      onClick={() => {
                        onNavigate('book-store');
                        setIsFocused(false);
                      }}
                      className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Browse Bookstore
                    </button>
                  </div>
                </div>
              )}
                </>
              )}
            </div>,
            document.body
          )}
        </div>
        ) : (
          /* Contextual View Title & Badge for Non-Home Pages (Sage, Audiobooks, Library, etc.) */
          <div className="flex items-center gap-2.5 min-w-0 py-0.5 ml-1">
            {currentViewInfo?.icon && (
              <div 
                role={currentView === 'ai-tutor' ? "button" : undefined}
                tabIndex={currentView === 'ai-tutor' ? 0 : undefined}
                onClick={currentView === 'ai-tutor' ? handleToggleSage : undefined}
                onKeyDown={currentView === 'ai-tutor' ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggleSage();
                  }
                } : undefined}
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-all ${
                  currentView === 'ai-tutor'
                    ? isSageOpen
                      ? 'bg-brand-600 dark:bg-brand-500 text-white shadow-md shadow-brand-500/25 ring-2 ring-brand-400/50 cursor-pointer scale-105 active:scale-95 border border-brand-500'
                      : 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 hover:text-indigo-700 dark:hover:text-indigo-300 hover:scale-105 active:scale-95 cursor-pointer hover:shadow-md'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400'
                }`}
                title={currentView === 'ai-tutor' ? (isSageOpen ? "Close Sage Chat History" : "Open Sage Chat History") : undefined}
                aria-label={currentView === 'ai-tutor' ? (isSageOpen ? "Close Sage Chat History" : "Open Sage Chat History") : undefined}
              >
                <currentViewInfo.icon className={`w-4 h-4 transition-transform ${currentView === 'ai-tutor' ? 'hover:scale-110' : ''}`} />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 
                  className={`text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate tracking-tight ${
                    currentView === 'ai-tutor' ? 'cursor-pointer hover:text-brand-600 dark:hover:text-brand-400 transition-colors' : ''
                  }`}
                  onClick={currentView === 'ai-tutor' ? handleToggleSage : undefined}
                  title={currentView === 'ai-tutor' ? "Toggle Sage Chat History" : undefined}
                >
                  {currentViewInfo?.title || 'Edu AI'}
                </h1>
                {currentView === 'ai-tutor' && (
                  <button
                    type="button"
                    onClick={handleToggleSage}
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                      isSageOpen
                        ? 'bg-brand-600 text-white border border-brand-500 shadow-xs ring-1 ring-brand-400/40'
                        : 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-700/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:scale-105 active:scale-95'
                    }`}
                    title={isSageOpen ? "Hide Sage Chat History" : "Open Sage Chat History"}
                  >
                    <MessageSquare className="w-2.5 h-2.5" />
                    <span>{isSageOpen ? 'Hide History' : 'Chat History'}</span>
                  </button>
                )}
                {currentView === 'audiobooks' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60 shrink-0">
                    Audio Sync
                  </span>
                )}
              </div>
              {currentViewInfo?.subtitle && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                  {currentView === 'ai-tutor' ? (isSageOpen ? 'Click icon to hide session history' : 'Click icon to open Sage Chat history') : currentViewInfo.subtitle}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 ml-1.5 sm:ml-4 shrink-0">
        {/* User's Profile Locality & Quick Menu (Replaces standalone Dark/Light toggle on Home Page) */}
        <div className="relative" ref={profileMenuRef}>
          <input 
            type="file" 
            ref={headerFileInputRef} 
            onChange={handleHeaderPhotoUpload} 
            accept="image/*" 
            className="hidden" 
          />

          <button 
            onClick={() => {
              triggerCapsuleFeedback({ pitch: 650, volume: 0.16, hapticDuration: 12 });
              setIsProfileMenuOpen(prev => !prev);
            }}
            className={`relative w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-full liquid-glass-card hover:scale-105 active:scale-95 flex items-center justify-center transition-all shadow-sm cursor-pointer border text-slate-700 dark:text-slate-200 shrink-0 overflow-hidden ${
              isProfileMenuOpen || currentView === 'profile'
                ? 'ring-2 ring-indigo-500/70 border-indigo-400 dark:border-indigo-500'
                : 'border-white/60 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-700'
            }`}
            title={`User Profile (${user?.user_metadata?.full_name || user?.email || 'Learner Account'})`}
            aria-label="User Profile"
          >
            {userAvatarUrl && !avatarImgFailed ? (
              <img 
                src={userAvatarUrl} 
                alt="Profile" 
                className="w-full h-full object-cover rounded-full"
                onError={() => {
                  const fallbackData = safeStorage.getItem('user_avatar_data_url');
                  if (fallbackData && userAvatarUrl !== fallbackData && (fallbackData.startsWith('data:image') || fallbackData.startsWith('blob:'))) {
                    saveUserAvatarLocally(fallbackData, fallbackData);
                    setAvatarImgFailed(false);
                  } else {
                    setAvatarImgFailed(true);
                  }
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-indigo-600 via-brand-600 to-violet-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm font-display shadow-inner">
                {userInitial}
              </div>
            )}
            
            {/* Status dot indicator */}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-1.5 ring-white dark:ring-slate-900" />
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
                        const fallbackData = safeStorage.getItem('user_avatar_data_url');
                        if (fallbackData && userAvatarUrl !== fallbackData && (fallbackData.startsWith('data:image') || fallbackData.startsWith('blob:'))) {
                          saveUserAvatarLocally(fallbackData, fallbackData);
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
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                      {user?.user_metadata?.field_of_study || 'Active Scholar'}
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
                    <span>View User Profile</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
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

        {/* Student Chat & Study Discussion - ONLY on Home Page */}
        {isHomePage && (
          <button 
            onClick={() => {
              triggerCapsuleFeedback({ pitch: 620, volume: 0.18, hapticDuration: 12 });
              onNavigate('chat');
            }}
            className="relative w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-full liquid-glass-card hover:scale-105 active:scale-95 flex items-center justify-center transition-all shadow-sm cursor-pointer border text-slate-600 dark:text-slate-300 border-white/60 dark:border-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 shrink-0"
            title="Student Chat & Study Groups"
          >
            <MessageCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2.5 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
          </button>
        )}

        {/* Notifications & Broadcasts Button in Header Bar */}
        {currentView !== 'reader' && (
          <button 
            onClick={() => {
              triggerCapsuleFeedback({ pitch: 580, volume: 0.18, hapticDuration: 12 });
              onNavigate('notifications');
            }}
            className="relative w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-full liquid-glass-card hover:scale-105 active:scale-95 flex items-center justify-center transition-all shadow-sm cursor-pointer border text-slate-600 dark:text-slate-300 border-white/60 dark:border-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 shrink-0"
            title="Notifications & Broadcasts Page"
          >
            <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            {unreadNotifCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[16px] sm:min-w-[18px] h-4 sm:h-[18px] px-1 bg-red-600 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
