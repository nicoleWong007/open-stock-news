import { Type } from '@sinclair/typebox';
import type { TSchema } from '@sinclair/typebox';
import type { AgentTool } from '@mariozechner/pi-agent-core';
import { createYahooFinanceSource } from '../data/index.js';
import { createMacroFetcher } from '../engines/macro-fetcher/index.js';
import type { MarketContext } from '../engines/macro-fetcher/index.js';

const yahooSource = createYahooFinanceSource();
const macroFetcher = createMacroFetcher({ cacheTtlMs: 24 * 60 * 60 * 1000, enabled: true });

const NoParamsSchema = Type.Object({});

const SymbolSchema = Type.Object({
  symbol: Type.String({ description: 'Stock symbol (e.g. AAPL, MSFT)' }),
});

const SymbolRangeSchema = Type.Object({
  symbol: Type.String({ description: 'Stock symbol (e.g. AAPL, MSFT)' }),
  range: Type.String({ description: 'Time range: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max' }),
});

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }], details: {} };
}

function errorResult(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: 'text' as const, text: `Error: ${msg}` }],
    details: {},
  };
}

export const getStockPrice: AgentTool<typeof SymbolSchema> = {
  name: 'get_stock_price',
  label: 'Get Stock Price',
  description: 'Get current stock quote including price, change, volume, and market cap for a given symbol.',
  parameters: SymbolSchema,
  async execute(_id, params) {
    try {
      const quote = await yahooSource.getQuote(params.symbol);
      return textResult(
        `Symbol: ${quote.symbol} (${quote.name})\n` +
        `Price: ${quote.price} ${quote.currency}\n` +
        `Change: ${quote.change} (${quote.changePercent.toFixed(2)}%)\n` +
        `Volume: ${quote.volume.toLocaleString()}\n` +
        `Market Cap: ${quote.marketCap.toLocaleString()}\n` +
        `Exchange: ${quote.exchange}`,
      );
    } catch (err) {
      return errorResult(err);
    }
  },
};

export const getFinancials: AgentTool<typeof SymbolSchema> = {
  name: 'get_financials',
  label: 'Get Financials',
  description: 'Get financial report data including revenue, margins, ROE, and balance sheet metrics.',
  parameters: SymbolSchema,
  async execute(_id, params) {
    try {
      const fin = await yahooSource.getFinancials(params.symbol);
      return textResult(
        `Symbol: ${fin.symbol}\n` +
        `Period: ${fin.period}\n` +
        `Revenue: ${fin.revenue.toLocaleString()}\n` +
        `EPS: ${fin.eps}\n` +
        `Gross Margin: ${(fin.grossMargin * 100).toFixed(1)}%\n` +
        `Operating Margin: ${(fin.operatingMargin * 100).toFixed(1)}%\n` +
        `Net Margin: ${(fin.netMargin * 100).toFixed(1)}%\n` +
        `ROE: ${(fin.roe * 100).toFixed(1)}%\n` +
        `Debt/Equity: ${fin.debtToEquity}\n` +
        `Current Ratio: ${fin.currentRatio}\n` +
        `Free Cash Flow: ${fin.freeCashFlow.toLocaleString()}`,
      );
    } catch (err) {
      return errorResult(err);
    }
  },
};

export const getValuation: AgentTool<typeof SymbolSchema> = {
  name: 'get_valuation',
  label: 'Get Valuation Metrics',
  description: 'Get valuation metrics including PE, PB, PS, EV/EBITDA, PEG ratio, and dividend yield.',
  parameters: SymbolSchema,
  async execute(_id, params) {
    try {
      const val = await yahooSource.getValuationMetrics(params.symbol);
      const fmt = (v: number | null) => v !== null ? v.toFixed(2) : 'N/A';
      return textResult(
        `Symbol: ${val.symbol}\n` +
        `PE (trailing): ${fmt(val.pe)}\n` +
        `PE (forward): ${fmt(val.forwardPe)}\n` +
        `PB: ${fmt(val.pb)}\n` +
        `PS: ${fmt(val.ps)}\n` +
        `EV/EBITDA: ${fmt(val.evToEbitda)}\n` +
        `PEG: ${fmt(val.peg)}\n` +
        `Dividend Yield: ${val.dividendYield !== null ? (val.dividendYield * 100).toFixed(2) + '%' : 'N/A'}`,
      );
    } catch (err) {
      return errorResult(err);
    }
  },
};

