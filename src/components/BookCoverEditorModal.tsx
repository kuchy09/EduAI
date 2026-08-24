import React, { useState } from 'react';
import { Book, CustomCoverConfig } from '../types';
import { 
  X, Upload, Image as ImageIcon, Sparkles, Sliders, CheckCircle2, 
  AlertCircle, RefreshCw, FileText, Check, Eye, Palette, 
  BookOpen, Atom, Code, Scale, GraduationCap, Microscope, Dna, 
  Globe, Languages, Landmark, TrendingUp, Wheat, Award, Compass, ShieldCheck
} from 'lucide-react';
import { BookCoverVisual } from './BookCoverVisual';

interface BookCoverEditorModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedBook: Book) => Promise<void> | void;
}

// Curated high quality presets for educational subjects
const CURATED_PRESETS = [
  {
    id: 'math-calculus',
    title: 'Pure Mathematics & Calculus',
    category: 'STEM',
    image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=80',
    description: 'Geometric abstract patterns with blueprint aesthetics',
    iconType: 'math',
    gradient: 'from-blue-800 to-indigo-950',
    badge: 'ADVANCED MATHEMATICS'
  },
  {
    id: 'physics-quantum',
    title: 'Modern Physics & Quantum',
    category: 'STEM',
    image: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=800&auto=format&fit=crop&q=80',
    description: 'Quantum particles and electromagnetic waveforms',
    iconType: 'atom',
    gradient: 'from-teal-700 to-cyan-950',
    badge: 'PHYSICAL SCIENCES'
  },
  {
    id: 'chemistry-molecular',
    title: 'Chemistry & Molecular Sciences',
    category: 'STEM',
    image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&auto=format&fit=crop&q=80',
    description: 'Laboratory glassware and reaction dynamics',
    iconType: 'chemistry',
    gradient: 'from-emerald-700 to-teal-950',
    badge: 'ORGANIC CHEMISTRY'
  },
  {
    id: 'biology-genetics',
    title: 'Biology & Ecological Systems',
    category: 'STEM',
    image: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?w=800&auto=format&fit=crop&q=80',
    description: 'Microscopic cellular structures and natural botany',
    iconType: 'dna',
    gradient: 'from-green-700 to-emerald-950',
    badge: 'LIFE SCIENCES'
  },
  {
    id: 'computer-science-cyber',
    title: 'Computer Science & ICT',
    category: 'STEM',
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
    description: 'Digital matrices, algorithms, and cybersecurity circuits',
    iconType: 'code',
    gradient: 'from-purple-800 to-violet-950',
    badge: 'COMPUTER SCIENCE'
  },
  {
    id: 'literature-classics',
    title: 'Literature & Narrative Studies',
    category: 'Humanities',
    image: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&auto=format&fit=crop&q=80',
    description: 'Vintage library parchment and typographical layout',
    iconType: 'literature',
    gradient: 'from-rose-800 to-red-950',
    badge: 'LITERATURE & ARTS'
  },
  {
    id: 'history-civilization',
    title: 'World History & Civics',
    category: 'Humanities',
    image: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&auto=format&fit=crop&q=80',
    description: 'Classical architecture, ancient scrolls, and governance',
    iconType: 'history',
    gradient: 'from-amber-800 to-stone-900',
    badge: 'HISTORY & CIVICS'
  },
  {
    id: 'cbc-kenya-junior',
    title: 'Kenyan CBC Junior School',
    category: 'Curricula',
    image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop&q=80',
    description: 'Official Competency Based Curriculum standard aesthetic',
    iconType: 'graduation',
    gradient: 'from-sky-700 to-slate-900',
    badge: 'KENYAN CBC GRADE 9'
  },
  {
    id: 'business-economics',
    title: 'Business & Economic Principles',
    category: 'Commerce',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
    description: 'Modern corporate architecture and market analytics',
    iconType: 'business',
    gradient: 'from-slate-800 to-emerald-950',
    badge: 'BUSINESS STUDIES'
  },
  {
    id: 'law-justice',
    title: 'Constitutional Law & Jurisprudence',
    category: 'Commerce',
    image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
    description: 'Legal gavel, courtroom balance, and constitutional statutes',
    iconType: 'law',
    gradient: 'from-stone-800 to-indigo-950',
    badge: 'LEGAL STUDIES'
  },
  {
    id: 'agriculture-nutrition',
    title: 'Sustainable Agriculture & Ecology',
    category: 'Applied',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&auto=format&fit=crop&q=80',
    description: 'Golden wheat harvests, soil ecology, and farming science',
    iconType: 'agriculture',
    gradient: 'from-amber-700 to-emerald-950',
    badge: 'AGRICULTURE & BIOSYSTEMS'
  },
  {
    id: 'geography-environment',
    title: 'Physical Geography & Cartography',
    category: 'Humanities',
    image: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&auto=format&fit=crop&q=80',
    description: 'Topographic contour maps and planetary topography',
    iconType: 'globe',
    gradient: 'from-cyan-800 to-slate-900',
    badge: 'GEOGRAPHY & CARTOGRAPHY'
  }
];

