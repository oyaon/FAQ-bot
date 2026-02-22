# Database Schema Finalization Guide

## Overview
This document provides all SQL statements needed to finalize your FAQ bot database schema and prepare for production deployment.

---

## Step 1: Create the `conversation_messages` Table

Run this SQL in your **Supabase SQL Editor**:

```sql
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

-- Create composite index for faster sorting by created_at within a session
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_created 
  ON conversation_messages(session_id, created_at DESC);

-- Enable RLS (Row Level Security) if needed
-- Uncomment the lines below if you want to enable RLS
-- ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all access" ON conversation_messages
--   FOR ALL USING (true) WITH CHECK (true);
```

**Status After Execution**: ✅ This table enables persistent chat memory functionality
- Messages are tied to session_id via foreign key
- Composite index optimizes queries for "get all messages for session X ordered by time"
- Automatic cascade delete when a session is removed

---

## Step 2: Add `matched_faq_category` Column to `query_logs` Table

Run this SQL in your **Supabase SQL Editor**:

```sql
-- Add matched_faq_category column to query_logs for category analytics
ALTER TABLE query_logs 
ADD COLUMN matched_faq_category TEXT;

-- Optional: Create an index for faster analytics queries
CREATE INDEX IF NOT EXISTS idx_query_logs_category 
  ON query_logs(matched_faq_category);
```

**Status After Execution**: ✅ Enables category-based analytics
- Supports the `/admin/categories` endpoint
- Optional index improves performance for category aggregations

### Backfill Existing Data (Optional)

If you want to populate historical data with categories, you can use this approach:

```sql
-- Backfill matched_faq_category from the FAQ table based on top_faq_id
UPDATE query_logs ql
SET matched_faq_category = f.category
FROM faq f
WHERE ql.top_faq_id = f.id 
  AND ql.matched_faq_category IS NULL;
```

**Note**: This matches query logs to their FAQ answers and extracts the category. Adjust as needed based on your FAQ schema.

---

## Step 3: Verify Schema Changes

Run these queries to confirm everything is set up correctly:

### Check `conversation_messages` Table

```sql
-- Verify conversation_messages table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'conversation_messages'
ORDER BY ordinal_position;
```

**Expected Output**: 5 rows with columns: id, session_id, role, content, created_at

```sql
-- Verify conversation_messages indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'conversation_messages'
ORDER BY indexname;
```

**Expected Output**: At least 3 indexes (pk + 2 indexes you created)

### Check `query_logs` Updates

```sql
-- Verify matched_faq_category column exists
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'query_logs'
  AND column_name = 'matched_faq_category';
```

**Expected Output**: 1 row with TEXT data type and nullable = YES

```sql
-- Verify category index exists (optional)
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'query_logs'
  AND indexname = 'idx_query_logs_category';
```

**Expected Output**: 1 row for the category index (if created)

### Full Row Count Check

```sql
-- Verify both tables exist and have accessible data
SELECT 
  'conversation_messages' as table_name,
  COUNT(*) as row_count
FROM conversation_messages

UNION ALL

SELECT 
  'query_logs',
  COUNT(*)
FROM query_logs;
```

---

## Step 4: Update Your Code to Use `matched_faq_category`

The `logQuery()` method in [faq.service.ts](src/faq/faq.service.ts) needs to be updated to capture and store the category.

**Current Issue**: The method doesn't accept or store the matched_faq_category

**Solution**: Update the method signature to include category, and pass it when inserting:

```typescript
async logQuery(
  queryText: string,
  topFaqId: number | null,
  similarityScore: number | null,
  routeDecision: string,
  responseTimeMs: number,
  llmUsed: boolean = false,
  contextUsed: boolean = false,
  matchedFaqCategory?: string,  // Add this parameter
): Promise<number | null> {
  try {
    const supabase = this.supabaseService.getClient();
    const crypto = await import('crypto');
    const queryHash = crypto
      .createHash('md5')
      .update(queryText.toLowerCase().trim())
      .digest('hex');

    const { data, error } = await supabase
      .from('query_logs')
      .insert({
        query_text: queryText,
        query_hash: queryHash,
        top_faq_id: topFaqId,
        similarity_score: similarityScore,
        route_decision: routeDecision,
        response_time_ms: responseTimeMs,
        llm_used: llmUsed,
        context_used: contextUsed,
        matched_faq_category: matchedFaqCategory || null,  // Add this line
      })
      .select('id')
      .single();

    if (error) {
      this.logger.error('Failed to log query:', error.message);
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    this.logger.error('Failed to log query:', err);
    return null;
  }
}
```

Then update all callers of `logQuery()` to include the category from the matched FAQ:

```typescript
// Example in chat.service.ts or wherever you call logQuery:
const matchedCategory = topFaq?.category || null;

await this.faqService.logQuery(
  userMessage,
  topFaq?.id ?? null,
  similarityScore,
  routeDecision,
  responseTimeMs,
  llmUsed,
  contextUsed,
  matchedCategory  // Add this
);
```

---

## Step 5: Connection & Table Existence Test

Before running tests, verify connectivity:

```sql
-- Quick health check query
SELECT 
  version() as postgres_version,
  current_database() as current_db,
  current_user as db_user,
  NOW() as server_time;
```

This confirms your Supabase connection is working and timezone handling is correct.

---

## Summary of Changes

| Table | Change | Status |
|-------|--------|--------|
| `sessions` | Created in initial setup | ✅ Already exists |
| `conversation_messages` | New table with 5 columns + 2 indexes | 🔧 **Run SQL from Step 1** |
| `query_logs` | Add `matched_faq_category` TEXT column + optional index | 🔧 **Run SQL from Step 2** |
| Code: `faq.service.ts` | Update `logQuery()` to accept & store category | 🔧 **Need code update** |

---

## Next Steps After Schema Changes

1. ✅ Run the SQL statements from Step 1 and Step 2 in Supabase
2. ✅ Run the verification queries from Step 3 to confirm
3. ✅ Update code in `faq.service.ts` to pass category to `logQuery()`
4. ✅ Re-run the feature test suite: `npm test` or `test-features.ps1`
5. ✅ Deploy to production once tests pass

---

**Expected Result**: All 5 features working correctly:
- ✅ Authentication (API key guard)
- ✅ Rate Limiting (429 after 10 requests/60s)
- ✅ Pagination (with offset/limit structure)
- ✅ Chat with Memory (session-based context)
- ✅ Category Analytics (`/admin/categories` returning category counts)
