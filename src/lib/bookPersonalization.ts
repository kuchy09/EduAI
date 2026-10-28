import { Book } from '../types';
import { safeStorage } from './safeStorage';

export const ACADEMIC_PREFS_EVENT = 'edu-academic-prefs-updated';

export const EDUCATION_LEVELS = [
  'Primary',
  'High School',
  'College',
  'University',
  'Graduate',
  'Postgraduate',
  'Vocational',
] as const;

export const COUNTRIES_WITH_CURRICULA: { name: string; curriculum: string }[] = [
  { name: 'Kenya', curriculum: 'CBC' },
  { name: 'United States', curriculum: 'AP' },
  { name: 'United Kingdom', curriculum: 'A-Levels' },
  { name: 'Nigeria', curriculum: 'WASSCE' },
  { name: 'Ghana', curriculum: 'WASSCE' },
  { name: 'South Africa', curriculum: 'NSC' },
  { name: 'Uganda', curriculum: 'National Curriculum' },
  { name: 'Tanzania', curriculum: 'National Curriculum' },
  { name: 'Rwanda', curriculum: 'CBC' },
  { name: 'Canada', curriculum: 'Provincial Curriculum' },
  { name: 'Australia', curriculum: 'National Curriculum' },
  { name: 'India', curriculum: 'CBSE' },
  { name: 'Germany', curriculum: 'Abitur' },
  { name: 'France', curriculum: 'Baccalaureate' },
  { name: 'China', curriculum: 'Gaokao' },
  { name: 'Japan', curriculum: 'National Curriculum' },
  { name: 'Singapore', curriculum: 'GCE A-Levels' },
  { name: 'Egypt', curriculum: 'Thanaweya Amma' },
  { name: 'Brazil', curriculum: 'ENEM' },
  { name: 'Mexico', curriculum: 'Bachillerato' },
  { name: 'Italy', curriculum: 'Maturità' },
  { name: 'Spain', curriculum: 'Bachillerato' },
  { name: 'Netherlands', curriculum: 'VWO/HAVO' },
  { name: 'Ireland', curriculum: 'Leaving Certificate' },
  { name: 'Pakistan', curriculum: 'Matriculation' },
  { name: 'Bangladesh', curriculum: 'HSC' },
  { name: 'Indonesia', curriculum: 'National Curriculum' },
  { name: 'South Korea', curriculum: 'CSAT' },
  { name: 'Finland', curriculum: 'Ylioppilastutkinto' },
  { name: 'Turkey', curriculum: 'National Curriculum' },
  { name: 'Other', curriculum: 'IB' },
];

export const CURRICULA = [
  'CBC',
  'KCSE',
  'IGCSE',
  'IB',
  'A-Levels',
  'GCE A-Levels',
  'AP',
  'SAT/ACT',
  'WASSCE',
  'NSC',
  'CBSE',
  'ICSE',
  'National Curriculum',
  'Provincial Curriculum',
  'Abitur',
  'Baccalaureate',
  'Gaokao',
  'Thanaweya Amma',
  'ENEM',
  'Bachillerato',
  'Maturità',
  'VWO/HAVO',
  'Leaving Certificate',
  'Matriculation',
  'HSC',
  'CSAT',
  'Ylioppilastutkinto',
  'Other',
];

export const FIELDS_OF_STUDY = [
  'Business, Administration, and Law',
  'Engineering, Manufacturing, and Construction',
  'Information and Communication Technologies (ICT)',
  'Health and Welfare',
  'Natural Sciences, Mathematics, and Statistics',
  'Arts and Humanities',
  'Social Sciences',
  'Agriculture, Forestry, Fisheries, and Veterinary',
  'Services',
];

export const SCHOOL_SUBJECTS = [
  'Mathematics',
  'English Language',
  'Kiswahili',
  'Biology',
  'Chemistry',
  'Physics',
  'Integrated Science',
  'History',
  'Geography',
  'Social Studies',
  'Computer Science',
  'Agriculture',
  'Literature',
  'Economics',
  'Business Studies',
  'Art',
  'Music',
  'Physical Education',
  'Psychology',
  'Sociology',
];

