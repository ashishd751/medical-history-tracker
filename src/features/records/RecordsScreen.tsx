import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requireRepositories } from '@/data';
import { RECORD_KINDS, type RecordKind } from '@/domain';
import { formatDisplayDate, todayIso, toIsoDate } from '@/lib/dates';
import { useSession } from '@/lib/session';
import {
  AppBadge,
  AppChip,
  AppEmptyState,
  AppField,
  AppListRow,
  AppScreen,
  AppText,
  recordKindLabel,
  spacing,
  strings,
} from '@/ui';

import { groupByMonth } from './grouping';

type RangeKey = 'all' | 'month' | '3months' | 'year';

const RANGES: readonly { key: RangeKey; label: string }[] = [
  { key: 'all', label: strings.records.rangeAll },
  { key: 'month', label: strings.records.rangeMonth },
  { key: '3months', label: strings.records.range3Months },
  { key: 'year', label: strings.records.rangeYear },
];

/** Inclusive bounds for a preset range, computed on the device's local calendar. */
export function rangeBounds(
  range: RangeKey,
  now: Date = new Date(),
): { from?: string; to?: string } {
  if (range === 'all') return {};
  if (range === 'month') {
    return {
      from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: todayIso(now),
    };
  }
  if (range === '3months') {
    return {
      from: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())),
      to: todayIso(now),
    };
  }
  return { from: toIsoDate(new Date(now.getFullYear(), 0, 1)), to: todayIso(now) };
}

/** Month-grouped timeline with literal substring search and type/period filters. */
export function RecordsScreen() {
  const { personId } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [kinds, setKinds] = useState<RecordKind[]>([]);
  const [range, setRange] = useState<RangeKey>('all');
  const id = personId ?? '';

  const bounds = useMemo(() => rangeBounds(range), [range]);

  const records = useQuery({
    queryKey: ['records', id, 'list', search, kinds, range],
    queryFn: () =>
      requireRepositories().records.listSummaries(id, {
        search,
        kinds,
        ...(bounds.from ? { from: bounds.from } : {}),
        ...(bounds.to ? { to: bounds.to } : {}),
      }),
    enabled: id !== '',
  });

  const groups = useMemo(() => groupByMonth(records.data ?? []), [records.data]);

  const toggleKind = (kind: RecordKind) => {
    setKinds((current) =>
      current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind],
    );
  };

  return (
    <AppScreen title={strings.records.title} testID="screen-records">
      <AppField
        label={strings.common.search}
        value={search}
        onChangeText={setSearch}
        placeholder={strings.records.searchPlaceholder}
        testID="records-search"
        autoCapitalize="none"
        returnKeyType="search"
      />

      <View style={styles.filters}>
        <AppText variant="caption" color="muted">
          {strings.records.filterType}
        </AppText>
        <View style={styles.chips}>
          {RECORD_KINDS.map((kind) => (
            <AppChip
              key={kind}
              label={recordKindLabel(kind)}
              selected={kinds.includes(kind)}
              onPress={() => toggleKind(kind)}
              testID={`filter-kind-${kind}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.filters}>
        <AppText variant="caption" color="muted">
          {strings.records.filterRange}
        </AppText>
        <View style={styles.chips}>
          {RANGES.map((option) => (
            <AppChip
              key={option.key}
              label={option.label}
              selected={range === option.key}
              onPress={() => setRange(option.key)}
              testID={`filter-range-${option.key}`}
            />
          ))}
        </View>
      </View>

      {records.data ? (
        <AppText variant="caption" color="muted" testID="records-count">
          {strings.records.resultCount(records.data.length)}
        </AppText>
      ) : null}

      {groups.length === 0 ? (
        <AppEmptyState
          title={kinds.length === 0 && !search ? strings.records.emptyAll : strings.records.empty}
          testID="records-empty"
        />
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <AppText variant="subtitle" accessibilityRole="header">
              {group.label}
            </AppText>
            {group.rows.map((record) => (
              <AppListRow
                key={record.id}
                badge={<AppBadge label={recordKindLabel(record.kind)} tone="primary" />}
                title={record.title}
                subtitle={record.condition || undefined}
                meta={formatDisplayDate(record.date)}
                onPress={() => router.push(`/record/${record.id}`)}
                testID={`record-row-${record.id}`}
              />
            ))}
          </View>
        ))
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  group: { gap: spacing.sm },
});