const GRADIENT_PALETTES = [
  { id: 'indigo', name: 'Royal Indigo', value: 'from-blue-700 via-indigo-900 to-slate-950', accentBg: 'bg-sky-400', accentText: 'text-sky-300' },
  { id: 'emerald', name: 'Deep Emerald', value: 'from-emerald-700 via-teal-900 to-slate-950', accentBg: 'bg-emerald-400', accentText: 'text-emerald-300' },
  { id: 'crimson', name: 'Crimson Velvet', value: 'from-rose-700 via-red-900 to-stone-950', accentBg: 'bg-rose-400', accentText: 'text-rose-300' },
  { id: 'amber', name: 'Sunset Ochre', value: 'from-orange-600 via-amber-800 to-stone-950', accentBg: 'bg-amber-400', accentText: 'text-amber-300' },
  { id: 'violet', name: 'Cyber Violet', value: 'from-purple-700 via-violet-900 to-slate-950', accentBg: 'bg-purple-400', accentText: 'text-purple-300' },
  { id: 'slate', name: 'Obsidian Slate', value: 'from-slate-700 via-slate-800 to-slate-950', accentBg: 'bg-slate-300', accentText: 'text-slate-200' },
  { id: 'cyan', name: 'Teal Quantum', value: 'from-teal-600 via-cyan-800 to-slate-950', accentBg: 'bg-cyan-400', accentText: 'text-cyan-300' },
  { id: 'earth', name: 'Bronze Earth', value: 'from-stone-700 via-amber-900 to-stone-950', accentBg: 'bg-yellow-400', accentText: 'text-yellow-300' }
];

const ICON_OPTIONS = [
  { id: 'book', label: 'Classic Book', icon: BookOpen },
  { id: 'math', label: 'Mathematics (∑)', icon: () => <span className="font-serif font-bold text-base">∑</span> },
  { id: 'atom', label: 'Physics (Atom)', icon: Atom },
  { id: 'microscope', label: 'Science / Lab', icon: Microscope },
  { id: 'dna', label: 'Biology / DNA', icon: Dna },
  { id: 'code', label: 'Coding / ICT', icon: Code },
  { id: 'literature', label: 'Literature (Aa)', icon: () => <span className="font-serif italic font-bold text-base">Aa</span> },
  { id: 'languages', label: 'Languages', icon: Languages },
  { id: 'history', label: 'History / Civics', icon: Landmark },
  { id: 'globe', label: 'Geography', icon: Globe },
  { id: 'agriculture', label: 'Agriculture', icon: Wheat },
  { id: 'law', label: 'Law / Justice', icon: Scale },
  { id: 'business', label: 'Business / Econ', icon: TrendingUp },
  { id: 'graduation', label: 'Curriculum / CBC', icon: GraduationCap },
  { id: 'award', label: 'Honor / Award', icon: Award },
  { id: 'compass', label: 'Compass', icon: Compass }
];

