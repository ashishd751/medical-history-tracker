import { createContext, type ReactNode, useContext } from 'react';
import { PaperProvider } from 'react-native-paper';

import { type AppTheme, darkTheme, lightTheme } from './theme';

const AppThemeContext = createContext<AppTheme>(lightTheme);

export interface AppThemeProviderProps {
  children: ReactNode;
  scheme: 'light' | 'dark';
}

/**
 * Provides our tokens to components and Paper's theme to Paper internals.
 * Features use `useAppTheme()`; they never import `react-native-paper` themselves.
 */
export function AppThemeProvider({ children, scheme }: AppThemeProviderProps) {
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  return (
    <AppThemeContext.Provider value={theme}>
      <PaperProvider theme={theme.paper}>{children}</PaperProvider>
    </AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppTheme {
  return useContext(AppThemeContext);
}
