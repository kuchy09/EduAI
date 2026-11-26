// ==============================================================================
// Edu AI - Kenya CBC & KCSE Curriculum, Taxonomy & RAG Search Service
// ==============================================================================

import { supabase } from './supabase';
import { 
  Curriculum, 
  GradeLevel, 
  Subject, 
  CurriculumBook, 
  BookChapter, 
  BookSubTopic, 
  BookContentChunk, 
  RAGSearchResult,
  CurriculumType
} from '../types';

/**
 * Fetch all available curriculums (CBC, KCSE)
 */
export async function getCurriculums(): Promise<Curriculum[]> {
  if (!supabase) return getMockCurriculums();

  try {
    const { data, error } = await supabase
      .from('curriculums')
      .select('*')
      .order('id', { ascending: true });

    if (error || !data || data.length === 0) {
      return getMockCurriculums();
    }

    return data.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      createdAt: c.created_at
    }));
  } catch (err) {
    console.warn('[kenyaCurriculumService] getCurriculums fallback:', err);
    return getMockCurriculums();
  }
}

/**
 * Fetch Grade Levels for a given curriculum (e.g., Grade 7-9 for CBC Junior School, Form 1-4 for KCSE)
 */
export async function getGradeLevels(curriculumId?: number): Promise<GradeLevel[]> {
  if (!supabase) return getMockGradeLevels(curriculumId);

  try {
    let query = supabase
      .from('grade_levels')
      .select('*, curriculums(*)')
      .order('sequence_order', { ascending: true });

    if (curriculumId) {
      query = query.eq('curriculum_id', curriculumId);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return getMockGradeLevels(curriculumId);
    }

    return data.map(g => ({
      id: g.id,
      curriculumId: g.curriculum_id,
      levelCategory: g.level_category,
      name: g.name,
      sequenceOrder: g.sequence_order,
      curriculum: g.curriculums ? {
        id: g.curriculums.id,
        name: g.curriculums.name,
        description: g.curriculums.description
      } : undefined
    }));
  } catch (err) {
    console.warn('[kenyaCurriculumService] getGradeLevels fallback:', err);
    return getMockGradeLevels(curriculumId);
  }
}

/**
 * Fetch Subjects (Learning Areas for CBC or Subjects for KCSE)
 */
export async function getSubjects(curriculumId?: number): Promise<Subject[]> {
  if (!supabase) return getMockSubjects(curriculumId);

  try {
    let query = supabase
      .from('subjects')
      .select('*')
      .order('name', { ascending: true });

    if (curriculumId) {
      query = query.eq('curriculum_id', curriculumId);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return getMockSubjects(curriculumId);
    }

    return data.map(s => ({
      id: s.id,
      curriculumId: s.curriculum_id,
      name: s.name,
      code: s.code,
      department: s.department,
      createdAt: s.created_at
    }));
  } catch (err) {
    console.warn('[kenyaCurriculumService] getSubjects fallback:', err);
    return getMockSubjects(curriculumId);
  }
}

/**
 * Fetch Curriculum Books with detailed filters (Curriculum, Grade, Subject, KICD approval)
 */
