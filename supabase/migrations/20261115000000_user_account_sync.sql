-- Cross-device account state synchronization (Sage AI chat history, reader AI chats, peer chats, unlocked books)
CREATE TABLE IF NOT EXISTS public.user_account_sync (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_chat_sessions jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_ai_session_id text,
  reader_chats jsonb NOT NULL DEFAULT '{}'::jsonb,
  peer_conversations jsonb NOT NULL DEFAULT '[]'::jsonb,
  peer_messages jsonb NOT NULL DEFAULT '{}'::jsonb,
  unlocked_books jsonb NOT NULL DEFAULT '[]'::jsonb,
  profile_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_account_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own account sync" ON public.user_account_sync;
CREATE POLICY "Users can view own account sync"
  ON public.user_account_sync FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own account sync" ON public.user_account_sync;
CREATE POLICY "Users can insert own account sync"
  ON public.user_account_sync FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own account sync" ON public.user_account_sync;
CREATE POLICY "Users can update own account sync"
  ON public.user_account_sync FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
    DROP TRIGGER IF EXISTS set_user_account_sync_updated_at ON public.user_account_sync;
    CREATE TRIGGER set_user_account_sync_updated_at
      BEFORE UPDATE ON public.user_account_sync
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_account_sync;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
