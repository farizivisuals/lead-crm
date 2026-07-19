# Lead CRM

Marketing agency platform: admin area for employees (projects, kanban, quotes, calendar) and a client portal (deliverable review, revisions). Next.js 16 (App Router) + Supabase, TypeScript throughout.

## Setup

1. Copy `.env.local.example` → `.env.local` and fill in your Supabase keys.
2. Create a Supabase project and run the migrations in `supabase/migrations/` in order via the SQL editor.
3. Enable Realtime for the `notifications` table.
4. Bootstrap a root user (see `CLAUDE.md` for the SQL).

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

Full architecture notes, route-group layout, and key patterns live in [CLAUDE.md](CLAUDE.md).