export function BookCoverEditorModal({ book, isOpen, onClose, onSave }: BookCoverEditorModalProps) {
  if (!isOpen) return null;

  // Active cover configuration state
  const [coverMode, setCoverMode] = useState<'image' | 'visual' | 'pdf'>(() => {
    if (book.coverMode === 'image' || book.coverMode === 'visual' || book.coverMode === 'pdf') {
      return book.coverMode;
    }
    if (book.coverImage) return 'image';
    if (book.fileUrl) return 'pdf';
    return 'visual';
  });
  
  const [coverImageUrl, setCoverImageUrl] = useState<string>(book.coverImage || '');
  const [pdfPageNumber, setPdfPageNumber] = useState<number>(book.pdfCoverPage || book.customCover?.pdfPageNumber || 1);
  
  // Custom visual theme properties
  const [themeGradient, setThemeGradient] = useState<string>(
    book.customCover?.themeGradient || 'from-blue-700 via-indigo-900 to-slate-950'
  );
  const [accentBg, setAccentBg] = useState<string>(book.customCover?.accentBg || 'bg-sky-400');
  const [accentText, setAccentText] = useState<string>(book.customCover?.accentText || 'text-sky-300');
  const [iconType, setIconType] = useState<string>(book.customCover?.iconType || 'book');
  const [subtitle, setSubtitle] = useState<string>(
    book.customCover?.subtitle || (book.subjects?.[0] || book.category || '')
  );
  const [badgeText, setBadgeText] = useState<string>(
    book.customCover?.badgeText || (book.curriculum?.[0] ? `${book.curriculum[0]} CURRICULUM` : (book.level ? `${book.level} Level` : 'EDU AI EDITION'))
  );
  const [pattern, setPattern] = useState<'grid' | 'dots' | 'geometric' | 'clean'>(
    book.customCover?.pattern || 'grid'
  );

  const [activeTab, setActiveTab] = useState<'upload' | 'presets' | 'designer' | 'pdf'>('upload');
  const [previewAspect, setPreviewAspect] = useState<'grid' | 'card' | 'reader'>('grid');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Synthesize working book object for real-time live preview
  const livePreviewBook: Book = {
    ...book,
    coverMode,
    coverImage: coverMode === 'image' ? coverImageUrl : '',
    pdfCoverPage: pdfPageNumber,
    customCover: {
      mode: coverMode,
      themeGradient,
      accentBg,
      accentText,
      iconType,
      subtitle,
      badgeText,
      pattern,
      pdfPageNumber
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    try {
      setIsUploading(true);
      setStatusMessage({ type: 'info', text: 'Processing and optimizing cover image...' });

      // First create local data URL so it displays immediately
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setCoverImageUrl(dataUrl);
          setCoverMode('image');
          setStatusMessage({ type: 'success', text: 'Cover image loaded! Ready to save to user platform.' });
        }
      };
      reader.readAsDataURL(file);

      // Attempt background upload to cloud storage if API endpoint is available
      try {
        const uploadRes = await fetch(`/api/upload-direct?filename=${encodeURIComponent(`cover-${Date.now()}-${file.name}`)}`, {
          method: 'POST',
          body: file,
          headers: { 'Content-Type': file.type || 'image/jpeg' }
        });
        if (uploadRes.ok) {
          const { key } = await uploadRes.json();
          if (key) {
            const publicUrl = `/api/download?key=${encodeURIComponent(key)}`;
            setCoverImageUrl(publicUrl);
          }
        }
      } catch (uploadErr) {
        console.warn('Direct cloud upload skipped, retained high-res local data URL:', uploadErr);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Failed to process file: ' + (err.message || 'Unknown error') });
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyPreset = (preset: typeof CURATED_PRESETS[0]) => {
    setCoverImageUrl(preset.image);
    setCoverMode('image');
    setBadgeText(preset.badge);
    setThemeGradient(preset.gradient);
    setIconType(preset.iconType);
    setStatusMessage({ type: 'success', text: `Applied curated preset: ${preset.title}` });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const customCoverConfig: CustomCoverConfig = {
        mode: coverMode,
        themeGradient,
        accentBg,
        accentText,
        iconType,
        subtitle,
        badgeText,
        pattern,
        pdfPageNumber
      };

      const updatedBook: Book = {
        ...book,
        coverMode,
        coverImage: coverMode === 'image' ? coverImageUrl : '',
        pdfCoverPage: pdfPageNumber,
        customCover: customCoverConfig
      };

      // Persist to localStorage override table for permanent persistence
      try {
        localStorage.setItem(`book_cover_override_${book.id}`, JSON.stringify({
          coverMode,
          coverImage: coverMode === 'image' ? coverImageUrl : '',
          pdfCoverPage: pdfPageNumber,
          customCover: customCoverConfig,
          updatedAt: new Date().toISOString()
        }));

        const existingOverrides = JSON.parse(localStorage.getItem('edu_ai_book_cover_overrides') || '{}');
        existingOverrides[book.id] = {
          coverMode,
          coverImage: coverMode === 'image' ? coverImageUrl : '',
          pdfCoverPage: pdfPageNumber,
          customCover: customCoverConfig,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem('edu_ai_book_cover_overrides', JSON.stringify(existingOverrides));
      } catch (lsErr) {
        console.warn('LocalStorage cover override cache skipped:', lsErr);
      }

      await onSave(updatedBook);

      setStatusMessage({ type: 'success', text: 'Cover successfully updated and applied across all user devices!' });
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Failed to save cover:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Error saving cover update' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center border border-brand-500/20">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Edit Book Cover Page
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                  {book.level || 'All Levels'}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Repair broken covers, upload high-res graphics, or design custom educational templates for users.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar Message */}
        {statusMessage && (
          <div className={`px-6 py-2.5 text-xs font-medium flex items-center gap-2 border-b ${
            statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
            statusMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
            'bg-sky-50 text-sky-800 border-sky-200'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> :
             statusMessage.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> :
             <RefreshCw className="w-4 h-4 text-sky-600 animate-spin shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Main Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-y-auto">
          
          {/* LEFT: Live Multi-Device Real-Time Preview */}
          <div className="lg:col-span-5 p-6 bg-slate-50 border-r border-slate-200 flex flex-col items-center justify-between gap-6">
            <div className="w-full">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-brand-600" />
                  Live Platform Preview
                </span>
                
                {/* Preview aspect ratio selector */}
                <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-medium">
                  <button
                    onClick={() => setPreviewAspect('grid')}
                    className={`px-2 py-0.5 rounded ${previewAspect === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Grid (3:4)
                  </button>
                  <button
                    onClick={() => setPreviewAspect('card')}
                    className={`px-2 py-0.5 rounded ${previewAspect === 'card' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Card
                  </button>
                  <button
                    onClick={() => setPreviewAspect('reader')}
                    className={`px-2 py-0.5 rounded ${previewAspect === 'reader' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Thumbnail
                  </button>
                </div>
              </div>

              {/* Cover Preview Stage */}
              <div className="bg-slate-900/5 rounded-2xl p-4 border border-slate-200 flex items-center justify-center min-h-[300px]">
                <div className={`transition-all duration-300 shadow-xl rounded-xl overflow-hidden border border-slate-200/80 ${
                  previewAspect === 'grid' ? 'w-48 h-64' :
                  previewAspect === 'card' ? 'w-40 h-56' :
                  'w-28 h-36'
                }`}>
                  <BookCoverVisual book={livePreviewBook} className="w-full h-full" />
                </div>
              </div>
            </div>

            {/* Diagnostics Card */}
            <div className="w-full bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Active Rendering Mode</span>
                <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                  coverMode === 'image' ? 'bg-purple-100 text-purple-700' :
                  coverMode === 'visual' ? 'bg-amber-100 text-amber-800' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {coverMode === 'image' ? 'Custom Image' : coverMode === 'visual' ? 'Visual Vector Theme' : `PDF Page ${pdfPageNumber}`}
                </span>
              </div>

              <div className="text-xs text-slate-600 pt-1 border-t border-slate-100 flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Book Title:</span>
                  <span className="font-medium text-slate-800 truncate max-w-[65%]">{book.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PDF File:</span>
                  <span className="font-mono text-[11px] text-slate-700 truncate max-w-[65%]">
                    {book.fileUrl ? 'Attached' : 'None (Abstract)'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 font-medium mt-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verified for User Web & Mobile Apps</span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: Cover Repair & Editing Controls */}
          <div className="lg:col-span-7 p-6 flex flex-col justify-between overflow-y-auto">
            
            <div className="space-y-5">
              {/* Tabs Navigation */}
              <div className="flex border-b border-slate-200 gap-2 pb-px overflow-x-auto">
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'upload' 
                      ? 'border-brand-600 text-brand-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload / Image URL
                </button>

                <button
                  onClick={() => setActiveTab('presets')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'presets' 
                      ? 'border-brand-600 text-brand-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Curated Presets
                </button>

                <button
                  onClick={() => setActiveTab('designer')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'designer' 
                      ? 'border-brand-600 text-brand-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  Visual Generator
                </button>

                {book.fileUrl && (
                  <button
                    onClick={() => setActiveTab('pdf')}
                    className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      activeTab === 'pdf' 
                        ? 'border-brand-600 text-brand-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    PDF Page Settings
                  </button>
                )}
              </div>

              {/* TAB 1: UPLOAD & IMAGE URL */}
              {activeTab === 'upload' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Upload New Cover Graphic (PNG, JPG, WebP)
                    </label>
                    <div className="border-2 border-dashed border-slate-300 hover:border-brand-500 hover:bg-brand-50/20 transition-all rounded-xl p-5 text-center cursor-pointer relative">
                      <input 
                        type="file" 
                        accept="image/png,image/jpeg,image/webp,image/svg+xml" 
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <div className="text-xs">
                          <span className="font-bold text-brand-600">Click to browse</span> or drag and drop image here
                        </div>
                        <span className="text-[11px] text-slate-400">High resolution 600x800+ recommended</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase">Or Specify Image URL</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Direct Cover Image Web URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://example.com/cover.jpg or Unsplash link"
                        value={coverImageUrl}
                        onChange={(e) => {
                          setCoverImageUrl(e.target.value);
                          setCoverMode('image');
                        }}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                      />
                      {coverImageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setCoverImageUrl('');
                            setCoverMode('visual');
                          }}
                          className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg font-medium transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold">Quick Fix Tip:</strong> If the PDF cover was blurry, had a blank white 1st page, or an unappealing scan, setting a high-resolution cover image here will immediately replace it across all student and teacher devices.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CURATED PRESETS */}
              {activeTab === 'presets' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <p className="text-xs text-slate-500">
                    Select a curated, syllabus-aligned cover design to instantly fix broken art:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {CURATED_PRESETS.map((preset) => {
                      const isSelected = coverImageUrl === preset.image && coverMode === 'image';
                      return (
                        <div
                          key={preset.id}
                          onClick={() => handleApplyPreset(preset)}
                          className={`group cursor-pointer rounded-xl border p-2 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                            isSelected 
                              ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/30' 
                              : 'border-slate-200 hover:border-brand-300 hover:shadow-xs bg-white'
                          }`}
                        >
                          <div className="aspect-4/3 rounded-lg overflow-hidden mb-2 relative bg-slate-100">
                            <img 
                              src={preset.image} 
                              alt={preset.title} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                            {isSelected && (
                              <div className="absolute top-1 right-1 bg-brand-600 text-white p-0.5 rounded-full shadow-sm">
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider block">
                              {preset.category}
                            </span>
                            <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-1">
                              {preset.title}
                            </h4>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: VISUAL DESIGNER & THEME GENERATOR */}
              {activeTab === 'designer' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Theme Color Gradient
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {GRADIENT_PALETTES.map((pal) => {
                        const isSelected = themeGradient === pal.value && coverMode === 'visual';
                        return (
                          <button
                            key={pal.id}
                            type="button"
                            onClick={() => {
                              setThemeGradient(pal.value);
                              setAccentBg(pal.accentBg);
                              setAccentText(pal.accentText);
                              setCoverMode('visual');
                            }}
                            className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                              isSelected ? 'border-brand-600 ring-2 ring-brand-500/20 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${pal.value} shrink-0`} />
                            <span className="text-xs font-medium text-slate-700 truncate">{pal.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Subject Icon Glyph
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-4 gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {ICON_OPTIONS.map((opt) => {
                        const isSelected = iconType === opt.id && coverMode === 'visual';
                        const IconComp = opt.icon;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setIconType(opt.id);
                              setCoverMode('visual');
                            }}
                            className={`p-1.5 rounded-lg border text-left flex items-center gap-1.5 text-xs transition-colors ${
                              isSelected ? 'border-brand-600 bg-brand-50 text-brand-700 font-bold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <IconComp className="w-4 h-4 shrink-0" />
                            <span className="truncate">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Header Tag / Badge Text
                      </label>
                      <input
                        type="text"
                        value={badgeText}
                        onChange={(e) => {
                          setBadgeText(e.target.value);
                          setCoverMode('visual');
                        }}
                        placeholder="e.g. CBC GRADE 9"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 outline-none uppercase font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Subtitle / Discipline
                      </label>
                      <input
                        type="text"
                        value={subtitle}
                        onChange={(e) => {
                          setSubtitle(e.target.value);
                          setCoverMode('visual');
                        }}
                        placeholder="e.g. Pure Mathematics"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Background Pattern
                    </label>
                    <div className="flex gap-2">
                      {(['grid', 'dots', 'geometric', 'clean'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setPattern(p);
                            setCoverMode('visual');
                          }}
                          className={`flex-1 py-1.5 px-2 text-xs font-medium capitalize rounded-lg border transition-colors ${
                            pattern === p && coverMode === 'visual'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: PDF PAGE SETTINGS */}
              {activeTab === 'pdf' && book.fileUrl && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-brand-600" />
                      PDF Page Selection
                    </h4>
                    <p className="text-xs text-slate-500">
                      If the PDF document's first page is a blank title sheet or publisher disclaimer, specify which page contains the real cover artwork:
                    </p>

                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-700">Cover Page Number:</label>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((pageNum) => (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => {
                              setPdfPageNumber(pageNum);
                              setCoverMode('pdf');
                            }}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                              pdfPageNumber === pageNum && coverMode === 'pdf'
                                ? 'bg-brand-600 text-white shadow-xs'
                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {pageNum}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                    <button
                      type="button"
                      onClick={() => setCoverMode('pdf')}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                        coverMode === 'pdf' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 border border-blue-300'
                      }`}
                    >
                      {coverMode === 'pdf' ? 'Active: Rendering PDF Page' : 'Switch to PDF Page Mode'}
                    </button>
                    <span>Use the native high-fidelity page rendered directly from the PDF file.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-5 mt-5 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setCoverMode('visual');
                  setCoverImageUrl('');
                  setPdfPageNumber(1);
                  setThemeGradient('from-blue-700 via-indigo-900 to-slate-950');
                  setStatusMessage({ type: 'info', text: 'Reset cover to default generator configuration' });
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium underline"
              >
                Reset to Default
              </button>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isUploading}
                  className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save & Apply to Users Platform
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
