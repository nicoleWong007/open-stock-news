import { Agent } from '@mariozechner/pi-agent-core';
import { getModel, streamSimple } from '@mariozechner/pi-ai';
import type { Model, Api } from '@mariozechner/pi-ai';
import type { OakInvestConfig } from '../config/schema.js';
import { buildSystemPrompt } from './system-prompt.js';
import { getAllTools } from './tools.js';
import type { PromptOptions } from '../knowledge/types.js';

function resolveModel(config: OakInvestConfig): Model<Api> {
  const provider = config.llm.default_provider;
  const modelId = config.llm.default_model;

  try {
    return getModel(provider as never, modelId as never) as Model<Api>;
  } catch {
    try {
      return getModel('google', 'gemini-2.5-flash') as Model<Api>;
    } catch {
      return getModel('openai', 'gpt-4o-mini') as Model<Api>;
    }
  }
}

export interface CreateAgentOptions {
  promptOptions?: PromptOptions;
  marketContext?: string;
}

export function createInvestmentAgent(config: OakInvestConfig, options?: CreateAgentOptions): Agent {
  const model = resolveModel(config);
  const systemPrompt = buildSystemPrompt(options?.marketContext, options?.promptOptions);
  const tools = getAllTools();

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      thinkingLevel: 'medium',
      tools,
    },
    streamFn: streamSimple,
    getApiKey: (providerName: string) => {
      const providerConfig = config.llm.providers[providerName];
      if (providerConfig?.api_key_env) {
        return process.env[providerConfig.api_key_env];
      }
      return undefined;
    },
  });

  return agent;
}
