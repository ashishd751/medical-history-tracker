import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { requireRepositories } from '@/data';
import { formatDisplayDate, todayIso } from '@/lib/dates';
import { useSession } from '@/lib/session';
import {
  AppBadge,
  AppButton,
  AppChip,
  AppEmptyState,
  AppListRow,
  AppScreen,
  AppSectionHeader,
  AppSheet,
  AppText,
  recordKindLabel,
  spacing,
  strings,
} from '@/ui';

import { SnapshotCard } from './SnapshotCard';

/**
 * How many medication chips Home shows before it stops.
 *
 * A family member can be on a dozen medications, and one chip per drug pushed Recent records off the
 * screen entirely (each chip is a full-height pill). Two rows are enough to recognise what is being
 * taken; the section header's "View all" opens the rest in a sheet, so the page length no longer
 * depends on how many medications exist.
 */
const VISIBLE_MEDICATIONS = 4;

/** Two rows can share a name (a dose change is a new row); a chip only shows the name. */
function uniqueMedicationNames(names: readonly string[]): string[] {
  return [...new Set(names)];
}

/** Home: the health snapshot, current medication and the most recent records. */
export function HomeScreen() {
  const { personId, personName, unitSystem, bmiPreset, refresh } = useSession();
  const router = useRouter();
  const id = personId ?? '';
  const today = useMemo(() => todayIso(), []);

  const people = useQuery({
    queryKey: ['people'],
    queryFn: () => requireRepositories().people.list(),
  });
  // One snapshot for the card and the medication chips: Home and Profile read the same query
  // shape, so they cannot disagree about the newest value (ADR-038).
  const profile = useQuery({
    queryKey: ['profile', id, today, bmiPreset],
    queryFn: () => requireRepositories().profile.snapshot(id, { today, bmiPreset }),
    enabled: id !== '',
  });
  const recent = useQuery({
    queryKey: ['records', id, 'recent'],
    queryFn: () => requireRepositories().records.recent(id, 4),
    enabled: id !== '',
  });

  const [showAllMedications, setShowAllMedications] = useState(false);

  if (!personId) {
    return (
      <AppScreen title={strings.app.name}>
        <AppEmptyState title={strings.common.loading} />
      </AppScreen>
    );
  }

  const snapshot = profile.data ?? null;
  const medicationNames = uniqueMedicationNames(
    (snapshot?.medications ?? []).map((medication) => medication.name),
  );
  const visibleMedications = medicationNames.slice(0, VISIBLE_MEDICATIONS);
  const hasMoreMedications = medicationNames.length > VISIBLE_MEDICATIONS;

  return (
    <AppScreen title={strings.home.greeting(personName)} testID="screen-home">
      <SnapshotCard
        heightCm={snapshot?.heightCm ?? null}
        weightKg={snapshot?.weightKg ?? null}
        bloodType={snapshot?.bloodType ?? null}
        lastBp={snapshot?.bloodPressure ?? null}
        unitSystem={unitSystem}
        bmiPreset={bmiPreset}
        testID="snapshot-card"
      />

      {people.data && people.data.length > 1 ? (
        <View style={styles.chips}>
          {people.data.map((person) => (
            <AppChip
              key={person.id}
              label={person.name}
              selected={person.id === personId}
              onPress={() => {
                const result = requireRepositories().settings.updateSettings({
                  activePersonId: person.id,
                });
                if (result.ok) refresh();
              }}
            />
          ))}
        </View>
      ) : null}

      <AppSectionHeader
        title={strings.home.currentMedications}
        actionLabel={hasMoreMedications ? strings.home.viewAll : undefined}
        onAction={hasMoreMedications ? () => setShowAllMedications(true) : undefined}
        testID="current-medications-header"
      />
      {medicationNames.length > 0 ? (
        <View style={styles.chips} testID="current-medications">
          {visibleMedications.map((name) => (
            <AppChip key={name} label={name} />
          ))}
        </View>
      ) : (
        <AppText variant="body" color="muted">
          {strings.home.noMedications}
        </AppText>
      )}

      {/* The full list lives in a sheet with its own scroll, so a dozen medications cannot stretch
          Home and push Recent records off the screen. */}
      <AppSheet
        visible={showAllMedications}
        onDismiss={() => setShowAllMedications(false)}
        title={strings.home.currentMedications}
        testID="medications-sheet"
      >
        <ScrollView contentContainerStyle={styles.sheetList} testID="medications-sheet-list">
          {medicationNames.map((name) => (
            <AppChip key={name} label={name} />
          ))}
        </ScrollView>
        <AppButton
          label={strings.common.close}
          variant="secondary"
          onPress={() => setShowAllMedications(false)}
          fullWidth
          testID="close-medications"
        />
      </AppSheet>

      <AppSectionHeader
        title={strings.home.recentRecords}
        actionLabel={strings.home.viewAll}
        onAction={() => router.push('/(tabs)/records')}
      />
      {recent.data && recent.data.length > 0 ? (
        <View style={styles.list} testID="recent-records">
          {recent.data.map((record) => (
            <AppListRow
              key={record.id}
              badge={<AppBadge label={recordKindLabel(record.kind)} tone="primary" />}
              title={record.title}
              meta={formatDisplayDate(record.date)}
              onPress={() => router.push(`/record/${record.id}`)}
              testID={`record-row-${record.id}`}
            />
          ))}
        </View>
      ) : (
        <AppText variant="body" color="muted">
          {strings.home.noRecords}
        </AppText>
      )}

      <View style={styles.actions}>
        <AppButton
          label={strings.home.exportPdf}
          variant="secondary"
          onPress={() => router.push('/export')}
          testID="home-export"
        />
        <AppButton
          label={strings.home.backup}
          variant="secondary"
          disabled
          onPress={() => undefined}
        />
      </View>
      <AppText variant="caption" color="muted">
        {strings.app.disclaimer}
      </AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  /** A long medication list scrolls inside the sheet instead of growing the screen. */
  sheetList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.sm },
  list: { gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