export async function getCurriculumBooks(filters?: {
  curriculumType?: CurriculumType;
  gradeLevelId?: number;
  subjectId?: number;
  kicdApprovedOnly?: boolean;
  searchQuery?: string;
}): Promise<CurriculumBook[]> {
  if (!supabase) return getMockCurriculumBooks(filters);

  try {
    let query = supabase
      .from('curriculum_books')
      .select(`
        *,
        subjects(*),
        grade_levels(*, curriculums(*))
      `)
      .order('title', { ascending: true });

    if (filters?.gradeLevelId) {
      query = query.eq('grade_level_id', filters.gradeLevelId);
    }
    if (filters?.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }
    if (filters?.kicdApprovedOnly) {
      query = query.eq('is_kicd_approved', true);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return getMockCurriculumBooks(filters);
    }

    let books: CurriculumBook[] = data.map(b => ({
      id: b.id,
      title: b.title,
      isbn: b.isbn,
      publisher: b.publisher,
      isKicdApproved: b.is_kicd_approved,
      category: b.category,
      subjectId: b.subject_id,
      gradeLevelId: b.grade_level_id,
      edition: b.edition,
      coverImageUrl: b.cover_image_url,
      pdfFileUrl: b.pdf_file_url,
      description: b.description,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
      subject: b.subjects ? {
        id: b.subjects.id,
        curriculumId: b.subjects.curriculum_id,
        name: b.subjects.name,
        code: b.subjects.code,
        department: b.subjects.department
      } : undefined,
      gradeLevel: b.grade_levels ? {
        id: b.grade_levels.id,
        curriculumId: b.grade_levels.curriculum_id,
        levelCategory: b.grade_levels.level_category,
        name: b.grade_levels.name,
        sequenceOrder: b.grade_levels.sequence_order,
        curriculum: b.grade_levels.curriculums ? {
          id: b.grade_levels.curriculums.id,
          name: b.grade_levels.curriculums.name,
          description: b.grade_levels.curriculums.description
        } : undefined
      } : undefined
    }));

    if (filters?.curriculumType) {
      books = books.filter(b => b.gradeLevel?.curriculum?.name === filters.curriculumType);
    }

    if (filters?.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      books = books.filter(b => 
        b.title.toLowerCase().includes(q) ||
        b.publisher.toLowerCase().includes(q) ||
        b.subject?.name.toLowerCase().includes(q) ||
        b.gradeLevel?.name.toLowerCase().includes(q)
      );
    }

    return books;
  } catch (err) {
    console.warn('[kenyaCurriculumService] getCurriculumBooks fallback:', err);
    return getMockCurriculumBooks(filters);
  }
}

/**
 * Fetch Book Taxonomy: Chapters (Strands/Topics) and Sub-topics (Sub-strands)
 */
export async function getBookTaxonomy(bookId: string): Promise<BookChapter[]> {
  if (!supabase) return getMockBookTaxonomy(bookId);

  try {
    const { data: chaptersData, error: chError } = await supabase
      .from('book_chapters')
      .select('*')
      .eq('book_id', bookId)
      .order('chapter_number', { ascending: true });

    if (chError || !chaptersData || chaptersData.length === 0) {
      return getMockBookTaxonomy(bookId);
    }

    const chapterIds = chaptersData.map(c => c.id);

    const { data: subTopicsData } = await supabase
      .from('book_sub_topics')
      .select('*')
      .in('chapter_id', chapterIds)
      .order('order_index', { ascending: true });

    const subTopicsByChapter: Record<string, BookSubTopic[]> = {};
    if (subTopicsData) {
      subTopicsData.forEach(st => {
        if (!subTopicsByChapter[st.chapter_id]) {
          subTopicsByChapter[st.chapter_id] = [];
        }
        subTopicsByChapter[st.chapter_id].push({
          id: st.id,
          chapterId: st.chapter_id,
          title: st.title,
          learningOutcomes: st.learning_outcomes || [],
          orderIndex: st.order_index,
          createdAt: st.created_at
        });
      });
    }

    return chaptersData.map(c => ({
      id: c.id,
      bookId: c.book_id,
      title: c.title,
      chapterNumber: c.chapter_number,
      pageStart: c.page_start,
      pageEnd: c.page_end,
      summary: c.summary,
      subTopics: subTopicsByChapter[c.id] || [],
      createdAt: c.created_at
    }));
  } catch (err) {
    console.warn('[kenyaCurriculumService] getBookTaxonomy fallback:', err);
    return getMockBookTaxonomy(bookId);
  }
}

/**
 * Perform RAG Vector Similarity Search or Fallback Text Search on CBC/KCSE content chunks
 */
