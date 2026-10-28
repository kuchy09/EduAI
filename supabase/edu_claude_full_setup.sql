-- ==============================================================================
-- EDU AI ORG / EDU-CLAUDE — MASTER STANDALONE SUPABASE BLUEPRINT
-- ==============================================================================
-- Safe, 100% idempotent single-pass setup script for Supabase SQL Editor.
-- Configures:
--   1. Database Extensions (uuid-ossp, pgcrypto, pg_trgm, vector)
--   2. Custom Enum Types (curriculum_type, education_level, book_category)
--   3. All 25 Table Editor Tables + Monthly Usage View
--   4. Database Functions & RPCs (is_admin, handle_new_user, check_tutor_quota,
--      match_book_content_chunks, sync_community_post_counts, handle_updated_at)
--   5. Authentication Triggers (auth.users -> profiles + user_reading_goals)
--   6. Row Level Security (RLS) Policies for all 25 Tables
--   7. Storage Explorer: 6 Buckets (books, book-covers, avatars, workspace-files,
--      chat-attachments, audiobooks) + storage.objects RLS Policies
--   8. Indexes (GIN pg_trgm, HNSW pgvector, B-tree) & Realtime Publications
--   9. Seed Data (Curriculums, Grades, Subjects, KICD/KLB Books, Directory, Forum)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE public.curriculum_type AS ENUM ('CBC', 'KCSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.education_level AS ENUM ('PP', 'PRIMARY', 'JUNIOR_SCHOOL', 'SENIOR_SCHOOL', 'KCSE_SECONDARY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.book_category AS ENUM ('STUDENT_TEXTBOOK', 'TEACHERS_GUIDE', 'REVISION_GUIDE', 'PAST_PAPER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. CORE TABLES (TABLE EDITOR)

-- 3.1 Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  username text UNIQUE,
  full_name text,
  email text,
  phone text,
  dob date,
  avatar_url text,
  website text,
  role text DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'educator', 'parent', 'admin')),
  title text,
  institution text,
  country text,
  location text,
  bio text,
  subjects text,
  education_level text,
  field_of_study text,
  curriculum text,
  status text DEFAULT 'online' CHECK (status IN ('online', 'offline', 'away')),
  allow_ai_personalization boolean DEFAULT true,
  last_seen timestamptz DEFAULT timezone('utc'::text, now()),
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS username_length;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dob date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allow_ai_personalization boolean DEFAULT true;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'teacher', 'educator', 'parent', 'admin'));

-- 3.2 Friend Requests
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  note text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_sender_receiver UNIQUE (sender_id, receiver_id)
);

-- 3.3 Books Catalog
CREATE TABLE IF NOT EXISTS public.books (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  title text NOT NULL,
  author text,
  publisher varchar(255),
  isbn varchar(50),
  is_kicd_approved boolean DEFAULT false,
  description text,
  category text,
  education_level text,
  curriculum text,
  country text DEFAULT 'Kenya',
  subjects text,
  cover_image text,
  cover_mode text DEFAULT 'image',
  pdf_cover_page integer DEFAULT 1,
  custom_cover jsonb,
  file_url text,
  total_pages integer,
  file_size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz DEFAULT timezone('utc'::text, now()),
  CONSTRAINT books_title_author_key UNIQUE (title, author)
);

