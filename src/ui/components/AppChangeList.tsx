import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../ThemeProvider';
import { spacing } from '../tokens';
import { AppText } from './AppText';

export interface AppChangeRow {
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly testID?: string | undefined;
}

export interface AppChangeListProps {
  rows: readonly AppChangeRow[];
  testID?: string;
}

/**
 * "Old → new" rows, one per changed field.
 *
 * The arrow is a glyph rather than an icon: there is no icon font in this project (ADR-014), and a
 * glyph scales with the text at accessibility sizes. Values wrap instead of truncating, because a
 * cut-off "134/86 mm…" would be worse than two lines.
 */
export function AppChangeList({ rows, testID }: AppChangeListProps) {
  const { colors } = useAppTheme();

  return (
    <View testID={testID} style={styles.list}>
      {rows.map((row, index) => (
        <View
          key={row.testID ?? `row-${index}`}
          style={[
            styles.row,
            index > 0 ? { borderTopColor: colors.border } : null,
            index > 0 ? styles.divider : null,
          ]}
        >
          <AppText variant="caption" color="muted">
            {row.label}
          </AppText>
          <View style={styles.values}>
            <AppText
              variant="body"
              color="muted"
              style={styles.value}
              testID={row.testID ? `${row.testID}-from` : undefined}
            >
              {row.from}
            </AppText>
            <AppText variant="body" color="muted" style={styles.arrow}>
              {'→'}
            </AppText>
            <AppText
              variant="body"
              style={styles.value}
              testID={row.testID ? `${row.testID}-to` : undefined}
            >
              {row.to}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { gap: 2, paddingVertical: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  values: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.xs },
  value: { flexShrink: 1 },
  arrow: { paddingHorizontal: 2 },
});
