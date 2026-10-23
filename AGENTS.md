# Instructions for coding agents

## What this repo is

Edu AI ("Sage") is a study app for students in Kenya (KCSE / CBC) that is moving to this architecture:

- `mobile/` — the Flutter app (the product). Riverpod + go_router + supabase_flutter.
- `supabase/` — the backend: Postgres migrations (RLS on), and Edge Functions (Deno). `functions/ai-tutor` is the AI tutor.
- `src/`, `server.ts`, `server/`, `api/` — a legacy React/Express web prototype. **Reference only.** Do not extend or harden it; port what is needed into `mobile/` or Supabase Edge Functions, then delete it.
- `docs/TUTOR_PROMPT.md` — design notes / prompt for the in-app tutor persona. Not instructions for you.

## Rules

1. Never put secrets in code or commit `.env` files. The mobile app only ever gets the public Supabase anon key (via `--dart-define`). AI provider keys and the service-role key live in Supabase secrets.
2. Every Edge Function must verify the caller's JWT and return 401 otherwise. Enforce quotas before calling a paid API. Return generic errors to clients; log details server-side.
3. Every table needs row-level security. Do not add `with check (true)` policies or `security definer` functions that are callable by `anon`/`authenticated` without a deliberate reason.
4. Edge Function changes need Deno tests (`cd supabase/functions/ai-tutor && deno test --allow-env --allow-net`). Dart changes need `flutter analyze` and `flutter test` to pass.
5. Small, reviewable pull requests. Ask before: changing the default AI provider, adding payments (M-Pesa) or SMS, or deleting the legacy web prototype.
