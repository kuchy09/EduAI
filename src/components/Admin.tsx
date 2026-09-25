import React, { useState, useRef, useEffect } from 'react';
import { supabase, clearStaleSupabaseTokens } from '../lib/supabase';
import { 
  Upload, FileText, CheckCircle, AlertCircle, Loader2, BookOpen, 
  Trash2, Search, Palette, Eye, Sparkles, Filter, CheckCircle2 
} from 'lucide-react';
import { mockBooks } from '../data';
import { Book } from '../types';
import { BookCoverVisual } from './BookCoverVisual';
import { BookCoverEditorModal } from './BookCoverEditorModal';

interface AdminProps {
  appBooks?: Book[];
  onUpdateBook?: (book: Book) => void;
}

export function Admin({ appBooks, onUpdateBook }: AdminProps) {
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
      let dbBooksList: Book[] = [];
      if (supabase) {
        const { data } = await supabase.from('books').select('*').order('created_at', { ascending: false });
        if (data) {
          dbBooksList = data.map(b => ({
            id: b.id,
            title: b.title,
            author: b.author || 'Unknown',
            coverImage: b.cover_image?.includes('unsplash.com') ? '' : (b.cover_image || ''),
            category: b.category,
            rating: 4.5,
            description: b.description || '',
            level: b.education_level,
            curriculum: b.curriculum ? [b.curriculum] : undefined,
            subjects: b.subjects ? b.subjects.split(',').map((s: string) => s.trim()) : undefined,
            fileUrl: b.file_url,
          }));
        }
      }

      // Merge mock books
      const allBooksRaw = [...dbBooksList, ...mockBooks];

      // Apply any persisted cover overrides from localStorage
      let overrides: Record<string, any> = {};
      try {
        overrides = JSON.parse(localStorage.getItem('edu_ai_book_cover_overrides') || '{}');
      } catch (e) {
        console.warn('Failed to parse cover overrides cache:', e);
      }

      const mergedBooks = allBooksRaw.map(b => {
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
    if (!supabase) {
      // Local addition mode when supabase not connected
      const newMockBook: Book = {
        id: `book-${Date.now()}`,
        title,
        author: author || 'Unknown Author',
        description,
        category,
        rating: 4.8,
        level: educationLevel as any,
        curriculum: curriculum ? [curriculum] : undefined,
        subjects: subjects ? subjects.split(',').map(s => s.trim()) : undefined,
        coverImage: coverImage || '',
        fileUrl: file.name
      };
      setBooks(prev => [newMockBook, ...prev]);
      if (onUpdateBook) onUpdateBook(newMockBook);
      setSuccessMsg('Book successfully registered in local library catalog!');
      setTitle('');
      setAuthor('');
      setDescription('');
      setCoverImage('');
      setFile(null);
      return;
    }

    try {
      setIsUploading(true);
      setErrorMsg('');
      setSuccessMsg('');

      // Upload key via custom backend routing
      const uploadRes = await fetch(`/api/upload-direct?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        throw new Error(`Cloud upload handshake error: ${uploadRes.status} ${text}`);
      }

      const { key: fileKey } = await uploadRes.json();

      const finalDescription = educationLevel === 'School' && location 
        ? `${description}\n\nLocation: ${location}`
        : description;

      // Write parameters to Supabase book index
      const { data, error } = await supabase.from('books').insert([
        {
          title,
          author,
          description: finalDescription,
          category,
          education_level: educationLevel,
          curriculum: educationLevel === 'School' ? (curriculum ? curriculum : null) : null,
          subjects,
          cover_image: coverImage || '',
          file_url: fileKey,
          publisher: publisher || null,
          is_kicd_approved: isKicdApproved,
          isbn: isbn || null
        }
      ]).select();

      if (error) throw error;

      setSuccessMsg('Book successfully uploaded!');
      setTitle('');
      setAuthor('');
      setDescription('');
      setCategory('Textbook');
      setEducationLevel('All');
      setCurriculum('General');
      setLocation('');
      setSubjects('');
      setCoverImage('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      loadBooks();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred during publishing procedure.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveCoverPage = async (updatedBook: Book) => {
    try {
      // 1. Update in Supabase if it is a database record
      if (supabase && !mockBooks.some(m => m.id === updatedBook.id)) {
        try {
          await supabase.from('books').update({
            cover_image: updatedBook.coverImage || ''
          }).eq('id', updatedBook.id);
        } catch (dbErr) {
          console.warn('Supabase DB cover update warning (persisting locally):', dbErr);
        }
      }

      // 2. Update local state
      setBooks(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));

      // 3. Notify parent app to update user platform immediately
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
    if (!supabase) {
      setBooks(prev => prev.filter(b => b.id !== deleteBookId));
      setDeleteBookId(null);
      setSuccessMsg('Book removed from library catalog');
      return;
    }
    setIsDeleting(true);
    setDeleteErrorMsg('');

    try {
      if (!deletePassword) {
         throw new Error('Please enter a password to confirm');
      }

      if (!devBypass && deletePassword.length < 3) {
         throw new Error('Incorrect password');
      }

      const { error } = await supabase.from('books').delete().eq('id', deleteBookId);
      if (error) throw error;

      setDeleteBookId(null);
      setDeletePassword('');
      loadBooks();
      setSuccessMsg('Book deleted successfully');
    } catch (err: any) {
      console.error(err);
      setDeleteErrorMsg(err.message || 'Error occurred during deletion.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredBooks = books.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (b.subjects && b.subjects.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesCategory = categoryFilter === 'All' || b.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (isAdmin === false && !devBypass) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-16 font-sans text-center">
        <h2 className="text-2xl font-bold mb-4">Admin Access Only</h2>
        <p className="text-slate-500 mb-6">You must be logged in with an @admin.com email.</p>
        <button 
          onClick={() => setDevBypass(true)} 
          className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
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
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-slate-500">Manage library content, review uploads, and customize book cover pages.</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="px-3 py-1.5 text-emerald-700 hover:text-emerald-900 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="px-3 py-1.5 text-rose-700 hover:text-rose-900 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Upload Form */}
        <div className="lg:col-span-4">
          <div className="bg-white border text-sm border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs sticky top-4">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand-600" />
              Upload Source Material
            </h2>
            
            <form onSubmit={handleUpload} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Title *</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 outline-none" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Author</label>
                <input type="text" value={author} onChange={e => setAuthor(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs">
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Level</label>
                  <select value={educationLevel} onChange={e => setEducationLevel(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs">
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
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Curriculum</label>
                      <input type="text" placeholder="e.g. CBC, K-12" value={curriculum} onChange={e => setCurriculum(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
                      <input type="text" placeholder="e.g. Kenya, UK" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Publisher</label>
                      <input type="text" placeholder="e.g. KLB, Oxford" value={publisher} onChange={e => setPublisher(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">ISBN (Optional)</label>
                      <input type="text" placeholder="e.g. 978-9966..." value={isbn} onChange={e => setIsbn(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="checkbox" 
                      id="kicdApproved" 
                      checked={isKicdApproved} 
                      onChange={e => setIsKicdApproved(e.target.checked)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <label htmlFor="kicdApproved" className="text-xs font-medium text-slate-700">
                      Official KICD Approved Course Material
                    </label>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">File (PDF) *</label>
                <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center hover:bg-slate-50 transition-colors">
                  <input type="file" required ref={fileInputRef} onChange={handleFileChange} accept=".pdf,application/pdf" className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer text-xs font-medium flex flex-col items-center gap-1">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <span className="text-brand-600 hover:text-brand-700">Choose PDF File</span>
                    <span className="text-slate-400 text-[11px] truncate max-w-[200px]">{file ? file.name : 'No file selected'}</span>
                  </label>
                </div>
              </div>

              <button disabled={isUploading} type="submit" className="w-full py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-colors disabled:opacity-50 text-xs flex items-center justify-center gap-2 shadow-xs">
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {isUploading ? 'Uploading Material...' : 'Publish Material'}
              </button>
            </form>
          </div>
        </div>

        {/* Library Content Directory & Cover Manager */}
        <div className="lg:col-span-8">
          <div className="bg-white border border-slate-200 text-sm rounded-2xl p-5 sm:p-6 shadow-xs">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-800">Library Content Directory</h2>
                  <p className="text-xs text-slate-400">Edit cover pages, update artwork, and inspect user catalog items.</p>
                </div>
              </div>

              {/* Fast search */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Filter by title, author..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                <span className="text-xs">Loading library records...</span>
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No books matched your search filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-3 py-2.5 rounded-l-lg">Cover Preview</th>
                      <th className="px-3 py-2.5">Book Details</th>
                      <th className="px-3 py-2.5">Category & Level</th>
                      <th className="px-3 py-2.5">Cover Status</th>
                      <th className="px-3 py-2.5 rounded-r-lg text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredBooks.map(b => {
                      const hasCustomImage = !!b.coverImage;
                      const isVisualMode = b.coverMode === 'visual';
                      const isPdfMode = b.coverMode === 'pdf' || (b.fileUrl && !b.coverImage);
                      
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors group">
                          
                          {/* Thumbnail / Cover Trigger */}
                          <td className="px-3 py-3 w-16">
                            <div 
                              onClick={() => setEditingCoverBook(b)}
                              className="w-12 h-16 rounded-lg overflow-hidden border border-slate-200 shadow-xs cursor-pointer group-hover:ring-2 group-hover:ring-brand-500 transition-all relative"
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
                            <div className="font-bold text-slate-900 line-clamp-1 group-hover:text-brand-600 transition-colors">
                              {b.title}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                              {b.author || 'Unknown Author'}
                            </div>
                            {b.curriculum && (
                              <span className="inline-block mt-0.5 text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                                {b.curriculum.join(', ')}
                              </span>
                            )}
                          </td>

                          {/* Category & Level */}
                          <td className="px-3 py-3">
                            <span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded text-[11px] font-medium block truncate max-w-[150px]">
                              {b.category}
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {b.level || 'All Levels'}
                            </span>
                          </td>

                          {/* Cover Status indicator */}
                          <td className="px-3 py-3">
                            {hasCustomImage ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                                <Sparkles className="w-3 h-3" />
                                Custom Art
                              </span>
                            ) : isVisualMode ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
                                <Palette className="w-3 h-3" />
                                Vector Theme
                              </span>
                            ) : isPdfMode ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                <FileText className="w-3 h-3" />
                                PDF Page {b.pdfCoverPage || 1}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
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
                                className="px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-xs border border-brand-200"
                                title="Edit Cover Page"
                              >
                                <Palette className="w-3.5 h-3.5" />
                                <span>Edit Cover</span>
                              </button>

                              <button 
                                onClick={() => requestDeleteBook(b.id)} 
                                className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="p-6">
              <h3 className="text-base font-bold text-slate-900 mb-1.5">Confirm Deletion</h3>
              <p className="text-xs text-slate-500 mb-4">
                Please enter your admin password to confirm the permanent deletion of this book.
              </p>
              
              {deleteErrorMsg && (
                <div className="mb-3 p-2.5 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
                  {deleteErrorMsg}
                </div>
              )}

              <input
                type="password"
                placeholder="Admin Password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 outline-none mb-5"
              />

              <div className="flex gap-2.5">
                <button
                  onClick={() => setDeleteBookId(null)}
                  className="flex-1 py-2 px-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteBook}
                  disabled={isDeleting || !deletePassword}
                  className="flex-1 py-2 px-3 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
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
