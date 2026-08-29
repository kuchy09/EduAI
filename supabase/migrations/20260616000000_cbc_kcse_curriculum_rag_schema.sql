-- ==============================================================================
-- Migration: CBC & KCSE Comprehensive Database Schema with Content Taxonomy & RAG
-- File: /supabase/migrations/20260616000000_cbc_kcse_curriculum_rag_schema.sql
-- ==============================================================================

-- Enable vector extension for EduAI RAG semantic search
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Curriculum & Grade Hierarchy Tables
-- ------------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE curriculum_type AS ENUM ('CBC', 'KCSE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE education_level AS ENUM ('PP', 'PRIMARY', 'JUNIOR_SCHOOL', 'SENIOR_SCHOOL', 'KCSE_SECONDARY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.curriculums (
    id SERIAL PRIMARY KEY,
    name curriculum_type NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.grade_levels (
    id SERIAL PRIMARY KEY,
    curriculum_id INT REFERENCES public.curriculums(id) ON DELETE CASCADE,
    level_category education_level NOT NULL,
    name VARCHAR(50) NOT NULL, -- e.g., 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Form 1', 'Form 4'
    sequence_order INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(curriculum_id, name)
);

CREATE TABLE IF NOT EXISTS public.subjects (
    id SERIAL PRIMARY KEY,
    curriculum_id INT REFERENCES public.curriculums(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., 'Integrated Science', 'Kiswahili', 'Physics', 'Mathematics'
    code VARCHAR(20) UNIQUE,
    department VARCHAR(100), -- e.g., 'Sciences', 'Languages', 'Humanities', 'Technical & Applied'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2. Books & Publisher Metadata
-- ------------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE book_category AS ENUM ('STUDENT_TEXTBOOK', 'TEACHERS_GUIDE', 'REVISION_GUIDE', 'PAST_PAPER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.curriculum_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    isbn VARCHAR(20) UNIQUE,
    publisher VARCHAR(150) NOT NULL, -- e.g., 'KICD', 'Kenya Literature Bureau (KLB)', 'Oxford University Press', 'Longhorn Publishers', 'Jomo Kenyatta Foundation (JKF)'
    is_kicd_approved BOOLEAN DEFAULT FALSE,
    category book_category NOT NULL DEFAULT 'STUDENT_TEXTBOOK',
    subject_id INT REFERENCES public.subjects(id) ON DELETE RESTRICT,
    grade_level_id INT REFERENCES public.grade_levels(id) ON DELETE RESTRICT,
    edition VARCHAR(50),
    cover_image_url TEXT,
    pdf_file_url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 3. Content Taxonomy (Strands / Topics & Sub-strands / Sub-topics)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.book_chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.curriculum_books(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL, -- e.g., 'Strand 1.0: Living Things' or 'Topic 3: Matrices & Transformations'
    chapter_number INT NOT NULL,
    page_start INT,
    page_end INT,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.book_sub_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID REFERENCES public.book_chapters(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL, -- e.g., 'Sub-strand 1.1: Human Digestive System' or 'Subtopic 3.2: Inverse of a 2x2 Matrix'
    learning_outcomes TEXT[], -- Specific CBC core competencies (e.g. Critical Thinking, Problem Solving) or KCSE objectives
    order_index INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 4. EduAI RAG & Vector Search Indexing
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.book_content_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.curriculum_books(id) ON DELETE CASCADE,
    sub_topic_id UUID REFERENCES public.book_sub_topics(id) ON DELETE SET NULL,
    page_number INT NOT NULL,
    content_text TEXT NOT NULL,
    embedding vector(1536), -- Vector size matching standard text-embedding-3-small or Gemini text-embedding-004 (1536 or 768)
    token_count INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- HNSW Vector Index for ultra-fast semantic cosine similarity lookups
CREATE INDEX IF NOT EXISTS idx_book_chunks_vector 
ON public.book_content_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Additional operational indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_curriculum_books_subject ON public.curriculum_books(subject_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_books_grade ON public.curriculum_books(grade_level_id);
CREATE INDEX IF NOT EXISTS idx_book_chapters_book ON public.book_chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_book_sub_topics_chapter ON public.book_sub_topics(chapter_id);
CREATE INDEX IF NOT EXISTS idx_book_content_chunks_book_page ON public.book_content_chunks(book_id, page_number);

-- ------------------------------------------------------------------------------
-- 5. RAG Vector Search Helper RPC (match_book_content_chunks)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_book_content_chunks (
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.65,
  match_count int DEFAULT 5,
  filter_book_id uuid DEFAULT NULL,
  filter_subject_id int DEFAULT NULL,
  filter_grade_level_id int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  book_id uuid,
  book_title varchar,
  publisher varchar,
  sub_topic_id uuid,
  sub_topic_title varchar,
  chapter_title varchar,
  page_number int,
  content_text text,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.book_id,
    b.title AS book_title,
    b.publisher AS publisher,
    c.sub_topic_id,
    st.title AS sub_topic_title,
    ch.title AS chapter_title,
    c.page_number,
    c.content_text,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.book_content_chunks c
  JOIN public.curriculum_books b ON b.id = c.book_id
  LEFT JOIN public.book_sub_topics st ON st.id = c.sub_topic_id
  LEFT JOIN public.book_chapters ch ON ch.id = st.chapter_id
  WHERE (1 - (c.embedding <=> query_embedding)) > match_threshold
    AND (filter_book_id IS NULL OR c.book_id = filter_book_id)
    AND (filter_subject_id IS NULL OR b.subject_id = filter_subject_id)
    AND (filter_grade_level_id IS NULL OR b.grade_level_id = filter_grade_level_id)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Row Level Security (RLS) & Policies
-- ------------------------------------------------------------------------------

ALTER TABLE public.curriculums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_sub_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_content_chunks ENABLE ROW LEVEL SECURITY;

-- Read policies (accessible to public & all authenticated students/teachers)
DO $$ BEGIN
  CREATE POLICY "Public read access for curriculums" ON public.curriculums FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read access for grade_levels" ON public.grade_levels FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read access for subjects" ON public.subjects FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read access for curriculum_books" ON public.curriculum_books FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read access for book_chapters" ON public.book_chapters FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read access for book_sub_topics" ON public.book_sub_topics FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read access for book_content_chunks" ON public.book_content_chunks FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Write policies (authenticated users / teachers / admins)
DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert curriculum_books" ON public.curriculum_books FOR INSERT WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update curriculum_books" ON public.curriculum_books FOR UPDATE USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Enable Supabase Realtime for instant synchronization
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.curriculum_books;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.book_chapters;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ------------------------------------------------------------------------------
-- 7. Seed Official Kenyan CBC & KCSE Curriculums, Grades, Subjects & Books
-- ------------------------------------------------------------------------------

-- Seed Curriculums
INSERT INTO public.curriculums (id, name, description)
VALUES 
  (1, 'CBC', 'Competency-Based Curriculum (CBC) 2-6-3-3-3 education system focusing on learner-centered core competencies, practical strands, and values in Kenya.'),
  (2, 'KCSE', '8-4-4 Secondary School System preparing students for the Kenya Certificate of Secondary Education (KCSE) with subject mastery and national exam past papers.')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Seed Grade Levels (CBC & KCSE)
INSERT INTO public.grade_levels (id, curriculum_id, level_category, name, sequence_order)
VALUES
  -- CBC Levels
  (1, 1, 'PP', 'Pre-Primary 1 (PP1)', 1),
  (2, 1, 'PP', 'Pre-Primary 2 (PP2)', 2),
  (3, 1, 'PRIMARY', 'Grade 1', 3),
  (4, 1, 'PRIMARY', 'Grade 2', 4),
  (5, 1, 'PRIMARY', 'Grade 3', 5),
  (6, 1, 'PRIMARY', 'Grade 4', 6),
  (7, 1, 'PRIMARY', 'Grade 5', 7),
  (8, 1, 'PRIMARY', 'Grade 6', 8),
  (9, 1, 'JUNIOR_SCHOOL', 'Grade 7 (Junior School)', 9),
  (10, 1, 'JUNIOR_SCHOOL', 'Grade 8 (Junior School)', 10),
  (11, 1, 'JUNIOR_SCHOOL', 'Grade 9 (Junior School)', 11),
  (12, 1, 'SENIOR_SCHOOL', 'Grade 10 (Senior School)', 12),
  (13, 1, 'SENIOR_SCHOOL', 'Grade 11 (Senior School)', 13),
  (14, 1, 'SENIOR_SCHOOL', 'Grade 12 (Senior School)', 14),

  -- KCSE Levels
  (15, 2, 'KCSE_SECONDARY', 'Form 1 (KCSE 8-4-4)', 15),
  (16, 2, 'KCSE_SECONDARY', 'Form 2 (KCSE 8-4-4)', 16),
  (17, 2, 'KCSE_SECONDARY', 'Form 3 (KCSE 8-4-4)', 17),
  (18, 2, 'KCSE_SECONDARY', 'Form 4 (KCSE 8-4-4 Candidate)', 18)
ON CONFLICT (curriculum_id, name) DO UPDATE SET 
  level_category = EXCLUDED.level_category,
  sequence_order = EXCLUDED.sequence_order;

-- Seed Core Kenyan Subjects
INSERT INTO public.subjects (id, curriculum_id, name, code, department)
VALUES
  -- CBC Learning Areas
  (1, 1, 'Mathematics', 'CBC-MATH', 'Mathematics'),
  (2, 1, 'English Language & Literature', 'CBC-ENG', 'Languages'),
  (3, 1, 'Kiswahili Lugha na Fasihi', 'CBC-KIS', 'Languages'),
  (4, 1, 'Integrated Science', 'CBC-INTSCI', 'Sciences'),
  (5, 1, 'Social Studies & Life Skills', 'CBC-SST', 'Humanities'),
  (6, 1, 'Agriculture and Nutrition', 'CBC-AGRI', 'Technical & Applied'),
  (7, 1, 'Pre-Technical and Pre-Career Studies', 'CBC-PRETECH', 'Technical & Applied'),
  (8, 1, 'Creative Arts and Sports', 'CBC-ARTS', 'Creative & Performing'),
  (9, 1, 'Computer Science & AI Foundations', 'CBC-CS', 'ICT & Emerging Tech'),
  (10, 1, 'Christian Religious Education (CRE)', 'CBC-CRE', 'Humanities'),
  (11, 1, 'Islamic Religious Education (IRE)', 'CBC-IRE', 'Humanities'),

  -- KCSE Subjects (8-4-4)
  (12, 2, 'Mathematics (121)', 'KCSE-121', 'Mathematics'),
  (13, 2, 'English (101)', 'KCSE-101', 'Languages'),
  (14, 2, 'Kiswahili (102)', 'KCSE-102', 'Languages'),
  (15, 2, 'Physics (232)', 'KCSE-232', 'Sciences'),
  (16, 2, 'Chemistry (233)', 'KCSE-233', 'Sciences'),
  (17, 2, 'Biology (231)', 'KCSE-231', 'Sciences'),
  (18, 2, 'History and Government (311)', 'KCSE-311', 'Humanities'),
  (19, 2, 'Geography (312)', 'KCSE-312', 'Humanities'),
  (20, 2, 'Business Studies (565)', 'KCSE-565', 'Applied & Business'),
  (21, 2, 'Computer Studies (451)', 'KCSE-451', 'Applied & Technical')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  department = EXCLUDED.department;

-- Reset SERIAL sequences safely
SELECT setval('curriculums_id_seq', (SELECT MAX(id) FROM curriculums));
SELECT setval('grade_levels_id_seq', (SELECT MAX(id) FROM grade_levels));
SELECT setval('subjects_id_seq', (SELECT MAX(id) FROM subjects));

-- Seed Representative Accredited CBC & KCSE Books with KICD approval
INSERT INTO public.curriculum_books (
  id, title, isbn, publisher, is_kicd_approved, category, subject_id, grade_level_id, edition, cover_image_url, pdf_file_url, description
)
VALUES
  (
    '11111111-1111-4000-8000-000000000001'::uuid,
    'Top Scholar Junior Secondary Grade 9 Mathematics',
    '978-9966-25-101-1',
    'Kenya Literature Bureau (KLB)',
    TRUE,
    'STUDENT_TEXTBOOK',
    1, -- CBC Mathematics
    11, -- Grade 9 (Junior School)
    '2026 CBC Edition',
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=400',
    'cbc-g9-math-klb.pdf',
    'Official KICD approved learner guide for Grade 9 CBC Mathematics covering linear inequalities, coordinates, financial literacy, and geometric transformations.'
  ),
  (
    '11111111-1111-4000-8000-000000000002'::uuid,
    'Spark Integrated Science Grade 9 Learner''s Book',
    '978-9966-36-402-3',
    'Longhorn Publishers',
    TRUE,
    'STUDENT_TEXTBOOK',
    4, -- CBC Integrated Science
    11, -- Grade 9 (Junior School)
    '2026 Revised CBC',
    'https://images.unsplash.com/photo-1532094349884-543bb1198343?auto=format&fit=crop&q=80&w=400',
    'cbc-g9-intscience-longhorn.pdf',
    'Comprehensive competency-based exploration of biological systems, environmental conservation, energy conversions, and chemical properties.'
  ),
  (
    '11111111-1111-4000-8000-000000000003'::uuid,
    'CBC Grade 10 Senior Secondary Physics Foundation',
    '978-9966-22-805-4',
    'Jomo Kenyatta Foundation (JKF)',
    TRUE,
    'STUDENT_TEXTBOOK',
    9, -- CBC CS / Science
    12, -- Grade 10 (Senior School)
    'First Senior Edition',
    'https://images.unsplash.com/photo-1554558727-6f81c9535aa7?auto=format&fit=crop&q=80&w=400',
    'cbc-g10-physics-jkf.pdf',
    'Comprehensive senior secondary physics textbook following the Kenyan Competency Based Curriculum (CBC) pathways.'
  ),
  (
    '11111111-1111-4000-8000-000000000004'::uuid,
    'KCSE Golden Tips Physics Form 4 National Exam Revision',
    '978-0195-73-909-0',
    'Oxford University Press',
    TRUE,
    'REVISION_GUIDE',
    15, -- KCSE Physics
    18, -- Form 4
    'Golden Edition 2026',
    'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=400',
    'kcse-f4-physics-oxford.pdf',
    'Complete KCSE Paper 232/1, 232/2 & 232/3 examination mastery handbook with KNEC-style marking schemes, worked examples, and physics practical drills.'
  ),
  (
    '11111111-1111-4000-8000-000000000005'::uuid,
    'KCSE Top Mark Mathematics Form 4 with Past Papers',
    '978-9966-25-888-2',
    'Kenya Literature Bureau (KLB)',
    TRUE,
    'PAST_PAPER',
    12, -- KCSE Mathematics
    18, -- Form 4
    '2026 Examination Edition',
    'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?auto=format&fit=crop&q=80&w=400',
    'kcse-f4-math-pastpapers.pdf',
    'Over 10 years of categorized KNEC KCSE Mathematics examination past papers with step-by-step solutions for Paper 1 (121/1) and Paper 2 (121/2).'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  publisher = EXCLUDED.publisher,
  is_kicd_approved = EXCLUDED.is_kicd_approved,
  category = EXCLUDED.category,
  subject_id = EXCLUDED.subject_id,
  grade_level_id = EXCLUDED.grade_level_id,
  pdf_file_url = EXCLUDED.pdf_file_url,
  description = EXCLUDED.description;

-- Seed Sample Chapters (CBC Strands & KCSE Topics)
INSERT INTO public.book_chapters (id, book_id, title, chapter_number, page_start, page_end, summary)
VALUES
  -- CBC Grade 9 Math Strands
  (
    '22222222-2222-4000-8000-000000000001'::uuid,
    '11111111-1111-4000-8000-000000000001'::uuid,
    'Strand 1.0: Numbers and Financial Calculations',
    1,
    1,
    28,
    'Covers compound interest, exchange rates in EAC economies, percentage profit, and banking operations.'
  ),
  (
    '22222222-2222-4000-8000-000000000002'::uuid,
    '11111111-1111-4000-8000-000000000001'::uuid,
    'Strand 2.0: Algebra, Linear Equations and Inequalities',
    2,
    29,
    64,
    'Formulating simultaneous linear equations from real-life scenarios, graphical solutions, and region inequalities.'
  ),
  -- KCSE Form 4 Physics Topics
  (
    '22222222-2222-4000-8000-000000000003'::uuid,
    '11111111-1111-4000-8000-000000000004'::uuid,
    'Topic 1.0: Electromagnetic Induction (Faraday & Lenz Laws)',
    1,
    1,
    35,
    'Induced EMF, mutual induction, transformers step-up/down, alternating current generation, and power transmission in the national grid.'
  ),
  (
    '22222222-2222-4000-8000-000000000004'::uuid,
    '11111111-1111-4000-8000-000000000004'::uuid,
    'Topic 2.0: Radioactivity and Nuclear Energy',
    2,
    36,
    72,
    'Alpha, beta and gamma decays, half-life equations, Geiger-Muller counters, nuclear fission and safety protocols.'
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Sub-topics with CBC Competencies & KCSE Objectives
INSERT INTO public.book_sub_topics (id, chapter_id, title, learning_outcomes, order_index)
VALUES
  (
    '33333333-3333-4000-8000-000000000001'::uuid,
    '22222222-2222-4000-8000-000000000001'::uuid,
    'Sub-strand 1.1: Foreign Exchange Rates & EAC Currency Conversions',
    ARRAY['Apply exchange rate tables to convert KES to USD, GBP, and UGX', 'Solve real-world trade transactions within the East African Community', 'Demonstrate financial integrity and accuracy in currency calculations'],
    1
  ),
  (
    '33333333-3333-4000-8000-000000000002'::uuid,
    '22222222-2222-4000-8000-000000000001'::uuid,
    'Sub-strand 1.2: Simple and Compound Interest Formulae',
    ARRAY['Differentiate between simple interest (I=PRT/100) and compound interest (A=P(1+r/100)^n)', 'Calculate investments, appreciation, and depreciation in Kenyan commercial banks', 'Cultivate savings and wealth creation values'],
    2
  ),
  (
    '33333333-3333-4000-8000-000000000003'::uuid,
    '22222222-2222-4000-8000-000000000003'::uuid,
    'Subtopic 1.1: Faraday''s and Lenz''s Laws of Induction',
    ARRAY['State Faraday’s law of electromagnetic induction', 'Predict the direction of induced current using Lenz’s law and Fleming’s right-hand rule', 'Solve quantitative problems on induced EMF E = -N(dPhi/dt)'],
    1
  )
ON CONFLICT (id) DO NOTHING;
