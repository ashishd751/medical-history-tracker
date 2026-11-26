import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { requireRepositories } from '@/data';
import { RECORD_KINDS, type RecordKind } from '@/domain';
import { formatDisplayDate, todayIso, toIsoDate } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import {
  AppBadge,
  AppButton,
  AppChip,
  AppChoiceGrid,
  AppEmptyState,
  AppField,
  AppListRow,
  AppScreen,
  AppSheet,
  AppText,
  recordKindLabel,
  spacing,
  strings,
} from '@/ui';

import { buildTimeline, type TimelineItem } from './grouping';

/** Records per page. Small enough to feel instant, large enough to fill a screen. */
const PAGE_SIZE = 25;

type PeriodKey = 'all' | 'month' | '3months' | 'year';

const PERIODS: readonly { readonly value: PeriodKey; readonly label: string }[] = [
  { value: 'all', label: strings.records.rangeAll },
  { value: 'month', label: strings.records.rangeMonth },
  { value: '3months', label: strings.records.range3Months },
  { value: 'year', label: strings.records.rangeYear },
];

const KIND_OPTIONS = RECORD_KINDS.map((kind) => ({ value: kind, label: recordKindLabel(kind) }));

/** Inclusive bounds for a preset period, computed on the device's local calendar. */
function rangeBounds(period: PeriodKey, now: Date = new Date()): { from?: string; to?: string } {
  if (period === 'all') return {};
  if (period === 'month') {
    return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: todayIso(now) };
  }
  if (period === '3months') {
    return {
      from: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())),
      to: todayIso(now),
    };
  }
  return { from: toIsoDate(new Date(now.getFullYear(), 0, 1)), to: todayIso(now) };
}

/**
 * Month-grouped timeline with search and filters.
 *
 * Two things came out of the Phase 1 review: the filters used to eat half the screen, and the
 * list was not virtualised. The filters now live in the list header — so they scroll away as soon
 * as the user starts reading — and collapse to two chips that open sheets. The list pages 25
 * records at a time (ADR-024) and search runs through the FTS index (ADR-023).
 */
