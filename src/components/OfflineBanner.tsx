import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi, RefreshCw, CheckCircle2, CloudOff, ArrowDownCircle } from 'lucide-react';
import { useOffline } from '../lib/useOffline';

interface OfflineBannerProps {
  onNavigate?: (view: string) => void;
  onNavigateToOfflineBooks?: () => void;
}

export function OfflineBanner({ onNavigate, onNavigateToOfflineBooks }: OfflineBannerProps) {
  const { isOnline, isSyncing, lastSyncResult, triggerSync, cachedBookIds } = useOffline();
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowRestoredNotice(false);
    } else if (wasOffline && isOnline) {
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
        setWasOffline(false);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  return (
    <div className="relative z-30 font-sans">
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-amber-500/90 backdrop-blur-md text-amber-950 px-4 py-2 text-xs md:text-sm font-medium border-b border-amber-600/20 shadow-sm"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-900 shrink-0 animate-pulse" />
                <span>
                  <strong>Offline Mode:</strong> You are currently offline. You can continue reading all {cachedBookIds.size > 0 ? `${cachedBookIds.size} downloaded` : 'saved'} books. Changes will automatically sync when reconnected.
                </span>
              </div>
              {onNavigateToOfflineBooks && cachedBookIds.size > 0 && (
                <button
                  onClick={onNavigateToOfflineBooks}
                  className="px-2.5 py-1 bg-amber-900/10 hover:bg-amber-900/20 rounded-md font-semibold text-amber-950 transition-colors whitespace-nowrap flex items-center gap-1.5"
                >
                  <ArrowDownCircle className="w-3.5 h-3.5" />
                  View Offline Shelf
                </button>
              )}
            </div>
          </motion.div>
        )}

        {showRestoredNotice && isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-emerald-600 text-white px-4 py-2 text-xs md:text-sm font-medium shadow-sm flex items-center justify-between"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>
                  <strong>Back Online:</strong> Network connection restored. {lastSyncResult && lastSyncResult.count > 0 ? `Successfully synchronized ${lastSyncResult.count} offline actions!` : 'All reading data is up to date.'}
                </span>
              </div>
              <button
                onClick={() => setShowRestoredNotice(false)}
                className="text-emerald-100 hover:text-white text-xs opacity-80 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}

        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-3 right-4 z-50 bg-slate-900/90 text-white backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs flex items-center gap-2 shadow-xl border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5 text-brand-400 animate-spin" />
            <span>Syncing reading data...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
