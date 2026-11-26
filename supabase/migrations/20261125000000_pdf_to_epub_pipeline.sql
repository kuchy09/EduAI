-- ==============================================================================
-- Migration: Automated PDF-to-EPUB 3 Pipeline, Canonical Book Structure,
--            Conversion Jobs, Quality Reports & Hybrid Reader State
-- ==============================================================================

-- 1. Extend public.books with integrity, processing & EPUB publication metadata
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS sha256_checksum text;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS mime_type text DEFAULT 'application/pdf';
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS file_size_bytes bigint;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS page_count integer;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending';
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS epub_file_key text;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS epub_published boolean DEFAULT false;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS conversion_confidence text;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS conversion_quality_score integer;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS rights_conversion_allowed boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_books_processing_status ON public.books (processing_status);
CREATE INDEX IF NOT EXISTS idx_books_checksum ON public.books (sha256_checksum);

-- 2. Extend book_chapters without breaking existing curriculum_books links
ALTER TABLE public.book_chapters ADD COLUMN IF NOT EXISTS book_catalog_id text;
ALTER TABLE public.book_chapters ADD COLUMN IF NOT EXISTS stable_id text;
ALTER TABLE public.book_chapters ADD COLUMN IF NOT EXISTS hierarchy_level integer DEFAULT 1;
ALTER TABLE public.book_chapters ADD COLUMN IF NOT EXISTS section_type text DEFAULT 'chapter';
ALTER TABLE public.book_chapters ADD COLUMN IF NOT EXISTS epub_href text;
ALTER TABLE public.book_chapters ADD COLUMN IF NOT EXISTS epub_anchor text;

