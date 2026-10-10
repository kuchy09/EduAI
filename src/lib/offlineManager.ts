// Edu AI - High-Performance IndexedDB Storage & Local Sync Layer
import { Book, Bookmark, Highlight } from '../types';
import { supabase } from './supabase';
import { safeStorage } from './safeStorage';

const DB_NAME = 'EduAiOfflineDB';
const DB_VERSION = 2;

export interface CachedBookMeta extends Book {
  cachedAt: number;
  fileSizeBytes: number;
  fileSizeFormatted?: string;
  isOfflineAvailable: boolean;
  coverDataUrl?: string;
}

export interface ReadingProgressRecord {
  bookId: string;
  progress: number; // 0 to 100
  currentPage?: number;
  totalPages?: number;
  scrollPct?: number;
  lastReadAt: number;
  updatedAt: number;
}

export interface BookContentChapter {
  chapterNumber: number;
  title: string;
  content: string;
  subsections?: string[];
}

export interface BookContentRecord {
  bookId: string;
  title?: string;
  author?: string;
  category?: string;
  chapters?: BookContentChapter[];
  fullText?: string;
  summary?: string;
  keyConcepts?: string[];
  updatedAt: number;
}

export interface OfflineSyncItem {
  id: string;
  type: 'bookmark' | 'highlight' | 'progress' | 'note';
  payload: any;
  timestamp: number;
}

export interface OfflineStorageStats {
  count: number;
  totalSizeBytes: number;
  formattedSize: string;
  progressCount: number;
  highlightsCount: number;
  bookmarksCount: number;
  contentCount: number;
  quotaEstimatedBytes?: number;
  quotaUsagePercent?: number;
}

/**
 * Open or initialize IndexedDB with structured object stores
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('IndexedDB open request timed out.'));
      }
    }, 1800);

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      clearTimeout(timer);
      settled = true;
      return reject(e);
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Books Metadata Store
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' });
      }

      // 2. Binary PDF / Document Blobs Store
      if (!db.objectStoreNames.contains('book_blobs')) {
        db.createObjectStore('book_blobs', { keyPath: 'bookId' });
      }

      // 3. Book Text & Chapter Content Cache Store
      if (!db.objectStoreNames.contains('book_content')) {
        db.createObjectStore('book_content', { keyPath: 'bookId' });
      }

      // 4. Reading Progress Store
      if (!db.objectStoreNames.contains('reading_progress')) {
        const progressStore = db.createObjectStore('reading_progress', { keyPath: 'bookId' });
        progressStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        progressStore.createIndex('progress', 'progress', { unique: false });
      }

      // 5. Offline Highlights Store
      if (!db.objectStoreNames.contains('offline_highlights')) {
        const hlStore = db.createObjectStore('offline_highlights', { keyPath: 'id' });
        hlStore.createIndex('bookId', 'bookId', { unique: false });
      }

      // 6. Offline Bookmarks Store
      if (!db.objectStoreNames.contains('offline_bookmarks')) {
        const bmStore = db.createObjectStore('offline_bookmarks', { keyPath: 'id' });
        bmStore.createIndex('bookId', 'bookId', { unique: false });
      }

      // 7. Offline Sync Action Queue Store
      if (!db.objectStoreNames.contains('offline_sync_queue')) {
        const queueStore = db.createObjectStore('offline_sync_queue', { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(request.result);
      }
    };
    request.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(request.error);
      }
    };
    request.onblocked = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error('IndexedDB open request blocked.'));
      }
    };
  });
}

/**
 * Register Service Worker for offline shell and asset caching
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // In development, preview frames, or iframes, never register service workers to prevent navigation and storage interception loops
  if (
    typeof window === 'undefined' || 
    !('serviceWorker' in navigator) ||
    window.location.hostname.includes('run.app') ||
    window.location.hostname.includes('localhost') ||
    window.self !== window.top
  ) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[Edu AI] Service Worker successfully registered:', registration.scope);
    return registration;
  } catch (error) {
    console.warn('[Edu AI] Service Worker registration failed (normal in some sandboxes):', error);
    return null;
  }
}

/**
 * Check if current browser/app has active network connectivity
 */
