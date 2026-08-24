-- Add education fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS education_level text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS field_of_study text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS curriculum text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subjects text;
