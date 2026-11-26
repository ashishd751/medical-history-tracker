import { render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppThemeProvider } from '@/ui';

import { AppTabBar, type AppTabBarProps } from './AppTabBar';

/** Four routes, so the bar renders five even slots (two tabs, add, two tabs). */
const state = {
  index: 0,
  routes: [
    { key: 'home-1', name: 'home' },
    { key: 'records-1', name: 'records' },
    { key: 'profile-1', name: 'profile' },
    { key: 'settings-1', name: 'settings' },
  ],
} as unknown as BottomTabBarProps['state'];

const props = {
  state,
  descriptors: {},
  emitter: {},
  insets: { top: 0, left: 0, right: 0, bottom: 34 },
  navigateToTab: () => undefined,
  onAddPress: () => undefined,
} as unknown as AppTabBarProps;

function renderBar() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 800 },
        insets: { top: 24, left: 0, right: 0, bottom: 24 },
      }}
    >
      <AppThemeProvider scheme="light">
        <AppTabBar {...props} />
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('AppTabBar labels', () => {
  it('renders every label on one line with the tab-label token', async () => {
    await renderBar();

    for (const label of ['Home', 'Records', 'Profile', 'Settings']) {
      const node = screen.getByText(label);
      expect(node).toHaveProp('numberOfLines', 1);
      expect(node).toHaveProp('maxFontSizeMultiplier', 1.2);
      expect(node).toHaveStyle({ fontSize: 15 });
    }
    expect(screen.getByTestId('tab-add')).toBeTruthy();
  });
});
