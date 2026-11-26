import { type Control, Controller } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { FACILITY_KINDS, RECORD_KINDS, type RecordKind } from '@/domain';
import {
  AppChoiceGrid,
  AppDateField,
  AppField,
  AppTagInput,
  AppText,
  recordKindLabel,
  spacing,
  strings,
} from '@/ui';

import type { RecordFormValues } from '../recordFormSchema';

const KIND_OPTIONS = RECORD_KINDS.map((kind) => ({ value: kind, label: recordKindLabel(kind) }));

export interface RecordBasicsFieldsProps {
  control: Control<RecordFormValues>;
  kind: RecordKind;
  onChangeKind: (kind: RecordKind) => void;
  doctorSuggestions?: readonly string[] | undefined;
}

/**
 * Date, type, title, symptoms, doctor and place.
 *
 * Facility only appears for doctor visits and procedures — the field is hidden for the other
 * kinds, and the form clears it so a value cannot hide behind an invisible input.
 */
export function RecordBasicsFields({
  control,
  kind,
  onChangeKind,
  doctorSuggestions,
}: RecordBasicsFieldsProps) {
  return (
    <View style={styles.root}>
      <Controller
        control={control}
        name="date"
        render={({ field, fieldState }) => (
          <View>
            <AppDateField
              label={strings.recordForm.date}
              value={field.value}
              onChange={field.onChange}
              testID="form-date"
            />
            {fieldState.error ? (
              <AppText variant="caption" color="danger">
                {fieldState.error.message}
              </AppText>
            ) : null}
          </View>
        )}
      />

      <View>
        <AppText variant="caption" color="muted">
          {strings.recordForm.kind}
        </AppText>
        <AppChoiceGrid
          options={KIND_OPTIONS}
          selected={kind}
          onSelect={onChangeKind}
          columns={3}
          testIDPrefix="form-kind"
        />
      </View>

      <Controller
        control={control}
        name="title"
        render={({ field, fieldState }) => (
          <AppField
            label={strings.recordForm.titleLabel}
            value={field.value}
            onChangeText={field.onChange}
            placeholder={strings.recordForm.titlePlaceholder}
            error={fieldState.error !== undefined}
            helperText={fieldState.error ? strings.recordForm.invalid : undefined}
            testID="form-title"
          />
        )}
      />

      <Controller
        control={control}
        name="symptoms"
        render={({ field }) => (
          <AppTagInput
            label={strings.recordForm.symptoms}
            values={field.value}
            onChange={field.onChange}
            placeholder={strings.recordForm.symptomsPlaceholder}
            testID="form-symptoms"
          />
        )}
      />

      <Controller
        control={control}
        name="doctorName"
        render={({ field }) => (
          <AppField
            label={strings.recordForm.doctor}
            value={field.value}
            onChangeText={field.onChange}
            placeholder={strings.recordForm.doctorPlaceholder}
            helperText={doctorSuggestions?.join(' · ')}
            testID="form-doctor"
          />
        )}
      />

      <Controller
        control={control}
        name="specialty"
        render={({ field }) => (
          <AppField
            label={strings.recordForm.specialty}
            value={field.value}
            onChangeText={field.onChange}
            testID="form-specialty"
          />
        )}
      />

      {FACILITY_KINDS.includes(kind) ? (
        <Controller
          control={control}
          name="facility"
          render={({ field }) => (
            <AppField
              label={strings.recordForm.facility}
              value={field.value}
              onChangeText={field.onChange}
              testID="form-facility"
            />
          )}
        />
      ) : null}

      <Controller
        control={control}
        name="condition"
        render={({ field }) => (
          <AppField
            label={strings.recordForm.condition}
            value={field.value}
            onChangeText={field.onChange}
            testID="form-condition"
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
});
