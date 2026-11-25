import { type Control, Controller } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import type { UnitSystem } from '@/domain';
import { AppField, AppText, spacing, strings } from '@/ui';

import type { RecordFormValues } from '../recordFormSchema';

export interface VitalsFieldsProps {
  control: Control<RecordFormValues>;
  unitSystem: UnitSystem;
}

/**
 * Height, weight and blood pressure captured with the record. Values are entered in the user's
 * display units and converted to metric before storage.
 */
export function VitalsFields({ control, unitSystem }: VitalsFieldsProps) {
  const heightUnit = unitSystem === 'imperial' ? strings.units.in : strings.units.cm;
  const weightUnit = unitSystem === 'imperial' ? strings.units.lb : strings.units.kg;

  return (
    <View style={styles.root}>
      <AppText variant="subtitle" accessibilityRole="header">
        {strings.recordForm.vitals}
      </AppText>
      <AppText variant="caption" color="muted">
        {strings.recordForm.vitalsHint}
      </AppText>

      <View style={styles.row}>
        <View style={styles.half}>
          <Controller
            control={control}
            name="height"
            render={({ field: input, fieldState }) => (
              <AppField
                label={`${strings.recordForm.vitals} · ${strings.home.height} (${heightUnit})`}
                value={input.value}
                onChangeText={input.onChange}
                keyboardType="decimal-pad"
                error={fieldState.error !== undefined}
                helperText={fieldState.error?.message}
                testID="vital-height"
              />
            )}
          />
        </View>
        <View style={styles.half}>
          <Controller
            control={control}
            name="weight"
            render={({ field: input, fieldState }) => (
              <AppField
                label={`${strings.home.weight} (${weightUnit})`}
                value={input.value}
                onChangeText={input.onChange}
                keyboardType="decimal-pad"
                error={fieldState.error !== undefined}
                helperText={fieldState.error?.message}
                testID="vital-weight"
              />
            )}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Controller
            control={control}
            name="systolic"
            render={({ field: input, fieldState }) => (
              <AppField
                label={strings.onboarding.systolic}
                value={input.value}
                onChangeText={input.onChange}
                keyboardType="numeric"
                error={fieldState.error !== undefined}
                helperText={fieldState.error?.message}
                testID="vital-systolic"
              />
            )}
          />
        </View>
        <View style={styles.half}>
          <Controller
            control={control}
            name="diastolic"
            render={({ field: input, fieldState }) => (
              <AppField
                label={strings.onboarding.diastolic}
                value={input.value}
                onChangeText={input.onChange}
                keyboardType="numeric"
                error={fieldState.error !== undefined}
                helperText={fieldState.error?.message}
                testID="vital-diastolic"
              />
            )}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
});
