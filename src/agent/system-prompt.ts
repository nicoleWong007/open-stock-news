import { buildSystemPrompt } from '../knowledge/prompt-builder.js';

export { buildSystemPrompt };

export function buildAnalysisPrompt(symbols: string[]): string {
  const symbolList = symbols.join(', ');
  return (
    `Analyze the following stocks: ${symbolList}.\n\n` +
    `Please perform a thorough investment analysis following Howard Marks' philosophy:\n` +
    `1. Fetch current stock prices and key financial data\n` +
    `2. Evaluate valuation metrics (PE, PB, EV/EBITDA, etc.)\n` +
    `3. Assess risk factors (permanent loss probability, leverage, fundamentals)\n` +
    `4. Consider the current market cycle position\n` +
    `5. Apply the decision matrix to arrive at a baseline recommendation\n` +
    `6. Provide a refined recommendation with clear reasoning\n\n` +
    `Format your response as a structured analysis with sections for each stock.`
  );
}
