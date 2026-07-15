import { useState, useEffect, useRef, useCallback } from 'react';
import { askQuestion, getMessages } from '../api/messages';
import type { ChatMessage, Citation } from '../types';

const STORAGE_KEY = (videoId: string) => `yt_conv_${videoId}`;

interface UseConversationResult {
  messages: ChatMessage[];
  conversationId: string | null;
  streaming: boolean;
  sendMessage: (question: string) => void;
}

export function useConversation(videoId: string | null): UseConversationResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Restore persisted conversation on mount / videoId change
  useEffect(() => {
    if (!videoId) {
      setMessages([]);
      setConversationId(null);
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY(videoId));
    if (!saved) return;

    const savedId: string = saved;
    getMessages(videoId, savedId)
      .then(({ messages: history, conversationId: cid }) => {
        setConversationId(cid);
        setMessages(history);
      })
      .catch(() => {
        // Stale/invalid conversation — start fresh
        localStorage.removeItem(STORAGE_KEY(videoId));
      });
  }, [videoId]);

  // Save conversationId to localStorage whenever it changes
  useEffect(() => {
    if (videoId && conversationId) {
      localStorage.setItem(STORAGE_KEY(videoId), conversationId);
    }
  }, [videoId, conversationId]);

  // Cleanup on unmount
  useEffect(() => () => cleanupRef.current?.(), []);

  const sendMessage = useCallback(
    (question: string) => {
      if (!videoId || streaming) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: question,
      };

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);

      const cleanup = askQuestion({
        videoId,
        conversationId,
        question,
        onMeta: (cid) => {
          setConversationId(cid);
        },
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: m.content + delta } : m,
            ),
          );
        },
        onDone: (citations: Citation[]) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, streaming: false, citationsJson: citations }
                : m,
            ),
          );
          setStreaming(false);
        },
        onError: (errMsg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: `Error: ${errMsg}`, streaming: false }
                : m,
            ),
          );
          setStreaming(false);
        },
      });

      cleanupRef.current = cleanup;
    },
    [videoId, conversationId, streaming],
  );

  return { messages, conversationId, streaming, sendMessage };
}
