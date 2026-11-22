import type { Book, CustomCoverConfig } from '../src/types';

export interface BookCoverOverride {
  coverMode?: 'auto' | 'image' | 'visual' | 'pdf';
  coverImage?: string;
  pdfCoverPage?: number;
  customCover?: CustomCoverConfig;
  titleKey?: string;
  updatedAt?: string;
}

export const GLOBAL_BOOK_COVERS_ROW_ID = '00000000-0000-4000-8000-00000000c001';
export const GLOBAL_BOOK_COVERS_ROW_TITLE = '__EDU_GLOBAL_BOOK_COVERS_V1__';
export const SYSTEM_NOTIFICATIONS_ROW_ID = '00000000-0000-4000-8000-00000000c002';
export const SYSTEM_NOTIFICATIONS_ROW_TITLE = '__EDU_SYSTEM_NOTIFICATIONS_V1__';

export function normalizeBookCoverTitleKey(title?: string): string {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function isSystemBookConfigRow(book: any): boolean {
  if (!book) return false;
  return (
    book.id === GLOBAL_BOOK_COVERS_ROW_ID ||
    book.id === SYSTEM_NOTIFICATIONS_ROW_ID ||
    book.title === GLOBAL_BOOK_COVERS_ROW_TITLE ||
    book.title === SYSTEM_NOTIFICATIONS_ROW_TITLE ||
    book.category === '__SYSTEM_CONFIG__'
  );
}

/**
 * Canonical system-wide default covers so every user account (Dut Nyok, Marlon Jackson,
 * new sign-ups, guests) sees the exact same cover for every shared catalog book.
 */
export const CANONICAL_BOOK_COVERS: Record<string, BookCoverOverride> = {
  '11111111-1111-4000-8000-000000000004': {
    coverMode: 'visual',
    coverImage: '',
    pdfCoverPage: 1,
    titleKey: 'kcse golden tips physics form 4 national exam revision',
    customCover: {
      mode: 'visual',
      themeGradient: 'from-slate-700 via-slate-800 to-slate-950',
      accentBg: 'bg-slate-300',
      accentText: 'text-slate-200',
      iconType: 'atom',
      subtitle: 'Physics (232)',
      badgeText: 'KCSE CURRICULUM',
      pattern: 'grid',
      pdfPageNumber: 1,
    },
    updatedAt: '2026-11-06T10:01:38.014Z',
  },
  '11111111-1111-4000-8000-000000000003': {
    coverMode: 'visual',
    coverImage: '',
    pdfCoverPage: 1,
    titleKey: 'cbc grade 10 senior secondary physics foundation',
    customCover: {
      mode: 'visual',
      themeGradient: 'from-slate-700 via-slate-800 to-slate-950',
      accentBg: 'bg-slate-300',
      accentText: 'text-slate-200',
      iconType: 'atom',
      subtitle: 'Computer Science & Physics',
      badgeText: 'CBC CURRICULUM',
      pattern: 'grid',
      pdfPageNumber: 1,
    },
    updatedAt: '2026-11-06T10:01:07.112Z',
  },
  '11111111-1111-4000-8000-000000000005': {
    coverMode: 'image',
    coverImage: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=80',
    pdfCoverPage: 1,
    titleKey: 'kcse top mark mathematics form 4 with past papers',
    customCover: {
      mode: 'image',
      themeGradient: 'from-blue-800 to-indigo-950',
      accentBg: 'bg-sky-400',
      accentText: 'text-sky-300',
      iconType: 'math',
      subtitle: 'Mathematics (121)',
      badgeText: 'ADVANCED MATHEMATICS',
      pattern: 'grid',
      pdfPageNumber: 1,
    },
    updatedAt: '2026-11-06T09:57:32.786Z',
  },
  'cbc-g9-kiswahili': {
    coverMode: 'visual',
    coverImage: '',
    pdfCoverPage: 1,
    titleKey: 'cbc kidato cha kwanza: kiswahili sanifu',
    customCover: {
      mode: 'visual',
      themeGradient: 'from-stone-700 via-amber-900 to-stone-950',
      accentBg: 'bg-yellow-400',
      accentText: 'text-yellow-300',
      iconType: 'literature',
      subtitle: 'Kiswahili',
      badgeText: 'CBC CURRICULUM',
      pattern: 'grid',
      pdfPageNumber: 1,
    },
    updatedAt: '2026-11-06T09:59:59.458Z',
  },
  'cbc-g9-agri': {
    coverMode: 'image',
    coverImage: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&auto=format&fit=crop&q=80',
    pdfCoverPage: 1,
    titleKey: 'cbc grade 9 agriculture & nutrition',
    customCover: {
      mode: 'image',
      themeGradient: 'from-amber-700 to-emerald-950',
      accentBg: 'bg-sky-400',
      accentText: 'text-sky-300',
      iconType: 'agriculture',
      subtitle: 'Agriculture',
      badgeText: 'AGRICULTURE & BIOSYSTEMS',
      pattern: 'grid',
      pdfPageNumber: 1,
    },
    updatedAt: '2026-11-06T09:58:32.071Z',
  },
  '11111111-1111-4000-8000-000000000001': {
    coverMode: 'image',
    coverImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop&q=80',
    pdfCoverPage: 1,
    titleKey: 'top scholar junior secondary grade 9 mathematics',
    customCover: {
      mode: 'image',
      themeGradient: 'from-sky-700 to-slate-900',
      accentBg: 'bg-sky-400',
      accentText: 'text-sky-300',
      iconType: 'graduation',
      subtitle: 'Mathematics',
      badgeText: 'KENYAN CBC GRADE 9',
      pattern: 'grid',
      pdfPageNumber: 1,
    },
    updatedAt: '2026-11-06T09:58:02.558Z',
  },
  'cbc-g10-english': {
    coverMode: 'image',
    coverImage: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&auto=format&fit=crop&q=80',
    pdfCoverPage: 1,
    titleKey: 'cbc grade 10 english literature & literacy',
    customCover: {
      mode: 'image',
      themeGradient: 'from-rose-800 to-red-950',
      accentBg: 'bg-sky-400',
      accentText: 'text-sky-300',
      iconType: 'literature',
      subtitle: 'English Language',
      badgeText: 'LITERATURE & ARTS',
      pattern: 'grid',
      pdfPageNumber: 1,
    },
    updatedAt: '2026-11-06T09:59:29.668Z',
  },
  '11111111-1111-4000-8000-000000000002': {
    coverMode: 'image',
    coverImage: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?w=800&auto=format&fit=crop&q=80',
    pdfCoverPage: 1,
    titleKey: "spark integrated science grade 9 learner's book",
    customCover: {
      mode: 'image',
      themeGradient: 'from-green-700 to-emerald-950',
      accentBg: 'bg-sky-400',
      accentText: 'text-sky-300',
      iconType: 'dna',
      subtitle: 'Integrated Science',
      badgeText: 'LIFE SCIENCES',
      pattern: 'grid',
      pdfPageNumber: 1,
    },
    updatedAt: '2026-11-06T10:00:33.220Z',
  },
  'cbc-g9-intscience': {
    coverMode: 'image',
    coverImage: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&auto=format&fit=crop&q=80',
    pdfCoverPage: 1,
    titleKey: 'cbc grade 9 integrated science',
    customCover: {
      mode: 'image',
      themeGradient: 'from-emerald-700 to-teal-950',
      accentBg: 'bg-sky-400',
      accentText: 'text-sky-300',
      iconType: 'chemistry',
      subtitle: 'Integrated Science',
      badgeText: 'ORGANIC CHEMISTRY',
      pattern: 'grid',
      pdfPageNumber: 1,
    },
    updatedAt: '2026-11-06T09:59:09.677Z',
  },
  'cbc-g9-socialstudies': {
    coverMode: 'image',
    coverImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&auto=format&fit=crop&q=80',
    pdfCoverPage: 1,
    titleKey: 'cbc grade 9 social studies & civics',
    customCover: {
      mode: 'image',
      themeGradient: 'from-cyan-800 to-slate-900',
      accentBg: 'bg-sky-400',
      accentText: 'text-sky-300',
      iconType: 'globe',
      subtitle: 'Social Studies',
      badgeText: 'GEOGRAPHY & CARTOGRAPHY',
      pattern: 'grid',
      pdfPageNumber: 1,
    },
    updatedAt: '2026-11-06T09:58:54.414Z',
  },
  'klb-physics-1': {
    coverMode: 'image',
    coverImage: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=800&auto=format&fit=crop&q=80',
    pdfCoverPage: 1,
    titleKey: 'klb secondary physics book 1',
    customCover: {
      mode: 'image',
      themeGradient: 'from-teal-700 to-cyan-950',
      accentBg: 'bg-sky-400',
      accentText: 'text-sky-300',
      iconType: 'atom',
      subtitle: 'Physics',
      badgeText: 'PHYSICAL SCIENCES',
      pattern: 'grid',
      pdfPageNumber: 1,
    },
    updatedAt: '2026-11-06T09:58:17.119Z',
  },
};

export function mergeGlobalBookCoversMaps(
  ...maps: Array<Record<string, BookCoverOverride> | undefined | null>
): Record<string, BookCoverOverride> {
  const result: Record<string, BookCoverOverride> = {};
  for (const src of maps) {
    if (!src || typeof src !== 'object') continue;
    for (const [bookId, raw] of Object.entries(src)) {
      if (!bookId || !raw || typeof raw !== 'object') continue;
      const prev = result[bookId];
      if (!prev) {
        result[bookId] = { ...raw };
        continue;
      }
      const prevTs = prev.updatedAt ? Date.parse(prev.updatedAt) || 0 : 0;
      const nextTs = raw.updatedAt ? Date.parse(raw.updatedAt) || 0 : 0;
      result[bookId] = nextTs >= prevTs ? { ...prev, ...raw } : { ...raw, ...prev };
    }
  }
  return result;
}

export function buildTitleLookupIndex(
  coversMap: Record<string, BookCoverOverride>
): Map<string, BookCoverOverride> {
  const byTitle = new Map<string, BookCoverOverride>();
  for (const override of Object.values(coversMap || {})) {
    if (!override?.titleKey) continue;
    const key = normalizeBookCoverTitleKey(override.titleKey);
    if (!key) continue;
    const prev = byTitle.get(key);
    if (!prev) {
      byTitle.set(key, override);
    } else {
      const prevTs = prev.updatedAt ? Date.parse(prev.updatedAt) || 0 : 0;
      const nextTs = override.updatedAt ? Date.parse(override.updatedAt) || 0 : 0;
      if (nextTs >= prevTs) byTitle.set(key, override);
    }
  }
  return byTitle;
}

export function applyGlobalBookCover<T extends Book>(
  book: T,
  coversMap: Record<string, BookCoverOverride>,
  titleIndex?: Map<string, BookCoverOverride>
): T {
  if (!book || !book.id) return book;
  const direct = coversMap?.[book.id];
  const resolvedTitleIndex = titleIndex || buildTitleLookupIndex(coversMap);
  const byTitle = !direct && book.title ? resolvedTitleIndex.get(normalizeBookCoverTitleKey(book.title)) : undefined;
  const override = direct || byTitle;
  if (!override) return book;

  return {
    ...book,
    coverMode: override.coverMode || book.coverMode,
    coverImage: override.coverImage !== undefined ? override.coverImage : book.coverImage,
    pdfCoverPage: override.pdfCoverPage ?? book.pdfCoverPage,
    customCover: override.customCover || book.customCover,
  };
}

export function applyGlobalBookCoversToList<T extends Book>(
  books: T[],
  coversMap: Record<string, BookCoverOverride>
): T[] {
  if (!Array.isArray(books) || books.length === 0) return books;
  const titleIndex = buildTitleLookupIndex(coversMap);
  return books.map((b) => applyGlobalBookCover(b, coversMap, titleIndex));
}
