import { render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { AppThemeProvider } from '@/ui';

import { SnapshotCard } from './SnapshotCard';

beforeEach(() => {
  // jest-expo reports fontScale 2, which makes AppFactGrid choose one column; this test is about
  // the normal two-column layout.
  jest
    .spyOn(Dimensions, 'get')
    .mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function renderSnapshot() {
  return render(
    <AppThemeProvider scheme="light">
      <SnapshotCard
        heightCm={170}
        weightKg={70}
        bloodType="O+"
        lastBp={null}
        unitSystem="metric"
        bmiPreset="who"
      />
    </AppThemeProvider>,
  );
}

describe('SnapshotCard', () => {
  it('spreads the four vitals across two equal columns', async () => {
    await renderSnapshot();

    for (const id of ['snapshot-height', 'snapshot-weight', 'bmi-value', 'snapshot-blood-type']) {
      expect(screen.getByTestId(id)).toHaveStyle({ width: '50%' });
    }
    expect(screen.getByText('170 cm')).toBeTruthy();
    expect(screen.getByText('70 kg')).toBeTruthy();
    expect(screen.getByText('24.2')).toBeTruthy();
    expect(screen.getByTestId('bmi-category')).toBeTruthy();
  });
});
