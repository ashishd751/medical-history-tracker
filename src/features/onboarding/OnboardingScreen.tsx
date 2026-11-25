import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requireRepositories } from '@/data';
import {
  BLOOD_TYPES,
  type BloodType,
  DEFAULT_UNIT_SYSTEM,
  inRange,
  inToCm,
  lbToKg,
  type Sex,
  SEXES,
  UNIT_SYSTEMS,
  type UnitSystem,
} from '@/domain';
import { isValidIsoDate, todayIso } from '@/lib/dates';
import { useSession } from '@/lib/session';
import {
  AppBanner,
  AppButton,
  AppChip,
  AppDateField,
  AppField,
  AppScreen,
  AppText,
  sexLabel,
  spacing,
  strings,
} from '@/ui';

import { BmiPreview } from './BmiPreview';

const TOTAL_STEPS = 3;

const UNIT_LABELS: Record<UnitSystem, string> = {
  metric: strings.settings.unitsMetric,
  imperial: strings.settings.unitsImperial,
};

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * First-launch setup: the person row plus the initial measurements and settings.
 *
 * Steps 1 and 2 are validated before the next step; step 3 is optional and can be skipped.
 * Nothing is written until "Finish", so abandoning setup leaves no half-made profile.
 */
export function OnboardingScreen() {
  const router = useRouter();
  const { refresh, bmiPreset } = useSession();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [dob, setDob] = useState(todayIso());
  const [sex, setSex] = useState<Sex | null>(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(DEFAULT_UNIT_SYSTEM);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bloodType, setBloodType] = useState<BloodType | null>(null);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [medication, setMedication] = useState('');
  const [allergies, setAllergies] = useState('');
  const [chronic, setChronic] = useState('');
  const [error, setError] = useState<string | null>(null);

  const heightCm =
    toNumberOrNull(height) === null
      ? null
      : unitSystem === 'imperial'
        ? inToCm(toNumberOrNull(height) ?? 0)
        : toNumberOrNull(height);
  const weightKg =
    toNumberOrNull(weight) === null
      ? null
      : unitSystem === 'imperial'
        ? lbToKg(toNumberOrNull(weight) ?? 0)
        : toNumberOrNull(weight);

  const next = () => {
    setError(null);
    if (step === 0) {
      if (!name.trim() || !isValidIsoDate(dob) || !sex) {
        setError(strings.onboarding.required);
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (heightCm !== null && !inRange(heightCm, { min: 30, max: 275 })) {
        setError(strings.recordForm.invalid);
        return;
      }
      if (weightKg !== null && !inRange(weightKg, { min: 1, max: 400 })) {
        setError(strings.recordForm.invalid);
        return;
      }
      setStep(2);
      return;
    }
    finish();
  };

  const finish = () => {
    const repositories = requireRepositories();
    const created = repositories.people.create({
      name: name.trim(),
      dob,
      sex: sex ?? 'prefer_not_to_say',
      bloodType,
      allergies: allergies.trim() || null,
      chronicConditions: chronic.trim() || null,
    });
    if (!created.ok) {
      setError(strings.errors.db);
      return;
    }

    const personId = created.value.id;
    const measuredOn = todayIso();
    if (heightCm !== null) {
      repositories.measurements.create(personId, { kind: 'height', v1: heightCm, measuredOn });
    }
    if (weightKg !== null) {
      repositories.measurements.create(personId, { kind: 'weight', v1: weightKg, measuredOn });
    }
    const sys = toNumberOrNull(systolic);
    const dia = toNumberOrNull(diastolic);
    if (sys !== null && dia !== null) {
      repositories.measurements.create(personId, { kind: 'bp', v1: sys, v2: dia, measuredOn });
    }
    if (medication.trim()) {
      repositories.medications.create(personId, { name: medication, startOn: measuredOn });
    }

    const settings = repositories.settings.updateSettings({
      activePersonId: personId,
      onboardedAt: Date.now(),
      unitSystem,
    });
    if (!settings.ok) {
      setError(strings.errors.db);
      return;
    }

    refresh();
    router.replace('/(tabs)/home');
  };

  const heightUnit = unitSystem === 'imperial' ? strings.units.in : strings.units.cm;
  const weightUnit = unitSystem === 'imperial' ? strings.units.lb : strings.units.kg;

  return (
    <AppScreen
      title={strings.onboarding.welcome}
      eyebrow={strings.onboarding.stepLabel(step + 1, TOTAL_STEPS)}
      scroll={false}
      testID="screen-onboarding"
    >
      <View style={styles.body}>
        {error ? <AppBanner tone="danger" message={error} testID="onboarding-error" /> : null}

        {step === 0 ? (
          <View style={styles.step}>
            <AppText variant="subtitle" accessibilityRole="header">
              {strings.onboarding.step1Title}
            </AppText>
            <AppText variant="body" color="muted">
              {strings.onboarding.intro}
            </AppText>
            <AppField
              label={strings.onboarding.name}
              value={name}
              onChangeText={setName}
              placeholder={strings.onboarding.namePlaceholder}
              testID="onboarding-name"
            />
            <AppDateField
              label={strings.onboarding.dob}
              value={dob}
              onChange={setDob}
              maximumDate={new Date()}
              testID="onboarding-dob"
            />
            <AppText variant="caption" color="muted">
              {strings.onboarding.sex}
            </AppText>
            <View style={styles.chips}>
              {SEXES.map((option) => (
                <AppChip
                  key={option}
                  label={sexLabel(option)}
                  selected={sex === option}
                  onPress={() => setSex(option)}
                  testID={`onboarding-sex-${option}`}
                />
              ))}
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.step}>
            <AppText variant="subtitle" accessibilityRole="header">
              {strings.onboarding.step2Title}
            </AppText>
            <View style={styles.chips}>
              {UNIT_SYSTEMS.map((option) => (
                <AppChip
                  key={option}
                  label={UNIT_LABELS[option]}
                  selected={unitSystem === option}
                  onPress={() => setUnitSystem(option)}
                  testID={`onboarding-units-${option}`}
                />
              ))}
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <AppField
                  label={`${strings.onboarding.height} (${heightUnit})`}
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="decimal-pad"
                  testID="onboarding-height"
                />
              </View>
              <View style={styles.half}>
                <AppField
                  label={`${strings.onboarding.weight} (${weightUnit})`}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  testID="onboarding-weight"
                />
              </View>
            </View>
            <BmiPreview
              heightCm={heightCm}
              weightKg={weightKg}
              preset={bmiPreset}
              testID="onboarding-bmi-preview"
            />
            <AppText variant="caption" color="muted">
              {strings.home.bloodType}
            </AppText>
            <View style={styles.chips}>
              {BLOOD_TYPES.map((type) => (
                <AppChip
                  key={type}
                  label={type}
                  selected={bloodType === type}
                  onPress={() => setBloodType(bloodType === type ? null : type)}
                  testID={`onboarding-blood-${type}`}
                />
              ))}
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.step}>
            <AppText variant="subtitle" accessibilityRole="header">
              {strings.onboarding.step3Title}
            </AppText>
            <AppText variant="body" color="muted">
              {strings.onboarding.step3Hint}
            </AppText>
            <View style={styles.row}>
              <View style={styles.half}>
                <AppField
                  label={strings.onboarding.systolic}
                  value={systolic}
                  onChangeText={setSystolic}
                  keyboardType="numeric"
                  testID="onboarding-systolic"
                />
              </View>
              <View style={styles.half}>
                <AppField
                  label={strings.onboarding.diastolic}
                  value={diastolic}
                  onChangeText={setDiastolic}
                  keyboardType="numeric"
                  testID="onboarding-diastolic"
                />
              </View>
            </View>
            <AppField
              label={strings.onboarding.currentMedication}
              value={medication}
              onChangeText={setMedication}
              placeholder={strings.onboarding.medicationName}
              testID="onboarding-medication"
            />
            <AppField
              label={strings.onboarding.allergies}
              value={allergies}
              onChangeText={setAllergies}
              testID="onboarding-allergies"
            />
            <AppField
              label={strings.onboarding.chronicConditions}
              value={chronic}
              onChangeText={setChronic}
              testID="onboarding-chronic"
            />
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {step > 0 ? (
          <AppButton
            label={strings.common.back}
            variant="quiet"
            onPress={() => {
              setError(null);
              setStep(step - 1);
            }}
          />
        ) : null}
        <View style={styles.footerMain}>
          <AppButton
            label={step === TOTAL_STEPS - 1 ? strings.onboarding.finish : strings.common.next}
            onPress={next}
            fullWidth
            testID={step === TOTAL_STEPS - 1 ? 'onboarding-finish' : 'onboarding-next'}
          />
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  step: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  footerMain: { flex: 1 },
});
