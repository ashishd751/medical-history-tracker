import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { AppRepositories, PersonRow } from '@/data';
import type { ProfileSnapshot } from '@/domain';
import { SessionProvider, type SessionState } from '@/lib/session';
import { AppThemeProvider, strings } from '@/ui';

import { HomeScreen } from './HomeScreen';

const mockRequireRepositories = jest.fn();
jest.mock('@/data', () => ({
  requireRepositories: () => mockRequireRepositories(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const person: PersonRow = {
  id: 'p1',
  name: 'Synthetic Person',
  dob: '1990-04-17',
  sex: 'female',
  bloodType: 'O+',
  allergies: null,
  chronicConditions: null,
  createdAt: 1,
  updatedAt: 1,
};

const snapshot: ProfileSnapshot = {
  heightCm: 170,
  weightKg: 70,
  bmi: 24.2,
  bmiCategory: 'normal',
  bloodPressure: { systolic: 128, diastolic: 82, measuredOn: '2026-03-01' },
  bloodType: 'O+',
  medications: [{ id: 'm1', name: 'Synthetic Metformin' }],
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

const snapshotOf = jest.fn();

function renderHome() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <AppThemeProvider scheme="light">
        <QueryClientProvider client={client}>
          <SessionProvider value={session}>
            <HomeScreen />
          </SessionProvider>
        </QueryClientProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  snapshotOf.mockReset();
  snapshotOf.mockReturnValue(snapshot);
  mockRequireRepositories.mockReturnValue({
    people: { list: () => [person] },
    profile: { snapshot: snapshotOf },
    records: { recent: () => [] },
    // The card must not read these any more: one snapshot feeds both the card and the chips.
    measurements: {
      latestVitals: () => {
        throw new Error('Home must not read latestVitals directly');
      },
    },
    medications: {
      listCurrent: () => {
        throw new Error('Home must not read listCurrent directly');
      },
    },
  } as unknown as AppRepositories);
});

describe('HomeScreen', () => {
  it('fills the snapshot card and the medication chips from one snapshot query', async () => {
    await renderHome();
    await waitFor(() => expect(screen.getByText('128/82 mmHg')).toBeTruthy());

    expect(screen.getByText('170 cm')).toBeTruthy();
    expect(screen.getByText('70 kg')).toBeTruthy();
    expect(screen.getByText('24.2')).toBeTruthy();
    expect(screen.getByText(strings.home.bpOn('01/03/2026'))).toBeTruthy();
    expect(screen.getByTestId('current-medications')).toBeTruthy();
    expect(screen.getByText('Synthetic Metformin')).toBeTruthy();
    expect(snapshotOf).toHaveBeenCalledWith(person.id, {
      today: expect.any(String),
      bmiPreset: 'who',
    });
  });

  it('says there is no current medication when the snapshot has none', async () => {
    snapshotOf.mockReturnValue({ ...snapshot, medications: [] });
    await renderHome();

    expect(await screen.findByText(strings.home.noMedications)).toBeTruthy();
    expect(screen.queryByTestId('current-medications')).toBeNull();
  });
});
