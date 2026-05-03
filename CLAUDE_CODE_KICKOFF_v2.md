# Claude Code Kickoff — Palarong Pambansa Delegation Monitoring System (PPDMS)

> **How to use this document**: Copy this entire file and paste it as your first message to Claude Code in an empty project folder. Claude Code will read it, ask any clarifying questions, and then proceed with bootstrapping.

---

## ⚠️ CRITICAL: Next.js 16 + React 19 + Tailwind 4

**This is NOT the Next.js you know from training data.** This project uses Next.js 16 (released late 2025), React 19, and Tailwind CSS 4 — all of which have breaking changes from previous versions.

Before writing any code that touches Next.js, React, or Tailwind APIs:
1. Check the installed version with `cat package.json | grep -E "next|react|tailwind"`
2. Read the relevant docs in `node_modules/next/dist/docs/` if available
3. Heed any deprecation warnings during dev/build
4. Do not use patterns from Next.js 13/14/15 if Next.js 16 has updated them

If unsure about an API, ASK before guessing. Better to clarify than to ship code that uses removed APIs.

---

## Your role

You are my primary collaborator on this project. I am a solo developer building this in ~8 weeks under high pressure. I expect you to:

- Read this entire document before writing any code
- Follow the conventions strictly — they mirror my reference project (mtop)
- Push back if I ask for something that breaks the architecture
- Write tests for life-safety-critical paths (medical referrals)
- Never invent dependencies, patterns, or schema changes without asking
- After each task, summarize what changed and what's next

---

## Project: Palarong Pambansa Delegation Monitoring System (PPDMS)

A real-time operations platform for monitoring delegations during the Palarong Pambansa national sports event in the Philippines. Coordinates medical incidents, VIP tracking, venue scheduling, transportation, personnel, and notifications across all Billeting Quarters (BQs) and Playing Venues (PVs).

**This is a life-safety system.** The medical referral chain (Field → UCF → Hospital) cannot fail. Build with that mindset.

---

## Domain glossary

Always use these exact terms — staff use them in conversation:

- **Palaro / Palarong Pambansa** — the national sports event
- **Delegation** — one of the 17 regions of the Philippines competing as a team
- **BQ (Billeting Quarter)** — where delegations stay/sleep (schools, dorms, hotels)
- **PV (Playing Venue)** — where games happen (gyms, fields, courts)
- **UCF (Urgent Care Facility)** — mid-tier medical site between field aid and hospital
- **PO (Protocol Officer)** — staff who escort/track VIPs
- **ETA-ATA** — Estimated Time of Arrival → Actual Time of Arrival
- **ETD-ATD** — Estimated Time of Departure → Actual Time of Departure
- **Heat Index** — computed from temperature + humidity; triggers game suspension
- **Command Center** — central operations hub; receives all notifications
- **Field → UCF → Hospital** — the medical referral chain (NEVER skip a level)

---

## Tech stack — match this exactly to the mtop reference project

This stack is taken directly from https://github.com/berlcamp/mtop and is locked. **Do not deviate without asking.**

```
Framework:    Next.js 16 (App Router) + React 19 + TypeScript (strict)
Styling:      Tailwind CSS 4 + tw-animate-css
UI library:   shadcn/ui (built on @base-ui/react)
Theme:        next-themes (light/dark mode support)
Database:     Supabase (PostgreSQL) with custom schema `palaro`
Auth:         Supabase Auth — Google OAuth ONLY
SSR helpers:  @supabase/ssr
Forms:        react-hook-form + @hookform/resolvers + zod
Validation:   zod
Toasts:       sonner
Icons:        lucide-react
Date:         date-fns + date-fns-tz (Asia/Manila timezone always)
Utils:        clsx + tailwind-merge (via cn() helper)
CVA:          class-variance-authority
Realtime:     Supabase Realtime channels
Storage:      Supabase Storage (private buckets, signed URLs)
Maps:         Leaflet + OpenStreetMap (no API key) — install when needed
QR scan:      html5-qrcode (install when needed)
QR generate:  qrcode (install when needed)
PDF:          @react-pdf/renderer (install when needed)
Hosting:      Vercel (app) + Supabase (everything else)
```