export async function searchCurriculumRAG(params: {
  queryEmbedding?: number[];
  queryText: string;
  bookId?: string;
  subjectId?: number;
  gradeLevelId?: number;
  curriculum?: string;
  subjects?: string[] | string;
  matchThreshold?: number;
  matchCount?: number;
}): Promise<RAGSearchResult[]> {
  const matchThreshold = params.matchThreshold ?? 0.65;
  const matchCount = params.matchCount ?? 5;
  const trimmedQuery = String(params.queryText || '').trim();
  if (!trimmedQuery) return [];

  // 0. Server-backed curriculum RAG search (combines Supabase chunks, taxonomy, and indexed textbook PDFs)
  if (typeof fetch !== 'undefined') {
    try {
      const resp = await fetch('/api/curriculum/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedQuery,
          queryEmbedding: params.queryEmbedding,
          bookId: params.bookId,
          curriculum: params.curriculum,
          subjects: params.subjects,
          maxResults: matchCount,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data?.sources)) {
          return data.sources.map((src: any) => ({
            id: String(src.id),
            bookId: String(src.bookId || ''),
            bookTitle: String(src.bookTitle || 'CBC / KCSE Textbook'),
            publisher: String(src.publisher || 'Kenya Publisher'),
            subTopicId: src.subTopicId,
            subTopicTitle: src.subTopicTitle,
            chapterTitle: src.chapterTitle,
            pageNumber: Number(src.pageNumber) || 1,
            contentText: String(src.excerpt || src.contentText || ''),
            similarity: Number(src.similarity) || 0.75,
          }));
        }
      }
    } catch (err) {
      console.warn('[kenyaCurriculumService] /api/curriculum/search unreachable, falling back to direct Supabase:', err);
    }
  }

  // 1. If vector embedding provided and Supabase RPC available
  if (supabase && params.queryEmbedding && params.queryEmbedding.length > 0) {
    try {
      const { data, error } = await supabase.rpc('match_book_content_chunks', {
        query_embedding: params.queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        filter_book_id: params.bookId || null,
        filter_subject_id: params.subjectId || null,
        filter_grade_level_id: params.gradeLevelId || null
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          bookId: row.book_id,
          bookTitle: row.book_title,
          publisher: row.publisher,
          subTopicId: row.sub_topic_id,
          subTopicTitle: row.sub_topic_title,
          chapterTitle: row.chapter_title,
          pageNumber: row.page_number,
          contentText: row.content_text,
          similarity: row.similarity
        }));
      }
    } catch (err) {
      console.warn('[kenyaCurriculumService] RPC match_book_content_chunks error, falling back to text search:', err);
    }
  }

  // 2. Tokenized keyword search fallback over chunks
  if (supabase && trimmedQuery) {
    try {
      const tokens = Array.from(
        new Set(
          trimmedQuery
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .split(/\s+/)
            .map((t) => t.replace(/[^a-z0-9-]/g, ''))
            .filter((t) => t.length >= 4)
        )
      ).slice(0, 5);

      if (tokens.length > 0) {
        const orClause = tokens.map((t) => `content_text.ilike.%${t}%`).join(',');
        let query = supabase
          .from('book_content_chunks')
          .select(`
            id,
            book_id,
            sub_topic_id,
            page_number,
            content_text,
            curriculum_books(title, publisher),
            book_sub_topics(title, book_chapters(title))
          `)
          .or(orClause)
          .limit(matchCount);

        if (params.bookId) query = query.eq('book_id', params.bookId);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data.map((row: any) => ({
            id: row.id,
            bookId: row.book_id,
            bookTitle: row.curriculum_books?.title || 'CBC / KCSE Textbook',
            publisher: row.curriculum_books?.publisher || 'Kenya Publisher',
            subTopicId: row.sub_topic_id,
            subTopicTitle: row.book_sub_topics?.title,
            chapterTitle: row.book_sub_topics?.book_chapters?.title,
            pageNumber: row.page_number,
            contentText: row.content_text,
            similarity: 0.85
          }));
        }
      }
    } catch (err) {
      console.warn('[kenyaCurriculumService] Text search fallback notice:', err);
    }
  }

  // 3. Query-filtered offline fallback (never returns unrelated mock citations)
  return getMockRAGResults(trimmedQuery);
}

