import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { Text as PaperText } from 'react-native-paper';

import { useAppTheme } from '../ThemeProvider';
import { type SemanticColor, typography, type TypographyVariant } from '../tokens';

export interface AppTextProps {
  children?: ReactNode;
  variant?: TypographyVariant;
  color?: SemanticColor;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number | undefined;
  /** Caps OS font scaling. Used by tab labels, where the slot width is fixed. */
  maxFontSizeMultiplier?: number | undefined;
  style?: StyleProp<TextStyle>;
  /** For screen readers when the text is a heading. */
  accessibilityRole?: 'header' | 'text' | undefined;
  testID?: string;
}

function resolveColor(semantic: SemanticColor, colors: ReturnType<typeof useAppTheme>['colors']) {
  switch (semantic) {
    case 'muted':
      return colors.textMuted;
    case 'primary':
      return colors.primary;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'danger':
      return colors.danger;
    case 'default':
    default:
      return colors.text;
  }
}

export function AppText({
  children,
  variant = 'body',
  color = 'default',
  align = 'left',
  numberOfLines,
  maxFontSizeMultiplier,
  style,
  accessibilityRole,
  testID,
}: AppTextProps) {
  const { colors } = useAppTheme();
  return (
    <PaperText
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      accessibilityRole={accessibilityRole}
      testID={testID}
      style={[typography[variant], { color: resolveColor(color, colors), textAlign: align }, style]}
    >
      {children}
    </PaperText>
  );
}
