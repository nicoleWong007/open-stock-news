import { YahooFinanceSource, FredSource } from '../../data/index.js';
import type { StockQuote } from '../../data/index.js';
import { MacroStore } from './macro-store.js';
import { getMarketDate, getTTLForCurrentTime } from './time-utils.js';
import type { MarketContext, IndexData, SectorData, MacroConfig } from './types.js';

// Sector ETFs for market breadth
const SECTOR_ETFS: { symbol: string; name: string }[] = [
  { symbol: 'XLK', name: 'Technology' },
  { symbol: 'XLV', name: 'Healthcare' },
  { symbol: 'XLF', name: 'Financial' },
  { symbol: 'XLE', name: 'Energy' },
  { symbol: 'XLY', name: 'Consumer Discretionary' },
  { symbol: 'XLP', name: 'Consumer Staples' },
  { symbol: 'XBI', name: 'Biotechnology' },
  { symbol: 'XLI', name: 'Industrial' },
  { symbol: 'XLB', name: 'Materials' },
  { symbol: 'XLRE', name: 'Real Estate' },
  { symbol: 'XLC', name: 'Communication' },
];

export class MacroFetcher {
  private yahoo: YahooFinanceSource;
  private fred: FredSource;
  private store: MacroStore;
  private config: MacroConfig;

  constructor(config: MacroConfig) {
    this.yahoo = new YahooFinanceSource();
    this.fred = new FredSource(config.fredApiKey);
    this.store = new MacroStore();
    this.config = config;
  }

  async getMarketContext(): Promise<MarketContext> {
    // 1. Check cache
    const cached = await this.store.load();
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    // 2. Fetch all data in parallel
    const [indices, sectors, sentiment, economic, commodities] = await Promise.allSettled([
      this.fetchIndices(),
      this.fetchSectors(),
      this.fetchSentiment(),
      this.fetchEconomic(),
      this.fetchCommodities(),
    ]);

    // 3. Merge with cache for failed requests
    const context = this.mergeResults(
      {
        indices: indices.status === 'fulfilled' ? (indices as any).value : undefined,
        sectors: sectors.status === 'fulfilled' ? (sectors as any).value : undefined,
        sentiment: sentiment.status === 'fulfilled' ? (sentiment as any).value : undefined,
        economic: economic.status === 'fulfilled' ? (economic as any).value : undefined,
        commodities: commodities.status === 'fulfilled' ? (commodities as any).value : undefined,
      },
      cached
    );

    // 4. Save and return
    await this.store.save(context);
    return context;
  }

  private isCacheValid(cache: MarketContext): boolean {
    if (!cache || !cache.metadata) return false;
    const today = getMarketDate();
    if (cache.metadata.marketDate !== today) return false;
    const ageMs = Date.now() - cache.metadata.fetchedAt;
    return ageMs < getTTLForCurrentTime();
  }

  private async fetchIndices(): Promise<{ sp500: IndexData; nasdaq: IndexData; dow: IndexData }> {
    const [sp500Quote, nasdaqQuote, dowQuote] = await Promise.all([
      this.yahoo.getQuote('^GSPC'),
      this.yahoo.getQuote('^IXIC'),
      this.yahoo.getQuote('^DJI'),
    ]);

    return {
      sp500: this.quoteToIndexData(sp500Quote),
      nasdaq: this.quoteToIndexData(nasdaqQuote),
      dow: this.quoteToIndexData(dowQuote),
    };
  }

  private async fetchSectors(): Promise<SectorData[]> {
    const quotes = await Promise.all(
      SECTOR_ETFS.map(async (etf) => {
        try {
          const quote = await this.yahoo.getQuote(etf.symbol);
          return {
            name: etf.name,
            symbol: etf.symbol,
            changePercent: quote.changePercent,
          } as SectorData;
        } catch {
          return null;
        }
      })
    );

    return quotes.filter((q): q is SectorData => q !== null);
  }

