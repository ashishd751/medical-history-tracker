import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { type MeasurementRow, requireRepositories } from '@/data';
import {
  BLOOD_TYPES,
  type BloodType,
  MEASUREMENT_KINDS,
  type MeasurementKind,
  requiresBloodTypeConfirmation,
} from '@/domain';
import { formatDisplayDate, isValidIsoDate, todayIso } from '@/lib/dates';
import { useSession } from '@/lib/session';
import {
  AppBadge,
  AppBanner,
  AppBloodTypeDialog,
  AppButton,
  AppCard,
  AppChoiceGrid,
  AppDateField,
  AppDialog,
  AppEmptyState,
  type AppFact,
  AppFactGrid,
  AppField,
  AppScreen,
  AppSectionHeader,
  AppSheet,
  AppText,
  bloodTypeLabel,
  bmiCategoryLabel,
  formatBmi,
  formatHeight,
  formatMeasurement,
  formatWeight,
  measurementKindLabel,
  sexLabel,
  spacing,
  strings,
  useAppTheme,
} from '@/ui';

import { AddMeasurementSheet } from './AddMeasurementSheet';
import { MeasurementHistory } from './MeasurementHistory';
import { type MeasurementSubmission } from './measurementInput';
import { MeasurementTrend } from './MeasurementTrend';

/** How many rows of one kind the history shows: enough to see a trend, not a scroll marathon. */
const HISTORY_LIMIT = 20;

/**
 * The profile: the facts stored on the person row, the derived snapshot and the measurement
 * history.
 *
 * Height, weight, BMI and current medication come from the same `profile.snapshot` query Home uses,
 * so the two screens cannot disagree (ADR-038). A blood type that is already recorded is never
 * replaced without confirmation (ADR-044), and a measurement that came from a record is edited
 * there rather than here (ADR-045).
 */
