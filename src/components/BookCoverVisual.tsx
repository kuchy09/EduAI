import React, { useState, useEffect } from 'react';
import { Book } from '../types';
import { 
  BookOpen, Compass, Award, Bookmark, Atom, Code, Scale, GraduationCap, 
  Microscope, Dna, Globe, Languages, Landmark, TrendingUp, Wheat, Sparkles, Feather
} from 'lucide-react';
import { PdfCover } from './PdfCover';

interface BookCoverVisualProps {
  book: Book;
  className?: string;
}

export function BookCoverVisual({ book, className }: BookCoverVisualProps) {
  const [imgError, setImgError] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  useEffect(() => {
    setImgError(false);
    setPdfError(false);
  }, [book.id, book.coverImage, book.coverMode, book.pdfCoverPage, book.fileUrl]);
  
  const hasPdfFile = !!book.fileUrl;
  const customCover = book.customCover;
  const coverMode = book.coverMode || (customCover?.mode || (book.coverImage ? 'image' : (hasPdfFile ? 'pdf' : 'auto')));
  const pdfPage = book.pdfCoverPage || customCover?.pdfPageNumber || 1;

  const renderIcon = (iconName?: string) => {
    switch (iconName?.toLowerCase()) {
      case 'math':
      case 'sigma':
        return <span className="font-serif text-3xl font-extrabold text-white/90 select-none">∑</span>;
      case 'atom':
      case 'physics':
        return <Atom className="w-8 h-8 text-white/90" />;
      case 'chemistry':
        return <span className="font-mono text-xl font-bold text-white/90 select-none">H₂O</span>;
      case 'dna':
      case 'biology':
        return <Dna className="w-8 h-8 text-white/90" />;
      case 'microscope':
      case 'science':
        return <Microscope className="w-8 h-8 text-white/90" />;
      case 'code':
      case 'tech':
      case 'ict':
        return <Code className="w-8 h-8 text-white/90" />;
      case 'literature':
      case 'english':
        return <Feather className="w-8 h-8 text-white/90" />;
      case 'languages':
      case 'kiswahili':
        return <Languages className="w-8 h-8 text-white/90" />;
      case 'history':
      case 'landmark':
        return <Landmark className="w-8 h-8 text-white/90" />;
      case 'globe':
      case 'geography':
        return <Globe className="w-8 h-8 text-white/90" />;
      case 'agriculture':
      case 'wheat':
        return <Wheat className="w-8 h-8 text-white/90" />;
      case 'law':
      case 'scale':
        return <Scale className="w-8 h-8 text-white/90" />;
      case 'business':
      case 'finance':
        return <TrendingUp className="w-8 h-8 text-white/90" />;
      case 'award':
        return <Award className="w-8 h-8 text-white/90" />;
      case 'compass':
        return <Compass className="w-8 h-8 text-white/90" />;
      case 'sparkles':
        return <Sparkles className="w-8 h-8 text-white/90" />;
      case 'graduation':
        return <GraduationCap className="w-8 h-8 text-white/90" />;
      case 'book':
      default:
        return <BookOpen className="w-8 h-8 text-white/90" />;
    }
  };

  const renderVisualOrFallbackCover = () => {
    const titleLower = book.title.toLowerCase();
    const firstSubject = book.subjects?.[0] || '';
    const subject = firstSubject.toLowerCase();

    // Default auto-classification
    let gradient = customCover?.themeGradient || 'from-slate-700 to-slate-900';
    let accentBg = customCover?.accentBg || 'bg-slate-400';
    let accentText = customCover?.accentText || 'text-slate-300';
    let iconElement = customCover?.iconType ? renderIcon(customCover.iconType) : null;

    if (!customCover?.themeGradient) {
      if (titleLower.includes('math') || subject.includes('math') || titleLower.includes('calculus') || subject.includes('algebra')) {
        gradient = 'from-blue-700 to-indigo-950';
        accentBg = 'bg-sky-400';
        accentText = 'text-sky-300';
        iconElement = <span className="font-serif text-3xl font-extrabold text-white/80 select-none">∑</span>;
      } else if (titleLower.includes('physic') || titleLower.includes('science') || subject.includes('physic') || subject.includes('science') || titleLower.includes('intscience')) {
        gradient = 'from-teal-600 to-cyan-950';
        accentBg = 'bg-cyan-400';
        accentText = 'text-cyan-300';
        iconElement = <Compass className="w-8 h-8 opacity-70 text-white" />;
      } else if (titleLower.includes('biolog') || titleLower.includes('chemistry') || subject.includes('biolog') || subject.includes('chemistry')) {
        gradient = 'from-emerald-600 to-teal-950';
        accentBg = 'bg-emerald-400';
        accentText = 'text-emerald-300';
        iconElement = <span className="font-mono text-xl font-bold text-white/80 select-none">H₂O</span>;
      } else if (titleLower.includes('english') || titleLower.includes('literature') || subject.includes('english') || subject.includes('literacy')) {
        gradient = 'from-rose-600 via-rose-800 to-red-950';
        accentBg = 'bg-rose-400';
        accentText = 'text-rose-300';
        iconElement = <span className="font-serif text-3xl italic font-bold text-white/80 select-none">Aa</span>;
      } else if (titleLower.includes('kiswahili') || titleLower.includes('fasihi') || subject.includes('kiswahili')) {
        gradient = 'from-orange-600 to-amber-950';
        accentBg = 'bg-amber-400';
        accentText = 'text-amber-300';
        iconElement = <span className="font-serif text-2xl font-black text-white/80 select-none">Kis</span>;
      } else if (titleLower.includes('computer') || titleLower.includes('coding') || titleLower.includes('ict') || subject.includes('computer') || subject.includes('coding')) {
        gradient = 'from-purple-700 to-violet-950';
        accentBg = 'bg-purple-400';
        accentText = 'text-purple-300';
        iconElement = <span className="font-mono text-lg font-bold text-white/80 select-none">&lt;/&gt;</span>;
      } else if (titleLower.includes('agriculture') || titleLower.includes('agri') || subject.includes('agriculture')) {
        gradient = 'from-stone-750 to-emerald-900';
        accentBg = 'bg-yellow-500';
        accentText = 'text-yellow-300';
        iconElement = <Award className="w-8 h-8 opacity-60 text-white" />;
      } else if (titleLower.includes('social') || titleLower.includes('history') || titleLower.includes('geography') || subject.includes('social')) {
        gradient = 'from-amber-800 to-stone-900';
        accentBg = 'bg-amber-400';
        accentText = 'text-amber-200';
        iconElement = <Bookmark className="w-7 h-7 opacity-60 text-white" />;
      } else if (titleLower.includes('law') || subject.includes('law')) {
        gradient = 'from-slate-800 via-indigo-950 to-slate-900';
        accentBg = 'bg-amber-400';
        accentText = 'text-amber-200';
        iconElement = <Scale className="w-8 h-8 opacity-70 text-white" />;
      } else if (titleLower.includes('business') || subject.includes('business') || subject.includes('economics')) {
        gradient = 'from-emerald-800 via-teal-900 to-stone-900';
        accentBg = 'bg-emerald-400';
        accentText = 'text-emerald-200';
        iconElement = <TrendingUp className="w-8 h-8 opacity-70 text-white" />;
      } else {
        iconElement = <BookOpen className="w-8 h-8 opacity-50 text-white" />;
      }
    }

    if (!iconElement) {
      iconElement = <BookOpen className="w-8 h-8 opacity-50 text-white" />;
    }

    const hasCurriculum = book.curriculum && book.curriculum.length > 0;
    const curriculumName = customCover?.badgeText || (hasCurriculum ? `${book.curriculum[0]} CURRICULUM` : (book.level ? `${book.level} Level` : 'EDU AI EDITION'));
    const subtitleText = customCover?.subtitle || (firstSubject ? firstSubject : (book.category || ''));
    const pattern = customCover?.pattern || 'grid';

    return (
      <div className={`w-full h-full bg-gradient-to-br ${gradient} p-4 flex flex-col justify-between select-none relative overflow-hidden border border-white/10 ${className}`}>
        {/* Pattern Background overlay */}
        {pattern === 'grid' && (
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none" />
        )}
        {pattern === 'dots' && (
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none" />
        )}
        {pattern === 'geometric' && (
          <div className="absolute -top-12 -right-12 w-36 h-36 border border-white/15 rounded-full pointer-events-none" />
        )}

        <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-white/5 blur-lg pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-black/30 blur-xl pointer-events-none" />

        {/* Spine design highlight line */}
        <div className="absolute top-0 left-0 w-1.5 h-full bg-white/15 border-r border-black/10" />

        {/* Header / Curriculum Badge */}
        <div className="flex flex-col gap-0.5 ml-1 relative z-10">
          <span className="text-[9px] font-mono font-bold tracking-wider text-white/60 uppercase truncate max-w-[90%]">
            {curriculumName}
          </span>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${accentBg}`} />
            <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide">
              {book.level || 'Academic'}
            </span>
          </div>
        </div>

        {/* Middle contents */}
        <div className="flex flex-col items-center justify-center text-center my-auto relative z-10 px-0.5">
          <div className="w-11 h-11 rounded-full bg-white/12 backdrop-blur-sm flex items-center justify-center mb-2.5 shadow-inner border border-white/15">
            {iconElement}
          </div>
          <h4 className="text-xs sm:text-sm font-bold leading-tight font-display text-white line-clamp-3 overflow-hidden text-shadow-sm px-1">
            {book.title}
          </h4>
          {subtitleText && (
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded bg-black/30 ${accentText} mt-1.5 inline-block max-w-[90%] truncate`}>
              {subtitleText}
            </span>
          )}
        </div>

        {/* Author / Footer */}
        <div className="flex justify-between items-end border-t border-white/10 pt-1.5 ml-1 relative z-10">
          <span className="text-[9px] text-white/50 font-medium truncate max-w-[65%]">
            {book.author}
          </span>
          <span className="text-[8px] font-mono text-white/40 tracking-widest uppercase">
            {book.country?.[0] || 'Edu AI'}
          </span>
        </div>
      </div>
    );
  };

  // Explicit visual cover mode
  if (coverMode === 'visual') {
    return renderVisualOrFallbackCover();
  }

  // Explicit image cover mode (or if coverImage exists and not overridden to pdf)
  if ((coverMode === 'image' || (book.coverImage && coverMode !== 'pdf')) && !imgError && book.coverImage) {
    return (
      <img 
        src={book.coverImage} 
        alt={book.title} 
        className={`object-cover ${className}`} 
        onError={() => setImgError(true)} 
        referrerPolicy="no-referrer" 
      />
    );
  }

  // PDF cover mode
  if ((coverMode === 'pdf' || (hasPdfFile && !book.coverImage)) && !pdfError && hasPdfFile) {
    const pdfUrl = book.fileUrl?.startsWith('http') ? book.fileUrl : `/api/download?key=${encodeURIComponent(book.fileUrl!)}`;
    return (
      <PdfCover 
        url={pdfUrl} 
        alt={book.title} 
        pageNumber={pdfPage}
        fallbackImage={imgError ? undefined : (book.coverImage || undefined)} 
        onLoadError={() => setPdfError(true)}
        className={className} 
      />
    );
  }

  // Fallback to visual cover design
  return renderVisualOrFallbackCover();
}
