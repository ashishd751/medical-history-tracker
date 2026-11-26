import { render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { AppFactGrid } from './AppFactGrid';

const baseWindow = { width: 360, height: 800, scale: 2, fontScale: 1 };

function renderGrid(columns: 1 | 2 | 3) {
  return render(
    <AppFactGrid
      facts={[
        { label: 'Date of birth', value: '17/04/1990', testID: 'fact-a' },
        { label: 'Sex', value: 'Female', testID: 'fact-b' },
      ]}
      columns={columns}
    />,
  );
}

describe('AppFactGrid columns', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the requested number of columns at normal text size', async () => {
    jest.spyOn(Dimensions, 'get').mockReturnValue(baseWindow);
    await renderGrid(2);
    expect(screen.getByTestId('fact-a')).toHaveStyle({ width: '50%' });
    expect(screen.getByTestId('fact-b')).toHaveStyle({ width: '50%' });
  });

  it('collapses to one column at very large OS text sizes', async () => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({ ...baseWindow, fontScale: 2 });
    await renderGrid(2);
    // A date must stay whole instead of wrapping mid-string in a narrow tile.
    expect(screen.getByTestId('fact-a')).toHaveStyle({ width: '100%' });
    expect(screen.getByTestId('fact-b')).toHaveStyle({ width: '100%' });
  });
});
