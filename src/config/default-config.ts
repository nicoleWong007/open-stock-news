import type { OakInvestConfig } from './schema.js';

export const DEFAULT_CONFIG: OakInvestConfig = {
  macro: {
    enabled: true,
    cache_ttl_hours: 24,
    fred_api_key_env: 'FRED_API_KEY',
  },
  llm: {
    default_provider: 'openai',
    default_model: 'gpt-4o',
    providers: {
      openai: {
        api_key_env: 'OPENAI_API_KEY',
      },
      anthropic: {
        api_key_env: 'ANTHROPIC_API_KEY',
      },
      ollama: {
        base_url: 'http://localhost:11434',
      },
    },
  },
  watchlists: {
    default: ['AAPL', 'MSFT', '000001.SZ', '0700.HK', '9988.HK'],
  },
  email: {
    enabled: false,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    from: 'oak-invest@example.com',
    to: 'user@example.com',
    schedule: '0 18 * * 1-5',
  },
  data_sources: {
    python_bridge: false,
    python_path: 'python3',
  },
};

export const DEFAULT_CONFIG_YAML = `# oak-invest configuration
# See docs for all options: https://github.com/nicoleWong007/open-stock-news

llm:
  default_provider: openai
  default_model: gpt-4o
  providers:
    openai:
      api_key_env: OPENAI_API_KEY
    anthropic:
      api_key_env: ANTHROPIC_API_KEY
    ollama:
      base_url: http://localhost:11434

watchlists:
  default:
    - AAPL
    - MSFT
    - 000001.SZ
    - 0700.HK
    - 9988.HK

email:
  enabled: false
  smtp_host: smtp.gmail.com
  smtp_port: 587
  from: oak-invest@example.com
  to: user@example.com
  schedule: "0 18 * * 1-5"

data_sources:
  python_bridge: false
  python_path: python3
`;
