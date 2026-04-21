import 'dotenv/config';
import { program } from 'commander';
import { VERSION } from './lib/version.js';
import { registerInitCommand } from './commands/init.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerChatCommand } from './commands/chat.js';
import { registerCycleCheckCommand } from './commands/cycle-check.js';
import { registerDailyReportCommand } from './commands/daily-report.js';
import { registerUpdateMemosCommand } from './commands/update-memos.js';
import { registerFetchMacroCommand } from './commands/fetch-macro.js';
import { registerTrackCommand, registerAccuracyReportCommand, registerExperienceCommand } from './commands/track.js';
import { registerReflectCommand } from './commands/reflect.js';
import { registerReviewCommand } from './commands/review.js';
import { registerEvolutionCommand } from './commands/evolution.js';

program
  .name('oak-invest')
  .description('Howard Marks-inspired investment analysis CLI agent')
  .version(VERSION);

registerInitCommand(program);
registerDoctorCommand(program);
registerAnalyzeCommand(program);
registerChatCommand(program);
registerCycleCheckCommand(program);
registerDailyReportCommand(program);
registerUpdateMemosCommand(program);
registerFetchMacroCommand(program);
registerTrackCommand(program);
registerAccuracyReportCommand(program);
registerExperienceCommand(program);
registerReflectCommand(program);
registerReviewCommand(program);
registerEvolutionCommand(program);

program.parse();
