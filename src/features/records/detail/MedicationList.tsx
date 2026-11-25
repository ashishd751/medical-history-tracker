import { StyleSheet, View } from 'react-native';

import type { MedicationRow } from '@/data';
import {
  AppBadge,
  AppCard,
  AppSectionHeader,
  AppText,
  medicationStatusLabel,
  spacing,
  strings,
} from '@/ui';

export interface MedicationListProps {
  medications: readonly MedicationRow[];
}

/** Medications attached to a record, with the dose/frequency line the form collected. */
export function MedicationList({ medications }: MedicationListProps) {
  if (medications.length === 0) return null;

  return (
    <View style={styles.root}>
      <AppSectionHeader title={strings.recordDetail.medications} />
      {medications.map((medication) => (
        <AppCard key={medication.id} variant="quiet">
          <AppText variant="label">{medication.name}</AppText>
          <AppText variant="caption" color="muted">
            {[medication.dose, medication.frequency, medication.duration]
              .filter((part) => part.length > 0)
              .join(' · ') || strings.common.none}
          </AppText>
          <AppBadge label={medicationStatusLabel(medication.status)} tone="neutral" />
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
});
