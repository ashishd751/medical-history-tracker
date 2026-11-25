import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../tokens';
import { AppChip } from './AppChip';
import { AppField } from './AppField';
import { AppText } from './AppText';

export interface AppTagInputProps {
  label: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
  placeholder?: string | undefined;
  testID?: string;
}

/**
 * Free-text tags (symptoms, allergies). Values are appended with the keyboard's submit key and
 * removed by tapping the chip, which avoids needing an icon font for a delete glyph.
 */
export function AppTagInput({ label, values, onChange, placeholder, testID }: AppTagInputProps) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const value = draft.trim();
    if (!value) return;
    if (!values.includes(value)) onChange([...values, value]);
    setDraft('');
  };

  const remove = (value: string) => onChange(values.filter((item) => item !== value));

  return (
    <View style={styles.root}>
      <AppField
        label={label}
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        testID={testID}
        onSubmitEditing={commit}
        returnKeyType="done"
        helperText={values.length > 0 ? 'Tap a tag to remove it' : undefined}
      />
      {values.length > 0 ? (
        <View style={styles.tags}>
          {values.map((value) => (
            <AppChip
              key={value}
              label={value}
              selected
              onPress={() => remove(value)}
              testID={`tag-${value}`}
            />
          ))}
        </View>
      ) : null}
      <AppText variant="caption" color="muted" style={styles.hint}>
        {draft.trim() ? 'Press enter to add' : ' '}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  hint: { minHeight: 16 },
});
