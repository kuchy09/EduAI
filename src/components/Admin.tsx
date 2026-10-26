import React, { useState, useRef, useEffect } from 'react';
import { supabase, clearStaleSupabaseTokens } from '../lib/supabase';
import { safeStorage } from '../lib/safeStorage';
import { 
  Upload, FileText, CheckCircle, AlertCircle, Loader2, BookOpen, 
  Trash2, Search, Palette, Eye, Sparkles, Filter, CheckCircle2 
} from 'lucide-react';
import { mockBooks } from '../data';
import { Book } from '../types';
import { getCurriculumBooks } from '../lib/kenyaCurriculumService';
import { BookCoverVisual } from './BookCoverVisual';
import { BookCoverEditorModal } from './BookCoverEditorModal';

interface AdminProps {
  appBooks?: Book[];
  onUpdateBook?: (book: Book) => void;
  onDeleteBook?: (bookId: string) => void;
}

export function Admin({ appBooks, onUpdateBook, onDeleteBook }: AdminProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [devBypass, setDevBypass] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [adminEmail, setAdminEmail] = useState('');
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState('');
  
  // Book editing state for cover page
  const [editingCoverBook, setEditingCoverBook] = useState<Book | null>(null);

  // Search and filter for library directory
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [publisherFilter, setPublisherFilter] = useState<'ALL' | 'KLB' | 'UPLOADED'>('ALL');
  
  // Book uploading fields
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Textbook');
  const [educationLevel, setEducationLevel] = useState('All');
  const [curriculum, setCurriculum] = useState('General');
  const [location, setLocation] = useState('');
  const [subjects, setSubjects] = useState('');
  const [publisher, setPublisher] = useState('');
  const [isbn, setIsbn] = useState('');
  const [isKicdApproved, setIsKicdApproved] = useState(false);
  const [coverImage, setCoverImage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAdminStatus();
    loadBooks();
  }, [devBypass]);

  const checkAdminStatus = async () => {
    if (!supabase) {
      setIsAdmin(false);
      return;
    }
    try {
      const res = await supabase.auth.getUser();
      if (res?.error) {
        if (res.error.message?.includes('Refresh Token') || res.error.message?.includes('refresh_token')) {
          clearStaleSupabaseTokens();
        }
        setIsAdmin(devBypass);
        return;
      }
      const user = res?.data?.user;
      const isDomainAdmin = user?.email?.toLowerCase().endsWith('@admin.com') || false;
      setIsAdmin(isDomainAdmin || devBypass);
      if (user?.email) {
        setAdminEmail(user.email);
      }
    } catch {
      setIsAdmin(devBypass);
    }
  };

  const loadBooks = async () => {
    setIsLoading(true);
    try {
      let serverBooks: Book[] = [];
      let deletedIds = new Set<string>();

      // 1. Load persistent server catalog (/api/books covers local uploads, server Supabase, and B2)
      try {
        const res = await fetch('/api/books', { headers: { 'Cache-Control': 'no-cache' } });
        if (res.ok) {
          const payload = await res.json();
          if (Array.isArray(payload.books)) {
            serverBooks = payload.books;
          }
          if (Array.isArray(payload.deletedIds)) {
            deletedIds = new Set(payload.deletedIds);
          }
        }
      } catch (apiErr) {
        console.warn('Admin /api/books fetch warning:', apiErr);
      }

      // 2. Load client-side Supabase books if configured
      let dbBooksList: Book[] = [];
      if (supabase) {
        try {
          const { data } = await supabase.from('books').select('*').order('created_at', { ascending: false });
          if (data) {
            dbBooksList = data.map(b => {
              const isKlb =
                Boolean(b.publisher?.toLowerCase().includes('klb')) ||
                Boolean(b.author?.toLowerCase().includes('klb')) ||
                Boolean(b.title?.toLowerCase().includes('klb')) ||
                Boolean(b.author?.toLowerCase().includes('kenya literature bureau'));
              return {
                id: b.id,
                title: b.title,
                author: b.author || (isKlb ? 'Kenya Literature Bureau (KLB)' : 'Unknown'),
                publisher: b.publisher || (isKlb ? 'Kenya Literature Bureau (KLB)' : undefined),
                isKicdApproved: b.is_kicd_approved ?? isKlb,
                isbn: b.isbn || undefined,
                coverImage: b.cover_image?.includes('unsplash.com') ? '' : (b.cover_image || ''),
                category: b.category || 'Textbook',
                rating: 4.5,
                description: b.description || '',
                level: b.education_level,
                curriculum: b.curriculum ? [b.curriculum] : undefined,
                subjects: b.subjects ? b.subjects.split(',').map((s: string) => s.trim()) : undefined,
                fileUrl: b.file_url,
              };
            });
          }
        } catch (sbErr) {
          console.warn('Admin Supabase books query warning:', sbErr);
        }
      }

      // 3. Load Kenyan CBC & KCSE Curriculum books (includes accredited KLB textbooks)
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
          category: cb.category === 'PAST_PAPER' ? 'Past Paper' : cb.category === 'REVISION_GUIDE' ? 'Revision Guide' : 'Textbook',
          rating: 4.9,
          description: cb.description || '',
          level: 'School' as const,
          curriculum: cb.gradeLevel?.curriculum?.name ? [cb.gradeLevel.curriculum.name] : ['CBC'],
          subjects: cb.subject?.name ? [cb.subject.name] : undefined,
          country: ['Kenya'],
          fileUrl: cb.pdfFileUrl,
        }));
      } catch (currErr) {
        console.warn('Admin curriculum books fetch warning:', currErr);
      }

      // 4. Load custom uploaded books from browser safeStorage
      let localStoredBooks: Book[] = [];
      try {
        const rawStored = safeStorage.getItem('custom_uploaded_books');
        if (rawStored) {
          const parsed = JSON.parse(rawStored);
          if (Array.isArray(parsed)) {
            localStoredBooks = parsed;
          }
        }
      } catch (stErr) {
        console.warn('Failed to parse custom_uploaded_books:', stErr);
      }

      // 5. Merge & deduplicate by id and normalized title (preserving priority: server -> db -> local -> appBooks -> curriculum -> mockBooks)
      const combinedCandidates = [
        ...serverBooks,
        ...dbBooksList,
        ...localStoredBooks,
        ...(appBooks || []),
        ...mappedCurriculum,
        ...mockBooks,
      ];

      const seenIds = new Set<string>();
      const seenTitles = new Set<string>();
      const uniqueBooks: Book[] = [];

      for (const candidate of combinedCandidates) {
        if (!candidate || !candidate.id || deletedIds.has(candidate.id)) continue;
        const normTitle = `${candidate.title.trim().toLowerCase()}::${(candidate.publisher || candidate.author || '').trim().toLowerCase()}`;
        if (seenIds.has(candidate.id) || seenTitles.has(normTitle)) continue;
        seenIds.add(candidate.id);
        seenTitles.add(normTitle);
        uniqueBooks.push(candidate);
      }

      // Apply any persisted cover overrides from localStorage
      let overrides: Record<string, any> = {};
      try {
        overrides = JSON.parse(safeStorage.getItem('edu_ai_book_cover_overrides') || '{}');
      } catch (e) {
        console.warn('Failed to parse cover overrides cache:', e);
      }

      const mergedBooks = uniqueBooks.map(b => {
        const override = overrides[b.id];
        if (override) {
          return {
            ...b,
            coverMode: override.coverMode,
            coverImage: override.coverImage ?? b.coverImage,
            pdfCoverPage: override.pdfCoverPage,
            customCover: override.customCover,
          };
        }
        return b;
      });

      setBooks(mergedBooks);
    } catch (err: any) {
      console.error('Error fetching admin details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) {
      setErrorMsg('Please supply a title and file to publish.');
      return;
    }

    try {
      setIsUploading(true);
      setErrorMsg('');
      setSuccessMsg('');

      // 1. Always upload PDF binary to persistent backend disk (& B2 if configured)
      const uploadRes = await fetch(`/api/upload-direct?filename=${encodeURIComponent(file.name)}&prefix=books`, {
        method: 'POST',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/pdf',
        },
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        throw new Error(`Upload error: ${uploadRes.status} ${text}`);
      }

      const { key: fileKey } = await uploadRes.json();

      const finalDescription = educationLevel === 'School' && location
        ? `${description}\n\nLocation: ${location}`
        : description;

      const inferredKlb =
        publisher.toLowerCase().includes('klb') ||
        author.toLowerCase().includes('klb') ||
        title.toLowerCase().includes('klb') ||
        publisher.toLowerCase().includes('kenya literature bureau');

      const resolvedPublisher = publisher.trim() || (inferredKlb ? 'Kenya Literature Bureau (KLB)' : undefined);
      const resolvedAuthor = author.trim() || resolvedPublisher || 'Unknown Author';

      // 2. Persist book metadata to server catalog (/api/books also syncs with Supabase if configured)
      const catalogRes = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          author: resolvedAuthor,
          publisher: resolvedPublisher,
          isbn: isbn.trim() || undefined,
          isKicdApproved: isKicdApproved || inferredKlb,
          description: finalDescription,
          category,
          level: educationLevel,
          curriculum: educationLevel === 'School' && curriculum ? [curriculum] : undefined,
          subjects: subjects ? subjects.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          country: location ? [location.trim()] : (inferredKlb ? ['Kenya'] : undefined),
          coverImage: coverImage || '',
          fileUrl: fileKey,
        }),
      });

      if (!catalogRes.ok) {
        const errText = await catalogRes.text();
        throw new Error(`Failed to register book in catalog: ${errText}`);
      }

      const { book: savedBook } = await catalogRes.json();

      // 3. Also mirror to client-side Supabase if separately authenticated in browser
      if (supabase && savedBook?.id?.startsWith('book-')) {
        try {
          const { data: sbInserted } = await supabase
            .from('books')
            .insert([
              {
                title: savedBook.title,
                author: savedBook.author,
                description: finalDescription,
                category,
                education_level: educationLevel,
                curriculum: educationLevel === 'School' ? (curriculum || null) : null,
                subjects,
                cover_image: coverImage || '',
                file_url: fileKey,
                publisher: resolvedPublisher || null,
                is_kicd_approved: isKicdApproved || inferredKlb,
                isbn: isbn.trim() || null,
              },
            ])
            .select()
            .single();
          if (sbInserted?.id) {
            savedBook.id = sbInserted.id;
          }
        } catch (sbErr) {
          console.warn('Browser Supabase sync notice (already saved on server):', sbErr);
        }
      }

      // 4. Mirror in browser safeStorage for offline resilience
      try {
        const existingLocal = JSON.parse(safeStorage.getItem('custom_uploaded_books') || '[]');
        const nextLocal = [savedBook, ...(Array.isArray(existingLocal) ? existingLocal.filter((b: Book) => b.id !== savedBook.id) : [])];
        safeStorage.setItem('custom_uploaded_books', JSON.stringify(nextLocal));
      } catch (stErr) {
        console.warn('safeStorage sync notice:', stErr);
      }

      // 5. Update state immediately in Admin and parent App
      setBooks(prev => [savedBook, ...prev.filter(b => b.id !== savedBook.id)]);
      if (onUpdateBook) {
        onUpdateBook(savedBook);
      }

      setSuccessMsg(`"${savedBook.title}" successfully uploaded and saved to the library!`);
      setTitle('');
      setAuthor('');
      setDescription('');
      setCategory('Textbook');
      setEducationLevel('All');
      setCurriculum('General');
      setLocation('');
      setSubjects('');
      setPublisher('');
      setIsbn('');
      setIsKicdApproved(false);
      setCoverImage('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred during publishing procedure.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveCoverPage = async (updatedBook: Book) => {
    try {
      // 1. Update in server catalog
      try {
        await fetch(`/api/books/${encodeURIComponent(updatedBook.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coverImage: updatedBook.coverImage || '',
            coverMode: updatedBook.coverMode,
            pdfCoverPage: updatedBook.pdfCoverPage,
            customCover: updatedBook.customCover,
          }),
        });
      } catch (apiErr) {
        console.warn('Server cover update notice:', apiErr);
      }

      // 2. Update in Supabase if connected
      if (supabase && !mockBooks.some(m => m.id === updatedBook.id)) {
        try {
          await supabase.from('books').update({
            cover_image: updatedBook.coverImage || ''
          }).eq('id', updatedBook.id);
        } catch (dbErr) {
          console.warn('Supabase DB cover update warning (persisting locally):', dbErr);
        }
      }

      // 3. Update local state
      setBooks(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));

      // 4. Notify parent app to update user platform immediately
      if (onUpdateBook) {
        onUpdateBook(updatedBook);
      }

      setSuccessMsg(`Cover page for "${updatedBook.title}" successfully updated! Changes are now live on user screens.`);
    } catch (err: any) {
      console.error('Error saving cover page:', err);
      setErrorMsg(err.message || 'Failed to update cover page.');
    }
  };

  const requestDeleteBook = (id: string) => {
    setDeleteBookId(id);
    setDeletePassword('');
    setDeleteErrorMsg('');
  };

  const confirmDeleteBook = async () => {
    if (!deleteBookId) return;
    setIsDeleting(true);
    setDeleteErrorMsg('');

    try {
      if (!devBypass && (!deletePassword || deletePassword.length < 3)) {
        throw new Error('Please enter your admin password to confirm.');
      }

      // 1. Delete from persistent server catalog
      await fetch(`/api/books/${encodeURIComponent(deleteBookId)}`, {
        method: 'DELETE',
      });

      // 2. Delete from browser Supabase if connected
      if (supabase) {
        try {
          await supabase.from('books').delete().eq('id', deleteBookId);
        } catch (sbErr) {
          console.warn('Supabase delete warning:', sbErr);
        }
      }

      // 3. Remove from browser safeStorage custom_uploaded_books
      try {
        const existingLocal = JSON.parse(safeStorage.getItem('custom_uploaded_books') || '[]');
        if (Array.isArray(existingLocal)) {
          safeStorage.setItem(
            'custom_uploaded_books',
            JSON.stringify(existingLocal.filter((b: Book) => b.id !== deleteBookId))
          );
        }
      } catch (_) {}

      const removedId = deleteBookId;
      setBooks(prev => prev.filter(b => b.id !== removedId));
      if (onDeleteBook) {
        onDeleteBook(removedId);
      }
      setDeleteBookId(null);
      setDeletePassword('');
      setSuccessMsg('Book deleted from library catalog.');
    } catch (err: any) {
      console.error(err);
      setDeleteErrorMsg(err.message || 'Error occurred during deletion.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isKlbBook = (b: Book) =>
    Boolean(
      b.publisher?.toLowerCase().includes('klb') ||
      b.publisher?.toLowerCase().includes('kenya literature bureau') ||
      b.author?.toLowerCase().includes('klb') ||
      b.author?.toLowerCase().includes('kenya literature bureau') ||
      b.title?.toLowerCase().includes('klb')
    );

  const isUploadedBook = (b: Book) =>
    Boolean(
      b.id.startsWith('book-') ||
      b.id.startsWith('disk-') ||
      b.id.startsWith('b2-') ||
      b.id.startsWith('custom-') ||
      b.fileUrl?.startsWith('books/') ||
      b.fileUrl?.startsWith('uploads/')
    );

  const klbCount = books.filter(isKlbBook).length;
  const uploadedCount = books.filter(isUploadedBook).length;

  const filteredBooks = books.filter(b => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      (b.publisher && b.publisher.toLowerCase().includes(q)) ||
      (b.curriculum && b.curriculum.some(c => c.toLowerCase().includes(q))) ||
      (b.subjects && b.subjects.some(s => s.toLowerCase().includes(q)));
    const matchesCategory = categoryFilter === 'All' || b.category === categoryFilter;
    const matchesPublisher =
      publisherFilter === 'ALL' ||
      (publisherFilter === 'KLB' && isKlbBook(b)) ||
      (publisherFilter === 'UPLOADED' && isUploadedBook(b));
    return matchesSearch && matchesCategory && matchesPublisher;
  });

  if (isAdmin === false && !devBypass) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-16 font-sans text-center bg-white dark:bg-[#1a1a1d] border border-slate-200 dark:border-[#2e2e32] rounded-2xl shadow-xs">
        <h2 className="text-2xl font-bold mb-3 text-slate-900 dark:text-[#ededed]">Admin Access Only</h2>
        <p className="text-slate-500 dark:text-[#a1a1aa] mb-6 text-sm">You must be logged in with an @admin.com email.</p>
        <button 
          onClick={() => setDevBypass(true)} 
          className="px-6 py-2.5 bg-brand-600 dark:bg-[#7b5ecc] text-white font-semibold rounded-xl hover:bg-brand-700 dark:hover:bg-[#684db8] transition-colors cursor-pointer"
        >
          Developer Bypass
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-[#f4f4f6] tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-[#a1a1aa]">Manage library content, review uploads, and customize book cover pages.</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/30 rounded-xl flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="px-3 py-1.5 text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-white text-xs font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-500/30 rounded-xl flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="px-3 py-1.5 text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white text-xs font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Upload Form */}
        <div className="lg:col-span-4">
          <div className="bg-white dark:bg-[#1a1a1d] border text-sm border-slate-200 dark:border-[#2e2e32] rounded-2xl p-5 sm:p-6 shadow-xs dark:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.55)] sticky top-4 [color-scheme:light] dark:[color-scheme:dark]">
            <h2 className="text-base font-bold text-slate-800 dark:text-[#ededed] mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand-600 dark:text-[#a78bfa]" />
              Upload Source Material
            </h2>
            
            <form onSubmit={handleUpload} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Title *</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Author</label>
                <input type="text" value={author} onChange={e => setAuthor(e.target.value)} className="w-full px-3 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Description</label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none">
                    <option value="Textbook">Textbook</option>
                    <option value="Research Paper">Research Paper</option>
                    <option value="Study Guide">Study Guide</option>
                    <option value="Natural Sciences, Mathematics, and Statistics">Natural Sciences</option>
                    <option value="Information and Communication Technologies (ICT)">ICT & Computing</option>
                    <option value="Arts and Humanities">Arts & Humanities</option>
                    <option value="Social Sciences">Social Sciences</option>
                    <option value="Business, Administration, and Law">Business & Law</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Level</label>
                  <select value={educationLevel} onChange={e => setEducationLevel(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none">
                    <option value="All">All Levels</option>
                    <option value="School">School (CBC)</option>
                    <option value="University">University</option>
                  </select>
                </div>
              </div>

              {educationLevel === 'School' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Curriculum</label>
                      <input type="text" placeholder="e.g. CBC, K-12" value={curriculum} onChange={e => setCurriculum(e.target.value)} className="w-full px-3 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Location</label>
                      <input type="text" placeholder="e.g. Kenya, UK" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-3 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Publisher</label>
                      <input type="text" placeholder="e.g. KLB, Oxford" value={publisher} onChange={e => setPublisher(e.target.value)} className="w-full px-3 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">ISBN (Optional)</label>
                      <input type="text" placeholder="e.g. 978-9966..." value={isbn} onChange={e => setIsbn(e.target.value)} className="w-full px-3 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="checkbox" 
                      id="kicdApproved" 
                      checked={isKicdApproved} 
                      onChange={e => setIsKicdApproved(e.target.checked)}
                      className="rounded border-slate-300 dark:border-[#3f3f46] dark:bg-[#222226] text-teal-600 focus:ring-teal-500"
                    />
                    <label htmlFor="kicdApproved" className="text-xs font-medium text-slate-700 dark:text-[#d4d4d8]">
                      Official KICD Approved Course Material
                    </label>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">File (PDF) *</label>
                <div className="border border-dashed border-slate-300 dark:border-[#3f3f46] bg-transparent dark:bg-[#222226]/60 rounded-lg p-3 text-center hover:bg-[#f8f9fb] dark:hover:bg-[#27272c] transition-colors">
                  <input type="file" required ref={fileInputRef} onChange={handleFileChange} accept=".pdf,application/pdf" className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer text-xs font-medium flex flex-col items-center gap-1">
                    <FileText className="w-5 h-5 text-slate-400 dark:text-[#8e8e93]" />
                    <span className="text-brand-600 dark:text-[#a78bfa] hover:text-brand-700 dark:hover:text-[#c4b5fd]">Choose PDF File</span>
                    <span className="text-slate-400 dark:text-[#8e8e93] text-[11px] truncate max-w-[200px]">{file ? file.name : 'No file selected'}</span>
                  </label>
                </div>
              </div>

              <button disabled={isUploading} type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-700 dark:bg-[#7b5ecc] dark:hover:bg-[#684db8] text-white rounded-lg font-bold transition-colors disabled:opacity-50 text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer">
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {isUploading ? 'Uploading Material...' : 'Publish Material'}
              </button>
            </form>
          </div>
        </div>

        {/* Library Content Directory & Cover Manager */}
        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-[#1a1a1d] border border-slate-200 dark:border-[#2e2e32] text-sm rounded-2xl p-5 sm:p-6 shadow-xs dark:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.55)]">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-600 dark:text-[#a78bfa]" />
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-[#ededed]">Library Content Directory</h2>
                  <p className="text-xs text-slate-400 dark:text-[#9ca3af]">Edit cover pages, update artwork, and inspect user catalog items.</p>
                </div>
              </div>

              {/* Fast search */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#8e8e93] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Filter by title, KLB, author..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#f8f9fb] dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-[#27272c]"
                />
              </div>
            </div>

            {/* Quick Publisher & Upload Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setPublisherFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                  publisherFilter === 'ALL'
                    ? 'bg-brand-600 dark:bg-[#7b5ecc] text-white border-brand-600 dark:border-[#7b5ecc]'
                    : 'bg-[#f8f9fb] dark:bg-[#222226] text-slate-600 dark:text-[#c4c4c8] border-slate-200 dark:border-[#34343c] hover:bg-slate-100 dark:hover:bg-[#2a2a30]'
                }`}
              >
                All Books ({books.length})
              </button>
              <button
                type="button"
                onClick={() => setPublisherFilter('KLB')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border flex items-center gap-1.5 ${
                  publisherFilter === 'KLB'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-[#f8f9fb] dark:bg-[#222226] text-slate-600 dark:text-[#c4c4c8] border-slate-200 dark:border-[#34343c] hover:bg-slate-100 dark:hover:bg-[#2a2a30]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                KLB Textbooks ({klbCount})
              </button>
              <button
                type="button"
                onClick={() => setPublisherFilter('UPLOADED')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                  publisherFilter === 'UPLOADED'
                    ? 'bg-brand-600 dark:bg-[#7b5ecc] text-white border-brand-600 dark:border-[#7b5ecc]'
                    : 'bg-[#f8f9fb] dark:bg-[#222226] text-slate-600 dark:text-[#c4c4c8] border-slate-200 dark:border-[#34343c] hover:bg-slate-100 dark:hover:bg-[#2a2a30]'
                }`}
              >
                Custom Uploads ({uploadedCount})
              </button>
            </div>

            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-[#8e8e93]">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                <span className="text-xs">Loading library records...</span>
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="py-16 text-center text-slate-400 dark:text-[#8e8e93] text-xs">
                No books matched your search filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#f8f9fb] dark:bg-[#222226] text-slate-500 dark:text-[#a1a1aa] text-[11px] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-3 py-2.5 rounded-l-lg">Cover Preview</th>
                      <th className="px-3 py-2.5">Book Details</th>
                      <th className="px-3 py-2.5">Category & Level</th>
                      <th className="px-3 py-2.5">Cover Status</th>
                      <th className="px-3 py-2.5 rounded-r-lg text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a30] text-xs">
                    {filteredBooks.map(b => {
                      const hasCustomImage = !!b.coverImage;
                      const isVisualMode = b.coverMode === 'visual';
                      const isPdfMode = b.coverMode === 'pdf' || (b.fileUrl && !b.coverImage);
                      
                      return (
                        <tr key={b.id} className="hover:bg-[#f8f9fb] dark:hover:bg-[#222226]/80 transition-colors group">
                          
                          {/* Thumbnail / Cover Trigger */}
                          <td className="px-3 py-3 w-16">
                            <div 
                              onClick={() => setEditingCoverBook(b)}
                              className="w-12 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-[#34343c] shadow-xs cursor-pointer group-hover:ring-2 group-hover:ring-brand-500 transition-all relative"
                              title="Click to Edit Cover Page"
                            >
                              <BookCoverVisual book={b} className="w-full h-full" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <Palette className="w-4 h-4" />
                              </div>
                            </div>
                          </td>

                          {/* Book Title & Author */}
                          <td className="px-3 py-3">
                            <div className="font-bold text-slate-900 dark:text-[#ededed] line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-[#b8a5f0] transition-colors">
                              {b.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-[#a1a1aa] truncate max-w-[220px]">
                              {b.publisher || b.author || 'Unknown Author'}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              {b.curriculum && (
                                <span className="inline-block text-[9px] font-mono font-bold bg-[#f1f3f7] dark:bg-[#27272d] text-slate-600 dark:text-[#d4d4d8] px-1.5 py-0.2 rounded border border-transparent dark:border-[#34343c]">
                                  {b.curriculum.join(', ')}
                                </span>
                              )}
                              {b.isKicdApproved && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-200/70 dark:border-emerald-500/25">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  KICD
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Category & Level */}
                          <td className="px-3 py-3">
                            <span className="bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-[#c4b5fd] px-2 py-0.5 rounded text-[11px] font-medium block truncate max-w-[150px] border border-transparent dark:border-brand-500/25">
                              {b.category}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-[#8e8e93] block mt-0.5">
                              {b.level || 'All Levels'}
                            </span>
                          </td>

                          {/* Cover Status indicator */}
                          <td className="px-3 py-3">
                            {hasCustomImage ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/15 border border-transparent dark:border-purple-500/25 px-2 py-0.5 rounded-full">
                                <Sparkles className="w-3 h-3" />
                                Custom Art
                              </span>
                            ) : isVisualMode ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-transparent dark:border-amber-500/25 px-2 py-0.5 rounded-full">
                                <Palette className="w-3 h-3" />
                                Vector Theme
                              </span>
                            ) : isPdfMode ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 border border-transparent dark:border-blue-500/25 px-2 py-0.5 rounded-full">
                                <FileText className="w-3 h-3" />
                                PDF Page {b.pdfCoverPage || 1}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-[#a1a1aa] bg-[#f1f3f7] dark:bg-[#27272d] border border-transparent dark:border-[#34343c] px-2 py-0.5 rounded-full">
                                Smart Default
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Cover Action Button */}
                              <button
                                onClick={() => setEditingCoverBook(b)}
                                className="px-2.5 py-1.5 bg-brand-50 dark:bg-[#252236] hover:bg-brand-100 dark:hover:bg-[#312c48] text-brand-700 dark:text-[#c4b5fd] font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-xs border border-brand-200 dark:border-brand-500/30 cursor-pointer"
                                title="Edit Cover Page"
                              >
                                <Palette className="w-3.5 h-3.5" />
                                <span>Edit Cover</span>
                              </button>

                              <button 
                                onClick={() => requestDeleteBook(b.id)} 
                                className="text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-lg transition-colors cursor-pointer"
                                title="Delete Book"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Book Cover Editor Modal */}
      {editingCoverBook && (
        <BookCoverEditorModal
          book={editingCoverBook}
          isOpen={true}
          onClose={() => setEditingCoverBook(null)}
          onSave={handleSaveCoverPage}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteBookId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#1a1a1d] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-[#2e2e32]">
            <div className="p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-[#ededed] mb-1.5">Confirm Deletion</h3>
              <p className="text-xs text-slate-500 dark:text-[#a1a1aa] mb-4">
                {devBypass
                  ? 'Are you sure you want to permanently remove this book from the library catalog?'
                  : 'Please enter your admin password to confirm the permanent deletion of this book.'}
              </p>
              
              {deleteErrorMsg && (
                <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs rounded-lg border border-rose-200 dark:border-rose-500/30">
                  {deleteErrorMsg}
                </div>
              )}

              {!devBypass && (
                <input
                  type="password"
                  placeholder="Admin Password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 outline-none mb-5"
                />
              )}

              <div className="flex gap-2.5">
                <button
                  onClick={() => setDeleteBookId(null)}
                  className="flex-1 py-2 px-3 border border-slate-200 dark:border-[#34343c] text-slate-600 dark:text-[#c4c4c8] rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#222226] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteBook}
                  disabled={isDeleting || (!devBypass && !deletePassword)}
                  className="flex-1 py-2 px-3 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
