import type { DeliverableStatus, ProjectStatus, TaskPriority } from '@shared/types';

/** '#RRGGBB' + alpha 0..1 → 'rgba(...)'. Single place tint backgrounds come from. */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const theme = {
  colors: {
    background: '#08090d',
    foreground: 'rgba(255,255,255,0.9)',
    muted: '#27272A',            // hsl(240 4% 16%)
    mutedForeground: '#878792',  // hsl(240 5% 55%)
    border: 'rgba(255,255,255,0.08)',
    glass: 'rgba(255,255,255,0.04)',
    glassMd: 'rgba(255,255,255,0.06)',
    glassStrong: 'rgba(255,255,255,0.08)',
    borderMd: 'rgba(255,255,255,0.10)',
    borderStrong: 'rgba(255,255,255,0.12)',

    // Accent — indigo. `accent` for text/icons on dark, `accentSolid` for fills,
    // tint pair for selected/active chip surfaces.
    accent: '#818CF8',
    accentSolid: '#6366F1',
    accentTintBg: 'rgba(99,102,241,0.15)',
    accentTintBorder: 'rgba(99,102,241,0.3)',

    // Semantic state colors (400-tier for dark-ground legibility).
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#38BDF8',
    review: '#A78BFA',
    destructive: '#DC2828',      // kept for existing destructive fills
  },
  radius: 12,
  spacing: (n: number) => n * 4,
  text: {
    dim: 'rgba(255,255,255,0.4)',
    dimmer: 'rgba(255,255,255,0.25)',
    label: 'rgba(255,255,255,0.6)',
  },
} as const;

// Status → color, app-wide. Neutral states omit the entry so Badge falls back
// to its quiet white-alpha look.
export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: theme.colors.info,
  active: theme.colors.accent,
  on_hold: theme.colors.warning,
  completed: theme.colors.success,
  cancelled: theme.colors.danger,
};

export const PRIORITY_COLORS: Partial<Record<TaskPriority, string>> = {
  medium: theme.colors.info,
  high: theme.colors.warning,
  urgent: theme.colors.danger,
};

// Indexed by plain string: portal quote rows don't narrow status to QuoteStatus.
export const QUOTE_STATUS_COLORS: Partial<Record<string, string>> = {
  sent: theme.colors.info,
  accepted: theme.colors.success,
  declined: theme.colors.danger,
};

export const DELIVERABLE_STATUS_COLORS: Partial<Record<DeliverableStatus, string>> = {
  internal_review: theme.colors.review,
  client_review: theme.colors.warning,
  approved: theme.colors.success,
  revision_requested: theme.colors.danger,
};
