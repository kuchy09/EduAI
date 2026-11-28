#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Edu AI Android Studio Sync & Readiness ==="

if [ ! -f "capacitor.config.ts" ]; then
  echo "Error: capacitor.config.ts not found in $ROOT_DIR"
  exit 1
fi

echo "1. Building web bundle (dist/)..."
npm run build

if [ ! -d "android" ]; then
  echo "2. Initializing Capacitor Android Studio project..."
  npx cap add android
else
  echo "2. Syncing web assets and plugins into ./android..."
  npx cap sync android
fi

if [ "${1:-}" = "--flutter" ]; then
  if command -v flutter >/dev/null 2>&1; then
    echo "3. Initializing Flutter Android platform in ./mobile..."
    (cd mobile && flutter create --platforms=android --org io.supabase --project-name eduai . && flutter pub get)
  else
    echo "Warning: Flutter SDK not found on PATH; skipping ./mobile/android generation."
  fi
fi

echo ""
echo "Done! Next steps in Android Studio:"
echo "  - Open ./android in Android Studio (or run: npm run android:open)"
echo "  - Build debug APK: npm run android:apk"
