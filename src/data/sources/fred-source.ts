const FRED_API_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const TIMEOUT_MS = 30000;

class DataFetchError extends Error {
  constructor(
    public readonly seriesId: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${seriesId}] ${message}`);
    this.name = 'DataFetchError';
  }
}

async function withRetry<T>(fn: () => Promise<T>, seriesId: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes('429') || err.message.toLowerCase().includes('rate'));
      if (!isRateLimit || attempt === MAX_RETRIES - 1) {
        break;
      }
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new DataFetchError(seriesId, 'Failed after retries', lastError);
}

function withTimeout<T>(promise: Promise<T>, seriesId: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new DataFetchError(seriesId, `Request timed out after ${TIMEOUT_MS}ms`)),
      TIMEOUT_MS,
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

interface FredObservation {
  date: string;
  value: string;
}

interface FredResponse {
  observations: FredObservation[];
}

export class FredSource {
  private apiKey?: string;
  private cache: Map<string, { value: number; date: string }> = new Map();

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async getSeries(seriesId: string): Promise<number> {
    try {
      const observations = await withTimeout(
        withRetry(() => this.fetchFromFred(seriesId), seriesId),
        seriesId,
      );
      const latest = observations?.[0];
      const raw = latest?.value;
      const numeric = Number.parseFloat(raw);

      if (!Number.isNaN(numeric)) {
        const date = latest?.date ?? new Date().toISOString();
        this.cache.set(seriesId, { value: numeric, date });
        return numeric;
      } else {
        const cached = this.cache.get(seriesId);
        if (cached) return cached.value;
        throw new Error('Non-numeric value returned and no cache available');
      }
    } catch (err) {
      const cached = this.cache.get(seriesId);
      if (cached) return cached.value;
      throw err;
    }
  }

  private async fetchFromFred(seriesId: string): Promise<FredObservation[]> {
    const key = this.apiKey ?? process.env.FRED_API_KEY;
    if (!key) {
      throw new Error('FRED API key is missing');
    }

    const url = `${FRED_API_BASE}?series_id=${encodeURIComponent(seriesId)}&api_key=${encodeURIComponent(
      key,
    )}&file_type=json&limit=1&sort_order=desc`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) {
        throw new Error(`FRED API error: ${resp.status} ${resp.statusText}`);
      }
      const data = (await resp.json()) as FredResponse;
      return data?.observations ?? [];
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function createFredSource(apiKey?: string): FredSource {
  return new FredSource(apiKey);
}
