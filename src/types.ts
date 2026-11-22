export interface CustomCoverConfig {
  mode?: 'auto' | 'image' | 'visual' | 'pdf';
  themeGradient?: string;
  accentBg?: string;
  accentText?: string;
  iconType?: string;
  subtitle?: string;
  badgeText?: string;
  pdfPageNumber?: number;
  pattern?: 'grid' | 'dots' | 'geometric' | 'clean';
}

export type BookFormat = 'epub' | 'pdf';

export interface PublisherSecurityPolicy {
  requireEncryptedOffline?: boolean;
  watermarkUser?: boolean;
  allowRawExport?: boolean;
  offlineLeaseDays?: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  category: string;
  rating: number;
  readProgress?: number;
  description: string;
  aiInsights?: string[];
  level?: 'Primary' | 'High School' | 'School' | 'College' | 'University' | 'Graduate' | 'Postgraduate' | 'Vocational' | 'All';
  curriculum?: string[];
  subjects?: string[];
  country?: string[];
  fileUrl?: string; // added backblaze URL
  format?: BookFormat;
  securityPolicy?: PublisherSecurityPolicy;
  customCover?: CustomCoverConfig;
  coverMode?: 'auto' | 'image' | 'visual' | 'pdf';
  pdfCoverPage?: number;
  publisher?: string;
  isKicdApproved?: boolean;
  isbn?: string;
  pages?: number;
  publishedYear?: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  bookTitle: string;
  chapter: string;
  textSnippet: string;
  timestamp: number;
}

export interface Highlight {
  id: string;
  bookId: string;
  userId: string;
  text: string;
  pageNumber?: number;
  color: string;
  createdAt: string;
}

export type ViewState = 'dashboard' | 'library' | 'learning-path' | 'edulab' | 'ai-tutor' | 'quizzes' | 'community' | 'chat' | 'users-portal' | 'settings' | 'support' | 'developer' | 'reader' | 'profile' | 'workspace' | 'admin' | 'progress' | 'book-store' | 'audiobooks' | 'notifications';

// ============================================================================
// Kenya CBC & KCSE Curriculum, Taxonomy & RAG Database Types
// ============================================================================

export type CurriculumType = 'CBC' | 'KCSE';

export type KenyaEducationLevel = 
  | 'PP' 
  | 'PRIMARY' 
  | 'JUNIOR_SCHOOL' 
  | 'SENIOR_SCHOOL' 
  | 'KCSE_SECONDARY';

export type BookCategoryType = 
  | 'STUDENT_TEXTBOOK' 
  | 'TEACHERS_GUIDE' 
  | 'REVISION_GUIDE' 
  | 'PAST_PAPER';

export interface Curriculum {
  id: number;
  name: CurriculumType;
  description?: string;
  createdAt?: string;
}

export interface GradeLevel {
  id: number;
  curriculumId: number;
  levelCategory: KenyaEducationLevel;
  name: string; // 'Grade 7', 'Grade 8', 'Form 1', 'Form 4'
  sequenceOrder: number;
  curriculum?: Curriculum;
}

export interface Subject {
  id: number;
  curriculumId: number;
  name: string; // 'Integrated Science', 'Kiswahili', 'Physics'
  code?: string; // 'CBC-INTSCI', 'KCSE-232'
  department?: string;
  createdAt?: string;
}

export interface CurriculumBook {
  id: string;
  title: string;
  isbn?: string;
  publisher: string; // 'KICD', 'Kenya Literature Bureau (KLB)', 'Oxford', 'Longhorn'
  isKicdApproved: boolean;
  category: BookCategoryType;
  subjectId: number;
  gradeLevelId: number;
  edition?: string;
  coverImageUrl?: string;
  pdfFileUrl: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  subject?: Subject;
  gradeLevel?: GradeLevel;
  chapters?: BookChapter[];
}

export interface BookChapter {
  id: string;
  bookId: string;
  title: string; // 'Strand 1.0: Living Things' or 'Topic 3: Matrices'
  chapterNumber: number;
  pageStart?: number;
  pageEnd?: number;
  summary?: string;
  subTopics?: BookSubTopic[];
  createdAt?: string;
}

export interface BookSubTopic {
  id: string;
  chapterId: string;
  title: string; // 'Sub-strand 1.1: Human Digestive System'
  learningOutcomes?: string[]; // Core CBC competencies or KCSE exam objectives
  orderIndex: number;
  createdAt?: string;
}

export interface BookContentChunk {
  id: string;
  bookId: string;
  subTopicId?: string;
  pageNumber: number;
  contentText: string;
  embedding?: number[];
  tokenCount?: number;
  createdAt?: string;
}

export interface RAGSearchResult {
  id: string;
  bookId: string;
  bookTitle: string;
  publisher: string;
  subTopicId?: string;
  subTopicTitle?: string;
  chapterTitle?: string;
  pageNumber: number;
  contentText: string;
  similarity: number;
}

