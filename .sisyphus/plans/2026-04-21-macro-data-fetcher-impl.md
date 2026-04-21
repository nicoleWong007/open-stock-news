# Implementation Plan: Macro Data Fetcher

Based on: `docs/superpowers/specs/2026-04-21-macro-data-fetcher-design.md`

## Overview

Implement a macro data fetcher module that caches 24 market indicators with intelligent TTL based on US market trading hours (including DST handling).

## Implementation Units

### Unit 1: Type Definitions

**File**: `src/engines/macro-fetcher/types.ts`

**Tasks**:
- [ ] Define `IndexData` interface
- [ ] Define `SectorData` interface
- [ ] Define `SentimentData` interface
- [ ] Define `EconomicData` interface
- [ ] Define `CommoditiesData` interface
- [ ] Define `MarketContext` interface
- [ ] Define `MacroCache` interface
- [ ] Define `MacroConfig` interface

**Dependencies**: None

**Verification**: TypeScript compilation passes

---

### Unit 2: FRED API Client

**File**: `src/data/sources/fred-source.ts`

**Tasks**:
- [ ] Create `FredSource` class
- [ ] Implement `getSeries(seriesId: string)` method
- [ ] Add error handling for API failures
- [ ] Add local memory cache for series values
- [ ] Support FRED API key from environment variable

**Dependencies**: None

**Verification**: Unit tests pass

---

### Unit 3: Macro Store (File Storage)

**File**: `src/engines/macro-fetcher/macro-store.ts`

**Tasks**:
- [ ] Define cache file path (`~/.oak-invest/cache/macro-context.json`)
- [ ] Implement `load(): Promise<MarketContext | null>`
- [ ] Implement `save(context: MarketContext): Promise<void>`
- [ ] Implement `clear(): Promise<void>`
- [ ] Handle corrupted cache files (delete and return null)

**Dependencies**: Unit 1 (types)

**Verification**: Unit tests pass

---

### Unit 4: DST Detection Utility

**File**: `src/engines/macro-fetcher/time-utils.ts`

**Tasks**:
- [ ] Implement `isUsDaylightSavingTime(date: Date): boolean`
- [ ] Implement `getNthSundayOfMonth(year, month, n): number` (timestamp)
- [ ] Implement `getMarketDate(): string` (current US trading date)
- [ ] Implement `getTTLForCurrentTime(): number`

**Dependencies**: None

**Verification**: Unit tests with known DST dates

---

### Unit 5: Macro Fetcher Core

**File**: `src/engines/macro-fetcher/macro-fetcher.ts`

**Tasks**:
- [ ] Create `MacroFetcher` class
- [ ] Implement `getMarketContext(): Promise<MarketContext>`
- [ ] Implement `isCacheValid(cache): boolean`
- [ ] Implement `fetchIndices()` - parallel Yahoo calls for ^GSPC, ^IXIC, ^DJI
- [ ] Implement `fetchSectors()` - parallel Yahoo calls for 11 sector ETFs
- [ ] Implement `fetchSentiment()` - Yahoo for ^VIX, CPC + FRED for VIXCLS
- [ ] Implement `fetchEconomic()` - Yahoo for ^TNX + FRED for DFF, UNRATE, GDP
- [ ] Implement `fetchCommodities()` - Yahoo for DX-Y.NYB, CL=F, GC=F
- [ ] Implement `mergeResults()` - combine successful fetches with cache fallback
- [ ] Implement `hasMinimumData()` - check if sp500 data exists

**Dependencies**: Unit 1, 2, 3, 4

**Verification**: Integration tests pass

---

### Unit 6: Macro Fetcher Index

**File**: `src/engines/macro-fetcher/index.ts`

**Tasks**:
- [ ] Export `MacroFetcher` class
- [ ] Export all types from `types.ts`
- [ ] Export `createMacroFetcher(config)` factory function

**Dependencies**: Unit 5

**Verification**: TypeScript compilation passes

---

### Unit 7: Agent Tool Integration

**File**: `src/agent/tools.ts`

**Tasks**:
- [ ] Import `MacroFetcher` and types
- [ ] Create `NoParamsSchema` (empty object schema)
- [ ] Implement `getMarketContext` tool
- [ ] Implement `formatMarketContext()` formatter
- [ ] Add tool to `getAllTools()` export

**Dependencies**: Unit 6

**Verification**: Agent can call the tool successfully

---

### Unit 8: Configuration Schema

**File**: `src/config/schema.ts`

**Tasks**:
- [ ] Add `macro` section to config schema
- [ ] Add `cache_ttl_hours` option (default: 24)
- [ ] Add `fred_api_key_env` option (default: 'FRED_API_KEY')
- [ ] Add `enabled` option (default: true)

**Dependencies**: None

**Verification**: Config loads correctly with new options

---

### Unit 9: Manual Fetch Command (Optional)

**File**: `src/commands/fetch-macro.ts`

**Tasks**:
- [ ] Create `fetch-macro` command
- [ ] Add `--force` flag to bypass cache
- [ ] Add `--status` flag to show cache status
- [ ] Register command in CLI

**Dependencies**: Unit 6, 8

**Verification**: Command runs successfully

---

## Execution Order

```
Unit 1 ─────────────────────────────────────────┐
                                                │
Unit 2 ─────────────────────────────────────────┤
                                                │
Unit 3 ◄── Unit 1 ──────────────────────────────┤
                                                │
Unit 4 ─────────────────────────────────────────┤
                                                │
Unit 5 ◄── Unit 1, 2, 3, 4 ─────────────────────┤
                                                │
Unit 6 ◄── Unit 5 ──────────────────────────────┤
                                                │
Unit 7 ◄── Unit 6 ──────────────────────────────┤
                                                │
Unit 8 ─────────────────────────────────────────┤
                                                │
Unit 9 ◄── Unit 6, 8 ───────────────────────────┘
```

## Parallel Execution

Units that can run in parallel:
- Unit 1, 2, 4, 8 (no dependencies)
- Unit 3 (depends only on Unit 1)

Recommended parallel groups:
- **Group A**: Unit 1, 2, 4, 8
- **Group B**: Unit 3 (after Unit 1)
- **Group C**: Unit 5 (after all previous)
- **Group D**: Unit 6, 7, 9 (after Unit 5)

## Dependencies

Add to `package.json`:
```json
{
  "dependencies": {
    "axios": "^1.x"
  }
}
```

## Testing Strategy

- Unit tests for each module
- Mock Yahoo Finance and FRED API responses
- Test DST calculation with known dates
- Test cache TTL logic at different times
- Integration test for full fetch cycle

## Success Criteria

- [ ] All 24 data points can be fetched
- [ ] Cache file is created at correct location
- [ ] TTL respects market hours and DST
- [ ] Agent tool returns formatted market context
- [ ] Graceful degradation when partial data fails
- [ ] All tests pass
