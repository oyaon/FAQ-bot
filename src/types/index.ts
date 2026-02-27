// Shared type definitions for the FAQ Bot

// ============================================
// FAQ Types
// ============================================

/**
 * similarity is the raw cosine similarity score from pgvector, range 0 to 1.
 * This maps to similarity_score in query_logs table.
 */
export interface FaqResult {
  id: string;
  question: string;
  answer: string;
  similarity: number;
  category?: string;
}

export interface FaqSearchOptions {
  threshold?: number;
  limit?: number;
}

// ============================================
// Conversation Types
// ============================================

export interface ConversationMessage {
  id?: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export interface ConversationContext {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  created_at: string;
}

// History type for conversation context (used in FAQ controller)
export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================
// Query Log Types
// ============================================

/**
 * similarity_score maps to the similarity field in FaqResult, stored as 0 to 1 float.
 */
export interface QueryLogEntry {
  id?: number;
  query_text: string;
  query_hash?: string;
  top_faq_id: number | null;
  similarity_score: number | null;
  route_decision: string | null;
  response_time_ms: number | null;
  llm_used: boolean | null;
  context_used: boolean | null;
  matched_faq_category: string | null;
  created_at?: string;
  feedback?: number;
  rating?: number;
  feedback_type?: string;
}

// Alias for QueryLogEntry (used in metrics controller)
export type QueryLog = QueryLogEntry;

// Partial query log types for specific queries
export interface PartialQueryLog {
  response_time_ms?: number | null;
  llm_used?: boolean | null;
  route_decision?: string | null;
  feedback?: number | null;
  rating?: number | null;
  feedback_type?: string | null;
}

/**
 * helpful is typed as 1 for thumbs up or -1 for thumbs down.
 */
export interface FeedbackData {
  helpful: number;
  rating?: number;
  feedback_text?: string;
  feedback_type?: string;
}

// ============================================
// LLM Types
// ============================================

export interface FaqContext {
  question: string;
  answer: string;
  similarity: number;
}

export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

// ============================================
// Metrics Types
// ============================================

export interface RouteStatsEntry {
  count: number;
  totalSim: number;
  totalTime: number;
}

export interface MetricsSummary {
  totalQueries: number;
  averageSimilarity: number;
  averageResponseTime: number;
  routeBreakdown: Record<string, number>;
  llmUsageRate: number;
}

export interface TopQueryEntry {
  query: string;
  count: number;
  avgConfidence: number;
}

export interface RouteStatsResponse {
  [key: string]: {
    count: number;
    percentage: number;
    avgConfidence: number;
    avgResponseTime: number;
  };
}

export interface LlmMetricsEntry {
  totalAttempts: number;
  successful: number;
  successRate: number;
  totalUsed: number;
  usageRate: number;
}

export interface FeedbackStatsEntry {
  totalFeedback: number;
  helpfulRate: number;
  avgRating: number;
  feedbackTypes: Record<string, number>;
  ratingDistribution: {
    fiveStar: number;
    fourStar: number;
    threeStar: number;
    twoStar: number;
    oneStar: number;
  };
}

// ============================================
// Embedding Types
// ============================================

export interface EmbeddingOutput {
  data: number[];
}

export type EmbeddingPipeline = (
  text: string,
  options: {
    pooling: 'mean';
    normalize: boolean;
  },
) => Promise<EmbeddingOutput>;

// ============================================
// API Response Types
// ============================================

export interface SearchResponse {
  answer: string;
  route: string;
  confidence: number;
  sessionId: string;
  llmUsed: boolean;
  queryLogId: number | null;
  topResult: { question: string; category: string } | null;
  contextUsed?: boolean;
  rewrittenQuery?: string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
}
