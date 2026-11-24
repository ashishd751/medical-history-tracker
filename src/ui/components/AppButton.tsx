import { Button } from 'react-native-paper';

import { useAppTheme } from '../ThemeProvider';
import { minTouchTarget } from '../tokens';

export type AppButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  accessibilityHint?: string | undefined;
  /** Stretch to the container width; used for primary actions on forms. */
  fullWidth?: boolean;
}

/**
 * The single button in the app. Variants map to intent, never to raw colours, so a
 * restyle is a token change.
 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
  fullWidth = false,
}: AppButtonProps) {
  const { colors } = useAppTheme();

  const mode =
    variant === 'primary' || variant === 'danger'
      ? 'contained'
      : variant === 'secondary'
        ? 'outlined'
        : 'text';
  const buttonColor =
    variant === 'danger' ? colors.danger : variant === 'primary' ? colors.primary : undefined;
  const textColor =
    variant === 'primary' || variant === 'danger'
      ? colors.onPrimary
      : variant === 'secondary'
        ? colors.primary
        : colors.textMuted;

  return (
    <Button
      mode={mode}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      icon={icon}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      style={fullWidth ? { alignSelf: 'stretch' } : undefined}
      contentStyle={{ minHeight: minTouchTarget, paddingHorizontal: variant === 'quiet' ? 8 : 16 }}
      buttonColor={buttonColor}
      textColor={textColor}
      labelStyle={{ fontWeight: '600', fontSize: 15 }}
    >
      {label}
    </Button>
  );
}