  private async fetchSentiment(): Promise<{ vix: number; vixClose: number; putCallRatio: number }> {
    const [vixQuote, cpcQuote, vixClose] = await Promise.allSettled([
      this.yahoo.getQuote('^VIX'),
      this.yahoo.getQuote('CPC'),
      this.fred.getSeries('VIXCLS'),
    ]);

    return {
      vix: vixQuote.status === 'fulfilled' ? (vixQuote.value as StockQuote).price : 0,
      vixClose: vixClose.status === 'fulfilled' ? (vixClose.value as number) : 0,
      putCallRatio: cpcQuote.status === 'fulfilled' ? (cpcQuote.value as StockQuote).price : 0,
    };
  }

  private async fetchEconomic(): Promise<{
    tenYearYield: number;
    federalFundsRate: number;
    unemploymentRate: number;
    gdpGrowth: number;
  }> {
    const [tenYearQuote, fedFundsRate, unemploymentRate, gdpGrowth] = await Promise.allSettled([
      this.yahoo.getQuote('^TNX'),
      this.fred.getSeries('DFF'),
      this.fred.getSeries('UNRATE'),
      this.fred.getSeries('A191RL1Q225SBEA'),
    ]);

    return {
      tenYearYield: tenYearQuote.status === 'fulfilled' ? tenYearQuote.value.price : 0,
      federalFundsRate: fedFundsRate.status === 'fulfilled' ? (fedFundsRate.value as number) : 0,
      unemploymentRate: unemploymentRate.status === 'fulfilled' ? (unemploymentRate.value as number) : 0,
      gdpGrowth: gdpGrowth.status === 'fulfilled' ? (gdpGrowth.value as number) : 0,
    };
  }

  private async fetchCommodities(): Promise<{ dxy: number; wti: number; gold: number }> {
    const [dxyQuote, wtiQuote, goldQuote] = await Promise.allSettled([
      this.yahoo.getQuote('DX-Y.NYB'),
      this.yahoo.getQuote('CL=F'),
      this.yahoo.getQuote('GC=F'),
    ]);

    return {
      dxy: dxyQuote.status === 'fulfilled' ? (dxyQuote.value as StockQuote).price : 0,
      wti: wtiQuote.status === 'fulfilled' ? (wtiQuote.value as StockQuote).price : 0,
      gold: goldQuote.status === 'fulfilled' ? (goldQuote.value as StockQuote).price : 0,
    };
  }

  private quoteToIndexData(quote: StockQuote): IndexData {
    return {
      symbol: quote.symbol,
      name: quote.name,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
    };
  }

  private mergeResults(
    partial: Partial<Omit<MarketContext, 'metadata'>>,
    cached?: MarketContext | null
  ): MarketContext {
    const defaultContext: MarketContext = {
      indices: { sp500: { symbol: '', name: '', price: 0, change: 0, changePercent: 0 }, nasdaq: { symbol: '', name: '', price: 0, change: 0, changePercent: 0 }, dow: { symbol: '', name: '', price: 0, change: 0, changePercent: 0 } },
      sectors: [],
      sentiment: { vix: 0, vixClose: 0, putCallRatio: 0 },
      economic: { tenYearYield: 0, federalFundsRate: 0, unemploymentRate: 0, gdpGrowth: 0 },
      commodities: { dxy: 0, wti: 0, gold: 0 },
      metadata: {
        fetchedAt: Date.now(),
        marketDate: getMarketDate(),
        ttl: getTTLForCurrentTime(),
      },
    };

    return {
      indices: partial.indices ?? cached?.indices ?? defaultContext.indices,
      sectors: partial.sectors ?? cached?.sectors ?? defaultContext.sectors,
      sentiment: partial.sentiment ?? cached?.sentiment ?? defaultContext.sentiment,
      economic: partial.economic ?? cached?.economic ?? defaultContext.economic,
      commodities: partial.commodities ?? cached?.commodities ?? defaultContext.commodities,
      metadata: {
        fetchedAt: Date.now(),
        marketDate: getMarketDate(),
        ttl: getTTLForCurrentTime(),
      },
    };
  }
}

export function createMacroFetcher(config: MacroConfig): MacroFetcher {
  return new MacroFetcher(config);
}
