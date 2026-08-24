-- Create workspace_files table
CREATE TABLE IF NOT EXISTS workspace_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  size bigint NOT NULL,
  s3_key text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE workspace_files ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own files" ON workspace_files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files" ON workspace_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files" ON workspace_files
  FOR DELETE USING (auth.uid() = user_id);
