export interface SubjectCategoryResolution {
  label: string;
  slug: string;
  matchedFrom: 'override' | 'subject' | 'title' | 'category' | 'default';
}

export interface B2CurriculumPathInfo {
  prefix: string;
  curriculumShelf: string;
  curriculumSlug: string;
  subjectCategory: string;
  subjectCategorySlug: string;
  matchedFrom: SubjectCategoryResolution['matchedFrom'];
}

export interface ParsedB2CurriculumKey {
  isCurriculumShelfPath: boolean;
  curriculumShelf?: string;
  curriculumSlug?: string;
  subjectCategory?: string;
  subjectCategorySlug?: string;
  filename: string;
}

export const CANONICAL_SUBJECT_CATEGORIES: ReadonlyArray<{
  label: string;
  slug: string;
  keywords: string[];
}> = [
  {
    label: 'Mathematics',
    slug: 'Mathematics',
    keywords: [
      'mathematics',
      'math',
      'maths',
      'algebra',
      'calculus',
      'geometry',
      'trigonometry',
      'statistics',
      'differential equations',
      'quantitative',
      '121',
    ],
  },
  {
    label: 'Chemistry',
    slug: 'Chemistry',
    keywords: [
      'chemistry',
      'organic chemistry',
      'inorganic chemistry',
      'physical chemistry',
      'analytical chemistry',
      'biochemistry',
      'electrochemistry',
      'titration',
      'qualitative analysis',
      '233',
    ],
  },
  {
    label: 'Physics',
    slug: 'Physics',
    keywords: [
      'physics',
      'mechanics',
      'optics',
      'electromagnetism',
      'thermodynamics',
      'quantum',
      'modern physics',
      'electrostatics',
      '232',
    ],
  },
  {
    label: 'Biology',
    slug: 'Biology',
    keywords: [
      'biology',
      'botany',
      'zoology',
      'genetics',
      'ecology',
      'cell biology',
      'microbiology',
      'physiology',
      'microscopy',
      '231',
    ],
  },
  {
    label: 'Integrated Science',
    slug: 'Integrated-Science',
    keywords: ['integrated science', 'general science', 'combined science'],
  },
  {
    label: 'Computer Science & ICT',
    slug: 'Computer-Science-and-ICT',
    keywords: [
      'computer science',
      'ict',
      'information and communication technologies',
      'computing',
      'software engineering',
      'cybersecurity',
      'data science',
      'artificial intelligence',
      'machine learning',
      'algorithms',
      'web development',
      'network engineering',
      'database management',
      'cloud computing',
      'information systems',
      'programming',
    ],
  },
  {
    label: 'English Language',
    slug: 'English-Language',
    keywords: ['english language', 'english', 'grammar', 'composition', 'literacy', '101'],
  },
  {
    label: 'Kiswahili',
    slug: 'Kiswahili',
    keywords: ['kiswahili', 'swahili', 'fasihi', 'sarufi', 'insha', '102'],
  },
  {
    label: 'Literature',
    slug: 'Literature',
    keywords: ['literature', 'english literature', 'poetry', 'drama', 'literary'],
  },
  {
    label: 'History',
    slug: 'History',
    keywords: ['history', 'world history', 'government', 'african studies'],
  },
  {
    label: 'Geography',
    slug: 'Geography',
    keywords: ['geography', 'human geography', 'physical geography', 'geology', 'climatology', 'environmental science', '312'],
  },
  {
    label: 'Social Studies',
    slug: 'Social-Studies',
    keywords: ['social studies', 'social sciences', 'civics', 'citizenship', 'political science', 'international relations'],
  },
  {
    label: 'Agriculture',
    slug: 'Agriculture',
    keywords: [
      'agriculture',
      'agronomy',
      'crop science',
      'soil science',
      'animal science',
      'horticulture',
      'forestry',
      'fisheries',
      'veterinary',
      'agricultural economics',
    ],
  },
  {
    label: 'Business Studies',
    slug: 'Business-Studies',
    keywords: [
      'business studies',
      'business',
      'commerce',
      'entrepreneurship',
      'marketing',
      'management',
      'human resources',
      'international business',
      'public administration',
      'business, administration, and law',
    ],
  },
  {
    label: 'Accounting & Finance',
    slug: 'Accounting-and-Finance',
    keywords: ['accounting', 'finance', 'auditing', 'banking', 'corporate finance'],
  },
  {
    label: 'Economics',
    slug: 'Economics',
    keywords: ['economics', 'microeconomics', 'macroeconomics', 'econometrics'],
  },
  {
    label: 'Law',
    slug: 'Law',
    keywords: ['law', 'constitutional law', 'contract law', 'criminal law', 'business law', 'jurisprudence'],
  },
  {
    label: 'Engineering',
    slug: 'Engineering',
    keywords: [
      'engineering',
      'civil engineering',
      'mechanical engineering',
      'electrical engineering',
      'electronic engineering',
      'chemical engineering',
      'architecture',
      'urban planning',
      'construction management',
      'manufacturing technology',
      'materials science',
    ],
  },
  {
    label: 'Health & Medicine',
    slug: 'Health-and-Medicine',
    keywords: [
      'health and welfare',
      'medicine',
      'nursing',
      'pharmacy',
      'dentistry',
      'public health',
      'physical therapy',
      'medical technology',
      'anatomy',
      'pharmacology',
    ],
  },
  {
    label: 'Psychology & Sociology',
    slug: 'Psychology-and-Sociology',
    keywords: ['psychology', 'sociology', 'anthropology', 'criminology', 'social work', 'social policy'],
  },
  {
    label: 'Arts & Design',
    slug: 'Arts-and-Design',
    keywords: [
      'arts and humanities',
      'art',
      'fine arts',
      'graphic design',
      'fashion design',
      'music',
      'performing arts',
      'philosophy',
      'linguistics',
    ],
  },
  {
    label: 'Physical Education',
    slug: 'Physical-Education',
    keywords: ['physical education', 'sports', 'kinesiology', 'athletics'],
  },
  {
    label: 'Religious Education',
    slug: 'Religious-Education',
    keywords: ['religious education', 'cre', 'ire', 'hre', 'christian religious education', 'islamic religious education'],
  },
  {
    label: 'Home Science & Services',
    slug: 'Home-Science-and-Services',
    keywords: ['home science', 'tourism', 'hospitality', 'culinary', 'logistics', 'services', 'nutrition'],
  },
];