export function isAppOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// -------------------------------------------------------------
// Reading Progress Local IndexedDB API
// -------------------------------------------------------------

/**
 * Save reading progress for a book directly into IndexedDB
 */
export async function saveReadingProgressLocal(
  bookId: string,
  progress: number,
  currentPage?: number,
  totalPages?: number,
  scrollPct?: number
): Promise<void> {
  if (!bookId) return;

  const now = Date.now();
  const boundedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  const record: ReadingProgressRecord = {
    bookId,
    progress: boundedProgress,
    currentPage: currentPage || undefined,
    totalPages: totalPages || undefined,
    scrollPct: typeof scrollPct === 'number' ? Math.round(scrollPct) : undefined,
    lastReadAt: now,
    updatedAt: now
  };

  // 1. Write to IndexedDB
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('reading_progress', 'readwrite');
      tx.objectStore('reading_progress').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[Edu AI IDB] Could not save progress to IndexedDB:', err);
  }

  // 2. Mirror to safeStorage as instant sync fallback
  try {
    safeStorage.setItem(`book_progress_${bookId}`, boundedProgress.toString());
    if (currentPage) {
      safeStorage.setItem(`book_page_${bookId}`, currentPage.toString());
    }
  } catch {
    // Ignore storage quota limits on safeStorage
  }

  // 3. Cloud synchronization
  if (!isAppOnline()) {
    queueOfflineAction('progress', {
      bookId,
      progress: boundedProgress,
      currentPage,
      totalPages
    });
  } else if (supabase) {
    // Push directly to Supabase reading_progress table
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) return;
        const userId = data?.user?.id;
        if (userId) {
          const { error } = await supabase
            .from('reading_progress')
            .upsert({
              user_id: userId,
              book_id: bookId,
              progress: boundedProgress,
              current_page: currentPage || null,
              total_pages: totalPages || null,
              scroll_pct: typeof scrollPct === 'number' ? Math.round(scrollPct) : null,
              last_read_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,book_id'
            });
          if (error) console.warn('[offlineManager] Cloud progress sync notice:', error.message);
        }
      } catch (e) {
        console.warn('[offlineManager] Cloud progress sync error:', e);
      }
    })();
  }

  // 4. Dispatch notification event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('edu-ai-progress-updated', {
        detail: record
      })
    );
  }
}

/**
 * Get reading progress for a specific book from IndexedDB
 */
export async function getReadingProgressLocal(bookId: string): Promise<ReadingProgressRecord | null> {
  if (!bookId) return null;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('reading_progress', 'readonly');
      const store = tx.objectStore('reading_progress');
      const request = store.get(bookId);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result as ReadingProgressRecord);
        } else {
          // Fallback to safeStorage
          const savedProgress = safeStorage.getItem(`book_progress_${bookId}`);
          const savedPage = safeStorage.getItem(`book_page_${bookId}`);
          if (savedProgress !== null) {
            resolve({
              bookId,
              progress: parseInt(savedProgress, 10) || 0,
              currentPage: savedPage ? parseInt(savedPage, 10) : undefined,
              lastReadAt: Date.now(),
              updatedAt: Date.now()
            });
          } else {
            resolve(null);
          }
        }
      };

      request.onerror = () => {
        // Fallback on error
        const savedProgress = safeStorage.getItem(`book_progress_${bookId}`);
        if (savedProgress !== null) {
          resolve({
            bookId,
            progress: parseInt(savedProgress, 10) || 0,
            lastReadAt: Date.now(),
            updatedAt: Date.now()
          });
        } else {
          resolve(null);
        }
      };
    });
  } catch {
    const savedProgress = safeStorage.getItem(`book_progress_${bookId}`);
    if (savedProgress !== null) {
      return {
        bookId,
        progress: parseInt(savedProgress, 10) || 0,
        lastReadAt: Date.now(),
        updatedAt: Date.now()
      };
    }
    return null;
  }
}

