# Graph Report - .  (2026-07-24)

## Corpus Check
- Corpus is ~43,896 words - fits in a single context window. You may not need a graph.

## Summary
- 602 nodes · 1230 edges · 84 communities (34 shown, 50 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.9)
- Token cost: 308,454 input · 270 output

## Community Hubs (Navigation)
- Quote & Client Dialogs
- Admin Pages & Dashboard
- Project Detail & Status
- Client & Team Provisioning
- TypeScript Config
- Dev Dependencies
- Sidebar & Navigation UI
- Architecture Docs & Conventions
- shadcn Component Config
- Settings Pages & Cards
- Kanban Stage Board
- Runtime Dependencies
- Quote Server Actions
- Projects & Tasks Schema
- Notification Triggers
- Departments & Clients Schema
- Command Palette
- Profiles & Auth Bootstrap
- Deliverables & Revisions
- Root Layout & Fonts
- Brand Identity
- Comments & Activity Schema
- Creatives Cross-Access
- Privilege Guards
- App Icon Convention
- Proxy Middleware
- Calendar Events RPC
- Project & Task Creatives
- Quotes Schema
- Security Fixes Migration
- clsx Package
- ESLint Config
- Framer Motion Package
- FullCalendar Core
- FullCalendar DayGrid
- FullCalendar Interaction
- FullCalendar List
- FullCalendar React
- FullCalendar TimeGrid
- Drag & Drop Package
- Hookform Resolvers
- Lucide Icons Package
- MCP Config
- Next.js Package
- Next Config
- Radix Accordion
- Radix Avatar
- Radix Checkbox
- Radix Dialog
- Radix Label
- Radix Popover
- Radix Progress
- Radix Scroll Area
- Radix Select
- Radix Separator
- Radix Slot
- Radix Switch
- Radix Tabs
- Radix Tooltip
- React Package
- React DOM Package
- React Hook Form
- Supabase JS Client
- Tailwind Merge Package
- Tailwind Animate Package
- React Query Package
- Zod Package
- PostCSS Config
- Multi-Department Employees
- Stock File Icon
- Stock Globe Icon
- Next.js Wordmark Asset
- Vercel Logo Asset
- Stock Window Icon

