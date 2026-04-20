import { Type } from '@sinclair/typebox';
import type { TSchema } from '@sinclair/typebox';
import type { AgentTool } from '@mariozechner/pi-agent-core';
import { createYahooFinanceSource } from '../data/index.js';

const yahooSource = createYahooFinanceSource();

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

export function getAllTools(): AgentTool<TSchema>[] {
  return [getStockPrice, getFinancials, getValuation, getHistoricalPrices] as unknown as AgentTool<TSchema>[];
}
