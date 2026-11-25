import { StyleSheet, View } from 'react-native';

import type { MeasurementRow } from '@/data';
import type { UnitSystem } from '@/domain';
import {
  AppCard,
  AppSectionHeader,
  AppText,
  formatMeasurement,
  measurementKindLabel,
  spacing,
  strings,
} from '@/ui';

export interface VitalsListProps {
  measurements: readonly MeasurementRow[];
  unitSystem: UnitSystem;
}

/** Vitals captured with a record. Formatted per the user's unit preference. */
export function VitalsList({ measurements, unitSystem }: VitalsListProps) {
  if (measurements.length === 0) return null;

  return (
    <View style={styles.root}>
      <AppSectionHeader title={strings.recordDetail.vitals} />
      <AppCard>
        {measurements.map((vital) => (
          <View key={vital.id} style={styles.row}>
            <AppText variant="label">{measurementKindLabel(vital.kind)}</AppText>
            <AppText variant="label">
              {formatMeasurement(vital.kind, vital.v1, vital.v2, unitSystem)}
            </AppText>
          </View>
        ))}
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
});