export const getHistoricalPrices: AgentTool<typeof SymbolRangeSchema> = {
  name: 'get_historical_prices',
  label: 'Get Historical Prices',
  description: 'Get historical OHLCV price data for a stock over a specified time range.',
  parameters: SymbolRangeSchema,
  async execute(_id, params) {
    try {
      const prices = await yahooSource.getHistoricalPrices(params.symbol, params.range);
      if (prices.length === 0) {
        return textResult(`No historical data found for ${params.symbol} with range ${params.range}.`);
      }
      const header = `Date       | Open    | High    | Low     | Close   | Volume`;
      const rows = prices.slice(-30).map((p) =>
        `${p.date} | ${p.open.toFixed(2).padStart(7)} | ${p.high.toFixed(2).padStart(7)} | ${p.low.toFixed(2).padStart(7)} | ${p.close.toFixed(2).padStart(7)} | ${p.volume.toLocaleString()}`,
      );
      return textResult(`${params.symbol} — last ${Math.min(prices.length, 30)} of ${prices.length} rows\n\n${header}\n${rows.join('\n')}`);
    } catch (err) {
      return errorResult(err);
    }
  },
};

export const getMarketContext: AgentTool<typeof NoParamsSchema> = {
  name: 'get_market_context',
  label: 'Get Market Context',
  description: `Get current macro market context including:
- Major indices (S&P 500, NASDAQ, DOW)
- Sector performance
- Market sentiment (VIX, Put/Call ratio)
- Economic indicators (rates, unemployment, GDP)
- Commodities (DXY, Oil, Gold)

Data is cached for 24 hours and refreshed automatically.`,
  parameters: NoParamsSchema,
  async execute(_id, _params) {
    try {
      const context = await macroFetcher.getMarketContext();
      return textResult(formatMarketContext(context));
    } catch (err) {
      return errorResult(err);
    }
  },
};

function formatMarketContext(ctx: MarketContext): string {
  const idx = ctx.indices;
  const sent = ctx.sentiment;
  const econ = ctx.economic;
  const comm = ctx.commodities;

  const sectorRows = ctx.sectors
    .map((s) => `${s.name}: ${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%`)
    .join(' | ');

  return `## Market Overview (${ctx.metadata.marketDate})

### Indices
| Index | Price | Change |
|-------|-------|--------|
| S&P 500 | ${idx.sp500.price.toFixed(2)} | ${idx.sp500.changePercent >= 0 ? '+' : ''}${idx.sp500.changePercent.toFixed(2)}% |
| NASDAQ | ${idx.nasdaq.price.toFixed(2)} | ${idx.nasdaq.changePercent >= 0 ? '+' : ''}${idx.nasdaq.changePercent.toFixed(2)}% |
| DOW | ${idx.dow.price.toFixed(2)} | ${idx.dow.changePercent >= 0 ? '+' : ''}${idx.dow.changePercent.toFixed(2)}% |

### Sector Performance
${sectorRows || 'No data available'}

### Sentiment
- VIX: ${sent.vix.toFixed(2)}
- Put/Call Ratio: ${sent.putCallRatio.toFixed(2)}

### Economic Indicators
- 10Y Yield: ${econ.tenYearYield.toFixed(2)}%
- Fed Funds Rate: ${econ.federalFundsRate.toFixed(2)}%
- Unemployment: ${econ.unemploymentRate.toFixed(1)}%
- GDP Growth: ${econ.gdpGrowth.toFixed(1)}%

### Commodities
- DXY: ${comm.dxy.toFixed(2)}
- WTI: $${comm.wti.toFixed(2)}
- Gold: $${comm.gold.toFixed(2)}

_Cached: ${new Date(ctx.metadata.fetchedAt).toLocaleString()}_`;
}

export function getAllTools(): AgentTool<TSchema>[] {
  return [getStockPrice, getFinancials, getValuation, getHistoricalPrices, getMarketContext] as unknown as AgentTool<TSchema>[];
}
