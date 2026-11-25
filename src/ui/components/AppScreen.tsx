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
  onBack,
  right,
  eyebrow,
  testID,
}: AppScreenProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const header = (
    <View style={styles.header}>
      {onBack ? (
        <AppButton label="Back" variant="quiet" onPress={onBack} accessibilityHint="Go back" />
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
      {right ? <View style={styles.right}>{right}</View> : null}
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  titleBlock: { flex: 1, gap: 2 },
  right: { paddingBottom: spacing.xs },
  content: { gap: spacing.lg, paddingTop: spacing.xs },
});
