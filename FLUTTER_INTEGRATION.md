# Backend setup and Flutter integration

## 1. Deploy the backend

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Apply database migrations (includes the AI usage / quota tables)
supabase db push

# Secrets: set the provider(s) you use
supabase secrets set GEMINI_API_KEY=... ANTHROPIC_API_KEY=...
supabase secrets set DEFAULT_PROVIDER=gemini        # or: anthropic
# Optional: ANTHROPIC_MODEL, GEMINI_MODEL, ALLOWED_ORIGINS (web clients only)

supabase functions deploy ai-tutor
```

Never put provider keys or the service-role key in the mobile app.

## 2. Request / response contract

`POST {SUPABASE_URL}/functions/v1/ai-tutor` with `Authorization: Bearer <user access token>`.

```json
{
  "prompt": "Solve x² - 5x + 6 = 0",
  "history": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }],
  "subject": "mathematics",
  "studentName": "Amina",
  "provider": "gemini"
}
```

`history`, `subject`, `studentName` and `provider` are optional. A `{ "messages": [...] }` array (last item = new prompt) is also accepted.

The response is a Server-Sent-Events stream:

```
data: {"type":"delta","text":"..."}
data: {"type":"done"}
data: {"type":"error","message":"..."}   // failure after streaming started
```

Failures before streaming return JSON `{"error": "..."}` with status 400 (bad input), 401 (not signed in), 413, 429 (monthly quota), or 503 (model busy / quota check failed).

Test locally:

```bash
supabase functions serve ai-tutor --env-file .env.local
curl -N -X POST http://localhost:54321/functions/v1/ai-tutor \
  -H "Authorization: Bearer YOUR_USER_JWT" -H "Content-Type: application/json" \
  -d '{"prompt":"Solve x^2 - 5x + 6 = 0","subject":"mathematics"}'
```

Run the function tests: `cd supabase/functions/ai-tutor && deno test --allow-env --allow-net`.

## 3. Flutter app

The app lives in `mobile/`. Key files:

- `lib/core/services/sse_parser.dart` — turns the SSE bytes into events (pure Dart, unit-tested)
- `lib/core/services/tutor_service.dart` — calls the Edge Function, maps failures to student-friendly messages
- `lib/features/tutor/` — Riverpod controller and chat screen
- `lib/features/auth/auth_screen.dart` — email/password sign-in and sign-up
- `lib/app.dart` — go_router with sign-in redirect

Setup is in the [README](README.md). Known gap: the tutor answers with LaTeX (`$$...$$`); `flutter_markdown` shows it as plain text until a math renderer (for example `flutter_math_fork`) is added.
