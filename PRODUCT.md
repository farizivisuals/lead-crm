# PRODUCT.md — Lead CRM

## What it is
Internal platform for a marketing agency ("lead."). Two areas:
- **Admin** (`/admin/*`): employees run the agency — clients, projects, tasks on per-department stage boards, deliverables with client-approval flow, quotes, team management, calendar.
- **Portal** (`/portal/*`): clients review projects and approve/reject deliverables.

## Users & scenes
- **Executives** (root/ceo/cfo/manager): agency-wide oversight, provisioning clients/employees, cross-department filtering. Desk work, long sessions, dark office-friendly.
- **Employees**: work their assigned tasks, move them through department stages, submit deliverables for review.
- **Clients**: occasional visitors approving work.

## Product truth
- Departments own configurable stage pipelines (`department_stages`); a task's stage drives everything (open = non-terminal).
- Deliverable statuses: draft → internal_review → client_review → approved / revision_requested.
- Project statuses: planning, active, on_hold, completed, cancelled. Task priorities: low, medium, high, urgent.
- All authorization lives in Postgres RLS; UI reflects, never enforces.
- Notifications fire from Postgres triggers, delivered realtime + push.

## Brand commitments
- Wordmark: "lead." (logo.png, white on dark).
- Surface style: dark, professional ops tool. Craft bar: Linear / Vercel dashboards (user-confirmed 2026-08-11).
- Admin area mode: **Operate**. Portal mode: Operate (client-facing, gentler).

## Surfaces
- Web: Next.js 16 App Router + Tailwind v4 + shadcn-style components.
- Mobile (`mobile/`): Expo SDK 56 + expo-router, iOS-first (SF Symbols, tab bar, dev client). Employee and client route groups mirror admin/portal.

## Constraints
- Supabase backend shared by web and mobile; `@shared/*` aliases the web `lib/` (rbac, types).
- No schema changes for UI work; dashboard content derives from existing tables.
- 2026-08 mobile redesign: all screens EXCEPT the calendar screens (user-pinned exclusion).
