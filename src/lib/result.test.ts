import { appError, isCancellation, userMessage } from './errors';
import { err, flatMapResult, isErr, isOk, mapResult, ok, unwrapOr } from './result';

describe('Result helpers', () => {
  it('wraps success values', () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(result.ok && result.value).toBe(42);
  });

  it('wraps errors and detects them', () => {
    const result = err(appError('FILE_NOT_FOUND', 'missing'));
    expect(isErr(result)).toBe(true);
    expect(!result.ok && result.error.code).toBe('FILE_NOT_FOUND');
  });

  it('unwrapOr falls back only on error', () => {
    expect(unwrapOr(ok('a'), 'fallback')).toBe('a');
    expect(unwrapOr(err(appError('UNKNOWN', 'x')), 'fallback')).toBe('fallback');
  });

  it('maps only successful values', () => {
    expect(mapResult(ok(2), (n) => n * 2)).toEqual({ ok: true, value: 4 });
    const failure = err(appError('UNKNOWN', 'x'));
    expect(mapResult(failure, (n: number) => n * 2)).toBe(failure);
  });

  it('short-circuits chained steps', () => {
    const doubled = flatMapResult(ok(2), (n) => ok(n * 2));
    expect(doubled).toEqual({ ok: true, value: 4 });

    const failure = err(appError('UNKNOWN', 'x'));
    expect(flatMapResult(failure, (n: number) => ok(n))).toBe(failure);
  });
});

describe('AppError', () => {
  it('maps codes to friendly messages and never leaks detail', () => {
    const error = appError('FILE_WRITE_FAILED', 'ENOSPC at /data/x');
    const message = userMessage(error);
    expect(message).not.toContain('ENOSPC');
    expect(message.length).toBeGreaterThan(0);
  });

  it('recognises user cancellation', () => {
    expect(isCancellation(appError('CANCELLED', 'picker dismissed'))).toBe(true);
    expect(isCancellation(appError('UNKNOWN', 'boom'))).toBe(false);
  });
});
