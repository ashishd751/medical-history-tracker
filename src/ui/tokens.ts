/**
 * Design tokens (section 15.2).
 *
 * These are the single source of truth for colour, spacing, radius and type scale.
 * Components must consume tokens, never literal values, so the theme can be replaced.
 */

export const palette = {
  teal600: '#0F766E',
  teal700: '#0B5F58',
  background: '#F6F8F8',
  surface: '#FFFFFF',
  text: '#1F2933',
  textMuted: '#52606D',
  border: '#D9E2E1',
  success: '#2F855A',
  warning: '#B7791F',
  danger: '#C53030',
  info: '#2B6CB0',
  /** Amber used for the "Check" chips on recognised values (HW-4/section 15.4). */
  check: '#B7791F',
  checkSurface: '#FDF6E3',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  card: 12,
  input: 8,
  pill: 999,
} as const;

/** WCAG 2.5.5 / section 15.1: minimum touch target. */
export const minTouchTarget = 44;

export const typography = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;
export type SemanticColor = 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'danger';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  check: string;
  checkSurface: string;
}

export const lightThemeColors: ThemeColors = {
  background: palette.background,
  surface: palette.surface,
  surfaceVariant: '#EEF2F2',
  text: palette.text,
  textMuted: palette.textMuted,
  border: palette.border,
  primary: palette.teal600,
  onPrimary: '#FFFFFF',
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,
  check: palette.check,
  checkSurface: palette.checkSurface,
};

export const darkThemeColors: ThemeColors = {
  background: '#0E1514',
  surface: '#16201F',
  surfaceVariant: '#1F2B2A',
  text: '#E6EEEE',
  textMuted: '#A7B4B3',
  border: '#2C3A39',
  primary: '#4FD1C5',
  onPrimary: '#06201D',
  success: '#68D391',
  warning: '#F6C177',
  danger: '#FC8181',
  info: '#90CDF4',
  check: '#F6C177',
  checkSurface: '#2A2416',
};
