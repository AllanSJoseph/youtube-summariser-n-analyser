---
name: llm-provider-abstraction
description: Use this skill whenever writing or modifying code that calls an LLM (summary generation, Q&A, embeddings). Never call a provider SDK (Gemini or Anthropic) directly from route handlers or business logic — always go through this interface.
---

# LLM provider abstraction

## Interface shape
```ts
interface LLMProvider {
  generateResponse(prompt: string, context: PromptContext): Promise<LLMResponse>;
  generateEmbedding(text: string): Promise<number[]>;
  name: string; // 'gemini' | 'anthropic'
}
```
Concrete implementations (`GeminiProvider`, `AnthropicProvider`) live behind this interface. Business logic (summary generation, Q&A retrieval) depends only on `LLMProvider`, never on `@google/generative-ai` or `@anthropic-ai/sdk` types directly.

## Provider selection
Read from `LLM_PROVIDER` env var via a factory function (`getLLMProvider()`), not hardcoded per call site. This makes swapping the default provider a one-line config change.

## Embeddings are not provider-interchangeable
Gemini and Anthropic use different embedding models with different output dimensions. If you ever change `LLM_PROVIDER` or add per-user provider choice:
- Store the provider name alongside each row in `video_embeddings` (add a column if not already present)
- Never run a similarity search mixing embeddings from different providers — the vector spaces aren't comparable
- Re-embedding existing content is required when switching embedding providers, not just future calls

## Streaming
Q&A responses should stream to the frontend (SSE or chunked HTTP) rather than waiting for full generation — both Gemini and Anthropic SDKs support streaming responses. Keep the streaming interface consistent across providers in `LLMResponse` so route handlers don't need provider-specific branching.

## Error handling
Wrap provider calls in a normalized error shape (`LLM_ERROR` code from the API spec) regardless of which provider failed — route handlers and the frontend should never need to know which provider is active to handle an error correctly.

## Adding Anthropic (when the time comes)
1. Implement `AnthropicProvider` against the same interface
2. Confirm embedding dimension and update the `video_embeddings.embedding` column type if switching default embeddings
3. Test the retrieval pipeline end-to-end before flipping `LLM_PROVIDER` in production — a prompt that works well with Gemini isn't guaranteed to work identically with Claude without adjustment