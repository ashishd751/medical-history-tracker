import { TextInput } from 'react-native-paper';

import { useAppTheme } from '../ThemeProvider';
import { radius } from '../tokens';

export interface AppFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string | undefined;
  error?: boolean;
  helperText?: string | undefined;
  multiline?: boolean;
  numberOfLines?: number | undefined;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  testID?: string;
  onBlur?: () => void;
}

/** Text input with label, helper and error state. Height meets the 44pt target. */
export function AppField({
  label,
  value,
  onChangeText,
  placeholder,
  error = false,
  helperText,
  multiline = false,
  numberOfLines,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  editable = true,
  testID,
  onBlur,
}: AppFieldProps) {
  const { colors } = useAppTheme();
  return (
    <TextInput
      mode="outlined"
      label={label}
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder={placeholder}
      error={error}
      multiline={multiline}
      numberOfLines={numberOfLines}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      editable={editable}
      testID={testID}
      outlineStyle={{ borderRadius: radius.input }}
      outlineColor={colors.border}
      activeOutlineColor={colors.primary}
      textColor={colors.text}
      style={{ backgroundColor: colors.surface }}
      contentStyle={{ minHeight: multiline ? undefined : 44 }}
    />
  );
}
