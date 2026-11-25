import { StyleSheet, View } from 'react-native';

import { AppText, spacing } from '@/ui';

export interface DetailFieldProps {
  label: string;
  value: string;
}

/** Label above a value, used for the free-text fields on the record detail screen. */
export function DetailField({ label, value }: DetailFieldProps) {
  return (
    <View style={styles.root}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText variant="body">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 2, marginBottom: spacing.sm },
});