export function ProfileScreen() {
  const { personId, unitSystem, bmiPreset, refresh } = useSession();
  const { colors } = useAppTheme();
  const router = useRouter();
  const id = personId ?? '';

  // Read once: a query key that changes as the clock ticks would refetch for no reason.
  const today = useMemo(() => todayIso(), []);

  const person = useQuery({
    queryKey: ['person', id],
    queryFn: () => requireRepositories().people.getById(id),
    enabled: id !== '',
  });
  const profile = useQuery({
    queryKey: ['profile', id, today, bmiPreset],
    queryFn: () => requireRepositories().profile.snapshot(id, { today, bmiPreset }),
    enabled: id !== '',
  });
  const [historyKind, setHistoryKind] = useState<MeasurementKind>('weight');
  const history = useQuery({
    queryKey: ['measurements', id, historyKind, HISTORY_LIMIT],
    queryFn: () => requireRepositories().measurements.listByKind(id, historyKind, HISTORY_LIMIT),
    enabled: id !== '',
  });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [bloodType, setBloodType] = useState<BloodType | null>(null);
  const [allergies, setAllergies] = useState('');
  const [chronic, setChronic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  /** Set while a change to an already-recorded blood type waits for confirmation. */
  const [bloodTypePending, setBloodTypePending] = useState<{ next: BloodType | null } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MeasurementRow | null>(null);

  const record = person.data;

  const openEditor = () => {
    if (!record) return;
    setName(record.name);
    setDob(record.dob);
    setBloodType(record.bloodType);
    setAllergies(record.allergies ?? '');
    setChronic(record.chronicConditions ?? '');
    setError(null);
    setEditing(true);
  };

  const chooseBloodType = (type: BloodType) => {
    if (!record) return;
    const next = bloodType === type ? null : type;
    // The comparison is against the *stored* value: that is what is recorded, and a draft edit
    // has not been saved yet (ADR-044).
    if (requiresBloodTypeConfirmation(record.bloodType, next)) {
      // A Paper dialog renders into the app's window, which this sheet's own Modal covers, so the
      // question would be invisible underneath it. Ask with the sheet out of the way, then reopen
      // it — every other field in the draft is screen state and survives (ADR-046).
      setEditing(false);
      setBloodTypePending({ next });
      return;
    }
    setBloodType(next);
  };

  const save = () => {
    if (!record) return;
    if (!name.trim() || !isValidIsoDate(dob)) {
      setError(strings.onboarding.required);
      return;
    }
    const result = requireRepositories().people.update(record.id, {
      name: name.trim(),
      dob,
      bloodType,
      allergies: allergies.trim() || null,
      chronicConditions: chronic.trim() || null,
    });
    if (!result.ok) {
      setError(strings.errors.db);
      return;
    }
    setEditing(false);
    setBanner(strings.profile.saved);
    refresh();
  };

  const addMeasurement = (submission: MeasurementSubmission) => {
    setAddOpen(false);
    const result = requireRepositories().measurements.create(id, submission);
    if (!result.ok) {
      setBanner(null);
      setError(strings.errors.db);
      return;
    }
    setError(null);
    setBanner(strings.profile.measurementSaved);
    refresh();
  };

  const deleteMeasurement = () => {
    if (!pendingDelete) return;
    // Only standalone rows reach here; a record's value is deleted with the record.
    const result = requireRepositories().measurements.remove(id, pendingDelete.id);
    setPendingDelete(null);
    if (!result.ok) {
      setError(strings.errors.db);
      return;
    }
    setError(null);
    setBanner(strings.profile.measurementDeleted);
    refresh();
  };

  if (!record) {
    return (
      <AppScreen title={strings.profile.title} testID="screen-profile">
        <AppEmptyState title={strings.common.loading} />
      </AppScreen>
    );
  }

  const snapshot = profile.data ?? null;
  const rows = history.data ?? [];

  // Six short facts in two columns use the whole card width; long free text goes full width below.
  const facts: AppFact[] = [
    { label: strings.profile.dob, value: formatDisplayDate(record.dob), testID: 'profile-dob' },
    { label: strings.profile.sex, value: sexLabel(record.sex), testID: 'profile-sex' },
    {
      label: strings.home.bloodType,
      value: bloodTypeLabel(snapshot?.bloodType ?? null),
      testID: 'profile-blood-type',
    },
    {
      label: strings.home.bmi,
      value: snapshot?.bmi === null || snapshot?.bmi === undefined ? '—' : formatBmi(snapshot.bmi),
      accessory:
        snapshot?.bmiCategory === null || snapshot?.bmiCategory === undefined ? undefined : (
          <AppBadge label={bmiCategoryLabel(snapshot.bmiCategory)} tone="info" />
        ),
      testID: 'profile-bmi',
    },
    {
      label: strings.home.height,
      value:
        snapshot?.heightCm === null || snapshot?.heightCm === undefined
          ? '—'
          : formatHeight(snapshot.heightCm, unitSystem),
      testID: 'profile-height',
    },
    {
      label: strings.home.weight,
      value:
        snapshot?.weightKg === null || snapshot?.weightKg === undefined
          ? '—'
          : formatWeight(snapshot.weightKg, unitSystem),
      testID: 'profile-weight',
    },
  ];

  const medicalFacts: AppFact[] = [
    {
      label: strings.profile.allergies,
      value: record.allergies ?? strings.common.none,
      testID: 'profile-allergies',
    },
    {
      label: strings.profile.chronicConditions,
      value: record.chronicConditions ?? strings.common.none,
      testID: 'profile-chronic-conditions',
    },
  ];

  // The trend reads oldest → newest, so it grows in the direction time does.
  const trendPoints = [...rows].reverse().map((row) => ({
    value: row.v1,
    label: `${formatDisplayDate(row.measuredOn)}: ${formatMeasurement(
      row.kind,
      row.v1,
      row.v2,
      unitSystem,
    )}`,
  }));

  return (
    <AppScreen title={record.name} eyebrow={strings.profile.title} testID="screen-profile">
      {banner ? <AppBanner tone="success" message={banner} testID="profile-banner" /> : null}
      {error && !editing ? (
        <AppBanner tone="danger" message={error} testID="profile-error" />
      ) : null}

      <AppCard>
        <AppFactGrid facts={facts} columns={2} />
        <View style={[styles.divider, { borderTopColor: colors.border }]} />
        <AppFactGrid facts={medicalFacts} columns={1} />
      </AppCard>

      {/* In the body rather than the header: the header's top-right corner is where the dev client
          draws its floating menu button, and tapping Edit there opened the dev menu instead
          (ADR-046). RecordDetailScreen made the same move in Phase 2. */}
      <AppButton
        label={strings.profile.editProfile}
        variant="secondary"
        onPress={openEditor}
        fullWidth
        testID="edit-profile"
      />

      <AppText variant="caption" color="muted">
        {strings.profile.historyHint}
      </AppText>
      <AppText variant="caption" color="muted">
        {strings.app.disclaimer}
      </AppText>

      <AppSectionHeader
        title={strings.profile.measurementHistory}
        actionLabel={strings.profile.addMeasurement}
        onAction={() => setAddOpen(true)}
        testID="measurement-history-header"
      />
      <AppChoiceGrid
        options={MEASUREMENT_KINDS.map((kind) => ({
          value: kind,
          label: strings.profile.historyKinds[kind],
        }))}
        selected={historyKind}
        onSelect={setHistoryKind}
        columns={4}
        testIDPrefix="history-kind"
      />
      <MeasurementTrend
        points={trendPoints}
        caption={`${strings.profile.trend} · ${measurementKindLabel(historyKind)}`}
        testID="measurement-trend"
      />
      <MeasurementHistory
        rows={rows}
        unitSystem={unitSystem}
        onOpenRecord={(recordId) => router.push(`/record/${recordId}`)}
        onDelete={setPendingDelete}
        testID="measurement-history"
      />

      <AppSheet
        visible={editing}
        onDismiss={() => setEditing(false)}
        title={strings.profile.editProfile}
        testID="edit-profile-sheet"
      >
        <View style={styles.sheet}>
          {error ? <AppBanner tone="danger" message={error} /> : null}
          <AppField label={strings.onboarding.name} value={name} onChangeText={setName} />
          <AppDateField label={strings.onboarding.dob} value={dob} onChange={setDob} />
          <AppText variant="caption" color="muted">
            {strings.home.bloodType}
          </AppText>
          <AppChoiceGrid
            options={BLOOD_TYPES.map((type) => ({ value: type, label: type }))}
            selected={bloodType}
            onSelect={chooseBloodType}
            columns={4}
            testIDPrefix="blood-type"
          />
          <AppField
            label={strings.profile.allergies}
            value={allergies}
            onChangeText={setAllergies}
          />
          <AppField
            label={strings.profile.chronicConditions}
            value={chronic}
            onChangeText={setChronic}
          />
          <AppButton label={strings.common.save} onPress={save} fullWidth testID="save-profile" />
        </View>
      </AppSheet>

      {/* Mounted only while open, so every visit starts a fresh draft without an effect. */}
      {addOpen ? (
        <AddMeasurementSheet
          unitSystem={unitSystem}
          initialKind={historyKind}
          onDismiss={() => setAddOpen(false)}
          onSubmit={addMeasurement}
          testID="add-measurement-sheet"
        />
      ) : null}

      <AppDialog
        visible={pendingDelete !== null}
        title={strings.profile.deleteMeasurementTitle}
        message={strings.profile.deleteMeasurementBody}
        confirmLabel={strings.profile.deleteMeasurementConfirm}
        cancelLabel={strings.common.cancel}
        destructive
        onConfirm={deleteMeasurement}
        onCancel={() => setPendingDelete(null)}
        testID="delete-measurement-dialog"
      />

      <AppBloodTypeDialog
        visible={bloodTypePending !== null}
        previous={record.bloodType}
        next={bloodTypePending?.next ?? null}
        onConfirm={() => {
          setBloodType(bloodTypePending?.next ?? null);
          setBloodTypePending(null);
          setEditing(true);
        }}
        onCancel={() => {
          setBloodTypePending(null);
          setEditing(true);
        }}
        testID="blood-type-dialog"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  sheet: { gap: spacing.sm },
});
