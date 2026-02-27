-- ============================================================================
-- FAQ Bot Database Setup Script
-- Run this in Supabase SQL Editor to set up the complete database
-- ============================================================================

-- ================================
-- Create FAQ table with vector embeddings
-- ================================
DROP TABLE IF EXISTS faq CASCADE;

CREATE TABLE faq (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  embedding VECTOR(384),  -- all-MiniLM-L6-v2 uses 384 dimensions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE faq ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Allow public read FAQ" ON faq;
CREATE POLICY "Allow public read FAQ" ON faq FOR SELECT USING (true);

-- Allow authenticated write (admin only - in production, restrict this)
DROP POLICY IF EXISTS "Allow authenticated insert FAQ" ON faq;
CREATE POLICY "Allow authenticated insert FAQ" ON faq FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create index for vector similarity search (using pgvector)
-- Note: This requires pgvector extension
DROP INDEX IF EXISTS faq_embedding_idx;
CREATE INDEX faq_embedding_idx ON faq USING ivfflat (embedding vector_cosine_ops);

-- ================================
-- Create match_faqs RPC function for vector search
-- ================================
DROP FUNCTION IF EXISTS match_faqs;

CREATE OR REPLACE FUNCTION match_faqs(
  query_embedding VECTOR(384),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  question TEXT,
  answer TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    faq.id,
    faq.question,
    faq.answer,
    faq.category,
    1 - (faq.embedding <=> query_embedding) AS similarity
  FROM faq
  WHERE faq.embedding IS NOT NULL
    AND 1 - (faq.embedding <=> query_embedding) > match_threshold
  ORDER BY faq.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ================================
-- Create query_logs table for analytics
-- ================================
DROP TABLE IF EXISTS query_logs CASCADE;

CREATE TABLE query_logs (
  id BIGSERIAL PRIMARY KEY,
  query_text TEXT NOT NULL,
  query_hash TEXT,
  top_faq_id UUID,
  similarity_score FLOAT,
  route_decision TEXT,
  response_time_ms INTEGER,
  llm_used BOOLEAN DEFAULT FALSE,
  context_used BOOLEAN DEFAULT FALSE,
  matched_faq_category TEXT,
  helpful BOOLEAN,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  feedback_type TEXT CHECK (feedback_type IN ('accurate', 'incomplete', 'unclear', 'irrelevant', 'outdated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON query_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_logs_query_hash ON query_logs(query_hash);

-- Enable RLS
ALTER TABLE query_logs ENABLE ROW LEVEL SECURITY;

-- Allow public insert (for logging from the API)
DROP POLICY IF EXISTS "Allow public insert query_logs" ON query_logs;
CREATE POLICY "Allow public insert query_logs" ON query_logs FOR INSERT WITH CHECK (true);

-- Allow public update (for feedback)
DROP POLICY IF EXISTS "Allow public update query_logs" ON query_logs;
CREATE POLICY "Allow public update query_logs" ON query_logs FOR UPDATE USING (true);

-- ================================
-- Create sessions table for conversation memory
-- ================================
DROP TABLE IF EXISTS sessions CASCADE;

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all sessions" ON sessions;
CREATE POLICY "Allow all sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);

-- ================================
-- Create conversation_messages table
-- ================================
DROP TABLE IF EXISTS conversation_messages CASCADE;

CREATE TABLE conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_id ON conversation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(session_id, created_at DESC);

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access conversation_messages" ON conversation_messages;
CREATE POLICY "Allow all access conversation_messages" ON conversation_messages FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON faq TO authenticated, anon;
GRANT ALL ON query_logs TO authenticated, anon;
GRANT ALL ON sessions TO authenticated, anon;
GRANT ALL ON conversation_messages TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- ================================
-- Seed FAQ data (sample questions and answers)
-- ================================
INSERT INTO faq (question, answer, category) VALUES
('How do I track my order?', 'You can track your order by logging into your account and visiting the "Orders" section. There you will see real-time tracking information including shipment status and estimated delivery date. You can also use the tracking number sent to your email on the carrier''s website.', 'orders'),
('What is your return policy?', 'We offer a 30-day return policy for most items. Items must be unused and in their original packaging. To initiate a return, go to your order history and select "Return Item". You will receive a prepaid shipping label. Refunds are processed within 5-7 business days after we receive the item.', 'returns'),
('How do I contact customer support?', 'You can reach our customer support team through multiple channels: 1) Live chat on our website 24/7, 2) Email at support@example.com (response within 24 hours), 3) Phone at 1-800-123-4567 Monday-Friday 9am-6pm EST.', 'support'),
('What payment methods do you accept?', 'We accept all major credit cards (Visa, MasterCard, American Express, Discover), PayPal, Apple Pay, Google Pay, and bank transfers. All transactions are secure and encrypted.', 'payment'),
('How do I change my shipping address?', 'To change your shipping address, go to your account settings or contact customer support immediately after placing your order. If the order has not yet shipped, we can update the address. Once shipped, changes may not be possible.', 'shipping'),
('Do you offer international shipping?', 'Yes, we ship to over 100 countries worldwide. International shipping rates and delivery times vary by location. You can see available shipping options and costs at checkout. Note that customs fees may apply.', 'shipping'),
('How do I reset my password?', 'Click "Forgot Password" on the login page, enter your email address, and we will send you a password reset link. The link expires in 24 hours. If you dont receive the email, check your spam folder or contact support.', 'account'),
('Where is my refund?', 'Refunds typically take 5-7 business days to process after returning an item. Once processed, it may take 2-3 additional business days for the funds to appear in your account. Check your order history for refund status.', 'refunds'),
('Is my personal information secure?', 'Yes, we take data security seriously. We use industry-standard SSL encryption, never store your full credit card details, and comply with GDPR and CCPA regulations. You can review our full Privacy Policy on our website.', 'privacy'),
('How do I cancel my subscription?', 'To cancel a subscription, go to Account Settings > Subscriptions and click "Cancel". You can also contact customer support. Note that you may be charged a cancellation fee for certain subscription types.', 'subscriptions')
ON CONFLICT DO NOTHING;

-- ================================
-- Verify the setup
-- ================================
SELECT 'FAQ count:' AS check_name, COUNT(*) AS result FROM faq
UNION ALL
SELECT 'Sessions table exists:', COUNT(*) FROM information_schema.tables WHERE table_name = 'sessions'
UNION ALL
SELECT 'Query logs table exists:', COUNT(*) FROM information_schema.tables WHERE table_name = 'query_logs'
UNION ALL
SELECT 'match_faqs function exists:', COUNT(*) FROM information_schema.routines WHERE routine_name = 'match_faqs';

-- Note: After running this script, you need to generate embeddings for the FAQs
-- Run: npm run generate:embeddings

-- ============================================
-- Performance Indexes (added for analytics optimization)
-- ============================================

-- Index for filtering queries by route (speeds up analytics queries by route)
CREATE INDEX IF NOT EXISTS idx_query_logs_route ON query_logs(route_decision);

-- Index for ordering queries by created_at (speeds up time-based analytics)
CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON query_logs(created_at DESC);

-- Index for similarity score filtering (speeds up queries filtering by similarity threshold)
CREATE INDEX IF NOT EXISTS idx_query_logs_similarity ON query_logs(similarity_score);

-- Index for session-based message retrieval (speeds up conversation history lookups)
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_id ON conversation_messages(session_id);

-- Partial index for feedback queries (only indexes rows with feedback, speeds up feedback analytics)
CREATE INDEX IF NOT EXISTS idx_query_logs_feedback ON query_logs(feedback) WHERE feedback IS NOT NULL;

