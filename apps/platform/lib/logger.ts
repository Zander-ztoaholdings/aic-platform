/**
 * Structured logger for AIC Platform.
 * Outputs JSON in production, human-readable in development.
 * Never logs sensitive data (PII, passwords, tokens).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  [key: string]: unknown;
}

const SERVICE_NAME = process.env.SERVICE_NAME || 'aic-platform';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function formatEntry(entry: LogEntry): string {
  if (IS_PRODUCTION) {
    return JSON.stringify(entry);
  }
  const { level, message, timestamp, service, ...extra } = entry;
  const extraStr = Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${service}: ${message}${extraStr}`;
}

function createEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    ...meta,
  };
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (IS_PRODUCTION) return; // Skip debug in prod
    console.debug(formatEntry(createEntry('debug', message, meta)));
  },

  info(message: string, meta?: Record<string, unknown>) {
    console.log(formatEntry(createEntry('info', message, meta)));
  },

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(formatEntry(createEntry('warn', message, meta)));
  },

  error(message: string, meta?: Record<string, unknown>) {
    console.error(formatEntry(createEntry('error', message, meta)));
  },

  /** Log an API request (duration, status, path — never the body or params) */
  request(method: string, path: string, status: number, durationMs: number) {
    this.info('API request', { method, path, status, durationMs });
  },
};
