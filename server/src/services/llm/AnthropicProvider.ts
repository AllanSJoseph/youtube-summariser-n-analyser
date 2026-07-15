import { LLMProvider, LLMResponse, LLMStreamChunk, PromptContext } from './LLMProvider';
import { AppError } from '../../middleware/errorHandler';

/**
 * Anthropic provider stub — interface-compliant, not yet wired.
 * Implement against @anthropic-ai/sdk when LLM_PROVIDER=anthropic is needed.
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateSummary(_transcript: string): Promise<LLMResponse> {
    throw new AppError('INTERNAL_ERROR', 'Anthropic provider is not implemented yet.', 501);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async *generateResponse(_question: string, _context: PromptContext): AsyncGenerator<LLMStreamChunk> {
    throw new AppError('INTERNAL_ERROR', 'Anthropic provider is not implemented yet.', 501);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateEmbedding(_text: string): Promise<number[]> {
    throw new AppError('INTERNAL_ERROR', 'Anthropic provider is not implemented yet.', 501);
  }
}
