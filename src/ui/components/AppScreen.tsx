import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../ThemeProvider';
import { spacing } from '../tokens';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

export interface AppScreenProps {
  title: string;
  children: ReactNode;
  /** Defaults to true. Forms that pin a footer set this to false. */
  scroll?: boolean;
  /**
   * Pads the screen's bottom edge with the safe-area inset. Defaults to false.
   *
   * Only screens outside the tab navigator that pin a footer to the bottom need this (ADR-026):
   * tab screens already sit above a tab bar that clears the home indicator, so padding again
   * would leave a double gap.
   */
  safeAreaBottom?: boolean;
  onBack?: (() => void) | undefined;
  right?: ReactNode;
  eyebrow?: string | undefined;
  testID?: string;
}

/**
 * Screen frame: safe-area padding, a title row and consistent gutters.
 *
 * Every screen uses this so titles never collide with the status bar (a Phase 0 finding) and
 * the gutters cannot drift between screens.
 */
export function AppScreen({
  title,
  children,
  scroll = true,
  safeAreaBottom = false,
  onBack,
  right,
  eyebrow,
  testID,
}: AppScreenProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const header = (
    <View style={styles.header}>
      {/* Buttons live on their own row so a long title can wrap without colliding with them. */}
      {onBack || right ? (
        <View style={styles.actions}>
          {onBack ? (
            <AppButton label="Back" variant="quiet" onPress={onBack} accessibilityHint="Go back" />
          ) : null}
          <View style={styles.spacer} />
          {right ?? null}
        </View>
      ) : null}
      <View style={styles.titleBlock}>
        {eyebrow ? (
          <AppText variant="caption" color="muted">
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
      </View>
    </View>
  );

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + spacing.md,
          // Screens with a pinned footer (forms, onboarding) opt in: their footer must clear the
          // home indicator, or the button sits half under it. Scrollable content keeps its own
          // bottom padding below, so a tab screen is never padded twice (ADR-026).
          paddingBottom: !scroll && safeAreaBottom ? insets.bottom : 0,
        },
      ]}
    >
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.lg },
  flex: { flex: 1 },
  header: { gap: spacing.xs, paddingBottom: spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
  titleBlock: { gap: 2 },
  content: { gap: spacing.lg, paddingTop: spacing.xs },
});