/**
 * Retrieve all reading progress entries from IndexedDB for library rendering
 */
export async function getAllReadingProgressLocal(): Promise<Record<string, ReadingProgressRecord>> {
  const result: Record<string, ReadingProgressRecord> = {};

  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction('reading_progress', 'readonly');
      const store = tx.objectStore('reading_progress');
      const request = store.getAll();

      request.onsuccess = () => {
        const records = (request.result || []) as ReadingProgressRecord[];
        records.forEach((rec) => {
          if (rec.bookId) {
            result[rec.bookId] = rec;
          }
        });
        resolve();
      };

      request.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[Edu AI IDB] Failed to load all reading progress from IndexedDB:', err);
  }

  // Augment with localStorage keys if any exist
  if (typeof window !== 'undefined') {
    try {
      const ls = (function() { try { return window.localStorage; } catch (_) { return null; } })();
      if (ls) {
        for (let i = 0; i < ls.length; i++) {
          const key = ls.key(i);
          if (key && key.startsWith('book_progress_')) {
            const bookId = key.replace('book_progress_', '');
            if (!result[bookId]) {
              const val = parseInt(ls.getItem(key) || '0', 10);
              result[bookId] = {
                bookId,
                progress: val,
                lastReadAt: Date.now(),
                updatedAt: Date.now()
              };
            }
          }
        }
      }
    } catch (_) {}
  }

  return result;
}

/**
 * Remove reading progress for a book
 */
export async function deleteReadingProgressLocal(bookId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction('reading_progress', 'readwrite');
      tx.objectStore('reading_progress').delete(bookId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }

  try {
    safeStorage.removeItem(`book_progress_${bookId}`);
    safeStorage.removeItem(`book_page_${bookId}`);
  } catch {
    // Ignore
  }
}

// -------------------------------------------------------------
// Book Content & Chapter Cache Local IndexedDB API
// -------------------------------------------------------------

/**
 * Save text content, chapters, or syllabus sections into IndexedDB
 */
