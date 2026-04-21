# Macro Data Fetcher Design

## Overview

Add a macro data fetcher module that caches market-wide indicators (indices, sectors, sentiment, economic indicators, commodities) with a 24-hour TTL, reducing redundant API calls in the agent workflow.

## Goals

- Fetch macro market data once per day instead of every agent invocation
- Provide a single `get_market_context` tool for the agent
- Support graceful degradation when data sources fail
- Follow existing patterns (similar to `memo-fetcher`)

## Data Coverage (24 Data Points)

### Yahoo Finance (9 indicators)

| Indicator | Symbol | Type |
|-----------|--------|------|
| S&P 500 | `^GSPC` | Index |
| NASDAQ | `^IXIC` | Index |
| DOW | `^DJI` | Index |
| VIX | `^VIX` | Sentiment |
| Put/Call Ratio | `CPC` | Sentiment |
| 10-Year Treasury Yield | `^TNX` | Economic |
| Dollar Index | `DX-Y.NYB` | Commodity |
| WTI Crude | `CL=F` | Commodity |
| Gold | `GC=F` | Commodity |

### FRED API (4 indicators)

| Indicator | Series ID | Type |
|-----------|-----------|------|
| VIX Close | `VIXCLS` | Sentiment |
| Federal Funds Rate | `DFF` | Economic |
| Unemployment Rate | `UNRATE` | Economic |
| GDP Growth | `A191RL1Q225SBEA` | Economic |

### Sector ETFs (11 indicators)

| Sector | Symbol |
|--------|--------|
| Technology | `XLK` |
| Healthcare | `XLV` |
| Financial | `XLF` |
| Energy | `XLE` |
| Consumer Discretionary | `XLY` |
| Consumer Staples | `XLP` |
| Biotechnology | `XBI` |
| Industrial | `XLI` |
| Materials | `XLB` |
| Real Estate | `XLRE` |
| Communication | `XLC` |

## Architecture

```
src/
├── data/
│   ├── sources/
│   │   ├── yahoo-finance.ts      # Existing
│   │   └── fred-source.ts        # NEW: FRED API client
│   └── types.ts                  # Extended
│
├── engines/
│   └── macro-fetcher/
│       ├── index.ts              # Exports
│       ├── macro-fetcher.ts      # Core logic + cache
│       ├── macro-store.ts        # File storage
│       └── types.ts              # Type definitions
│
├── agent/
│   └── tools.ts                  # Add get_market_context
│
└── commands/
    └── fetch-macro.ts            # NEW: Manual command (optional)
```

## Cache Strategy

### Storage Location

```
~/.oak-invest/cache/macro-context.json
```

### TTL Rules

| Time Period | TTL | Reason |
|-------------|-----|--------|
| Weekend | 24 hours | Market closed |
| Pre-market (0-9am) | 24 hours | Using previous close |
| Trading hours (9am-4pm) | 30 minutes | Market moving |
| After hours (4pm+) | 24 hours | Close data finalized |

### Cache Validity Logic

```typescript
function isCacheValid(cache: MacroCache): boolean {
  if (!cache || !cache.data) return false;
  
  const today = getMarketDate();
  if (cache.marketDate !== today) return false;
  
  const ageMs = Date.now() - cache.fetchedAt;
  const ttlMs = getTTLForCurrentTime();
  return ageMs < ttlMs;
}
```

## Data Types

```typescript
interface MarketContext {
  indices: {
    sp500: IndexData;
    nasdaq: IndexData;
    dow: IndexData;
  };
  
  sectors: SectorData[];
  
  sentiment: {
    vix: number;
    vixClose: number;
    putCallRatio: number;
  };
  
  economic: {
    tenYearYield: number;
    federalFundsRate: number;
    unemploymentRate: number;
    gdpGrowth: number;
  };
  
  commodities: {
    dxy: number;
    wti: number;
    gold: number;
  };
  
  metadata: {
    fetchedAt: number;
    marketDate: string;
    ttl: number;
  };
}

interface IndexData {
  price: number;
  change: number;
  changePercent: number;
}

interface SectorData {
  name: string;
  symbol: string;
  changePercent: number;
}
```

## Agent Tool Integration

### New Tool: get_market_context

```typescript
export const getMarketContext: AgentTool = {
  name: 'get_market_context',
  label: 'Get Market Context',
  description: `Get current macro market context including indices, sectors, sentiment, economic indicators, and commodities. Data is cached for 24 hours.`,
  parameters: Type.Object({}),
  async execute(_id, _params) {
    const fetcher = new MacroFetcher(config);
    const context = await fetcher.getMarketContext();
    return textResult(formatMarketContext(context));
  },
};
```

### System Prompt Update

Add step 1 to analysis prompt: "Get market context using get_market_context tool"

## Error Handling

### Principles

1. Partial success > Complete failure
2. Stale cache > No data
3. Inform user of data status

### Strategies

| Scenario | Handling |
|----------|----------|
| Single indicator fails | Skip, continue others |
| FRED API fails | Use last successful cache |
| Cache file corrupted | Delete, refetch |
| Network timeout | Retry 3x with exponential backoff |
| All sources fail | Return cache if available, else error |

### Minimum Data Requirement

At minimum, `indices.sp500` must be available. If not, fall back to cached data or return error.

## Configuration

```typescript
// config/schema.ts
macro: {
  cache_ttl_hours: { type: 'number', default: 24 },
  fred_api_key_env: { type: 'string', default: 'FRED_API_KEY' },
}
```

## Dependencies

```json
{
  "dependencies": {
    "axios": "^1.x"
  }
}
```

## File Changes Summary

### New Files

- `src/data/sources/fred-source.ts`
- `src/engines/macro-fetcher/index.ts`
- `src/engines/macro-fetcher/macro-fetcher.ts`
- `src/engines/macro-fetcher/macro-store.ts`
- `src/engines/macro-fetcher/types.ts`
- `src/commands/fetch-macro.ts` (optional)

### Modified Files

- `src/agent/tools.ts` - Add `getMarketContext`
- `src/agent/system-prompt.ts` - Update analysis flow
- `src/config/schema.ts` - Add macro config
- `src/data/types.ts` - Add type definitions

## Implementation Order

1. `src/engines/macro-fetcher/types.ts` - Type definitions
2. `src/data/sources/fred-source.ts` - FRED API client
3. `src/engines/macro-fetcher/macro-store.ts` - Storage layer
4. `src/engines/macro-fetcher/macro-fetcher.ts` - Core logic
5. `src/engines/macro-fetcher/index.ts` - Exports
6. `src/agent/tools.ts` - Add tool
7. `src/config/schema.ts` - Config
8. `src/commands/fetch-macro.ts` - Manual command (optional)
9. Tests

## Out of Scope

- Real-time streaming data
- Historical macro data time series
- Custom indicator configuration (use defaults)
- Multi-market support (US only for now)
