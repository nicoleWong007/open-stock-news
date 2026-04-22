import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadKnowledge } from '@/knowledge/loader.js';
import { buildSystemPrompt } from '@/knowledge/prompt-builder.js';
import { clearCache } from '@/knowledge/cache.js';

beforeEach(() => {
  clearCache();
});

afterEach(() => {
  clearCache();
});

describe('loadKnowledge', () => {
  it('loads all book files', () => {
    const knowledge = loadKnowledge();
    expect(knowledge.books['the-most-important-thing']).toBeDefined();
    expect(knowledge.books['mastering-the-market-cycle']).toBeDefined();
  });

  it('loads all principle files', () => {
    const knowledge = loadKnowledge();
    expect(knowledge.principles.shared['risk-framework']).toBeDefined();
    expect(knowledge.principles.shared['cycle-positioning']).toBeDefined();
    expect(knowledge.principles.shared['valuation-rules']).toBeDefined();
    expect(knowledge.principles.shared['contrarian-checklist']).toBeDefined();
    expect(knowledge.principles.shared['decision-matrix']).toBeDefined();
  });

  it('loads maxims', () => {
    const knowledge = loadKnowledge();
    expect(knowledge.maxims).toBeTruthy();
    expect(knowledge.maxims.length).toBeGreaterThan(100);
  });

  it('loads memo files from knowledge/memos directory', () => {
    const knowledge = loadKnowledge();
    expect(typeof knowledge.memos).toBe('object');
  });

  it('book content contains key concepts', () => {
    const knowledge = loadKnowledge();
    const tmit = knowledge.books['the-most-important-thing'];
    expect(tmit).toContain('Second-Level Thinking');
    expect(tmit).toContain('Margin of Safety');
    expect(tmit).toContain('permanent loss');

    const cycle = knowledge.books['mastering-the-market-cycle'];
    expect(cycle).toContain('Credit Cycle');
    expect(cycle).toContain('Psychology Pendulum');
  });
});

describe('buildSystemPrompt', () => {
  it('includes identity section', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Oak Invest Agent');
    expect(prompt).toContain('Howard Marks');
  });

  it('includes core principles from books', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Second-Level Thinking');
    expect(prompt).toContain('Credit Cycle');
  });

  it('includes decision rules', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Decision Matrix');
    expect(prompt).toContain('Strong Buy');
    expect(prompt).toContain('Sell');
  });

  it('includes maxims', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Key Maxims');
  });

  it('includes market context when provided', () => {
    const prompt = buildSystemPrompt('VIX: 25, S&P 500 PE: 22');
    expect(prompt).toContain('VIX: 25');
    expect(prompt).toContain('Current Market Context');
  });

  it('excludes market context when not provided', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain('Current Market Context');
  });

  it('excludes memos by default', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain('Recent Oaktree Memos');
  });

  it('includes memos when mode is latest', () => {
    const prompt = buildSystemPrompt(undefined, { memos: { mode: 'latest', count: 1 } });
    expect(prompt).toContain('Recent Oaktree Memos');
  });

  it('includes memos when mode is full', () => {
    const prompt = buildSystemPrompt(undefined, { memos: { mode: 'full' } });
    expect(prompt).toContain('Recent Oaktree Memos');
  });

  it('excludes foundation when includeFoundation is false', () => {
    const prompt = buildSystemPrompt(undefined, { includeFoundation: false });
    expect(prompt).not.toContain('Core Investment Principles');
  });

  it('supports legacy API with market string', () => {
    const prompt = buildSystemPrompt(undefined, 'us');
    expect(prompt).toContain('Oak Invest Agent');
  });

  it('is significantly smaller without memos', () => {
    const promptWithoutMemos = buildSystemPrompt();
    const promptWithMemos = buildSystemPrompt(undefined, { memos: { mode: 'full' } });
    expect(promptWithoutMemos.length).toBeLessThan(promptWithMemos.length);
    expect(promptWithoutMemos.length).toBeLessThan(35000);
  });
});