**package.json dependencies must match these versions** (mirror mtop):
```json
{
  "dependencies": {
    "@base-ui/react": "^1.3.0",
    "@hookform/resolvers": "^5.2.2",
    "@supabase/ssr": "^0.10.2",
    "@supabase/supabase-js": "^2.103.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "lucide-react": "^1.8.0",
    "next": "16.2.3",
    "next-themes": "^0.4.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-hook-form": "^7.72.1",
    "shadcn": "^4.2.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.3",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

---

## Authentication architecture (CRITICAL — read carefully)

### Google OAuth ONLY
- No email/password login. No magic links. ONLY Google Sign-In via Supabase OAuth.
- Login page has ONE button: "Sign in with Google"

### Authorization model — strict invite-only, enforced at the database layer

**Only emails the super_admin has pre-invited can sign in. Unauthorized sign-ins are rejected at the DB trigger — no `auth.users` row is ever created for them.**

Flow:
1. User clicks "Sign in with Google" → Google OAuth → Supabase attempts to insert into `auth.users`.
2. The `palaro_on_auth_user_created` trigger (`AFTER INSERT ON auth.users`) fires:
   - **If** a `palaro.profiles` row exists for that email with `status='active'` AND `role IS NOT NULL` AND `auth_user_id IS NULL` → links `auth_user_id` to the profile and stamps `activated_at`. Sign-in proceeds.
   - **Otherwise** → `RAISE EXCEPTION 'Email % is not authorized for PPDMS…'`. The `auth.users` INSERT aborts, the OAuth flow fails, and no `auth.users` row persists.
3. App routing (in middleware + `/auth/callback`) handles the four states:
   - **Authorized** (active profile + role) → `/dashboard`
   - **Suspended** (was active, then admin flipped status) → `/auth/suspended`, signed out
   - **Not authorized** (the trigger rejected, OR profile is missing/roleless — defensive) → `/auth/not-authorized`, signed out, with the trigger's error message surfaced
   - **Unauthenticated** → `/auth`

There is no "pending" state at runtime. The `palaro.profile_status` enum still includes `'pending'` for compat, but no code path produces it.

### Super admin seeded by default
- Email: `berlcamp@gmail.com`
- Role: `super_admin`
- Status: `active`
- Seeded with `auth_user_id=NULL` so first Google sign-in by Berl trips the trigger's link branch.

### The auth function and trigger are namespaced
- Function lives at `palaro.handle_new_auth_user()` (not in `public`).
- Trigger is named `palaro_on_auth_user_created` (not the generic `on_auth_user_created`).
- This avoids collisions with other apps that may share the same Supabase instance and have their own auth-side objects with similar names.
- `DROP SCHEMA palaro CASCADE` cleans up the function (and via dependency, the trigger) without touching anyone else's auth-side state.

### Important: profiles.id vs profiles.auth_user_id

The `palaro.profiles` table uses TWO id columns:

- **`id`** — The profile's own primary key (auto-generated UUID, never null). This is what other tables reference as `FK → palaro.profiles(id)`.
- **`auth_user_id`** — Nullable FK to `auth.users(id)`. NULL when the user has been invited but hasn't signed in with Google yet. Set by the trigger when they sign in.

When writing queries:
- To get the current user's profile: `WHERE auth_user_id = auth.uid()`
- To reference a profile from other tables: store the profile's `id` value (NOT auth_user_id)
- Use the SQL helpers `palaro.current_user_role()` and `palaro.current_profile_id()`

Example server action:
```ts
const { data: profile } = await supabase
  .schema('palaro')
  .from('profiles')
  .select('*')
  .eq('auth_user_id', user.id)  // user.id comes from supabase.auth.getUser()
  .single()
```

### Adding new users (admin flow)
- Super admin (or command_center) goes to `/dashboard/admin/users`
- Click "Invite user" → enter email + assign role
- INSERTs a row into `palaro.profiles` with `status='active'`, `role=X`, `auth_user_id=NULL`
- When that user signs in with Google for the first time, the trigger LOOKS UP the existing profile by email and links `auth_user_id` to it
- They get instant access with their pre-assigned role
- Until invited, the email cannot sign in at all — the trigger raises before the auth user is created

---

## Database

**Custom Supabase schema: `palaro`** (mirroring mtop's `mtop` schema pattern).

All Supabase queries MUST use `.schema('palaro')`:
```ts
const { data } = await supabase
  .schema('palaro')
  .from('incidents')
  .select('*')
```

The complete schema is provided separately in `01-database-schema.sql`. Apply it via Supabase SQL Editor before any app code.

**Key entities** (all in `palaro` schema):
- `profiles` — extends auth.users; role, status, agency, primary_assignment_site
- `delegations` — the 17 PH regions (seeded)
- `sites` — BQs, PVs, UCFs, hospitals, command center, clinics
- `incidents` — universal entry point for any operational event
- `referrals` — medical chain field → UCF → hospital
- `clinic_patients` + `clinic_visits` — open clinic
- `medical_supplies` + `supply_movements` — inventory
- `heat_index_readings` — environmental monitoring
- `vip_persons` + `vip_movements` — protocol tracking
- `venue_schedules` — practice slot booking
- `vehicles` + `vehicle_logs` + `vehicle_routes` — transportation
- `duty_schedules` + `attendance_logs` — personnel
- `notifications` — universal alerts
- `audit_logs` — compliance trail

---

## File structure (mirroring mtop conventions)

```
src/
  app/
    page.tsx                      # redirects to /auth or /dashboard
    layout.tsx                    # root with theme provider, fonts
    globals.css                   # Tailwind 4 + design tokens (OKLch)
    auth/
      page.tsx                    # Login page (Google OAuth button)
      callback/
        route.ts                  # OAuth callback handler
      not-authorized/
        page.tsx                  # "Access not authorized" (replaces /auth/pending in invite-only model)
      suspended/
        page.tsx                  # "Account suspended"
    dashboard/
      layout.tsx                  # Shell: sidebar (256px) + topbar (56px) + main
      page.tsx                    # Command Center home (KPIs + pipeline + activity)
      incidents/
        page.tsx                  # List
        new/page.tsx              # Create form
        [id]/page.tsx             # Detail (2/3 main + 1/3 sidebar)
      medical/
        field/page.tsx
        ucf/page.tsx
        hospital/page.tsx
        clinic/page.tsx
        supplies/page.tsx
        patient-timeline/[id]/page.tsx
      vip/page.tsx
      heat-index/page.tsx
      venues/page.tsx
      transportation/page.tsx
      personnel/
        duty/page.tsx
        attendance/page.tsx
        ids/page.tsx
      reports/page.tsx
      admin/
        users/page.tsx            # Invite + manage users
        sites/page.tsx
        delegations/page.tsx
        settings/page.tsx         # super_admin only
  components/
    ui/                           # shadcn components
    layout/
      sidebar.tsx                 # Role-based navigation
      topbar.tsx                  # User dropdown, breadcrumbs
      page-header.tsx             # Title + optional action buttons
    shared/
      data-table.tsx              # Generic table with search/filter/paginate
      status-badge.tsx            # Color-coded status display
      approval-stepper.tsx        # Multi-step workflow visualization
      timeline-log.tsx            # Audit trail display
      forbidden.tsx               # Access denied UI
      empty-state.tsx             # No data placeholder
      live-badge.tsx              # Realtime pulse indicator
    incidents/
    medical/
    vip/
    command-center/
  lib/
    supabase/
      client.ts                   # Browser client (RLS enforced)
      server.ts                   # Server client (RLS enforced)
      admin.ts                    # Service role (bypasses RLS, server-only)
      middleware.ts               # Request middleware
    actions/                      # Server actions, one file per entity
      profiles.ts
      incidents.ts
      referrals.ts
      sites.ts
      delegations.ts
      vip.ts
      heat-index.ts
      venues.ts
      vehicles.ts
      personnel.ts
    schemas/                      # Zod schemas, one file per entity
      profiles.ts
      incidents.ts
      referrals.ts
      ...
    hooks/
      use-auth.ts                 # Current user + loading state
      use-profile.ts              # User profile context
      use-permissions.ts          # can(), canAny(), canAll()
      use-realtime.ts             # Supabase Realtime channel hook
    utils.ts                      # cn() helper (clsx + tailwind-merge)
    permissions.ts                # Role → permission mapping
    timezone.ts                   # date-fns-tz helpers (Asia/Manila)
    heat-index.ts                 # NWS heat index formula
  types/
    database.ts                   # generated from supabase
    domain.ts                     # custom app types
