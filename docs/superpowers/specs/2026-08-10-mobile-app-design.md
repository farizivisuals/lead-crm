# Lead CRM Mobile — Design

**Date:** 2026-08-10
**Status:** Approved for planning
**Target:** iOS App Store via EAS. Android deferred (code stays cross-platform).

---

## 1. Goal

Ship a native iOS app that lets already-provisioned Lead CRM users — employees and
clients — do their day-to-day work from a phone. Accounts are created on the web;
the app is login-only.

## 2. Core architectural finding

`createAdminClient()` (service role) appears in exactly two files:

- `app/(admin)/admin/clients/new/actions.ts`
- `app/(admin)/admin/team/actions.ts`

Every other mutation in the product — quotes, projects, tasks, deliverables,
moodboard, stages, revisions, profile — already runs as the calling user and is
authorized by the RLS policies in migrations 0007, 0008, 0014, 0017 and 0018.

Those two files stay web-only. Therefore:

**The mobile app needs no backend of its own.** Expo talks to Supabase directly.
No Next.js server, no API layer, no proxy.

The Supabase anon/publishable key ships inside the binary. This is correct and
safe: it grants no privilege on its own, and RLS is the authorization boundary.
`SUPABASE_SERVICE_ROLE_KEY` must never appear in the `mobile/` tree — a single
leak there is total database compromise.

## 3. Stack

| Concern | Choice | Note |
|---|---|---|
| Framework | Expo SDK 56 | current as of this spec |
| Routing | Expo Router | file-based, mirrors web `app/` |
| Data | `@supabase/supabase-js` | same queries as the server components |
| Session storage | `expo-sqlite/localStorage/install` | Supabase's current recommendation |
| Cache/refetch | TanStack Query | already used on web |
| Lists | FlashList | long task/activity/agenda lists |
| Animation | Reanimated | tab/stack transitions, glass motion |
| Blur | `expo-blur` | native blur, replaces `backdrop-filter` |
| PDF | `expo-print` + `expo-sharing` | quote export |
| Push | `expo-notifications` | + Supabase Edge Function |

Env vars use the `EXPO_PUBLIC_` prefix: `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`. Point at the same Supabase project as the web app.

## 4. Repo layout

A `mobile/` folder inside this repo with its own `package.json`.

```
Lead CRM/
  app/  components/  lib/        # existing Next.js web app, untouched
  supabase/migrations/           # shared — adds 0020_push_tokens.sql
  mobile/                        # new Expo app
    app/                         # Expo Router routes
    components/                  # RN components
    lib/                         # supabase client, query hooks, theme
    app.json  eas.json  metro.config.js
```

`lib/types.ts` (239 lines, pure types) and `lib/rbac.ts` (68 lines, pure functions
and label constants) are shared with the web app via Metro `watchFolders` plus a
`@shared/*` tsconfig path alias. This prevents the role hierarchy and status
labels from drifting between the two apps.

**Known risk:** Metro resolving modules outside the project root needs correct
`watchFolders` and `resolver.nodeModulesPaths` config, and `lib/rbac.ts` imports
via the Next-specific `@/` alias, which needs a Metro resolver alias too. If this
resists more than briefly, **fall back to copying both files into `mobile/lib/`**
and note the duplication. Do not spend a day on build config to save 307 lines.

## 5. Navigation

Root `_layout.tsx` reads the session, fetches the profile, and branches on
`user_type` — the same decision `app/(admin)/layout.tsx` and
`app/(portal)/layout.tsx` make today.

```
mobile/app/
  _layout.tsx                     providers, fonts, session gate
  (auth)/
    login.tsx
    forgot-password.tsx
    update-password.tsx
  (employee)/
    _layout.tsx                   bottom tabs
    dashboard.tsx
    projects/index.tsx | new.tsx | [projectId]/{index,tasks,deliverables,activity}.tsx
    tasks.tsx                     my tasks
    calendar.tsx
    more/
      index.tsx
      clients/index.tsx | [clientId]/index.tsx | [clientId]/quotes/{new,[quoteId]}.tsx
      team.tsx | stages.tsx | profile.tsx
    notifications.tsx
    search.tsx
  (client)/
    _layout.tsx                   bottom tabs
    index.tsx                     projects list (portal home)
    projects/[projectId].tsx
    calendar.tsx
    profile.tsx                   new — no web equivalent
```

