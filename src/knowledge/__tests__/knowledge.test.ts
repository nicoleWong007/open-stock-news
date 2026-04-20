import { describe, it, expect } from 'vitest';
import { loadKnowledge } from '@/knowledge/loader.js';
import { buildSystemPrompt } from '@/knowledge/prompt-builder.js';

describe('loadKnowledge', () => {
  it('loads all book files', () => {
    const knowledge = loadKnowledge();
    expect(knowledge.books['the-most-important-thing']).toBeDefined();
    expect(knowledge.books['mastering-the-market-cycle']).toBeDefined();
  });

  it('loads all principle files', () => {
    const knowledge = loadKnowledge();
    expect(knowledge.principles['risk-framework']).toBeDefined();
    expect(knowledge.principles['cycle-positioning']).toBeDefined();
    expect(knowledge.principles['valuation-rules']).toBeDefined();
    expect(knowledge.principles['contrarian-checklist']).toBeDefined();
    expect(knowledge.principles['decision-matrix']).toBeDefined();
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
});