export const COLLEGE_SUBJECTS_MAP: Record<string, string[]> = {
  'Business, Administration, and Law': [
    'Accounting', 'Marketing', 'Finance', 'Management', 'Business Law',
    'Economics', 'Human Resources', 'International Business',
    'Public Administration', 'Constitutional Law', 'Contract Law', 'Criminal Law',
  ],
  'Engineering, Manufacturing, and Construction': [
    'Civil Engineering', 'Mechanical Engineering', 'Electrical Engineering',
    'Electronic Engineering', 'Chemical Engineering', 'Architecture',
    'Urban Planning', 'Construction Management', 'Manufacturing Technology', 'Materials Science',
  ],
  'Information and Communication Technologies (ICT)': [
    'Computer Science', 'Software Engineering', 'Cybersecurity', 'Data Science',
    'Web Development', 'Network Engineering', 'Artificial Intelligence',
    'Database Management', 'Information Systems', 'Cloud Computing',
  ],
  'Health and Welfare': [
    'Medicine', 'Nursing', 'Pharmacy', 'Dentistry', 'Public Health',
    'Physical Therapy', 'Medical Technology', 'Social Work', 'Psychology', 'Veterinary Nursing',
  ],
  'Natural Sciences, Mathematics, and Statistics': [
    'Biology', 'Chemistry', 'Physics', 'Mathematics', 'Statistics',
    'Geology', 'Astronomy', 'Environmental Science', 'Biochemistry', 'Genetics',
  ],
  'Arts and Humanities': [
    'Fine Arts', 'Graphic Design', 'Fashion Design', 'History', 'Philosophy',
    'Literature', 'Modern Languages', 'Linguistics', 'Music', 'Performing Arts',
  ],
  'Social Sciences': [
    'Sociology', 'Political Science', 'Anthropology', 'International Relations',
    'Criminology', 'Media Studies', 'Journalism', 'Social Policy', 'Human Geography',
  ],
  'Agriculture, Forestry, Fisheries, and Veterinary': [
    'Crop Science', 'Animal Science', 'Forestry', 'Fisheries Science',
    'Veterinary Medicine', 'Horticulture', 'Soil Science', 'Agricultural Economics',
  ],
  'Services': [
    'Tourism', 'Hospitality Management', 'Culinary Arts', 'Transportation',
    'Logistics', 'Security Services', 'Personal Services', 'Occupational Health',
  ],
};

export interface UserAcademicProfile {
  country: string;
  educationLevel: string;
  curriculum: string;
  fieldOfStudy: string;
  subjects: string[];
  isSchoolLevel: boolean;
  isHigherEd: boolean;
  isConfigured: boolean;
  summaryLabel: string;
}

export interface AiBookRecommendation {
  book: Book;
  matchReason: string;
  matchScore: number;
  matchedSubjects: string[];
}

const PLACEHOLDER_VALUES = new Set([
  '',
  'general',
  'active student',
  'online learning platform',
  'edu ai global access',
  'none',
  'null',
  'undefined',
]);

function cleanField(val: unknown): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) return '';
  return trimmed;
}

function parseSubjectsList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter((s) => s.length > 0 && !PLACEHOLDER_VALUES.has(s.toLowerCase()))
      )
    );
  }
  if (typeof raw === 'string') {
    return Array.from(
      new Set(
        raw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !PLACEHOLDER_VALUES.has(s.toLowerCase()))
      )
    );
  }
  return [];
}

function getPrefsStorageKey(userId?: string): string {
  return userId ? `edu_academic_prefs_${userId}` : 'edu_academic_prefs_active';
}

export function getStoredAcademicPrefs(userId?: string): Partial<{
  country: string;
  education_level: string;
  curriculum: string;
  field_of_study: string;
  subjects: string;
}> {
  if (!userId) return {};
  try {
    const raw = safeStorage.getItem(getPrefsStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function saveStoredAcademicPrefs(
  userId: string | undefined,
  prefs: {
    country?: string;
    education_level?: string;
    curriculum?: string;
    field_of_study?: string;
    subjects?: string;
  }
): void {
  if (!userId) return;
  try {
    safeStorage.setItem(getPrefsStorageKey(userId), JSON.stringify(prefs));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ACADEMIC_PREFS_EVENT, { detail: prefs }));
    }
  } catch (_) {}
}