The client Profile screen has no web counterpart: the portal's top nav carries
sign-out, but a tab bar needs somewhere to put it. It holds name, email, change
password and sign out.

**Employee tabs:** Dashboard · Projects · Tasks · Calendar · More
**Client tabs:** Projects · Calendar · Profile

Clients is pinned at the top of `More` and gated to the executive tier, matching
the `execOnly` flags in `components/layout/Sidebar.tsx`. Gating uses the shared
`isExecutive()` so it cannot diverge from the web. Tab order is a single array —
trivial to reorder if usage says Clients deserves a tab slot.

RLS is the real enforcement; role gating in the UI only controls what is *shown*.

## 6. Visual design

Carry the web identity over exactly; use native navigation patterns.

- Canvas `#06060a`; tokens ported from `app/globals.css` into a TS theme object
- Glass surfaces via `expo-blur` (`BlurView`, dark tint) — a genuine improvement
  over `backdrop-filter`, which mobile Safari renders inconsistently
- Noise overlay as a tiled PNG asset; ambient radial gradients via
  `expo-linear-gradient`
- Radius 12 (`--radius: 0.75rem`), Geist via `expo-font`
- **Dark only.** No light theme; the web app has no light token values to port.
- Dialogs become native form sheets (Expo Router `presentation: 'formSheet'`),
  not a bottom-sheet dependency
- Bottom tab bar uses a blurred translucent background

## 7. Screens

### 7.1 Direct ports

Mechanical work: the Supabase `.select()` calls in each server component move into
TanStack Query hooks; the JSX becomes RN components. No logic changes.

Dashboard (both the executive and plain-employee variants — see
`dashboard/page.tsx`, which branches on `isExecutive`), projects list and detail,
project status, moodboard, creatives, deliverables list/create/edit, activity log,
my tasks, team (read-only), stage settings, profile, notifications, client portal
home, client project detail, approve / request revision.

### 7.2 Screens requiring redesign

**Kanban board** (`components/kanban/StageBoard.tsx`). `@hello-pangea/dnd` does not
run on React Native, and drag-drop columns are poor UX on a phone regardless.
Replaced by horizontally scrollable **stage chips** with per-stage counts; tapping
one filters the task list beneath. Moving a task: open it → tap current stage →
pick from a sheet. Writes the same `current_stage_id`, fires the same history and
notification triggers from migration 0009. No functionality lost.

**Calendar** (FullCalendar). Replaced by a day-grouped **agenda list** (FlashList)
with a compact month strip above. Data source unchanged: the
`get_calendar_events(p_start, p_end)` RPC, which is `SECURITY INVOKER` and so
applies RLS normally. Uses `react-native-calendars` for the month strip only.
Existing `DeptFilter` / `EmployeeFilter` / `MineToggle` become a filter sheet.

**Quote print** (`app/(print)/print/quotes/[quoteId]/page.tsx`). `expo-print`
renders the existing print HTML to a PDF; `expo-sharing` sends it. The markup
ports nearly verbatim. Better than the web flow, which depends on a browser print
dialog.

**Command palette** (`components/search/CommandPalette.tsx`). Becomes a Search
screen: text input, grouped results (clients / projects / tasks), tap to navigate.

**Quote builder.** Repeating line-item rows with a running total. Native form; the
`createQuote` / `updateQuote` / `deleteQuote` logic ports directly since it already
runs under RLS.

### 7.3 Out of scope — web only

- Create / edit / delete clients
- Create / edit / delete employees
- Login-link generation, admin-initiated password resets

All require `service_role`. Team and the client record are **read-only** in the
app; quotes under a client are full CRUD.

Non-auth client fields (`company_name`, `phone`, `notes`) could be made editable
later without `service_role` — the current `updateClient` action bundles them with
auth fields, so splitting it is the prerequisite. Deliberately deferred.

## 8. Auth

- **Login:** `signInWithPassword`. No signup — accounts come from the web.
- **Forgot password:** `resetPasswordForEmail` with `redirectTo` set to the app
  deep link (`leadcrm://update-password`). Requires adding that URL to Supabase's
  redirect allowlist.
- **Update password:** `updateUser({ password })` — user-scoped, no service role.
- **Session gate:** root layout resolves session → profile → `user_type`, then
  redirects into `(employee)` or `(client)`. Mirrors the web layouts.
- **Sign out:** clears the session and deletes this device's push token.

## 9. Push notifications

