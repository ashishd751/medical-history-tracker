import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { darkThemeColors, lightThemeColors, radius, type ThemeColors } from './tokens';

/**
 * Paper (Material 3) themes derived from our tokens.
 *
 * Paper is an implementation detail: every feature imports from `src/ui`, never from
 * `react-native-paper` directly, so the library can be swapped (section 6).
 *
 * Font: system font for Phase 0. Inter will be added with expo-font in a later phase
 * once the licence/asset is in the repo (see docs/DECISIONS.md).
 */
export interface AppTheme {
  paper: MD3Theme;
  colors: ThemeColors;
}

function buildPaperTheme(base: MD3Theme, colors: ThemeColors): MD3Theme {
  return {
    ...base,
    roundness: radius.card,
    colors: {
      ...base.colors,
      primary: colors.primary,
      onPrimary: colors.onPrimary,
      background: colors.background,
      surface: colors.surface,
      surfaceVariant: colors.surfaceVariant,
      onSurface: colors.text,
      onSurfaceVariant: colors.textMuted,
      outline: colors.border,
      error: colors.danger,
    },
  };
}

export const lightTheme: AppTheme = {
  paper: buildPaperTheme(MD3LightTheme, lightThemeColors),
  colors: lightThemeColors,
};

export const darkTheme: AppTheme = {
  paper: buildPaperTheme(MD3DarkTheme, darkThemeColors),
  colors: darkThemeColors,
};