export function extractUserAcademicProfile(profile: any, user: any): UserAcademicProfile {
  const userId = user?.id || profile?.id;
  const cached = getStoredAcademicPrefs(userId);
  const meta = user?.user_metadata || {};

  const country =
    cleanField(profile?.country) ||
    cleanField(profile?.location) ||
    cleanField(meta?.country) ||
    cleanField(cached?.country);

  const educationLevel =
    cleanField(profile?.education_level) ||
    cleanField(meta?.education_level) ||
    cleanField(cached?.education_level);

  const curriculum =
    cleanField(profile?.curriculum) ||
    cleanField(meta?.curriculum) ||
    cleanField(cached?.curriculum);

  const fieldOfStudy =
    cleanField(profile?.field_of_study) ||
    cleanField(meta?.field_of_study) ||
    cleanField(cached?.field_of_study);

  const profileSubjects = parseSubjectsList(profile?.subjects);
  const metaSubjects = parseSubjectsList(meta?.subjects);
  const cachedSubjects = parseSubjectsList(cached?.subjects);

  const subjects =
    profileSubjects.length > 0
      ? profileSubjects
      : metaSubjects.length > 0
        ? metaSubjects
        : cachedSubjects;

  const edLower = educationLevel.toLowerCase();
  const isSchoolLevel =
    edLower === 'primary' ||
    edLower === 'high school' ||
    edLower === 'junior school' ||
    edLower === 'senior school' ||
    edLower === 'secondary' ||
    edLower === 'school';

  const isHigherEd =
    edLower === 'college' ||
    edLower === 'university' ||
    edLower === 'graduate' ||
    edLower === 'postgraduate' ||
    edLower === 'vocational';

  const isConfigured = Boolean(
    educationLevel &&
      (subjects.length > 0 || curriculum || fieldOfStudy)
  );

  const summaryParts: string[] = [];
  if (country) summaryParts.push(country);
  if (educationLevel) summaryParts.push(educationLevel);
  if (isSchoolLevel && curriculum) {
    summaryParts.push(curriculum);
  } else if (fieldOfStudy) {
    const shortField = fieldOfStudy.includes('(')
      ? fieldOfStudy.match(/\(([^)]+)\)/)?.[1] || fieldOfStudy.split(',')[0]
      : fieldOfStudy.split(',')[0];
    summaryParts.push(shortField.trim());
  }

  return {
    country,
    educationLevel,
    curriculum,
    fieldOfStudy,
    subjects,
    isSchoolLevel,
    isHigherEd,
    isConfigured,
    summaryLabel: summaryParts.join(' • ') || 'Personalized Study Profile',
  };
}

const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'united kingdom',
  'u.k.': 'united kingdom',
  'great britain': 'united kingdom',
  england: 'united kingdom',
  'united kingdom': 'united kingdom',
  us: 'united states',
  usa: 'united states',
  'u.s.': 'united states',
  'u.s.a.': 'united states',
  'united states of america': 'united states',
  'united states': 'united states',
};

export function normalizeCountryName(country: string): string {
  const c = country.trim().toLowerCase();
  return COUNTRY_ALIASES[c] || c;
}

function isUniversalCountryTag(country: string): boolean {
  const c = country.trim().toLowerCase();
  return c === 'international' || c === 'global' || c === 'all' || c === 'worldwide';
}

export function normalizeCurriculumName(curr: string): string {
  const c = curr.trim().toLowerCase();
  if (c === 'gce a-levels' || c === 'a-level' || c === 'a levels') return 'a-levels';
  if (c === 'ib diploma') return 'ib';
  return c;
}

