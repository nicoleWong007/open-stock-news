import { describe, it, expect } from 'vitest';
import { formatReportHeader, formatReportFooter } from '@/output/report-formatter.js';

describe('formatReportHeader', () => {
  it('includes symbol names', () => {
    const header = formatReportHeader(['AAPL', 'MSFT']);
    expect(header).toContain('AAPL');
    expect(header).toContain('MSFT');
  });

  it('includes timestamp', () => {
    const header = formatReportHeader(['AAPL']);
    expect(header).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('handles single symbol', () => {
    const header = formatReportHeader(['AAPL']);
    expect(header).toContain('Analyzing: AAPL');
  });
});

describe('formatReportFooter', () => {
  it('includes attribution', () => {
    const footer = formatReportFooter();
    expect(footer).toContain('oak-invest');
    expect(footer).toContain('Howard Marks');
  });
});
