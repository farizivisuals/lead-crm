@AGENTS.md

# Lead CRM – Marketing Agency Platform

Next.js 15 (App Router) + Supabase. TypeScript throughout.

## Dev commands

```bash
node node_modules/next/dist/bin/next dev    # start dev server
node node_modules/next/dist/bin/next build  # production build
node node_modules/typescript/bin/tsc --noEmit  # type check
```

> Node 26 breaks the `.bin/next` and `.bin/tsc` shims. Use the direct paths above.

## Environment variables

Copy `.env.local.example` → `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Supabase setup

1. Create a project at supabase.com
2. Run all migrations in order via the SQL editor: `supabase/migrations/0001_*.sql` through `0010_*.sql`
3. Enable Realtime for the `notifications` table (Database → Replication → supabase_realtime)

## Bootstrap root user

Create your account in Supabase Auth (Dashboard → Authentication → Users → Add user), then:

```sql
UPDATE profiles SET user_type = 'employee' WHERE id = '<your-auth-uid>';
INSERT INTO employees (profile_id, role) VALUES ('<your-auth-uid>', 'root');
```

## Architecture

- `(auth)` route group — login, reset-password (no layout wrapper)
- `(admin)` route group — employees only; dark sidebar + notification bell
- `(portal)` route group — clients only; minimal top nav

`middleware.ts` enforces cross-area redirects. All security lives in Postgres RLS, not frontend.

## Key patterns

- Server actions for mutations that need service-role (provisioning clients/employees)
- `lib/supabase/admin.ts` — server-only, never import in client components
- Stages are configurable at `/admin/settings/departments`
- Notifications fire from Postgres triggers — no app-level fanout needed