```

---

## UI/UX standards (matching mtop exactly)

### Spacing System (4px base, Tailwind classes)
```
p-6              — Page/section level container padding
space-y-6        — Major section gaps (between cards on a page)
space-y-5        — Form field gaps (between fields in a form)
space-y-4        — Card content gaps
gap-4            — Card content, grids
gap-2            — Icon-to-text, button groups
```

### Typography
```
Page title       → text-2xl font-bold tracking-tight
Section heading  → text-lg font-semibold
Body             → text-sm (inside cards/tables)
Muted helper     → text-sm text-muted-foreground
IDs/Codes        → font-mono text-sm
```

### Color tokens
- Use OKLch color system in `globals.css`
- Light mode default; dark mode via `next-themes`
- All colors via Tailwind/shadcn variables — NO hardcoded hex
- shadcn theme variables: `--background`, `--foreground`, `--primary`, `--muted`, `--accent`, `--destructive`, `--border`, etc.

### Status badge colors

| Domain | Status | Badge |
|---|---|---|
| Incident | open | `bg-yellow-100 text-yellow-800` |
| Incident | in_progress | `bg-blue-100 text-blue-800` |
| Incident | referred | `bg-violet-100 text-violet-800` |
| Incident | resolved | `bg-green-100 text-green-800` |
| Incident | closed | `bg-gray-100 text-gray-800` |
| Severity | low | `bg-gray-100 text-gray-800` |
| Severity | medium | `bg-yellow-100 text-yellow-800` |
| Severity | high | `bg-orange-100 text-orange-800` |
| Severity | critical | `bg-red-100 text-red-800` |
| Referral | pending | `bg-yellow-100 text-yellow-800` |
| Referral | accepted | `bg-blue-100 text-blue-800` |
| Referral | in_treatment | `bg-orange-100 text-orange-800` |
| Referral | discharged | `bg-green-100 text-green-800` |
| Referral | admitted | `bg-violet-100 text-violet-800` |
| Profile | pending | `bg-yellow-100 text-yellow-800` |
| Profile | active | `bg-green-100 text-green-800` |
| Profile | suspended | `bg-red-100 text-red-800` |

Build a single `<StatusBadge variant="incident" status={...} />` component that maps these.

### Shell layout (mtop-identical)
```
┌─────────────────────────────────────┐
│  Sidebar (256px)  │  Topbar (56px)  │
├─────────────────┬───────────────────┤
│                 │                   │
│  Navigation     │   Main Content    │
│  (persistent)   │   (flex-1, p-6)   │
│                 │                   │
└─────────────────┴───────────────────┘
```

- Sidebar: 256px wide, persistent on desktop, drawer (Sheet) on mobile (<1024px)
- Topbar: 56px tall, holds breadcrumb + notification bell + user dropdown
- Main: `flex-1 p-6`, scrolls independently
- Sidebar nav grouped with section labels; permission-gated items hidden by default

### Page header pattern
Every dashboard page uses the same header:
```tsx
<PageHeader
  title="Incidents"
  description="All operational incidents across BQs and Playing Venues"
  actions={<Button onClick={...}>New Incident</Button>}
/>
```

### Detail page pattern
Two-column layout: 2/3 main + 1/3 sidebar (responsive — stacks on mobile)
- **Main**: entity info cards, stage-specific action card, related records
- **Sidebar**: ApprovalStepper / status, summary card, timeline log

### Form pattern
- React Hook Form + Zod
- shadcn `<Form>` components (FormField, FormItem, FormLabel, FormControl, FormMessage)
- Submit via Server Action, revalidatePath afterward
- All actions return `{ error: string | null, data?: T }` pattern
- `sonner` toast on success/error

### DataTable pattern
- Generic `<DataTable>` shared component with:
  - Search input (top-left)
  - Filter dropdowns (top-right)
  - Pagination (bottom)
  - Row click → navigate to detail
  - Loading skeleton state
  - Empty state with CTA

---

## Code conventions (strict — mirror mtop)

### Server actions return shape
**Every** server action returns this shape:
```ts
type ActionResult<T = void> =
  | { error: null; data?: T }
  | { error: string; data?: undefined }
