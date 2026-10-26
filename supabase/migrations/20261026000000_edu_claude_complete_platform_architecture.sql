-- ==============================================================================
-- Migration: Edu AI Org / Edu-Claude Complete Platform Architecture
-- File: /supabase/migrations/20261026000000_edu_claude_complete_platform_architecture.sql
-- Covers:
--   1. Database Extensions (uuid-ossp, pgcrypto, pg_trgm, vector)
--   2. Table Editor Schema Completion & Alignment (25 Core Service Tables + Views)
--   3. Row Level Security (RLS) Policies & Admin Guard (public.is_admin)
--   4. Authentication Triggers (auth.users -> public.profiles & user_reading_goals)
--   5. Storage / Explorer Buckets & Object RLS Policies (6 Buckets)
--   6. Database Functions, RPCs, Triggers, Indexes & Realtime Publications
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ------------------------------------------------------------------------------
-- 2. CORE DATABASE UTILITY & ADMIN FUNCTIONS
-- ------------------------------------------------------------------------------
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
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
  OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin', false)
  OR COALESCE((auth.jwt() ->> 'email') IN ('dicksonskello09@gmail.com', 'wolter@admin.com'), false);
$$;

-- ------------------------------------------------------------------------------
-- 3. TABLE EDITOR: RECONCILE EXISTING TABLES & ADD COMPLETE SERVICE TABLES
-- ------------------------------------------------------------------------------

-- 3.1 Profiles (Identity, Roles, Onboarding Metadata, Presence)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS username_length;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS subjects text,
  ADD COLUMN IF NOT EXISTS education_level text,
  ADD COLUMN IF NOT EXISTS field_of_study text,
  ADD COLUMN IF NOT EXISTS curriculum text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS allow_ai_personalization boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'teacher', 'educator', 'parent', 'admin'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('online', 'offline', 'away'));

-- 3.2 Books Catalog (Supports both UUID strings and custom 'book-*' IDs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'books'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.books ALTER COLUMN id TYPE text USING id::text;
  END IF;
END $$;

ALTER TABLE public.books ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE public.books ALTER COLUMN author DROP NOT NULL;

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS publisher varchar(255),
  ADD COLUMN IF NOT EXISTS isbn varchar(50),
  ADD COLUMN IF NOT EXISTS is_kicd_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Kenya',
  ADD COLUMN IF NOT EXISTS cover_mode text DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS pdf_cover_page integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS custom_cover jsonb,
  ADD COLUMN IF NOT EXISTS total_pages integer,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

-- 3.3 Bookmarks & Highlights Enhancements (Reader Contextual Menu)
ALTER TABLE public.bookmarks
  ADD COLUMN IF NOT EXISTS page_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

ALTER TABLE public.bookmarks DROP CONSTRAINT IF EXISTS bookmarks_user_id_book_id_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookmarks_user_book_page_unique'
  ) THEN
    ALTER TABLE public.bookmarks
      ADD CONSTRAINT bookmarks_user_book_page_unique UNIQUE (user_id, book_id, page_number);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS chapter_title text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

-- 3.4 Shared Book Notes (Collaborative Study Notes in Reader & Chat)
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

-- 3.5 Workspace Folders & Files Enhancements
ALTER TABLE public.workspace_folders
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

ALTER TABLE public.workspace_files
  ADD COLUMN IF NOT EXISTS storage_bucket text DEFAULT 'workspace-files',
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

-- 3.6 Quizzes & Quiz Attempts (Interactive Assessments Service)
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

-- 3.7 Personalized AI Learning Paths
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

-- 3.8 Audiobook Narrations & Multimodal Concept Visualizations (Listen Mode)
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

-- 3.9 Conversations, Participants & Messages (1:1 & Study Group Chat)
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

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS shared_note_id uuid REFERENCES public.shared_book_notes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

ALTER TABLE public.messages ALTER COLUMN user_email DROP NOT NULL;

-- 3.10 Community Forum (Posts, Replies & Likes)
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

