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

echo "4/4 Deploying all 4 Edu-Claude Edge Functions (JWT verification enabled)..."
for fn in ai-tutor reader-assistant learning-path quiz-generator; do
  npx supabase functions deploy "${fn}" --project-ref "${SUPABASE_PROJECT_REF}"
done

echo "Done! Edu AI Org / Edu-Claude is fully provisioned."