```

After mutations, ALWAYS call `revalidatePath()` for cache invalidation.

### Audit trail
Every state-changing action creates an `audit_logs` entry. Use a `withAuditLog()` helper.

### Time handling
- Server stores everything in UTC (TIMESTAMPTZ)
- Display always in Asia/Manila using `date-fns-tz`
- Never use raw `new Date()` for display

### Permissions
- Every page calls `requireRole([...])` server-side BEFORE rendering
- Use the `<Forbidden />` component when access is denied (don't redirect)
- `usePermissions()` hook for client-side conditional UI
- RLS policies in PostgreSQL are the source of truth

### Naming
- **Tables**: snake_case plural (`incidents`, `vip_movements`)
- **Components**: PascalCase (`IncidentForm.tsx`)
- **Hooks/utils**: kebab-case files, camelCase exports (`use-realtime.ts`)
- **Routes**: kebab-case (`/dashboard/medical/heat-index`)

### Server vs client
- Default to Server Components
- Mark client components with `'use client'` only when needed (forms, interactivity, realtime)
- Server Actions for form submissions — NOT API routes (unless external system calls us)

### Code quality
- TypeScript strict — no `any`, no `@ts-ignore`
- ESLint configured (eslint-config-next)
- All async ops have error handling

---

## Module priority (build in EXACT this order)

### Phase 1 — Critical path (Weeks 1–4) — MUST SHIP
1. Project bootstrap + Supabase setup (with `palaro` custom schema)
2. Google OAuth + invitation-based authorization + super admin seed
3. Dashboard shell with role-aware navigation
4. User invitation system (`/dashboard/admin/users`)
5. Sites + Delegations management
6. Incident Reporting (universal entry point)
7. Medical chain: Field → UCF → Hospital referrals
8. Command Center realtime dashboard
9. Notifications system  

### Phase 2 — Pre-Palaro (Weeks 5–6)
10. Heat Index Monitoring with auto game-suspension flag
11. VIP ETA-ATA / ETD-ATD tracking
12. Personnel + Duty schedules + Attendance + ID generator with QR
13. Open Clinic basics

### Phase 3 — Pre-Palaro stretch (Week 7)
14. Transportation + QR vehicle in/out logging
15. Venue Practice Scheduling + Special Requests
16. Medical Supplies Inventory
17. Reports + Analytics

### Phase 4 — Post-launch
18. Garbage Collection
19. Food Supply
20. Advanced analytics

---

## Roles (13 total)

| Role | Description |
|---|---|
| `super_admin` | Berl, Kean — full access including config |
| `command_center` | Operations leads — read everything, triage |
| `medical_field` | Field medics, first responders |
| `medical_ucf` | Urgent Care Facility staff |
| `medical_hospital` | Private hospital staff |
| `medical_clinic` | Open clinic staff |
| `protocol_officer` | VIP escort and tracking |
| `logistics_officer` | Transportation, garbage, food |
| `personnel_admin` | HR, duty rosters, attendance |
| `venue_manager` | Playing venue manager |
| `delegation_head` | Region rep — read-only own delegation |
| `transportation_dispatcher` | Vehicle dispatch |
| `garbage_logger` | Garbage collection |
| `food_supplier_admin` | Food supplier management |

Permission codes (define in `lib/permissions.ts`):
```
incident.create, incident.view, incident.update, incident.resolve
referral.create_field_to_ucf, referral.create_ucf_to_hospital
referral.accept, referral.assess, referral.discharge
clinic.manage, supplies.manage
heat_index.record, heat_index.override
vip.manage
venue.book, venue.approve_special
vehicle.manage, vehicle.scan
personnel.manage, attendance.record
user.invite, user.manage
sites.manage, delegations.manage
reports.view, admin.manage
```

Map roles to permissions in code, not in DB (simpler for v1).

---

## Things to NEVER do

- **NEVER** allow access without a valid active profile (status='active' AND role IS NOT NULL)
- **NEVER** skip Row Level Security policies on tables with PII or medical data
- **NEVER** display patient full names in non-medical role views (use initials)
- **NEVER** allow editing a closed/discharged referral — create an addendum
- **NEVER** trust client-side timestamps for critical events — use `NOW()` server-side
- **NEVER** delete records — use `is_active = false` (medical records require retention)
- **NEVER** ship the service role key to the client (`lib/supabase/admin.ts` is server-only)
- **NEVER** add an email/password login fallback — Google OAuth ONLY
- **NEVER** auto-assign a role to a self-registered user — they must be invited
- **NEVER** use Next.js 13/14/15 patterns without verifying they still work in Next.js 16
- **NEVER** query Supabase without `.schema('palaro')`

---

## Performance budgets

- Command Center dashboard initial load: < 2s on 4G
- Incident submit form to confirmation: < 500ms perceived (optimistic UI)
- Realtime notification delivery: < 1s from event to dashboard

---

## Security & compliance

- Data Privacy Act of 2012 (RA 10173) compliance is mandatory
- All PII tables have RLS enabled
- All writes audit-logged
- Photos in private Supabase Storage buckets only (signed URLs, 1h expiry)
- Service role key NEVER in browser code
- Set strict CSP and security headers in `next.config.ts`
- Session timeout: 4 hours of inactivity

---

## Detailed Phase 1 task list

Work these in order. Each is sized for a single focused session.

### Task 1.1 — Project bootstrap (~2h)

**FIRST: Verify Next.js 16 is current** by running `npx create-next-app@latest --version` to confirm.

Initialize the Next.js 16 app:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --turbopack
```

Install dependencies (match versions to mtop):
```bash
npm install @supabase/supabase-js@^2.103.0 @supabase/ssr@^0.10.2
npm install @base-ui/react@^1.3.0
npm install react-hook-form@^7.72.1 @hookform/resolvers@^5.2.2 zod@^4.3.6
npm install sonner@^2.0.7 next-themes@^0.4.6 lucide-react@^1.8.0 date-fns@^4.1.0
npm install class-variance-authority@^0.7.1 clsx@^2.1.1 tailwind-merge@^3.5.0
npm install tw-animate-css@^1.4.0
```

Configure path aliases in `tsconfig.json`:
- `@/*` → `./src/*`

Configure `tailwind.config` for Tailwind 4 (note: Tailwind 4 has different config patterns from 3 — verify in node_modules docs).

Initialize shadcn:
```bash
npx shadcn@latest init
npx shadcn@latest add button input select card dialog table badge alert
npx shadcn@latest add form label textarea checkbox separator
npx shadcn@latest add dropdown-menu sheet tooltip tabs toast skeleton avatar
```

Create `src/lib/utils.ts` with `cn()` helper.

Setup `globals.css` with OKLch color tokens (copy mtop pattern — Tailwind 4 uses `@theme` directive).

Create `src/app/layout.tsx`:
- Font: Geist (default Next.js)
- ThemeProvider from next-themes (light default)
- Sonner Toaster mounted globally
- Metadata: app name, description

