import { withRetry, withTimeout } from './utils.js';

const FRED_API_BASE = 'https://api.stlouisfed.org/fred/series/observations';

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

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`FRED API error: ${resp.status} ${resp.statusText}`);
    }
    const data = (await resp.json()) as FredResponse;
    return data?.observations ?? [];
  }
}

export function createFredSource(apiKey?: string): FredSource {
  return new FredSource(apiKey);
}
