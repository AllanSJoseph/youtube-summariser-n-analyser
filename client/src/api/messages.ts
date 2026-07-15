import type { ChatMessage, Citation } from '../types';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export interface AskQuestionOptions {
  videoId: string;
  conversationId: string | null;
  question: string;
  onMeta: (conversationId: string) => void;
  onDelta: (text: string) => void;
  onDone: (citations: Citation[]) => void;
  onError: (err: string) => void;
}

/**
 * Opens an SSE connection for a Q&A question.
 * Calls onDelta for each streamed token, onDone with citations when finished.
 * Returns a cleanup function to close the connection.
 */
export function askQuestion(opts: AskQuestionOptions): () => void {
  let closed = false;

  // SSE via fetch + ReadableStream (compatible with EB's chunked responses)
  const controller = new AbortController();

  fetch(`${BASE}/api/v1/videos/${opts.videoId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId: opts.conversationId,
      question: opts.question,
    }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        opts.onError(body?.error?.message ?? 'Request failed');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let event = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            event = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            try {
              const parsed = JSON.parse(data);
              if (event === 'meta' && parsed.conversationId) {
                opts.onMeta(parsed.conversationId);
              } else if (event === 'delta' && parsed.text) {
                opts.onDelta(parsed.text);
              } else if (event === 'done') {
                opts.onDone(parsed.citations ?? []);
              }
            } catch {
              // malformed SSE chunk — skip
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err?.name !== 'AbortError') {
        opts.onError(err?.message ?? 'Network error');
      }
    });

  return () => {
    closed = true;
    controller.abort();
  };
}

/** Fetch persisted message history for a conversation. */
export async function getMessages(
  videoId: string,
  conversationId: string,
): Promise<{ conversationId: string; messages: ChatMessage[] }> {
  const res = await fetch(
    `${BASE}/api/v1/videos/${videoId}/conversations/${conversationId}/messages`,
  );
  if (!res.ok) throw await res.json();
  return res.json();
}
