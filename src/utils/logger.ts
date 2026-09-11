/**
 * Dev-only logging. Always wrap calls in `if (import.meta.env.DEV)`:
 *
 *   if (import.meta.env.DEV) logger.error('...', e);
 *
 * The guard lets the production minifier dead-code-eliminate the whole
 * statement INCLUDING its string arguments. Calling logger bare keeps the
 * strings in the shipped bundle (arguments evaluate eagerly).
 * Always use this instead of raw console.* anywhere in the app.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogArgs = any[];

export const logger = {
  log: (...args: LogArgs): void => {
    if (import.meta.env.DEV) console.log(...args);
  },
  info: (...args: LogArgs): void => {
    if (import.meta.env.DEV) console.info(...args);
  },
  warn: (...args: LogArgs): void => {
    if (import.meta.env.DEV) console.warn(...args);
  },
  error: (...args: LogArgs): void => {
    if (import.meta.env.DEV) console.error(...args);
  },
  debug: (...args: LogArgs): void => {
    if (import.meta.env.DEV) console.debug(...args);
  },
};
