import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { logger } from '@/lib/logger';
import { AppThemeProvider, useAppTheme } from '@/ui/ThemeProvider';

/**
 * Paints the themed background behind the navigator.
 *
 * Without this, Paper themes the text and cards but the native window stays light, so
 * dark mode renders pale text on white (unreadable). Syncing the Android window colour
 * also removes the white flash between screens.
 */
function ThemedNavigator() {
  const { colors } = useAppTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch((error: unknown) => {
      logger.warn('Could not set the system background colour', { error: String(error) });
    });
  }, [colors.background]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </View>
  );
}

/**
 * Route files must use a default export (Expo Router requirement); every other
 * module in this project uses named exports (section 16).
 */
export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <SafeAreaProvider>
      <AppThemeProvider scheme={scheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <ThemedNavigator />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
