import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../ThemeProvider';
import { radius, spacing } from '../tokens';
import { AppText } from './AppText';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

export interface AppBannerProps {
  tone: BannerTone;
  title?: string | undefined;
  message: string;
  /** Action buttons, typically "View original" / "I've checked everything". */
  actions?: ReactNode;
  testID?: string;
}

/**
 * In-app, inline banner. Deliberately NOT dismissible by swipe and not a system
 * notification: the handwriting warning must persist until the user acts (HW-4).
 */
export function AppBanner({ tone, title, message, actions, testID }: AppBannerProps) {
  const { colors } = useAppTheme();

  const accent =
    tone === 'danger'
      ? colors.danger
      : tone === 'warning'
        ? colors.warning
        : tone === 'success'
          ? colors.success
          : colors.info;

  const background =
    tone === 'danger'
      ? 'rgba(197,48,48,0.10)'
      : tone === 'warning'
        ? 'rgba(183,121,31,0.12)'
        : tone === 'success'
          ? 'rgba(47,133,90,0.12)'
          : 'rgba(43,108,176,0.10)';

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: background, borderLeftColor: accent }]}
    >
      <View style={styles.body}>
        {title ? (
          <AppText variant="label" color="default">
            {title}
          </AppText>
        ) : null}
        <AppText variant="body">{message}</AppText>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.input,
    borderLeftWidth: 4,
    padding: spacing.md,
  },
  body: { gap: spacing.xs },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
});