const SUBJECT_SYNONYM_GROUPS: Record<string, string[]> = {
  mathematics: ['mathematics', 'math', 'maths', 'algebra', 'calculus', 'geometry', 'trigonometry', 'statistics', 'differential equations', 'quantitative'],
  'english language': ['english', 'english language', 'literacy', 'grammar', 'english literature', 'language arts', 'composition'],
  english: ['english', 'english language', 'literacy', 'grammar', 'english literature'],
  kiswahili: ['kiswahili', 'swahili', 'fasihi', 'sarufi', 'insha'],
  literature: ['literature', 'english literature', 'fasihi', 'poetry', 'literary', 'drama'],
  biology: ['biology', 'ecology', 'botany', 'zoology', 'genetics', 'anatomy', 'physiology', 'integrated science', 'cell biology', 'microbiology'],
  chemistry: ['chemistry', 'organic chemistry', 'inorganic chemistry', 'physical chemistry', 'biochemistry', 'integrated science'],
  physics: ['physics', 'modern physics', 'mechanics', 'electromagnetism', 'thermodynamics', 'quantum', 'optics', 'integrated science', 'advanced science'],
  'integrated science': ['integrated science', 'general science', 'biology', 'chemistry', 'physics'],
  history: ['history', 'world history', 'african studies', 'civics', 'governance'],
  geography: ['geography', 'human geography', 'physical geography', 'climatology', 'geology', 'environmental science'],
  'social studies': ['social studies', 'civics', 'citizenship', 'history', 'geography', 'governance'],
  'computer science': ['computer science', 'computing', 'ict', 'software engineering', 'algorithms', 'data structures', 'programming', 'python', 'cybersecurity', 'artificial intelligence', 'machine learning', 'data science', 'web development', 'network engineering', 'database management', 'cloud computing'],
  'software engineering': ['software engineering', 'computer science', 'algorithms', 'data structures', 'programming', 'web development', 'system design'],
  cybersecurity: ['cybersecurity', 'network security', 'information security', 'cryptography'],
  'data science': ['data science', 'machine learning', 'artificial intelligence', 'statistics', 'python', 'analytics'],
  'artificial intelligence': ['artificial intelligence', 'machine learning', 'deep learning', 'neural networks', 'data science', 'algorithms'],
  economics: ['economics', 'microeconomics', 'macroeconomics', 'microeconomic', 'commerce', 'finance', 'game theory', 'agricultural economics'],
  'business studies': ['business', 'business studies', 'commerce', 'entrepreneurship', 'management', 'accounting', 'marketing', 'finance'],
  agriculture: ['agriculture', 'nutrition', 'crop science', 'soil science', 'animal science', 'horticulture', 'forestry', 'agronomy', 'fisheries'],
  art: ['art', 'fine arts', 'graphic design', 'design', 'visual arts', 'ux', 'creative arts', 'fashion design'],
  music: ['music', 'performing arts', 'music theory', 'acoustics'],
  'physical education': ['physical education', 'sports', 'kinesiology', 'athletics'],
  psychology: ['psychology', 'cognitive psychology', 'behavioral', 'neurobiology', 'mental health', 'human-computer interaction'],
  sociology: ['sociology', 'social sciences', 'anthropology', 'criminology', 'social policy', 'social work'],
  medicine: ['medicine', 'anatomy', 'physiology', 'clinical', 'pathology', 'pharmacology', 'public health', 'nursing'],
  nursing: ['nursing', 'anatomy', 'physiology', 'patient care', 'public health', 'medicine'],
  law: ['law', 'constitutional law', 'business law', 'contract law', 'criminal law', 'human rights', 'legal', 'jurisprudence'],
  'constitutional law': ['constitutional law', 'law', 'human rights', 'governance', 'public law'],
  management: ['management', 'business management', 'strategic management', 'human resources', 'public administration', 'leadership'],
  finance: ['finance', 'corporate finance', 'accounting', 'economics', 'banking', 'investment'],
  accounting: ['accounting', 'financial accounting', 'finance', 'auditing'],
  marketing: ['marketing', 'consumer behavior', 'branding'],
};

const UMBRELLA_SUBJECT_KEYS = new Set(['integrated science', 'social studies']);

function expandSubjectTerms(subject: string): string[] {
  const norm = subject.trim().toLowerCase();
  if (!norm) return [];

  // 1. Direct canonical match: never transitively merge sibling subjects via umbrella groups
  if (SUBJECT_SYNONYM_GROUPS[norm]) {
    return Array.from(new Set([norm, ...SUBJECT_SYNONYM_GROUPS[norm]]));
  }

  // 2. Compound or specialized college subject (e.g. "Algorithms & Data Structures", "Civil Engineering")
  const subParts = norm
    .split(/\s*(?:&|\/|,|\band\b)\s*/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 4);

  const terms = new Set<string>([norm, ...subParts]);
  for (const [key, synonyms] of Object.entries(SUBJECT_SYNONYM_GROUPS)) {
    if (UMBRELLA_SUBJECT_KEYS.has(key)) continue;
    if (
      synonyms.includes(norm) ||
      subParts.some((part) => key === part || synonyms.includes(part))
    ) {
      terms.add(key);
      synonyms.forEach((s) => terms.add(s));
    }
  }
  return Array.from(terms);
}

