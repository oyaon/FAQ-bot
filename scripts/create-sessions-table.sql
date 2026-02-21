-- Create sessions table for persistent conversation memory
-- Run this in Supabase SQL Editor

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

