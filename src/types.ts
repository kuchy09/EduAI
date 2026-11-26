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
  subjectCategory?: string;
  country?: string[];
  fileUrl?: string; // added backblaze URL
  b2Bucket?: string;
  b2Synced?: boolean;
  supabaseSynced?: boolean;
  needsShelfMigration?: boolean;
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
  sha256Checksum?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  pageCount?: number;
  language?: string;
  processingStatus?: ProcessingStatus;
  epubFileKey?: string;
  epubPublished?: boolean;
  conversionConfidence?: ConversionConfidence;
  conversionQualityScore?: number;
  rightsConversionAllowed?: boolean;
}

export interface Bookmark {
  id: string;
  bookId: string;
  bookTitle: string;
  chapter: string;
  textSnippet: string;
  timestamp: number;
  canonicalSectionId?: string;
  epubHref?: string;
  epubAnchor?: string;
  format?: BookFormat;
  pageNumber?: number;
  title?: string;
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

export type GroundingMode = 'curriculum_grounded' | 'mixed' | 'general_ai';

export interface CurriculumSourceReference {
  id: string;
  bookId: string;
  bookTitle: string;
  publisher: string;
  curriculum?: string;
  subject?: string;
  chapterTitle?: string;
  subTopicTitle?: string;
  pageNumber: number;
  pageRange?: string;
  excerpt: string;
  matchType: 'vector_chunk' | 'textbook_chunk' | 'pdf_page' | 'curriculum_taxonomy' | 'reader_context';
  similarity: number;
  isKicdApproved?: boolean;
}

export type ProcessingStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'needs_review'
  | 'failed'
  | 'pdf_only';

export type ConversionConfidence = 'high' | 'medium' | 'low';

export type ContentBlockType =
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'table'
  | 'math'
  | 'exercise'
  | 'learning_objective'
  | 'callout'
  | 'list_item';

export interface CanonicalBookBlock {
  id: string;
  type: ContentBlockType;
  orderIndex: number;
  text: string;
  level?: number;
  mathMl?: string;
  latex?: string;
  tableData?: { headers: string[]; rows: string[][] };
  assetId?: string;
  assetUrl?: string;
  caption?: string;
  pdfPageNumber: number;
  epubAnchor: string;
}

export interface CanonicalBookSection {
  id: string;
  stableId: string;
  chapterId: string;
  parentSectionId?: string;
  title: string;
  hierarchyLevel: number; // 2 = section, 3 = subsection
  sectionType: 'section' | 'subsection' | 'exercise' | 'learning_objectives';
  orderIndex: number;
  pdfPageStart: number;
  pdfPageEnd: number;
  epubHref: string;
  epubAnchor: string;
  contentRef: string;
  blocks: CanonicalBookBlock[];
}

export interface CanonicalBookChapter {
  id: string;
  stableId: string;
  chapterNumber: number;
  title: string;
  hierarchyLevel: number;
  sectionType: 'front_matter' | 'chapter' | 'exercises' | 'glossary' | 'appendix';
  orderIndex: number;
  pdfPageStart: number;
  pdfPageEnd: number;
  epubHref: string;
  epubAnchor: string;
  contentRef: string;
  summary?: string;
  sections: CanonicalBookSection[];
  blocks: CanonicalBookBlock[];
}

export interface ExtractedAsset {
  id: string;
  bookId: string;
  assetType: 'image' | 'diagram' | 'figure';
  storageKey: string;
  mimeType: string;
  width?: number;
  height?: number;
  pdfPageNumber: number;
  caption?: string;
  sha256Checksum?: string;
  url?: string;
}

export interface CanonicalBookStructure {
  bookId: string;
  title: string;
  author: string;
  publisher?: string;
  language: string;
  totalPages: number;
  sourcePdfKey: string;
  sourceChecksum: string;
  epubKey?: string;
  epubPublished: boolean;
  confidenceStatus?: ConversionConfidence;
  qualityScore?: number;
  tocSource: 'pdf_bookmarks' | 'layout_heuristics' | 'hybrid' | 'admin_edited';
  updatedAt: string;
  chapters: CanonicalBookChapter[];
  assets: ExtractedAsset[];
}

export interface ProcessingJobStatus {
  id: string;
  bookId: string;
  sourcePdfKey: string;
  status: ProcessingStatus;
  currentStage: string;
  stageIndex: number;
  totalStages: number;
  progressPct: number;
  ocrStatus: 'not_needed' | 'running' | 'completed' | 'partial' | 'failed';
  ocrPagesCount: number;
  errorMessage?: string;
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface ConversionQualityReport {
  id: string;
  bookId: string;
  jobId: string;
  confidenceStatus: ConversionConfidence;
  qualityScore: number;
  totalPages: number;
  extractedChaptersCount: number;
  extractedSectionsCount: number;
  extractedImagesCount: number;
  extractedTablesCount: number;
  mathBlocksCount: number;
  ocrPages: number[];
  warnings: string[];
  errors: string[];
  validationPassed: boolean;
  autoPublished: boolean;
  createdAt: string;
}

export interface EpubArtifactInfo {
  id: string;
  bookId: string;
  version: number;
  epubKey: string;
  sha256Checksum: string;
  fileSizeBytes: number;
  validationPassed: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  published: boolean;
  createdAt: string;
}

export interface BookConversionOverview {
  bookId: string;
  processingStatus: ProcessingStatus;
  epubFileKey?: string;
  epubPublished: boolean;
  confidenceStatus?: ConversionConfidence;
  qualityScore?: number;
  rightsConversionAllowed: boolean;
  sha256Checksum?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  pageCount?: number;
  language?: string;
  job?: ProcessingJobStatus | null;
  report?: ConversionQualityReport | null;
  artifact?: EpubArtifactInfo | null;
  chaptersCount: number;
  sectionsCount: number;
}



