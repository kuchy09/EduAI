-- Create workspace_folders table
CREATE TABLE IF NOT EXISTS public.workspace_folders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for workspace_folders
ALTER TABLE public.workspace_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders" ON public.workspace_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders" ON public.workspace_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON public.workspace_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON public.workspace_folders
  FOR DELETE USING (auth.uid() = user_id);

-- Add folder_id to workspace_files
ALTER TABLE public.workspace_files 
ADD COLUMN folder_id uuid REFERENCES public.workspace_folders(id) ON DELETE SET NULL;
