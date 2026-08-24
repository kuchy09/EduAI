// Edu AI - High-Performance Offline Storage & Local Sync Manager
import { Book, Bookmark, Highlight } from '../types';
import { supabase } from './supabase';

const DB_NAME = 'EduAiOfflineDB';
const DB_VERSION = 1;

export interface CachedBookMeta extends Book {
  cachedAt: number;
  fileSizeBytes: number;
  isOfflineAvailable: boolean;
  coverDataUrl?: string;
}

export interface OfflineSyncItem {
  id: string;
  type: 'bookmark' | 'highlight' | 'progress';
  payload: any;
  timestamp: number;
}

// Open or initialize IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('book_blobs')) {
        db.createObjectStore('book_blobs', { keyPath: 'bookId' });
      }

      if (!db.objectStoreNames.contains('offline_sync_queue')) {
        const queueStore = db.createObjectStore('offline_sync_queue', { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('offline_highlights')) {
        db.createObjectStore('offline_highlights', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('offline_bookmarks')) {
        db.createObjectStore('offline_bookmarks', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Register Service Worker for offline shell and asset caching
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
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
        resolve((request.result || []) as CachedBookMeta[]);
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
    const downloadUrl = (book.fileUrl && book.fileUrl.startsWith('http'))
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
      const tx = db.transaction(['books', 'book_blobs'], 'readwrite');
      
      tx.objectStore('books').put(cachedMeta);
      tx.objectStore('book_blobs').put({
        bookId: book.id,
        blob,
        mimeType: blob.type || 'application/pdf',
        size: blob.size,
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
    window.dispatchEvent(new CustomEvent('edu-ai-offline-changed', { detail: { bookId: book.id, action: 'added' } }));
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
      const tx = db.transaction(['books', 'book_blobs'], 'readwrite');
      tx.objectStore('books').delete(bookId);
      tx.objectStore('book_blobs').delete(bookId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    window.dispatchEvent(new CustomEvent('edu-ai-offline-changed', { detail: { bookId, action: 'removed' } }));
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
      const tx = db.transaction(['books', 'book_blobs'], 'readwrite');
      tx.objectStore('books').clear();
      tx.objectStore('book_blobs').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_OFFLINE_CACHE' });
    }

    window.dispatchEvent(new CustomEvent('edu-ai-offline-changed', { detail: { action: 'cleared' } }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Storage statistics for downloaded books
 */
export async function getOfflineStorageStats(): Promise<{ count: number; totalSizeBytes: number; formattedSize: string }> {
  const books = await getAllCachedBooks();
  const count = books.length;
  const totalSizeBytes = books.reduce((acc, b) => acc + (b.fileSizeBytes || 0), 0);

  let formattedSize = '0 MB';
  if (totalSizeBytes > 1024 * 1024 * 1024) {
    formattedSize = `${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else if (totalSizeBytes > 1024 * 1024) {
    formattedSize = `${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  } else if (totalSizeBytes > 0) {
    formattedSize = `${Math.round(totalSizeBytes / 1024)} KB`;
  }

  return { count, totalSizeBytes, formattedSize };
}

// -------------------------------------------------------------
// Offline Sync Queue Management (Bookmarks, Highlights, Progress)
// -------------------------------------------------------------

/**
 * Queue a user reading action when offline
 */
export async function queueOfflineAction(type: 'bookmark' | 'highlight' | 'progress', payload: any): Promise<void> {
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
  window.dispatchEvent(new CustomEvent('edu-ai-sync-start', { detail: { count: items.length } }));

  let syncedCount = 0;
  let errors = 0;

  for (const item of items) {
    try {
      if (item.type === 'progress') {
        const { bookId, progress } = item.payload;
        localStorage.setItem(`book_progress_${bookId}`, progress.toString());
        // Sync to cloud if supabase is available
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

  window.dispatchEvent(new CustomEvent('edu-ai-sync-completed', {
    detail: { syncedCount, errors, timestamp: Date.now() }
  }));

  return { syncedCount, errors };
}

// Auto-sync listener on window 'online' event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Edu AI] Network connection restored. Triggering automatic background sync...');
    window.dispatchEvent(new CustomEvent('edu-ai-network-status', { detail: { isOnline: true } }));
    syncOfflineQueue();
  });

  window.addEventListener('offline', () => {
    console.log('[Edu AI] Network disconnected. Switching to local offline mode.');
    window.dispatchEvent(new CustomEvent('edu-ai-network-status', { detail: { isOnline: false } }));
  });
}
