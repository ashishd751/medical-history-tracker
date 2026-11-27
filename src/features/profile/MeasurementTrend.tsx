import { StyleSheet, View } from 'react-native';

import { AppText, spacing, useAppTheme } from '@/ui';

export interface MeasurementTrendPoint {
  /** The stored metric value: centimetres, kilograms, systolic pressure, and so on. */
  readonly value: number;
  /** Read by a screen reader and used as the list key. */
  readonly label: string;
}

export interface MeasurementTrendProps {
  /** Oldest first, as the history is newest first. */
  readonly points: readonly MeasurementTrendPoint[];
  caption: string;
  testID?: string;
}

const MIN_BAR = 6;
const MAX_BAR = 44;

/**
 * A trend from plain Views: one bar per value, height relative to the other values shown.
 *
 * No charting dependency (section 4.3 of the phase brief). The bars are decorative emphasis, not
 * the information: every value they stand for is in the history list right below, with its date
 * and its source, so nothing is only in the chart.
 */
export function MeasurementTrend({ points, caption, testID }: MeasurementTrendProps) {
  const { colors } = useAppTheme();
  if (points.length < 2) return null;

  const values = points.map((point) => point.value);
  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const span = highest - lowest;

  return (
    <View testID={testID} style={styles.root}>
      <View style={styles.bars}>
        {points.map((point, index) => {
          const ratio = span === 0 ? 0.5 : (point.value - lowest) / span;
          const height = MIN_BAR + ratio * (MAX_BAR - MIN_BAR);
          return (
            <View
              key={`${point.label}-${index}`}
              style={styles.slot}
              accessible
              accessibilityLabel={point.label}
            >
              <View
                style={[styles.bar, { height, backgroundColor: colors.primary }]}
                testID={testID ? `${testID}-bar-${index}` : undefined}
              />
            </View>
          );
        })}
      </View>
      <AppText variant="caption" color="muted">
        {caption}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    // Leave room for the tallest bar so the row does not jump between kinds.
    minHeight: MAX_BAR,
  },
  slot: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-end' },
  bar: { borderRadius: 2 },
});
