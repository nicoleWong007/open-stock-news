import { loadKnowledge, loadPrinciples, type MarketScope } from './loader.js';

const MARKET_NAMES: Record<Exclude<MarketScope, 'shared'>, string> = {
  us: 'US Market',
  a_share: 'A-Share Market',
  hk: 'HK Market',
};

const IDENTITY_PROMPT = `You are Oak Invest Agent, an investment analysis assistant guided by Howard Marks' philosophy from "The Most Important Thing" and "Mastering the Market Cycle."

Your core principles:
- Second-level thinking: go beyond surface consensus
- Risk means permanent loss probability, not volatility
- Cycle awareness: identify where we are in economic, profit, psychology, risk attitude, and credit cycles
- Margin of safety: only invest when price is significantly below intrinsic value
- Defensive investing: avoiding losses takes priority over chasing gains

When analyzing stocks:
1. Assess the current cycle position using the five-dimensional scoring system
2. Evaluate risk through the lens of permanent loss, not price fluctuation
3. Determine intrinsic value and margin of safety
4. Apply the decision matrix for a baseline recommendation
5. Refine the recommendation based on qualitative factors

Always explain your reasoning. Acknowledge uncertainty. Never claim to predict the future.`;

function buildLayer(title: string, content: string): string {
  if (!content.trim()) return '';
  return `\n## ${title}\n\n${content}`;
}

export function buildSystemPrompt(marketContext?: string, market?: Exclude<MarketScope, 'shared'>): string {
  const knowledge = loadKnowledge();

  const parts: string[] = [IDENTITY_PROMPT];

  // Core principles from books
  const bookContents = Object.values(knowledge.books);
  if (bookContents.length > 0) {
    parts.push(buildLayer('Core Investment Principles', bookContents.join('\n\n---\n\n')));
  }

  // Shared decision rules
  const sharedPrinciples = knowledge.principles.shared;
  if (Object.keys(sharedPrinciples).length > 0) {
    parts.push(buildLayer('Decision Rules (Universal)', Object.values(sharedPrinciples).join('\n\n---\n\n')));
  }

  // Market-specific principles
  if (market) {
    const marketPrinciples = knowledge.principles[market];
    if (Object.keys(marketPrinciples).length > 0) {
      parts.push(buildLayer(
        `${MARKET_NAMES[market]} Specific Adjustments`,
        Object.values(marketPrinciples).join('\n\n---\n\n')
      ));
    }
  }

  // Memo context (dynamic, may be empty)
  const memoContents = Object.values(knowledge.memos);
  if (memoContents.length > 0) {
    parts.push(buildLayer('Recent Oaktree Memos', memoContents.join('\n\n---\n\n')));
  }

  // Maxims
  if (knowledge.maxims) {
    parts.push(buildLayer('Key Maxims', knowledge.maxims));
  }

  // Current market context (real-time data, provided at runtime)
  if (marketContext) {
    parts.push(buildLayer('Current Market Context', marketContext));
  }

  return parts.join('\n');
}
