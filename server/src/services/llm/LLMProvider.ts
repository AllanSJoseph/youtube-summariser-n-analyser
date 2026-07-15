/**
 * LLMProvider interface — all business logic depends only on this interface.
 * Never import @google/generative-ai or @anthropic-ai/sdk directly in routes/services.
 */

export interface PromptContext {
  /** Retrieved transcript chunks for Q&A grounding */
  chunks?: Array<{ text: string; startSeconds: number }>;
  /** Previous turns in the conversation (oldest first) */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface LLMResponse {
  text: string;
}

export interface LLMStreamChunk {
  delta: string;
  done: boolean;
}

export interface LLMProvider {
  /** Provider identifier, e.g. 'gemini' | 'anthropic' */
  readonly name: string;

  /**
   * Generate a concise summary from a full transcript.
   */
  generateSummary(transcript: string): Promise<LLMResponse>;

  /**
   * Answer a question grounded in retrieved transcript chunks.
   * Returns an async generator of stream chunks so the caller can SSE-stream.
   */
  generateResponse(
    question: string,
    context: PromptContext,
  ): AsyncGenerator<LLMStreamChunk>;

  /**
   * Produce a 768-dimensional embedding vector (Gemini text-embedding-004).
   */
  generateEmbedding(text: string): Promise<number[]>;
}
