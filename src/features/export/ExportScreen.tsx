import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  DEFAULT_EXPORT_PREFERENCES,
  type ExportPreferences,
  getRepositories,
  requireRepositories,
} from '@/data';
import {
  type ExportColumnId,
  type ExportSortOrder,
  normalizeExportColumns,
  orientationFor,
  RECORD_KINDS,
  type RecordKind,
} from '@/domain';
import { todayIso } from '@/lib/dates';
import { userMessage } from '@/lib/errors';
import { useSession } from '@/lib/session';
import {
  AppBanner,
  AppButton,
  AppCard,
  AppChoiceGrid,
  AppDateField,
  AppScreen,
  AppSectionHeader,
  AppText,
  exportColumnLabel,
  recordKindLabel,
  spacing,
  strings,
} from '@/ui';

import { createExportDeps } from './exportDeps';
import {
  type ExportPeriod,
  isInvalidRange,
  periodBounds,
  periodFromStoredPreferences,
} from './exportFilters';
import { generateAndShareExport } from './exportService';

const PERIOD_OPTIONS: readonly { value: ExportPeriod; label: string }[] = [
  { value: 'all', label: strings.export.periodAll },
  { value: '30d', label: strings.export.period30 },
  { value: '6m', label: strings.export.period6Months },
  { value: 'custom', label: strings.export.periodCustom },
];

const KIND_OPTIONS = RECORD_KINDS.map((kind) => ({ value: kind, label: recordKindLabel(kind) }));

const COLUMN_OPTIONS = (
  [
    'date',
    'title',
    'type',
    'symptoms',
    'doctor',
    'condition',
    'readings',
    'medications',
    'vitals',
    'facility',
    'followUp',
    'comments',
    'attachments',
  ] as const
).map((id) => ({ value: id, label: exportColumnLabel(id) }));

const SORT_OPTIONS: readonly { value: ExportSortOrder; label: string }[] = [
  { value: 'newest', label: strings.export.sortNewest },
  { value: 'oldest', label: strings.export.sortOldest },
];

type Banner = { readonly tone: 'success' | 'warning' | 'danger'; readonly message: string };

/**
 * Reading the remembered choices must never be able to break the screen: a database that has just
 * failed to open gets the defaults, and the user can still see (and retry) the export screen.
 */
function readPreferences(): ExportPreferences {
  const repositories = getRepositories();
  if (!repositories.ok) return DEFAULT_EXPORT_PREFERENCES;
  try {
    return repositories.value.settings.getExportPreferences();
  } catch {
    return DEFAULT_EXPORT_PREFERENCES;
  }
}

/**
 * Export PDF (FR-10).
 *
 * Filters, columns and order all write through to settings, and the count comes from the same
 * repository predicate the PDF uses, so "42 records will be included" cannot disagree with the
 * table. The action is pinned to the bottom: the page is long (thirteen column choices), and the
 * button must not be something the user has to hunt for.
 */
