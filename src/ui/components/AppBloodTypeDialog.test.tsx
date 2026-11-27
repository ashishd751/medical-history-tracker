import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppThemeProvider, strings } from '../index';
import { AppBloodTypeDialog } from './AppBloodTypeDialog';

function renderDialog(props: Partial<Parameters<typeof AppBloodTypeDialog>[0]> = {}) {
  return render(
    <AppThemeProvider scheme="light">
      <AppBloodTypeDialog
        visible
        previous="O+"
        next="A-"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
        testID="blood-type-dialog"
        {...props}
      />
    </AppThemeProvider>,
  );
}

describe('AppBloodTypeDialog', () => {
  it('names both groups and asks before replacing one', async () => {
    await renderDialog();

    expect(screen.getByText(strings.profile.bloodTypeChangeTitle)).toBeTruthy();
    expect(screen.getByText(strings.profile.bloodTypeChangeBody('O+', 'A-'))).toBeTruthy();
  });

  it('uses the clearing wording when the next value is empty', async () => {
    await renderDialog({ next: null });

    expect(screen.getByText(strings.profile.bloodTypeClearTitle)).toBeTruthy();
    expect(screen.getByText(strings.profile.bloodTypeClearBody('O+'))).toBeTruthy();
    expect(screen.getByText(strings.profile.bloodTypeClearConfirm)).toBeTruthy();
  });

  it('reports confirm and cancel separately', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await renderDialog({ onConfirm, onCancel });

    await fireEvent.press(screen.getByText(strings.profile.bloodTypeChangeConfirm));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText(strings.common.cancel));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
