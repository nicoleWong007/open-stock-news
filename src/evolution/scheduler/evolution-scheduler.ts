import cron from 'node-cron';
import type { OakInvestConfig } from '../../config/schema.js';
import { OutcomeTracker } from '../tracker/outcome-tracker.js';
import { ReflectionEngine } from '../reflection/reflection-engine.js';
import { ExperienceStore } from '../memory/experience-store.js';

let schedulerRunning = false;

export function startEvolutionScheduler(_config: OakInvestConfig): void {
  if (schedulerRunning) {
    console.log('Evolution scheduler is already running.');
    return;
  }

  const tracker = new OutcomeTracker();
  const reflector = new ReflectionEngine();
  const store = new ExperienceStore();

  cron.schedule('0 18 * * 1-5', async () => {
    console.log('[Evolution] Running daily outcome tracking...');
    try {
      const records = await store.getPendingTracking(7);
      if (records.length > 0) {
        const result = await tracker.trackRecords(records);
        for (const record of records) {
          if (record.outcome) {
            await store.updateOutcome(record.id, record.outcome);
          }
        }
        console.log(`[Evolution] Tracking complete: ${result.updated} updated, ${result.errors} errors`);
      } else {
        console.log('[Evolution] No pending records to track');
      }
    } catch (err) {
      console.error('[Evolution] Tracking error:', err);
    }
  });

  cron.schedule('0 10 * * 0', async () => {
    console.log('[Evolution] Running weekly reflection...');
    try {
      for (const market of ['us', 'a_share', 'hk'] as const) {
        const result = await reflector.reflect(market);
        console.log(`[Evolution] ${market}: ${result.recordsAnalyzed} records, ${result.proposedPrinciples.length} proposals`);
      }
    } catch (err) {
      console.error('[Evolution] Reflection error:', err);
    }
  });

  schedulerRunning = true;
  console.log('Evolution scheduler started.');
  console.log('  - Daily tracking: weekdays at 6pm');
  console.log('  - Weekly reflection: Sundays at 10am');
}

export function stopEvolutionScheduler(): void {
  if (!schedulerRunning) {
    console.log('Evolution scheduler is not running.');
    return;
  }

  cron.getTasks().forEach(task => task.stop());
  schedulerRunning = false;
  console.log('Evolution scheduler stopped.');
}

export function isSchedulerRunning(): boolean {
  return schedulerRunning;
}
