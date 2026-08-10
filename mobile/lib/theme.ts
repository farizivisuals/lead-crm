export const theme = {
  colors: {
    background: '#06060a',
    foreground: 'rgba(255,255,255,0.9)',
    muted: '#27272A',            // hsl(240 4% 16%)
    mutedForeground: '#878792',  // hsl(240 5% 55%)
    destructive: '#DC2828',      // hsl(0 72% 51%)
    border: 'rgba(255,255,255,0.08)',
    glass: 'rgba(255,255,255,0.04)',
    glassMd: 'rgba(255,255,255,0.06)',
    glassStrong: 'rgba(255,255,255,0.08)',
    borderMd: 'rgba(255,255,255,0.10)',
    borderStrong: 'rgba(255,255,255,0.12)',
  },
  radius: 12,
  spacing: (n: number) => n * 4,
  text: {
    dim: 'rgba(255,255,255,0.4)',
    dimmer: 'rgba(255,255,255,0.25)',
    label: 'rgba(255,255,255,0.6)',
  },
} as const;

// Department colours — mirrors DEPT_COLORS in lib/rbac.ts
export const DEPT_COLORS: Record<string, string> = {
  video: '#6366f1',
  photo: '#ec4899',
  pr: '#f59e0b',
  creatives: '#7c3aed',
};
