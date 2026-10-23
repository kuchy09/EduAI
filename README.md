# Edu AI (Sage)

AI-powered study app for Kenyan students (KCSE / CBC curriculum).

| Path | What |
| --- | --- |
| `mobile/` | Flutter app (sign-in + streaming AI tutor chat) |
| `supabase/` | Postgres migrations and Edge Functions (`ai-tutor`) |
| `src/`, `server.ts`, `api/` | Legacy React/Express web prototype (reference only, to be retired) |
| `docs/` | Design notes |

## Run the mobile app

```bash
cd mobile
flutter create --project-name eduai --org <your.reverse.domain> --platforms=android,ios .   # once: generates android/ and ios/
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://YOUR_REF.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

## Deploy the backend

See [FLUTTER_INTEGRATION.md](FLUTTER_INTEGRATION.md).
