import { StyleSheet, View } from 'react-native';

import { bmiCategory, type BmiPreset, computeBmi } from '@/domain';
import { AppBadge, AppCard, AppText, bmiCategoryLabel, formatBmi, spacing, strings } from '@/ui';

export interface BmiPreviewProps {
  heightCm: number | null;
  weightKg: number | null;
  preset: BmiPreset;
  testID?: string;
}

/** Live BMI while onboarding. Derived, never stored, and always marked informational. */
export function BmiPreview({ heightCm, weightKg, preset, testID }: BmiPreviewProps) {
  const bmi = heightCm !== null && weightKg !== null ? computeBmi(heightCm, weightKg) : null;

  return (
    <AppCard variant="quiet" testID={testID}>
      <AppText variant="caption" color="muted">
        {strings.onboarding.bmiPreview}
      </AppText>
      {bmi === null ? (
        <AppText variant="body" color="muted">
          {strings.onboarding.bmiUnavailable}
        </AppText>
      ) : (
        <View style={styles.row}>
          <AppText variant="title" testID="onboarding-bmi">
            {formatBmi(bmi)}
          </AppText>
          <AppBadge label={bmiCategoryLabel(bmiCategory(bmi, preset))} tone="info" />
        </View>
      )}
      <AppText variant="caption" color="muted">
        {strings.app.disclaimer}
      </AppText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
