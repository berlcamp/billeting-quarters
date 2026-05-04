# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**PPDMS** — Palarong Pambansa Delegation Monitoring System. A real-time operations platform for the Philippines' national youth sports event: incident reporting, the Field → UCF → Hospital medical referral chain, VIP tracking, heat-index monitoring, transportation, venues, personnel, and the command-center dashboard. The 2026 edition is hosted by **Agusan del Sur (Region XIII / Caraga)** — not General Santos / Region XII; the banner's "GSUR" is short for Agusan del Sur.

`CLAUDE_CODE_KICKOFF_v2.md` is the original spec — useful as a domain glossary (BQ, PV, UCF, ETA-ATA, etc.) and for the role / permission catalogue. Treat the actual code as the source of truth where it has drifted from the spec.

## Commands

```bash
npm run dev          # Next.js 16 dev (Turbopack)
npm run build
npm run start
npm run lint         # eslint-config-next (vitals + ts)
npm run gen:types    # Regenerate src/types/database.ts from the live Supabase project (palaro schema only).
                     # Requires SUPABASE_ACCESS_TOKEN + NEXT_PUBLIC_SUPABASE_URL in .env.local.
```

There is no test runner configured. Type-check with `npx tsc --noEmit`.

The canonical schema lives at `01-database-schema-v3.sql` (apply via Supabase SQL editor); incremental migrations and seeds live under `supabase/`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind 4 · TypeScript strict · Supabase (Postgres + Auth + Realtime + Storage) · `@supabase/ssr` · shadcn/ui on top of `@base-ui/react` · `react-hook-form` + `zod` · `sonner` · `date-fns` + `date-fns-tz` · `lucide-react` · `next-themes` · Leaflet (maps) · `html5-qrcode` / `qrcode` (QR) · `browser-image-compression` (incident photos).

Path alias: `@/*` → `src/*`.

## Architecture facts that aren't obvious from a single file

### Everything Supabase lives under the `palaro` schema

All app queries **must** call `.schema("palaro")` before `.from(...)`. There is no `public` schema usage. `npm run gen:types` only emits the `palaro` schema, and `Database["palaro"]["Tables"][...]` is the standard type access pattern.

### Auth is invite-only, enforced at the database, not the app

The login flow is **Google OAuth only** (no email/password, no magic links). A Postgres trigger (`palaro.handle_new_auth_user`, fires on `INSERT ON auth.users`) inspects the email:

- If a `palaro.profiles` row already exists with `status='active'`, a non-null `role`, and `auth_user_id IS NULL`, the trigger links `auth_user_id` to the new auth user and the sign-in proceeds.
- Otherwise the trigger `RAISE EXCEPTION`s, which **aborts the `auth.users` INSERT** so no auth user is created. The OAuth callback surfaces this as `/auth/not-authorized?reason=...`.

The trigger's effect is invariant: any authenticated user has a corresponding `palaro.profiles` row. App-level "no profile found" branches are defensive, not the normal path.

There is no "pending" runtime state. The four states are `authorized | suspended | not_authorized | unauthenticated` (see `src/lib/auth/access-check.ts`).

### `profiles.id` ≠ `profiles.auth_user_id`

`profiles.id` (UUID PK, never null) is what other tables FK to. `profiles.auth_user_id` (nullable FK to `auth.users.id`) is null until the user first signs in. Lookup current profile by `auth_user_id = auth.uid()`; reference profiles from other tables by `id`.

### Two layers of access enforcement

1. `middleware.ts` (project root) → `src/lib/supabase/middleware.ts` runs on every non-asset route. It refreshes the session cookie, lets `/auth/*` through unconditionally (so suspended users can sign out), bounces unauthenticated visitors off `/dashboard/*` to `/auth`, and redirects suspended/roleless users to `/auth/suspended` or `/auth/not-authorized`.
2. Server actions and protected pages call `getCurrentProfile()` (from `src/lib/auth/session.ts`) and `hasPermission(profile, "<code>")` (from `src/lib/permissions.ts`). The permission map lives in code, not in Postgres.

Most server actions use `createAdminClient()` (service-role client, **server-only** — never import from a client component) and rely on the in-app permission check above. Don't assume Postgres RLS is gating those reads.

### Server-action contract

Every action in `src/lib/actions/*` is `"use server"` and resolves to the `ActionResult<T>` shape from `src/lib/actions/types.ts` — return via `ok(data)` / `fail(message)`, never throw to the caller. After mutations, call `revalidatePath()` for affected routes. State-changing actions go through `recordAudit` / `withAuditLog` from `src/lib/actions/audit.ts` to populate `palaro.audit_logs`.

### Supabase clients — pick the right one

- `src/lib/supabase/client.ts` — browser (anon key, RLS applies).
- `src/lib/supabase/server.ts` — RSC / route handler / server action with cookie-bound session (RLS applies as the signed-in user).
- `src/lib/supabase/admin.ts` — service role, **server-only**, bypasses RLS. Used by most server actions; the in-app permission check is the gate.
- `src/lib/supabase/middleware.ts` — request-bound client used by the root `middleware.ts` to refresh the session and rewrite cookies.

### Time

The DB stores UTC (`TIMESTAMPTZ`). Display is always `Asia/Manila` via `date-fns-tz` helpers. Don't render `new Date(...)` directly.

### Storage

Private buckets, signed URLs (~1h). Incident photos are compressed client-side with `browser-image-compression` before upload.

## Conventions worth knowing

- Default to Server Components. `"use client"` only when needed (forms, realtime, browser APIs).
- Forms: `react-hook-form` + `zod` resolver; submit to a server action; `sonner` toast on result.
- Schemas live in `src/lib/schemas/<entity>.ts`, mirrored by actions in `src/lib/actions/<entity>.ts`.
- Soft-delete via `is_active=false`. Medical/audit data is never hard-deleted.
- shadcn `components.json` style is `base-nova` with `baseColor: neutral` and CSS variables; the design tokens are OKLch in `src/app/globals.css`. Don't hardcode hex colors in app code (the auth login page is an intentional exception — its palette is brand-driven).
- Routes are kebab-case; components PascalCase; hook/util files kebab-case with camelCase exports.
