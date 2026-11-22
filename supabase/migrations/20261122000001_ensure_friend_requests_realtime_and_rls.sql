-- Ensure public.friend_requests has unique (sender_id, receiver_id), realtime enabled, and open directory RLS
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Deduplicate any legacy rows before enforcing unique pair constraint
DELETE FROM public.friend_requests a
USING public.friend_requests b
WHERE a.ctid < b.ctid
  AND a.sender_id = b.sender_id
  AND a.receiver_id = b.receiver_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.friend_requests'::regclass
      AND contype IN ('u', 'p')
      AND conname = 'unique_sender_receiver'
  ) THEN
    BEGIN
      ALTER TABLE public.friend_requests
        ADD CONSTRAINT unique_sender_receiver UNIQUE (sender_id, receiver_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;

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

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
