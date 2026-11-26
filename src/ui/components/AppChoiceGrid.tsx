import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '../ThemeProvider';
import { minTouchTarget, radius, spacing } from '../tokens';
import { AppText } from './AppText';

export interface ChoiceOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface AppChoiceGridProps<T extends string> {
  options: readonly ChoiceOption<T>[];
  /** One value, several values (multi-select), or nothing selected. */
  selected: T | readonly T[] | null;
  onSelect: (value: T) => void;
  columns?: 2 | 3 | 4;
  testIDPrefix?: string;
}

/**
 * Evenly sized choice pills, filling the row.
 *
 * Paper's Chip sizes itself to its label, which leaves ragged gaps and a cramped look once a
 * screen has six options. This grid gives every option the same width, so rows line up and the
 * whole width is used (the Phase 1 review asked for exactly that). Selection is shown by colour
 * only — there is no icon font (ADR-014).
 */
export function AppChoiceGrid<T extends string>({
  options,
  selected,
  onSelect,
  columns = 3,
  testIDPrefix,
}: AppChoiceGridProps<T>) {
  const { colors } = useAppTheme();
  const width: `${number}%` = `${100 / columns}%`;

  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const isSelected = Array.isArray(selected)
          ? (selected as readonly T[]).includes(option.value)
          : selected === option.value;

        return (
          <View key={option.value} style={[styles.cell, { width }]}>
            <Pressable
              testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}
              onPress={() => {
                Keyboard.dismiss();
                onSelect(option.value);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={option.label}
              style={[
                styles.pill,
                {
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? colors.primary : 'transparent',
                },
              ]}
            >
              <AppText
                variant="label"
                align="center"
                numberOfLines={1}
                style={{ color: isSelected ? colors.onPrimary : colors.text }}
              >
                {option.label}
              </AppText>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  cell: { padding: spacing.xs },
  pill: {
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
