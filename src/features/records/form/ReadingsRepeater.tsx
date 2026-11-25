import { type Control, Controller, useFieldArray } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { READING_FLAGS } from '@/domain';
import {
  AppButton,
  AppCard,
  AppChip,
  AppField,
  AppText,
  readingFlagLabel,
  spacing,
  strings,
} from '@/ui';

import type { RecordFormValues } from '../recordFormSchema';

export interface ReadingsRepeaterProps {
  control: Control<RecordFormValues>;
}

/** Add/remove rows of lab readings, each with a text flag (High/Low/Normal). */
export function ReadingsRepeater({ control }: ReadingsRepeaterProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'readings' });

  return (
    <View style={styles.root}>
      <AppText variant="subtitle" accessibilityRole="header">
        {strings.recordForm.readings}
      </AppText>

      {fields.map((field, index) => (
        <AppCard key={field.id} variant="quiet">
          <Controller
            control={control}
            name={`readings.${index}.name`}
            render={({ field: input }) => (
              <AppField
                label={strings.recordForm.readingName}
                value={input.value}
                onChangeText={input.onChange}
                testID={`reading-name-${index}`}
              />
            )}
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <Controller
                control={control}
                name={`readings.${index}.value`}
                render={({ field: input }) => (
                  <AppField
                    label={strings.recordForm.readingValue}
                    value={input.value}
                    onChangeText={input.onChange}
                    testID={`reading-value-${index}`}
                  />
                )}
              />
            </View>
            <View style={styles.half}>
              <Controller
                control={control}
                name={`readings.${index}.unit`}
                render={({ field: input }) => (
                  <AppField
                    label={strings.recordForm.readingUnit}
                    value={input.value}
                    onChangeText={input.onChange}
                    testID={`reading-unit-${index}`}
                  />
                )}
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <Controller
                control={control}
                name={`readings.${index}.refLow`}
                render={({ field: input }) => (
                  <AppField
                    label={strings.recordForm.readingRefLow}
                    value={input.value}
                    onChangeText={input.onChange}
                    keyboardType="decimal-pad"
                  />
                )}
              />
            </View>
            <View style={styles.half}>
              <Controller
                control={control}
                name={`readings.${index}.refHigh`}
                render={({ field: input }) => (
                  <AppField
                    label={strings.recordForm.readingRefHigh}
                    value={input.value}
                    onChangeText={input.onChange}
                    keyboardType="decimal-pad"
                  />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name={`readings.${index}.flag`}
            render={({ field: input }) => (
              <View style={styles.chips}>
                {READING_FLAGS.map((flag) => (
                  <AppChip
                    key={flag}
                    label={readingFlagLabel(flag)}
                    selected={input.value === flag}
                    onPress={() => input.onChange(flag)}
                    testID={`reading-flag-${index}-${flag}`}
                  />
                ))}
              </View>
            )}
          />

          <AppButton
            label={strings.common.remove}
            variant="quiet"
            onPress={() => remove(index)}
            testID={`remove-reading-${index}`}
          />
        </AppCard>
      ))}

      <AppButton
        label={strings.recordForm.addReading}
        variant="secondary"
        onPress={() =>
          append({ name: '', value: '', unit: '', refLow: '', refHigh: '', flag: 'unknown' })
        }
        testID="add-reading"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