// ==============================================================================
// High-Fidelity Mock Seed Data Fallbacks
// ==============================================================================

function getMockCurriculums(): Curriculum[] {
  return [
    {
      id: 1,
      name: 'CBC',
      description: 'Competency-Based Curriculum (2-6-3-3-3 system) focusing on learner competencies and practical skills.'
    },
    {
      id: 2,
      name: 'KCSE',
      description: '8-4-4 National Examination Curriculum preparing secondary candidates for university admission.'
    }
  ];
}

function getMockGradeLevels(curriculumId?: number): GradeLevel[] {
  const all: GradeLevel[] = [
    { id: 1, curriculumId: 1, levelCategory: 'PP', name: 'Pre-Primary 1 (PP1)', sequenceOrder: 1 },
    { id: 2, curriculumId: 1, levelCategory: 'PP', name: 'Pre-Primary 2 (PP2)', sequenceOrder: 2 },
    { id: 3, curriculumId: 1, levelCategory: 'PRIMARY', name: 'Grade 1', sequenceOrder: 3 },
    { id: 6, curriculumId: 1, levelCategory: 'PRIMARY', name: 'Grade 4', sequenceOrder: 6 },
    { id: 9, curriculumId: 1, levelCategory: 'JUNIOR_SCHOOL', name: 'Grade 7 (Junior School)', sequenceOrder: 9 },
    { id: 10, curriculumId: 1, levelCategory: 'JUNIOR_SCHOOL', name: 'Grade 8 (Junior School)', sequenceOrder: 10 },
    { id: 11, curriculumId: 1, levelCategory: 'JUNIOR_SCHOOL', name: 'Grade 9 (Junior School)', sequenceOrder: 11 },
    { id: 12, curriculumId: 1, levelCategory: 'SENIOR_SCHOOL', name: 'Grade 10 (Senior School)', sequenceOrder: 12 },
    { id: 13, curriculumId: 1, levelCategory: 'SENIOR_SCHOOL', name: 'Grade 11 (Senior School)', sequenceOrder: 13 },
    { id: 14, curriculumId: 1, levelCategory: 'SENIOR_SCHOOL', name: 'Grade 12 (Senior School)', sequenceOrder: 14 },
    { id: 15, curriculumId: 2, levelCategory: 'KCSE_SECONDARY', name: 'Form 1 (8-4-4)', sequenceOrder: 15 },
    { id: 16, curriculumId: 2, levelCategory: 'KCSE_SECONDARY', name: 'Form 2 (8-4-4)', sequenceOrder: 16 },
    { id: 17, curriculumId: 2, levelCategory: 'KCSE_SECONDARY', name: 'Form 3 (8-4-4)', sequenceOrder: 17 },
    { id: 18, curriculumId: 2, levelCategory: 'KCSE_SECONDARY', name: 'Form 4 (KCSE Candidate)', sequenceOrder: 18 }
  ];

  return curriculumId ? all.filter(g => g.curriculumId === curriculumId) : all;
}

