import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { PersonRow } from '@/data';
import { SessionProvider, type SessionState } from '@/lib/session';
import { AppThemeProvider, strings } from '@/ui';

import { ExportScreen } from './ExportScreen';

const mockDefaultPreferences = {
  columns: ['date', 'symptoms', 'doctor', 'condition', 'readings', 'comments'],
  sortOrder: 'newest',
  filter: { from: null, to: null, kinds: [] },
};

const mockGetPreferences = jest.fn();
const mockSavePreferences = jest.fn<{ ok: boolean; value: boolean }, [preferences: unknown]>(
  () => ({ ok: true, value: true }),
);
const mockCount = jest.fn<number, [personId: string, filter: unknown]>(() => 2);
const mockPeopleList = jest.fn();

jest.mock('@/data', () => ({
  DEFAULT_EXPORT_PREFERENCES: mockDefaultPreferences,
  getRepositories: () => ({
    ok: true,
    value: {
      settings: {
        getExportPreferences: () => mockGetPreferences(),
        saveExportPreferences: (preferences: unknown) => mockSavePreferences(preferences),
      },
    },
  }),
  requireRepositories: () => ({
    people: { list: () => mockPeopleList() },
    records: { count: (personId: string, filter: unknown) => mockCount(personId, filter) },
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const mockGenerate = jest.fn();
jest.mock('./exportService', () => ({
  generateAndShareExport: (...args: unknown[]) => mockGenerate(...args),
}));

jest.mock('./exportDeps', () => ({ createExportDeps: () => ({}) }));

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

const session: SessionState = {
  ready: true,
  error: null,
  personId: person.id,
  personName: person.name,
  unitSystem: 'metric',
  bmiPreset: 'asian',
  onboarded: true,
  refresh: jest.fn(),
};

function renderScreen() {
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
            <ExportScreen />
          </SessionProvider>
        </QueryClientProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockGetPreferences.mockReset();
  mockGetPreferences.mockReturnValue(mockDefaultPreferences);
  mockSavePreferences.mockClear();
  mockCount.mockReset();
  mockCount.mockReturnValue(2);
  mockPeopleList.mockReset();
  mockPeopleList.mockReturnValue([person]);
  mockGenerate.mockReset();
});

describe('ExportScreen', () => {
  it('shows the live count from the same predicate the PDF uses', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText(strings.export.count(2))).toBeTruthy());

    expect(mockCount).toHaveBeenCalledWith(person.id, {
      from: undefined,
      to: undefined,
      kinds: [],
    });
    expect(screen.getByTestId('export-generate')).toBeTruthy();
  });

  it('starts from the six default columns and says the page is landscape', async () => {
    await renderScreen();
    expect(screen.getByTestId('export-orientation')).toBeTruthy();
    expect(screen.getByText(strings.export.landscapeNote)).toBeTruthy();
  });

  it('adds a column, keeps the landscape note and saves the choice', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('export-column-title'));

    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          columns: ['date', 'title', 'symptoms', 'doctor', 'condition', 'readings', 'comments'],
        }),
      ),
    );
    expect(screen.getByText(strings.export.landscapeNote)).toBeTruthy();
  });

  it('returns to portrait below six columns', async () => {
    mockGetPreferences.mockReturnValue({ ...mockDefaultPreferences, columns: ['date'] });
    await renderScreen();
    expect(screen.getByText(strings.export.portraitNote)).toBeTruthy();

    // date + title + type + symptoms + doctor = five columns, still portrait.
    for (const column of ['title', 'type', 'symptoms', 'doctor']) {
      await fireEvent.press(screen.getByTestId(`export-column-${column}`));
    }
    await waitFor(() => expect(screen.getByText(strings.export.portraitNote)).toBeTruthy());

    // The sixth column switches the page to landscape.
    await fireEvent.press(screen.getByTestId('export-column-condition'));
    await waitFor(() => expect(screen.getByText(strings.export.landscapeNote)).toBeTruthy());
  });

  it('filters by record type and remembers it', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('export-kind-lab_test'));

    await waitFor(() =>
      expect(mockCount).toHaveBeenLastCalledWith(person.id, {
        from: undefined,
        to: undefined,
        kinds: ['lab_test'],
      }),
    );
    expect(mockSavePreferences).toHaveBeenLastCalledWith(
      expect.objectContaining({ filter: expect.objectContaining({ kinds: ['lab_test'] }) }),
    );
  });

  it('remembers the sort order', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('export-sort-oldest'));

    await waitFor(() =>
      expect(mockSavePreferences).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortOrder: 'oldest' }),
      ),
    );
  });

  it('disables Generate and explains when nothing matches', async () => {
    mockCount.mockReturnValue(0);
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('export-no-matches')).toBeTruthy());
    expect(screen.getByText(strings.export.noMatches)).toBeTruthy();
    expect(screen.getByTestId('export-generate').props.accessibilityState.disabled).toBe(true);
  });

  it('disables Generate when the custom range is backwards', async () => {
    mockGetPreferences.mockReturnValue({
      ...mockDefaultPreferences,
      filter: { from: '2026-06-01', to: '2026-01-01', kinds: [] },
    });
    await renderScreen();

    expect(screen.getByTestId('export-invalid-range')).toBeTruthy();
    expect(screen.getByText(strings.export.invalidRange)).toBeTruthy();
    expect(screen.getByTestId('export-generate').props.accessibilityState.disabled).toBe(true);
  });

  it('restores the stored columns, sort order and filters', async () => {
    mockGetPreferences.mockReturnValue({
      columns: ['date', 'comments'],
      sortOrder: 'oldest',
      filter: { from: '2026-01-01', to: '2026-06-30', kinds: ['vaccination'] },
    });
    await renderScreen();

    expect(screen.getByText(strings.export.portraitNote)).toBeTruthy();
    await waitFor(() =>
      expect(mockCount).toHaveBeenCalledWith(person.id, {
        from: '2026-01-01',
        to: '2026-06-30',
        kinds: ['vaccination'],
      }),
    );
    // The remembered range is shown as a custom period, so its dates are editable.
    expect(screen.getByTestId('export-from')).toBeTruthy();
  });

  it('reports a successful export in an in-app banner', async () => {
    mockGenerate.mockResolvedValue({
      ok: true,
      value: {
        shared: true,
        recordCount: 2,
        fileName: 'x.pdf',
        uri: 'file:///x.pdf',
        pages: 1,
        elapsedMs: 5,
      },
    });
    await renderScreen();
    await waitFor(() => expect(screen.getByText(strings.export.count(2))).toBeTruthy());

    await fireEvent.press(screen.getByTestId('export-generate'));

    await waitFor(() => expect(screen.getByText(strings.export.done(2))).toBeTruthy());
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        personId: person.id,
        sortOrder: 'newest',
        columns: mockDefaultPreferences.columns,
      }),
    );
  });

  it('warns when the device has no share sheet', async () => {
    mockGenerate.mockResolvedValue({
      ok: true,
      value: {
        shared: false,
        recordCount: 2,
        fileName: 'x.pdf',
        uri: 'file:///x.pdf',
        pages: 1,
        elapsedMs: 5,
      },
    });
    await renderScreen();
    await waitFor(() => expect(screen.getByText(strings.export.count(2))).toBeTruthy());

    await fireEvent.press(screen.getByTestId('export-generate'));

    await waitFor(() => expect(screen.getByText(strings.export.shareUnavailable)).toBeTruthy());
  });

  it('shows the friendly message when generation fails', async () => {
    mockGenerate.mockResolvedValue({
      ok: false,
      error: { code: 'EXPORT_FAILED', detail: 'boom' },
    });
    await renderScreen();
    await waitFor(() => expect(screen.getByText(strings.export.count(2))).toBeTruthy());

    await fireEvent.press(screen.getByTestId('export-generate'));

    await waitFor(() => expect(screen.getByText(strings.errors.exportFailed)).toBeTruthy());
  });
});