Create `src/app/page.tsx` that redirects to `/dashboard` or `/auth` based on session.

**Done when**: `npm run dev` shows a working app with shadcn theme, no errors

---

### Task 1.2 — Supabase setup with `palaro` custom schema (~2h)

I will create the Supabase project manually. You will:

1. Apply the schema from `01-database-schema.sql` (all tables under `palaro` schema)
2. Configure Google OAuth provider in Supabase Auth settings (manual)

You build:
- `src/lib/supabase/client.ts` — Browser client using `createBrowserClient` from `@supabase/ssr`
- `src/lib/supabase/server.ts` — Server client using `createServerClient` with cookie handling
- `src/lib/supabase/admin.ts` — Service role client (server-only, bypasses RLS)
- `src/lib/supabase/middleware.ts` — Middleware client for session refresh
- `middleware.ts` at project root using the middleware client

CRITICAL: All queries use `.schema('palaro')`:
```ts
await supabase.schema('palaro').from('sites').select('*')
```

Type generation:
```bash
npx supabase gen types typescript --project-id <ID> --schema palaro > src/types/database.ts
```

Build a tiny test page `src/app/test-db/page.tsx` (server component) that fetches from `palaro.sites` and lists results, just to verify the connection. Delete after verification.

**Done when**: Server component successfully fetches from `palaro.sites` with full type safety

---

### Task 1.3 — Google OAuth + authorization (~4h) — CRITICAL

Build the auth flow following mtop's pattern:

