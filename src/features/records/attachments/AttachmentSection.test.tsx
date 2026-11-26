import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/ui';

import { AttachmentSection } from './AttachmentSection';

const ACTIONS = [
  { label: 'Add photo', source: 'photo' as const, role: 'prescription' as const },
  { label: 'Add file', source: 'file' as const, role: 'prescription' as const },
];

describe('AttachmentSection', () => {
  it('renders the title, both actions and the counter', async () => {
    await render(
      <AppThemeProvider scheme="light">
        <AttachmentSection
          title="Prescription"
          hint="Add a photo or type it."
          items={[]}
          actions={ACTIONS}
          onPick={jest.fn()}
          onRemove={jest.fn()}
          busy={false}
          limitReached={false}
          count={2}
          max={10}
          testID="section-prescription"
        />
      </AppThemeProvider>,
    );

    expect(screen.getByText('Prescription')).toBeOnTheScreen();
    expect(screen.getByText('Add a photo or type it.')).toBeOnTheScreen();
    expect(screen.getByText('Add photo')).toBeOnTheScreen();
    expect(screen.getByText('Add file')).toBeOnTheScreen();
    expect(screen.getByText('2 of 10')).toBeOnTheScreen();
    expect(screen.queryByTestId('section-prescription-grid')).toBeNull();
  });

  it('calls onPick with the action the user chose', async () => {
    const onPick = jest.fn();
    await render(
      <AppThemeProvider scheme="light">
        <AttachmentSection
          title="Prescription"
          hint="Hint"
          items={[]}
          actions={ACTIONS}
          onPick={onPick}
          onRemove={jest.fn()}
          busy={false}
          limitReached={false}
          count={0}
          max={10}
        />
      </AppThemeProvider>,
    );

    fireEvent.press(screen.getByText('Add file'));

    expect(onPick).toHaveBeenCalledWith(ACTIONS[1]);
  });

  it('shows the cap and disables the pickers when the record is full', async () => {
    await render(
      <AppThemeProvider scheme="light">
        <AttachmentSection
          title="Prescription"
          hint="Hint"
          items={[]}
          actions={ACTIONS}
          onPick={jest.fn()}
          onRemove={jest.fn()}
          busy={false}
          limitReached
          count={10}
          max={10}
        />
      </AppThemeProvider>,
    );

    expect(screen.getByText('You can attach up to 10 files to one record.')).toBeOnTheScreen();
    // Paper renders the disabled state on the button element itself.
    expect(screen.getByTestId('add-photo-prescription')).toBeDisabled();
  });

  it('renders a tile per attachment and reports removal', async () => {
    const onRemove = jest.fn();
    await render(
      <AppThemeProvider scheme="light">
        <AttachmentSection
          title="Prescription"
          hint="Hint"
          items={[
            { id: 'a1', label: 'Prescription', thumbnailUri: 'file:///docs/thumbs/a1.jpg' },
            { id: 'a2', label: 'Prescription', thumbnailUri: null },
          ]}
          actions={ACTIONS}
          onPick={jest.fn()}
          onRemove={onRemove}
          busy={false}
          limitReached={false}
          count={2}
          max={10}
          testID="section-prescription"
        />
      </AppThemeProvider>,
    );

    expect(screen.getByTestId('section-prescription-grid')).toBeOnTheScreen();
    // The second tile has no thumbnail file: it says so instead of drawing an empty box.
    expect(screen.getByText('File missing')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('remove-attachment-a2'));

    expect(onRemove).toHaveBeenCalledWith('a2');
  });
});
