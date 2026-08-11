# DESIGN.md — Lead CRM mobile (iOS)

Committed 2026-08-11. User-approved direction: dark ops tool with real color, Linear/Vercel craft bar, applied to the Expo app. Scope: every screen except the calendar screen (`app/(employee)/calendar.tsx`, `app/(client)/calendar.tsx` untouched).

## World
A pocket instrument for agency operators. Near-black ground, quiet glass surfaces, one indigo accent marking "interactive / primary", and a strict semantic color code for state. Color is information, never decoration. Status is never bare gray text.

## Tokens — single source `mobile/lib/theme.ts`
- Ground `#08090d`; glass surfaces stay white-alpha (`glass` 4% / `glassMd` 6% / `glassStrong` 8%), borders white 8–12%.
- **Accent (indigo):** `accent #818CF8` (text/icons on dark), `accentSolid #6366F1` (filled controls), tint bg = accent @15%, tint border = accent @30%.
- **Semantic:** success `#34D399`, warning `#FBBF24`, danger `#F87171`, info `#38BDF8`, review `#A78BFA`, neutral = white/60.
- **Status maps live in theme.ts** (`PROJECT_STATUS_COLORS`, `PRIORITY_COLORS`, `DELIVERABLE_STATUS_COLORS`): planning=info, active=accent, on_hold=warning, completed=success, cancelled=danger; low=neutral, medium=info, high=warning, urgent=danger; draft=neutral, internal_review=review, client_review=warning, approved=success, revision_requested=danger. Department colors stay `DEPT_COLORS` from `@shared/rbac`.
- `withAlpha(hex, a)` derives tint backgrounds; never hand-write rgba duplicates of a token.

## Type
System font (SF Pro via RN defaults). Screen title 22/700 letterSpacing -0.5; section title 15/600; row title 15/600; body 13; meta 11–12; numbers get `fontVariant: ['tabular-nums']` where they align.
Text tiers: primary `#fff`, secondary white/60, tertiary white/40, faint white/25. Body copy never below white/60.

## Components
- **Badge:** `color` prop drives text, border @30%, bg @15% (neutral falls back to white-alpha). Status badges always pass a map color.
- **Button:** primary = `accentSolid` fill, white text; ghost stays neutral outline. Destructive = danger @15% bg + danger text.
- **Tab bar:** active tint `accent`, inactive white/40, dark blur background.
- **Screen:** ambient top gradient tinted indigo (`withAlpha(accentSolid, 0.07)`), not white.
- **KPI tiles:** icon in tinted rounded square (role color @15%) + tabular number + label; tappable tiles navigate to their list.
- **Rows/cards:** GlassCard; pressed state scales 0.98 or darkens; hairline separators white/8.
- **Empty states:** SF Symbol in tinted tile + one-line what + one-line how.

## Motion
Native feel first: default navigation transitions, pressable feedback, no decorative loops. One entrance max per screen.

## Do not
- No gray-only status text; no color used for emphasis outside the maps; no new fonts; no gradient text.
- Calendar screens keep their existing implementation (explicitly out of scope, user-pinned).
