import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { AppRepositories, MeasurementRow, PersonRow } from '@/data';
import type { ProfileSnapshot } from '@/domain';
import { todayIso } from '@/lib/dates';
import { SessionProvider, type SessionState } from '@/lib/session';
import { AppThemeProvider, strings } from '@/ui';

import { ProfileScreen } from './ProfileScreen';

const mockRequireRepositories = jest.fn();
jest.mock('@/data', () => ({
  requireRepositories: () => mockRequireRepositories(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
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

const snapshot: ProfileSnapshot = {
  heightCm: 172,
  weightKg: 70,
  bmi: 23.7,
  bmiCategory: 'normal',
  bloodPressure: null,
  bloodType: 'O+',
  medications: [],
};

const historyRows: readonly MeasurementRow[] = [
  {
    id: 'w2',
    personId: person.id,
    recordId: 'r1',
    kind: 'weight',
    v1: 71.2,
    v2: null,
    measuredOn: '2026-03-01',
    createdAt: 2,
    profileExcluded: false,
  },
  {
    id: 'w1',
    personId: person.id,
    recordId: null,
    kind: 'weight',
    v1: 68.4,
    v2: null,
    measuredOn: '2026-01-01',
    createdAt: 1,
    profileExcluded: false,
  },
];

const refresh = jest.fn();
const removeMeasurement = jest.fn();
const createMeasurement = jest.fn();

const session: SessionState = {
  ready: true,
  error: null,
  personId: person.id,
  personName: person.name,
  unitSystem: 'metric',
  bmiPreset: 'who',
  onboarded: true,
  refresh,
};

function repositories(overrides: Partial<AppRepositories> = {}): AppRepositories {
  return {
    people: { getById: () => person },
    profile: { snapshot: () => snapshot },
    measurements: {
      listByKind: () => [...historyRows],
      remove: removeMeasurement,
      create: createMeasurement,
    },
    ...overrides,
  } as unknown as AppRepositories;
}

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

async function openProfile() {
  await renderProfile();
  await waitFor(() => expect(screen.getByText(person.name)).toBeTruthy());
}

beforeEach(() => {
  mockRequireRepositories.mockReturnValue(repositories());
  removeMeasurement.mockReset();
  createMeasurement.mockReset();
  removeMeasurement.mockReturnValue({ ok: true, value: true });
  createMeasurement.mockReturnValue({ ok: true, value: { id: 'new' } });
});

describe('ProfileScreen facts', () => {
  it('shows the facts in tiles and keeps dates in DD/MM/YYYY', async () => {
    await openProfile();

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

  it('shows the newest value from the snapshot, not a value it derived itself', async () => {
    mockRequireRepositories.mockReturnValue(
      repositories({
        profile: {
          snapshot: () => ({ ...snapshot, weightKg: 72.4, bmi: 24.5 }),
          undo: jest.fn(),
        },
      }),
    );
    await openProfile();

    expect(screen.getByText('72.4 kg')).toBeTruthy();
    expect(screen.getByText('24.5')).toBeTruthy();
  });
});

describe('ProfileScreen measurement history', () => {
  it('lists the newest first with its date, units and where it came from', async () => {
    await openProfile();

    expect(screen.getByTestId('measurement-history')).toBeTruthy();
    expect(screen.getByText(strings.profile.fromRecord)).toBeTruthy();
    expect(screen.getByText(strings.profile.addedOnProfile)).toBeTruthy();
    expect(screen.getByText('01/03/2026')).toBeTruthy();
    expect(screen.getByText('01/01/2026')).toBeTruthy();
    // A trend needs at least two points.
    expect(screen.getByTestId('measurement-trend')).toBeTruthy();
    expect(screen.getByTestId('measurement-trend-bar-1')).toBeTruthy();
  });

  it('offers Delete only for a measurement that was added here', async () => {
    await openProfile();

    expect(screen.getByTestId('delete-measurement-w1')).toBeTruthy();
    expect(screen.queryByTestId('delete-measurement-w2')).toBeNull();
  });

  it('opens the record a value came from', async () => {
    await openProfile();

    await fireEvent.press(screen.getByTestId('measurement-w2'));
    expect(mockPush).toHaveBeenCalledWith('/record/r1');
  });

  it('switches to another kind and shows its own rows', async () => {
    mockRequireRepositories.mockReturnValue(
      repositories({
        measurements: {
          listByKind: (_personId: string, kind: string) =>
            kind === 'weight' ? [...historyRows] : [],
          remove: removeMeasurement,
          create: createMeasurement,
        } as unknown as AppRepositories['measurements'],
      }),
    );
    await openProfile();

    await fireEvent.press(screen.getByTestId('history-kind-bp'));

    expect(await screen.findByText(strings.profile.historyEmpty)).toBeTruthy();
    expect(screen.queryByTestId('measurement-w2')).toBeNull();
  });

  it('deletes a standalone measurement after confirmation', async () => {
    await openProfile();

    await fireEvent.press(screen.getByTestId('delete-measurement-w1'));
    await fireEvent.press(await screen.findByText(strings.profile.deleteMeasurementConfirm));

    expect(removeMeasurement).toHaveBeenCalledWith(person.id, 'w1');
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByText(strings.profile.measurementDeleted)).toBeTruthy();
  });
});

describe('ProfileScreen edit sheet', () => {
  it('offers blood type as a four-column choice grid', async () => {
    await openProfile();
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
    await openProfile();
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
    await openProfile();
    await fireEvent.press(screen.getByText(strings.profile.editProfile));

    await fireEvent.press(await screen.findByTestId('blood-type-A-'));
    await fireEvent.press(await screen.findByText(strings.profile.bloodTypeChangeConfirm));

    expect(screen.getByTestId('blood-type-A-').props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('sets a blood type for the first time without asking', async () => {
    mockRequireRepositories.mockReturnValue(
      repositories({
        people: { getById: () => ({ ...person, bloodType: null }) },
      } as unknown as Partial<AppRepositories>),
    );
    await openProfile();
    await fireEvent.press(screen.getByText(strings.profile.editProfile));

    await fireEvent.press(await screen.findByTestId('blood-type-A+'));

    expect(screen.queryByTestId('blood-type-dialog')).toBeNull();
    expect(screen.getByTestId('blood-type-A+').props.accessibilityState).toEqual({
      selected: true,
    });
  });
});

describe('ProfileScreen add measurement', () => {
  it('adds a metric weight for today', async () => {
    await openProfile();

    await fireEvent.press(screen.getByText(strings.profile.addMeasurement));
    await fireEvent.changeText(await screen.findByTestId('add-measurement-value'), '71.5');
    await fireEvent.press(screen.getByTestId('add-measurement-save'));

    expect(createMeasurement).toHaveBeenCalledWith(person.id, {
      kind: 'weight',
      v1: 71.5,
      v2: null,
      measuredOn: todayIso(),
    });
    expect(await screen.findByText(strings.profile.measurementSaved)).toBeTruthy();
  });

  it('refuses an implausible value without writing anything', async () => {
    await openProfile();

    await fireEvent.press(screen.getByText(strings.profile.addMeasurement));
    await fireEvent.changeText(await screen.findByTestId('add-measurement-value'), '900');
    await fireEvent.press(screen.getByTestId('add-measurement-save'));

    expect(createMeasurement).not.toHaveBeenCalled();
    expect(await screen.findByTestId('add-measurement-error')).toBeTruthy();
  });

  it('converts an imperial weight before storing it', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 360, height: 800 },
          insets: { top: 24, left: 0, right: 0, bottom: 24 },
        }}
      >
        <AppThemeProvider scheme="light">
          <QueryClientProvider client={client}>
            <SessionProvider value={{ ...session, unitSystem: 'imperial' }}>
              <ProfileScreen />
            </SessionProvider>
          </QueryClientProvider>
        </AppThemeProvider>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.getByText(person.name)).toBeTruthy());

    await fireEvent.press(screen.getByText(strings.profile.addMeasurement));
    await fireEvent.changeText(await screen.findByTestId('add-measurement-value'), '154');
    await fireEvent.press(screen.getByTestId('add-measurement-save'));

    expect(createMeasurement).toHaveBeenCalledWith(person.id, {
      kind: 'weight',
      v1: 69.85,
      v2: null,
      measuredOn: todayIso(),
    });
  });
});
