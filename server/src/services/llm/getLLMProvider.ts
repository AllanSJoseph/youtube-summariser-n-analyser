import { LLMProvider } from './LLMProvider';
import { GeminiProvider } from './GeminiProvider';
import { AnthropicProvider } from './AnthropicProvider';

let instance: LLMProvider | null = null;

/**
 * Returns a singleton LLM provider selected by the LLM_PROVIDER env var.
 * Defaults to 'gemini'.
 */
export function getLLMProvider(): LLMProvider {
  if (instance) return instance;

  const provider = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();

  switch (provider) {
    case 'gemini':
      instance = new GeminiProvider();
      break;
    case 'anthropic':
      instance = new AnthropicProvider();
      break;
    default:
      console.warn(`Unknown LLM_PROVIDER "${provider}", falling back to gemini.`);
      instance = new GeminiProvider();
  }

  return instance;
}
