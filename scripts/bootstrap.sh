#!/usr/bin/env bash
set -euo pipefail

# Run from the parent directory when creating Hack OS from scratch.
pnpm create next-app@latest hack-os --typescript --tailwind --eslint --app --src-dir --import-alias '@/*' --use-pnpm --yes
cd hack-os
pnpm add @ai-sdk/openai @supabase/ssr @supabase/supabase-js ai drizzle-orm postgres zustand zod@^3.25 framer-motion lucide-react
pnpm add -D drizzle-kit
pnpm dlx supabase init
pnpm dlx supabase start
printf '\nBootstrap complete. Copy .env.example to .env.local, apply supabase/migrations/0001_hack_os.sql, then run pnpm dev.\n'