const CURRICULUM_DISPLAY_ALIASES: Record<string, { label: string; slug: string }> = {
  cbc: { label: 'CBC', slug: 'CBC' },
  kcse: { label: 'KCSE', slug: 'KCSE' },
  igcse: { label: 'IGCSE', slug: 'IGCSE' },
  ib: { label: 'IB', slug: 'IB' },
  'a-levels': { label: 'A-Levels', slug: 'A-Levels' },
  'gce a-levels': { label: 'GCE A-Levels', slug: 'GCE-A-Levels' },
  ap: { label: 'AP', slug: 'AP' },
  'sat/act': { label: 'SAT/ACT', slug: 'SAT-ACT' },
  wassce: { label: 'WASSCE', slug: 'WASSCE' },
  nsc: { label: 'NSC', slug: 'NSC' },
  cbse: { label: 'CBSE', slug: 'CBSE' },
  icse: { label: 'ICSE', slug: 'ICSE' },
  'national curriculum': { label: 'National Curriculum', slug: 'National-Curriculum' },
  'provincial curriculum': { label: 'Provincial Curriculum', slug: 'Provincial-Curriculum' },
  university: { label: 'University', slug: 'University' },
  college: { label: 'College', slug: 'College' },
  graduate: { label: 'Graduate', slug: 'Graduate' },
  postgraduate: { label: 'Postgraduate', slug: 'Postgraduate' },
  vocational: { label: 'Vocational', slug: 'Vocational' },
  general: { label: 'General Curriculum', slug: 'General-Curriculum' },
  'general curriculum': { label: 'General Curriculum', slug: 'General-Curriculum' },
};

const SLUG_TO_CURRICULUM_LABEL = new Map<string, string>(
  Object.values(CURRICULUM_DISPLAY_ALIASES).map((entry) => [entry.slug.toLowerCase(), entry.label])
);

const SLUG_TO_SUBJECT_LABEL = new Map<string, string>(
  CANONICAL_SUBJECT_CATEGORIES.map((entry) => [entry.slug.toLowerCase(), entry.label])
);

/**
 * Sanitizes a single path segment (folder name or filename) for local disk & B2 object keys.
 * Removes path traversal, slashes, leading dots, and disallowed special characters.
 */
