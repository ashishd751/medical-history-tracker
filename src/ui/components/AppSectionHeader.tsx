import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../ThemeProvider';
import { spacing } from '../tokens';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

export interface AppSectionHeaderProps {
  title: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  testID?: string;
}

/** Section title with an optional quiet action ("View all"). */
export function AppSectionHeader({ title, actionLabel, onAction, testID }: AppSectionHeaderProps) {
  const { colors } = useAppTheme();
  return (
    <View testID={testID} style={styles.root}>
      <AppText variant="subtitle" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} variant="quiet" onPress={onAction} />
      ) : (
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
