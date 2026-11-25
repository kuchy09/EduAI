-- ==============================================================================
-- Migration: Link Backblaze B2 Curriculum Shelves with Supabase public.books
-- ==============================================================================

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS subject_category text;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS b2_bucket text;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS b2_key text;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS book_format text DEFAULT 'pdf';
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS storage_provider text DEFAULT 'b2';
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS synced_to_b2_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_books_curriculum_subject
  ON public.books (curriculum, subject_category);

CREATE INDEX IF NOT EXISTS idx_books_b2_key
  ON public.books (b2_key);

-- Backfill existing curriculum shelf paths if already stored under curriculums/<shelf>/<subject>/<file>
UPDATE public.books
SET
  b2_key = file_url,
  storage_provider = 'b2',
  b2_bucket = COALESCE(b2_bucket, 'Edu-AI-Cloud'),
  subject_category = COALESCE(NULLIF(subject_category, ''), split_part(file_url, '/', 3)),
  book_format = CASE
    WHEN lower(split_part(file_url, '?', 1)) LIKE '%.epub' THEN 'epub'
    ELSE COALESCE(book_format, 'pdf')
  END,
  synced_to_b2_at = COALESCE(synced_to_b2_at, updated_at, created_at)
WHERE file_url LIKE 'curriculums/%/%/%';
