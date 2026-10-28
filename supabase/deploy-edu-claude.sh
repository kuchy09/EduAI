#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# One-Command Provisioner for Supabase: Edu AI Org / Edu-Claude
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<edu-claude-ref> ./supabase/deploy-edu-claude.sh
# ==============================================================================

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "Error: SUPABASE_PROJECT_REF is required (find it in Edu AI Org -> Edu-Claude -> Project Settings -> General -> Reference ID)."
  exit 1
fi

echo "1/4 Linking to Edu AI Org / Edu-Claude (${SUPABASE_PROJECT_REF})..."
npx supabase link --project-ref "${SUPABASE_PROJECT_REF}"

echo "2/4 Pushing Database Schema, Table Editor, Storage Buckets, RLS, Realtime & Auth Triggers..."
npx supabase db push --include-seed

echo "3/4 Setting Edge Function Secrets (if present in environment)..."
SECRETS_ARGS=()
[ -n "${GEMINI_API_KEY:-}" ] && SECRETS_ARGS+=("GEMINI_API_KEY=${GEMINI_API_KEY}")
[ -n "${ANTHROPIC_API_KEY:-}" ] && SECRETS_ARGS+=("ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}")
[ -n "${CLAUDE_API_KEY:-}" ] && SECRETS_ARGS+=("CLAUDE_API_KEY=${CLAUDE_API_KEY}")
if [ ${#SECRETS_ARGS[@]} -gt 0 ]; then
  npx supabase secrets set "${SECRETS_ARGS[@]}" --project-ref "${SUPABASE_PROJECT_REF}"
fi

echo "4/5 Deploying all 4 Edu-Claude Edge Functions (JWT verification enabled)..."
for fn in ai-tutor reader-assistant learning-path quiz-generator; do
  npx supabase functions deploy "${fn}" --project-ref "${SUPABASE_PROJECT_REF}"
done

if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "5/5 Syncing Auth Redirect URLs & OAuth Providers (Google, Apple, GitHub) via Supabase Management API..."
  AUTH_PATCH_JSON=$(node -e '
    const payload = {
      site_url: "https://ais-pre-vvfmzub4fuhwyulg6tacri-72101744053.europe-west3.run.app",
      uri_allow_list: [
        "https://ais-dev-vvfmzub4fuhwyulg6tacri-72101744053.europe-west3.run.app",
        "https://ais-dev-vvfmzub4fuhwyulg6tacri-72101744053.europe-west3.run.app/auth/callback",
        "https://ais-dev-vvfmzub4fuhwyulg6tacri-72101744053.europe-west3.run.app/**",
        "https://ais-pre-vvfmzub4fuhwyulg6tacri-72101744053.europe-west3.run.app",
        "https://ais-pre-vvfmzub4fuhwyulg6tacri-72101744053.europe-west3.run.app/auth/callback",
        "https://ais-pre-vvfmzub4fuhwyulg6tacri-72101744053.europe-west3.run.app/**",
        "http://localhost:3000",
        "http://localhost:3000/auth/callback",
        "io.supabase.eduai://login-callback"
      ].join(",")
    };
    if (process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID && process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET) {
      payload.external_google_enabled = true;
      payload.external_google_client_id = process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID;
      payload.external_google_secret = process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET;
    }
    if (process.env.SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID && process.env.SUPABASE_AUTH_EXTERNAL_APPLE_SECRET) {
      payload.external_apple_enabled = true;
      payload.external_apple_client_id = process.env.SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID;
      payload.external_apple_secret = process.env.SUPABASE_AUTH_EXTERNAL_APPLE_SECRET;
    }
    if (process.env.SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID && process.env.SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET) {
      payload.external_github_enabled = true;
      payload.external_github_client_id = process.env.SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID;
      payload.external_github_secret = process.env.SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET;
    }
    process.stdout.write(JSON.stringify(payload));
  ')
  curl -fsS -X PATCH "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${AUTH_PATCH_JSON}" >/dev/null
fi

echo "Done! Edu AI Org / Edu-Claude is fully provisioned."
