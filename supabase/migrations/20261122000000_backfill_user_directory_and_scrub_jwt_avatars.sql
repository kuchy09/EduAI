-- Backfill all registered auth.users into public.profiles directory
-- and remove oversized data:image/* URIs from auth.users metadata so JWT headers stay compact (< 2KB).

-- 1. Ensure public.profiles allows directory visibility for all members
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles
  FOR SELECT
  USING (true);

-- 2. Backfill every auth.users account into public.profiles if missing or missing email/name
INSERT INTO public.profiles (
  id,
  full_name,
  email,
  avatar_url,
  role,
  subjects,
  bio,
  institution,
  location,
  updated_at
)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data ->> 'name'), ''),
    NULLIF(SPLIT_PART(COALESCE(u.email, ''), '@', 1), ''),
    'Edu AI Scholar'
  ) AS full_name,
  u.email,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data ->> 'avatar_url'), ''),
    NULLIF(TRIM(u.raw_user_meta_data ->> 'picture'), '')
  ) AS avatar_url,
  CASE
    WHEN LOWER(COALESCE(u.email, '')) = 'eduai.platform@admin.com' THEN 'admin'
    WHEN LOWER(COALESCE(u.raw_user_meta_data ->> 'role', '')) IN ('admin', 'super_admin') THEN 'admin'
    WHEN LOWER(COALESCE(u.raw_user_meta_data ->> 'role', '')) ~ '(teach|educat|prof|faculty)' THEN 'teacher'
    ELSE 'student'
  END AS role,
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'subjects'), ''), 'Mathematics, Sciences') AS subjects,
  NULLIF(TRIM(u.raw_user_meta_data ->> 'bio'), '') AS bio,
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'institution'), ''), 'Edu AI Learning Network') AS institution,
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'location'), ''), NULLIF(TRIM(u.raw_user_meta_data ->> 'country'), '')) AS location,
  COALESCE(u.updated_at, u.created_at, now()) AS updated_at
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email = COALESCE(public.profiles.email, EXCLUDED.email),
  full_name = COALESCE(NULLIF(TRIM(public.profiles.full_name), ''), EXCLUDED.full_name),
  avatar_url = COALESCE(NULLIF(TRIM(public.profiles.avatar_url), ''), EXCLUDED.avatar_url),
  role = CASE
    WHEN LOWER(COALESCE(EXCLUDED.email, '')) = 'eduai.platform@admin.com' THEN 'admin'
    ELSE COALESCE(NULLIF(TRIM(public.profiles.role), ''), EXCLUDED.role)
  END,
  updated_at = now();

-- 3. Strip huge data: URIs from auth.users.raw_user_meta_data so JWT access tokens do not trigger HTTP 400/431 header limits
UPDATE auth.users
SET raw_user_meta_data = (
  COALESCE(raw_user_meta_data, '{}'::jsonb)
  - CASE WHEN COALESCE(raw_user_meta_data ->> 'avatar_url', '') LIKE 'data:%' OR LENGTH(COALESCE(raw_user_meta_data ->> 'avatar_url', '')) > 512 THEN 'avatar_url' ELSE '__noop__' END
  - CASE WHEN COALESCE(raw_user_meta_data ->> 'profile_photo_key', '') LIKE 'data:%' OR LENGTH(COALESCE(raw_user_meta_data ->> 'profile_photo_key', '')) > 512 THEN 'profile_photo_key' ELSE '__noop__' END
  - CASE WHEN COALESCE(raw_user_meta_data ->> 'picture', '') LIKE 'data:%' OR LENGTH(COALESCE(raw_user_meta_data ->> 'picture', '')) > 512 THEN 'picture' ELSE '__noop__' END
)
WHERE
  COALESCE(raw_user_meta_data ->> 'avatar_url', '') LIKE 'data:%'
  OR LENGTH(COALESCE(raw_user_meta_data ->> 'avatar_url', '')) > 512
  OR COALESCE(raw_user_meta_data ->> 'profile_photo_key', '') LIKE 'data:%'
  OR LENGTH(COALESCE(raw_user_meta_data ->> 'profile_photo_key', '')) > 512
  OR COALESCE(raw_user_meta_data ->> 'picture', '') LIKE 'data:%'
  OR LENGTH(COALESCE(raw_user_meta_data ->> 'picture', '')) > 512;
