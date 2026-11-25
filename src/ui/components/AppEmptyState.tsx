import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../ThemeProvider';
import { spacing } from '../tokens';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

export interface AppEmptyStateProps {
  title: string;
  message?: string | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  testID?: string;
}

/** Empty and error states share one shape so they read the same everywhere. */
export function AppEmptyState({
  title,
  message,
  actionLabel,
  onAction,
  testID,
}: AppEmptyStateProps) {
  const { colors } = useAppTheme();
  return (
    <View
      testID={testID}
      style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <AppText variant="subtitle" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" color="muted" align="center">
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} variant="secondary" onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
