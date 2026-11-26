import React, { useState, useRef, useEffect } from 'react';
import { supabase, clearStaleSupabaseTokens, getPersistedDeviceSession } from '../lib/supabase';
import { safeStorage } from '../lib/safeStorage';
import {
  applyGlobalCoversToBooks,
  saveGlobalBookCover,
  setGlobalBookCovers,
} from '../lib/globalBookCoversService';
import { isSystemBookConfigRow } from '../../shared/canonicalBookCovers';
import { 
  Upload, FileText, CheckCircle, AlertCircle, Loader2, BookOpen, 
  Trash2, Search, Palette, Sparkles, CheckCircle2, Cloud, FolderTree, RefreshCw, Database, Image as ImageIcon
} from 'lucide-react';
import { mockBooks } from '../data';
import { Book } from '../types';
import { getCurriculumBooks } from '../lib/kenyaCurriculumService';
import { CURRICULA, SCHOOL_SUBJECTS, COLLEGE_SUBJECTS_MAP } from '../lib/bookPersonalization';
import { BookCoverVisual } from './BookCoverVisual';
import { BookCoverEditorModal } from './BookCoverEditorModal';
import { BookConversionModal } from './BookConversionModal';
import { ADMIN_LOGIN_EMAIL, isAdminLoginEmail } from '../../shared/adminAuth';
import {
  CANONICAL_SUBJECT_CATEGORIES,
  buildB2CurriculumPath,
  parseB2CurriculumKey,
} from '../../shared/b2StoragePaths';
import { normalizePastedCoverUrl } from '../lib/coverUrlUtils';

interface AdminProps {
  appBooks?: Book[];
  user?: any;
  onUpdateBook?: (book: Book) => void;
  onDeleteBook?: (bookId: string, fileUrl?: string) => void;
}