-- 3.11 Real-Time Notifications & Support Tickets
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

-- 3.12 AI Tutor Usage Telemetry Enhancements
ALTER TABLE public.ai_tutor_usage
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS book_id text;

-- ------------------------------------------------------------------------------
-- 4. AUTHENTICATION: AUTOMATIC USER -> PROFILE & GOAL SYNC TRIGGERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_full_name text;
  v_username text;
  v_dob date;
BEGIN
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'role', ''), 'student');
  IF NEW.email IN ('dicksonskello09@gmail.com', 'wolter@admin.com') THEN
    v_role := 'admin';
  ELSIF v_role NOT IN ('student', 'teacher', 'educator', 'parent', 'admin') THEN
    v_role := 'student';
  END IF;

  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    split_part(COALESCE(NEW.email, NEW.phone, 'learner'), '@', 1)
  );

  v_username := LOWER(REGEXP_REPLACE(v_full_name, '[^a-zA-Z0-9_]+', '_', 'g'))
                || '_' || SUBSTRING(NEW.id::text FROM 1 FOR 6);

  BEGIN
    IF NULLIF(NEW.raw_user_meta_data ->> 'dob', '') IS NOT NULL THEN
      v_dob := (NEW.raw_user_meta_data ->> 'dob')::date;
    END IF;
  EXCEPTION WHEN others THEN
    v_dob := NULL;
  END;

  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    email,
    phone,
    dob,
    avatar_url,
    role,
    country,
    location,
    education_level,
    field_of_study,
    curriculum,
    subjects,
    status,
    updated_at
  )
  VALUES (
    NEW.id,
    v_username,
    v_full_name,
    NEW.email,
    NEW.phone,
    v_dob,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture'),
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
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
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

-- ------------------------------------------------------------------------------
-- 5. COMMUNITY FORUM COUNTER TRIGGERS & UPDATED_AT TRIGGERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_community_post_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'community_post_likes' THEN
    UPDATE public.community_posts
    SET likes_count = (
      SELECT count(*) FROM public.community_post_likes
      WHERE post_id = COALESCE(NEW.post_id, OLD.post_id)
    )
    WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  ELSIF TG_TABLE_NAME = 'community_post_comments' THEN
    UPDATE public.community_posts
    SET comments_count = (
      SELECT count(*) FROM public.community_post_comments
      WHERE post_id = COALESCE(NEW.post_id, OLD.post_id)
    )
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

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'books', 'curriculum_books', 'reading_progress',
    'user_reading_goals', 'bookmarks', 'highlights', 'shared_book_notes',
    'workspace_folders', 'workspace_files', 'quizzes', 'learning_paths',
    'conversations', 'messages', 'community_posts', 'support_tickets'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES ACROSS ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.shared_book_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audiobook_narrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Books Delete Policy (Admin & Authenticated Uploaders)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'books' AND policyname = 'Admins and authenticated users can delete books') THEN
    CREATE POLICY "Admins and authenticated users can delete books"
      ON public.books FOR DELETE
      USING (public.is_admin() OR auth.role() = 'authenticated');
  END IF;
END $$;

-- Workspace Files Update Policy
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_files' AND policyname = 'Users can update their own files') THEN
    CREATE POLICY "Users can update their own files"
      ON public.workspace_files FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Shared Book Notes Policies
DROP POLICY IF EXISTS "Users can view accessible shared book notes" ON public.shared_book_notes;
CREATE POLICY "Users can view accessible shared book notes"
  ON public.shared_book_notes FOR SELECT
  USING (
    visibility = 'public'
    OR author_id = auth.uid()
    OR (auth.uid() IS NOT NULL AND auth.uid() = ANY(shared_with))
    OR visibility = 'friends'
  );

