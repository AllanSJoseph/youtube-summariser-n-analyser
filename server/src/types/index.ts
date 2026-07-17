// ---------------------------------------------------------------------------
// Shared type definitions — mirror these in client/src/types/index.ts
// ---------------------------------------------------------------------------

export type VideoStatus = 'ready' | 'processing' | 'no_captions' | 'failed';

export interface VideoStats {
  views: number;
  likes: number;
  commentCount: number;
  uploadDate: string;
}

export interface VideoResponse {
  videoId: string;
  youtubeId: string;
  status: VideoStatus;
  title: string;
  channelTitle: string | null;
  summary: string | null;
  stats: VideoStats | null;
  hasCaptions: boolean;
}

export interface Citation {
  timestampSeconds: number;
  text: string;
}

export interface MessageResponse {
  conversationId: string;
  answer: string;
  citations: Citation[];
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citationsJson: Citation[] | null;
  createdAt: string;
}

export interface SimilarVideo {
  youtubeId: string;
  title: string;
  similarityScore: number;
}

export interface SimilarVideosResponse {
  similar: SimilarVideo[];
}

// ---------------------------------------------------------------------------
// API error codes (keep in sync with the error handler)
// ---------------------------------------------------------------------------
export type ErrorCode =
  | 'NO_CAPTIONS'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_URL'
  | 'LLM_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
  };
}
