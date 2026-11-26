import { fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { AppThemeProvider } from '../ThemeProvider';
import { AppChoiceGrid } from './AppChoiceGrid';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
] as const;

describe('AppChoiceGrid', () => {
  it('marks the single selected option and reports the press', async () => {
    const onSelect = jest.fn();
    await render(
      <AppThemeProvider scheme="light">
        <AppChoiceGrid options={options} selected="b" onSelect={onSelect} testIDPrefix="opt" />
      </AppThemeProvider>,
    );

    expect(screen.getByTestId('opt-b').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('opt-a').props.accessibilityState).toEqual({ selected: false });

    await fireEvent.press(screen.getByTestId('opt-a'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('supports multi-select without deciding the toggle itself', async () => {
    const onSelect = jest.fn();
    await render(
      <AppThemeProvider scheme="light">
        <AppChoiceGrid
          options={options}
          selected={['a']}
          onSelect={onSelect}
          testIDPrefix="multi"
        />
      </AppThemeProvider>,
    );

    expect(screen.getByTestId('multi-a').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('multi-b').props.accessibilityState).toEqual({ selected: false });

    // The grid reports the tap; the caller owns the add/remove rule.
    await fireEvent.press(screen.getByTestId('multi-a'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('dismisses the keyboard before reporting a choice', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const onSelect = jest.fn();
    await render(
      <AppThemeProvider scheme="light">
        <AppChoiceGrid options={options} selected={null} onSelect={onSelect} testIDPrefix="kb" />
      </AppThemeProvider>,
    );

    await fireEvent.press(screen.getByTestId('kb-b'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('b');
    dismiss.mockRestore();
  });
});
