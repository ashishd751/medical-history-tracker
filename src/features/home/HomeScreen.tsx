import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

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
  AppText,
  recordKindLabel,
  spacing,
  strings,
} from '@/ui';

import { SnapshotCard } from './SnapshotCard';

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

  if (!personId) {
    return (
      <AppScreen title={strings.app.name}>
        <AppEmptyState title={strings.common.loading} />
      </AppScreen>
    );
  }

  const snapshot = profile.data ?? null;
  const medications = snapshot?.medications ?? [];

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

      <AppSectionHeader title={strings.home.currentMedications} />
      {medications.length > 0 ? (
        <View style={styles.chips} testID="current-medications">
          {medications.map((medication) => (
            <AppChip key={medication.id} label={medication.name} />
          ))}
        </View>
      ) : (
        <AppText variant="body" color="muted">
          {strings.home.noMedications}
        </AppText>
      )}

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
          disabled
          onPress={() => undefined}
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
  list: { gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
