-- supabase/migrations/20240001_ai_tutor_usage.sql
-- Tracks token usage per student per session.
-- Used for rate limiting free tier users and monitoring costs.

create table if not exists public.ai_tutor_usage (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  subject      text not null default 'general',
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens  integer not null default 0,
  created_at   timestamptz not null default now()
);

-- Index for fast per-user queries (rate limiting, usage dashboard)
create index ai_tutor_usage_user_id_idx on public.ai_tutor_usage(user_id);
create index ai_tutor_usage_created_at_idx on public.ai_tutor_usage(created_at);

-- Row Level Security: users can only see their own usage
alter table public.ai_tutor_usage enable row level security;

create policy "Users can view own usage"
  on public.ai_tutor_usage for select
  using (auth.uid() = user_id);

-- Service role can insert from Edge Function
create policy "Service role can insert usage"
  on public.ai_tutor_usage for insert
  with check (true); -- Edge Function uses service role key

-- ─── Monthly usage view (for rate limiting free tier) ────────────────────────
create or replace view public.ai_tutor_monthly_usage as
select
  user_id,
  date_trunc('month', created_at) as month,
  sum(total_tokens)               as total_tokens,
  count(*)                        as request_count
from public.ai_tutor_usage
group by user_id, date_trunc('month', created_at);

-- ─── Helper function: check if user has exceeded free tier ──────────────────
-- Free tier: 50,000 tokens/month (~50 conversations)
-- Call from Edge Function before processing: select * from check_tutor_quota(auth.uid());
create or replace function public.check_tutor_quota(p_user_id uuid)
returns table (
  tokens_used   bigint,
  tokens_limit  integer,
  is_over_limit boolean
)
language sql security definer as $$
  select
    coalesce(sum(total_tokens), 0)                          as tokens_used,
    50000                                                   as tokens_limit,
    coalesce(sum(total_tokens), 0) >= 50000                 as is_over_limit
  from public.ai_tutor_usage
  where user_id = p_user_id
    and created_at >= date_trunc('month', now());
$$;