export function ExportScreen() {
  const router = useRouter();
  const { personId: sessionPersonId } = useSession();

  const [initial] = useState(readPreferences);
  const [personId, setPersonId] = useState(sessionPersonId ?? '');
  const [period, setPeriod] = useState<ExportPeriod>(() =>
    periodFromStoredPreferences(initial.filter.from, initial.filter.to),
  );
  const [customFrom, setCustomFrom] = useState(initial.filter.from ?? todayIso());
  const [customTo, setCustomTo] = useState(initial.filter.to ?? todayIso());
  const [kinds, setKinds] = useState<RecordKind[]>([...initial.filter.kinds]);
  const [columns, setColumns] = useState<ExportColumnId[]>([...initial.columns]);
  const [sortOrder, setSortOrder] = useState<ExportSortOrder>(initial.sortOrder);
  const [generating, setGenerating] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const today = useMemo(() => todayIso(), []);
  const bounds = useMemo(
    () => periodBounds({ period, from: customFrom, to: customTo }),
    [period, customFrom, customTo],
  );
  const invalidRange = isInvalidRange(bounds.from, bounds.to);

  const people = useQuery({
    queryKey: ['people'],
    queryFn: () => requireRepositories().people.list(),
  });

  const count = useQuery({
    queryKey: ['export', 'count', personId, bounds.from ?? '', bounds.to ?? '', kinds],
    queryFn: () =>
      requireRepositories().records.count(personId, {
        from: bounds.from,
        to: bounds.to,
        kinds,
      }),
    placeholderData: (previous) => previous,
    enabled: personId !== '' && !invalidRange,
  });

  const total = invalidRange ? 0 : (count.data ?? 0);
  const orientation = orientationFor(columns.length);

  // Persist on every change: the preference is one small row, and a half-saved screen whose
  // columns reset on relaunch is precisely what the brief asks to avoid (ADR-050).
  useEffect(() => {
    const repositories = getRepositories();
    if (!repositories.ok) return;
    repositories.value.settings.saveExportPreferences({
      columns,
      sortOrder,
      filter: {
        from: bounds.from ?? null,
        to: bounds.to ?? null,
        kinds,
      },
    });
  }, [columns, sortOrder, bounds.from, bounds.to, kinds]);

  const toggleKind = (kind: RecordKind) => {
    setKinds((current) =>
      current.includes(kind) ? current.filter((entry) => entry !== kind) : [...current, kind],
    );
  };

  const toggleColumn = (column: ExportColumnId) => {
    setColumns((current) =>
      current.includes(column)
        ? // One column must survive: an export with no table is not an export.
          current.length === 1
          ? current
          : current.filter((entry) => entry !== column)
        : [...normalizeExportColumns([...current, column])],
    );
  };

  const handleGenerate = async () => {
    if (generating || total === 0 || invalidRange || personId === '') return;
    setGenerating(true);
    setBanner(null);
    try {
      const result = await generateAndShareExport(createExportDeps(), {
        personId,
        filter: { from: bounds.from, to: bounds.to, kinds },
        columns,
        sortOrder,
        today,
      });
      if (!result.ok) {
        setBanner({ tone: 'danger', message: userMessage(result.error) });
        return;
      }
      setBanner(
        result.value.shared
          ? { tone: 'success', message: strings.export.done(result.value.recordCount) }
          : { tone: 'warning', message: strings.export.shareUnavailable },
      );
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = total > 0 && !invalidRange && !generating;

  return (
    <AppScreen
      title={strings.export.title}
      onBack={() => router.back()}
      scroll={false}
      safeAreaBottom
      testID="screen-export"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="export-scroll"
      >
        <AppText variant="body" color="muted">
          {strings.export.intro}
        </AppText>

        {people.data && people.data.length > 1 ? (
          <View style={styles.section}>
            <AppSectionHeader title={strings.export.person} />
            <AppChoiceGrid
              options={people.data.map((person) => ({ value: person.id, label: person.name }))}
              selected={personId}
              onSelect={setPersonId}
              columns={2}
              testIDPrefix="export-person"
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <AppSectionHeader title={strings.export.period} />
          <AppChoiceGrid
            options={PERIOD_OPTIONS}
            selected={period}
            onSelect={setPeriod}
            columns={2}
            testIDPrefix="export-period"
          />
          {period === 'custom' ? (
            <View style={styles.dates}>
              <AppDateField
                label={strings.export.from}
                value={customFrom}
                onChange={setCustomFrom}
                testID="export-from"
              />
              <AppDateField
                label={strings.export.to}
                value={customTo}
                onChange={setCustomTo}
                testID="export-to"
              />
            </View>
          ) : null}
          {invalidRange ? (
            <AppBanner
              tone="danger"
              message={strings.export.invalidRange}
              testID="export-invalid-range"
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <AppSectionHeader
            title={strings.export.types}
            actionLabel={kinds.length > 0 ? strings.common.clear : undefined}
            onAction={() => setKinds([])}
          />
          <AppChoiceGrid
            options={KIND_OPTIONS}
            selected={kinds}
            onSelect={toggleKind}
            columns={3}
            testIDPrefix="export-kind"
          />
          <AppText variant="caption" color="muted">
            {kinds.length === 0
              ? strings.export.allTypes
              : strings.export.typesSelected(kinds.length)}
          </AppText>
        </View>

        <View style={styles.section}>
          <AppSectionHeader title={strings.export.columns} />
          <AppText variant="caption" color="muted">
            {strings.export.columnsHint}
          </AppText>
          <AppChoiceGrid
            options={COLUMN_OPTIONS}
            selected={columns}
            onSelect={toggleColumn}
            columns={2}
            testIDPrefix="export-column"
          />
          <AppText variant="caption" color="muted" testID="export-orientation">
            {orientation === 'landscape'
              ? strings.export.landscapeNote
              : strings.export.portraitNote}
          </AppText>
        </View>

        <View style={styles.section}>
          <AppSectionHeader title={strings.export.sort} />
          <AppChoiceGrid
            options={SORT_OPTIONS}
            selected={sortOrder}
            onSelect={setSortOrder}
            columns={2}
            testIDPrefix="export-sort"
          />
        </View>

        {banner ? (
          <AppBanner tone={banner.tone} message={banner.message} testID="export-banner" />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <AppCard variant="quiet" testID="export-summary">
          <AppText variant="label" testID="export-count">
            {strings.export.count(total)}
          </AppText>
          {total === 0 && !invalidRange ? (
            <AppText variant="body" color="muted" testID="export-no-matches">
              {strings.export.noMatches}
            </AppText>
          ) : null}
        </AppCard>
        <AppButton
          label={strings.export.generate}
          onPress={() => {
            void handleGenerate();
          }}
          disabled={!canGenerate}
          loading={generating}
          fullWidth
          testID="export-generate"
        />
        {generating ? (
          <AppText variant="caption" color="muted" testID="export-generating">
            {strings.export.generatingHint}
          </AppText>
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xl },
  section: { gap: spacing.sm },
  dates: { gap: spacing.sm },
  footer: { gap: spacing.sm, paddingTop: spacing.sm },
});
