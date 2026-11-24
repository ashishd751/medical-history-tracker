/**
 * Minimal logging wrapper.
 *
 * Rule: never log medical values, file contents, OCR text or anything that could
 * identify a person. Log identifiers and error codes only (section 18).
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

function isDev(): boolean {
  // __DEV__ is injected by React Native; guarded for Node/Jest environments.
  return typeof __DEV__ === 'undefined' ? true : __DEV__;
}

function emit(level: Level, message: string, context?: Record<string, unknown>): void {
  if (!isDev() && level === 'debug') return;
  const payload = context ? [message, context] : [message];
  switch (level) {
    case 'debug':
    case 'info':
      // eslint-disable-next-line no-console
      console.log(`[${level}]`, ...payload);
      break;
    case 'warn':
      console.warn(...payload);
      break;
    case 'error':
      console.error(...payload);
      break;
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
