import { describe, it, expect } from 'vitest';
import { OakInvestConfigSchema } from '@/config/schema.js';

describe('OakInvestConfigSchema', () => {
  it('accepts valid full config', () => {
    const result = OakInvestConfigSchema.safeParse({
      llm: {
        default_provider: 'gemini',
        default_model: 'gemini-2.5-pro',
        providers: {
          gemini: { api_key_env: 'GOOGLE_API_KEY' },
        },
      },
      watchlists: {
        default: ['AAPL', 'MSFT'],
      },
      email: {
        enabled: false,
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
      },
      data_sources: {
        python_bridge: false,
        python_path: 'python3',
      },
    });

    expect(result.success).toBe(true);
  });

  it('applies defaults for missing fields', () => {
    const result = OakInvestConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.llm.default_provider).toBe('gemini');
      expect(result.data.llm.default_model).toBe('gemini-2.5-pro');
      expect(result.data.email.enabled).toBe(false);
      expect(result.data.data_sources.python_bridge).toBe(false);
    }
  });

  it('rejects invalid types', () => {
    const result = OakInvestConfigSchema.safeParse({
      llm: { default_provider: 123 },
      email: { smtp_port: 'not-a-number' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty watchlists', () => {
    const result = OakInvestConfigSchema.safeParse({
      watchlists: {},
    });
    expect(result.success).toBe(true);
  });

  it('accepts multiple watchlists', () => {
    const result = OakInvestConfigSchema.safeParse({
      watchlists: {
        default: ['AAPL'],
        tech: ['AAPL', 'MSFT', 'GOOGL'],
        china: ['000001.SZ', '0700.HK'],
      },
    });
    expect(result.success).toBe(true);
  });
});
