import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requireRepositories } from '@/data';
import {
  BLOOD_TYPES,
  type BloodType,
  bmiCategory,
  computeBmi,
  requiresBloodTypeConfirmation,
} from '@/domain';
import { formatDisplayDate, isValidIsoDate } from '@/lib/dates';
import { useSession } from '@/lib/session';
import {
  AppBadge,
  AppBanner,
  AppBloodTypeDialog,
  AppButton,
  AppCard,
  AppChoiceGrid,
  AppDateField,
  AppEmptyState,
  type AppFact,
  AppFactGrid,
  AppField,
  AppScreen,
  AppSheet,
  AppText,
  bloodTypeLabel,
  bmiCategoryLabel,
  formatBmi,
  formatHeight,
  formatWeight,
  sexLabel,
  spacing,
  strings,
  useAppTheme,
} from '@/ui';

/**
 * Read-only profile with an inline edit sheet. Measurement history and profile sync are
 * Phase 3; this shows the derived snapshot and the facts stored on the person row.
 */
export function ProfileScreen() {
  const { personId, unitSystem, bmiPreset, refresh } = useSession();
  const { colors } = useAppTheme();
  const id = personId ?? '';

  const person = useQuery({
    queryKey: ['person', id],
    queryFn: () => requireRepositories().people.getById(id),
    enabled: id !== '',
  });
  const vitals = useQuery({
    queryKey: ['vitals', id],
    queryFn: () => requireRepositories().measurements.latestVitals(id),
    enabled: id !== '',
  });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [bloodType, setBloodType] = useState<BloodType | null>(null);
  const [allergies, setAllergies] = useState('');
  const [chronic, setChronic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /** Set while a change to an already-recorded blood type waits for confirmation. */
  const [bloodTypePending, setBloodTypePending] = useState<{ next: BloodType | null } | null>(null);

  const record = person.data;

  const chooseBloodType = (type: BloodType) => {
    if (!record) return;
    const next = bloodType === type ? null : type;
    // The comparison is against the *stored* value: that is what is recorded, and a draft edit
    // has not been saved yet (ADR-044).
    if (requiresBloodTypeConfirmation(record.bloodType, next)) {
      setBloodTypePending({ next });
      return;
    }
    setBloodType(next);
  };

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
    setSaved(true);
    refresh();
  };

  if (!record) {
    return (
      <AppScreen title={strings.profile.title} testID="screen-profile">
        <AppEmptyState title={strings.common.loading} />
      </AppScreen>
    );
  }

  const height = vitals.data?.height;
  const weight = vitals.data?.weight;
  const bmi = height && weight ? computeBmi(height.v1, weight.v1) : null;

  // Six short facts in two columns use the whole card width; long free text goes full width below.
  const facts: AppFact[] = [
    { label: strings.profile.dob, value: formatDisplayDate(record.dob), testID: 'profile-dob' },
    { label: strings.profile.sex, value: sexLabel(record.sex), testID: 'profile-sex' },
    {
      label: strings.home.bloodType,
      value: bloodTypeLabel(record.bloodType),
      testID: 'profile-blood-type',
    },
    {
      label: strings.home.bmi,
      value: bmi !== null ? formatBmi(bmi) : '—',
      accessory:
        bmi !== null ? (
          <AppBadge label={bmiCategoryLabel(bmiCategory(bmi, bmiPreset))} tone="info" />
        ) : undefined,
      testID: 'profile-bmi',
    },
    {
      label: strings.home.height,
      value: height ? formatHeight(height.v1, unitSystem) : '—',
      testID: 'profile-height',
    },
    {
      label: strings.home.weight,
      value: weight ? formatWeight(weight.v1, unitSystem) : '—',
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

  return (
    <AppScreen
      title={record.name}
      eyebrow={strings.profile.title}
      right={<AppButton label={strings.profile.editProfile} variant="quiet" onPress={openEditor} />}
      testID="screen-profile"
    >
      {saved ? <AppBanner tone="success" message={strings.profile.saved} /> : null}

      <AppCard>
        <AppFactGrid facts={facts} columns={2} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AppFactGrid facts={medicalFacts} columns={1} />
      </AppCard>

      <AppText variant="caption" color="muted">
        {strings.profile.historyHint}
      </AppText>
      <AppText variant="caption" color="muted">
        {strings.app.disclaimer}
      </AppText>

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

      <AppBloodTypeDialog
        visible={bloodTypePending !== null}
        previous={record.bloodType}
        next={bloodTypePending?.next ?? null}
        onConfirm={() => {
          setBloodType(bloodTypePending?.next ?? null);
          setBloodTypePending(null);
        }}
        onCancel={() => setBloodTypePending(null)}
        testID="blood-type-dialog"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  sheet: { gap: spacing.sm },
});
