import { render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { Text } from 'react-native';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { AppThemeProvider } from '../ThemeProvider';
import { AppScreen } from './AppScreen';

/** A notched iPhone in portrait: the home indicator occupies 34 pt. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderScreen(props: Partial<ComponentProps<typeof AppScreen>> = {}) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppThemeProvider scheme="light">
        <AppScreen title="Test screen" testID="screen" {...props}>
          <Text>Body</Text>
        </AppScreen>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('AppScreen bottom inset', () => {
  it('does not pad the bottom by default, so a tab screen has no gap above the tab bar', async () => {
    await renderScreen();
    expect(screen.getByTestId('screen')).toHaveStyle({ paddingBottom: 0 });
  });

  it('does not pad a pinned-footer screen unless it opts in', async () => {
    await renderScreen({ scroll: false });
    expect(screen.getByTestId('screen')).toHaveStyle({ paddingBottom: 0 });
  });

  it('pads a pinned-footer screen that opts in', async () => {
    await renderScreen({ scroll: false, safeAreaBottom: true });
    expect(screen.getByTestId('screen')).toHaveStyle({ paddingBottom: metrics.insets.bottom });
  });

  it('ignores the opt-in while scrolling, because the scroll content pads itself', async () => {
    await renderScreen({ safeAreaBottom: true });
    expect(screen.getByTestId('screen')).toHaveStyle({ paddingBottom: 0 });
  });
});
