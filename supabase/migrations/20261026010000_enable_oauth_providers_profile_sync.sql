-- ==============================================================================
-- EDU AI ("Sage") — OAuth Providers (Google, Apple, GitHub) Profile Sync Upgrade
-- Ensures sign-ups and sign-ins via Google, Apple, and GitHub cleanly populate
-- and preserve public.profiles metadata (including GitHub usernames and Apple
-- first-login names / Private Relay emails).
-- ==============================================================================

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

  -- Extract explicit provider display name across Google, Apple, and GitHub payloads
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
    -- Preserve existing full_name on subsequent Apple Sign-In events where v_meta_name is omitted
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