export function RecordsScreen() {
  const { personId } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [kinds, setKinds] = useState<RecordKind[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [sheet, setSheet] = useState<'closed' | 'type' | 'period'>('closed');
  const id = personId ?? '';

  // Typing waits 250 ms before it becomes a query; clearing the box applies immediately so the
  // Clear filters button never feels stuck.
  const debouncedSearch = useDebouncedValue(search, 250);
  const effectiveSearch = search.trim() === '' ? '' : debouncedSearch;

  const bounds = useMemo(() => rangeBounds(period), [period]);

  const records = useInfiniteQuery({
    queryKey: ['records', id, 'pages', effectiveSearch, kinds, period],
    queryFn: ({ pageParam }) =>
      requireRepositories().records.listPage(
        id,
        { search: effectiveSearch, kinds, ...bounds },
        PAGE_SIZE,
        pageParam,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length * PAGE_SIZE : undefined,
    enabled: id !== '',
  });

  const rows = useMemo(
    () => records.data?.pages.flatMap((page) => page.items) ?? [],
    [records.data],
  );
  const items = useMemo(() => buildTimeline(rows), [rows]);

  // The header reports every match, not just the rows loaded so far: a "25 records" label on a
  // 200-record result would be a lie (ADR-024). The query reuses the list's own predicate.
  const total = useQuery({
    queryKey: ['records', id, 'count', effectiveSearch, kinds, period],
    queryFn: () =>
      requireRepositories().records.count(id, { search: effectiveSearch, kinds, ...bounds }),
    // Keep the previous number on screen while the next one loads, instead of flickering.
    placeholderData: (previous) => previous,
    enabled: id !== '',
  });

  const toggleKind = (kind: RecordKind) => {
    setKinds((current) =>
      current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind],
    );
  };

  const clearFilters = () => {
    setSearch('');
    setKinds([]);
    setPeriod('all');
  };

  const hasFilters = search.trim().length > 0 || kinds.length > 0 || period !== 'all';
  const typeLabel =
    kinds.length === 0 ? strings.records.allTypes : kinds.map(recordKindLabel).join(', ');
  const periodLabel =
    PERIODS.find((option) => option.value === period)?.label ?? strings.records.rangeAll;

  const header = (
    <View style={styles.header}>
      <AppField
        label={strings.common.search}
        value={search}
        onChangeText={setSearch}
        placeholder={strings.records.searchPlaceholder}
        testID="records-search"
        autoCapitalize="none"
        returnKeyType="search"
      />

      <View style={styles.filterRow}>
        <AppChip
          label={strings.records.typeChip(typeLabel)}
          selected={kinds.length > 0}
          onPress={() => setSheet('type')}
          testID="open-type-filter"
        />
        <AppChip
          label={strings.records.periodChip(periodLabel)}
          selected={period !== 'all'}
          onPress={() => setSheet('period')}
          testID="open-period-filter"
        />
        {hasFilters ? (
          <AppChip
            label={strings.records.clearFilters}
            onPress={clearFilters}
            testID="clear-filters"
          />
        ) : null}
      </View>

      <View style={styles.countRow}>
        <AppText variant="caption" color="muted" testID="records-count">
          {total.data !== undefined
            ? strings.records.resultCount(total.data)
            : strings.common.loading}
        </AppText>
      </View>
    </View>
  );

  const empty = records.isFetched ? (
    <AppEmptyState
      title={hasFilters ? strings.records.empty : strings.records.emptyAll}
      testID="records-empty"
    />
  ) : null;

  return (
    <AppScreen title={strings.records.title} scroll={false} testID="screen-records">
      <FlatList
        testID="records-list"
        data={items}
        keyExtractor={(item: TimelineItem) =>
          item.type === 'month' ? `month-${item.key}` : item.row.id
        }
        renderItem={({ item }) =>
          item.type === 'month' ? (
            <AppText variant="subtitle" accessibilityRole="header" style={styles.month}>
              {item.label}
            </AppText>
          ) : (
            <AppListRow
              badge={<AppBadge label={recordKindLabel(item.row.kind)} tone="primary" />}
              title={item.row.title}
              subtitle={item.row.condition || undefined}
              meta={formatDisplayDate(item.row.date)}
              onPress={() => router.push(`/record/${item.row.id}`)}
              testID={`record-row-${item.row.id}`}
            />
          )
        }
        ListHeaderComponent={header}
        ListEmptyComponent={empty ?? undefined}
        ListFooterComponent={
          records.isFetchingNextPage ? (
            <AppText variant="caption" color="muted" align="center">
              {strings.records.loadingMore}
            </AppText>
          ) : undefined
        }
        onEndReached={() => {
          if (records.hasNextPage && !records.isFetchingNextPage) void records.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
      />

      <AppSheet
        visible={sheet === 'type'}
        onDismiss={() => setSheet('closed')}
        title={strings.records.filterType}
        testID="type-filter-sheet"
      >
        <AppChoiceGrid
          options={KIND_OPTIONS}
          selected={kinds}
          onSelect={toggleKind}
          columns={3}
          testIDPrefix="filter-kind"
        />
        <AppButton
          label={strings.common.done}
          onPress={() => setSheet('closed')}
          fullWidth
          testID="apply-type-filter"
        />
      </AppSheet>

      <AppSheet
        visible={sheet === 'period'}
        onDismiss={() => setSheet('closed')}
        title={strings.records.filterRange}
        testID="period-filter-sheet"
      >
        <AppChoiceGrid
          options={PERIODS}
          selected={period}
          onSelect={(value) => {
            setPeriod(value);
            setSheet('closed');
          }}
          columns={2}
          testIDPrefix="filter-range"
        />
      </AppSheet>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.xxl },
  header: { gap: spacing.sm, paddingBottom: spacing.sm },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  countRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  month: { marginTop: spacing.sm },
});
