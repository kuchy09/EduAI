// React Hook for Offline Status, Book Caching, and Storage Synchronization
import { useState, useEffect, useCallback } from 'react';
import { Book, Bookmark, Highlight } from '../types';
import {
  isAppOnline,
  getCachedBookIds,
  downloadBookForOffline,
  removeBookFromOffline,
  clearAllOfflineCache,
  getOfflineStorageStats,
  syncOfflineQueue,
  registerServiceWorker,
  saveReadingProgressLocal,
  getReadingProgressLocal,
  getAllReadingProgressLocal,
  saveBookContentLocal,
  getBookContentLocal,
  saveHighlightLocal,
  getHighlightsLocal,
  deleteHighlightLocal,
  saveBookmarkLocal,
  getBookmarksLocal,
  deleteBookmarkLocal,
  OfflineStorageStats,
  ReadingProgressRecord,
  BookContentRecord
} from './offlineManager';

export function useOffline() {
  const [isOnline, setIsOnline] = useState<boolean>(() => isAppOnline());
  const [cachedBookIds, setCachedBookIds] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ count: number; time: number } | null>(null);
  const [storageStats, setStorageStats] = useState<OfflineStorageStats>({
    count: 0,
    totalSizeBytes: 0,
    formattedSize: '0 MB',
    progressCount: 0,
    highlightsCount: 0,
    bookmarksCount: 0,
    contentCount: 0
  });

  // Refresh cached books set and storage stats
  const refreshOfflineState = useCallback(async () => {
    try {
      const ids = await getCachedBookIds();
      setCachedBookIds(ids);
      const stats = await getOfflineStorageStats();
      setStorageStats(stats);
    } catch (err) {
      console.warn('[useOffline] Failed to refresh offline state:', err);
    }
  }, []);

  useEffect(() => {
    // Register Service Worker on mount
    registerServiceWorker();

    // Initial load
    refreshOfflineState();

    // Event Listeners for Online / Offline / Storage Updates
    const handleOnline = () => {
      setIsOnline(true);
      refreshOfflineState();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleCacheChanged = () => {
      refreshOfflineState();
    };

    const handleProgressUpdated = () => {
      refreshOfflineState();
    };

    const handleSyncStart = () => {
      setIsSyncing(true);
    };

    const handleSyncEnd = (e: any) => {
      setIsSyncing(false);
      if (e.detail?.syncedCount > 0) {
        setLastSyncResult({
          count: e.detail.syncedCount,
          time: Date.now()
        });
      }
      refreshOfflineState();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('edu-ai-offline-changed', handleCacheChanged);
    window.addEventListener('edu-ai-progress-updated', handleProgressUpdated);
    window.addEventListener('edu-ai-sync-start', handleSyncStart);
    window.addEventListener('edu-ai-sync-completed', handleSyncEnd);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('edu-ai-offline-changed', handleCacheChanged);
      window.removeEventListener('edu-ai-progress-updated', handleProgressUpdated);
      window.removeEventListener('edu-ai-sync-start', handleSyncStart);
      window.removeEventListener('edu-ai-sync-completed', handleSyncEnd);
    };
  }, [refreshOfflineState]);

  // Download a book with real-time percentage
  const downloadBook = useCallback(async (book: Book) => {
    setDownloadProgress((prev) => ({ ...prev, [book.id]: 5 }));
    try {
      await downloadBookForOffline(book, (percent) => {
        setDownloadProgress((prev) => ({ ...prev, [book.id]: percent }));
      });
      await refreshOfflineState();
      setTimeout(() => {
        setDownloadProgress((prev) => {
          const next = { ...prev };
          delete next[book.id];
          return next;
        });
      }, 1000);
      return true;
    } catch (err) {
      setDownloadProgress((prev) => {
        const next = { ...prev };
        delete next[book.id];
        return next;
      });
      throw err;
    }
  }, [refreshOfflineState]);

  // Delete cached book
  const deleteCachedBook = useCallback(async (bookId: string) => {
    const success = await removeBookFromOffline(bookId);
    await refreshOfflineState();
    return success;
  }, [refreshOfflineState]);

  // Clear all cache
  const clearCache = useCallback(async () => {
    const success = await clearAllOfflineCache();
    await refreshOfflineState();
    return success;
  }, [refreshOfflineState]);

  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue();
      if (result.syncedCount > 0) {
        setLastSyncResult({ count: result.syncedCount, time: Date.now() });
      }
      return result;
    } finally {
      setIsSyncing(false);
      refreshOfflineState();
    }
  }, [refreshOfflineState]);

  // Save reading progress to IndexedDB
  const saveProgress = useCallback(
    async (bookId: string, progress: number, currentPage?: number, totalPages?: number, scrollPct?: number) => {
      await saveReadingProgressLocal(bookId, progress, currentPage, totalPages, scrollPct);
      await refreshOfflineState();
    },
    [refreshOfflineState]
  );

  // Get reading progress for a book
  const getProgress = useCallback(async (bookId: string): Promise<ReadingProgressRecord | null> => {
    return await getReadingProgressLocal(bookId);
  }, []);

  // Get all reading progress
  const getAllProgress = useCallback(async (): Promise<Record<string, ReadingProgressRecord>> => {
    return await getAllReadingProgressLocal();
  }, []);

  // Save book text / chapter content
  const cacheBookContent = useCallback(
    async (bookId: string, data: Partial<BookContentRecord>) => {
      await saveBookContentLocal(bookId, data);
      await refreshOfflineState();
    },
    [refreshOfflineState]
  );

  // Get book text / chapter content
  const getCachedContent = useCallback(async (bookId: string): Promise<BookContentRecord | null> => {
    return await getBookContentLocal(bookId);
  }, []);

  // Highlights and bookmarks local operations
  const saveHighlight = useCallback(async (highlight: Highlight) => {
    await saveHighlightLocal(highlight);
  }, []);

  const getHighlights = useCallback(async (bookId?: string) => {
    return await getHighlightsLocal(bookId);
  }, []);

  const deleteHighlight = useCallback(async (id: string, bookId?: string) => {
    await deleteHighlightLocal(id, bookId);
  }, []);

  const saveBookmark = useCallback(async (bookmark: Bookmark) => {
    await saveBookmarkLocal(bookmark);
  }, []);

  const getBookmarks = useCallback(async (bookId?: string) => {
    return await getBookmarksLocal(bookId);
  }, []);

  const deleteBookmark = useCallback(async (id: string) => {
    await deleteBookmarkLocal(id);
  }, []);

  return {
    isOnline,
    isBookCached: (bookId: string) => cachedBookIds.has(bookId),
    cachedBookIds,
    downloadProgress,
    isDownloading: (bookId: string) => typeof downloadProgress[bookId] === 'number',
    downloadBook,
    deleteCachedBook,
    clearCache,
    isSyncing,
    lastSyncResult,
    storageStats,
    triggerSync,
    refreshOfflineState,
    saveProgress,
    getProgress,
    getAllProgress,
    cacheBookContent,
    getCachedContent,
    saveHighlight,
    getHighlights,
    deleteHighlight,
    saveBookmark,
    getBookmarks,
    deleteBookmark
  };
}
