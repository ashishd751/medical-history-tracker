import { Dialog, Portal } from 'react-native-paper';

import { useAppTheme } from '../ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

export interface AppDialogProps {
  visible: boolean;
  title: string;
  message?: string | undefined;
  confirmLabel: string;
  cancelLabel?: string;
  /** Renders the confirm action in the danger colour. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

/**
 * Confirmation dialog. Used for destructive actions and the unsaved-changes guard; there are
 * no OS-level alerts in this app, and this keeps the wording and layout identical on both
 * platforms.
 */
export function AppDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
  testID,
}: AppDialogProps) {
  const { colors } = useAppTheme();

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onCancel}
        testID={testID}
        style={{ backgroundColor: colors.surface }}
      >
        <Dialog.Title>
          <AppText variant="subtitle" accessibilityRole="header">
            {title}
          </AppText>
        </Dialog.Title>
        {message ? (
          <Dialog.Content>
            <AppText variant="body" color="muted">
              {message}
            </AppText>
          </Dialog.Content>
        ) : null}
        <Dialog.Actions style={{ gap: 4 }}>
          {cancelLabel ? (
            <AppButton label={cancelLabel} variant="quiet" onPress={onCancel} />
          ) : null}
          <AppButton
            label={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            onPress={onConfirm}
          />
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
