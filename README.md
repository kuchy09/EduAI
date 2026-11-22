# Edu AI (Sage)

AI-powered study app for Kenyan students (KCSE / CBC curriculum).

| Path | What |
| --- | --- |
| `mobile/` | Flutter app (EPUB `epub_view` + PDF `pdfx` readers, AES-256 offline vault, AI tutor) |
| `supabase/` | Postgres migrations and Edge Functions (`ai-tutor`) |
| `src/`, `server.ts`, `api/` | React/Express web app (reflowable EPUB/PDF reader, publisher uploads, Flutter manifest) |
| `docs/` | Design notes |

## Run the mobile app

```bash
cd mobile
flutter create --project-name eduai --org <your.reverse.domain> --platforms=android,ios .   # once: generates android/ and ios/
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://YOUR_REF.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR_ANON_KEY \
  --dart-define=API_BASE_URL=https://your-eduai-server.example
```

## Deploy the backend

See [FLUTTER_INTEGRATION.md](FLUTTER_INTEGRATION.md).