function getMockSubjects(curriculumId?: number): Subject[] {
  const all: Subject[] = [
    { id: 1, curriculumId: 1, name: 'Mathematics', code: 'CBC-MATH', department: 'Mathematics' },
    { id: 2, curriculumId: 1, name: 'English Language & Literature', code: 'CBC-ENG', department: 'Languages' },
    { id: 3, curriculumId: 1, name: 'Kiswahili Lugha na Fasihi', code: 'CBC-KIS', department: 'Languages' },
    { id: 4, curriculumId: 1, name: 'Integrated Science', code: 'CBC-INTSCI', department: 'Sciences' },
    { id: 5, curriculumId: 1, name: 'Social Studies & Life Skills', code: 'CBC-SST', department: 'Humanities' },
    { id: 6, curriculumId: 1, name: 'Agriculture and Nutrition', code: 'CBC-AGRI', department: 'Technical & Applied' },
    { id: 9, curriculumId: 1, name: 'Computer Science & AI Foundations', code: 'CBC-CS', department: 'ICT & Emerging Tech' },
    { id: 12, curriculumId: 2, name: 'Mathematics (121)', code: 'KCSE-121', department: 'Mathematics' },
    { id: 13, curriculumId: 2, name: 'English (101)', code: 'KCSE-101', department: 'Languages' },
    { id: 14, curriculumId: 2, name: 'Kiswahili (102)', code: 'KCSE-102', department: 'Languages' },
    { id: 15, curriculumId: 2, name: 'Physics (232)', code: 'KCSE-232', department: 'Sciences' },
    { id: 16, curriculumId: 2, name: 'Chemistry (233)', code: 'KCSE-233', department: 'Sciences' },
    { id: 17, curriculumId: 2, name: 'Biology (231)', code: 'KCSE-231', department: 'Sciences' },
    { id: 19, curriculumId: 2, name: 'Geography (312)', code: 'KCSE-312', department: 'Humanities' }
  ];

  return curriculumId ? all.filter(s => s.curriculumId === curriculumId) : all;
}

