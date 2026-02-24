-- FAQ Bot Database Setup Script
-- Run this in Supabase SQL Editor to set up the database

-- ================================
-- Create sessions table for persistent conversation memory
-- ================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries on last_active_at
CREATE INDEX IF NOT EXISTS idx_sessions_last_active 
ON sessions(last_active_at);

-- Enable Row Level Security (optional - adjust as needed)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Optional: Create a policy for public read/write (adjust for your auth needs)
DROP POLICY IF EXISTS "Allow all sessions" ON sessions;
CREATE POLICY "Allow all sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);

-- ================================
-- Create conversation_messages table for storing chat history
-- ================================
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Create index for faster lookups by session_id
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_id 
  ON conversation_messages(session_id);

-- Create index for faster sorting by created_at
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at 
  ON conversation_messages(session_id, created_at DESC);

-- Enable RLS (Row Level Security) if needed
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Create a policy for public access (adjust for your security needs)
DROP POLICY IF EXISTS "Allow all access" ON conversation_messages;
CREATE POLICY "Allow all access" ON conversation_messages
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions (optional, adjust to your security needs)
GRANT ALL ON conversation_messages TO authenticated;
GRANT ALL ON conversation_messages TO anon;
GRANT ALL ON sessions TO authenticated;
GRANT ALL ON sessions TO anon;

-- ================================
-- Note: If you have existing FAQs table, ensure it has the required structure
-- The FAQs table should have: id, question, answer, embedding columns
-- ================================

-- Enable Row Level Security on FAQs if needed (uncomment if required)
-- ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read" ON faqs FOR SELECT USING (true);
-- CREATE POLICY "Allow authenticated insert" ON faqs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Allow authenticated update" ON faqs FOR UPDATE USING (auth.role() = 'authenticated');
-- CREATE POLICY "Allow authenticated delete" ON faqs FOR DELETE USING (auth.role() = 'authenticated');