Postgres triggers already write to `notifications` (migration 0009). Delivery to
the device is what's new.

**Migration `0020_push_tokens.sql`**

```
push_tokens (
  profile_id  uuid references profiles(id) on delete cascade,
  token       text,
  platform    text,
  created_at  timestamptz,
  updated_at  timestamptz,
  primary key (profile_id, token)
)
```

RLS: a user may select/insert/update/delete only rows where
`profile_id = auth.uid()`.

**Delivery path**

1. Supabase Database Webhook on `notifications` INSERT →
2. Edge Function `send-push` (~40 lines): look up `push_tokens` for
   `recipient_profile_id`, POST to `https://exp.host/--/api/v2/push/send` with
   `title`, `body`, and `data: { entity_type, entity_id }`.

A Database Webhook is used rather than hand-wiring `pg_net`.

**Client side**

- Register the Expo push token after login; upsert into `push_tokens`
- Delete on sign-out
- `addNotificationResponseReceivedListener` deep-links from `data` to the task or
  project screen
- `expo-notifications` config plugin with `mode: "production"` for production builds
- EAS manages the APNs key (`eas credentials`)

**Consequence:** push does not work in Expo Go. The dev loop is one
`eas build --profile development`, then `expo start --dev-client` thereafter.

## 10. Realtime

The existing notification bell subscribes over Realtime. On mobile, subscriptions
go stale after backgrounding, so an `AppState` listener reconnects on `active`:

```js
AppState.addEventListener('change', s => {
  if (s === 'active' && !supabase.realtime.isConnected()) supabase.realtime.connect()
})
```

Applies to the notification badge and to task/stage live updates.

## 11. Offline

Out of scope. TanStack Query caches reads so screens show last-known data instead
of flashing empty, and mutations fail with a clear message when offline. Full
offline write queueing is not built — add it only if field use proves it necessary.

## 12. Testing

Not a full suite. One runnable check per piece of non-trivial logic:

- Edge Function token fan-out: multiple devices per user, no tokens, expired token
  response handling
- Session → route branching: employee, client, no session
- Quote total arithmetic (quantity × unit price, rounding)

Role gating needs no new tests — it reuses the web app's `lib/rbac.ts` unchanged.

## 13. Shipping

**EAS profiles** in `eas.json`: `development` (dev client, simulator + device),
`preview` (internal TestFlight), `production` (store).

**`app.json`:** bundle identifier, version, `runtimeVersion` policy,
`expo-notifications` plugin, icon, splash, `scheme: "leadcrm"` for deep links.

**Sequence**

1. Register bundle ID; create the App Store Connect app record
2. `eas build -p ios --profile production`
3. `eas submit -p ios` (App Store Connect API key)
4. TestFlight internal testing
5. Store metadata, screenshots, review submission

**Blocking requirements**

- **Demo account credentials in the review notes.** A login-only app with no
  in-app signup is rejected without them. Provision a demo employee and a demo
  client on the web before submitting.
- **Privacy policy URL** — required by App Store Connect. Must be hosted.
- **App Privacy questionnaire** — the app collects email, name and usage data
  linked to identity.

**Not blocking:** Sign in with Apple is only required when third-party social
login is offered. This app is email/password only, so it does not apply.

## 14. Phases

1. **Foundation** — scaffold, Supabase client, theme + glass primitives, auth
   screens, session gate, tab shells
2. **Employee core** — dashboard (both variants), projects, project detail, stage
   board replacement, my tasks
3. **Employee remainder** — clients, quotes + PDF, deliverables, activity,
   calendar, team, stages, profile, search
4. **Client portal** — home, project detail, approve / request revision, calendar
5. **Push** — migration 0020, Edge Function, token lifecycle, deep links
6. **Ship** — icon/splash, EAS config, TestFlight, store metadata, submit

Each phase ends in a runnable app.

## 15. Risks

| Risk | Mitigation |
|---|---|
| App Store rejection: no demo account | Provision demo employee + client before submitting |
| No hosted privacy policy | Publish one during phase 6 |
| Metro cross-folder shared types | Timeboxed; fall back to copying the two files |
| Realtime stale after backgrounding | `AppState` reconnect handler (§10) |
| Push untestable in Expo Go | Dev build in phase 1, before phase 5 |
| Service-role key leaking into `mobile/` | Never import `lib/supabase/admin.ts`; nothing in scope needs it |
