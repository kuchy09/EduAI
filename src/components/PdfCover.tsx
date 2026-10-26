import React, { useState, useEffect, useRef } from 'react';
import { Document, Page } from 'react-pdf';
import { FileText } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import '../lib/pdfWorker';

interface PdfCoverProps {
  url: string;
  className?: string;
  alt?: string;
  fallbackImage?: string;
  pageNumber?: number;
  onLoadError?: () => void;
}

export function PdfCover({ url, className, alt, fallbackImage, pageNumber = 1, onLoadError }: PdfCoverProps) {
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleError = () => {
    setHasError(true);
    if (onLoadError) {
      onLoadError();
    }
  };

  if (hasError && fallbackImage) {
    return (
      <img 
        src={fallbackImage} 
        alt={alt || 'Book Cover'} 
        className={`object-cover w-full h-full ${className}`} 
        referrerPolicy="no-referrer"
        onError={() => {
          if (onLoadError) onLoadError();
        }}
      />
    );
  }

  if (hasError && !fallbackImage) {
    if (onLoadError) {
      onLoadError();
    }
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden bg-stone-100 flex items-center justify-center ${className}`}>
      {fallbackImage && hasError && (
        <img 
          src={fallbackImage} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover filter blur-[2px] opacity-40 z-0" 
          referrerPolicy="no-referrer"
        />
      )}
      {!hasError && isVisible && (
        <Document
          file={url}
          onLoadError={handleError}
          loading={
            <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-400 p-4 z-10">
              {fallbackImage ? (
                <div className="absolute inset-0 w-full h-full">
                  <img 
                    src={fallbackImage} 
                    alt={alt || 'Loading...'} 
                    className="absolute inset-0 w-full h-full object-cover z-0" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <span className="text-xs text-center">{alt || 'Loading cover...'}</span>
                </>
              )}
            </div>
          }
          error={null}
          className="w-full h-full flex items-center justify-center z-10"
        >
          <Page
            pageNumber={pageNumber}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="w-full h-full flex items-center justify-center [&_.react-pdf__Page__canvas]:!w-full [&_.react-pdf__Page__canvas]:!h-full [&_.react-pdf__Page__canvas]:!object-cover [&_.react-pdf__Page__canvas]:scale-[1.52]"
          />
        </Document>
      )}
    </div>
  );
}