export function sanitizePathSegment(raw: string, fallback = 'General'): string {
  const cleaned = String(raw || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, '-and-')
    .replace(/[\/\\]+/g, '-')
    .replace(/\.\.+/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!cleaned || cleaned === '.' || cleaned === '..') return fallback;
  return cleaned;
}

export function sanitizeB2Prefix(rawPrefix?: string | null, fallback = 'uploads'): string {
  if (!rawPrefix) return fallback;
  const segments = String(rawPrefix)
    .replace(/\\/g, '/')
    .split('/')
    .map((seg) => seg.trim())
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .map((seg) => sanitizePathSegment(seg, ''))
    .filter(Boolean);
  return segments.length > 0 ? segments.join('/') : fallback;
}

export function sanitizeB2ObjectKey(rawKey?: string | null): string {
  if (!rawKey) return '';
  const segments = String(rawKey)
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\\/g, '/')
    .split('/')
    .map((seg) => seg.trim())
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .map((seg) => seg.replace(/^\.+/, ''))
    .filter(Boolean);
  return segments.join('/');
}

export function resolveCurriculumShelf(
  curriculum?: string | string[] | null,
  level?: string | null
): { label: string; slug: string } {
  const rawCurr = Array.isArray(curriculum) ? curriculum[0] : curriculum;
  const trimmedCurr = String(rawCurr || '').trim();
  const currLower = trimmedCurr.toLowerCase();

  if (trimmedCurr && currLower !== 'general' && currLower !== 'all' && currLower !== 'none') {
    const alias = CURRICULUM_DISPLAY_ALIASES[currLower];
    if (alias) return alias;
    return {
      label: trimmedCurr,
      slug: sanitizePathSegment(trimmedCurr, 'General-Curriculum'),
    };
  }

  const trimmedLevel = String(level || '').trim();
  const levelLower = trimmedLevel.toLowerCase();
  if (
    levelLower === 'university' ||
    levelLower === 'college' ||
    levelLower === 'graduate' ||
    levelLower === 'postgraduate' ||
    levelLower === 'vocational'
  ) {
    const alias = CURRICULUM_DISPLAY_ALIASES[levelLower];
    if (alias) return alias;
    return {
      label: trimmedLevel,
      slug: sanitizePathSegment(trimmedLevel, 'University'),
    };
  }

  return { label: 'General Curriculum', slug: 'General-Curriculum' };
}

