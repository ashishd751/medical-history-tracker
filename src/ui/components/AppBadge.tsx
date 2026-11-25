import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../ThemeProvider';
import { radius, spacing } from '../tokens';
import { AppText } from './AppText';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface AppBadgeProps {
  label: string;
  tone?: BadgeTone;
  testID?: string;
}

/**
 * Small pill used for record types, reading flags, medication status and BMI/BP categories.
 * Always renders text: colour is decoration, never the only signal.
 */
export function AppBadge({ label, tone = 'neutral', testID }: AppBadgeProps) {
  const { colors } = useAppTheme();

  const palette: Record<BadgeTone, { background: string; text: string }> = {
    neutral: { background: colors.surfaceVariant, text: colors.textMuted },
    primary: { background: colors.primary, text: colors.onPrimary },
    success: { background: colors.surfaceVariant, text: colors.success },
    warning: { background: colors.checkSurface, text: colors.warning },
    danger: { background: colors.surfaceVariant, text: colors.danger },
    info: { background: colors.surfaceVariant, text: colors.info },
  };
  const { background, text } = palette[tone];

  return (
    <View testID={testID} style={[styles.pill, { backgroundColor: background }]}>
      <AppText variant="caption" style={{ color: text, fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
});
