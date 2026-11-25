import { StyleSheet, View } from 'react-native';

import type { TestResultRow } from '@/data';
import type { ReadingFlag } from '@/domain';
import {
  AppBadge,
  AppCard,
  AppSectionHeader,
  AppText,
  type BadgeTone,
  readingFlagLabel,
  spacing,
  strings,
} from '@/ui';

import { DetailField } from './DetailField';

export interface ReadingsTableProps {
  readings: readonly TestResultRow[];
}

const FLAG_TONES: Record<ReadingFlag, BadgeTone> = {
  low: 'info',
  normal: 'success',
  high: 'danger',
  unknown: 'neutral',
};

/**
 * Lab readings. The flag is always rendered as text ("High", "Low") beside the value — colour
 * is decoration, not the signal.
 */
export function ReadingsTable({ readings }: ReadingsTableProps) {
  if (readings.length === 0) return null;

  return (
    <View style={styles.root}>
      <AppSectionHeader title={strings.recordDetail.readings} />
      <AppCard>
        {readings.map((reading, index) => (
          <View
            // Test names can repeat in one report, so the index is part of the key.
            key={`${reading.id}-${index}`}
            style={[styles.row, index > 0 ? styles.rowSpacing : undefined]}
          >
            <View style={styles.name}>
              <AppText variant="label">{reading.name}</AppText>
              {reading.refLow !== null || reading.refHigh !== null ? (
                <DetailField
                  label={strings.recordDetail.reference}
                  value={`${reading.refLow ?? '—'}–${reading.refHigh ?? '—'} ${reading.unit}`.trim()}
                />
              ) : null}
            </View>
            <AppText variant="label">
              {reading.value}
              {reading.unit ? ` ${reading.unit}` : ''}
            </AppText>
            <AppBadge
              label={readingFlagLabel(reading.flag)}
              tone={FLAG_TONES[reading.flag]}
              testID={`reading-flag-${reading.id}`}
            />
          </View>
        ))}
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowSpacing: { marginTop: spacing.md },
  name: { flex: 1 },
});
