import fs from 'node:fs';
import path from 'node:path';
import type { ProposedPrinciple, Market } from '../types.js';
import { getCandidatesDir, slugify } from '../helpers.js';
import { formatPrincipleAsMarkdown } from './principle-formatter.js';

export class KnowledgeCurator {
  async listPending(market?: Market): Promise<ProposedPrinciple[]> {
    const baseDir = getCandidatesDir();
    const principles: ProposedPrinciple[] = [];

    const markets = market ? [market] : (['us', 'a_share', 'hk'] as Market[]);

    for (const m of markets) {
      const marketDir = path.join(baseDir, m);
      if (!fs.existsSync(marketDir)) continue;

      const files = fs.readdirSync(marketDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(marketDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const principle: ProposedPrinciple = JSON.parse(content);
        if (principle.status === 'pending') {
          principles.push(principle);
        }
      }
    }

    return principles;
  }

  async getProposal(id: string): Promise<ProposedPrinciple | null> {
    const baseDir = getCandidatesDir();

    for (const market of ['us', 'a_share', 'hk'] as Market[]) {
      const marketDir = path.join(baseDir, market);
      if (!fs.existsSync(marketDir)) continue;

      const files = fs.readdirSync(marketDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        if (file.includes(id)) {
          const filePath = path.join(marketDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          return JSON.parse(content);
        }
      }
    }

    return null;
  }

  async approve(id: string, notes?: string): Promise<void> {
    const principle = await this.getProposal(id);
    if (!principle) {
      throw new Error(`Proposal not found: ${id}`);
    }

    principle.status = 'approved';
    principle.reviewedAt = new Date().toISOString();
    if (notes) {
      principle.reviewNotes = notes;
    }

    await this.updateProposal(principle);
    await this.applyToKnowledge(principle);
  }

  async reject(id: string, reason: string): Promise<void> {
    const principle = await this.getProposal(id);
    if (!principle) {
      throw new Error(`Proposal not found: ${id}`);
    }

    principle.status = 'rejected';
    principle.reviewedAt = new Date().toISOString();
    principle.reviewNotes = reason;

    await this.updateProposal(principle);
    await this.moveToRejected(principle);
  }

  private async updateProposal(principle: ProposedPrinciple): Promise<void> {
    const baseDir = getCandidatesDir();
    const market = principle.applicableMarkets[0];
    const filePath = path.join(baseDir, market, `${principle.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(principle, null, 2), 'utf-8');
  }

  private async applyToKnowledge(principle: ProposedPrinciple): Promise<void> {
    const isShared = principle.applicableMarkets.length === 3;
    const targetMarket = isShared ? 'shared' : principle.applicableMarkets[0];

    const projectRoot = path.resolve(import.meta.dirname, '..', '..', '..');
    const targetDir = path.join(projectRoot, 'knowledge', 'principles', targetMarket);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `${slugify(principle.title)}.md`;
    const filePath = path.join(targetDir, filename);
    const content = formatPrincipleAsMarkdown(principle);

    fs.writeFileSync(filePath, content, 'utf-8');
  }

  private async moveToRejected(principle: ProposedPrinciple): Promise<void> {
    const baseDir = getCandidatesDir();
    const rejectedDir = path.join(baseDir, 'rejected');

    if (!fs.existsSync(rejectedDir)) {
      fs.mkdirSync(rejectedDir, { recursive: true });
    }

    const oldPath = path.join(baseDir, principle.applicableMarkets[0], `${principle.id}.json`);
    const newPath = path.join(rejectedDir, `${principle.id}.json`);

    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }
  }
}
