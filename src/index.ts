import { program } from 'commander';
import { VERSION } from './lib/version.js';
import { registerInitCommand } from './commands/init.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerChatCommand } from './commands/chat.js';
import { registerCycleCheckCommand } from './commands/cycle-check.js';
import { registerDailyReportCommand } from './commands/daily-report.js';
import { registerUpdateMemosCommand } from './commands/update-memos.js';

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

program.parse();
