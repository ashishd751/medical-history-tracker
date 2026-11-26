import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('publishes the new value only after it has stopped changing', async () => {
    jest.useFakeTimers();
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'a' } },
    );
    expect(result.current).toBe('a');

    await rerender({ value: 'ab' });
    expect(result.current).toBe('a');

    await act(async () => {
      jest.advanceTimersByTime(249);
    });
    expect(result.current).toBe('a');

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('ab');
  });

  it('restarts the delay when another keystroke arrives', async () => {
    jest.useFakeTimers();
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'a' } },
    );

    await rerender({ value: 'ab' });
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    await rerender({ value: 'abc' });
    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    // The first timer would have fired by now; the second one has 50 ms left.
    expect(result.current).toBe('a');

    await act(async () => {
      jest.advanceTimersByTime(50);
    });
    expect(result.current).toBe('abc');
  });
});
