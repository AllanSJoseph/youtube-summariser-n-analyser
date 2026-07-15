import { useState, useRef, useEffect } from 'react';
import { CitationBadge } from '../CitationBadge/CitationBadge';
import type { ChatMessage } from '../../types';
import styles from './ChatPanel.module.css';

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  disabled: boolean;
  playerRef?: React.RefObject<YT.Player | null>;
  onSend: (question: string) => void;
}

export function ChatPanel({ messages, streaming, disabled, playerRef, onSend }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || streaming) return;
    setInput('');
    onSend(q);
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>Ask about this video</h2>

      <div className={styles.messageList}>
        {messages.length === 0 && (
          <p className={styles.empty}>No messages yet. Ask a question below.</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.assistant}`}
          >
            <p className={styles.content}>{msg.content}</p>
            {msg.streaming && <span className={styles.cursor} />}
            {msg.citationsJson && msg.citationsJson.length > 0 && (
              <div className={styles.citations}>
                {msg.citationsJson.map((c, i) => (
                  <CitationBadge key={i} citation={c} playerRef={playerRef} />
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className={styles.inputRow} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="text"
          placeholder={disabled ? 'Video is still processing…' : 'Ask a question…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || streaming}
        />
        <button
          className={styles.sendBtn}
          type="submit"
          disabled={disabled || streaming || !input.trim()}
        >
          {streaming ? '…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
