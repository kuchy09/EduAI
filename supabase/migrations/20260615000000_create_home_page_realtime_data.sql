-- Migration for Home Page & User Realtime Data
-- Enables real-time synchronization of reading progress, user daily goals, streaks, and books

-- 1. Create reading_progress table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.reading_progress (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  book_id text NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  current_page integer,
  total_pages integer,
  scroll_pct integer,
  last_read_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, book_id)
);

-- Enable RLS for reading_progress
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reading_progress' AND policyname = 'Users can view own reading progress') THEN
    CREATE POLICY "Users can view own reading progress" ON public.reading_progress FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reading_progress' AND policyname = 'Users can insert own reading progress') THEN
    CREATE POLICY "Users can insert own reading progress" ON public.reading_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reading_progress' AND policyname = 'Users can update own reading progress') THEN
    CREATE POLICY "Users can update own reading progress" ON public.reading_progress FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reading_progress' AND policyname = 'Users can delete own reading progress') THEN
    CREATE POLICY "Users can delete own reading progress" ON public.reading_progress FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Create user_reading_goals table for real-time goal & streak tracking
CREATE TABLE IF NOT EXISTS public.user_reading_goals (
  user_id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  goal_type text NOT NULL DEFAULT 'time',
  target integer NOT NULL DEFAULT 20,
  current_minutes integer NOT NULL DEFAULT 0,
  current_pages integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  last_completed_date text,
  history jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for user_reading_goals
ALTER TABLE public.user_reading_goals ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_reading_goals' AND policyname = 'Users can view own goals') THEN
    CREATE POLICY "Users can view own goals" ON public.user_reading_goals FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_reading_goals' AND policyname = 'Users can insert own goals') THEN
    CREATE POLICY "Users can insert own goals" ON public.user_reading_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_reading_goals' AND policyname = 'Users can update own goals') THEN
    CREATE POLICY "Users can update own goals" ON public.user_reading_goals FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Create books table if not exists (for book catalog and recommendations)
CREATE TABLE IF NOT EXISTS public.books (
  id text PRIMARY KEY,
  title text NOT NULL,
  author text,
  cover_image text,
  category text,
  description text,
  education_level text,
  curriculum text,
  subjects text,
  file_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for books
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'books' AND policyname = 'Public can view books') THEN
    CREATE POLICY "Public can view books" ON public.books FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'books' AND policyname = 'Authenticated users can insert books') THEN
    CREATE POLICY "Authenticated users can insert books" ON public.books FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'books' AND policyname = 'Authenticated users can update books') THEN
    CREATE POLICY "Authenticated users can update books" ON public.books FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 4. Enable Realtime Publications for all user tables
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reading_progress;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_reading_goals;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.books;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
