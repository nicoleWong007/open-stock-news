import { Agent } from '@mariozechner/pi-agent-core';
import { getModel, streamSimple } from '@mariozechner/pi-ai';
import type { Model, Api } from '@mariozechner/pi-ai';
import type { OakInvestConfig } from '../config/schema.js';
import { buildSystemPrompt } from './system-prompt.js';
import { getAllTools } from './tools.js';

function resolveModel(config: OakInvestConfig): Model<Api> {
  const provider = config.llm.default_provider;
  const modelId = config.llm.default_model;

  try {
    return getModel(provider as 'openai', modelId as 'gpt-4o') as Model<Api>;
  } catch {
    return getModel('openai', 'gpt-4o') as Model<Api>;
  }
}

export function createInvestmentAgent(config: OakInvestConfig): Agent {
  const model = resolveModel(config);
  const systemPrompt = buildSystemPrompt();
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
