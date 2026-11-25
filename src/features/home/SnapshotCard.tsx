import { StyleSheet, View } from 'react-native';

import {
  type BloodType,
  bmiCategory,
  type BmiPreset,
  bpCategory,
  computeBmi,
  type UnitSystem,
} from '@/domain';
import { formatDisplayDate } from '@/lib/dates';
import {
  AppBadge,
  AppCard,
  AppText,
  bloodTypeLabel,
  bmiCategoryLabel,
  bpCategoryLabel,
  formatBloodPressure,
  formatBmi,
  formatHeight,
  formatWeight,
  spacing,
  strings,
  useAppTheme,
} from '@/ui';

export interface SnapshotCardProps {
  heightCm: number | null;
  weightKg: number | null;
  bloodType: BloodType | null;
  lastBp: { systolic: number; diastolic: number; measuredOn: string } | null;
  unitSystem: UnitSystem;
  bmiPreset: BmiPreset;
  testID?: string;
}

/**
 * The health snapshot: latest height, weight, derived BMI, blood type and last blood pressure.
 *
 * BMI is computed here from the latest measurements and never stored. The BP date is rendered
 * as `DD/MM/YYYY` (ADR-017).
 */
export function SnapshotCard({
  heightCm,
  weightKg,
  bloodType,
  lastBp,
  unitSystem,
  bmiPreset,
  testID,
}: SnapshotCardProps) {
  const { colors } = useAppTheme();
  const bmi = heightCm !== null && weightKg !== null ? computeBmi(heightCm, weightKg) : null;

  return (
    <AppCard testID={testID} accessibilityLabel={strings.home.snapshot}>
      <AppText variant="subtitle" accessibilityRole="header">
        {strings.home.snapshot}
      </AppText>

      <View style={styles.grid}>
        <Metric
          label={strings.home.height}
          value={heightCm === null ? '—' : formatHeight(heightCm, unitSystem)}
        />
        <Metric
          label={strings.home.weight}
          value={weightKg === null ? '—' : formatWeight(weightKg, unitSystem)}
        />
        <View style={styles.metric}>
          <AppText variant="caption" color="muted">
            {strings.home.bmi}
          </AppText>
          {bmi === null ? (
            <AppText variant="label">—</AppText>
          ) : (
            <View style={styles.bmiRow}>
              <AppText variant="label" testID="bmi-value">
                {formatBmi(bmi)}
              </AppText>
              <AppBadge
                label={bmiCategoryLabel(bmiCategory(bmi, bmiPreset))}
                tone="info"
                testID="bmi-category"
              />
            </View>
          )}
        </View>
        <Metric label={strings.home.bloodType} value={bloodTypeLabel(bloodType)} />
      </View>

      <View style={[styles.bp, { borderTopColor: colors.border }]}>
        <View style={styles.metric}>
          <AppText variant="caption" color="muted">
            {strings.home.lastBp}
          </AppText>
          {lastBp === null ? (
            <AppText variant="label">{strings.common.notRecorded}</AppText>
          ) : (
            <>
              <AppText variant="label" testID="snapshot-bp">
                {formatBloodPressure(lastBp.systolic, lastBp.diastolic)}
              </AppText>
              <AppText variant="caption" color="muted" testID="snapshot-bp-date">
                {strings.home.bpOn(formatDisplayDate(lastBp.measuredOn))}
              </AppText>
              <AppBadge
                label={bpCategoryLabel(bpCategory(lastBp.systolic, lastBp.diastolic) ?? 'normal')}
                tone="warning"
              />
            </>
          )}
        </View>
        <AppText variant="caption" color="muted" style={styles.disclaimer}>
          {strings.common.notMedicalAdvice}
        </AppText>
      </View>
    </AppCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { gap: 2, minWidth: 96 },
  bmiRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bp: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: spacing.xs },
  disclaimer: { marginTop: spacing.xs },
});
