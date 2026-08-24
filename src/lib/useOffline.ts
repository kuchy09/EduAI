// React Hook for Offline Status, Book Caching, and Storage Synchronization
import { useState, useEffect, useCallback } from 'react';
import { Book } from '../types';
import {
  isAppOnline,
  getCachedBookIds,
  downloadBookForOffline,
  removeBookFromOffline,
  clearAllOfflineCache,
  getOfflineStorageStats,
  syncOfflineQueue,
  registerServiceWorker
} from './offlineManager';

export function useOffline() {
  const [isOnline, setIsOnline] = useState<boolean>(() => isAppOnline());
  const [cachedBookIds, setCachedBookIds] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ count: number; time: number } | null>(null);
  const [storageStats, setStorageStats] = useState<{ count: number; formattedSize: string }>({
    count: 0,
    formattedSize: '0 MB'
  });

  // Refresh cached books set and storage stats
  const refreshOfflineState = useCallback(async () => {
    try {
      const ids = await getCachedBookIds();
      setCachedBookIds(ids);
      const stats = await getOfflineStorageStats();
      setStorageStats({ count: stats.count, formattedSize: stats.formattedSize });
    } catch (err) {
      console.warn('[useOffline] Failed to refresh offline state:', err);
    }
  }, []);

  useEffect(() => {
    // Register Service Worker on mount
    registerServiceWorker();

    // Initial load
    refreshOfflineState();

    // Event Listeners for Online / Offline
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
    window.addEventListener('edu-ai-sync-start', handleSyncStart);
    window.addEventListener('edu-ai-sync-completed', handleSyncEnd);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('edu-ai-offline-changed', handleCacheChanged);
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
    refreshOfflineState
  };
}