DROP POLICY IF EXISTS "Users can create own shared book notes" ON public.shared_book_notes;
CREATE POLICY "Users can create own shared book notes"
  ON public.shared_book_notes FOR INSERT
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors or editors can update shared book notes" ON public.shared_book_notes;
CREATE POLICY "Authors or editors can update shared book notes"
  ON public.shared_book_notes FOR UPDATE
  USING (author_id = auth.uid() OR (can_others_edit = true AND auth.role() = 'authenticated'));

DROP POLICY IF EXISTS "Authors can delete shared book notes" ON public.shared_book_notes;
CREATE POLICY "Authors can delete shared book notes"
  ON public.shared_book_notes FOR DELETE
  USING (author_id = auth.uid() OR public.is_admin());

-- Quizzes & Attempts Policies
DROP POLICY IF EXISTS "Public or own quizzes are viewable" ON public.quizzes;
CREATE POLICY "Public or own quizzes are viewable"
  ON public.quizzes FOR SELECT
  USING (is_public = true OR creator_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create quizzes" ON public.quizzes;
CREATE POLICY "Authenticated users can create quizzes"
  ON public.quizzes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Creators can update own quizzes" ON public.quizzes;
CREATE POLICY "Creators can update own quizzes"
  ON public.quizzes FOR UPDATE
  USING (creator_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Creators can delete own quizzes" ON public.quizzes;
CREATE POLICY "Creators can delete own quizzes"
  ON public.quizzes FOR DELETE
  USING (creator_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can view own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can view own quiz attempts"
  ON public.quiz_attempts FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can insert own quiz attempts"
  ON public.quiz_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can update own quiz attempts"
  ON public.quiz_attempts FOR UPDATE
  USING (auth.uid() = user_id);

-- Learning Paths Policies
DROP POLICY IF EXISTS "Users can manage own learning paths" ON public.learning_paths;
CREATE POLICY "Users can manage own learning paths"
  ON public.learning_paths FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Audiobook Narrations Policies
DROP POLICY IF EXISTS "Anyone can read audiobook narrations" ON public.audiobook_narrations;
CREATE POLICY "Anyone can read audiobook narrations"
  ON public.audiobook_narrations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can cache audiobook narrations" ON public.audiobook_narrations;
CREATE POLICY "Authenticated users can cache audiobook narrations"
  ON public.audiobook_narrations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Conversations & Participants Policies
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can view conversation membership" ON public.conversation_participants;
CREATE POLICY "Participants can view conversation membership"
  ON public.conversation_participants FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can join or add participants" ON public.conversation_participants;
CREATE POLICY "Authenticated users can join or add participants"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own participant state" ON public.conversation_participants;
CREATE POLICY "Users can update own participant state"
  ON public.conversation_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- Community Forum Policies
DROP POLICY IF EXISTS "Anyone can view community posts" ON public.community_posts;
CREATE POLICY "Anyone can view community posts"
  ON public.community_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create community posts" ON public.community_posts;
CREATE POLICY "Authenticated users can create community posts"
  ON public.community_posts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authors or admins can update community posts" ON public.community_posts;
CREATE POLICY "Authors or admins can update community posts"
  ON public.community_posts FOR UPDATE
  USING (author_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Authors or admins can delete community posts" ON public.community_posts;
CREATE POLICY "Authors or admins can delete community posts"
  ON public.community_posts FOR DELETE
  USING (author_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Anyone can view post comments" ON public.community_post_comments;
CREATE POLICY "Anyone can view post comments"
  ON public.community_post_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can comment on posts" ON public.community_post_comments;
CREATE POLICY "Authenticated users can comment on posts"
  ON public.community_post_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors or admins can delete comments" ON public.community_post_comments;
CREATE POLICY "Authors or admins can delete comments"
  ON public.community_post_comments FOR DELETE
  USING (author_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Anyone can view post likes" ON public.community_post_likes;
CREATE POLICY "Anyone can view post likes"
  ON public.community_post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can toggle own post likes" ON public.community_post_likes;
CREATE POLICY "Users can toggle own post likes"
  ON public.community_post_likes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notifications & Support Tickets Policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can submit support tickets" ON public.support_tickets;
CREATE POLICY "Users can submit support tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own tickets and admins view all" ON public.support_tickets;
CREATE POLICY "Users view own tickets and admins view all"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update support tickets" ON public.support_tickets;
CREATE POLICY "Admins can update support tickets"
  ON public.support_tickets FOR UPDATE
  USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 7. STORAGE / EXPLORER: BUCKETS & OBJECT RLS POLICIES
-- ------------------------------------------------------------------------------
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

-- Public Read Policies for Public Buckets (books, book-covers, avatars, audiobooks)
DROP POLICY IF EXISTS "EduAI public buckets read access" ON storage.objects;
CREATE POLICY "EduAI public buckets read access"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('books', 'book-covers', 'avatars', 'audiobooks'));

-- Books & Book-Covers Upload/Update/Delete (Authenticated & Admins)
DROP POLICY IF EXISTS "EduAI books and covers write access" ON storage.objects;
CREATE POLICY "EduAI books and covers write access"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('books', 'book-covers', 'audiobooks') AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "EduAI books and covers update access" ON storage.objects;
CREATE POLICY "EduAI books and covers update access"
  ON storage.objects FOR UPDATE
  USING (bucket_id IN ('books', 'book-covers', 'audiobooks') AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "EduAI books and covers delete access" ON storage.objects;
CREATE POLICY "EduAI books and covers delete access"
  ON storage.objects FOR DELETE
  USING (bucket_id IN ('books', 'book-covers', 'audiobooks') AND (public.is_admin() OR owner = auth.uid()));

-- Avatars User-Scoped Folder Write/Update/Delete ({user_id}/avatar.png)
DROP POLICY IF EXISTS "EduAI avatars user insert" ON storage.objects;
CREATE POLICY "EduAI avatars user insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "EduAI avatars user update" ON storage.objects;
CREATE POLICY "EduAI avatars user update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "EduAI avatars user delete" ON storage.objects;
CREATE POLICY "EduAI avatars user delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Workspace Files Private User-Scoped Access ({user_id}/*)
DROP POLICY IF EXISTS "EduAI workspace files user manage" ON storage.objects;
CREATE POLICY "EduAI workspace files user manage"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'workspace-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'workspace-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Chat Attachments Authenticated Access
DROP POLICY IF EXISTS "EduAI chat attachments authenticated access" ON storage.objects;
CREATE POLICY "EduAI chat attachments authenticated access"
  ON storage.objects FOR ALL
  USING (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

-- ------------------------------------------------------------------------------
-- 8. PERFORMANCE INDEXES & REALTIME PUBLICATIONS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_books_title_trgm ON public.books USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_books_curriculum_level ON public.books (curriculum, education_level);
CREATE INDEX IF NOT EXISTS idx_reading_progress_user_book ON public.reading_progress (user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_book ON public.highlights (user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book ON public.bookmarks (user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_user_folder ON public.workspace_files (user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz ON public.quiz_attempts (user_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts (created_at DESC);

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
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Seed Initial Community Forum Posts if empty
INSERT INTO public.community_posts (id, author_name, author_role, author_avatar, title, content, tags, likes_count, comments_count)
VALUES
  (
    '44444444-4444-4000-8000-000000000001'::uuid,
    'Elena Rodriguez',
    'Student',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100',
    'Study Group for Calculus II midterm?',
    'Looking for 3-4 people to join a focused study session this weekend. We will be covering integration by parts and differential equations. Anyone interested?',
    ARRAY['#StudyGroup', '#Calculus'],
    8,
    12
  ),
  (
    '44444444-4444-4000-8000-000000000002'::uuid,
    'Prof. James Wilson',
    'Educator',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100',
    'Best practices for LLM prompting in research',
    'I have compiled a list of effective strategies for using AI tools to assist with literature reviews without compromising academic integrity.',
    ARRAY['#AI', '#Research', '#AcademicIntegrity'],
    42,
    5
  )
ON CONFLICT (id) DO NOTHING;
