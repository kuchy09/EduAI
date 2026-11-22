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

## 3. OAuth providers (Google, Apple, GitHub)

`supabase/config.toml` enables Google, Apple, and GitHub sign-in / sign-up.

1. In your provider consoles, register the Supabase callback URL:
   `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`
2. In Supabase Dashboard (**Authentication -> Providers**), enable **Google**, **Apple**, and **GitHub** with their Client IDs and Secrets (or export `SUPABASE_AUTH_EXTERNAL_*` env vars and run `./supabase/deploy-edu-claude.sh`).
3. In **Authentication -> URL Configuration -> Redirect URLs**, add `io.supabase.eduai://login-callback` for mobile deep links.
4. After generating `android/` and `ios/` in `mobile/`, register the custom URL scheme `io.supabase.eduai` (`host="login-callback"` in `android/app/src/main/AndroidManifest.xml`, and `CFBundleURLSchemes = ["io.supabase.eduai"]` in `ios/Runner/Info.plist`).

## 4. Flutter app (EPUB + PDF + Encrypted Offline Vault + AI Tutor)

The app lives in `mobile/`. Key files:

- `lib/core/models/book.dart` — `MobileBook`, `BookFormat` (`epub` / `pdf`), `PublisherSecurityPolicy`, and `OfflineVaultEntry`
- `lib/core/services/offline_vault_service.dart` — AES-256-CBC + SHA-256 encrypted offline book storage backed by `flutter_secure_storage` (iOS Keychain / Android Keystore) and user-bound key derivation
- `lib/core/services/books_repository.dart` — syncs unified catalog (`books`, `curriculum_books`, `/api/books`) and reading progress
- `lib/features/library/` — Material 3 bookshelf filtering All, EPUB Reflowable, PDF, and Offline Vault books
- `lib/features/reader/epub_reader_screen.dart` — reflowable EPUB reader (`epub_view`) loading decrypted in-memory bytes, ToC drawer, Paper/Sepia/Dark/AMOLED themes, CFI resume, and contextual "Ask Sage AI" jump
- `lib/features/reader/pdf_reader_screen.dart` — native PDF reader (`pdfx`) loading decrypted in-memory bytes, page scrubber, night invert, and "Ask Sage AI" jump
- `lib/features/reader/reader_router_screen.dart` — unlocks offline vault first or downloads & encrypts on demand before routing to EPUB or PDF reader
- `lib/core/services/sse_parser.dart` — turns the SSE bytes into events (pure Dart, unit-tested)
- `lib/core/services/tutor_service.dart` — calls the Edge Function, maps failures to student-friendly messages
- `lib/features/tutor/` — Riverpod controller and chat screen with active textbook context banner
- `lib/features/auth/auth_screen.dart` — Google, Apple, GitHub OAuth + email/password sign-in and sign-up
- `lib/app.dart` — `go_router` with sign-in redirect and `/library`, `/reader/:bookId`, and `/tutor` routes

Run with optional `API_BASE_URL` so Flutter syncs directly with the backend `/api/books`, `/api/book-covers`, and `/api/download` endpoints:

```bash
cd mobile
flutter pub get
flutter test
flutter run \
  --dart-define=SUPABASE_URL=https://YOUR_REF.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR_ANON_KEY \
  --dart-define=API_BASE_URL=https://your-eduai-server.example
```

Known gap: the tutor answers with LaTeX (`$$...$$`); `flutter_markdown` shows it as plain text until a math renderer (for example `flutter_math_fork`) is added.