1. **`src/app/auth/page.tsx`** — Login page
   - Single, centered card with "Sign in with Google" button
   - Calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '<origin>/auth/callback' } })`
   - Clean, minimal design — Palaro branding placeholder (logo TBD)

2. **`src/app/auth/callback/route.ts`** — OAuth callback
   - Detects OAuth-level errors (e.g. the DB trigger's `RAISE EXCEPTION` on an unauthorized email) and redirects to `/auth/not-authorized?reason=…`
   - Otherwise exchanges code for session
   - Looks up the linked profile and redirects to:
     - `/dashboard` if profile is active with role
     - `/auth/suspended` if profile is suspended
     - `/auth/not-authorized` if no profile or roleless (defensive — should not occur because the trigger gates this)

3. **`src/app/auth/not-authorized/page.tsx`**
   - Message: "Access not authorized — your Google account is not on the PPDMS access list."
   - Surfaces the trigger's `?reason=…` query string when present
   - Show a "Back to sign-in" button
   - DOES NOT show app navigation
   - Use shadcn Card + Alert components
   - (There is no `/auth/pending` page — the invite-only trigger blocks unauthorized sign-ins at the DB layer before any `auth.users` row is created. See "Authentication architecture" above.)

4. **`src/app/auth/suspended/page.tsx`**
   - "Your account has been suspended" + signed-in email + Sign out button

5. **`src/lib/auth/access-check.ts`**:
   ```ts
   export type AccessState =
     | { status: 'authorized'; profile: Profile }
     | { status: 'suspended'; profile: Profile }
     | { status: 'not_authorized'; email: string }
     | { status: 'unauthenticated' }

   export async function checkAccess(): Promise<AccessState>
   ```

6. **`src/lib/auth/session.ts`**:
   - `getCurrentUser()` returns Supabase user or null
   - `getCurrentProfile()` returns the joined profile from `palaro.profiles` or null
   - `requireAuth()` redirects to `/auth` if not authenticated
   - `requireActiveProfile()` redirects appropriately based on AccessState

7. **`src/lib/permissions.ts`**:
   - User role enum mirroring database
   - Permission codes (constants)
   - `ROLE_PERMISSIONS: Record<UserRole, Permission[]>` mapping
   - `hasPermission(profile, permission)` and `hasAnyPermission(profile, permissions[])`
   - `requireRole(roles[])` server helper — throws/redirects if role mismatch

8. **`src/lib/hooks/use-auth.ts`** — client hook with current user + loading
9. **`src/lib/hooks/use-profile.ts`** — client hook with current profile
10. **`src/lib/hooks/use-permissions.ts`** — client hook returning `{ can(p), canAny(ps), canAll(ps) }`

11. **Update `middleware.ts`** to:
    - Refresh session
    - Allow `/auth/*` without auth (so suspended users can still sign out)
    - Redirect `/dashboard/*` to `/auth` if not authenticated
    - Redirect to `/auth/suspended` if authenticated but suspended
    - Sign out + redirect to `/auth/not-authorized` if profile is missing or roleless (defensive — trigger normally blocks this case)

12. **Apply auth trigger SQL** (provided in 01-database-schema.sql) — verify the super admin seed for `berlcamp@gmail.com` is in place.

**Test plan:**
- Sign out, visit `/dashboard` → redirects to `/auth`
- Sign in with Google as `berlcamp@gmail.com` → reaches `/dashboard` (super_admin)
- Sign in with a different (uninvited) Google account → DB trigger raises → callback redirects to `/auth/not-authorized` with the trigger's reason text
- Invite that email (insert into `palaro.profiles` with `status='active'`, role assigned) and sign in again → reaches `/dashboard`
- Suspend that user in DB → next request redirects to `/auth/suspended`

**Done when**: Auth flow works end-to-end with all four states

---

### Task 1.4 — Dashboard shell layout (~3h) — match mtop exactly

Build `src/app/dashboard/layout.tsx`:

**Layout structure:**
```
┌──────────────────────────────────────┐
│  Sidebar (w-64)  │  Topbar (h-14)    │
├──────────────────┼───────────────────┤
│                  │                   │
│  Navigation      │   Main (p-6)      │
│  (persistent)    │   flex-1, scroll  │
│                  │                   │
└──────────────────┴───────────────────┘
```

**`src/components/layout/sidebar.tsx`** — Role-based navigation:

```
PPDMS (logo + name at top)
├── Command Center                    (all)
├── Operations
│   ├── Incidents                     (most roles)
│   ├── VIP Tracking                  (protocol_officer, command_center, super_admin)
│   └── Heat Index                    (medical_field, venue_manager, command_center)
├── Medical
│   ├── Field                         (medical_field)
│   ├── UCF                           (medical_ucf)
│   ├── Hospital                      (medical_hospital)
│   ├── Clinic                        (medical_clinic)
│   └── Supplies                      (medical roles)
├── Logistics
│   ├── Transportation                (logistics, transportation_dispatcher)
│   └── Venues                        (venue_manager, logistics)
├── Personnel
│   ├── Duty Schedule                 (personnel_admin)
│   ├── Attendance                    (personnel_admin)
│   └── ID Generator                  (personnel_admin)
├── Reports                           (heads + admin)
└── Admin                             (super_admin, command_center)
    ├── Users
    ├── Sites
    ├── Delegations
    └── Settings                      (super_admin only)
```

- Section headers as `text-xs font-medium uppercase tracking-wider text-muted-foreground px-3 py-2`
- Nav items: `flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent`
- Active item: `bg-accent text-accent-foreground`
- Icons via lucide-react (16px)
- Permission gating: items hidden if user lacks the required permission

**`src/components/layout/topbar.tsx`**:
- Left: breadcrumb (auto from pathname)
- Right: notification bell (placeholder counter), theme toggle, user dropdown
- User dropdown: avatar + name + role badge → menu with "Profile", "Sign out"

**`src/components/layout/page-header.tsx`** — reusable across pages:
```tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}
```
Renders: `text-2xl font-bold tracking-tight` title, `text-sm text-muted-foreground` description, actions on the right.

**Mobile**: sidebar becomes a `Sheet` drawer triggered by hamburger in topbar (visible <1024px).

Stub all dashboard pages with a basic `<PageHeader />` placeholder.

**Done when**: Logged in user sees full nav structure with role-appropriate items hidden, layout works on mobile + desktop

---

### Task 1.5 — User management (~3h)

Build `/dashboard/admin/users`:

Permissions: `super_admin` and `command_center` only. Use `<Forbidden />` for unauthorized.

**Features:**

1. **DataTable of all profiles**
   - Columns: avatar + name, email, role, status, agency, last activity, actions
   - Filter by role + status
   - Search by name/email
   - Use shared `<DataTable>` component (build it now if not yet built)

2. **"Invite User" Dialog**
   - Form (RHF + Zod): email (required), full_name, role (select), agency
   - Server action `inviteUser()`: INSERT into `palaro.profiles` with `status='active'`, `id=NULL`, `invited_by=current_user`, `invited_at=NOW()`
   - On conflict (email exists): show error toast
   - Success toast + revalidatePath

3. **Edit user Dialog** (click row)
   - Update role, agency, primary_assignment_site, status
   - Status: active ⇄ suspended (cannot revert to pending)
   - Validation: `super_admin` role only settable by `super_admin`
   - Self-protection: cannot demote yourself from super_admin, cannot suspend yourself

4. **Quick actions per row**: "Suspend" / "Activate"

5. Display `invited_by` and `invited_at` in detail view

Server actions in `src/lib/actions/profiles.ts`:
- `inviteUser(input)`
- `updateUserRole(userId, role)`
- `updateUserStatus(userId, status)`
- `getUsers(filters)`

All return `{ error, data }` shape.

**Done when**: Berl can invite a new user by email; that user signs in with Google and instantly gets access with the assigned role

---

### Task 1.6 — Sites + Delegations (~3h)

Build `/dashboard/admin/sites`:
- DataTable: name, type, address, contact, status
- Filter by site_type (BQ, PV, UCF, hospital, clinic, command_center)
- "Add Site" Dialog with form (RHF + Zod)
- Click row → edit Dialog
- Soft delete (`is_active=false`) with confirmation Dialog
- Empty state with "Add your first site" CTA

Build `/dashboard/admin/delegations`:
- Same pattern as sites
- Columns: region_code, region_name, head, athlete count, BQ assigned, status

Seed file `supabase/seed.sql` with all 17 PH regions:
```
NCR, CAR, R-I, R-II, R-III, R-IV-A, R-IV-B, R-V, R-VI, R-VII, R-VIII, R-IX, R-X, R-XI, R-XII, R-XIII, BARMM
```
(Insert via the schema file or a separate seed migration.)

Server actions in `src/lib/actions/sites.ts` and `src/lib/actions/delegations.ts`.

Permissions: `super_admin` and `command_center` only.

**Done when**: Super admin can manage all sites + delegations with polished tables

---

### Task 2.1 — Incident reporting form (~4h)

Build `/dashboard/incidents/new`:

**Form fields** (RHF + Zod schema in `src/lib/schemas/incidents.ts`):
- Category (select: medical, utility, vip_status, security, facility, other)
- Severity (radio with color: low=gray, medium=yellow, high=orange, critical=red)
- Title (required)
- Description (textarea)
- Site (combobox, searchable, all active sites)
- Location details (text)
- Geolocation: "Use current location" button (browser API)
- Delegation (combobox, optional)
- Affected person: name, age, role
- Photos: drag-drop, max 5, compress to <1MB client-side

**Photo upload:**
- Use `browser-image-compression` (install)
- Upload to Supabase Storage bucket `incident-photos` (private)
- Display via signed URLs (1h expiry)
- Show upload progress

**Submit behavior:**
- Optimistic UI: success toast immediately
- Server action saves with `reported_by = current_user`, `reported_at = NOW()`
- Auto-generated `incident_number` via DB trigger
- Redirect to `/dashboard/incidents/[id]` on success
- Rollback toast on error

**Mobile optimization:**
- Form completable in <30s on a phone with one hand
- Min 44px tap targets
- High contrast for outdoor use
- `capture="environment"` on photo input

Server action in `src/lib/actions/incidents.ts`:
- `createIncident(input): Promise<ActionResult<{ id: string }>>`

**Done when**: A field officer can submit a complete incident on their phone in 30 seconds

---

### Task 2.2 — Incident list + detail (~3h)

**`/dashboard/incidents`** (list):
- `<DataTable>` with server-side pagination
- Filters: status, severity, category, site, delegation, date range
- Default sort: most recent first
- Severity column with `<StatusBadge variant="severity">`
- Status column with `<StatusBadge variant="incident">`
- Click row → `/dashboard/incidents/[id]`
- "New Incident" button (permission-gated)

**`/dashboard/incidents/[id]`** (detail) — 2/3 + 1/3 layout like mtop:

**Main column (2/3):**
- Card 1: Incident summary (number, title, severity, status, category)
- Card 2: Affected person info
- Card 3: Photos gallery (lightbox)
- Card 4: Stage-specific actions (status updates, "Create Referral" if medical)
- Card 5: Resolution notes (when resolving)

**Sidebar column (1/3):**
- `<ApprovalStepper>` showing stages: Reported → In Progress → Referred (if medical) → Resolved → Closed
- Summary card: site, delegation, reporter, timestamps
- `<TimelineLog>` of audit trail

Server actions:
- `updateIncidentStatus(id, status, notes?)`
- `getIncident(id)` (with full join: site, delegation, reporter, referrals, audit)

**Done when**: Anyone with permission can browse, filter, and update incidents

---

### Task 2.3 — Realtime incident feed (~2h)

Build `src/lib/hooks/use-realtime.ts`:
- Generic hook subscribing to a Supabase channel
- Cleans up on unmount

Build `src/lib/hooks/use-realtime-incidents.ts`:
- Subscribes to `palaro.incidents` INSERT/UPDATE
- Optionally filtered by site or status
- Returns updated list, fires callback on new critical incidents

Add `<LiveBadge />` shared component — pulsing dot for "live" indication.

Integrate on Command Center dashboard + Incidents list.

Test: open two tabs, create incident in one → appears in the other within 1s.

**Done when**: Realtime works reliably across multiple sessions

---

### Task 2.4 — Field-to-UCF medical referral (~4h)

Build `/dashboard/medical/field`:
- `<PageHeader>`: "Medical Field" + "Create Referral" button
- Two tabs: "My Active Referrals" and "History"
- DataTable of current user's referrals with status

**Referral creation flow** (Dialog or full page):
- Triggered from incident detail page (medical incidents) OR standalone
- Form fields:
  - Source incident (auto-linked if from incident page; optional standalone)
  - Patient: name, age, gender, delegation
  - Vitals: BP, HR, temp, RR, SpO2 (JSONB) — collapsible section
  - Chief complaint (textarea)
  - Treatment given (textarea)
  - Target UCF (combobox, only `palaro.sites` where `site_type='urgent_care_facility'`)
- Submit creates referral with `level='field_to_ucf'`, `status='pending'`
- Auto-creates notifications for users at target UCF site
- Auto-generates `referral_number`

Server action `src/lib/actions/referrals.ts`:
- `createFieldReferral(input): Promise<ActionResult<{ id: string }>>`

Permissions: `medical_field` role required.

**Done when**: Field medic creates referral, UCF receives notification

---

### Task 3.1 — UCF inbox + initial assessment (~4h)

Build `/dashboard/medical/ucf`:
- Tabs: Pending, In Treatment, Discharged
- Card-based or DataTable view of referrals
- Each card: patient name (initials for non-medical viewers — but UCF medical = full name), age, delegation, chief complaint, time waiting, severity badge
- Sort by oldest pending first (urgency)

**`/dashboard/medical/ucf/[referralId]`** — Assessment page (2/3 + 1/3):

**Main column:**
- Patient info card (carries forward from field referral)
- Field assessment summary (vitals, treatment given, chief complaint)
- Initial assessment form (RHF + Zod):
  - Vitals on arrival (JSONB)
  - Initial diagnosis (text)
  - Treatment plan (textarea)
  - Notes
- Decision actions:
  - **"Discharge"** Dialog — requires discharge notes, sets `status='discharged'`, `discharged_at=NOW()`
  - **"Refer to Hospital"** — opens hospital referral form (Task 3.2)

**Sidebar:**
- ApprovalStepper: Pending → Accepted → In Treatment → Discharged/Referred
- Summary card
- TimelineLog

Server actions:
- `acceptReferral(id)` — sets status=accepted, received_by=current_user, received_at=NOW()
- `submitUcfAssessment(referralId, data)`
- `dischargeReferral(referralId, notes)`

Print referral slip via `@react-pdf/renderer` (install when needed).

Permissions: `medical_ucf` role required.

**Done when**: UCF can receive, assess, and discharge OR escalate

---

### Task 3.2 — UCF-to-Hospital referral (~3h)

Extend referral flow:
- From UCF assessment, "Refer to Hospital" creates new referral with `level='ucf_to_hospital'`
- Carries forward patient data + UCF assessment
- Target hospital combobox (sites where `site_type='hospital'`)
- Notifies hospital site users
- Source UCF referral status changes to `referred`

Build patient timeline component `<PatientTimeline />`:
- Shows full chain: original incident → field referral → UCF assessment → hospital referral
- Use `<TimelineLog>` shared component

Used in `/dashboard/medical/patient-timeline/[chainId]`.

**Done when**: Two-level referral chain works end-to-end with full timeline view

---

### Task 3.3 — Hospital reception (~3h)

Build `/dashboard/medical/hospital`:
- Inbox of incoming referrals (DataTable)
- Limited fields visible (privacy)
- Actions: accept, admit, discharge, reject

Build "direct admittance" path:
- Hospital can also report Palaro-related cases that didn't come through referral chain
- Same incident reporting flow but auto-flagged as `category='medical'` and `hospital_direct=true`

Permissions: `medical_hospital` role required.

**Done when**: Hospital staff can manage their inbox and report direct cases

---

### Task 3.4 — Patient timeline view (~3h)

Build `/dashboard/medical/patient-timeline/[id]`:
- Full vertical timeline component with stage markers
- Each stage: timestamp (Asia/Manila), location, who handled it, summary
- Vitals trend chart (when implemented later — placeholder for now or use a simple table)
- Consolidated notes chronologically
- "Print full medical record" button

Permissions: any medical role + `command_center`.

**Done when**: Anyone in the medical chain can see complete patient journey on one page

---

### Task 4.1 — Command Center dashboard (~4h)

Build `/dashboard/page.tsx` (or `/dashboard/command-center` — set as default landing):

**Stat Cards (4-column grid)** — match mtop pattern:
- Open incidents (with severity breakdown sub-stats)
- Critical incidents (with pulse animation if > 0)
- Active referrals (in-flight medical cases)
- Hospitalizations today

**Pipeline View** (horizontal flow):
```
Open (12) → In Progress (8) → Referred (5) → Resolved (142)
```

**Two-column section below:**
- **Left (2/3)**: Live incident feed (last 20, realtime, severity-colored)
- **Right (1/3)**: Active referrals tracker — cards showing current stage and time elapsed

**Recent activity** (bottom):
- Latest 10 audit_log entries via `<TimelineLog>`

**Sites map** (collapsible section):
- Leaflet + OpenStreetMap (install when needed)
- Markers for all sites color-coded by type
- Active incident overlays

Permissions: `command_center`, `super_admin`.

**Done when**: Operations team has at-a-glance situational awareness

---

### Task 4.2 — Map view (~3h)

Build reusable `<SitesMap />` component using Leaflet (install: `leaflet`, `react-leaflet`, `@types/leaflet`).

- Leaflet + OpenStreetMap (no API key)
- Markers for all active sites, color-coded by type
- Active incident markers with severity colors
- Click marker → quick view popup + link to detail
- Auto-refresh + realtime updates
- Center on first site, fit bounds to all visible markers

**Done when**: Map displays correctly on Command Center page with realtime markers

---

### Task 4.3 — Notifications system (~4h)

Build:

1. **Notification bell in topbar**
   - Unread count badge
   - Click opens dropdown with last 20
   - "View all" link to `/dashboard/notifications`

2. **`/dashboard/notifications` page**
   - Full DataTable with filters (category, severity, read/unread)
   - "Mark read" / "Mark all read" actions

3. **Realtime subscription**
   - Subscribe to `palaro.notifications` WHERE `recipient_id = current_user OR recipient_role = my_role`
   - Live update bell + dropdown
   - Sonner toast for high-severity notifications

4. **Notification triggers** (DB functions or service helpers):
   - New incident severity ≥ medium → notify `command_center` role
   - New referral → notify users at target site
   - Critical incident → broadcast to `command_center` + `medical_field`
   - Heat index reading exceeds danger threshold → notify `command_center` + `venue_manager`
   - VIP status change → notify `command_center` + `protocol_officer`

5. **PWA push notifications** via service worker (optional Phase 1)

**Done when**: Notifications fire on real events, command center is omniscient

---

### Task 4.4 — Audit log + first report (~2h)

Build:
- `withAuditLog()` server action wrapper that logs every state-changing action
- Stores: action, entity_type, entity_id, changes diff (JSONB), user_id, ip, user_agent

Build `/dashboard/reports`:
- Placeholder report cards for future reports
- Implement ONE working report: "Daily Incident Summary"
  - Date picker (shadcn Calendar)
  - PDF export (`@react-pdf/renderer`)
  - Includes: total incidents by category and severity, top 5 sites, referral stats

**Done when**: All writes auditable, first printable report works

---

## Phase 1 acceptance criteria

Before declaring Phase 1 complete and moving to Phase 2, ALL of these must pass:

- [ ] `berlcamp@gmail.com` signs in with Google → instant super_admin access
- [ ] Super admin invites a new user by email
- [ ] That user signs in with Google → instant access with assigned role
- [ ] An unauthorized Google account signs in → sees pending page, no app access
- [ ] Field medic submits incident on phone in <30 seconds
- [ ] Field medic creates referral → UCF gets realtime notification
- [ ] UCF assesses, refers to hospital → hospital gets notification
- [ ] Hospital admits and discharges
- [ ] Command Center sees the entire chain live without refresh
- [ ] All actions appear in `audit_logs`
- [ ] Mobile UI works on a 5" Android phone
- [ ] System handles 50 concurrent users without degradation
- [ ] Three test users (field, UCF, hospital) complete the medical flow without help

When all checked: ship it. The life-safety critical path is done.

---

## How to start

Right now, do this:

1. **Confirm you understand** by summarizing in your own words:
   - The 3 most critical things about this project
   - Why this is NOT the Next.js you know (Next.js 16 + React 19 + Tailwind 4)
   - The auth architecture (Google OAuth + invitation-based + super admin seed)
   - Your understanding of the medical referral chain
   - The UI/UX conventions taken from mtop
   - Any concerns or ambiguities you want me to clarify

2. **Ask me clarifying questions** if anything is unclear

3. **Wait for my approval** before writing any code

4. Once I approve, **start with Task 1.1 (project bootstrap)** and proceed through tasks in order

5. **Before each task**: re-read the relevant section of this document, write a brief plan, get my approval, then execute

6. **After each task**: summarize what changed, what files were created/modified, any deviations from the plan, and what's next

---

## Working agreements

- I expect you to push back if you see problems with my requests
- If something would take significantly longer than estimated, tell me before starting
- Surface uncertainty early — especially around Next.js 16 / React 19 / Tailwind 4 APIs
- Write tests for the medical chain (life safety)
- Keep `.env.local` out of git
- Commit messages: conventional commits style (`feat:`, `fix:`, `chore:`)
- Run `npm run lint` before declaring a task done
- If you find yourself adding a dependency not in the locked list above, ASK first
- ALWAYS use `.schema('palaro')` on Supabase queries
- ALWAYS verify Next.js 16 docs in `node_modules/next/dist/docs/` if uncertain about an API

Ready when you are. Start by confirming understanding.
