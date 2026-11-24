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
  style?: StyleProp<TextStyle>;
  /** For screen readers when the text is a heading. */
  accessibilityRole?: 'header' | 'text' | undefined;
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
  style,
  accessibilityRole,
}: AppTextProps) {
  const { colors } = useAppTheme();
  return (
    <PaperText
      numberOfLines={numberOfLines}
      accessibilityRole={accessibilityRole}
      style={[typography[variant], { color: resolveColor(color, colors), textAlign: align }, style]}
    >
      {children}
    </PaperText>
  );
}
