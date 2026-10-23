-- Hardens AI tutor usage tracking (follow-up to 20240001_ai_tutor_usage.sql).

-- 1. "Service role can insert usage" was `for insert with check (true)` with no role
--    restriction, so ANY signed-in user could insert usage rows for ANY user_id.
--    The Edge Function uses the service role, which bypasses RLS, so no insert
--    policy is needed at all: clients can no longer write to this table.
drop policy if exists "Service role can insert usage" on public.ai_tutor_usage;

-- 2. The monthly view ran with its owner's rights, which bypasses RLS and let any
--    user read everyone's usage. Make it respect the caller's RLS instead.
alter view public.ai_tutor_monthly_usage set (security_invoker = true);

-- 3. check_tutor_quota is SECURITY DEFINER and was callable by anyone for any user id.
--    Pin its search_path and restrict it to the service role (the Edge Function).
create or replace function public.check_tutor_quota(p_user_id uuid)
returns table (
  tokens_used   bigint,
  tokens_limit  integer,
  is_over_limit boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(sum(total_tokens), 0)                          as tokens_used,
    50000                                                   as tokens_limit,
    coalesce(sum(total_tokens), 0) >= 50000                 as is_over_limit
  from public.ai_tutor_usage
  where user_id = p_user_id
    and created_at >= date_trunc('month', now());
$$;

revoke all on function public.check_tutor_quota(uuid) from public, anon, authenticated;
grant execute on function public.check_tutor_quota(uuid) to service_role;

-- 4. Sanity: token counts can't be negative (NOT VALID = only checks new rows).
alter table public.ai_tutor_usage
  add constraint ai_tutor_usage_tokens_nonneg
  check (input_tokens >= 0 and output_tokens >= 0 and total_tokens >= 0) not valid;

-- 5. The quota query filters on (user_id, created_at).
create index if not exists ai_tutor_usage_user_created_idx
  on public.ai_tutor_usage (user_id, created_at);
