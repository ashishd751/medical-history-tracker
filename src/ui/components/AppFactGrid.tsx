import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { spacing } from '../tokens';
import { AppText } from './AppText';

export interface AppFact {
  /** Caption above the value. Also the React key, so labels must be unique in one grid. */
  readonly label: string;
  readonly value: string;
  /** Rendered next to the value, for example a BMI category badge. */
  readonly accessory?: ReactNode;
  readonly testID?: string;
}

export interface AppFactGridProps {
  facts: readonly AppFact[];
  /** One column for long text (allergies), two on a phone, three on a wide screen. */
  columns?: 1 | 2 | 3;
}

/**
 * Label-over-value fact tiles, filling the row.
 *
 * The Profile page used to stack eight rows in one narrow column, leaving the right half of the
 * card empty (the Phase 1 review asked for the full width to be used). Every tile takes an equal
 * share of the row, so two columns line up on a phone and three on a tablet, and the Medical card
 * on Home and the Profile page now share one visual language instead of two copies of the same
 * styles.
 */
export function AppFactGrid({ facts, columns = 2 }: AppFactGridProps) {
  // At very large OS text sizes a two-column tile is too narrow for a date or a unit: the date
  // wrapped mid-string on the iOS simulator at accessibility XL. Collapse to one column instead,
  // so every value stays whole and the page simply gets taller (tested on device).
  const { fontScale } = useWindowDimensions();
  const effectiveColumns = fontScale >= 1.5 ? 1 : columns;
  const width: `${number}%` = `${100 / effectiveColumns}%`;

  return (
    <View style={styles.grid}>
      {facts.map((fact) => (
        <View key={fact.label} testID={fact.testID} style={[styles.cell, { width }]}>
          <AppText variant="caption" color="muted">
            {fact.label}
          </AppText>
          <View style={styles.valueRow}>
            <AppText variant="subtitle" style={styles.value}>
              {fact.value}
            </AppText>
            {fact.accessory ?? null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  cell: { paddingHorizontal: spacing.xs, paddingVertical: spacing.sm, gap: 2 },
  valueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  value: { flexShrink: 1 },
});
