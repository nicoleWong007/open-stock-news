export const MAX_RETRIES = 3;
export const BASE_DELAY_MS = 1000;
export const TIMEOUT_MS = 30000;

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

export interface TimeoutOptions {
  timeoutMs?: number;
}

/** Thrown on retry exhaustion or timeout. `identifier` is a domain label (series ID, symbol, etc.). */
export class DataFetchError extends Error {
  constructor(
    public readonly identifier: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${identifier}] ${message}`);
    this.name = 'DataFetchError';
  }
}

/** Exponential back-off retry — only retries on rate-limit errors (429 / "rate"). */
export async function withRetry<T>(
  fn: () => Promise<T>,
  identifier: string,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? MAX_RETRIES;
  const baseDelayMs = options?.baseDelayMs ?? BASE_DELAY_MS;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes('429') || err.message.toLowerCase().includes('rate'));
      if (!isRateLimit || attempt === maxRetries - 1) {
        break;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new DataFetchError(identifier, 'Failed after retries', lastError);
}

/** Rejects with DataFetchError on timeout. */
export function withTimeout<T>(
  promise: Promise<T>,
  identifier: string,
  options?: TimeoutOptions,
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? TIMEOUT_MS;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new DataFetchError(identifier, `Request timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