export function Admin({ appBooks, user: propUser, onUpdateBook, onDeleteBook }: AdminProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [devBypass, setDevBypass] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [adminEmail, setAdminEmail] = useState('');
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState('');
  
  // Book editing state for cover page & EPUB conversion
  const [editingCoverBook, setEditingCoverBook] = useState<Book | null>(null);
  const [conversionModalBook, setConversionModalBook] = useState<Book | null>(null);

  // Search and filter for library directory
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [curriculumFilter, setCurriculumFilter] = useState('ALL');
  const [publisherFilter, setPublisherFilter] = useState<'ALL' | 'KLB' | 'UPLOADED'>('ALL');
  
  // Book uploading fields
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Textbook');
  const [educationLevel, setEducationLevel] = useState('School');
  const [curriculum, setCurriculum] = useState('CBC');
  const [customCurriculum, setCustomCurriculum] = useState('');
  const [location, setLocation] = useState('');
  const [subjects, setSubjects] = useState('');
  const [subjectCategoryOverride, setSubjectCategoryOverride] = useState('auto');
  const [publisher, setPublisher] = useState('');
  const [isbn, setIsbn] = useState('');
  const [isKicdApproved, setIsKicdApproved] = useState(false);
  const [requireEncryptedOffline, setRequireEncryptedOffline] = useState(true);
  const [watermarkUser, setWatermarkUser] = useState(true);
  const [allowRawExport, setAllowRawExport] = useState(false);
  const [rightsConversionAllowed, setRightsConversionAllowed] = useState(true);
  const [coverImage, setCoverImage] = useState('');
  const [isImportingCoverUrl, setIsImportingCoverUrl] = useState(false);
  const [coverUrlError, setCoverUrlError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [b2Status, setB2Status] = useState<{ connected: boolean; bucket: string }>({
    connected: false,
    bucket: 'Edu-AI-Cloud',
  });
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [supabaseProjectRef, setSupabaseProjectRef] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<{
    totalBooks: number;
    supabaseSyncedCount: number;
    b2SyncedCount: number;
    curriculumShelfCount: number;
    needsShelfMigrationCount: number;
    b2ObjectsCount: number;
  } | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [uploadProgressPct, setUploadProgressPct] = useState<number | null>(null);
  const [replacingBookId, setReplacingBookId] = useState<string | null>(null);
  const [replaceProgressPct, setReplaceProgressPct] = useState<number | null>(null);
  const replaceTargetBookRef = useRef<Book | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAdminAuthHeaders = async (extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> => {
    let token: string | undefined;
    try {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) token = data.session.access_token;
      }
    } catch (_) {}
    if (!token) {
      const persisted = getPersistedDeviceSession();
      if (persisted?.access_token && persisted.access_token !== 'demo_token' && persisted.access_token !== 'local_token') {
        token = persisted.access_token;
      }
    }
    return {
      ...extraHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    checkAdminStatus();
    loadBooks();
  }, [devBypass, propUser?.id, propUser?.email]);

  const checkAdminStatus = async () => {
    try {
      let resolvedUser = propUser || null;

      if (!resolvedUser && supabase) {
        const res = await supabase.auth.getUser();
        if (res?.error) {
          if (res.error.message?.includes('Refresh Token') || res.error.message?.includes('refresh_token')) {
            clearStaleSupabaseTokens();
          }
        } else if (res?.data?.user) {
          resolvedUser = res.data.user;
        }
      }

      if (!resolvedUser) {
        const session = getPersistedDeviceSession();
        if (session?.user) {
          resolvedUser = session.user;
        } else if (session?.access_token && session.access_token !== 'demo_token' && session.access_token !== 'local_token') {
          try {
            const authRes = await fetch('/api/auth/user', {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                ...(session.refresh_token ? { 'x-refresh-token': session.refresh_token } : {}),
              },
            });
            if (authRes.ok) {
              const authJson = await authRes.json().catch(() => ({}));
              if (authJson?.user) resolvedUser = authJson.user;
            }
          } catch (_) {}
        }
      }

      const isAuthorizedAdmin = isAdminLoginEmail(resolvedUser?.email);
      setIsAdmin(isAuthorizedAdmin || devBypass);
      if (resolvedUser?.email) {
        setAdminEmail(resolvedUser.email);
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
        const authHeaders = await getAdminAuthHeaders({ 'Cache-Control': 'no-cache' });
        const res = await fetch('/api/books', { headers: authHeaders });
        if (res.ok) {
          const payload = await res.json();
          if (Array.isArray(payload.books)) {
            serverBooks = payload.books;
          }
          if (payload.globalBookCovers && typeof payload.globalBookCovers === 'object') {
            setGlobalBookCovers(payload.globalBookCovers);
          }
          if (Array.isArray(payload.deletedIds)) {
            deletedIds = new Set(payload.deletedIds);
          }
          setB2Status({
            connected: Boolean(payload?.cloudConnected?.b2),
            bucket: payload?.b2Bucket || 'Edu-AI-Cloud',
          });
          setSupabaseConnected(Boolean(payload?.cloudConnected?.supabase));
          setSupabaseProjectRef(payload?.supabaseProjectRef || null);
          if (payload?.syncSummary) {
            setSyncSummary(payload.syncSummary);
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
            dbBooksList = data
              .filter(b => !isSystemBookConfigRow(b))
              .map(b => {
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
                  coverImage: b.cover_image || '',
                  coverMode: b.cover_mode || undefined,
                  pdfCoverPage: b.pdf_cover_page ?? undefined,
                  customCover: b.custom_cover || undefined,
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
          coverImage: cb.coverImageUrl || '',
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
        if (!candidate || !candidate.id || !candidate.title || deletedIds.has(candidate.id) || isSystemBookConfigRow(candidate)) continue;
        const normTitle = `${candidate.title.trim().toLowerCase()}::${(candidate.publisher || candidate.author || '').trim().toLowerCase()}`;
        if (seenIds.has(candidate.id) || seenTitles.has(normTitle)) continue;
        seenIds.add(candidate.id);
        seenTitles.add(normTitle);
        uniqueBooks.push(candidate);
      }

      const mergedBooks = applyGlobalCoversToBooks(uniqueBooks);

      setBooks(mergedBooks);
    } catch (err: any) {
      console.error('Error fetching admin details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const effectiveCurriculum =
    curriculum === '__custom__'
      ? customCurriculum.trim() || 'General'
      : curriculum;

  const parsedSubjectTokens = subjects
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const b2PathPreview = buildB2CurriculumPath({
    curriculum: effectiveCurriculum,
    subjects: parsedSubjectTokens,
    subjectCategoryOverride: subjectCategoryOverride === 'auto' ? undefined : subjectCategoryOverride,
    category,
    level: educationLevel,
    title: title || file?.name,
  });

  const quickSubjectChoices =
    educationLevel === 'University' && COLLEGE_SUBJECTS_MAP[category]
      ? COLLEGE_SUBJECTS_MAP[category]
      : COLLEGE_SUBJECTS_MAP[category] || SCHOOL_SUBJECTS;

  const toggleQuickSubject = (subjectName: string) => {
    const existing = subjects
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = existing.some((s) => s.toLowerCase() === subjectName.toLowerCase());
    const next = exists
      ? existing.filter((s) => s.toLowerCase() !== subjectName.toLowerCase())
      : [...existing, subjectName];
    setSubjects(next.join(', '));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const uploadBookBinaryResilient = async (params: {
    file: File;
    prefix: string;
    curriculum?: string;
    subjects?: string;
    subjectCategory?: string;
    category?: string;
    level?: string;
    title?: string;
    contentType: string;
    onProgress?: (pct: number) => void;
  }) => {
    const { file: targetFile, onProgress } = params;
    if (!targetFile || targetFile.size <= 0) {
      throw new Error('Selected file is empty (0 bytes). Please choose a valid PDF or EPUB file.');
    }

    const DIRECT_THRESHOLD_BYTES = 4 * 1024 * 1024; // 4 MiB
    const CHUNK_SIZE_BYTES = 4 * 1024 * 1024; // 4 MiB (safely under Cloud Run request limits & proxy timeouts)

    if (targetFile.size <= DIRECT_THRESHOLD_BYTES) {
      onProgress?.(20);
      const uploadQuery = new URLSearchParams({
        filename: targetFile.name,
        prefix: params.prefix,
        ...(params.curriculum ? { curriculum: params.curriculum } : {}),
        ...(params.subjects ? { subjects: params.subjects } : {}),
        ...(params.subjectCategory ? { subjectCategory: params.subjectCategory } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.level ? { level: params.level } : {}),
        ...(params.title ? { title: params.title } : {}),
      });
      const uploadRes = await fetch(`/api/upload-direct?${uploadQuery.toString()}`, {
        method: 'POST',
        body: targetFile,
        headers: { 'Content-Type': params.contentType },
      });
      const rawText = await uploadRes.text();
      let json: any = {};
      try {
        json = JSON.parse(rawText);
      } catch {}
      if (!uploadRes.ok) {
        throw new Error(json?.error || `Upload failed (${uploadRes.status}): ${rawText.slice(0, 200)}`);
      }
      if (!json?.key) {
        throw new Error('Upload succeeded without a storage key. Please try again.');
      }
      onProgress?.(100);
      return json;
    }

    // Large file (> 4 MiB): upload cleanly in 4 MiB chunks with retry, then assemble & sync to B2 on server
    const uploadId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const totalChunks = Math.ceil(targetFile.size / CHUNK_SIZE_BYTES);
    for (let idx = 0; idx < totalChunks; idx++) {
      const start = idx * CHUNK_SIZE_BYTES;
      const end = Math.min(targetFile.size, start + CHUNK_SIZE_BYTES);
      const slice = targetFile.slice(start, end);
      let chunkOk = false;
      let lastChunkErr = '';
      for (let attempt = 0; attempt < 2 && !chunkOk; attempt++) {
        try {
          const chunkRes = await fetch(
            `/api/upload-chunk?uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${idx}&totalChunks=${totalChunks}`,
            {
              method: 'POST',
              body: slice,
              headers: { 'Content-Type': 'application/octet-stream' },
            }
          );
          if (chunkRes.ok) {
            chunkOk = true;
          } else {
            const errPayload = await chunkRes.json().catch(() => ({}));
            lastChunkErr = errPayload?.error || `Chunk ${idx + 1}/${totalChunks} upload failed (${chunkRes.status}).`;
          }
        } catch (netErr: any) {
          lastChunkErr = netErr?.message || `Network error uploading chunk ${idx + 1}/${totalChunks}.`;
        }
      }
      if (!chunkOk) {
        throw new Error(lastChunkErr || `Chunk ${idx + 1}/${totalChunks} upload failed.`);
      }
      onProgress?.(Math.min(92, Math.round(((idx + 1) / totalChunks) * 90)));
    }

    onProgress?.(95);
    const completeRes = await fetch('/api/upload-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        totalChunks,
        filename: targetFile.name,
        prefix: params.prefix,
        curriculum: params.curriculum,
        subjects: params.subjects,
        subjectCategory: params.subjectCategory,
        category: params.category,
        level: params.level,
        title: params.title,
        contentType: params.contentType,
      }),
    });
    const completeJson = await completeRes.json().catch(() => ({}));
    if (!completeRes.ok || !completeJson?.key) {
      throw new Error(
        completeJson?.error || `Failed finalizing large textbook upload (${completeRes.status}).`
      );
    }
    onProgress?.(100);
    return completeJson;
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) {
      setErrorMsg('Please supply a title and file to publish.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgressPct(0);
      setErrorMsg('');
      setSuccessMsg('');

      const isEpubFile =
        file.name.toLowerCase().endsWith('.epub') ||
        file.type === 'application/epub+zip';
      const resolvedFormat: 'epub' | 'pdf' = isEpubFile ? 'epub' : 'pdf';

      // 1. Upload EPUB/PDF binary into structured Curriculum Shelf / Subject Category in B2 Edu-AI-Cloud (chunked automatically for >8 MB files)
      const uploadJson = await uploadBookBinaryResilient({
        file,
        prefix: b2PathPreview.prefix,
        curriculum: effectiveCurriculum,
        subjects: parsedSubjectTokens.join(', '),
        subjectCategory: subjectCategoryOverride !== 'auto' ? subjectCategoryOverride : undefined,
        category,
        level: educationLevel,
        title: title.trim(),
        contentType: file.type || (isEpubFile ? 'application/epub+zip' : 'application/pdf'),
        onProgress: (pct) => setUploadProgressPct(pct),
      });

      const {
        key: fileKey,
        bucket: syncedBucket,
        b2Synced,
        curriculumShelf: syncedShelf,
        subjectCategory: syncedSubjCat,
      } = uploadJson;

      const resolvedSubjectsList =
        parsedSubjectTokens.length > 0
          ? parsedSubjectTokens
          : syncedSubjCat
            ? [syncedSubjCat]
            : undefined;

      const finalDescription = location.trim()
        ? `${description}${description ? '\n\n' : ''}Location: ${location.trim()}`
        : description;

      const inferredKlb =
        publisher.toLowerCase().includes('klb') ||
        author.toLowerCase().includes('klb') ||
        title.toLowerCase().includes('klb') ||
        publisher.toLowerCase().includes('kenya literature bureau');

      const resolvedPublisher = publisher.trim() || (inferredKlb ? 'Kenya Literature Bureau (KLB)' : undefined);
      const resolvedAuthor = author.trim() || resolvedPublisher || 'Unknown Author';

      let finalCoverImage = coverImage.trim();
      if (finalCoverImage) {
        const normCover = normalizePastedCoverUrl(finalCoverImage);
        if (!normCover.isValidSyntax) {
          throw new Error(normCover.error || 'Invalid Cover Image URL.');
        }
        finalCoverImage = normCover.url;
        if (normCover.isWebPageHint && /^https?:\/\//i.test(finalCoverImage)) {
          const importRes = await fetch('/api/admin/import-cover-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: finalCoverImage, title: title.trim() }),
          }).catch(() => null);
          if (importRes?.ok) {
            const imported = await importRes.json().catch(() => null);
            if (imported?.url) finalCoverImage = imported.url;
          }
        }
      }

      // 2. Persist book metadata to server catalog (/api/books also syncs with Supabase public.books)
      const catalogHeaders = await getAdminAuthHeaders({ 'Content-Type': 'application/json' });
      const catalogRes = await fetch('/api/books', {
        method: 'POST',
        headers: catalogHeaders,
        body: JSON.stringify({
          title: title.trim(),
          author: resolvedAuthor,
          publisher: resolvedPublisher,
          isbn: isbn.trim() || undefined,
          isKicdApproved: isKicdApproved || inferredKlb,
          description: finalDescription,
          category,
          subjectCategory: syncedSubjCat || b2PathPreview.subjectCategory,
          level: educationLevel,
          curriculum: effectiveCurriculum ? [effectiveCurriculum] : undefined,
          subjects: resolvedSubjectsList,
          country: location.trim() ? [location.trim()] : (inferredKlb ? ['Kenya'] : undefined),
          coverImage: finalCoverImage,
          coverMode: finalCoverImage ? 'image' : undefined,
          fileUrl: fileKey,
          b2Bucket: syncedBucket || b2Status.bucket,
          b2Synced: Boolean(b2Synced),
          format: resolvedFormat,
          rightsConversionAllowed,
          securityPolicy: {
            requireEncryptedOffline,
            watermarkUser,
            allowRawExport,
            offlineLeaseDays: 90,
          },
        }),
      });

      if (!catalogRes.ok) {
        const errText = await catalogRes.text();
        throw new Error(`Failed to register book in catalog: ${errText}`);
      }

      const { book: savedBook, supabaseSynced: serverSupabaseSynced } = await catalogRes.json();
      let isSupabaseConfirmed = Boolean(serverSupabaseSynced);

      // 3. Fallback mirror to client-side Supabase ONLY if server did not already upsert into public.books
      if (!isSupabaseConfirmed && supabase && savedBook?.id?.startsWith('book-')) {
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
                curriculum: effectiveCurriculum || null,
                subjects: resolvedSubjectsList ? resolvedSubjectsList.join(', ') : '',
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
            savedBook.supabaseSynced = true;
            isSupabaseConfirmed = true;
          }
        } catch (sbErr) {
          console.warn('Browser Supabase fallback sync notice:', sbErr);
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

      // 5. Update state immediately in Admin and parent App & refresh sync counters
      setBooks(prev => [savedBook, ...prev.filter(b => b.id !== savedBook.id)]);
      if (onUpdateBook) {
        onUpdateBook(savedBook);
      }
      loadBooks();

      const targetBucketName = syncedBucket || b2Status.bucket;
      const shelfSummary = `${syncedShelf || b2PathPreview.curriculumShelf} / ${syncedSubjCat || b2PathPreview.subjectCategory}`;
      const syncTargets: string[] = [];
      if (b2Synced) syncTargets.push(`B2 ${targetBucketName} [${shelfSummary}]`);
      if (isSupabaseConfirmed) syncTargets.push('Supabase Catalog');
      setSuccessMsg(
        syncTargets.length > 0
          ? `"${savedBook.title}" published & synced to ${syncTargets.join(' + ')} (${fileKey})`
          : `"${savedBook.title}" published under [${shelfSummary}] (${fileKey})`
      );
      setTitle('');
      setAuthor('');
      setDescription('');
      setCategory('Textbook');
      setLocation('');
      setSubjects('');
      setSubjectCategoryOverride('auto');
      setPublisher('');
      setIsbn('');
      setIsKicdApproved(false);
      setCoverImage('');
      setCoverUrlError('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred during publishing procedure.');
    } finally {
      setIsUploading(false);
      setUploadProgressPct(null);
    }
  };

  const handleUploadFormCoverUrlChange = (rawValue: string) => {
    const norm = normalizePastedCoverUrl(rawValue);
    if (!norm.isValidSyntax) {
      setCoverImage(rawValue);
      setCoverUrlError(norm.error || 'Invalid image URL.');
      return;
    }
    setCoverUrlError('');
    setCoverImage(norm.url);
  };

  const handleImportUploadFormCoverUrl = async () => {
    const target = coverImage.trim();
    if (!target || !/^https?:\/\//i.test(target)) return;
    setIsImportingCoverUrl(true);
    setCoverUrlError('');
    try {
      const res = await fetch('/api/admin/import-cover-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target, title: title.trim() || 'cover' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        setCoverUrlError(data?.error || `Failed to import cover image (HTTP ${res.status}).`);
        return;
      }
      setCoverImage(data.url);
    } catch (err: any) {
      setCoverUrlError(err?.message || 'Failed to fetch cover image.');
    } finally {
      setIsImportingCoverUrl(false);
    }
  };

  const handleSaveCoverPage = async (updatedBook: Book) => {
    try {
      const authHeaders = await getAdminAuthHeaders({ 'Content-Type': 'application/json' });
      const authHeaderVal = authHeaders.Authorization || '';
      const token = authHeaderVal.startsWith('Bearer ') ? authHeaderVal.slice(7).trim() : undefined;

      // 1. Update in server catalog + Supabase public.books + global covers registry
      const patchRes = await fetch(`/api/books/${encodeURIComponent(updatedBook.id)}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          title: updatedBook.title,
          coverImage: updatedBook.coverImage || '',
          coverMode: updatedBook.coverMode,
          pdfCoverPage: updatedBook.pdfCoverPage,
          customCover: updatedBook.customCover,
        }),
      });
      if (!patchRes.ok) {
        const errPayload = await patchRes.json().catch(() => ({}));
        throw new Error(errPayload?.error || `Failed to save cover update (HTTP ${patchRes.status})`);
      }

      // 2. Also sync via authenticated PUT /api/book-covers when signed into Supabase
      if (token) {
        try {
          await saveGlobalBookCover(
            updatedBook.id,
            {
              coverMode: updatedBook.coverMode,
              coverImage: updatedBook.coverImage ?? '',
              pdfCoverPage: updatedBook.pdfCoverPage,
              customCover: updatedBook.customCover,
              updatedAt: new Date().toISOString(),
            },
            updatedBook,
            token
          );
        } catch (_) {}
      } else {
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

      // 3. Mirror directly to client Supabase when signed in
      if (supabase && token && !mockBooks.some(m => m.id === updatedBook.id)) {
        try {
          await supabase.from('books').update({
            cover_image: updatedBook.coverImage || ''
          }).eq('id', updatedBook.id);
        } catch (dbErr) {
          console.warn('Supabase DB cover update warning (persisting via server sync):', dbErr);
        }
      }

      // 4. Update local state & notify parent app immediately
      setBooks(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
      if (onUpdateBook) {
        onUpdateBook(updatedBook);
      }

      setSuccessMsg(`Cover page for "${updatedBook.title}" successfully updated! Changes are now live on user screens.`);
    } catch (err: any) {
      console.error('Error saving cover page:', err);
      setErrorMsg(err.message || 'Failed to update cover page.');
      throw err;
    }
  };

  const requestDeleteBook = (id: string) => {
    setDeleteBookId(id);
    setDeleteErrorMsg('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const confirmDeleteBook = async () => {
    if (!deleteBookId || isDeleting) return;
    setIsDeleting(true);
    setDeleteErrorMsg('');

    try {
      const removedId = deleteBookId;
      const targetBook = books.find(b => b.id === removedId);
      const targetFileUrl = String(targetBook?.fileUrl || '').trim();

      // 1. Delete from persistent server catalog (also removes from Supabase public.books, local disk & B2 Edu-AI-Cloud)
      const deleteHeaders = await getAdminAuthHeaders();
      const deleteQuery = targetFileUrl ? `?fileUrl=${encodeURIComponent(targetFileUrl)}` : '';
      const delRes = await fetch(`/api/books/${encodeURIComponent(removedId)}${deleteQuery}`, {
        method: 'DELETE',
        headers: deleteHeaders,
      });
      const delJson = await delRes.json().catch(() => ({}));
      if (!delRes.ok || delJson?.success === false) {
        throw new Error(delJson?.error || `Failed to delete book (${delRes.status}).`);
      }

      // 2. Fallback delete from browser Supabase if server didn't already confirm Supabase deletion
      if (supabase && !delJson?.supabaseDeleted) {
        try {
          await supabase.from('books').delete().eq('id', removedId);
          if (targetFileUrl && (targetFileUrl.startsWith('curriculums/') || targetFileUrl.startsWith('books/') || targetFileUrl.startsWith('uploads/'))) {
            await supabase.from('books').delete().eq('file_url', targetFileUrl);
          }
        } catch (sbErr) {
          console.warn('Supabase delete warning:', sbErr);
        }
      }

      // 3. Remove from browser safeStorage caches (custom_uploaded_books & scoped unlocked books)
      const matchesDeletedBook = (b: any) =>
        b?.id === removedId || (Boolean(targetFileUrl) && String(b?.fileUrl || '').trim() === targetFileUrl);

      try {
        const existingLocal = safeStorage.getJSON<Book[]>('custom_uploaded_books', []);
        if (Array.isArray(existingLocal)) {
          safeStorage.setJSON(
            'custom_uploaded_books',
            existingLocal.filter((b) => !matchesDeletedBook(b))
          );
        }
        const persistedSession = getPersistedDeviceSession();
        const uid = propUser?.id || persistedSession?.user?.id;
        if (uid) {
          const unlockedKey = `edu_ai_unlocked_books_${uid}`;
          const existingUnlocked = safeStorage.getJSON<Book[]>(unlockedKey, []);
          if (Array.isArray(existingUnlocked) && existingUnlocked.length > 0) {
            safeStorage.setJSON(
              unlockedKey,
              existingUnlocked.filter((b) => !matchesDeletedBook(b))
            );
          }
        }
        const localDeletedIds = safeStorage.getJSON<string[]>('edu_ai_deleted_book_ids', []);
        const nextLocalDeleted = new Set(Array.isArray(localDeletedIds) ? localDeletedIds : []);
        nextLocalDeleted.add(removedId);
        if (targetFileUrl) {
          nextLocalDeleted.add(`b2-${targetFileUrl}`);
          nextLocalDeleted.add(`disk-${targetFileUrl}`);
        }
        safeStorage.setJSON('edu_ai_deleted_book_ids', Array.from(nextLocalDeleted));
      } catch (_) {}

      setBooks(prev => prev.filter(b => !matchesDeletedBook(b)));
      if (onDeleteBook) {
        onDeleteBook(removedId, targetFileUrl || undefined);
      }
      setDeleteBookId(null);
      await loadBooks();
      const label = targetBook?.title ? `"${targetBook.title}"` : 'Book';
      setSuccessMsg(
        delJson?.b2Deleted
          ? `${label} deleted from Supabase catalog and Backblaze B2 shelf.`
          : `${label} deleted from library catalog.`
      );
    } catch (err: any) {
      console.error(err);
      setDeleteErrorMsg(err?.message || 'Error occurred during deletion.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSyncB2Supabase = async () => {
    try {
      setIsSyncingCloud(true);
      setErrorMsg('');
      setSuccessMsg('');
      const headers = await getAdminAuthHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/admin/sync-b2-supabase', {
        method: 'POST',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Sync failed (${res.status})`);
      }

      await loadBooks();
      const parts: string[] = [];
      if (data.promotedToB2Shelves > 0) parts.push(`${data.promotedToB2Shelves} organized into B2 Curriculum Shelves`);
      if (data.registeredInSupabase > 0) parts.push(`${data.registeredInSupabase} B2 books registered in Supabase`);
      if (data.alreadyInSync > 0) parts.push(`${data.alreadyInSync} already synchronized`);
      const summaryText = parts.length > 0 ? parts.join(' · ') : 'Catalog & B2 shelves checked';
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        setErrorMsg(`Sync completed with notices (${summaryText}): ${data.errors.slice(0, 3).join('; ')}`);
      } else {
        setSuccessMsg(`Supabase ↔ Backblaze B2 (${b2Status.bucket}) sync complete: ${summaryText}.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to synchronize Supabase and Backblaze B2.');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const triggerReplaceBookFile = (book: Book) => {
    replaceTargetBookRef.current = book;
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = '';
      replaceFileInputRef.current.click();
    }
  };

  const handleReplaceBookFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    const targetBook = replaceTargetBookRef.current;
    if (!selectedFile || !targetBook) return;

    try {
      setReplacingBookId(targetBook.id);
      setReplaceProgressPct(0);
      setErrorMsg('');
      setSuccessMsg('');

      const isEpubFile =
        selectedFile.name.toLowerCase().endsWith('.epub') ||
        selectedFile.type === 'application/epub+zip';
      const resolvedFormat: 'epub' | 'pdf' = isEpubFile ? 'epub' : 'pdf';
      const shelfCurriculum = targetBook.curriculum?.[0] || 'KCSE';
      const targetPath = buildB2CurriculumPath({
        curriculum: shelfCurriculum,
        subjects: targetBook.subjects,
        subjectCategoryOverride: targetBook.subjectCategory,
        category: targetBook.category,
        level: targetBook.level,
        title: targetBook.title,
      });

      const uploadJson = await uploadBookBinaryResilient({
        file: selectedFile,
        prefix: targetPath.prefix,
        curriculum: shelfCurriculum,
        subjects: (targetBook.subjects || []).join(', '),
        subjectCategory: targetPath.subjectCategory,
        category: targetBook.category || 'Textbook',
        level: targetBook.level || 'School',
        title: targetBook.title,
        contentType: selectedFile.type || (isEpubFile ? 'application/epub+zip' : 'application/pdf'),
        onProgress: (pct) => setReplaceProgressPct(pct),
      });

      const patchHeaders = await getAdminAuthHeaders({ 'Content-Type': 'application/json' });
      const patchRes = await fetch(`/api/books/${encodeURIComponent(targetBook.id)}`, {
        method: 'PATCH',
        headers: patchHeaders,
        body: JSON.stringify({
          title: targetBook.title,
          fileUrl: uploadJson.key,
          b2Bucket: uploadJson.bucket || b2Status.bucket,
          subjectCategory: uploadJson.subjectCategory || targetPath.subjectCategory,
          curriculum: targetBook.curriculum || [targetPath.curriculumShelf],
          subjects: targetBook.subjects || [targetPath.subjectCategory],
          format: resolvedFormat,
          b2Synced: Boolean(uploadJson.b2Synced),
        }),
      });
      if (!patchRes.ok) {
        const errText = await patchRes.text();
        throw new Error(`Failed to link file to catalog: ${errText}`);
      }
      const patchJson = await patchRes.json();
      const updatedBook: Book = patchJson?.book
        ? {
            ...targetBook,
            ...patchJson.book,
            fileUrl: uploadJson.key,
            b2Synced: Boolean(uploadJson.b2Synced),
            needsShelfMigration: false,
          }
        : {
            ...targetBook,
            fileUrl: uploadJson.key,
            b2Bucket: uploadJson.bucket,
            b2Synced: Boolean(uploadJson.b2Synced),
            needsShelfMigration: false,
          };

      // Update any cached localStorage book copies so Reader never sees stale avatars/... fileUrl
      try {
        const storedCustom = safeStorage.getJSON<Book[]>('custom_uploaded_books', []);
        if (Array.isArray(storedCustom) && storedCustom.some((b) => b?.id === targetBook.id)) {
          safeStorage.setJSON(
            'custom_uploaded_books',
            storedCustom.map((b) => (b?.id === targetBook.id ? { ...b, ...updatedBook } : b))
          );
        }
      } catch (_) {}

      setBooks(prev => prev.map(b => (b.id === targetBook.id ? updatedBook : b)));
      if (onUpdateBook) {
        onUpdateBook(updatedBook);
      }
      await loadBooks();
      setSuccessMsg(
        `Attached "${selectedFile.name}" to "${targetBook.title}" in B2 ${uploadJson.bucket || b2Status.bucket} (${uploadJson.key}) & synced Supabase.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to attach book file.');
    } finally {
      setReplacingBookId(null);
      setReplaceProgressPct(null);
      replaceTargetBookRef.current = null;
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
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
      b.fileUrl?.startsWith('curriculums/') ||
      b.fileUrl?.startsWith('books/') ||
      b.fileUrl?.startsWith('uploads/')
    );

  const availableCurriculumShelves = Array.from(
    new Set(
      books
        .flatMap((b) => {
          const parsed = parseB2CurriculumKey(b.fileUrl || '');
          return [
            ...(b.curriculum || []),
            ...(parsed.curriculumShelf ? [parsed.curriculumShelf] : []),
          ];
        })
        .map((c) => c.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

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
      (b.subjects && b.subjects.some(s => s.toLowerCase().includes(q))) ||
      (b.subjectCategory && b.subjectCategory.toLowerCase().includes(q)) ||
      (b.fileUrl && b.fileUrl.toLowerCase().includes(q));
    const matchesCategory = categoryFilter === 'All' || b.category === categoryFilter;
    const matchesCurriculum =
      curriculumFilter === 'ALL' ||
      (b.curriculum && b.curriculum.some(c => c.toLowerCase() === curriculumFilter.toLowerCase())) ||
      (b.fileUrl && parseB2CurriculumKey(b.fileUrl).curriculumShelf?.toLowerCase() === curriculumFilter.toLowerCase());
    const matchesPublisher =
      publisherFilter === 'ALL' ||
      (publisherFilter === 'KLB' && isKlbBook(b)) ||
      (publisherFilter === 'UPLOADED' && isUploadedBook(b));
    return matchesSearch && matchesCategory && matchesCurriculum && matchesPublisher;
  });

  if (isAdmin === false && !devBypass) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-16 font-sans text-center bg-white dark:bg-[#1a1a1d] border border-slate-200 dark:border-[#2e2e32] rounded-2xl shadow-xs">
        <h2 className="text-2xl font-bold mb-3 text-slate-900 dark:text-[#ededed]">Admin Access Only</h2>
        <p className="text-slate-500 dark:text-[#a1a1aa] mb-6 text-sm">You must be logged in with {ADMIN_LOGIN_EMAIL}.</p>
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
                    <option value="Revision Guide">Revision Guide</option>
                    <option value="Past Paper">Past Paper</option>
                    <option value="Research Paper">Research Paper</option>
                    <option value="Study Guide">Study Guide</option>
                    <option value="Natural Sciences, Mathematics, and Statistics">Natural Sciences</option>
                    <option value="Information and Communication Technologies (ICT)">ICT & Computing</option>
                    <option value="Engineering, Manufacturing, and Construction">Engineering</option>
                    <option value="Health and Welfare">Health & Medicine</option>
                    <option value="Arts and Humanities">Arts & Humanities</option>
                    <option value="Social Sciences">Social Sciences</option>
                    <option value="Business, Administration, and Law">Business & Law</option>
                    <option value="Agriculture, Forestry, Fisheries, and Veterinary">Agriculture</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Level</label>
                  <select
                    value={educationLevel}
                    onChange={e => {
                      const nextLevel = e.target.value;
                      setEducationLevel(nextLevel);
                      if (nextLevel === 'University' && (curriculum === 'CBC' || curriculum === 'KCSE' || curriculum === 'General')) {
                        setCurriculum('University');
                      } else if (nextLevel === 'School' && (curriculum === 'University' || curriculum === 'General')) {
                        setCurriculum('CBC');
                      }
                    }}
                    className="w-full px-2 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  >
                    <option value="School">School (Primary / High)</option>
                    <option value="University">University / College</option>
                    <option value="All">All Levels</option>
                  </select>
                </div>
              </div>

              {/* Curriculum Shelf & Subject Category Selection */}
              <div className="p-3 rounded-xl bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-[#e4e4e7] flex items-center gap-1.5">
                    <FolderTree className="w-3.5 h-3.5 text-brand-600 dark:text-[#a78bfa]" />
                    Curriculum Shelf &amp; Subjects
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-[#9ca3af]">
                    B2 Shelf Routing
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Curriculum Shelf *</label>
                    <select
                      value={curriculum}
                      onChange={e => setCurriculum(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-[#1a1a1d] text-slate-900 dark:text-[#ededed] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                    >
                      {CURRICULA.filter(c => c !== 'Other').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="University">University</option>
                      <option value="General">General</option>
                      <option value="__custom__">+ Custom Curriculum...</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Subject Category</label>
                    <select
                      value={subjectCategoryOverride}
                      onChange={e => setSubjectCategoryOverride(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-[#1a1a1d] text-slate-900 dark:text-[#ededed] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                    >
                      <option value="auto">Auto ({b2PathPreview.subjectCategory})</option>
                      {CANONICAL_SUBJECT_CATEGORIES.map(sc => (
                        <option key={sc.slug} value={sc.label}>{sc.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {curriculum === '__custom__' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Custom Curriculum Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cambridge O-Level, KNEC TVET"
                      value={customCurriculum}
                      onChange={e => setCustomCurriculum(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#1a1a1d] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">
                    Book Subjects (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chemistry, Organic Chemistry, Titration"
                    value={subjects}
                    onChange={e => setSubjects(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-[#1a1a1d] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {quickSubjectChoices.slice(0, 10).map(subj => {
                      const active = parsedSubjectTokens.some(t => t.toLowerCase() === subj.toLowerCase());
                      return (
                        <button
                          key={subj}
                          type="button"
                          onClick={() => toggleQuickSubject(subj)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors cursor-pointer ${
                            active
                              ? 'bg-brand-600 dark:bg-[#7b5ecc] text-white border-brand-600 dark:border-[#7b5ecc]'
                              : 'bg-white dark:bg-[#1a1a1d] text-slate-600 dark:text-[#c4c4c8] border-slate-200 dark:border-[#34343c] hover:border-brand-400'
                          }`}
                        >
                          {subj}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Publisher</label>
                  <input type="text" placeholder="e.g. KLB, Oxford" value={publisher} onChange={e => setPublisher(e.target.value)} className="w-full px-3 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">Country / Region</label>
                  <input type="text" placeholder="e.g. Kenya, UK" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-3 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">ISBN (Optional)</label>
                  <input type="text" placeholder="e.g. 978-9966..." value={isbn} onChange={e => setIsbn(e.target.value)} className="w-full px-3 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
                <label htmlFor="kicdApproved" className="flex items-center gap-2 py-1.5 text-xs font-medium text-slate-700 dark:text-[#d4d4d8] cursor-pointer">
                  <input 
                    type="checkbox" 
                    id="kicdApproved" 
                    checked={isKicdApproved} 
                    onChange={e => setIsKicdApproved(e.target.checked)}
                    className="rounded border-slate-300 dark:border-[#3f3f46] dark:bg-[#222226] text-teal-600 focus:ring-teal-500"
                  />
                  <span>KICD Approved</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  Cover Image URL (Optional)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="Paste cover image URL or Unsplash link..."
                    value={coverImage}
                    onChange={e => handleUploadFormCoverUrlChange(e.target.value)}
                    onPaste={e => {
                      const pasted = e.clipboardData?.getData('text');
                      if (pasted !== undefined) {
                        e.preventDefault();
                        handleUploadFormCoverUrlChange(pasted);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-[#222226] text-slate-900 dark:text-[#ededed] placeholder:text-slate-400 dark:placeholder:text-[#71717a] border border-slate-200 dark:border-[#34343c] rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  />
                  {/^https?:\/\//i.test(coverImage.trim()) && (
                    <button
                      type="button"
                      onClick={() => void handleImportUploadFormCoverUrl()}
                      disabled={isImportingCoverUrl}
                      title="Fetch & host cover image in Backblaze B2"
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/25 disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                      {isImportingCoverUrl ? 'Fetching...' : 'Host in B2'}
                    </button>
                  )}
                </div>
                {coverUrlError && (
                  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{coverUrlError}</p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c] space-y-2">
                <div className="text-[11px] font-bold text-slate-700 dark:text-[#d4d4d8]">
                  Publisher Security &amp; Offline Policy (Flutter + Web)
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#c4c4c8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireEncryptedOffline}
                    onChange={e => setRequireEncryptedOffline(e.target.checked)}
                    className="rounded border-slate-300 dark:border-[#3f3f46]"
                  />
                  Require AES-256 encrypted offline vault
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#c4c4c8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={watermarkUser}
                    onChange={e => setWatermarkUser(e.target.checked)}
                    className="rounded border-slate-300 dark:border-[#3f3f46]"
                  />
                  Bind offline key to learner account ID
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#c4c4c8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowRawExport}
                    onChange={e => setAllowRawExport(e.target.checked)}
                    className="rounded border-slate-300 dark:border-[#3f3f46]"
                  />
                  Allow unencrypted file export
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#c4c4c8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rightsConversionAllowed}
                    onChange={e => setRightsConversionAllowed(e.target.checked)}
                    className="rounded border-slate-300 dark:border-[#3f3f46]"
                  />
                  Auto-convert PDF to structured EPUB 3 (if licensed)
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-[#c4c4c8] mb-1">
                  File (EPUB Recommended or PDF) *
                </label>
                <div className="border border-dashed border-slate-300 dark:border-[#3f3f46] bg-transparent dark:bg-[#222226]/60 rounded-lg p-3 text-center hover:bg-[#f8f9fb] dark:hover:bg-[#27272c] transition-colors">
                  <input type="file" required ref={fileInputRef} onChange={handleFileChange} accept=".epub,.pdf,application/epub+zip,application/pdf" className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer text-xs font-medium flex flex-col items-center gap-1">
                    <FileText className="w-5 h-5 text-slate-400 dark:text-[#8e8e93]" />
                    <span className="text-brand-600 dark:text-[#a78bfa] hover:text-brand-700 dark:hover:text-[#c4b5fd]">Choose EPUB or PDF File</span>
                    <span className="text-slate-400 dark:text-[#8e8e93] text-[11px] truncate max-w-[200px]">{file ? file.name : 'No file selected'}</span>
                  </label>
                </div>
              </div>

              {/* Live Backblaze B2 Destination Preview */}
              <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-500/30 space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-indigo-800 dark:text-indigo-200 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 shrink-0" />
                    B2 {b2Status.bucket} Path
                  </span>
                  <span className={`font-semibold text-[10px] ${b2Status.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {b2Status.connected ? 'Cloud Connected' : 'Local Disk Mode'}
                  </span>
                </div>
                <div className="font-mono text-[10px] text-indigo-950 dark:text-indigo-100 break-all leading-relaxed">
                  {b2PathPreview.prefix}/{file ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_') : '<file>'}
                </div>
              </div>

              <button disabled={isUploading} type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-700 dark:bg-[#7b5ecc] dark:hover:bg-[#684db8] text-white rounded-lg font-bold transition-colors disabled:opacity-50 text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer">
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {isUploading
                  ? `Uploading to B2 Shelf${uploadProgressPct !== null ? ` (${uploadProgressPct}%)` : '...'}`
                  : 'Publish Material'}
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
                  <p className="text-xs text-slate-400 dark:text-[#9ca3af]">Edit cover pages, inspect B2 Curriculum Shelves, and synchronize Supabase metadata.</p>
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

            {/* Inline feedback right inside directory so scrolled table actions never miss errors/success */}
            {(errorMsg || successMsg) && (
              <div
                className={`mb-3.5 p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                  errorMsg
                    ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-500/30'
                    : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-500/30'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {errorMsg ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <span className="font-medium truncate">{errorMsg || successMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-[11px] font-bold opacity-80 hover:opacity-100 shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Supabase <-> Backblaze B2 Hand-in-Hand Sync Status Bar */}
            <div className="mb-4 p-3 rounded-xl bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-[#e4e4e7]">
                  <Database className={`w-3.5 h-3.5 ${supabaseConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`} />
                  <span>Supabase{supabaseProjectRef ? ` (${supabaseProjectRef})` : ''}:</span>
                  <span className={supabaseConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                    {supabaseConnected ? `${syncSummary?.supabaseSyncedCount ?? 0} linked` : 'Offline'}
                  </span>
                </div>
                <span className="text-slate-300 dark:text-[#3f3f46]" aria-hidden="true">|</span>
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-[#e4e4e7]">
                  <Cloud className={`w-3.5 h-3.5 ${b2Status.connected ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-500'}`} />
                  <span>B2 {b2Status.bucket}:</span>
                  <span className={b2Status.connected ? 'text-indigo-600 dark:text-indigo-300' : 'text-amber-600 dark:text-amber-400'}>
                    {b2Status.connected ? `${syncSummary?.b2SyncedCount ?? 0} in shelves (${syncSummary?.b2ObjectsCount ?? 0} objects)` : 'Local Disk'}
                  </span>
                </div>
                {syncSummary && syncSummary.needsShelfMigrationCount > 0 && (
                  <>
                    <span className="text-slate-300 dark:text-[#3f3f46]" aria-hidden="true">|</span>
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                      {syncSummary.needsShelfMigrationCount} legacy path{syncSummary.needsShelfMigrationCount === 1 ? '' : 's'} ready for shelf sync
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={handleSyncB2Supabase}
                disabled={isSyncingCloud || !b2Status.connected || !supabaseConnected}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-[#7b5ecc] dark:hover:bg-[#684db8] text-white transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                title="Reconcile Supabase book records with Backblaze B2 Curriculum Shelves"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                {isSyncingCloud ? 'Syncing Shelves...' : 'Sync & Organize Shelves'}
              </button>
            </div>

            {/* Quick Publisher, Curriculum Shelf & Upload Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex flex-wrap items-center gap-2">
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

              <div className="flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-slate-400 dark:text-[#8e8e93]" />
                <select
                  value={curriculumFilter}
                  onChange={(e) => setCurriculumFilter(e.target.value)}
                  aria-label="Filter by Curriculum Shelf"
                  className="px-2.5 py-1 text-xs font-medium bg-[#f8f9fb] dark:bg-[#222226] text-slate-700 dark:text-[#ededed] border border-slate-200 dark:border-[#34343c] rounded-lg outline-none focus:border-brand-500"
                >
                  <option value="ALL">All Curriculum Shelves</option>
                  {availableCurriculumShelves.map((shelf) => (
                    <option key={shelf} value={shelf}>{shelf} Shelf</option>
                  ))}
                </select>
              </div>
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

                          {/* Book Title, Author & B2 Shelf */}
                          <td className="px-3 py-3">
                            <div className="font-bold text-slate-900 dark:text-[#ededed] line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-[#b8a5f0] transition-colors">
                              {b.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-[#a1a1aa] truncate max-w-[240px]">
                              {b.publisher || b.author || 'Unknown Author'}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 dark:text-[#a1a1aa]">
                              <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                {(b.format === 'epub' || String(b.fileUrl || '').toLowerCase().endsWith('.epub')) ? 'EPUB · Reflowable' : 'PDF'}
                              </span>
                              {b.curriculum && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono font-semibold">{b.curriculum.join(', ')}</span>
                                </>
                              )}
                              {b.isKicdApproved && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    KICD
                                  </span>
                                </>
                              )}
                            </div>
                            {b.fileUrl?.startsWith('curriculums/') ? (
                              <div className="mt-1 font-mono text-[10px] text-indigo-600 dark:text-indigo-300 truncate max-w-[260px]" title={b.fileUrl}>
                                B2: {b.fileUrl}
                              </div>
                            ) : b.fileUrl ? (
                              <div className="mt-1 font-mono text-[10px] text-amber-600 dark:text-amber-300 truncate max-w-[260px]" title={b.fileUrl}>
                                Legacy Path: {b.fileUrl}
                              </div>
                            ) : null}
                            {(b.supabaseSynced || b.b2Synced || b.needsShelfMigration || b.processingStatus || b.epubPublished) && (
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] font-medium">
                                {b.supabaseSynced && (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                    <Database className="w-2.5 h-2.5" />
                                    Supabase DB
                                  </span>
                                )}
                                {b.b2Synced ? (
                                  <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-300">
                                    <Cloud className="w-2.5 h-2.5" />
                                    B2 Stored
                                  </span>
                                ) : b.needsShelfMigration ? (
                                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
                                    <Cloud className="w-2.5 h-2.5" />
                                    Needs B2 Sync
                                  </span>
                                ) : null}
                                {b.epubPublished ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    EPUB 3 Published{b.conversionQualityScore ? ` (${b.conversionQualityScore}%)` : ''}
                                  </span>
                                ) : b.processingStatus === 'queued' || b.processingStatus === 'processing' ? (
                                  <span className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-300">
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                    Converting EPUB 3…
                                  </span>
                                ) : b.processingStatus === 'needs_review' ? (
                                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300 font-semibold">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    TOC Needs Review
                                  </span>
                                ) : b.processingStatus === 'failed' ? (
                                  <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    Conversion Failed (PDF Active)
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </td>

                          {/* Category, Subject & Level */}
                          <td className="px-3 py-3">
                            <span className="bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-[#c4b5fd] px-2 py-0.5 rounded text-[11px] font-medium block truncate max-w-[160px] border border-transparent dark:border-brand-500/25">
                              {b.subjectCategory || b.subjects?.[0] || b.category}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-[#8e8e93] block mt-0.5 truncate max-w-[160px]">
                              {b.subjects && b.subjects.length > 0 ? b.subjects.join(', ') : (b.level || 'All Levels')}
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
                              {/* Attach / Re-upload Source PDF or EPUB directly to this book's B2 Shelf */}
                              <button
                                type="button"
                                onClick={() => triggerReplaceBookFile(b)}
                                disabled={replacingBookId === b.id}
                                className={`px-2.5 py-1.5 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-xs border cursor-pointer disabled:opacity-50 ${
                                  b.needsShelfMigration || !b.b2Synced
                                    ? 'bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/35'
                                    : 'bg-[#f8f9fb] dark:bg-[#222226] hover:bg-slate-100 dark:hover:bg-[#2a2a30] text-slate-700 dark:text-[#d4d4d8] border-slate-200 dark:border-[#34343c]'
                                }`}
                                title={b.needsShelfMigration || !b.b2Synced ? 'Missing or un-synced binary: click to attach real PDF/EPUB' : 'Replace PDF/EPUB file'}
                              >
                                {replacingBookId === b.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {replacingBookId === b.id
                                    ? replaceProgressPct !== null
                                      ? `Uploading ${replaceProgressPct}%`
                                      : 'Uploading...'
                                    : b.needsShelfMigration || !b.b2Synced
                                      ? 'Attach PDF'
                                      : 'Replace File'}
                                </span>
                              </button>

                              {/* Inspect Conversion / Edit Canonical TOC & Publish EPUB 3 */}
                              <button
                                type="button"
                                onClick={() => setConversionModalBook(b)}
                                className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-xs border border-indigo-200 dark:border-indigo-500/30 cursor-pointer whitespace-nowrap"
                                title="Inspect PDF-to-EPUB 3 conversion status, quality report, and edit Table of Contents"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>EPUB / TOC</span>
                              </button>

                              {/* Edit Cover Action Button */}
                              <button
                                type="button"
                                onClick={() => setEditingCoverBook(b)}
                                className="px-2.5 py-1.5 bg-brand-50 dark:bg-[#252236] hover:bg-brand-100 dark:hover:bg-[#312c48] text-brand-700 dark:text-[#c4b5fd] font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-xs border border-brand-200 dark:border-brand-500/30 cursor-pointer whitespace-nowrap"
                                title="Edit Cover Page"
                              >
                                <Palette className="w-3.5 h-3.5" />
                                <span>Edit Cover</span>
                              </button>

                              <button 
                                type="button"
                                onClick={() => requestDeleteBook(b.id)} 
                                className="text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-lg transition-colors cursor-pointer"
                                title="Delete Book"
                                aria-label={`Delete ${b.title}`}
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

      {/* PDF-to-EPUB 3 Conversion & Canonical TOC Editor Modal */}
      {conversionModalBook && (
        <BookConversionModal
          book={conversionModalBook}
          isOpen={true}
          onClose={() => setConversionModalBook(null)}
          getAdminAuthHeaders={getAdminAuthHeaders}
          onUpdated={() => {
            void loadBooks();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteBookId && (() => {
        const targetDeleteBook = books.find(b => b.id === deleteBookId);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white dark:bg-[#1a1a1d] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-[#2e2e32]">
              <div className="p-6">
                <h3 className="text-base font-bold text-slate-900 dark:text-[#ededed] mb-1.5">Confirm Deletion</h3>
                <p className="text-xs text-slate-500 dark:text-[#a1a1aa] mb-4">
                  Are you sure you want to permanently remove{' '}
                  <span className="font-semibold text-slate-800 dark:text-[#ededed]">
                    {targetDeleteBook ? `"${targetDeleteBook.title}"` : 'this book'}
                  </span>
                  {' '}from the library catalog{targetDeleteBook?.b2Synced ? ' and Backblaze B2 shelf' : ''}?
                </p>

                {targetDeleteBook?.fileUrl && (
                  <div className="mb-4 px-2.5 py-1.5 rounded-lg bg-[#f8f9fb] dark:bg-[#222226] border border-slate-200 dark:border-[#34343c] font-mono text-[10px] text-slate-500 dark:text-[#a1a1aa] truncate" title={targetDeleteBook.fileUrl}>
                    {targetDeleteBook.fileUrl}
                  </div>
                )}
                
                {deleteErrorMsg && (
                  <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs rounded-lg border border-rose-200 dark:border-rose-500/30">
                    {deleteErrorMsg}
                  </div>
                )}

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeleteBookId(null)}
                    className="flex-1 py-2 px-3 border border-slate-200 dark:border-[#34343c] text-slate-600 dark:text-[#c4c4c8] rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#222226] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteBook}
                    disabled={isDeleting}
                    className="flex-1 py-2 px-3 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Hidden file picker for attaching/replacing PDF/EPUB on an existing catalog row */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept=".epub,.pdf,application/epub+zip,application/pdf"
        onChange={handleReplaceBookFileSelected}
        className="hidden"
      />

    </div>
  );
}
