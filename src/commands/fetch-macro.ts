import type { Command } from 'commander';
import { createMacroFetcher, createMacroStore } from '../engines/macro-fetcher/index.js';

export function registerFetchMacroCommand(program: Command): void {
  const cmd = program
    .command('fetch-macro')
    .description('Fetch and manage macro market data');

  cmd
    .command('now')
    .description('Fetch macro market data now (ignores cache)')
    .option('-f, --force', 'Force refresh even if cache is valid', false)
    .action(async (options) => {
      const store = createMacroStore();
      
      if (options.force) {
        await store.clear();
        console.log('Cache cleared.');
      }

      const fetcher = createMacroFetcher({
        cacheTtlMs: 0,
        enabled: true,
      });

      console.log('Fetching macro market data...');
      
      try {
        const context = await fetcher.getMarketContext();
        console.log('\nMacro data fetched successfully!');
        console.log(`Market date: ${context.metadata.marketDate}`);
        console.log(`Cache path: ${store.getCachePath()}`);
        console.log(`\nIndices:`);
        console.log(`  S&P 500: ${context.indices.sp500.price.toFixed(2)} (${context.indices.sp500.changePercent >= 0 ? '+' : ''}${context.indices.sp500.changePercent.toFixed(2)}%)`);
        console.log(`  NASDAQ: ${context.indices.nasdaq.price.toFixed(2)} (${context.indices.nasdaq.changePercent >= 0 ? '+' : ''}${context.indices.nasdaq.changePercent.toFixed(2)}%)`);
        console.log(`  DOW: ${context.indices.dow.price.toFixed(2)} (${context.indices.dow.changePercent >= 0 ? '+' : ''}${context.indices.dow.changePercent.toFixed(2)}%)`);
        console.log(`\nSentiment:`);
        console.log(`  VIX: ${context.sentiment.vix.toFixed(2)}`);
        console.log(`  Put/Call Ratio: ${context.sentiment.putCallRatio.toFixed(2)}`);
      } catch (err) {
        console.error('Failed to fetch macro data:', err);
        process.exit(1);
      }
    });

  cmd
    .command('status')
    .description('Show current macro data cache status')
    .action(async () => {
      const store = createMacroStore();
      const cached = await store.load();

      if (!cached) {
        console.log('No cached macro data found.');
        console.log(`Cache path: ${store.getCachePath()}`);
        return;
      }

      const ageMs = Date.now() - cached.metadata.fetchedAt;
      const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
      const ageMins = Math.floor((ageMs % (60 * 60 * 1000)) / (60 * 1000));

      console.log('Macro Data Cache Status');
      console.log('----------------------');
      console.log(`Cache path: ${store.getCachePath()}`);
      console.log(`Market date: ${cached.metadata.marketDate}`);
      console.log(`Fetched at: ${new Date(cached.metadata.fetchedAt).toLocaleString()}`);
      console.log(`Age: ${ageHours}h ${ageMins}m ago`);
      console.log(`\nIndices:`);
      console.log(`  S&P 500: ${cached.indices.sp500.price.toFixed(2)}`);
      console.log(`  NASDAQ: ${cached.indices.nasdaq.price.toFixed(2)}`);
      console.log(`  DOW: ${cached.indices.dow.price.toFixed(2)}`);
      console.log(`\nSentiment:`);
      console.log(`  VIX: ${cached.sentiment.vix.toFixed(2)}`);
      console.log(`  Put/Call Ratio: ${cached.sentiment.putCallRatio.toFixed(2)}`);
    });

  cmd
    .command('clear')
    .description('Clear the macro data cache')
    .action(async () => {
      const store = createMacroStore();
      await store.clear();
      console.log('Macro data cache cleared.');
      console.log(`Cache path: ${store.getCachePath()}`);
    });
}
