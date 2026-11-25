import { StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppText, spacing, strings } from '@/ui';

export interface AddSheetContentProps {
  onManual: () => void;
}

/**
 * The two ways to add a record. Uploading is deliberately disabled in Phase 1 — the entry
 * point exists so the shape of the flow is settled before attachments arrive in Phase 2.
 */
export function AddSheetContent({ onManual }: AddSheetContentProps) {
  return (
    <View style={styles.root}>
      <AppCard variant="quiet" accessibilityLabel={strings.addSheet.uploadTitle}>
        <AppText variant="label">{strings.addSheet.uploadTitle}</AppText>
        <AppText variant="caption" color="muted">
          {strings.addSheet.uploadHint}
        </AppText>
        <AppButton
          label={strings.common.comingSoon}
          variant="quiet"
          disabled
          onPress={() => undefined}
        />
      </AppCard>

      <AppCard accessibilityLabel={strings.addSheet.manualTitle}>
        <AppText variant="label">{strings.addSheet.manualTitle}</AppText>
        <AppText variant="caption" color="muted">
          {strings.addSheet.manualHint}
        </AppText>
        <AppButton
          label={strings.addSheet.manualTitle}
          onPress={onManual}
          fullWidth
          testID="add-manual"
        />
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
});