function getMockCurriculumBooks(filters?: any): CurriculumBook[] {
  const books: CurriculumBook[] = [
    {
      id: '11111111-1111-4000-8000-000000000001',
      title: 'Top Scholar Junior Secondary Grade 9 Mathematics',
      isbn: '978-9966-25-101-1',
      publisher: 'Kenya Literature Bureau (KLB)',
      isKicdApproved: true,
      category: 'STUDENT_TEXTBOOK',
      subjectId: 1,
      gradeLevelId: 11,
      edition: '2026 CBC Edition',
      coverImageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=400',
      pdfFileUrl: 'cbc-g9-math-klb.pdf',
      description: 'Official KICD approved learner guide for Grade 9 CBC Mathematics covering linear inequalities, coordinates, financial literacy, and geometric transformations.',
      subject: { id: 1, curriculumId: 1, name: 'Mathematics', code: 'CBC-MATH', department: 'Mathematics' },
      gradeLevel: { id: 11, curriculumId: 1, levelCategory: 'JUNIOR_SCHOOL', name: 'Grade 9 (Junior School)', sequenceOrder: 11, curriculum: { id: 1, name: 'CBC' } }
    },
    {
      id: '11111111-1111-4000-8000-000000000002',
      title: 'Spark Integrated Science Grade 9 Learner\'s Book',
      isbn: '978-9966-36-402-3',
      publisher: 'Longhorn Publishers',
      isKicdApproved: true,
      category: 'STUDENT_TEXTBOOK',
      subjectId: 4,
      gradeLevelId: 11,
      edition: '2026 Revised CBC',
      coverImageUrl: 'https://images.unsplash.com/photo-1532094349884-543bb1198343?auto=format&fit=crop&q=80&w=400',
      pdfFileUrl: 'cbc-g9-intscience-longhorn.pdf',
      description: 'Comprehensive competency-based exploration of biological systems, environmental conservation, energy conversions, and chemical properties.',
      subject: { id: 4, curriculumId: 1, name: 'Integrated Science', code: 'CBC-INTSCI', department: 'Sciences' },
      gradeLevel: { id: 11, curriculumId: 1, levelCategory: 'JUNIOR_SCHOOL', name: 'Grade 9 (Junior School)', sequenceOrder: 11, curriculum: { id: 1, name: 'CBC' } }
    },
    {
      id: '11111111-1111-4000-8000-000000000003',
      title: 'CBC Grade 10 Senior Secondary Physics Foundation',
      isbn: '978-9966-22-805-4',
      publisher: 'Jomo Kenyatta Foundation (JKF)',
      isKicdApproved: true,
      category: 'STUDENT_TEXTBOOK',
      subjectId: 9,
      gradeLevelId: 12,
      edition: 'First Senior Edition',
      coverImageUrl: 'https://images.unsplash.com/photo-1554558727-6f81c9535aa7?auto=format&fit=crop&q=80&w=400',
      pdfFileUrl: 'cbc-g10-physics-jkf.pdf',
      description: 'Comprehensive senior secondary physics textbook following the Kenyan Competency Based Curriculum (CBC) pathways.',
      subject: { id: 9, curriculumId: 1, name: 'Computer Science & Physics', code: 'CBC-CS', department: 'Sciences' },
      gradeLevel: { id: 12, curriculumId: 1, levelCategory: 'SENIOR_SCHOOL', name: 'Grade 10 (Senior School)', sequenceOrder: 12, curriculum: { id: 1, name: 'CBC' } }
    },
    {
      id: '11111111-1111-4000-8000-000000000004',
      title: 'KCSE Golden Tips Physics Form 4 National Exam Revision',
      isbn: '978-0195-73-909-0',
      publisher: 'Oxford University Press',
      isKicdApproved: true,
      category: 'REVISION_GUIDE',
      subjectId: 15,
      gradeLevelId: 18,
      edition: 'Golden Edition 2026',
      coverImageUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=400',
      pdfFileUrl: 'kcse-f4-physics-oxford.pdf',
      description: 'Complete KCSE Paper 232/1, 232/2 & 232/3 examination mastery handbook with KNEC-style marking schemes.',
      subject: { id: 15, curriculumId: 2, name: 'Physics (232)', code: 'KCSE-232', department: 'Sciences' },
      gradeLevel: { id: 18, curriculumId: 2, levelCategory: 'KCSE_SECONDARY', name: 'Form 4 (KCSE Candidate)', sequenceOrder: 18, curriculum: { id: 2, name: 'KCSE' } }
    },
    {
      id: '11111111-1111-4000-8000-000000000005',
      title: 'KCSE Top Mark Mathematics Form 4 with Past Papers',
      isbn: '978-9966-25-888-2',
      publisher: 'Kenya Literature Bureau (KLB)',
      isKicdApproved: true,
      category: 'PAST_PAPER',
      subjectId: 12,
      gradeLevelId: 18,
      edition: '2026 Examination Edition',
      coverImageUrl: '',
      pdfFileUrl: 'kcse-f4-math-pastpapers.pdf',
      description: 'Over 10 years of categorized KNEC KCSE Mathematics examination past papers with step-by-step solutions for Paper 1 (121/1) and Paper 2 (121/2).',
      subject: { id: 12, curriculumId: 2, name: 'Mathematics (121)', code: 'KCSE-121', department: 'Mathematics' },
      gradeLevel: { id: 18, curriculumId: 2, levelCategory: 'KCSE_SECONDARY', name: 'Form 4 (KCSE Candidate)', sequenceOrder: 18, curriculum: { id: 2, name: 'KCSE' } }
    }
  ];

  return books;
}

