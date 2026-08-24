import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Download, 
  Copy, 
  Share2, 
  Check, 
  Quote as QuoteIcon, 
  Sparkles, 
  Palette, 
  Type, 
  Square, 
  Smartphone,
  Eye,
  BookOpen
} from 'lucide-react';
import { triggerCapsuleFeedback } from '../lib/feedback';

export type QuoteThemeId = 'sepia' | 'obsidian' | 'aura' | 'sage' | 'minimal';
export type AspectRatioType = '1:1' | '4:5' | '9:16';
export type FontStyleType = 'serif' | 'sans' | 'mono';

interface QuoteThemeConfig {
  id: QuoteThemeId;
  name: string;
  badge: string;
  bgGradient: string;
  previewBg: string;
  textColor: string;
  accentColor: string;
  borderColor: string;
  canvasBg: string[];
  canvasTextColor: string;
  canvasMutedColor: string;
  canvasAccentColor: string;
  canvasBorderColor: string;
}

const THEMES: Record<QuoteThemeId, QuoteThemeConfig> = {
  sepia: {
    id: 'sepia',
    name: 'Vintage Linen',
    badge: 'Editorial',
    bgGradient: 'from-[#FBF8F1] to-[#F1E9D7]',
    previewBg: 'bg-[#FBF8F1] text-[#2D241E]',
    textColor: 'text-[#2D241E]',
    accentColor: 'text-[#8C5D2C]',
    borderColor: 'border-[#E3D7BF]',
    canvasBg: ['#FAF6EC', '#EFE6D2'],
    canvasTextColor: '#2D241E',
    canvasMutedColor: '#786756',
    canvasAccentColor: '#8C5D2C',
    canvasBorderColor: 'rgba(140, 93, 44, 0.25)',
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Night',
    badge: 'Dark',
    bgGradient: 'from-[#14171E] to-[#0A0B0E]',
    previewBg: 'bg-[#14171E] text-[#F3F4F6]',
    textColor: 'text-[#F3F4F6]',
    accentColor: 'text-[#818CF8]',
    borderColor: 'border-[#262B38]',
    canvasBg: ['#181B24', '#0D0F14'],
    canvasTextColor: '#F8FAFC',
    canvasMutedColor: '#94A3B8',
    canvasAccentColor: '#818CF8',
    canvasBorderColor: 'rgba(129, 140, 248, 0.3)',
  },
  aura: {
    id: 'aura',
    name: 'Indigo Aura',
    badge: 'Modern',
    bgGradient: 'from-[#3730A3] via-[#4F46E5] to-[#7C3AED]',
    previewBg: 'bg-gradient-to-br from-indigo-900 via-indigo-700 to-purple-800 text-white',
    textColor: 'text-white',
    accentColor: 'text-amber-300',
    borderColor: 'border-white/20',
    canvasBg: ['#3730A3', '#6D28D9'],
    canvasTextColor: '#FFFFFF',
    canvasMutedColor: '#E0E7FF',
    canvasAccentColor: '#FDE047',
    canvasBorderColor: 'rgba(255, 255, 255, 0.35)',
  },
  sage: {
    id: 'sage',
    name: 'Sage Botanical',
    badge: 'Calm',
    bgGradient: 'from-[#EDF4EE] to-[#DAE8DD]',
    previewBg: 'bg-[#EDF4EE] text-[#1E3A2F]',
    textColor: 'text-[#1E3A2F]',
    accentColor: 'text-[#3E745A]',
    borderColor: 'border-[#C2D8C7]',
    canvasBg: ['#F2F7F3', '#DBE9DF'],
    canvasTextColor: '#1E3A2F',
    canvasMutedColor: '#537566',
    canvasAccentColor: '#3E745A',
    canvasBorderColor: 'rgba(62, 116, 90, 0.25)',
  },
  minimal: {
    id: 'minimal',
    name: 'Pure Monochrome',
    badge: 'Clean',
    bgGradient: 'from-[#FFFFFF] to-[#F3F4F6]',
    previewBg: 'bg-white text-slate-900',
    textColor: 'text-slate-900',
    accentColor: 'text-slate-500',
    borderColor: 'border-slate-300',
    canvasBg: ['#FFFFFF', '#F8FAFC'],
    canvasTextColor: '#0F172A',
    canvasMutedColor: '#64748B',
    canvasAccentColor: '#475569',
    canvasBorderColor: 'rgba(15, 23, 42, 0.15)',
  },
};

