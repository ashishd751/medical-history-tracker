import { render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '../ThemeProvider';
import { AppField } from './AppField';

describe('AppField', () => {
  it('opts out of system autofill so iOS never offers its AutoFill prompt', async () => {
    await render(
      <AppThemeProvider scheme="light">
        <AppField label="Doctor" value="" onChangeText={() => undefined} testID="field" />
      </AppThemeProvider>,
    );

    const input = screen.getByTestId('field');
    expect(input.props.autoComplete).toBe('off');
    expect(input.props.textContentType).toBe('none');
    expect(input.props.importantForAutofill).toBe('no');
  });
});