function normalizeSubjectInputList(subjects?: string | string[] | null): string[] {
  if (Array.isArray(subjects)) {
    return subjects.map((s) => String(s || '').trim()).filter(Boolean);
  }
  if (typeof subjects === 'string') {
    return subjects
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function matchCanonicalSubjectCategory(text: string): { label: string; slug: string } | null {
  const lower = text.trim().toLowerCase();
  if (!lower) return null;

  // 1. Exact label or keyword match first
  for (const cat of CANONICAL_SUBJECT_CATEGORIES) {
    if (cat.label.toLowerCase() === lower || cat.keywords.some((kw) => kw === lower)) {
      return { label: cat.label, slug: cat.slug };
    }
  }

  // 2. Partial phrase containment for compound titles/subjects (e.g. "KCSE Form 3 Organic Chemistry")
  for (const cat of CANONICAL_SUBJECT_CATEGORIES) {
    if (
      cat.keywords.some((kw) => kw.length >= 4 && lower.includes(kw)) ||
      lower.includes(cat.label.toLowerCase())
    ) {
      return { label: cat.label, slug: cat.slug };
    }
  }

  return null;
}

export function resolveSubjectCategory(params: {
  subjects?: string | string[] | null;
  subjectCategoryOverride?: string | null;
  category?: string | null;
  title?: string | null;
}): SubjectCategoryResolution {
  const override = String(params.subjectCategoryOverride || '').trim();
  if (override && override.toLowerCase() !== 'auto') {
    const matched = matchCanonicalSubjectCategory(override);
    if (matched) {
      return { ...matched, matchedFrom: 'override' };
    }
    return {
      label: override,
      slug: sanitizePathSegment(override, 'General-Studies'),
      matchedFrom: 'override',
    };
  }

  const subjectList = normalizeSubjectInputList(params.subjects);
  if (subjectList.length > 0) {
    for (const subj of subjectList) {
      const matched = matchCanonicalSubjectCategory(subj);
      if (matched) {
        return { ...matched, matchedFrom: 'subject' };
      }
    }
    // Preserve custom user-entered primary subject as its own shelf folder cleanly
    const primary = subjectList[0];
    return {
      label: primary,
      slug: sanitizePathSegment(primary, 'General-Studies'),
      matchedFrom: 'subject',
    };
  }

  const titleText = String(params.title || '').trim();
  if (titleText) {
    const fromTitle = matchCanonicalSubjectCategory(titleText);
    if (fromTitle) {
      return { ...fromTitle, matchedFrom: 'title' };
    }
  }

  const fallbackCat = String(params.category || '').trim();
  if (fallbackCat && !['textbook', 'research paper', 'study guide', 'past paper', 'revision guide', 'general'].includes(fallbackCat.toLowerCase())) {
    const fromCategory = matchCanonicalSubjectCategory(fallbackCat);
    if (fromCategory) {
      return { ...fromCategory, matchedFrom: 'category' };
    }
    return {
      label: fallbackCat,
      slug: sanitizePathSegment(fallbackCat, 'General-Studies'),
      matchedFrom: 'category',
    };
  }

  return {
    label: 'General Studies',
    slug: 'General-Studies',
    matchedFrom: 'default',
  };
}

export function buildB2CurriculumPath(params: {
  curriculum?: string | string[] | null;
  subjects?: string | string[] | null;
  subjectCategoryOverride?: string | null;
  category?: string | null;
  level?: string | null;
  title?: string | null;
}): B2CurriculumPathInfo {
  const shelf = resolveCurriculumShelf(params.curriculum, params.level);
  const subjectCat = resolveSubjectCategory({
    subjects: params.subjects,
    subjectCategoryOverride: params.subjectCategoryOverride,
    category: params.category,
    title: params.title,
  });

  return {
    prefix: `curriculums/${shelf.slug}/${subjectCat.slug}`,
    curriculumShelf: shelf.label,
    curriculumSlug: shelf.slug,
    subjectCategory: subjectCat.label,
    subjectCategorySlug: subjectCat.slug,
    matchedFrom: subjectCat.matchedFrom,
  };
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/-and-/gi, ' & ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses a B2 object key like `curriculums/KCSE/Chemistry/1732...-book.pdf`
 * back into its Curriculum Shelf and Subject Category metadata.
 */
export function parseB2CurriculumKey(key: string): ParsedB2CurriculumKey {
  const cleanKey = String(key || '').replace(/^\/+/, '');
  const parts = cleanKey.split('/').filter(Boolean);
  const filename = parts[parts.length - 1] || cleanKey;

  if (parts.length >= 4 && parts[0].toLowerCase() === 'curriculums') {
    const currSlug = parts[1];
    const subjSlug = parts[2];
    const currLabel = SLUG_TO_CURRICULUM_LABEL.get(currSlug.toLowerCase()) || humanizeSlug(currSlug);
    const subjLabel = SLUG_TO_SUBJECT_LABEL.get(subjSlug.toLowerCase()) || humanizeSlug(subjSlug);
    return {
      isCurriculumShelfPath: true,
      curriculumShelf: currLabel,
      curriculumSlug: currSlug,
      subjectCategory: subjLabel,
      subjectCategorySlug: subjSlug,
      filename,
    };
  }

  return {
    isCurriculumShelfPath: false,
    filename,
  };
}

export function sanitizeStorageBookId(bookId: string): string {
  return String(bookId || 'book')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96) || 'book';
}

export function buildGeneratedEpubKey(bookId: string, version = 1): string {
  const safeId = sanitizeStorageBookId(bookId);
  const v = Math.max(1, Math.floor(version));
  return `generated-epubs/${safeId}/v${v}/book.epub`;
}

export function buildExtractedAssetKey(bookId: string, filename: string): string {
  const safeId = sanitizeStorageBookId(bookId);
  const safeFile = sanitizePathSegment(filename, `asset-${Date.now()}.png`).replace(/^-+/, '');
  return `extracted-assets/${safeId}/${safeFile}`;
}

export function isDerivedStorageKey(key?: string | null): boolean {
  const clean = String(key || '').replace(/^\/+/, '').toLowerCase();
  return (
    clean.startsWith('generated-epubs/') ||
    clean.startsWith('extracted-assets/') ||
    clean.startsWith('user-sync/') ||
    clean.startsWith('audiobook-cache/') ||
    clean.startsWith('.chunks/')
  );
}
