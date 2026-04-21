import type { ProposedPrinciple } from '../types.js';
import chalk from 'chalk';

export function formatPrincipleForTerminal(principle: ProposedPrinciple): string {
  const lines: string[] = [];

  lines.push(chalk.bold.cyan(`\n${principle.title}\n`));
  lines.push(chalk.dim(`ID: ${principle.id}`));
  lines.push(chalk.dim(`Category: ${principle.category}`));
  lines.push(chalk.dim(`Markets: ${principle.applicableMarkets.join(', ')}`));
  lines.push('');
  lines.push(chalk.white(principle.description));
  lines.push('');
  lines.push(chalk.bold('Evidence:'));

  for (const [market, evidence] of Object.entries(principle.evidence.byMarket)) {
    if (evidence) {
      lines.push(`  ${market}:`);
      lines.push(`    Supporting: ${evidence.supportingCount} cases (${evidence.successRate.toFixed(0)}%)`);
      if (evidence.contradictingCount > 0) {
        lines.push(`    Contradicting: ${evidence.contradictingCount} cases`);
      }
    }
  }

  lines.push(`  Overall: ${principle.evidence.overallSuccessRate.toFixed(0)}% success rate`);
  lines.push('');

  if (principle.status === 'pending') {
    lines.push(chalk.yellow('Status: Pending Review'));
  } else if (principle.status === 'approved') {
    lines.push(chalk.green(`Status: Approved (${principle.reviewedAt})`));
    if (principle.reviewNotes) {
      lines.push(chalk.dim(`Notes: ${principle.reviewNotes}`));
    }
  } else if (principle.status === 'rejected') {
    lines.push(chalk.red(`Status: Rejected (${principle.reviewedAt})`));
    if (principle.reviewNotes) {
      lines.push(chalk.dim(`Reason: ${principle.reviewNotes}`));
    }
  }

  return lines.join('\n');
}

export function formatPrincipleAsMarkdown(principle: ProposedPrinciple): string {
  const lines: string[] = [];

  lines.push(`# ${principle.title}`);
  lines.push('');
  lines.push(`**Category:** ${principle.category}`);
  lines.push('');
  lines.push(`**Applicable Markets:** ${principle.applicableMarkets.join(', ')}`);
  lines.push('');
  lines.push('## Description');
  lines.push('');
  lines.push(principle.description);
  lines.push('');
  lines.push('## Evidence');
  lines.push('');

  for (const [market, evidence] of Object.entries(principle.evidence.byMarket)) {
    if (evidence) {
      lines.push(`### ${market}`);
      lines.push(`- Supporting cases: ${evidence.supportingCount}`);
      lines.push(`- Success rate: ${evidence.successRate.toFixed(0)}%`);
      if (evidence.contradictingCount > 0) {
        lines.push(`- Contradicting cases: ${evidence.contradictingCount}`);
      }
      lines.push('');
    }
  }

  lines.push(`**Overall Success Rate:** ${principle.evidence.overallSuccessRate.toFixed(0)}%`);
  lines.push('');

  if (principle.reviewNotes) {
    lines.push('## Review Notes');
    lines.push('');
    lines.push(principle.reviewNotes);
    lines.push('');
  }

  lines.push(`---`);
  lines.push(`*Proposed: ${principle.proposedAt}*`);
  if (principle.reviewedAt) {
    lines.push(`*Reviewed: ${principle.reviewedAt}*`);
  }

  return lines.join('\n');
}
