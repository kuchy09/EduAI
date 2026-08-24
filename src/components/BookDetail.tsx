import { Book } from '../types';
import { X, Play, MessageSquare, Star, Clock, BookOpen, Sparkles, Download, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { BookCoverVisual } from './BookCoverVisual';

interface BookDetailProps {
  book: Book;
  onClose: () => void;
  onDiscuss: () => void;
  onRead: () => void;
}

export function BookDetail({ book, onClose, onDiscuss, onRead }: BookDetailProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadComplete(false);
    try {
      const fileKey = book.fileUrl || book.id;
      const url = `/api/download?key=${encodeURIComponent(fileKey)}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const extension = (book.fileUrl || 'pdf').split('.').pop()?.substring(0, 4) || 'pdf';
      const cleanExtension = extension.includes('?') ? extension.split('?')[0] : extension;
      a.download = `${book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${cleanExtension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      
      setDownloadComplete(true);
      setTimeout(() => setDownloadComplete(false), 3000);
    } catch (err) {
      console.warn('Failed to download blob directly, opening in new tab:', err);
      const fileKey = book.fileUrl || book.id;
      const fallbackUrl = `/api/download?key=${encodeURIComponent(fileKey)}`;
      window.open(fallbackUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end"
        onClick={onClose}
      >
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full max-w-md h-full bg-white shadow-2xl relative flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex-1 overflow-y-auto p-6 pb-32">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center text-center mt-8 mb-6">
              <div className="w-40 h-56 rounded-xl overflow-hidden shadow-lg shadow-slate-200/50 mb-6 border border-slate-100 flex relative">
                <BookCoverVisual book={book} className="w-full h-full absolute inset-0" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold mb-3">
                {book.category}
              </div>
              <h2 className="text-2xl font-bold font-display text-slate-900 mb-2 leading-tight px-4">{book.title}</h2>
              <p className="text-slate-500 font-medium">{book.author}</p>
            </div>

            <div className="flex items-center justify-center gap-6 mb-8 py-4 border-y border-slate-100">
               <div className="flex flex-col items-center gap-1">
                 <div className="flex items-center text-slate-900 font-semibold text-sm">
                   <Star className="w-4 h-4 fill-amber-400 text-amber-400 mr-1" />
                   {book.rating}
                 </div>
                 <span className="text-xs text-slate-500 font-medium">Rating</span>
               </div>
               <div className="w-px h-8 bg-slate-100"></div>
               <div className="flex flex-col items-center gap-1">
                 <div className="flex items-center text-slate-900 font-semibold text-sm gap-1.5">
                   <BookOpen className="w-4 h-4 text-brand-500" />
                   {book.readProgress ? 'Reading' : 'Unread'}
                 </div>
                 <span className="text-xs text-slate-500 font-medium">{book.readProgress || 0}% Done</span>
               </div>
               <div className="w-px h-8 bg-slate-100"></div>
               <div className="flex flex-col items-center gap-1">
                 <div className="flex items-center text-slate-900 font-semibold text-sm gap-1.5">
                   <Clock className="w-4 h-4 text-emerald-500" />
                   12h
                 </div>
                 <span className="text-xs text-slate-500 font-medium">Est. Time</span>
               </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2 font-display">About this book</h3>
                <p className="text-slate-600 leading-relaxed text-[15px]">
                  {book.description}
                </p>
              </div>

              {book.aiInsights && book.aiInsights.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2 font-display">
                    <Sparkles className="w-5 h-5 text-brand-500" />
                    AI Insights
                  </h3>
                  <ul className="space-y-2">
                    {book.aiInsights.map((insight, idx) => (
                      <li key={idx} className="flex gap-3 text-[15px] text-slate-700 bg-brand-50/50 p-4 rounded-xl border border-brand-100/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0 mt-2"></span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 w-full p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 flex flex-col gap-3">
            <div className="flex gap-3">
               <button
                  onClick={onRead}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-sm shadow-brand-200"
               >
                 <Play className="w-4 h-4" /> {book.readProgress ? 'Continue Reading' : 'Start Reading'}
               </button>
               <button 
                 onClick={onDiscuss}
                 className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
               >
                  <MessageSquare className="w-5 h-5" />
               </button>
            </div>
            {book.fileUrl && (
               <button
                  onClick={handleDownload}
                  disabled={isDownloading || downloadComplete}
                  className={`w-full ${downloadComplete ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-800 hover:bg-slate-900'} text-white px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-90`}
               >
                 {isDownloading ? (
                   <>
                     <Loader2 className="w-5 h-5 animate-spin" /> downloading...
                   </>
                 ) : downloadComplete ? (
                   <>
                     <CheckCircle2 className="w-5 h-5" /> Downloaded
                   </>
                 ) : (
                   <>
                     <Download className="w-5 h-5" /> Download File
                   </>
                 )}
               </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
