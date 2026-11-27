import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { AppRepositories, PersonRow } from '@/data';
import { SessionProvider, type SessionState } from '@/lib/session';
import { AppThemeProvider, strings } from '@/ui';

import { ProfileScreen } from './ProfileScreen';

const mockRequireRepositories = jest.fn();
jest.mock('@/data', () => ({
  requireRepositories: () => mockRequireRepositories(),
}));

const person: PersonRow = {
  id: 'p1',
  name: 'Synthetic Person',
  dob: '1990-04-17',
  sex: 'female',
  bloodType: 'O+',
  allergies: 'Synthetic penicillin allergy',
  chronicConditions: 'Synthetic asthma',
  createdAt: 1,
  updatedAt: 1,
};

const session: SessionState = {
  ready: true,
  error: null,
  personId: person.id,
  personName: person.name,
  unitSystem: 'metric',
  bmiPreset: 'who',
  onboarded: true,
  refresh: jest.fn(),
};

function renderProfile() {
  // `gcTime: Infinity` keeps React Query from scheduling a cache-eviction timer that would keep
  // the Jest worker alive after the test ends.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 800 },
        insets: { top: 24, left: 0, right: 0, bottom: 24 },
      }}
    >
      <AppThemeProvider scheme="light">
        <QueryClientProvider client={client}>
          <SessionProvider value={session}>
            <ProfileScreen />
          </SessionProvider>
        </QueryClientProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('ProfileScreen layout', () => {
  beforeEach(() => {
    mockRequireRepositories.mockReturnValue({
      people: { getById: () => person },
      measurements: { latestVitals: () => ({ height: { v1: 172 }, weight: { v1: 70 } }) },
    } as unknown as AppRepositories);
  });

  it('shows the facts in tiles and keeps dates in DD/MM/YYYY', async () => {
    await renderProfile();

    await waitFor(() => expect(screen.getByText(person.name)).toBeTruthy());

    const ids = [
      'profile-dob',
      'profile-sex',
      'profile-blood-type',
      'profile-bmi',
      'profile-height',
      'profile-weight',
      'profile-allergies',
      'profile-chronic-conditions',
    ];
    for (const id of ids) expect(screen.getByTestId(id)).toBeTruthy();

    expect(screen.getByText('17/04/1990')).toBeTruthy();
    expect(screen.queryByText('1990-04-17')).toBeNull();
    expect(screen.getByText('172 cm')).toBeTruthy();
    expect(screen.getByText('70 kg')).toBeTruthy();
    expect(screen.getByText('23.7')).toBeTruthy();
    expect(screen.getByText(person.allergies ?? '')).toBeTruthy();
    expect(screen.getByText(person.chronicConditions ?? '')).toBeTruthy();
  });

  it('offers blood type as a four-column choice grid in the edit sheet', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByText(person.name)).toBeTruthy());

    await fireEvent.press(screen.getByText(strings.profile.editProfile));

    expect(await screen.findByTestId('blood-type-O+')).toBeTruthy();
    expect(screen.getByTestId('blood-type-O+').props.accessibilityState).toEqual({
      selected: true,
    });
    for (const type of ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O-']) {
      expect(screen.getByTestId(`blood-type-${type}`)).toBeTruthy();
    }
  });

  it('asks before replacing a recorded blood type, and keeps it on cancel', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByText(person.name)).toBeTruthy());
    await fireEvent.press(screen.getByText(strings.profile.editProfile));

    await fireEvent.press(await screen.findByTestId('blood-type-A-'));

    expect(await screen.findByTestId('blood-type-dialog')).toBeTruthy();
    expect(screen.getByText(strings.profile.bloodTypeChangeBody('O+', 'A-'))).toBeTruthy();

    await fireEvent.press(screen.getByText(strings.common.cancel));

    expect(screen.getByTestId('blood-type-O+').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByTestId('blood-type-A-').props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('applies the new group once the change is confirmed', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByText(person.name)).toBeTruthy());
    await fireEvent.press(screen.getByText(strings.profile.editProfile));

    await fireEvent.press(await screen.findByTestId('blood-type-A-'));
    await fireEvent.press(await screen.findByText(strings.profile.bloodTypeChangeConfirm));

    expect(screen.getByTestId('blood-type-A-').props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('sets a blood type for the first time without asking', async () => {
    mockRequireRepositories.mockReturnValue({
      people: { getById: () => ({ ...person, bloodType: null }) },
      measurements: { latestVitals: () => ({ height: { v1: 172 }, weight: { v1: 70 } }) },
    } as unknown as AppRepositories);
    await renderProfile();
    await waitFor(() => expect(screen.getByText(person.name)).toBeTruthy());
    await fireEvent.press(screen.getByText(strings.profile.editProfile));

    await fireEvent.press(await screen.findByTestId('blood-type-A+'));

    expect(screen.queryByTestId('blood-type-dialog')).toBeNull();
    expect(screen.getByTestId('blood-type-A+').props.accessibilityState).toEqual({
      selected: true,
    });
  });
});
