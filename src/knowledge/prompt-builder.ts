import { 
  loadKnowledge, 
  loadPrinciples, 
  loadCoreLayer,
  loadFoundationLayer,
  loadMarketLayer,
  loadMemos,
  loadMemoIndex,
  loadMaxims,
  getMemoSlugs,
  loadMemoBySlug,
  type MarketScope 
} from './loader.js';
import type { PromptOptions, MemoOptions } from './types.js';
import { DEFAULT_PROMPT_OPTIONS } from './types.js';

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

function buildMemoContent(options: MemoOptions): string {
  if (options.mode === 'none') {
    return '';
  }

  const allMemos = loadMemos();
  const memoIndex = loadMemoIndex();
  
  if (Object.keys(allMemos).length === 0) {
    return '';
  }

  let selectedMemos: Array<{ slug: string; content: string }> = [];
  
  switch (options.mode) {
    case 'full': {
      let slugs = Object.keys(allMemos);
      
      if (options.keywords && options.keywords.length > 0) {
        slugs = slugs.filter(slug => {
          const content = allMemos[slug].toLowerCase();
          return options.keywords!.some(kw => content.includes(kw.toLowerCase()));
        });
      }
      
      selectedMemos = slugs.map(slug => ({ slug, content: allMemos[slug] }));
      break;
    }
    
    case 'latest': {
      const count = options.count ?? 3;
      
      if (memoIndex && memoIndex.memos.length > 0) {
        const sortedMemos = [...memoIndex.memos].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const topSlugs = sortedMemos.slice(0, count).map(m => m.slug);
        selectedMemos = topSlugs
          .filter(slug => allMemos[slug])
          .map(slug => ({ slug, content: allMemos[slug] }));
      } else {
        const allSlugs = Object.keys(allMemos);
        selectedMemos = allSlugs.slice(0, count).map(slug => ({ slug, content: allMemos[slug] }));
      }
      break;
    }
    
    case 'summary': {
      // Phase 2: Will use pre-generated summaries
      // For now, fall back to latest 3 memos
      const count = options.count ?? 3;
      const allSlugs = Object.keys(allMemos);
      selectedMemos = allSlugs.slice(0, count).map(slug => ({ slug, content: allMemos[slug] }));
      break;
    }
    
    default:
      return '';
  }

  if (selectedMemos.length === 0) {
    return '';
  }

  let totalTokens = 0;
  const maxTokens = options.maxTokens ?? 50000;
  const result: string[] = [];

  for (const { slug, content } of selectedMemos) {
    const tokens = Math.ceil(content.length / 4);
    if (totalTokens + tokens > maxTokens && result.length > 0) {
      break;
    }
    result.push(`### ${slug}\n\n${content}`);
    totalTokens += tokens;
  }

  return result.join('\n\n---\n\n');
}

export function buildSystemPrompt(
  marketContext?: string, 
  options?: PromptOptions | Exclude<MarketScope, 'shared'>
): string {
  const opts: PromptOptions = typeof options === 'string' 
    ? { ...DEFAULT_PROMPT_OPTIONS, market: options }
    : { ...DEFAULT_PROMPT_OPTIONS, ...options };

  const parts: string[] = [IDENTITY_PROMPT];

  // Layer 1: Foundation (books + shared principles)
  if (opts.includeFoundation !== false) {
    const foundationContent = loadFoundationLayer();
    if (foundationContent) {
      parts.push(buildLayer('Core Investment Principles', foundationContent));
    }
  }

  // Layer 2: Market-specific principles
  if (opts.market && opts.market !== 'shared') {
    const marketContent = loadMarketLayer(opts.market);
    if (marketContent) {
      parts.push(buildLayer(
        `${MARKET_NAMES[opts.market as Exclude<MarketScope, 'shared'>]} Specific Adjustments`,
        marketContent
      ));
    }
  }

  // Layer 3: Memos (only when explicitly enabled)
  if (opts.memos && opts.memos.mode !== 'none') {
    const memoContent = buildMemoContent(opts.memos);
    if (memoContent) {
      parts.push(buildLayer('Recent Oaktree Memos', memoContent));
    }
  }

  // Maxims (always included when foundation is enabled)
  if (opts.includeFoundation !== false) {
    const maxims = loadMaxims();
    if (maxims) {
      parts.push(buildLayer('Key Maxims', maxims));
    }
  }

  // Current market context
  if (marketContext) {
    parts.push(buildLayer('Current Market Context', marketContext));
  }

  return parts.join('\n');
}

export function buildSystemPromptLegacy(marketContext?: string, market?: Exclude<MarketScope, 'shared'>): string {
  const knowledge = loadKnowledge();

  const parts: string[] = [IDENTITY_PROMPT];

  const bookContents = Object.values(knowledge.books);
  if (bookContents.length > 0) {
    parts.push(buildLayer('Core Investment Principles', bookContents.join('\n\n---\n\n')));
  }

  const sharedPrinciples = knowledge.principles.shared;
  if (Object.keys(sharedPrinciples).length > 0) {
    parts.push(buildLayer('Decision Rules (Universal)', Object.values(sharedPrinciples).join('\n\n---\n\n')));
  }

  if (market) {
    const marketPrinciples = knowledge.principles[market];
    if (Object.keys(marketPrinciples).length > 0) {
      parts.push(buildLayer(
        `${MARKET_NAMES[market]} Specific Adjustments`,
        Object.values(marketPrinciples).join('\n\n---\n\n')
      ));
    }
  }

  const memoContents = Object.values(knowledge.memos);
  if (memoContents.length > 0) {
    parts.push(buildLayer('Recent Oaktree Memos', memoContents.join('\n\n---\n\n')));
  }

  if (knowledge.maxims) {
    parts.push(buildLayer('Key Maxims', knowledge.maxims));
  }

  if (marketContext) {
    parts.push(buildLayer('Current Market Context', marketContext));
  }

  return parts.join('\n');
}