## God Nodes (most connected - your core abstractions)
1. `createClient` - 54 edges
2. `createClient()` - 27 edges
3. `Button` - 23 edges
4. `requireEmployee()` - 22 edges
5. `isExecutive()` - 18 edges
6. `cn()` - 18 edges
7. `formatDate()` - 18 edges
8. `Input` - 17 edges
9. `createAdminClient()` - 16 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Admin Area (employees: projects, kanban, quotes, calendar)` --semantically_similar_to--> `(admin) Route Group (employees; dark sidebar + notification bell)`  [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `Client Portal (deliverable review, revisions)` --semantically_similar_to--> `(portal) Route Group (clients; minimal top nav)`  [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `NavItem()` --calls--> `cn()`  [EXTRACTED]
  components/layout/Sidebar.tsx → lib/utils.ts
- `SidebarContent()` --calls--> `isExecutive()`  [EXTRACTED]
  components/layout/Sidebar.tsx → lib/rbac.ts
- `CommandPalette()` --calls--> `createClient()`  [EXTRACTED]
  components/search/CommandPalette.tsx → lib/supabase/browser.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Route Group Architecture with proxy.ts Enforcement** — claude_auth_route_group, claude_admin_route_group, claude_portal_route_group, claude_proxy_middleware [EXTRACTED 1.00]
- **Notification Pipeline (Postgres triggers → notifications table → Realtime → admin bell)** — claude_postgres_trigger_notifications, claude_notifications_realtime, claude_admin_route_group [INFERRED 0.85]
- **Supabase Setup and Provisioning Flow** — claude_environment_variables, claude_supabase_migrations, claude_root_user_bootstrap, claude_supabase_admin_client [INFERRED 0.75]

## Communities (84 total, 50 thin omitted)

### Community 0 - "Quote & Client Dialogs"
Cohesion: 0.07
Nodes (52): EditQuoteDialog(), LineItem, newLineItem(), QuoteData, LineItem, newLineItem(), Props, QuoteDialog() (+44 more)

### Community 1 - "Admin Pages & Dashboard"
Cohesion: 0.07
Nodes (56): CalendarPage(), Props, ClientDetailPage(), ClientsPage(), approvalVariants, DashboardPage(), EmployeeDashboard(), priorityVariants (+48 more)

### Community 2 - "Project Detail & Status"
Cohesion: 0.05
Nodes (39): updateMoodboardUrl(), updateProjectStatus(), VALID_STATUSES, Props, ALL_STATUSES, statusStyles, CompanyCalendar(), exclusiveEnd() (+31 more)

### Community 3 - "Client & Team Provisioning"
Cohesion: 0.16
Nodes (24): CreateClientInput, createClientWithPortal(), getClientContactEmail(), getClientLoginLink(), resetClientPassword(), updateClient(), Props, addEmployee() (+16 more)

### Community 4 - "TypeScript Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 5 - "Dev Dependencies"
Cohesion: 0.07
Nodes (26): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+18 more)

### Community 6 - "Sidebar & Navigation UI"
Cohesion: 0.13
Nodes (15): NAV_ITEMS, NavItem(), SETTINGS_ITEMS, SidebarContent(), SidebarProps, Avatar, AvatarFallback, AvatarImage (+7 more)

### Community 7 - "Architecture Docs & Conventions"
Cohesion: 0.13
Nodes (20): Next.js 16 Breaking Changes Warning, (admin) Route Group (employees; dark sidebar + notification bell), (auth) Route Group (login, reset-password), Configurable Stages (/admin/settings/departments), Dev Commands (direct node paths, Node 26 breaks .bin shims), Environment Variables (.env.local), Lead CRM – Marketing Agency Platform (Next.js 16 + Supabase), Notifications Table with Supabase Realtime (+12 more)

### Community 8 - "shadcn Component Config"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 9 - "Settings Pages & Cards"
Cohesion: 0.27
Nodes (10): ClientsLayout(), DepartmentsSettingsPage(), TeamPage(), Card, CardContent, CardDescription, CardFooter, CardHeader (+2 more)

### Community 10 - "Kanban Stage Board"
Cohesion: 0.25
Nodes (10): Props, Props, Props, Employee, isTaskOverdue(), PRIORITY_STYLES, Props, StageBoard() (+2 more)

### Community 11 - "Runtime Dependencies"
Cohesion: 0.18
Nodes (11): class-variance-authority, date-fns, dependencies, class-variance-authority, date-fns, @radix-ui/react-dropdown-menu, @radix-ui/react-toast, @supabase/ssr (+3 more)

### Community 12 - "Quote Server Actions"
Cohesion: 0.25
Nodes (7): DeleteQuoteButton(), createQuote(), CreateQuoteInput, deleteQuote(), LineItemInput, updateQuote(), UpdateQuoteInput

### Community 13 - "Projects & Tasks Schema"
Cohesion: 0.39
Nodes (8): department_stages, project_departments, projects, projects_updated_at, task_checklist_items, task_stage_history, tasks, tasks_updated_at

### Community 14 - "Notification Triggers"
Cohesion: 0.31
Nodes (6): log_task_stage_change(), on_comment_notify(), on_comment_notify_trigger, on_deliverable_revision_notify(), on_deliverable_revision_notify_trigger, on_task_stage_changed

### Community 15 - "Departments & Clients Schema"
Cohesion: 0.38
Nodes (6): client_contacts, clients, clients_updated_at, departments, employees, employees_updated_at

### Community 16 - "Command Palette"
Cohesion: 0.33
Nodes (5): CommandPalette(), Props, ResultType, SearchResult, TYPE_META

### Community 17 - "Profiles & Auth Bootstrap"
Cohesion: 0.47
Nodes (5): handle_new_user(), on_auth_user_created, profiles, profiles_updated_at, set_updated_at()

### Community 18 - "Deliverables & Revisions"
Cohesion: 0.47
Nodes (5): deliverable_revisions, deliverables, deliverables_updated_at, handle_deliverable_revision(), on_revision_inserted

### Community 20 - "Root Layout & Fonts"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 21 - "Brand Identity"
Cohesion: 0.67
Nodes (4): Lead CRM Logo ("lead." Wordmark), Lead CRM Brand Identity, Square Period Motif, Bold Lowercase Sans-Serif Wordmark Style

### Community 22 - "Comments & Activity Schema"
Cohesion: 0.50
Nodes (3): activity_log, comments, notifications

### Community 23 - "Creatives Cross-Access"
Cohesion: 0.83
Nodes (3): can_see_project(), department_cross_access, departments

### Community 26 - "App Icon Convention"
Cohesion: 0.67
Nodes (3): Lead CRM Brand Identity, Lead Wordmark App Icon, Next.js App Router Icon Convention

## Knowledge Gaps
- **208 isolated node(s):** `supabase`, `Props`, `Props`, `LineItem`, `QuoteData` (+203 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient` connect `Admin Pages & Dashboard` to `Project Detail & Status`, `Client & Team Provisioning`, `Sidebar & Navigation UI`, `Settings Pages & Cards`, `Quote Server Actions`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies` to `Dev Dependencies`, `clsx Package`, `Framer Motion Package`, `FullCalendar Core`, `FullCalendar DayGrid`, `FullCalendar Interaction`, `FullCalendar List`, `FullCalendar React`, `FullCalendar TimeGrid`, `Drag & Drop Package`, `Hookform Resolvers`, `Lucide Icons Package`, `Next.js Package`, `Radix Accordion`, `Radix Avatar`, `Radix Checkbox`, `Radix Dialog`, `Radix Label`, `Radix Popover`, `Radix Progress`, `Radix Scroll Area`, `Radix Select`, `Radix Separator`, `Radix Slot`, `Radix Switch`, `Radix Tabs`, `Radix Tooltip`, `React Package`, `React DOM Package`, `React Hook Form`, `Supabase JS Client`, `Tailwind Merge Package`, `Tailwind Animate Package`, `React Query Package`, `Zod Package`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Quote & Client Dialogs` to `Project Detail & Status`, `Sidebar & Navigation UI`, `Settings Pages & Cards`, `Kanban Stage Board`, `Command Palette`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `supabase`, `Props`, `Props` to the rest of the system?**
  _208 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Quote & Client Dialogs` be split into smaller, more focused modules?**
  _Cohesion score 0.06611759322809425 - nodes in this community are weakly interconnected._
- **Should `Admin Pages & Dashboard` be split into smaller, more focused modules?**
  _Cohesion score 0.07373417721518988 - nodes in this community are weakly interconnected._
- **Should `Project Detail & Status` be split into smaller, more focused modules?**
  _Cohesion score 0.05230496453900709 - nodes in this community are weakly interconnected._