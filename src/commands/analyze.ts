import type { Command } from 'commander';
import chalk from 'chalk';
import type { AgentEvent } from '@mariozechner/pi-agent-core';
import { loadConfig } from '../config/loader.js';
import { createInvestmentAgent } from '../agent/agent.js';
import { buildAnalysisPrompt } from '../agent/system-prompt.js';
import { formatReportHeader, formatReportFooter } from '../output/report-formatter.js';
import { ExperienceStore } from '../evolution/memory/experience-store.js';
import { detectMarket, generateId, type StockCategory } from '../evolution/index.js';

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze <symbols...>')
    .description('Analyze stocks using Howard Marks investment philosophy')
    .option('-w, --watchlist <name>', 'Use a watchlist from config instead of symbols')
    .action(async (symbols: string[], options: { watchlist?: string }) => {
      let targets = symbols;

      if (options.watchlist) {
        try {
          const config = loadConfig();
          const list = config.watchlists[options.watchlist];
          if (!list || list.length === 0) {
            console.error(chalk.red(`Watchlist "${options.watchlist}" not found or empty.`));
            process.exit(1);
          }
          targets = list;
        } catch (err) {
          console.error(chalk.red(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`));
          process.exit(1);
        }
      }

      console.log(formatReportHeader(targets));

      try {
        const config = loadConfig();
        const detectedMarket = targets.length > 0 ? detectMarket(targets[0]) : undefined;
        const agent = createInvestmentAgent(config, {
          promptOptions: { market: detectedMarket }
        });

        agent.subscribe((event: AgentEvent) => {
          switch (event.type) {
            case 'message_update': {
              if ('content' in event.message && Array.isArray(event.message.content)) {
                for (const block of event.message.content) {
                  if (block.type === 'text' && 'text' in block) {
                    const delta = event.assistantMessageEvent;
                    if (delta.type === 'text_delta' && delta.delta) {
                      process.stdout.write(delta.delta);
                    }
                  }
                }
              }
              break;
            }
            case 'tool_execution_start':
              console.log(chalk.dim(`\n  ⟳ ${event.toolName}(${JSON.stringify(event.args)})...`));
              break;
            case 'tool_execution_end':
              console.log(chalk.dim(`  ✓ ${event.toolName} complete${event.isError ? ' (error)' : ''}`));
              break;
            case 'agent_end':
              break;
          }
        });

        const prompt = buildAnalysisPrompt(targets);
        await agent.prompt(prompt);

        console.log(formatReportFooter());

        await saveExperienceRecords(targets);

      } catch (err) {
        console.error(chalk.red(`\nAnalysis failed: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}

async function saveExperienceRecords(symbols: string[]): Promise<void> {
  const store = new ExperienceStore();
  const timestamp = new Date().toISOString();

  for (const symbol of symbols) {
    try {
      const market = detectMarket(symbol);
      const category: StockCategory = {
        type: 'large_cap',
        sector: 'unknown',
      };

      await store.save({
        id: generateId(),
        timestamp,
        market,
        symbol,
        stockCategory: category,
        context: {
          cycleScore: 5,
          cycleDimensions: {
            economic: 5,
            profit: 5,
            psychology: 5,
            riskAttitude: 5,
            credit: 5,
          },
          marketConditions: 'Analysis recorded for future tracking',
        },
        decision: {
          recommendation: 'hold',
          reasoning: 'Analysis completed. See agent output for details.',
          confidence: 0.5,
          keyFactors: [],
          matrixBaseline: 'hold',
        },
      });
    } catch (err) {
      console.error(chalk.yellow(`Warning: Failed to save experience for ${symbol}: ${err instanceof Error ? err.message : String(err)}`));
    }
  }
}
