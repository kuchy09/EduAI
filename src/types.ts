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
  level?: 'School' | 'University' | 'All';
  curriculum?: string[];
  subjects?: string[];
  country?: string[];
  fileUrl?: string; // added backblaze URL
  customCover?: CustomCoverConfig;
  coverMode?: 'auto' | 'image' | 'visual' | 'pdf';
  pdfCoverPage?: number;
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

export type ViewState = 'dashboard' | 'library' | 'learning-path' | 'ai-tutor' | 'quizzes' | 'community' | 'chat' | 'settings' | 'support' | 'developer' | 'reader' | 'profile' | 'workspace' | 'admin' | 'progress' | 'book-store' | 'audiobooks' | 'notifications';