-- 3.4 Curriculums, Grade Levels, Subjects, Curriculum Books, Chapters, Sub-topics & RAG Chunks
CREATE TABLE IF NOT EXISTS public.curriculums (
  id serial PRIMARY KEY,
  name public.curriculum_type NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.grade_levels (
  id serial PRIMARY KEY,
  curriculum_id int REFERENCES public.curriculums(id) ON DELETE CASCADE,
  level_category public.education_level NOT NULL,
  name varchar(50) NOT NULL,
  sequence_order int NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  UNIQUE (curriculum_id, name)
);

CREATE TABLE IF NOT EXISTS public.subjects (
  id serial PRIMARY KEY,
  curriculum_id int REFERENCES public.curriculums(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  code varchar(20) UNIQUE,
  department varchar(100),
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.curriculum_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL,
  isbn varchar(20) UNIQUE,
  publisher varchar(150) NOT NULL,
  is_kicd_approved boolean DEFAULT false,
  category public.book_category NOT NULL DEFAULT 'STUDENT_TEXTBOOK',
  subject_id int REFERENCES public.subjects(id) ON DELETE RESTRICT,
  grade_level_id int REFERENCES public.grade_levels(id) ON DELETE RESTRICT,
  edition varchar(50),
  cover_image_url text,
  pdf_file_url text NOT NULL,
  description text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.book_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.curriculum_books(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  chapter_number int NOT NULL,
  page_start int,
  page_end int,
  summary text,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.book_sub_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid REFERENCES public.book_chapters(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  learning_outcomes text[],
  order_index int NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.book_content_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.curriculum_books(id) ON DELETE CASCADE,
  sub_topic_id uuid REFERENCES public.book_sub_topics(id) ON DELETE SET NULL,
  page_number int NOT NULL,
  content_text text NOT NULL,
  embedding vector(1536),
  token_count int,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- 3.5 Reading Progress, Goals, Bookmarks, Highlights & Shared Book Notes
CREATE TABLE IF NOT EXISTS public.reading_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id text NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  current_page integer,
  total_pages integer,
  scroll_pct integer,
  last_read_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS public.user_reading_goals (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  goal_type text NOT NULL DEFAULT 'time',
  target integer NOT NULL DEFAULT 20,
  current_minutes integer NOT NULL DEFAULT 0,
  current_pages integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  last_completed_date text,
  history jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id text NOT NULL,
  page_number integer DEFAULT 1,
  title text,
  notes text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, book_id, page_number)
);

CREATE TABLE IF NOT EXISTS public.highlights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id text NOT NULL,
  text text NOT NULL,
  note text,
  chapter_title text,
  page_number integer,
  color text DEFAULT 'yellow' NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.shared_book_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id text NOT NULL,
  book_title text,
  author_id uuid NOT NULL,
  author_name text,
  title text NOT NULL,
  content text NOT NULL,
  highlighted_excerpt text,
  page_number integer,
  style_preset text DEFAULT 'Style 01',
  visibility text NOT NULL DEFAULT 'friends' CHECK (visibility IN ('private', 'friends', 'public')),
  can_others_edit boolean NOT NULL DEFAULT false,
  shared_with uuid[] DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.6 Workspace Folders & Files
CREATE TABLE IF NOT EXISTS public.workspace_folders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT '#6366f1',
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.workspace_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id uuid REFERENCES public.workspace_folders(id) ON DELETE SET NULL,
  name text NOT NULL,
  type text NOT NULL,
  mime_type text,
  size bigint NOT NULL,
  storage_bucket text DEFAULT 'workspace-files',
  s3_key text NOT NULL,
  summary text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- 3.7 Quizzes, Attempts, Learning Paths & Audiobooks
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid,
  book_id text,
  title text NOT NULL,
  subject text NOT NULL DEFAULT 'General',
  curriculum text,
  grade_level text,
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  correct_count integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  answers jsonb DEFAULT '[]'::jsonb,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at timestamptz DEFAULT timezone('utc'::text, now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  field_of_study text,
  subjects text,
  plan_mode text NOT NULL DEFAULT 'roadmap' CHECK (plan_mode IN ('roadmap', 'weekly')),
  learner_style text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.audiobook_narrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id text NOT NULL,
  page_number integer NOT NULL DEFAULT 1,
  chapter_title text,
  source_text text,
  conversational_narration text NOT NULL,
  complex_concepts jsonb DEFAULT '[]'::jsonb,
  visualization_prompts jsonb DEFAULT '[]'::jsonb,
  audio_file_url text,
  duration_seconds integer,
  voice_preset text DEFAULT 'warm_tutor',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (book_id, page_number, voice_preset)
);

-- 3.8 Conversations, Participants, Messages, Community Forum, Notifications, Support & AI Usage
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name text,
  avatar_url text,
  subject_tag text,
  created_by uuid,
  last_message_text text,
  last_message_at timestamptz DEFAULT timezone('utc'::text, now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  unread_count integer NOT NULL DEFAULT 0,
  last_read_at timestamptz DEFAULT timezone('utc'::text, now()),
  joined_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email text,
  sender_name text,
  content text NOT NULL,
  message_type text DEFAULT 'text',
  attachments jsonb DEFAULT '[]'::jsonb,
  shared_note_id uuid REFERENCES public.shared_book_notes(id) ON DELETE SET NULL,
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  is_edited boolean DEFAULT false,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid,
  author_name text NOT NULL,
  author_role text NOT NULL DEFAULT 'Student',
  author_avatar text,
  title text NOT NULL,
  content text NOT NULL,
  tags text[] DEFAULT '{}'::text[],
  attachment_url text,
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.community_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  author_role text DEFAULT 'Student',
  author_avatar text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.community_post_likes (
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'system' CHECK (type IN ('system', 'friend_request', 'message', 'note_shared', 'quiz', 'goal_streak', 'community')),
  title text NOT NULL,
  body text NOT NULL,
  action_view text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  category text NOT NULL DEFAULT 'question' CHECK (category IN ('bug', 'feature', 'question', 'account')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.ai_tutor_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT 'general',
  provider text DEFAULT 'gemini',
  model text,
  book_id text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_tutor_usage_tokens_nonneg CHECK (input_tokens >= 0 AND output_tokens >= 0 AND total_tokens >= 0)
);

CREATE OR REPLACE VIEW public.ai_tutor_monthly_usage
WITH (security_invoker = true) AS
SELECT
  user_id,
  date_trunc('month', created_at) AS month,
  sum(total_tokens) AS total_tokens,
  count(*) AS request_count
FROM public.ai_tutor_usage
GROUP BY user_id, date_trunc('month', created_at);

-- 4. DATABASE FUNCTIONS & RPCs
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
  OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin', false)
  OR COALESCE((auth.jwt() ->> 'email') IN ('dicksonskello09@gmail.com', 'wolter@admin.com'), false);
$$;

CREATE OR REPLACE FUNCTION public.check_tutor_quota(p_user_id uuid)
RETURNS TABLE (tokens_used bigint, tokens_limit integer, is_over_limit boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE(sum(total_tokens), 0) AS tokens_used,
    50000 AS tokens_limit,
    COALESCE(sum(total_tokens), 0) >= 50000 AS is_over_limit
  FROM public.ai_tutor_usage
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('month', now());
$$;

REVOKE ALL ON FUNCTION public.check_tutor_quota(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_tutor_quota(uuid) TO service_role;

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

-- 5. AUTHENTICATION SYNC TRIGGER (Google, Apple, GitHub, Email & Phone)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_meta_name text;
  v_full_name text;
  v_username text;
  v_dob date;
  v_avatar text;
BEGIN
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'role', ''), 'student');
  IF NEW.email IN ('dicksonskello09@gmail.com', 'wolter@admin.com') THEN
    v_role := 'admin';
  ELSIF v_role NOT IN ('student', 'teacher', 'educator', 'parent', 'admin') THEN
    v_role := 'student';
  END IF;

  v_meta_name := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'name'), ''),
    NULLIF(
      BTRIM(
        CONCAT_WS(
          ' ',
          NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'given_name'), ''),
          NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'family_name'), '')
        )
      ),
      ''
    ),
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'preferred_username'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'user_name'), '')
  );

  v_full_name := COALESCE(
    v_meta_name,
    split_part(COALESCE(NEW.email, NEW.phone, 'learner'), '@', 1)
  );

  v_username := LOWER(
    COALESCE(
      NULLIF(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data ->> 'user_name', v_full_name), '[^a-zA-Z0-9_]+', '_', 'g'), ''),
      'learner'
    )
  ) || '_' || SUBSTRING(NEW.id::text FROM 1 FOR 6);

  v_avatar := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'avatar_url'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'picture'), '')
  );

  BEGIN
    IF NULLIF(NEW.raw_user_meta_data ->> 'dob', '') IS NOT NULL THEN
      v_dob := (NEW.raw_user_meta_data ->> 'dob')::date;
    END IF;
  EXCEPTION WHEN others THEN
    v_dob := NULL;
  END;

  INSERT INTO public.profiles (
    id, username, full_name, email, phone, dob, avatar_url, role,
    country, location, education_level, field_of_study, curriculum, subjects, status, updated_at
  )
  VALUES (
    NEW.id,
    v_username,
    v_full_name,
    NEW.email,
    NEW.phone,
    v_dob,
    v_avatar,
    v_role,
    NEW.raw_user_meta_data ->> 'country',
    NEW.raw_user_meta_data ->> 'country',
    NEW.raw_user_meta_data ->> 'education_level',
    NEW.raw_user_meta_data ->> 'field_of_study',
    NEW.raw_user_meta_data ->> 'curriculum',
    NEW.raw_user_meta_data ->> 'subjects',
    'online',
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    full_name = CASE
      WHEN v_meta_name IS NOT NULL THEN v_meta_name
      WHEN NULLIF(BTRIM(public.profiles.full_name), '') IS NOT NULL THEN public.profiles.full_name
      ELSE EXCLUDED.full_name
    END,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    role = CASE
      WHEN EXCLUDED.email IN ('dicksonskello09@gmail.com', 'wolter@admin.com') THEN 'admin'
      ELSE COALESCE(public.profiles.role, EXCLUDED.role)
    END,
    country = COALESCE(EXCLUDED.country, public.profiles.country),
    education_level = COALESCE(EXCLUDED.education_level, public.profiles.education_level),
    field_of_study = COALESCE(EXCLUDED.field_of_study, public.profiles.field_of_study),
    curriculum = COALESCE(EXCLUDED.curriculum, public.profiles.curriculum),
    subjects = COALESCE(EXCLUDED.subjects, public.profiles.subjects),
    updated_at = timezone('utc'::text, now());

  INSERT INTO public.user_reading_goals (user_id, goal_type, target)
  VALUES (NEW.id, 'time', 20)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, phone, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_community_post_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'community_post_likes' THEN
    UPDATE public.community_posts
    SET likes_count = (SELECT count(*) FROM public.community_post_likes WHERE post_id = COALESCE(NEW.post_id, OLD.post_id))
    WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  ELSIF TG_TABLE_NAME = 'community_post_comments' THEN
    UPDATE public.community_posts
    SET comments_count = (SELECT count(*) FROM public.community_post_comments WHERE post_id = COALESCE(NEW.post_id, OLD.post_id))
    WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_community_likes_count ON public.community_post_likes;
CREATE TRIGGER trg_community_likes_count
  AFTER INSERT OR DELETE ON public.community_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_community_post_counts();

DROP TRIGGER IF EXISTS trg_community_comments_count ON public.community_post_comments;
CREATE TRIGGER trg_community_comments_count
  AFTER INSERT OR DELETE ON public.community_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_community_post_counts();

-- 6. ROW LEVEL SECURITY (RLS)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles', 'friend_requests', 'books', 'curriculums', 'grade_levels', 'subjects',
    'curriculum_books', 'book_chapters', 'book_sub_topics', 'book_content_chunks',
    'reading_progress', 'user_reading_goals', 'bookmarks', 'highlights', 'shared_book_notes',
    'workspace_folders', 'workspace_files', 'quizzes', 'quiz_attempts', 'learning_paths',
    'audiobook_narrations', 'conversations', 'conversation_participants', 'messages',
    'community_posts', 'community_post_comments', 'community_post_likes',
    'notifications', 'support_tickets', 'ai_tutor_usage'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;

-- Profiles & Friend Requests
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can view relevant friend requests." ON public.friend_requests;
CREATE POLICY "Users can view relevant friend requests." ON public.friend_requests FOR SELECT USING (auth.uid()::text IN (sender_id, receiver_id) OR public.is_admin());
DROP POLICY IF EXISTS "Users can send friend requests." ON public.friend_requests;
CREATE POLICY "Users can send friend requests." ON public.friend_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::text = sender_id);
DROP POLICY IF EXISTS "Users can update friend requests." ON public.friend_requests;
CREATE POLICY "Users can update friend requests." ON public.friend_requests FOR UPDATE USING (auth.uid()::text IN (sender_id, receiver_id));
DROP POLICY IF EXISTS "Users can delete friend requests." ON public.friend_requests;
CREATE POLICY "Users can delete friend requests." ON public.friend_requests FOR DELETE USING (auth.uid()::text IN (sender_id, receiver_id));