-- 3. Hierarchical canonical sections & subsections
CREATE TABLE IF NOT EXISTS public.book_sections (
  id text PRIMARY KEY,
  book_id text NOT NULL,
  chapter_id text NOT NULL,
  parent_section_id text,
  stable_id text NOT NULL,
  title text NOT NULL,
  hierarchy_level integer NOT NULL DEFAULT 2,
  section_type text NOT NULL DEFAULT 'section',
  order_index integer NOT NULL DEFAULT 0,
  pdf_page_start integer NOT NULL DEFAULT 1,
  pdf_page_end integer NOT NULL DEFAULT 1,
  epub_href text NOT NULL,
  epub_anchor text NOT NULL,
  content_ref text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_book_sections_book ON public.book_sections (book_id, order_index);
CREATE INDEX IF NOT EXISTS idx_book_sections_chapter ON public.book_sections (chapter_id, order_index);

-- 4. Canonical structured content blocks (paragraphs, images, tables, math, exercises, learning objectives)
CREATE TABLE IF NOT EXISTS public.book_content_blocks (
  id text PRIMARY KEY,
  book_id text NOT NULL,
  chapter_id text NOT NULL,
  section_id text,
  block_type text NOT NULL DEFAULT 'paragraph',
  order_index integer NOT NULL DEFAULT 0,
  text_content text NOT NULL DEFAULT '',
  math_ml text,
  latex text,
  table_data jsonb,
  asset_id text,
  pdf_page_number integer NOT NULL DEFAULT 1,
  epub_anchor text,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_book_content_blocks_book ON public.book_content_blocks (book_id, order_index);
CREATE INDEX IF NOT EXISTS idx_book_content_blocks_section ON public.book_content_blocks (section_id, order_index);

-- 5. Extracted images, diagrams, and figure assets stored separately from original PDFs
CREATE TABLE IF NOT EXISTS public.book_extracted_assets (
  id text PRIMARY KEY,
  book_id text NOT NULL,
  asset_type text NOT NULL DEFAULT 'image',
  storage_key text NOT NULL,
  mime_type text NOT NULL DEFAULT 'image/png',
  width integer,
  height integer,
  pdf_page_number integer NOT NULL DEFAULT 1,
  caption text,
  sha256_checksum text,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_book_extracted_assets_book ON public.book_extracted_assets (book_id);

-- 6. Generated EPUB 3 artifacts & EPUBCheck validation tracking
CREATE TABLE IF NOT EXISTS public.book_epub_artifacts (
  id text PRIMARY KEY,
  book_id text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  epub_key text NOT NULL,
  sha256_checksum text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  validation_passed boolean NOT NULL DEFAULT false,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_book_epub_artifacts_book ON public.book_epub_artifacts (book_id, version DESC);

-- 7. Asynchronous background processing jobs (12-stage pipeline tracking)
CREATE TABLE IF NOT EXISTS public.book_processing_jobs (
  id text PRIMARY KEY,
  book_id text NOT NULL,
  source_pdf_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  current_stage text NOT NULL DEFAULT 'queued',
  stage_index integer NOT NULL DEFAULT 0,
  total_stages integer NOT NULL DEFAULT 12,
  progress_pct integer NOT NULL DEFAULT 0,
  ocr_status text NOT NULL DEFAULT 'not_needed',
  ocr_pages_count integer NOT NULL DEFAULT 0,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()),
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_book_processing_jobs_book ON public.book_processing_jobs (book_id, created_at DESC);

-- 8. Conversion quality & confidence assessment reports
CREATE TABLE IF NOT EXISTS public.book_conversion_reports (
  id text PRIMARY KEY,
  book_id text NOT NULL,
  job_id text NOT NULL,
  confidence_status text NOT NULL DEFAULT 'low',
  quality_score integer NOT NULL DEFAULT 0,
  total_pages integer NOT NULL DEFAULT 0,
  extracted_chapters_count integer NOT NULL DEFAULT 0,
  extracted_sections_count integer NOT NULL DEFAULT 0,
  extracted_images_count integer NOT NULL DEFAULT 0,
  extracted_tables_count integer NOT NULL DEFAULT 0,
  math_blocks_count integer NOT NULL DEFAULT 0,
  ocr_pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_passed boolean NOT NULL DEFAULT false,
  auto_published boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_book_conversion_reports_book ON public.book_conversion_reports (book_id, created_at DESC);

-- 9. Admin audit logs for uploads, conversions, TOC edits & publication overrides
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id text PRIMARY KEY,
  actor_user_id text,
  actor_email text,
  action text NOT NULL,
  book_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_book ON public.admin_audit_logs (book_id, created_at DESC);

-- 10. Extend reading_progress and bookmarks for hybrid PDF + EPUB position sync
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS active_format text DEFAULT 'pdf';
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS epub_chapter_href text;
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS canonical_section_id text;
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS scroll_offset numeric;

ALTER TABLE public.bookmarks ADD COLUMN IF NOT EXISTS canonical_section_id text;
ALTER TABLE public.bookmarks ADD COLUMN IF NOT EXISTS epub_href text;
ALTER TABLE public.bookmarks ADD COLUMN IF NOT EXISTS epub_anchor text;
ALTER TABLE public.bookmarks ADD COLUMN IF NOT EXISTS format text DEFAULT 'pdf';
ALTER TABLE public.bookmarks ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.bookmarks ADD COLUMN IF NOT EXISTS page_number integer;

-- 11. Row-Level Security policies
ALTER TABLE public.book_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_extracted_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_epub_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_conversion_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'book_sections' AND policyname = 'Public read canonical book sections') THEN
    CREATE POLICY "Public read canonical book sections" ON public.book_sections FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'book_content_blocks' AND policyname = 'Public read canonical book blocks') THEN
    CREATE POLICY "Public read canonical book blocks" ON public.book_content_blocks FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'book_extracted_assets' AND policyname = 'Public read book extracted assets') THEN
    CREATE POLICY "Public read book extracted assets" ON public.book_extracted_assets FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'book_epub_artifacts' AND policyname = 'Authenticated read published epub artifacts') THEN
    CREATE POLICY "Authenticated read published epub artifacts" ON public.book_epub_artifacts FOR SELECT USING (published = true OR auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'book_processing_jobs' AND policyname = 'Authenticated read processing jobs') THEN
    CREATE POLICY "Authenticated read processing jobs" ON public.book_processing_jobs FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'book_conversion_reports' AND policyname = 'Authenticated read conversion reports') THEN
    CREATE POLICY "Authenticated read conversion reports" ON public.book_conversion_reports FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit_logs' AND policyname = 'Service role only audit logs') THEN
    CREATE POLICY "Service role only audit logs" ON public.admin_audit_logs FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