interface QuoteCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: string;
  bookTitle: string;
  bookAuthor: string;
  category?: string;
  pageNumber?: number;
}

export function QuoteCardModal({
  isOpen,
  onClose,
  quote,
  bookTitle,
  bookAuthor,
  category,
  pageNumber,
}: QuoteCardModalProps) {
  const [theme, setTheme] = useState<QuoteThemeId>('sepia');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('1:1');
  const [fontStyle, setFontStyle] = useState<FontStyleType>('serif');
  const [userNote, setUserNote] = useState<string>('');
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [showAuthor, setShowAuthor] = useState<boolean>(true);
  const [showQuoteMarks, setShowQuoteMarks] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [copyTextSuccess, setCopyTextSuccess] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Clean quote text for display
  const cleanedQuote = quote.trim().replace(/^["“](.*)["”]$/, '$1');

  // Canvas drawing routine
  const renderToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Determine dimensions based on aspect ratio
    let width = 1200;
    let height = 1200;
    if (aspectRatio === '4:5') {
      height = 1500;
    } else if (aspectRatio === '9:16') {
      height = 2133;
    }

    canvas.width = width;
    canvas.height = height;

    const currentTheme = THEMES[theme];

    // 1. Draw Background Gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, currentTheme.canvasBg[0]);
    gradient.addColorStop(1, currentTheme.canvasBg[currentTheme.canvasBg.length - 1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Decorative Ambient Accents / Borders
    const padding = 70;
    ctx.save();
    ctx.strokeStyle = currentTheme.canvasBorderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, padding, width - padding * 2, height - padding * 2);
    
    // Inner delicate double border
    const innerPad = padding + 14;
    ctx.strokeStyle = currentTheme.canvasBorderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(innerPad, innerPad, width - innerPad * 2, height - innerPad * 2);
    ctx.restore();

    // 3. Large Background Watermark Quotation Mark
    if (showQuoteMarks) {
      ctx.save();
      ctx.font = 'bold 360px "Playfair Display", Georgia, serif';
      ctx.fillStyle = currentTheme.canvasBorderColor;
      ctx.globalAlpha = 0.25;
      ctx.fillText('“', padding + 30, padding + 280);
      ctx.restore();
    }

    // 4. Header Badge / Category
    const headerY = padding + 60;
    ctx.save();
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = currentTheme.canvasAccentColor;
    ctx.letterSpacing = '3px';
    const tagText = (category ? category.split(',')[0].toUpperCase() : 'EDU AI HIGHLIGHT');
    ctx.fillText(tagText, padding + 40, headerY);

    if (pageNumber) {
      ctx.font = '500 20px monospace';
      ctx.fillStyle = currentTheme.canvasMutedColor;
      const pageStr = `PAGE ${pageNumber}`;
      const pageMetrics = ctx.measureText(pageStr);
      ctx.fillText(pageStr, width - padding - 40 - pageMetrics.width, headerY);
    }
    ctx.restore();

    // 5. Quote Text Formatting & Multi-line wrapping
    const contentWidth = width - (padding + 50) * 2;
    let baseFontSize = 46;
    if (cleanedQuote.length > 350) baseFontSize = 34;
    else if (cleanedQuote.length > 200) baseFontSize = 40;
    else if (cleanedQuote.length < 80) baseFontSize = 56;

    let fontStack = '"Playfair Display", Georgia, serif';
    if (fontStyle === 'sans') fontStack = 'system-ui, -apple-system, "Plus Jakarta Sans", sans-serif';
    else if (fontStyle === 'mono') fontStack = 'monospace';

    ctx.font = `italic 400 ${baseFontSize}px ${fontStack}`;
    ctx.fillStyle = currentTheme.canvasTextColor;
    const lineHeight = baseFontSize * 1.55;

    // Helper: Wrap text into lines
    const words = cleanedQuote.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine + (currentLine ? ' ' : '') + words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > contentWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // Calculate vertical centering
    const totalQuoteHeight = lines.length * lineHeight;
    const extraSpace = userNote ? 140 : 0;
    const startY = Math.max(headerY + 90, (height - totalQuoteHeight - extraSpace - 160) / 2 + 50);

    // Draw Quote Lines
    ctx.save();
    lines.forEach((line, index) => {
      ctx.fillText(line, padding + 50, startY + index * lineHeight);
    });
    ctx.restore();

    // 6. User Note / Reflection (if provided)
    let currentY = startY + totalQuoteHeight + 40;
    if (userNote.trim()) {
      ctx.save();
      ctx.font = '500 24px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = currentTheme.canvasMutedColor;
      ctx.fillText(`💭 “${userNote.trim()}”`, padding + 50, currentY);
      currentY += 50;
      ctx.restore();
    }

    // 7. Divider rule
    ctx.save();
    ctx.strokeStyle = currentTheme.canvasBorderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding + 50, currentY + 10);
    ctx.lineTo(padding + 160, currentY + 10);
    ctx.stroke();
    ctx.restore();

    // 8. Book Title & Author Attribution
    if (showAuthor) {
      const authorY = currentY + 46;
      ctx.save();
      ctx.font = `600 28px ${fontStyle === 'serif' ? '"Playfair Display", Georgia, serif' : 'system-ui, sans-serif'}`;
      ctx.fillStyle = currentTheme.canvasTextColor;
      ctx.fillText(`— ${bookTitle}`, padding + 50, authorY);

      if (bookAuthor) {
        ctx.font = '400 22px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = currentTheme.canvasMutedColor;
        ctx.fillText(bookAuthor, padding + 50, authorY + 34);
      }
      ctx.restore();
    }

    // 9. Watermark Branding (Edu AI Core)
    if (showWatermark) {
      const footerY = height - padding - 35;
      ctx.save();
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = currentTheme.canvasAccentColor;
      
      // Draw small book icon symbol next to text
      const watermarkText = 'Edu AI • Smart Study Suite';
      ctx.fillText(watermarkText, padding + 50, footerY);

      ctx.font = '500 18px monospace';
      ctx.fillStyle = currentTheme.canvasMutedColor;
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const dateMetrics = ctx.measureText(dateStr);
      ctx.fillText(dateStr, width - padding - 50 - dateMetrics.width, footerY);
      ctx.restore();
    }
  }, [
    theme,
    aspectRatio,
    fontStyle,
    userNote,
    showWatermark,
    showAuthor,
    showQuoteMarks,
    cleanedQuote,
    bookTitle,
    bookAuthor,
    category,
    pageNumber,
  ]);

  // Re-render canvas whenever options update or modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        renderToCanvas();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, renderToCanvas]);

  // Helper to convert canvas to Blob
  const getCanvasBlob = async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png', 0.95);
    });
  };

  // Download Quote Card
  const handleDownload = async () => {
    triggerCapsuleFeedback({ pitch: 580, volume: 0.2, hapticDuration: 20 });
    setIsGenerating(true);
    try {
      renderToCanvas();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeTitle = bookTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
      link.download = `edu-ai-quote-${safeTitle}-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy Image to Clipboard
  const handleCopyImage = async () => {
    triggerCapsuleFeedback({ pitch: 640, volume: 0.2, hapticDuration: 20 });
    setIsGenerating(true);
    try {
      renderToCanvas();
      const blob = await getCanvasBlob();
      if (!blob) throw new Error('Failed to create image blob');

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
      } else {
        // Fallback: copy formatted text
        handleCopyText();
      }
    } catch (err) {
      console.warn('Clipboard image copy not supported, falling back to text:', err);
      handleCopyText();
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy formatted text
  const handleCopyText = () => {
    const formatted = `“${cleanedQuote}”\n\n— ${bookTitle}${bookAuthor ? ` by ${bookAuthor}` : ''}\n(Shared via Edu AI)`;
    navigator.clipboard.writeText(formatted);
    setCopyTextSuccess(true);
    setTimeout(() => setCopyTextSuccess(false), 2500);
  };

  // Native Web Share
  const handleShare = async () => {
    triggerCapsuleFeedback({ pitch: 700, volume: 0.2, hapticDuration: 25 });
    renderToCanvas();
    const blob = await getCanvasBlob();
    const safeTitle = bookTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    const file = blob ? new File([blob], `quote-${safeTitle}.png`, { type: 'image/png' }) : null;

    if (navigator.share && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Quote from ${bookTitle}`,
          text: `“${cleanedQuote}” — ${bookTitle}`,
          files: [file],
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else if (navigator.share) {
      try {
        await navigator.share({
          title: `Quote from ${bookTitle}`,
          text: `“${cleanedQuote}”\n\n— ${bookTitle}, ${bookAuthor}\nRead on Edu AI`,
        });
      } catch (err) {}
    } else {
      handleCopyImage();
    }
  };

  if (!isOpen) return null;

  const currentTheme = THEMES[theme];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-sans">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 15 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          className="relative z-10 w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* Header Bar */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-sm">
                <QuoteIcon className="w-4 h-4 fill-current" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                  Shareable Quote Card
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                    HD Export
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Transform your book highlights into curated visual cards.</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Main Grid: Live Preview & Customization Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
            {/* Left: Interactive Canvas Preview */}
            <div className="lg:col-span-7 p-4 sm:p-6 bg-slate-100/70 dark:bg-slate-950/50 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 min-h-[380px]">
              <div 
                ref={previewContainerRef}
                className="w-full flex items-center justify-center relative p-2"
              >
                {/* Visual Card Container for HTML rendering mirror */}
                <div 
                  className={`w-full max-w-[380px] rounded-2xl shadow-xl transition-all duration-300 relative overflow-hidden border ${currentTheme.previewBg} ${currentTheme.borderColor}`}
                  style={{
                    aspectRatio: aspectRatio === '1:1' ? '1 / 1' : aspectRatio === '4:5' ? '4 / 5' : '9 / 16',
                  }}
                >
                  {/* Subtle double border */}
                  <div className={`absolute inset-2 border ${currentTheme.borderColor} rounded-xl pointer-events-none opacity-60`} />

                  {/* Watermark Quote Character */}
                  {showQuoteMarks && (
                    <div className="absolute top-4 left-4 text-7xl font-serif opacity-15 select-none pointer-events-none leading-none">
                      “
                    </div>
                  )}

                  {/* Inner Content layout */}
                  <div className="h-full flex flex-col justify-between p-5 relative z-10">
                    {/* Header Tag */}
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest opacity-75">
                      <span>{category ? category.split(',')[0] : 'EDU AI HIGHLIGHT'}</span>
                      {pageNumber && <span>PG. {pageNumber}</span>}
                    </div>

                    {/* Main Quote Text */}
                    <div className="my-auto py-2">
                      <p 
                        className={`leading-snug italic line-clamp-6 ${
                          fontStyle === 'serif' ? 'font-serif text-base sm:text-lg' : fontStyle === 'mono' ? 'font-mono text-sm' : 'font-sans font-medium text-sm sm:text-base'
                        }`}
                      >
                        “{cleanedQuote}”
                      </p>

                      {userNote.trim() && (
                        <p className="text-xs opacity-75 mt-3 font-sans line-clamp-2">
                          💭 “{userNote.trim()}”
                        </p>
                      )}
                    </div>

                    {/* Attribution & Watermark */}
                    <div className="space-y-1 pt-3 border-t border-current/15">
                      {showAuthor && (
                        <div>
                          <div className="font-semibold text-xs leading-tight line-clamp-1">— {bookTitle}</div>
                          {bookAuthor && <div className="text-[10px] opacity-70 truncate">{bookAuthor}</div>}
                        </div>
                      )}

                      {showWatermark && (
                        <div className="text-[9px] font-mono tracking-wider opacity-60 pt-1 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-2.5 h-2.5" /> Edu AI Reader
                          </span>
                          <span>Quote Card</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Hidden Canvas for High-Resolution HD Export */}
              <canvas ref={canvasRef} className="hidden" />

              <div className="mt-3 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 font-medium">
                <Eye className="w-3.5 h-3.5" />
                Live Preview • High-Res 1200px export ready
              </div>
            </div>

            {/* Right: Customization Controls & Actions */}
            <div className="lg:col-span-5 p-5 sm:p-6 space-y-5 overflow-y-auto">
              {/* 1. Theme Selection */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2.5">
                  <Palette className="w-3.5 h-3.5 text-indigo-500" />
                  Color & Atmosphere
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.values(THEMES).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        triggerCapsuleFeedback({ pitch: 500, volume: 0.15, hapticDuration: 10 });
                        setTheme(t.id);
                      }}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between h-16 ${
                        theme === t.id
                          ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className={`w-3.5 h-3.5 rounded-full border shadow-inner ${t.id === 'sepia' ? 'bg-[#F4ECD8]' : t.id === 'obsidian' ? 'bg-[#1C1C1E]' : t.id === 'aura' ? 'bg-indigo-600' : t.id === 'sage' ? 'bg-[#3E745A]' : 'bg-white'}`} />
                        {theme === t.id && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {t.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Aspect Ratio & Font Family */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                    <Square className="w-3.5 h-3.5 text-indigo-500" />
                    Ratio
                  </label>
                  <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl">
                    <button
                      onClick={() => setAspectRatio('1:1')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        aspectRatio === '1:1'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      1:1
                    </button>
                    <button
                      onClick={() => setAspectRatio('4:5')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        aspectRatio === '4:5'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      4:5
                    </button>
                    <button
                      onClick={() => setAspectRatio('9:16')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        aspectRatio === '9:16'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Story
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                    <Type className="w-3.5 h-3.5 text-indigo-500" />
                    Font
                  </label>
                  <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl">
                    <button
                      onClick={() => setFontStyle('serif')}
                      className={`flex-1 py-1.5 text-xs font-serif font-bold rounded-lg transition-all cursor-pointer ${
                        fontStyle === 'serif'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Serif
                    </button>
                    <button
                      onClick={() => setFontStyle('sans')}
                      className={`flex-1 py-1.5 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer ${
                        fontStyle === 'sans'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Sans
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Personal Thought / Caption */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Add Note or Reflection (Optional)
                </label>
                <input
                  type="text"
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="e.g. My favorite takeaway from Chapter 1..."
                  maxLength={120}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* 4. Display Toggles */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                  <span>Include Book & Author Attribution</span>
                  <input
                    type="checkbox"
                    checked={showAuthor}
                    onChange={(e) => setShowAuthor(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                  <span>Include Edu AI Watermark</span>
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => setShowWatermark(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                  <span>Background Quotation Watermark</span>
                  <input
                    type="checkbox"
                    checked={showQuoteMarks}
                    onChange={(e) => setShowQuoteMarks(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              {/* 5. Primary Action Buttons */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handleDownload}
                    disabled={isGenerating}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download PNG
                  </button>

                  <button
                    onClick={handleCopyImage}
                    disabled={isGenerating}
                    className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm transition-all border flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                      copySuccess
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    {copySuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copy Image
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleShare}
                    className="flex-1 py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share Sheet
                  </button>

                  <button
                    onClick={handleCopyText}
                    className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Copy formatted text"
                  >
                    {copyTextSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <QuoteIcon className="w-3.5 h-3.5" />}
                    {copyTextSuccess ? 'Text Copied' : 'Copy Text'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
