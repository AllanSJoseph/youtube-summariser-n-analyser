import { Router, Request, Response, NextFunction } from 'express';
import pool from '../db/client';
import { getVideoById } from '../services/cache/videoCache';
import { retrieveChunks } from '../services/embeddings/retrieval';
import { getLLMProvider } from '../services/llm/getLLMProvider';
import { AppError } from '../middleware/errorHandler';
import { Citation, ConversationMessage } from '../types';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrCreateConversation(
  videoId: string,
  conversationId: string | null | undefined,
): Promise<string> {
  if (conversationId) {
    // Verify it belongs to this video
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM conversations WHERE id = $1 AND video_id = $2`,
      [conversationId, videoId],
    );
    if (rows.length > 0) return rows[0].id;
    // Provided conversationId doesn't match — create a new one
  }

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO conversations (video_id) VALUES ($1) RETURNING id`,
    [videoId],
  );
  return rows[0].id;
}

async function getConversationHistory(
  conversationId: string,
  limit = 10,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const { rows } = await pool.query<{ role: 'user' | 'assistant'; content: string }>(
    `SELECT role, content FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [conversationId, limit],
  );
  // Return oldest-first
  return rows.reverse();
}

function extractCitations(answer: string): Citation[] {
  const citations: Citation[] = [];
  // Match [M:SS] or [MM:SS] or [HH:MM:SS] patterns in the generated answer
  const matches = answer.matchAll(/\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g);
  for (const m of matches) {
    let seconds = 0;
    if (m[3] !== undefined) {
      // HH:MM:SS
      seconds = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
    } else {
      // MM:SS
      seconds = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    }
    citations.push({ timestampSeconds: seconds, text: m[0] });
  }
  return citations;
}

// ---------------------------------------------------------------------------
// POST /api/v1/videos/:id/messages — ask a question (SSE stream)
// ---------------------------------------------------------------------------
router.post(
  '/:id/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const video = await getVideoById(String(req.params.id));
      if (!video) throw new AppError('NOT_FOUND', 'Video not found.', 404);
      if (video.status !== 'ready') {
        throw new AppError(
          'INTERNAL_ERROR',
          'Video is not yet ready for Q&A. Please wait for processing to complete.',
          409,
        );
      }

      const { conversationId, question } = req.body as {
        conversationId?: string | null;
        question?: string;
      };

      if (!question || typeof question !== 'string' || !question.trim()) {
        throw new AppError('INTERNAL_ERROR', 'Request body must contain a "question" field.', 400);
      }

      const convId = await getOrCreateConversation(video.id, conversationId ?? null);
      const history = await getConversationHistory(convId);

      // Retrieve relevant transcript chunks
      const chunks = await retrieveChunks(video.id, question);

      // Persist the user's message
      await pool.query(
        `INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)`,
        [convId, 'user', question],
      );

      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // Send conversationId first so the client can save it
      sendEvent('meta', { conversationId: convId });

      // Stream the LLM response
      const llm = getLLMProvider();
      let fullAnswer = '';

      for await (const chunk of llm.generateResponse(question, {
        chunks: chunks.map((c) => ({ text: c.chunkText, startSeconds: c.startSeconds })),
        history,
      })) {
        if (chunk.delta) {
          fullAnswer += chunk.delta;
          sendEvent('delta', { text: chunk.delta });
        }
        if (chunk.done) break;
      }

      // Extract timestamp citations from the completed answer
      const citations = extractCitations(fullAnswer);

      // Persist the assistant's answer
      await pool.query(
        `INSERT INTO messages (conversation_id, role, content, citations_json)
         VALUES ($1, $2, $3, $4)`,
        [convId, 'assistant', fullAnswer, citations.length ? JSON.stringify(citations) : null],
      );

      sendEvent('done', { citations });
      res.end();
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/v1/videos/:id/conversations/:cid/messages — load history
// ---------------------------------------------------------------------------
router.get(
  '/:id/conversations/:cid/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const video = await getVideoById(String(req.params.id));
      if (!video) throw new AppError('NOT_FOUND', 'Video not found.', 404);

      const { cid } = req.params;

      // Verify the conversation belongs to this video
      const { rows: convRows } = await pool.query<{ id: string }>(
        `SELECT id FROM conversations WHERE id = $1 AND video_id = $2`,
        [cid, video.id],
      );
      if (convRows.length === 0) {
        throw new AppError('NOT_FOUND', 'Conversation not found.', 404);
      }

      const { rows } = await pool.query<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        citations_json: Citation[] | null;
        created_at: string;
      }>(
        `SELECT id, role, content, citations_json, created_at
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [cid],
      );

      const messages: ConversationMessage[] = rows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        citationsJson: r.citations_json,
        createdAt: r.created_at,
      }));

      res.json({ conversationId: cid, messages });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
