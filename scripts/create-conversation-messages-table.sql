-- Create conversation_messages table for storing chat history
-- Run this in your Supabase SQL editor

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
-- Uncomment the lines below if you want to enable RLS
-- ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all access" ON conversation_messages
--   FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions (optional, adjust to your security needs)
-- GRANT ALL ON conversation_messages TO authenticated;
-- GRANT ALL ON conversation_messages TO anon;
