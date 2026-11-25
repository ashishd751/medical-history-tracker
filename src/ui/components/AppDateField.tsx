import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { formatDisplayDate, parseIsoDate, toIsoDate } from '../../lib/dates';
import { strings } from '../strings';
import { useAppTheme } from '../ThemeProvider';
import { radius, spacing } from '../tokens';
import { AppButton } from './AppButton';
import { AppSheet } from './AppSheet';
import { AppText } from './AppText';

export interface AppDateFieldProps {
  label: string;
  /** `YYYY-MM-DD`. */
  value: string;
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
}

/**
 * Date entry (ADR-021).
 *
 * The OS picker shows its own locale, but the value the user is agreeing to is always echoed
 * beneath it as `DD/MM/YYYY` (ADR-017). Android opens a dialog; iOS shows an inline calendar
 * in the app's own sheet so the interaction is the same on both platforms.
 */
export function AppDateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  testID,
}: AppDateFieldProps) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value) ?? new Date();

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && date) onChange(toIsoDate(date));
  };

  return (
    <View style={styles.root}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDisplayDate(value)}`}
        accessibilityHint="Opens the date picker"
        style={[styles.field, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <AppText variant="body">{formatDisplayDate(value)}</AppText>
        <AppText variant="caption" color="muted">
          {strings.common.edit}
        </AppText>
      </Pressable>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={selected}
          mode="date"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <AppSheet visible={open} onDismiss={() => setOpen(false)} title={label}>
          <DateTimePicker
            value={selected}
            mode="date"
            display="inline"
            onChange={handleChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            accentColor={colors.primary}
          />
          <AppButton label={strings.common.done} onPress={() => setOpen(false)} fullWidth />
        </AppSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  field: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