-- Books & Curriculum Taxonomy
DROP POLICY IF EXISTS "Public can view books" ON public.books;
CREATE POLICY "Public can view books" ON public.books FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert books" ON public.books;
CREATE POLICY "Authenticated users can insert books" ON public.books FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can update books" ON public.books;
CREATE POLICY "Authenticated users can update books" ON public.books FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins and authenticated users can delete books" ON public.books;
CREATE POLICY "Admins and authenticated users can delete books" ON public.books FOR DELETE USING (public.is_admin() OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public read access for curriculums" ON public.curriculums;
CREATE POLICY "Public read access for curriculums" ON public.curriculums FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access for grade_levels" ON public.grade_levels;
CREATE POLICY "Public read access for grade_levels" ON public.grade_levels FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access for subjects" ON public.subjects;
CREATE POLICY "Public read access for subjects" ON public.subjects FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access for curriculum_books" ON public.curriculum_books;
CREATE POLICY "Public read access for curriculum_books" ON public.curriculum_books FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage curriculum_books" ON public.curriculum_books;
CREATE POLICY "Authenticated users can manage curriculum_books" ON public.curriculum_books FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Public read access for book_chapters" ON public.book_chapters;
CREATE POLICY "Public read access for book_chapters" ON public.book_chapters FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access for book_sub_topics" ON public.book_sub_topics;
CREATE POLICY "Public read access for book_sub_topics" ON public.book_sub_topics FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access for book_content_chunks" ON public.book_content_chunks;
CREATE POLICY "Public read access for book_content_chunks" ON public.book_content_chunks FOR SELECT USING (true);

-- User-Scoped Reader & Study Tables
DROP POLICY IF EXISTS "Users manage own reading_progress" ON public.reading_progress;
CREATE POLICY "Users manage own reading_progress" ON public.reading_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own user_reading_goals" ON public.user_reading_goals;
CREATE POLICY "Users manage own user_reading_goals" ON public.user_reading_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own bookmarks" ON public.bookmarks;
CREATE POLICY "Users manage own bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own highlights" ON public.highlights;
CREATE POLICY "Users manage own highlights" ON public.highlights FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own workspace_folders" ON public.workspace_folders;
CREATE POLICY "Users manage own workspace_folders" ON public.workspace_folders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own workspace_files" ON public.workspace_files;
CREATE POLICY "Users manage own workspace_files" ON public.workspace_files FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own learning_paths" ON public.learning_paths;
CREATE POLICY "Users manage own learning_paths" ON public.learning_paths FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Shared Notes, Quizzes, Audiobooks, Chat, Forum, Notifications, Support, AI Usage
DROP POLICY IF EXISTS "Users can view accessible shared book notes" ON public.shared_book_notes;
CREATE POLICY "Users can view accessible shared book notes" ON public.shared_book_notes FOR SELECT
  USING (visibility IN ('public', 'friends') OR author_id = auth.uid() OR (auth.uid() IS NOT NULL AND auth.uid() = ANY(shared_with)));
DROP POLICY IF EXISTS "Users can create own shared book notes" ON public.shared_book_notes;
CREATE POLICY "Users can create own shared book notes" ON public.shared_book_notes FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Authors or editors can update shared book notes" ON public.shared_book_notes;
CREATE POLICY "Authors or editors can update shared book notes" ON public.shared_book_notes FOR UPDATE
  USING (author_id = auth.uid() OR (can_others_edit = true AND auth.role() = 'authenticated'));
DROP POLICY IF EXISTS "Authors can delete shared book notes" ON public.shared_book_notes;
CREATE POLICY "Authors can delete shared book notes" ON public.shared_book_notes FOR DELETE USING (author_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Public or own quizzes are viewable" ON public.quizzes;
CREATE POLICY "Public or own quizzes are viewable" ON public.quizzes FOR SELECT USING (is_public = true OR creator_id = auth.uid());
DROP POLICY IF EXISTS "Authenticated users can create quizzes" ON public.quizzes;
CREATE POLICY "Authenticated users can create quizzes" ON public.quizzes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Creators can update or delete own quizzes" ON public.quizzes;
CREATE POLICY "Creators can update or delete own quizzes" ON public.quizzes FOR ALL USING (creator_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users manage own quiz_attempts" ON public.quiz_attempts;
CREATE POLICY "Users manage own quiz_attempts" ON public.quiz_attempts FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read audiobook narrations" ON public.audiobook_narrations;
CREATE POLICY "Anyone can read audiobook narrations" ON public.audiobook_narrations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can cache audiobook narrations" ON public.audiobook_narrations;
CREATE POLICY "Authenticated users can cache audiobook narrations" ON public.audiobook_narrations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can update conversations" ON public.conversations FOR UPDATE
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated manage conversation_participants" ON public.conversation_participants;
CREATE POLICY "Authenticated manage conversation_participants" ON public.conversation_participants FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view all messages." ON public.messages;
CREATE POLICY "Users can view all messages." ON public.messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own messages." ON public.messages;
CREATE POLICY "Users can insert their own messages." ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages" ON public.messages FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view community posts" ON public.community_posts;
CREATE POLICY "Anyone can view community posts" ON public.community_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create community posts" ON public.community_posts;
CREATE POLICY "Authenticated users can create community posts" ON public.community_posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authors or admins manage community posts" ON public.community_posts;
CREATE POLICY "Authors or admins manage community posts" ON public.community_posts FOR ALL USING (author_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Anyone can view post comments" ON public.community_post_comments;
CREATE POLICY "Anyone can view post comments" ON public.community_post_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can comment" ON public.community_post_comments;
CREATE POLICY "Authenticated users can comment" ON public.community_post_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Authors or admins delete comments" ON public.community_post_comments;
CREATE POLICY "Authors or admins delete comments" ON public.community_post_comments FOR DELETE USING (author_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Anyone can view post likes" ON public.community_post_likes;
CREATE POLICY "Anyone can view post likes" ON public.community_post_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users toggle own post likes" ON public.community_post_likes;
CREATE POLICY "Users toggle own post likes" ON public.community_post_likes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users submit support tickets" ON public.support_tickets;
CREATE POLICY "Users submit support tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own tickets and admins view all" ON public.support_tickets;
CREATE POLICY "Users view own tickets and admins view all" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Admins update support tickets" ON public.support_tickets;
CREATE POLICY "Admins update support tickets" ON public.support_tickets FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own usage" ON public.ai_tutor_usage;
CREATE POLICY "Users can view own usage" ON public.ai_tutor_usage FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
-- Service role bypasses RLS; clients cannot insert usage rows directly (matches 20261023000000_harden_ai_tutor_usage.sql)
DROP POLICY IF EXISTS "Service role can insert usage" ON public.ai_tutor_usage;

-- 7. STORAGE EXPLORER BUCKETS & POLICIES
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('books', 'books', true, 104857600, ARRAY['application/pdf', 'application/epub+zip']),
  ('book-covers', 'book-covers', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('workspace-files', 'workspace-files', false, 52428800, ARRAY['application/pdf', 'application/epub+zip', 'text/plain', 'text/markdown', 'application/json', 'image/png', 'image/jpeg', 'image/webp']),
  ('chat-attachments', 'chat-attachments', false, 26214400, NULL),
  ('audiobooks', 'audiobooks', true, 52428800, ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "EduAI public buckets read access" ON storage.objects;
CREATE POLICY "EduAI public buckets read access" ON storage.objects FOR SELECT
  USING (bucket_id IN ('books', 'book-covers', 'avatars', 'audiobooks'));

DROP POLICY IF EXISTS "EduAI books and covers write access" ON storage.objects;
CREATE POLICY "EduAI books and covers write access" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('books', 'book-covers', 'audiobooks') AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "EduAI books and covers update access" ON storage.objects;
CREATE POLICY "EduAI books and covers update access" ON storage.objects FOR UPDATE
  USING (bucket_id IN ('books', 'book-covers', 'audiobooks') AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "EduAI books and covers delete access" ON storage.objects;
CREATE POLICY "EduAI books and covers delete access" ON storage.objects FOR DELETE
  USING (bucket_id IN ('books', 'book-covers', 'audiobooks') AND (public.is_admin() OR owner = auth.uid()));

DROP POLICY IF EXISTS "EduAI avatars user manage" ON storage.objects;
CREATE POLICY "EduAI avatars user manage" ON storage.objects FOR ALL
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "EduAI workspace files user manage" ON storage.objects;
CREATE POLICY "EduAI workspace files user manage" ON storage.objects FOR ALL
  USING (bucket_id = 'workspace-files' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'workspace-files' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "EduAI chat attachments authenticated access" ON storage.objects;
CREATE POLICY "EduAI chat attachments authenticated access" ON storage.objects FOR ALL
  USING (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

-- 8. INDEXES & REALTIME PUBLICATIONS
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON public.profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON public.profiles USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_books_title_trgm ON public.books USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_book_chunks_vector ON public.book_content_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_reading_progress_user_book ON public.reading_progress (user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_book ON public.highlights (user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book ON public.bookmarks (user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_user_folder ON public.workspace_files (user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_usage_user_created ON public.ai_tutor_usage (user_id, created_at DESC);

DO $$
DECLARE
  rt_table text;
BEGIN
  FOREACH rt_table IN ARRAY ARRAY[
    'profiles', 'friend_requests', 'books', 'curriculum_books', 'book_chapters',
    'reading_progress', 'user_reading_goals', 'bookmarks', 'highlights',
    'shared_book_notes', 'conversations', 'messages', 'community_posts',
    'community_post_comments', 'notifications'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', rt_table);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- 9. SEED CURRICULUM HIERARCHY & INITIAL FORUM POSTS
INSERT INTO public.curriculums (id, name, description)
VALUES
  (1, 'CBC', 'Competency-Based Curriculum (CBC) 2-6-3-3-3 education system in Kenya.'),
  (2, 'KCSE', '8-4-4 Secondary School System preparing students for KCSE national exams.')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.grade_levels (id, curriculum_id, level_category, name, sequence_order)
VALUES
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
  (15, 2, 'KCSE_SECONDARY', 'Form 1 (KCSE 8-4-4)', 15),
  (16, 2, 'KCSE_SECONDARY', 'Form 2 (KCSE 8-4-4)', 16),
  (17, 2, 'KCSE_SECONDARY', 'Form 3 (KCSE 8-4-4)', 17),
  (18, 2, 'KCSE_SECONDARY', 'Form 4 (KCSE 8-4-4 Candidate)', 18)
ON CONFLICT (curriculum_id, name) DO UPDATE SET
  level_category = EXCLUDED.level_category,
  sequence_order = EXCLUDED.sequence_order;

INSERT INTO public.subjects (id, curriculum_id, name, code, department)
VALUES
  (1, 1, 'Mathematics', 'CBC-MATH', 'Mathematics'),
  (2, 1, 'English Language & Literature', 'CBC-ENG', 'Languages'),
  (3, 1, 'Kiswahili Lugha na Fasihi', 'CBC-KIS', 'Languages'),
  (4, 1, 'Integrated Science', 'CBC-INTSCI', 'Sciences'),
  (5, 1, 'Social Studies & Life Skills', 'CBC-SST', 'Humanities'),
  (6, 1, 'Agriculture and Nutrition', 'CBC-AGRI', 'Technical & Applied'),
  (7, 1, 'Pre-Technical and Pre-Career Studies', 'CBC-PRETECH', 'Technical & Applied'),
  (8, 1, 'Creative Arts and Sports', 'CBC-ARTS', 'Creative & Performing'),
  (9, 1, 'Computer Science & AI Foundations', 'CBC-CS', 'ICT & Emerging Tech'),
  (12, 2, 'Mathematics (121)', 'KCSE-121', 'Mathematics'),
  (13, 2, 'English (101)', 'KCSE-101', 'Languages'),
  (14, 2, 'Kiswahili (102)', 'KCSE-102', 'Languages'),
  (15, 2, 'Physics (232)', 'KCSE-232', 'Sciences'),
  (16, 2, 'Chemistry (233)', 'KCSE-233', 'Sciences'),
  (17, 2, 'Biology (231)', 'KCSE-231', 'Sciences'),
  (21, 2, 'Computer Studies (451)', 'KCSE-451', 'Applied & Technical')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department;

SELECT setval('curriculums_id_seq', COALESCE((SELECT MAX(id) FROM public.curriculums), 1));
SELECT setval('grade_levels_id_seq', COALESCE((SELECT MAX(id) FROM public.grade_levels), 1));
SELECT setval('subjects_id_seq', COALESCE((SELECT MAX(id) FROM public.subjects), 1));
