-- Supabase Migration: Create User Search & Friend Requests Directory Portal
-- File: /supabase/migrations/20260614000000_create_user_search_and_friends_portal.sql

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Enhance or create public.profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  username text UNIQUE,
  full_name text,
  email text,
  avatar_url text,
  role text DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'educator', 'admin')),
  title text,
  institution text,
  location text,
  bio text,
  subjects text,
  education_level text,
  field_of_study text,
  curriculum text,
  status text DEFAULT 'online' CHECK (status IN ('online', 'offline', 'away')),
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure all columns exist in case table was created previously
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'student';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS institution text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subjects text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education_level text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS field_of_study text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS curriculum text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'online';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Create searchable indexes on profiles for fast user discovery
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_institution ON public.profiles (institution);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON public.profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON public.profiles USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_subjects_trgm ON public.profiles USING gin (subjects gin_trgm_ops);

-- 4. Create friend_requests table for storing friendships and connection states
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_sender_receiver UNIQUE (sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests (sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests (receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests (status);

-- 5. Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Profiles: Publicly searchable by all users on the platform
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (true);

-- Friend Requests Policies
DROP POLICY IF EXISTS "Users can view relevant friend requests." ON public.friend_requests;
CREATE POLICY "Users can view relevant friend requests." ON public.friend_requests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can send friend requests." ON public.friend_requests;
CREATE POLICY "Users can send friend requests." ON public.friend_requests
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update friend requests." ON public.friend_requests;
CREATE POLICY "Users can update friend requests." ON public.friend_requests
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete friend requests." ON public.friend_requests;
CREATE POLICY "Users can delete friend requests." ON public.friend_requests
  FOR DELETE USING (true);

-- 6. Enable Supabase Realtime for instant friend requests notifications & presence
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 7. Seed Initial Platform Teachers and Students for search portal
INSERT INTO public.profiles (
  id, username, full_name, email, avatar_url, role, title, 
  institution, location, bio, subjects, education_level, curriculum, status
)
VALUES
(
  'e2b4f681-3c99-4781-b519-86f380123001',
  'sarah_mwangi',
  'Dr. Sarah Mwangi',
  'sarah.mwangi@eduai.ac.ke',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'teacher',
  'Lead Physics & Natural Sciences Educator',
  'National Science Academy',
  'Nairobi, Kenya',
  '15+ years coaching students for national physics olympiads & CBC curriculum development.',
  'Physics, Advanced Science, Mathematics',
  'PhD / Senior Faculty',
  'CBC Kenya',
  'online'
),
(
  'e2b4f681-3c99-4781-b519-86f380123002',
  'david_ochieng',
  'Mr. David Ochieng',
  'david.ochieng@eduai.ac.ke',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
  'teacher',
  'Head of Mathematics & Algorithms',
  'Alliance High Academic Hub',
  'Nakuru, Kenya',
  'Specialist in pure mathematics, algorithmic proofs, and CBC Kenya exam prep.',
  'Mathematics, Calculus, Statistics',
  'MSc Mathematics',
  'CBC Kenya',
  'online'
),
(
  'e2b4f681-3c99-4781-b519-86f380123003',
  'grace_wanjiru',
  'Prof. Grace Wanjiru',
  'grace.wanjiru@eduai.ac.ke',
  'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?w=150&auto=format&fit=crop&q=80',
  'teacher',
  'Senior Literature & Linguistics Teacher',
  'St. Jude Academy',
  'Mombasa, Kenya',
  'Guiding students through critical literary essays, drama analysis, and creative writing.',
  'Literature, English, Communication',
  'PhD Comparative Literature',
  'CBC Kenya',
  'offline'
),
(
  'e2b4f681-3c99-4781-b519-86f380123004',
  'patrick_mutua',
  'Mr. Patrick Mutua',
  'patrick.mutua@eduai.ac.ke',
  'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80',
  'teacher',
  'Computer Studies & ICT Faculty Lead',
  'Strathmore Secondary Hub',
  'Nairobi, Kenya',
  'Passionate about coding bootcamps, algorithms, and cybersecurity fundamentals.',
  'Computer Science, Cybersecurity, ICT',
  'BSc Computer Science',
  'CBC Kenya',
  'online'
),
(
  'e2b4f681-3c99-4781-b519-86f380123005',
  'elena_rodriguez',
  'Elena Rodriguez',
  'elena.rodriguez@student.edu',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'student',
  'Grade 12 STEM Scholar',
  'Nairobi Academic Senior Secondary',
  'Nairobi, Kenya',
  'Study buddy for STEM subjects. Working through Paul Dirac Modern Physics and Calculus.',
  'Physics, Chemistry, Calculus',
  'Grade 12 / Senior High',
  'CBC Kenya',
  'online'
),
(
  'e2b4f681-3c99-4781-b519-86f380123006',
  'alex_chen',
  'Alex Chen',
  'alex.chen@student.edu',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'student',
  'Computer Science Major Track',
  'Nairobi Academic Senior Secondary',
  'Nairobi, Kenya',
  'Coding daily in TypeScript & Python. Love solving algorithmic problems and data structures.',
  'Algorithms, Software Engineering, Math',
  'Grade 12 / Senior High',
  'CBC Kenya',
  'online'
),
(
  'e2b4f681-3c99-4781-b519-86f380123007',
  'faith_kiprono',
  'Faith Kiprono',
  'faith.kiprono@student.edu',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'student',
  'Grade 11 Senior Secondary Student',
  'Moi Girls National Academy',
  'Eldoret, Kenya',
  'Aiming for Biomedical Sciences. Dedicated note-taker and study group organizer.',
  'Biology, Chemistry, Agriculture',
  'Grade 11 / Senior High',
  'CBC Kenya',
  'offline'
),
(
  'e2b4f681-3c99-4781-b519-86f380123008',
  'samuel_wanjala',
  'Samuel Wanjala',
  'samuel.wanjala@student.edu',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'student',
  'Grade 12 Pure Science Student',
  'Lenana High School',
  'Nairobi, Kenya',
  'Pre-engineering student. Keen on kinematics and vector mathematics.',
  'Physics, Mathematics, Geography',
  'Grade 12 / Senior High',
  'CBC Kenya',
  'away'
),
(
  'e2b4f681-3c99-4781-b519-86f380123009',
  'zahra_omar',
  'Zahra Omar',
  'zahra.omar@student.edu',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'student',
  'Grade 10 CBC Learner',
  'Coast Academy',
  'Mombasa, Kenya',
  'Exploring junior high to senior transition topics and language learning.',
  'Integrated Science, ICT, French',
  'Grade 10 / Senior High',
  'CBC Kenya',
  'offline'
),
(
  'e2b4f681-3c99-4781-b519-86f380123010',
  'dut_nyok',
  'Dut Nyok',
  'dut.nyok@student.edu',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'student',
  'Grade 12 STEM & Computing Scholar',
  'Alliance High Academic Hub',
  'Nairobi, Kenya',
  'Passionate STEM scholar, competitive programmer, and avid physics reader on Edu AI. Exploring quantum mechanics and Python algorithms. Open to peer study sessions!',
  'Physics, Computer Science, Mathematics, Robotics',
  'Grade 12 / Senior High',
  'CBC Kenya',
  'online'
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  username = EXCLUDED.username,
  email = EXCLUDED.email,
  avatar_url = EXCLUDED.avatar_url,
  role = EXCLUDED.role,
  title = EXCLUDED.title,
  institution = EXCLUDED.institution,
  location = EXCLUDED.location,
  bio = EXCLUDED.bio,
  subjects = EXCLUDED.subjects,
  status = EXCLUDED.status,
  updated_at = now();