export async function saveBookContentLocal(
  bookId: string,
  data: Partial<BookContentRecord>
): Promise<void> {
  if (!bookId) return;

  try {
    const db = await openDB();
    const existing = (await getBookContentLocal(bookId)) || { bookId, updatedAt: Date.now() };

    const record: BookContentRecord = {
      ...existing,
      ...data,
      bookId,
      updatedAt: Date.now()
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('book_content', 'readwrite');
      tx.objectStore('book_content').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[Edu AI IDB] Failed to cache book content in IndexedDB:', err);
  }
}

/**
 * Retrieve cached book text content or chapters from IndexedDB
 */
export async function getBookContentLocal(bookId: string): Promise<BookContentRecord | null> {
  if (!bookId) return null;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('book_content', 'readonly');
      const store = tx.objectStore('book_content');
      const request = store.get(bookId);

      request.onsuccess = () => {
        resolve((request.result as BookContentRecord) || null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Highlights & Bookmarks Local IndexedDB API
// -------------------------------------------------------------

/**
 * Save a highlight passage into IndexedDB
 */
export async function saveHighlightLocal(highlight: Highlight): Promise<void> {
  if (!highlight || !highlight.id) return;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('offline_highlights', 'readwrite');
      tx.objectStore('offline_highlights').put(highlight);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[Edu AI IDB] Failed to save highlight to IndexedDB:', err);
  }

  // Fallback to safeStorage cache
  try {
    const key = `edu_highlights_${highlight.bookId}`;
    const raw = safeStorage.getItem(key);
    const list: Highlight[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((h) => h.id === highlight.id);
    if (idx >= 0) {
      list[idx] = highlight;
    } else {
      list.push(highlight);
    }
    safeStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Ignore
  }

  if (!isAppOnline()) {
    queueOfflineAction('highlight', highlight);
  }
}

/**
 * Get all highlights or highlights for a specific book from IndexedDB
 */
export async function getHighlightsLocal(bookId?: string): Promise<Highlight[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('offline_highlights', 'readonly');
      const store = tx.objectStore('offline_highlights');
      
      let request: IDBRequest;
      if (bookId && store.indexNames.contains('bookId')) {
        const index = store.index('bookId');
        request = index.getAll(bookId);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        const res = (request.result || []) as Highlight[];
        if (bookId && !store.indexNames.contains('bookId')) {
          resolve(res.filter((h) => h.bookId === bookId));
        } else {
          resolve(res);
        }
      };
      request.onerror = () => {
        // Fallback to safeStorage
        if (bookId) {
          try {
            const raw = safeStorage.getItem(`edu_highlights_${bookId}`);
            resolve(raw ? JSON.parse(raw) : []);
          } catch {
            resolve([]);
          }
        } else {
          resolve([]);
        }
      };
    });
  } catch {
    if (bookId) {
      try {
        const raw = safeStorage.getItem(`edu_highlights_${bookId}`);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

/**
 * Delete a highlight from IndexedDB
 */
export async function deleteHighlightLocal(id: string, bookId?: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction('offline_highlights', 'readwrite');
      tx.objectStore('offline_highlights').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }

  if (bookId) {
    try {
      const key = `edu_highlights_${bookId}`;
      const raw = safeStorage.getItem(key);
      if (raw) {
        const list: Highlight[] = JSON.parse(raw);
        safeStorage.setItem(key, JSON.stringify(list.filter((h) => h.id !== id)));
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Save a bookmark into IndexedDB
 */
export async function saveBookmarkLocal(bookmark: Bookmark): Promise<void> {
  if (!bookmark || !bookmark.id) return;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('offline_bookmarks', 'readwrite');
      tx.objectStore('offline_bookmarks').put(bookmark);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[Edu AI IDB] Failed to save bookmark to IndexedDB:', err);
  }

  if (!isAppOnline()) {
    queueOfflineAction('bookmark', bookmark);
  }
}

/**
 * Get all bookmarks or bookmarks for a specific book from IndexedDB
 */
export async function getBookmarksLocal(bookId?: string): Promise<Bookmark[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('offline_bookmarks', 'readonly');
      const store = tx.objectStore('offline_bookmarks');

      let request: IDBRequest;
      if (bookId && store.indexNames.contains('bookId')) {
        const index = store.index('bookId');
        request = index.getAll(bookId);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        const res = (request.result || []) as Bookmark[];
        if (bookId && !store.indexNames.contains('bookId')) {
          resolve(res.filter((b) => b.bookId === bookId));
        } else {
          resolve(res);
        }
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Delete a bookmark from IndexedDB
 */
export async function deleteBookmarkLocal(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction('offline_bookmarks', 'readwrite');
      tx.objectStore('offline_bookmarks').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

// -------------------------------------------------------------
// Offline Book Documents & Blob Caching API
// -------------------------------------------------------------

/**
 * Check if a specific book is cached locally in IndexedDB
 */
export async function isBookCached(bookId: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('books', 'readonly');
      const store = tx.objectStore('books');
      const request = store.get(bookId);
      request.onsuccess = () => {
        resolve(!!request.result && request.result.isOfflineAvailable === true);
      };
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Get all cached books from IndexedDB
 */
export async function getAllCachedBooks(): Promise<CachedBookMeta[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('books', 'readonly');
      const store = tx.objectStore('books');
      const request = store.getAll();
      request.onsuccess = () => {
        const raw = (request.result || []) as CachedBookMeta[];
        const mapped = raw.map((item) => {
          let formatted = '0 KB';
          const size = item.fileSizeBytes || 0;
          if (size > 1024 * 1024 * 1024) {
            formatted = `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
          } else if (size > 1024 * 1024) {
            formatted = `${(size / (1024 * 1024)).toFixed(1)} MB`;
          } else if (size > 0) {
            formatted = `${Math.round(size / 1024)} KB`;
          }
          return {
            ...item,
            fileSizeFormatted: formatted
          };
        });
        resolve(mapped);
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Get set of cached book IDs for instant UI lookups
 */
export async function getCachedBookIds(): Promise<Set<string>> {
  const cachedBooks = await getAllCachedBooks();
  return new Set(cachedBooks.map((b) => b.id));
}

/**
 * Download a book (PDF document, cover image, and metadata) and store in IndexedDB
 */
export async function downloadBookForOffline(
  book: Book,
  onProgress?: (percent: number) => void
): Promise<boolean> {
  try {
    if (onProgress) onProgress(5);

    // 1. Determine download URL
    const fileKey = book.fileUrl || book.id;
    const downloadUrl =
      book.fileUrl && book.fileUrl.startsWith('http')
        ? book.fileUrl
        : `/api/download?key=${encodeURIComponent(fileKey)}`;

    // 2. Fetch the document with streaming progress
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Download failed with HTTP status ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    let receivedBytes = 0;

    let blob: Blob;

    if (response.body && totalBytes > 0) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          if (onProgress && totalBytes > 0) {
            const pct = Math.min(90, Math.round(10 + (receivedBytes / totalBytes) * 75));
            onProgress(pct);
          }
        }
      }

      blob = new Blob(chunks, { type: 'application/pdf' });
    } else {
      if (onProgress) onProgress(50);
      blob = await response.blob();
    }

    if (onProgress) onProgress(92);

    // 3. Cache Cover Image as Data URL if possible
    let coverDataUrl = book.coverImage;
    try {
      if (book.coverImage && book.coverImage.startsWith('http')) {
        const imgRes = await fetch(book.coverImage, { mode: 'cors' }).catch(() => null);
        if (imgRes && imgRes.ok) {
          const imgBlob = await imgRes.blob();
          coverDataUrl = await new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result as string);
            reader.onerror = () => res(book.coverImage);
            reader.readAsDataURL(imgBlob);
          });
        }
      }
    } catch {
      // Ignore image cache failure non-blockingly
    }

    // 4. Save into IndexedDB
    const db = await openDB();

    const cachedMeta: CachedBookMeta = {
      ...book,
      cachedAt: Date.now(),
      fileSizeBytes: blob.size || totalBytes || 1024 * 500,
      isOfflineAvailable: true,
      coverDataUrl
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['books', 'book_blobs', 'book_content'], 'readwrite');

      tx.objectStore('books').put(cachedMeta);
      tx.objectStore('book_blobs').put({
        bookId: book.id,
        blob,
        mimeType: blob.type || 'application/pdf',
        size: blob.size,
        updatedAt: Date.now()
      });

      // Pre-seed book content store
      tx.objectStore('book_content').put({
        bookId: book.id,
        title: book.title,
        author: book.author,
        category: book.category,
        keyConcepts: book.aiInsights || [],
        summary: book.description,
        updatedAt: Date.now()
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // 5. Send message to Service Worker to cache in CacheStorage as well
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_BOOK_PDF',
        url: downloadUrl,
        bookId: book.id
      });
    }

    if (onProgress) onProgress(100);

    // Trigger global event
    window.dispatchEvent(
      new CustomEvent('edu-ai-offline-changed', {
        detail: { bookId: book.id, action: 'added' }
      })
    );
    return true;
  } catch (error) {
    console.error('[Edu AI] Failed to download book for offline reading:', error);
    throw error;
  }
}

/**
 * Retrieve cached blob URL for reader document
 */
export async function getCachedBookBlobUrl(bookId: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('book_blobs', 'readonly');
      const store = tx.objectStore('book_blobs');
      const request = store.get(bookId);

      request.onsuccess = () => {
        if (request.result && request.result.blob) {
          const blob = request.result.blob as Blob;
          const objectUrl = URL.createObjectURL(blob);
          resolve(objectUrl);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Delete a book from local offline storage
 */
export async function removeBookFromOffline(bookId: string): Promise<boolean> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ['books', 'book_blobs', 'book_content'],
        'readwrite'
      );
      tx.objectStore('books').delete(bookId);
      tx.objectStore('book_blobs').delete(bookId);
      tx.objectStore('book_content').delete(bookId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    window.dispatchEvent(
      new CustomEvent('edu-ai-offline-changed', {
        detail: { bookId, action: 'removed' }
      })
    );
    return true;
  } catch (error) {
    console.error('[Edu AI] Failed to remove cached book:', error);
    return false;
  }
}

/**
 * Clear all offline books from cache
 */
export async function clearAllOfflineCache(): Promise<boolean> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ['books', 'book_blobs', 'book_content', 'offline_sync_queue'],
        'readwrite'
      );
      tx.objectStore('books').clear();
      tx.objectStore('book_blobs').clear();
      tx.objectStore('book_content').clear();
      tx.objectStore('offline_sync_queue').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_OFFLINE_CACHE' });
    }

    window.dispatchEvent(
      new CustomEvent('edu-ai-offline-changed', {
        detail: { action: 'cleared' }
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Storage statistics for downloaded books, progress, highlights, and quota
 */
export async function getOfflineStorageStats(): Promise<OfflineStorageStats> {
  let count = 0;
  let totalSizeBytes = 0;
  let progressCount = 0;
  let highlightsCount = 0;
  let bookmarksCount = 0;
  let contentCount = 0;

  try {
    const db = await openDB();

    // 1. Get cached books
    const books = await getAllCachedBooks();
    count = books.length;
    totalSizeBytes = books.reduce((acc, b) => acc + (b.fileSizeBytes || 0), 0);

    // 2. Count progress records
    progressCount = await new Promise<number>((resolve) => {
      const tx = db.transaction('reading_progress', 'readonly');
      const req = tx.objectStore('reading_progress').count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });

    // 3. Count highlights
    highlightsCount = await new Promise<number>((resolve) => {
      const tx = db.transaction('offline_highlights', 'readonly');
      const req = tx.objectStore('offline_highlights').count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });

    // 4. Count bookmarks
    bookmarksCount = await new Promise<number>((resolve) => {
      const tx = db.transaction('offline_bookmarks', 'readonly');
      const req = tx.objectStore('offline_bookmarks').count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });

    // 5. Count cached content items
    contentCount = await new Promise<number>((resolve) => {
      const tx = db.transaction('book_content', 'readonly');
      const req = tx.objectStore('book_content').count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch (err) {
    console.warn('[Edu AI] Failed to gather full storage statistics:', err);
  }

  // Check browser quota estimate if supported
  let quotaEstimatedBytes: number | undefined;
  let quotaUsagePercent: number | undefined;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage !== undefined && estimate.quota !== undefined && estimate.quota > 0) {
        quotaEstimatedBytes = estimate.usage;
        quotaUsagePercent = Math.min(100, Math.round((estimate.usage / estimate.quota) * 100));
        if (estimate.usage > totalSizeBytes) {
          totalSizeBytes = estimate.usage;
        }
      }
    } catch {
      // Ignore
    }
  }

  let formattedSize = '0 MB';
  if (totalSizeBytes > 1024 * 1024 * 1024) {
    formattedSize = `${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else if (totalSizeBytes > 1024 * 1024) {
    formattedSize = `${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  } else if (totalSizeBytes > 0) {
    formattedSize = `${Math.round(totalSizeBytes / 1024)} KB`;
  }

  return {
    count,
    totalSizeBytes,
    formattedSize,
    progressCount,
    highlightsCount,
    bookmarksCount,
    contentCount,
    quotaEstimatedBytes,
    quotaUsagePercent
  };
}

// -------------------------------------------------------------
// Offline Sync Queue Management (Bookmarks, Highlights, Progress)
// -------------------------------------------------------------

/**
 * Queue a user reading action when offline
 */
export async function queueOfflineAction(
  type: 'bookmark' | 'highlight' | 'progress' | 'note',
  payload: any
): Promise<void> {
  try {
    const db = await openDB();
    const item: OfflineSyncItem = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now()
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('offline_sync_queue', 'readwrite');
      tx.objectStore('offline_sync_queue').put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    console.log(`[Edu AI] Queued offline action (${type}):`, payload);
  } catch (err) {
    console.warn('[Edu AI] Failed to queue offline action:', err);
  }
}

/**
 * Get all queued offline sync items
 */
export async function getOfflineQueue(): Promise<OfflineSyncItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('offline_sync_queue', 'readonly');
      const store = tx.objectStore('offline_sync_queue');
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result || []) as OfflineSyncItem[]);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Process and flush all queued items when internet connection is restored
 */
export async function syncOfflineQueue(): Promise<{ syncedCount: number; errors: number }> {
  if (!isAppOnline()) {
    return { syncedCount: 0, errors: 0 };
  }

  const items = await getOfflineQueue();
  if (items.length === 0) return { syncedCount: 0, errors: 0 };

  console.log(`[Edu AI] Syncing ${items.length} offline actions to cloud...`);
  window.dispatchEvent(
    new CustomEvent('edu-ai-sync-start', { detail: { count: items.length } })
  );

  let syncedCount = 0;
  let errors = 0;

  for (const item of items) {
    try {
      if (item.type === 'progress') {
        const { bookId, progress, currentPage, totalPages } = item.payload;
        await saveReadingProgressLocal(bookId, progress, currentPage, totalPages);

        if (supabase) {
          try {
            const user = (await supabase.auth.getUser())?.data?.user;
            if (user) {
              await supabase.from('reading_progress').upsert({
                user_id: user.id,
                book_id: bookId,
                progress,
                updated_at: new Date().toISOString()
              });
            }
          } catch (e) {
            console.warn('Sync progress to Supabase failed:', e);
          }
        }
        syncedCount++;
      } else if (item.type === 'highlight') {
        if (supabase) {
          try {
            await supabase.from('highlights').insert(item.payload);
          } catch (e) {
            console.warn('Sync highlight to Supabase failed:', e);
          }
        }
        syncedCount++;
      } else if (item.type === 'bookmark') {
        if (supabase) {
          try {
            await supabase.from('bookmarks').insert(item.payload);
          } catch (e) {
            console.warn('Sync bookmark to Supabase failed:', e);
          }
        }
        syncedCount++;
      }

      // Remove from queue
      const db = await openDB();
      await new Promise<void>((resolve) => {
        const tx = db.transaction('offline_sync_queue', 'readwrite');
        tx.objectStore('offline_sync_queue').delete(item.id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (err) {
      console.warn('[Edu AI] Failed to sync offline item:', item, err);
      errors++;
    }
  }

  window.dispatchEvent(
    new CustomEvent('edu-ai-sync-completed', {
      detail: { syncedCount, errors, timestamp: Date.now() }
    })
  );

  return { syncedCount, errors };
}

// Auto-sync listener on window 'online' event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Edu AI] Network connection restored. Triggering automatic background sync...');
    window.dispatchEvent(
      new CustomEvent('edu-ai-network-status', { detail: { isOnline: true } })
    );
    syncOfflineQueue();
  });

  window.addEventListener('offline', () => {
    console.log('[Edu AI] Network disconnected. Switching to local offline mode.');
    window.dispatchEvent(
      new CustomEvent('edu-ai-network-status', { detail: { isOnline: false } })
    );
  });
}
