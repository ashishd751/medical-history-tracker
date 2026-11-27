import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MEASUREMENT_KINDS, type MeasurementKind, type UnitSystem } from '@/domain';
import { todayIso } from '@/lib/dates';
import {
  AppBanner,
  AppButton,
  AppChoiceGrid,
  AppDateField,
  AppField,
  AppSheet,
  AppText,
  measurementKindLabel,
  spacing,
  strings,
} from '@/ui';

import {
  type MeasurementDraftError,
  type MeasurementSubmission,
  toMeasurementSubmission,
} from './measurementInput';

export interface AddMeasurementSheetProps {
  unitSystem: UnitSystem;
  /** The kind the history is showing, so the sheet opens where the user already is. */
  initialKind: MeasurementKind;
  onDismiss: () => void;
  /** Receives a validated, already-metric submission. */
  onSubmit: (submission: MeasurementSubmission) => void;
  testID?: string;
}

/** The unit a value is typed in for each kind, matching what the history shows. */
function inputUnit(kind: MeasurementKind, unitSystem: UnitSystem): string {
  if (kind === 'height') return unitSystem === 'imperial' ? strings.units.in : strings.units.cm;
  if (kind === 'weight') return unitSystem === 'imperial' ? strings.units.lb : strings.units.kg;
  if (kind === 'temperature') return unitSystem === 'imperial' ? '°F' : strings.units.celsius;
  if (kind === 'bp') return 'mmHg';
  if (kind === 'pulse') return strings.units.bpm;
  if (kind === 'spo2') return '%';
  return 'mg/dL';
}

/**
 * Adds a standalone measurement: no record, so it can be deleted from the history later.
 *
 * The screen mounts this component only while it is open, so the draft (kind, values, date) starts
 * fresh every time without an effect that resets state.
 */
export function AddMeasurementSheet({
  unitSystem,
  initialKind,
  onDismiss,
  onSubmit,
  testID,
}: AddMeasurementSheetProps) {
  const [kind, setKind] = useState<MeasurementKind>(initialKind);
  const [value1, setValue1] = useState('');
  const [value2, setValue2] = useState('');
  const [measuredOn, setMeasuredOn] = useState(() => todayIso());
  const [error, setError] = useState<MeasurementDraftError | null>(null);

  const unit = inputUnit(kind, unitSystem);

  const save = () => {
    const result = toMeasurementSubmission({ kind, value1, value2, measuredOn }, unitSystem);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSubmit(result.submission);
  };

  return (
    <AppSheet
      visible
      onDismiss={onDismiss}
      title={strings.profile.addMeasurementTitle}
      testID={testID}
    >
      {error ? (
        <AppBanner
          tone="danger"
          message={
            error === 'date' ? strings.onboarding.required : strings.profile.measurementInvalid
          }
          testID="add-measurement-error"
        />
      ) : null}

      <AppChoiceGrid
        options={MEASUREMENT_KINDS.map((option) => ({
          value: option,
          label: strings.profile.historyKinds[option],
        }))}
        selected={kind}
        onSelect={(next) => {
          setKind(next);
          setValue2('');
          setError(null);
        }}
        columns={4}
        testIDPrefix="add-measurement-kind"
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <AppField
            label={
              kind === 'bp'
                ? `${strings.onboarding.systolic} (${unit})`
                : `${measurementKindLabel(kind)} (${unit})`
            }
            value={value1}
            onChangeText={setValue1}
            keyboardType="decimal-pad"
            testID="add-measurement-value"
          />
        </View>
        {kind === 'bp' ? (
          <View style={styles.half}>
            <AppField
              label={`${strings.onboarding.diastolic} (${unit})`}
              value={value2}
              onChangeText={setValue2}
              keyboardType="numeric"
              testID="add-measurement-value2"
            />
          </View>
        ) : null}
      </View>

      <AppDateField
        label={strings.profile.measurementDate}
        value={measuredOn}
        onChange={setMeasuredOn}
        testID="add-measurement-date"
      />

      <AppText variant="caption" color="muted">
        {unitSystem === 'imperial' && kind === 'height'
          ? strings.profile.heightInInches
          : strings.profile.exclusiveHint}
      </AppText>

      <AppButton
        label={strings.common.save}
        onPress={save}
        fullWidth
        testID="add-measurement-save"
      />
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
});
