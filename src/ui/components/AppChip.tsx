import { Chip } from 'react-native-paper';

import { useAppTheme } from '../ThemeProvider';
import { minTouchTarget, radius } from '../tokens';

export interface AppChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** `check` renders the amber "please verify" chip for recognised values (section 15.4). */
  tone?: 'default' | 'check';
  disabled?: boolean;
  testID?: string;
}

export function AppChip({
  label,
  selected = false,
  onPress,
  tone = 'default',
  disabled = false,
  testID,
}: AppChipProps) {
  const { colors } = useAppTheme();
  const isCheck = tone === 'check';

  return (
    <Chip
      mode={selected || isCheck ? 'flat' : 'outlined'}
      selected={selected}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={label}
      style={{
        borderRadius: radius.pill,
        minHeight: 36,
        backgroundColor: isCheck ? colors.checkSurface : selected ? colors.primary : 'transparent',
        borderColor: isCheck ? colors.check : colors.border,
      }}
      textStyle={{
        color: isCheck ? colors.check : selected ? colors.onPrimary : colors.text,
        fontSize: 13,
        minHeight: minTouchTarget - 8,
      }}
    >
      {label}
    </Chip>
  );
}
