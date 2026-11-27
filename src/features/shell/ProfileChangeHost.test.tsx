import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { AppRepositories } from '@/data';
import {
  dismissProfileChange,
  type ProfileChangeReport,
  publishProfileChange,
} from '@/lib/profileChangeStore';
import { SessionProvider, type SessionState } from '@/lib/session';
import { AppThemeProvider, strings } from '@/ui';

import { ProfileChangeHost } from './ProfileChangeHost';

const undo = jest.fn();
const mockRequireRepositories = jest.fn(
  () => ({ profile: { undo } }) as unknown as AppRepositories,
);

jest.mock('@/data', () => ({
  requireRepositories: () => mockRequireRepositories(),
}));

const refresh = jest.fn();

const session: SessionState = {
  ready: true,
  error: null,
  personId: 'p1',
  personName: 'Synthetic Person',
  unitSystem: 'metric',
  bmiPreset: 'asian',
  onboarded: true,
  refresh,
};

function renderHost() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 800 },
        insets: { top: 24, left: 0, right: 0, bottom: 24 },
      }}
    >
      <AppThemeProvider scheme="light">
        <SessionProvider value={session}>
          <ProfileChangeHost />
        </SessionProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
}

const weightChange: ProfileChangeReport = {
  changes: [
    { kind: 'weight', from: 70, to: 72 },
    { kind: 'bmi', from: 24.2, to: 24.9 },
  ],
  undo: { measurementIds: ['m1'], medicationIds: [] },
  undoUnavailable: null,
};

afterEach(() => {
  dismissProfileChange();
  undo.mockReset();
  refresh.mockReset();
});

describe('ProfileChangeHost', () => {
  it('renders nothing while no change is pending', async () => {
    await renderHost();
    expect(screen.queryByTestId('profile-updated-sheet')).toBeNull();
  });

  it('lists each changed field as old → new and closes on Done', async () => {
    publishProfileChange(weightChange);
    await renderHost();

    expect(await screen.findByText(strings.profile.updatedTitle)).toBeTruthy();
    expect(screen.getByTestId('profile-change-weight-from')).toHaveTextContent('70 kg');
    expect(screen.getByTestId('profile-change-weight-to')).toHaveTextContent('72 kg');
    expect(screen.getByTestId('profile-change-bmi-from')).toHaveTextContent('24.2');

    await fireEvent.press(screen.getByTestId('profile-done'));
    expect(screen.queryByTestId('profile-updated-sheet')).toBeNull();
  });

  it('undoes the change, keeps the sheet open for confirmation, and refreshes the queries', async () => {
    undo.mockReturnValue({ ok: true, value: true });
    publishProfileChange(weightChange);
    await renderHost();

    await fireEvent.press(await screen.findByTestId('profile-undo'));

    expect(undo).toHaveBeenCalledWith('p1', { measurementIds: ['m1'], medicationIds: [] });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('profile-undo-done')).toBeTruthy();
    expect(screen.queryByTestId('profile-undo')).toBeNull();

    await fireEvent.press(screen.getByTestId('profile-done'));
    expect(screen.queryByTestId('profile-updated-sheet')).toBeNull();
  });

  it('reports a failed undo instead of pretending it worked', async () => {
    undo.mockReturnValue({ ok: false, error: { code: 'DB_FAILURE', message: 'boom' } });
    publishProfileChange(weightChange);
    await renderHost();

    await fireEvent.press(await screen.findByTestId('profile-undo'));

    expect(await screen.findByText(strings.errors.db)).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('offers no Undo after an edit and says why', async () => {
    publishProfileChange({ ...weightChange, undo: null, undoUnavailable: 'edit' });
    await renderHost();

    expect(await screen.findByTestId('profile-change-weight-from')).toBeTruthy();
    expect(screen.queryByTestId('profile-undo')).toBeNull();
    expect(screen.getByTestId('profile-change-note')).toHaveTextContent(
      strings.profile.undoUnavailableEdit,
    );
  });

  it('offers no Undo after a delete and says why', async () => {
    publishProfileChange({ ...weightChange, undo: null, undoUnavailable: 'delete' });
    await renderHost();

    expect(await screen.findByTestId('profile-change-note')).toHaveTextContent(
      strings.profile.undoUnavailableDelete,
    );
    expect(screen.queryByTestId('profile-undo')).toBeNull();
  });
});
