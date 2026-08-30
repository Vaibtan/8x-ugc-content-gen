# Founder Voice

Founder Voice turns a B2B founder's strategy into voice-true content packs and
lead magnets. This repository starts with the Ticket #2 application foundation:
Next.js 15, a mobile-first PWA shell, Supabase Auth/RLS, and an Effect v3 server
runtime with a real fake-layer test seam.

## Local setup

The setup wizard is the repeatable path for the dashboard steps an owner must
perform. It stores secrets only in the ignored `.env.local` file.

```bash
bash scripts/setup-wizard.sh
pnpm install
pnpm supabase start
pnpm supabase db reset
pnpm dev
```

On Windows PowerShell, run the wizard from Git Bash or WSL. You may also copy
`.env.example` to `.env.local` and populate the same values manually. Never
commit a populated environment file or expose `SUPABASE_SERVICE_ROLE_KEY` to the
browser.

## Verification

```bash
pnpm typecheck
pnpm test
```

The CI workflow runs exactly these two checks and intentionally needs no
provider credentials: it exercises a `ManagedRuntime` with an in-memory `Db`
and fake port layers.

## Authentication and RLS

Configure Google under **Supabase Authentication → Providers** and add the
callback URL printed by the wizard. Google OAuth and magic-link login both land
on `/app`. The `public.users` migration creates a profile row for every new
Supabase Auth user and allows authenticated users to select/update only their
own row. Server-side user reads use the per-user Supabase Effect Layer with the
session JWT, so RLS remains the enforcement boundary.
