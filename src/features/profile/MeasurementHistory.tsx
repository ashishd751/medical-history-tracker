import { StyleSheet, View } from 'react-native';

import type { MeasurementRow } from '@/data';
import type { UnitSystem } from '@/domain';
import { formatDisplayDate } from '@/lib/dates';
import { AppButton, AppListRow, AppText, formatMeasurement, spacing, strings } from '@/ui';

export interface MeasurementHistoryProps {
  rows: readonly MeasurementRow[];
  unitSystem: UnitSystem;
  onOpenRecord: (recordId: string) => void;
  onDelete: (row: MeasurementRow) => void;
  testID?: string;
}

/**
 * One row per measurement, newest first.
 *
 * A row that came from a record opens that record — its value is edited there, never here. A row
 * added on this screen is deletable and says so. A row an undo took out of the profile keeps its
 * place in the history but is labelled, so a missing profile value is explainable (ADR-039).
 */
export function MeasurementHistory({
  rows,
  unitSystem,
  onOpenRecord,
  onDelete,
  testID,
}: MeasurementHistoryProps) {
  if (rows.length === 0) {
    return (
      <AppText variant="body" color="muted" testID={testID}>
        {strings.profile.historyEmpty}
      </AppText>
    );
  }

  return (
    <View style={styles.list} testID={testID}>
      {rows.map((row) => {
        const recordId = row.recordId;
        const source = recordId ? strings.profile.fromRecord : strings.profile.addedOnProfile;
        return (
          <AppListRow
            key={row.id}
            title={formatMeasurement(row.kind, row.v1, row.v2, unitSystem)}
            subtitle={row.profileExcluded ? `${source} · ${strings.profile.notCounted}` : source}
            meta={formatDisplayDate(row.measuredOn)}
            accessibilityHint={recordId ? strings.profile.openRecordHint : undefined}
            onPress={recordId ? () => onOpenRecord(recordId) : undefined}
            trailing={
              recordId ? null : (
                <AppButton
                  label={strings.common.delete}
                  variant="quiet"
                  onPress={() => onDelete(row)}
                  testID={`delete-measurement-${row.id}`}
                />
              )
            }
            testID={`measurement-${row.id}`}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
