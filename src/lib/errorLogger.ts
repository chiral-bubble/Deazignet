/**
 * Error & Network Request Logger for Dezignet
 * Tracks the last 20 client errors and failed requests in memory.
 * Automatically sanitizes and strips all tokens, authorization headers, passwords, and sensitive PII.
 */

export interface LoggedClientError {
  timestamp: string;
  type: 'error' | 'unhandledrejection' | 'network_error';
  message: string;
  url?: string;
  status?: number;
}

const MAX_ERROR_LOGS = 20;
const errorRingBuffer: LoggedClientError[] = [];

/**
 * Sanitizes strings to ensure no authorization tokens, passwords, or secrets are ever recorded
 */
function sanitizeMessage(msg: string): string {
  if (!msg) return '';
  return msg
    .replace(/bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_SECRET]')
    .replace(/eyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_.+/=]*/g, '[REDACTED_JWT]')
    .replace(/password['"]?\s*[:=]\s*['"]?[^'",\s]+['"]?/gi, 'password=[REDACTED_SECRET]')
    .replace(/apiKey['"]?\s*[:=]\s*['"]?[^'",\s]+['"]?/gi, 'apiKey=[REDACTED_SECRET]')
    .replace(/secret['"]?\s*[:=]\s*['"]?[^'",\s]+['"]?/gi, 'secret=[REDACTED_SECRET]')
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]');
}

/**
 * Pushes an error entry into the ring buffer
 */
export function recordClientError(type: LoggedClientError['type'], rawMessage: string, url?: string, status?: number): void {
  const entry: LoggedClientError = {
    timestamp: new Date().toISOString(),
    type,
    message: sanitizeMessage(rawMessage),
    url: url ? sanitizeMessage(url) : undefined,
    status
  };

  errorRingBuffer.push(entry);
  if (errorRingBuffer.length > MAX_ERROR_LOGS) {
    errorRingBuffer.shift();
  }
}

/**
 * Returns a clone of the last 20 sanitized client errors
 */
export function getRecentClientErrors(): LoggedClientError[] {
  return [...errorRingBuffer];
}

/**
 * Convenience logger for custom error events
 */
export function logClientError(error: any, context?: string): void {
  const msg = typeof error === 'string' ? error : error?.message || 'Unknown error';
  recordClientError('error', context ? `[${context}] ${msg}` : msg);
}

/**
 * Resets the in-memory error ring buffer (useful in tests)
 */
export function clearClientErrors(): void {
  errorRingBuffer.length = 0;
}

/**
 * Initializes global error listeners and fetch interceptor
 */
export function initErrorMonitoring(): void {
  if (typeof window === 'undefined') return;

  // Window error listener
  window.addEventListener('error', (event) => {
    recordClientError('error', event.message || 'Unknown runtime error', event.filename);
  });

  // Unhandled promise rejection listener
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || event.reason?.toString() || 'Unhandled promise rejection';
    recordClientError('unhandledrejection', reason);
  });

  // Fetch interceptor to log failed network calls (sanitized)
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    try {
      const response = await originalFetch.apply(this, args);
      if (!response.ok && response.status >= 400) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
        recordClientError('network_error', `HTTP ${response.status} on ${response.statusText || 'request'}`, url, response.status);
      }
      return response;
    } catch (err: any) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
      recordClientError('network_error', err?.message || 'Network fetch failure', url);
      throw err;
    }
  };
}