function inferBookEffectiveMetadata(book: Book): {
  effectiveLevel: 'school' | 'higher' | 'all';
  isPrimaryFriendly: boolean;
  isHighSchoolFriendly: boolean;
  countries: string[];
  curricula: string[];
  subjectTokens: string[];
} {
  const rawLevel = (book.level || '').trim().toLowerCase();
  const titleLower = (book.title || '').toLowerCase();
  const descLower = (book.description || '').toLowerCase();
  const authorLower = `${book.author || ''} ${book.publisher || ''}`.toLowerCase();
  const curricula = (book.curriculum || [])
    .map(normalizeCurriculumName)
    .filter((c) => c && c !== 'general' && c !== 'all');

  const isKlbOrKicd =
    Boolean(book.isKicdApproved) ||
    authorLower.includes('klb') ||
    authorLower.includes('kenya literature bureau') ||
    authorLower.includes('jomo kenyatta foundation') ||
    authorLower.includes('longhorn');

  if (isKlbOrKicd && curricula.length === 0) {
    curricula.push('cbc', 'kcse');
  }

  const countries = (book.country || []).map(normalizeCountryName).filter(Boolean);
  if (isKlbOrKicd && countries.length === 0) {
    countries.push('kenya');
  }

  const schoolCurriculaSet = new Set([
    'cbc', 'kcse', 'igcse', 'ib', 'a-levels', 'ap', 'sat/act',
    'wassce', 'nsc', 'cbse', 'icse', 'national curriculum',
    'provincial curriculum', 'abitur', 'baccalaureate', 'gaokao',
    'thanaweya amma', 'enem', 'bachillerato', 'maturità', 'vwo/havo',
    'leaving certificate', 'matriculation', 'hsc', 'csat', 'ylioppilastutkinto',
  ]);

  let effectiveLevel: 'school' | 'higher' | 'all' = 'all';
  if (
    rawLevel === 'school' ||
    rawLevel === 'primary' ||
    rawLevel === 'high school' ||
    rawLevel === 'secondary' ||
    rawLevel.includes('school') ||
    curricula.some((c) => schoolCurriculaSet.has(c)) ||
    /\b(grade\s*\d+|form\s*\d+|kidato|secondary|high school|primary|junior school|senior school|kcse|cbc|wassce|igcse|a-level|ap\s)\b/i.test(
      `${book.title} ${book.description || ''}`
    )
  ) {
    effectiveLevel = 'school';
  } else if (
    rawLevel === 'university' ||
    rawLevel === 'college' ||
    rawLevel === 'graduate' ||
    rawLevel === 'postgraduate' ||
    rawLevel === 'vocational' ||
    rawLevel.includes('uni') ||
    /\b(university|undergraduate|graduate|degree|pre-med|calculus vol|seminar)\b/i.test(
      `${book.title} ${book.description || ''}`
    )
  ) {
    effectiveLevel = 'higher';
  }

  // Distinguish Primary (Grades 1-6) vs High School / Junior-Senior Secondary (Grades 7-12, Forms 1-4)
  const explicitPrimary =
    rawLevel === 'primary' ||
    /\b(primary|grade\s*[1-6]\b|class\s*[1-6]\b|elementary|lower primary|upper primary)\b/i.test(
      `${book.title} ${book.description || ''}`
    );
  const explicitHighSchool =
    rawLevel === 'high school' ||
    rawLevel === 'secondary' ||
    /\b(secondary|high school|senior school|junior school|grade\s*(7|8|9|10|11|12)\b|form\s*[1-4]\b|kidato|a-level|kcse|wassce|igcse|ap\s)\b/i.test(
      `${book.title} ${book.description || ''}`
    );

  const isPrimaryFriendly = effectiveLevel !== 'higher' && (explicitPrimary || !explicitHighSchool);
  const isHighSchoolFriendly = effectiveLevel !== 'higher' && (explicitHighSchool || !explicitPrimary);

  const explicitSubjects = (book.subjects || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const inferredSubjects: string[] = [...explicitSubjects];

  // If an admin-uploaded book has no explicit subjects array, infer from title/category
  if (inferredSubjects.length === 0) {
    const searchable = `${titleLower} ${descLower} ${(book.category || '').toLowerCase()}`;
    for (const [canonical, synonyms] of Object.entries(SUBJECT_SYNONYM_GROUPS)) {
      if (synonyms.some((term) => term.length >= 4 && searchable.includes(term))) {
        inferredSubjects.push(canonical);
      }
    }
  }

  return {
    effectiveLevel,
    isPrimaryFriendly,
    isHighSchoolFriendly,
    countries,
    curricula,
    subjectTokens: Array.from(new Set(inferredSubjects)),
  };
}

const GENERIC_SUBSTRING_STOPWORDS = new Set([
  'science',
  'sciences',
  'studies',
  'management',
  'systems',
  'system',
  'technology',
  'design',
  'engineering',
  'education',
  'applied',
  'general',
  'modern',
  'advanced',
]);

export function findMatchingUserSubjects(book: Book, userSubjects: string[]): string[] {
  if (userSubjects.length === 0) return [];
  const meta = inferBookEffectiveMetadata(book);
  const bookTitleLower = (book.title || '').toLowerCase();

  return userSubjects.filter((userSubj) => {
    const userNorm = userSubj.trim().toLowerCase();
    if (!userNorm) return false;
    const expanded = expandSubjectTerms(userSubj);
    const allowBareScience = userNorm === 'science' || userNorm === 'integrated science';

    const tagHit = meta.subjectTokens.some((bSubj) => {
      if (bSubj === 'science' && !allowBareScience) return false;
      return expanded.some((term) => {
        if (bSubj === term) return true;
        // Only allow multi-word or domain-specific (>= 6 chars, non-generic) phrase containment
        if (
          term.length >= 6 &&
          !GENERIC_SUBSTRING_STOPWORDS.has(term) &&
          bSubj.includes(term)
        ) {
          return true;
        }
        if (
          bSubj.length >= 6 &&
          !GENERIC_SUBSTRING_STOPWORDS.has(bSubj) &&
          term.includes(bSubj)
        ) {
          return true;
        }
        return false;
      });
    });
    if (tagHit) return true;

    if (
      userNorm.length >= 5 &&
      !GENERIC_SUBSTRING_STOPWORDS.has(userNorm) &&
      bookTitleLower.includes(userNorm)
    ) {
      return true;
    }
    return false;
  });
}

function doesCurriculumMatch(bookCurricula: string[], userCurriculum: string, userCountryNorm: string): boolean {
  if (!userCurriculum) return true;
  if (bookCurricula.length === 0) return true;

  const uCurr = normalizeCurriculumName(userCurriculum);
  if (bookCurricula.some((c) => c === uCurr || c.includes(uCurr) || uCurr.includes(c))) {
    return true;
  }

  // Kenyan transition compatibility: Kenyan High School learners studying CBC or KCSE share KICD-approved Secondary Physics/Biology/etc.
  if (
    userCountryNorm === 'kenya' &&
    (uCurr === 'cbc' || uCurr === 'kcse') &&
    bookCurricula.some((c) => c === 'cbc' || c === 'kcse')
  ) {
    return true;
  }

  // International British pathway compatibility: IGCSE <-> A-Levels when international
  if (
    (uCurr === 'a-levels' || uCurr === 'igcse') &&
    bookCurricula.some((c) => c === 'a-levels' || c === 'igcse')
  ) {
    return true;
  }

  return false;
}

function doesCountryMatch(bookCountries: string[], userCountryNorm: string): boolean {
  if (!userCountryNorm || userCountryNorm === 'other') return true;
  if (bookCountries.length === 0) return true;
  if (bookCountries.some(isUniversalCountryTag)) return true;
  return bookCountries.some(
    (bc) => bc === userCountryNorm || bc.includes(userCountryNorm) || userCountryNorm.includes(bc)
  );
}

export interface PersonalizationFilterOptions {
  allowFallbackIfEmpty?: boolean;
  includeStartedBooks?: boolean;
}

export function scoreAndFilterBooks(
  books: Book[],
  academic: UserAcademicProfile,
  options: PersonalizationFilterOptions = {}
): AiBookRecommendation[] {
  const { allowFallbackIfEmpty = true, includeStartedBooks = false } = options;

  if (!academic.isConfigured) {
    return books.map((book) => ({
      book,
      matchReason: book.curriculum?.[0]
        ? `${book.curriculum[0]} • ${book.subjects?.[0] || book.category.split(',')[0]}`
        : book.subjects?.[0] || book.category.split(',')[0] || 'Featured Study Text',
      matchScore: (book.rating || 4.5) * 10,
      matchedSubjects: book.subjects?.slice(0, 2) || [],
    }));
  }

  const userCountryNorm = normalizeCountryName(academic.country);
  const userCurrNorm = normalizeCurriculumName(academic.curriculum);
  const edLower = academic.educationLevel.toLowerCase();

  const evaluateTier = (mode: 'strict' | 'relaxed_geo' | 'level_and_subject'): AiBookRecommendation[] => {
    const results: AiBookRecommendation[] = [];

    for (const book of books) {
      const meta = inferBookEffectiveMetadata(book);

      // Preserve actively read book only if includeStartedBooks is requested and same broad level
      const hasActiveProgress = Boolean(book.readProgress && book.readProgress > 0 && book.readProgress < 100);

      // 1. Strict Education Level Boundary (Never mix School books with University books)
      if (academic.isSchoolLevel) {
        if (meta.effectiveLevel === 'higher') continue;
        if (mode === 'strict') {
          if (edLower === 'primary' && !meta.isPrimaryFriendly) continue;
          if (edLower === 'high school' && !meta.isHighSchoolFriendly) continue;
        }
      } else if (academic.isHigherEd) {
        if (meta.effectiveLevel === 'school') continue;
      }

      // 2. Country & Curriculum Boundary
      const countryOk = doesCountryMatch(meta.countries, userCountryNorm);
      const curriculumOk = academic.isSchoolLevel
        ? doesCurriculumMatch(meta.curricula, academic.curriculum, userCountryNorm)
        : true;

      if (mode === 'strict') {
        if (!countryOk || !curriculumOk) {
          if (!(includeStartedBooks && hasActiveProgress)) continue;
        }
      } else if (mode === 'relaxed_geo') {
        // Still never show a foreign national school curriculum (e.g., Kenya CBC to UK student) unless curriculum matches or book is international
        if (academic.isSchoolLevel && meta.curricula.length > 0 && !curriculumOk) {
          const isInternationalCurr = meta.curricula.some((c) =>
            ['ib', 'igcse', 'a-levels', 'ap', 'national curriculum'].includes(c)
          );
          const hasExplicitForeignCountry =
            meta.countries.length > 0 &&
            !meta.countries.some(isUniversalCountryTag) &&
            !countryOk;
          if (!isInternationalCurr || hasExplicitForeignCountry) continue;
        }
        if (academic.isHigherEd && meta.countries.length > 0 && !countryOk) {
          continue;
        }
      } else {
        // level_and_subject fallback: exclude books locked to a different country when userCountryNorm is set
        if (
          meta.countries.length > 0 &&
          !meta.countries.some(isUniversalCountryTag) &&
          userCountryNorm &&
          !countryOk &&
          meta.curricula.length > 0 &&
          !curriculumOk
        ) {
          continue;
        }
      }

      // 3. Subject & Field of Study Boundary
      const matchedSubjects = findMatchingUserSubjects(book, academic.subjects);
      const matchesField =
        Boolean(academic.fieldOfStudy) &&
        (book.category.toLowerCase() === academic.fieldOfStudy.toLowerCase() ||
          book.category.toLowerCase().includes(academic.fieldOfStudy.split(',')[0].toLowerCase()));

      if (academic.subjects.length > 0) {
        if (academic.isSchoolLevel) {
          if (matchedSubjects.length === 0 && !(includeStartedBooks && hasActiveProgress)) {
            continue;
          }
        } else {
          // Higher Ed: match selected subjects, or in relaxed tiers allow exact Field of Study textbooks
          if (matchedSubjects.length === 0 && !(mode !== 'strict' && matchesField) && !(includeStartedBooks && hasActiveProgress)) {
            continue;
          }
        }
      } else if (academic.fieldOfStudy) {
        if (!matchesField && !(includeStartedBooks && hasActiveProgress)) {
          continue;
        }
      }

      // 4. Compute Relevance Score & Human-Readable AI Match Reason
      let score = (book.rating || 4.5) * 4;
      const reasonBadges: string[] = [];

      if (countryOk && meta.countries.includes(userCountryNorm) && academic.country) {
        score += 28;
        reasonBadges.push(academic.country);
      }

      if (academic.isSchoolLevel && academic.curriculum && curriculumOk) {
        const exactCurr = meta.curricula.includes(userCurrNorm);
        score += exactCurr ? 38 : 22;
        reasonBadges.push(exactCurr ? academic.curriculum : (book.curriculum?.[0] || academic.curriculum));
      } else if (academic.isHigherEd && academic.educationLevel) {
        score += 20;
        reasonBadges.push(academic.educationLevel);
      }

      if (matchedSubjects.length > 0) {
        score += 50 + (matchedSubjects.length - 1) * 15;
        reasonBadges.push(matchedSubjects[0]);
      } else if (matchesField && academic.fieldOfStudy) {
        score += 25;
        const shortField = academic.fieldOfStudy.includes('(')
          ? academic.fieldOfStudy.match(/\(([^)]+)\)/)?.[1] || academic.fieldOfStudy.split(',')[0]
          : academic.fieldOfStudy.split(',')[0];
        reasonBadges.push(shortField.trim());
      }

      if (userCountryNorm === 'kenya' && book.isKicdApproved) {
        score += 12;
      }

      if (edLower === 'primary' && meta.isPrimaryFriendly) {
        score += 15;
      } else if (edLower === 'high school' && meta.isHighSchoolFriendly) {
        score += 15;
      }

      results.push({
        book,
        matchReason: reasonBadges.slice(0, 3).join(' • ') || academic.summaryLabel,
        matchScore: score,
        matchedSubjects,
      });
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
  };

  const strictMatches = evaluateTier('strict');
  if (strictMatches.length > 0 || !allowFallbackIfEmpty) {
    return strictMatches;
  }

  const relaxedGeoMatches = evaluateTier('relaxed_geo');
  if (relaxedGeoMatches.length > 0) {
    return relaxedGeoMatches;
  }

  return evaluateTier('level_and_subject');
}

export function getPersonalizedBooks(
  books: Book[],
  academic: UserAcademicProfile,
  options: PersonalizationFilterOptions = {}
): Book[] {
  return scoreAndFilterBooks(books, academic, options).map((item) => item.book);
}

export function getAiRecommendedBooks(
  books: Book[],
  academic: UserAcademicProfile,
  limit = 6
): AiBookRecommendation[] {
  const scored = scoreAndFilterBooks(books, academic, { allowFallbackIfEmpty: true });
  return scored.slice(0, limit);
}

export function buildPersonalizedNarration(book: Book | null, academic: UserAcademicProfile): string[] {
  if (!book) {
    return [
      'Select any textbook from your personalized curriculum playlist to begin warm, tutor-guided audio narration with live synchronized text.',
    ];
  }

  const subjectLabel = book.subjects?.[0] || book.category.split(',')[0] || 'this discipline';
  const currBadge =
    book.curriculum?.[0] ||
    (academic.isSchoolLevel && academic.curriculum ? academic.curriculum : academic.educationLevel || 'your syllabus');
  const insightOne =
    book.aiInsights?.[0] || `Master the foundational concepts and analytical methods at the heart of ${subjectLabel}`;
  const insightTwo =
    book.aiInsights?.[1] || `Connect theoretical principles directly to practical problem-solving and ${currBadge} assessments`;

  return [
    `Welcome to our guided audio study session on "${book.title}" by ${book.author}. Let us walk through each core principle step by step, just as we would in a focused one-on-one tutorial aligned with ${currBadge}.`,
    `${book.description || `This textbook establishes a clear, rigorous foundation in ${subjectLabel}, ensuring every definition and mechanism builds naturally upon what you already know.`}`,
    `Notice a key curriculum takeaway as you listen: ${insightOne}. Picture how each variable and structure interacts dynamically in real-world scenarios rather than treating formulas in isolation.`,
    `As we wrap up this chapter foundation, keep this second focus point in mind: ${insightTwo}. Whenever a concept feels abstract, open the full interactive reader to inspect worked examples and diagrams.`,
  ];
}
