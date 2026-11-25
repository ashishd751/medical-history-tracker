import { type Control, Controller, useFieldArray } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppField, AppText, spacing, strings } from '@/ui';

import type { RecordFormValues } from '../recordFormSchema';

export interface MedicationsRepeaterProps {
  control: Control<RecordFormValues>;
}

/** Add/remove rows of medication. Blank names are dropped by the repository on save. */
export function MedicationsRepeater({ control }: MedicationsRepeaterProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'medications' });

  return (
    <View style={styles.root}>
      <AppText variant="subtitle" accessibilityRole="header">
        {strings.recordForm.medications}
      </AppText>

      {fields.map((field, index) => (
        <AppCard key={field.id} variant="quiet">
          <Controller
            control={control}
            name={`medications.${index}.name`}
            render={({ field: input }) => (
              <AppField
                label={strings.recordForm.medicationName}
                value={input.value}
                onChangeText={input.onChange}
                testID={`medication-name-${index}`}
              />
            )}
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <Controller
                control={control}
                name={`medications.${index}.dose`}
                render={({ field: input }) => (
                  <AppField
                    label={strings.recordForm.dose}
                    value={input.value}
                    onChangeText={input.onChange}
                    testID={`medication-dose-${index}`}
                  />
                )}
              />
            </View>
            <View style={styles.half}>
              <Controller
                control={control}
                name={`medications.${index}.frequency`}
                render={({ field: input }) => (
                  <AppField
                    label={strings.recordForm.frequency}
                    value={input.value}
                    onChangeText={input.onChange}
                    testID={`medication-frequency-${index}`}
                  />
                )}
              />
            </View>
          </View>
          <Controller
            control={control}
            name={`medications.${index}.duration`}
            render={({ field: input }) => (
              <AppField
                label={strings.recordForm.duration}
                value={input.value}
                onChangeText={input.onChange}
                testID={`medication-duration-${index}`}
              />
            )}
          />
          <AppButton
            label={strings.common.remove}
            variant="quiet"
            onPress={() => remove(index)}
            testID={`remove-medication-${index}`}
          />
        </AppCard>
      ))}

      <AppButton
        label={strings.recordForm.addMedication}
        variant="secondary"
        onPress={() => append({ name: '', dose: '', frequency: '', duration: '' })}
        testID="add-medication"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
});
