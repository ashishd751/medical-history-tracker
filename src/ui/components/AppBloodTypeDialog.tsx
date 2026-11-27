import type { BloodType } from '@/domain';

import { bloodTypeLabel } from '../labels';
import { strings } from '../strings';
import { AppDialog } from './AppDialog';

export interface AppBloodTypeDialogProps {
  visible: boolean;
  /** The value recorded on the profile today, or null when none is. */
  previous: BloodType | null;
  /** The value the user picked, or null when they cleared it. */
  next: BloodType | null;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

/**
 * Confirms a change to a blood type that is already recorded (ADR-044).
 *
 * The caller decides *whether* to ask (`requiresBloodTypeConfirmation` in the domain); this dialog
 * only asks. It is deliberately reusable: Phase 6 passes the group a scanned document reported.
 * Cancelling is not an error and quietly keeps the recorded value.
 */
export function AppBloodTypeDialog({
  visible,
  previous,
  next,
  onConfirm,
  onCancel,
  testID,
}: AppBloodTypeDialogProps) {
  const clearing = next === null;

  return (
    <AppDialog
      visible={visible}
      title={clearing ? strings.profile.bloodTypeClearTitle : strings.profile.bloodTypeChangeTitle}
      message={
        clearing
          ? strings.profile.bloodTypeClearBody(bloodTypeLabel(previous))
          : strings.profile.bloodTypeChangeBody(bloodTypeLabel(previous), bloodTypeLabel(next))
      }
      confirmLabel={
        clearing ? strings.profile.bloodTypeClearConfirm : strings.profile.bloodTypeChangeConfirm
      }
      cancelLabel={strings.common.cancel}
      onConfirm={onConfirm}
      onCancel={onCancel}
      testID={testID}
    />
  );
}
