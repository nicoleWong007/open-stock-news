import { z } from 'zod';

export const ProviderConfigSchema = z.object({
  api_key_env: z.string().optional(),
  base_url: z.string().optional(),
  model: z.string().optional(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const LlmConfigSchema = z.object({
  default_provider: z.string().default('openai'),
  default_model: z.string().default('gpt-4o'),
  providers: z.record(z.string(), ProviderConfigSchema).default({}),
});

export type LlmConfig = z.infer<typeof LlmConfigSchema>;

export const EmailConfigSchema = z.object({
  enabled: z.boolean().default(false),
  smtp_host: z.string().default('smtp.gmail.com'),
  smtp_port: z.number().default(587),
  from: z.string().default('oak-invest@example.com'),
  to: z.string().default('user@example.com'),
  schedule: z.string().default('0 18 * * 1-5'),
  user: z.string().optional(),
  pass_env: z.string().optional(),
});

export type EmailConfig = z.infer<typeof EmailConfigSchema>;

export const DataSourceConfigSchema = z.object({
  python_bridge: z.boolean().default(false),
  python_path: z.string().default('python3'),
});

export type DataSourceConfig = z.infer<typeof DataSourceConfigSchema>;

// Macro fetcher configuration
export const MacroConfigSchema = z.object({
  enabled: z.boolean().default(true),
  cache_ttl_hours: z.number().default(24),
  fred_api_key_env: z.string().default('FRED_API_KEY'),
});

export type MacroConfig = z.infer<typeof MacroConfigSchema>;

export const OakInvestConfigSchema = z.object({
  llm: LlmConfigSchema.default({}),
  watchlists: z.record(z.string(), z.array(z.string())).default({
    default: ['AAPL', 'MSFT'],
  }),
  email: EmailConfigSchema.default({}),
  data_sources: DataSourceConfigSchema.default({}),
  macro: MacroConfigSchema.default({}),
});

export type OakInvestConfig = z.infer<typeof OakInvestConfigSchema>;
