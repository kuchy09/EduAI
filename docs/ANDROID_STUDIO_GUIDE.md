# Edu AI — Android Install & Android Studio Guide

Edu AI supports **two seamless Android delivery paths** while keeping iOS Safari Web App readiness for later native iOS expansion:

---

## 1. Direct Phone Install (PWA / Chrome WebAPK) — Zero Store Review Needed

1. Open the deployed Edu AI URL (for example `https://myeduai.vercel.app` or your live app URL) in **Google Chrome** on Android.
2. Tap **Install App** in the top navigation bar or Sidebar, **or** tap Chrome's menu (`⋮`) → **Install app**.
3. Android installs **Edu AI** onto the home screen and app drawer with full-screen standalone display, offline textbook caching (IndexedDB + Workbox), and launcher shortcuts (**Open Library**, **Ask Sage AI**).

> **Note:** If you are viewing the app inside an embedded preview frame (`iframe`), browsers suppress the automatic install prompt—tap **Open** / copy the direct URL into Chrome on your Android phone.

---

## 2. Android Studio Native Container (`/android` via Capacitor)

A full Gradle Android Studio project lives in `/android/` with package ID `io.supabase.eduai`.

### Prerequisites on Your Workstation
- **Android Studio** (with Android SDK Platform 35, Build-Tools, and Platform-Tools / `adb`)
- **JDK 17+** (`JAVA_HOME` configured)
- **Node.js 20+**

### Open & Build in Android Studio

```bash
# 1. Build the latest web app & sync assets/plugins into /android
npm run android:sync

# 2. Open /android directly in Android Studio
npm run android:open
```

Inside **Android Studio**:
- **Run on USB / Wireless Android Phone**: Select your connected device in the toolbar and click **Run (`▶`)**.
- **Generate Shareable Debug APK**: Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)** (or run `npm run android:apk`).
  - Output APK path: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Generate Play Store Release Bundle (`.aab`)**: Configure `android/keystore.properties` (see `android/keystore.properties.example`) and run **Build → Generate Signed Bundle / APK** or `npm run android:aab`.

### Hosting an APK for One-Tap Download
To offer a direct `.apk` download inside Edu AI's **Install on Phone** dialog:
- Either copy your built APK to `public/downloads/eduai-android.apk`, **or**
- Set `ANDROID_APK_URL=https://...` in your server environment variables.

---

## 3. Flutter Native Android Setup (`/mobile`)

If you also build the Flutter companion app in `/mobile/`:

```bash
./scripts/setup-android-studio.sh --flutter
```

That initializes `/mobile/android/` (when Flutter SDK is installed) and preserves the Supabase OAuth deep-link callback `io.supabase.eduai://login-callback`.