function getMockBookTaxonomy(bookId: string): BookChapter[] {
  return [
    {
      id: '22222222-2222-4000-8000-000000000001',
      bookId,
      title: 'Strand 1.0: Numbers and Financial Calculations',
      chapterNumber: 1,
      pageStart: 1,
      pageEnd: 28,
      summary: 'Covers compound interest, exchange rates in EAC economies, percentage profit, and banking operations.',
      subTopics: [
        {
          id: '33333333-3333-4000-8000-000000000001',
          chapterId: '22222222-2222-4000-8000-000000000001',
          title: 'Sub-strand 1.1: Foreign Exchange Rates & EAC Currency Conversions',
          learningOutcomes: [
            'Apply exchange rate tables to convert KES to USD, GBP, and UGX',
            'Solve real-world trade transactions within the East African Community',
            'Demonstrate financial integrity and accuracy in currency calculations'
          ],
          orderIndex: 1
        },
        {
          id: '33333333-3333-4000-8000-000000000002',
          chapterId: '22222222-2222-4000-8000-000000000001',
          title: 'Sub-strand 1.2: Simple and Compound Interest Formulae',
          learningOutcomes: [
            'Differentiate between simple interest (I=PRT/100) and compound interest (A=P(1+r/100)^n)',
            'Calculate investments and depreciation in Kenyan commercial banks'
          ],
          orderIndex: 2
        }
      ]
    },
    {
      id: '22222222-2222-4000-8000-000000000002',
      bookId,
      title: 'Strand 2.0: Algebra, Linear Equations and Inequalities',
      chapterNumber: 2,
      pageStart: 29,
      pageEnd: 64,
      summary: 'Formulating simultaneous linear equations from real-life scenarios, graphical solutions, and region inequalities.',
      subTopics: [
        {
          id: '33333333-3333-4000-8000-000000000003',
          chapterId: '22222222-2222-4000-8000-000000000002',
          title: 'Sub-strand 2.1: Forming and Solving Simultaneous Equations',
          learningOutcomes: [
            'Translate verbal problem statements into algebraic linear models',
            'Apply elimination and substitution techniques'
          ],
          orderIndex: 1
        }
      ]
    }
  ];
}

function getMockRAGResults(query: string): RAGSearchResult[] {
  const tokens = String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  if (tokens.length === 0) return [];

  const candidates: RAGSearchResult[] = [
    {
      id: 'rag-chunk-01',
      bookId: '11111111-1111-4000-8000-000000000001',
      bookTitle: 'Top Scholar Junior Secondary Grade 9 Mathematics (KLB)',
      publisher: 'Kenya Literature Bureau (KLB)',
      subTopicId: '33333333-3333-4000-8000-000000000001',
      subTopicTitle: 'Sub-strand 1.1: Foreign Exchange Rates & EAC Currency Conversions',
      chapterTitle: 'Strand 1.0: Numbers and Financial Calculations',
      pageNumber: 14,
      contentText: 'When converting Kenyan Shillings (KES) to US Dollars (USD), divide the amount in KES by the selling rate quoted by the Central Bank of Kenya (CBK). For currency transactions within the East African Community (EAC), apply cross-rates using the standardized KES base exchange index.',
      similarity: 0.92
    },
    {
      id: 'rag-chunk-02',
      bookId: '11111111-1111-4000-8000-000000000004',
      bookTitle: 'KCSE Golden Tips Physics Form 4 National Exam Revision',
      publisher: 'Oxford University Press',
      subTopicId: '33333333-3333-4000-8000-000000000003',
      subTopicTitle: 'Subtopic 1.1: Faraday\'s and Lenz\'s Laws of Induction',
      chapterTitle: 'Topic 1.0: Electromagnetic Induction',
      pageNumber: 22,
      contentText: 'Faraday’s Law of Electromagnetic Induction states that the magnitude of the induced electromotive force (EMF) is directly proportional to the rate of change of magnetic flux linkage: E = -N(dΦ/dt). Lenz’s law accounts for the negative sign, stating the induced current flows in such a direction as to oppose the flux change producing it.',
      similarity: 0.88
    }
  ];

  return candidates.filter((item) => {
    const haystack = `${item.bookTitle} ${item.chapterTitle || ''} ${item.subTopicTitle || ''} ${item.contentText}`.toLowerCase();
    return tokens.some((t) => haystack.includes(t));
  });
}
