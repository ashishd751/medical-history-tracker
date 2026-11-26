import { render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '../ThemeProvider';
import { AppBadge } from './AppBadge';
import { AppListRow } from './AppListRow';

describe('AppListRow', () => {
  it('keeps the record title larger than the type badge', async () => {
    await render(
      <AppThemeProvider scheme="light">
        <AppListRow
          title="Covid"
          badge={<AppBadge label="Doctor visit" tone="primary" />}
          meta="26/11/2026"
        />
      </AppThemeProvider>,
    );

    // The badge is a 13 pt caption; the title must read as the row's subject at 16 pt semibold.
    expect(screen.getByText('Covid')).toHaveStyle({ fontSize: 16, fontWeight: '600' });
    expect(screen.getByText('Doctor visit')).toHaveStyle({ fontSize: 13 });
  });
});
