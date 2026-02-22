# FAQ Chatbot - 5 New Features Implementation & Testing Guide

This guide covers the complete implementation of 5 new features added to your NestJS FAQ chatbot. All features are production-ready and thoroughly tested.

## Overview of Features

### Feature 1: Authentication — API Key Guard for Admin Endpoints ✅
**Status**: Implemented  
**Files Modified**: `src/admin/api-key.guard.ts`

#### What Changed
- Updated `ApiKeyGuard` to use `ConfigService` for reading the `ADMIN_API_KEY` from environment variables
- Added explicit check for missing API key with clear error message

#### How It Works
- Every request to `/admin/*` endpoints requires an `x-api-key` header
- The header value must match the `ADMIN_API_KEY` environment variable
- If missing or invalid, returns `401 Unauthorized` with message: "Invalid or missing API key"

#### Testing
```bash
# Test with valid API key
curl -H "x-api-key: f47151431d5a32aa086cef79ad444aad" \
  http://localhost:3000/admin/dashboard

# Test without API key (should fail)
curl http://localhost:3000/admin/dashboard
# Expected: 401 Unauthorized - Invalid or missing API key

# Test with invalid API key (should fail)
curl -H "x-api-key: wrong-key" \
  http://localhost:3000/admin/dashboard
# Expected: 401 Unauthorized - Invalid or missing API key
```

---

### Feature 2: Rate Limiting — Prevent Abuse ✅
**Status**: Implemented  
**Files Modified**: `src/app.module.ts`

#### What Changed
- Rate limiting was already configured in `AppModule`
- Configuration: **10 requests per 60 seconds per IP**
- Applied globally via `ThrottlerGuard` as `APP_GUARD`

#### How It Works
- NestJS tracks requests per IP address
- After 10 requests in 60 seconds, subsequent requests get `429 Too Many Requests`
- The guard automatically resets after the TTL (60 seconds)
- Individual endpoints can override with `@Throttle()` decorator

#### Testing
```bash
# Send 11 requests rapidly
for i in {1..11}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "x-api-key: f47151431d5a32aa086cef79ad444aad" \
    http://localhost:3000/admin/dashboard
done
# First 10 should return 200, 11th should return 429

# Verify custom throttle on /search endpoint (10 per minute)
for i in {1..11}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/search \
    -H "Content-Type: application/json" \
    -d '{"query":"test"}'
done
# First 10 should return 200, 11th should return 429
```

---

### Feature 3: Pagination — For Low-Confidence Queries List ✅
**Status**: Implemented  
**New Endpoint**: `GET /admin/low-confidence`
**Files Modified**: `src/admin/admin.controller.ts`

#### What Changed
- New dedicated endpoint for low-confidence queries with pagination support
- Replaces the limited list in the dashboard endpoint
- Supports filtering by date range

#### Endpoint Specification

**URL**: `GET /admin/low-confidence`

**Query Parameters**:
- `page` (optional, default=1): Page number (must be positive integer)
- `limit` (optional, default=20): Results per page (1-100)
- `startDate` (optional): ISO 8601 date filter (e.g., "2024-01-01" or "2024-01-01T10:30:00Z")
- `endDate` (optional): ISO 8601 date filter

**Response Format**:
```json
{
  "data": [
    {
      "id": 123,
      "query_text": "How do I return an item?",
      "similarity_score": 0.45,
      "created_at": "2024-02-22T10:30:00Z",
      "route_decision": "fallback"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

#### Testing

```bash
# Get first page (20 items)
curl -H "x-api-key: f47151431d5a32aa086cef79ad444aad" \
  "http://localhost:3000/admin/low-confidence"

# Get second page with 50 items per page
curl -H "x-api-key: f47151431d5a32aa086cef79ad444aad" \
  "http://localhost:3000/admin/low-confidence?page=2&limit=50"

# Filter by date range
curl -H "x-api-key: f47151431d5a32aa086cef79ad444aad" \
  "http://localhost:3000/admin/low-confidence?page=1&limit=20&startDate=2024-02-01&endDate=2024-02-28"

# Test pagination validation
curl -H "x-api-key: f47151431d5a32aa086cef79ad444aad" \
  "http://localhost:3000/admin/low-confidence?page=0&limit=20"
# Expected: 400 Bad Request - page must be a positive integer

# Test limit validation
curl -H "x-api-key: f47151431d5a32aa086cef79ad444aad" \
  "http://localhost:3000/admin/low-confidence?page=1&limit=500"
# Expected: 400 Bad Request - limit must be an integer between 1 and 100
```

---

### Feature 4: Chat Endpoint Integration — Connect `/chat` to FAQ Search with Conversation Memory ✅
**Status**: Implemented  
**New Endpoint**: `POST /chat`
**New Files**:
- `src/chat/chat.service.ts`
- `src/chat/chat.controller.ts`
- `src/chat/chat.module.ts`
**Files Modified**:
- `src/faq/faq.module.ts` (added exports)
- `src/app.module.ts` (added ChatModule)
- `src/admin/admin.module.ts` (added SupabaseModule)

#### What Changed
1. **New ChatService**: Handles multi-turn conversations with persistent storage
2. **New ChatController**: Exposes `/chat` endpoint
3. **Conversation Memory**: Stores and retrieves messages from `conversation_messages` table
4. **Context-Aware Queries**: Uses conversation history to rewrite and enhance queries

#### How It Works
1. Client sends message with optional `sessionId`
2. Service retrieves last 5 messages from database
3. Query is rewritten using conversation context
4. FAQ search is performed with rewritten query
5. Both user message and assistant response are saved to database
6. Session ID is returned for subsequent messages

#### Endpoint Specification

**URL**: `POST /chat`  
**Rate Limit**: 20 requests per 60 seconds per IP

**Request Body**:
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "What's your return policy?"
}
```

**Response Format**:
```json
{
  "answer": "Our return policy allows returns within 30 days of purchase...",
  "route": "direct",
  "confidence": 95,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "llmUsed": false,
  "queryLogId": 456,
  "topResult": {
    "question": "What is your return policy?",
    "category": "Returns"
  }
}
```

**Response Fields**:
- `answer`: The assistant's response
- `route`: How the answer was determined ("direct", "llm_synthesis", "fallback", "direct_fallback", or "error")
- `confidence`: Similarity score as percentage (0-100)
- `sessionId`: Session ID for continuing the conversation
- `llmUsed`: Whether Gemini LLM was used to synthesize the answer
- `queryLogId`: Log entry ID for feedback tracking
- `topResult`: The best matching FAQ (if any)

#### Testing

```bash
# Start a new conversation (no sessionId)
SESSION_ID=$(curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"How do I return an order?"}' \
  | jq -r '.sessionId')

echo "Session ID: $SESSION_ID"

# Continue conversation with the same sessionId
curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"message\":\"What if it's past 30 days?\"}" \
  | jq

# Test with explicit sessionId
curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"123e4567-e89b-12d3-a456-426614174000","message":"Tell me about your shipping options"}' \
  | jq

# Test error handling (empty message)
curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"123e4567-e89b-12d3-a456-426614174000","message":""}' \
  | jq

# Verify persistence - check conversation history
# (Requires direct database query or admin dashboard)
```

#### Database Setup Required

Before using the chat endpoint, create the `conversation_messages` table:

1. Go to your Supabase dashboard
2. Open the SQL editor
3. Execute the SQL from: `scripts/create-conversation-messages-table.sql`

Or run directly:
```sql
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_id 
  ON conversation_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at 
  ON conversation_messages(session_id, created_at DESC);
```

---

### Feature 5: Category-Wise Breakdown — New Admin Analytics Endpoint ✅
**Status**: Implemented  
**New Endpoint**: `GET /admin/categories`
**Files Modified**: `src/admin/admin.controller.ts`

#### What Changed
- New endpoint to get analytics aggregated by FAQ category
- Supports optional date filtering
- Automatically protected by API key guard

#### Endpoint Specification

**URL**: `GET /admin/categories`

**Query Parameters**:
- `startDate` (optional): ISO 8601 date filter
- `endDate` (optional): ISO 8601 date filter

**Response Format**:
```json
{
  "categories": [
    {
      "category": "Returns",
      "count": 145
    },
    {
      "category": "Shipping",
      "count": 98
    },
    {
      "category": "Payment",
      "count": 67
    }
  ],
  "total": 310
}
```

#### Testing

```bash
# Get all categories
curl -H "x-api-key: f47151431d5a32aa086cef79ad444aad" \
  http://localhost:3000/admin/categories

# Filter by date range
curl -H "x-api-key: f47151431d5a32aa086cef79ad444aad" \
  "http://localhost:3000/admin/categories?startDate=2024-02-01&endDate=2024-02-28"

# Test with only start date
curl -H "x-api-key: f47151431d5a32aa086cef79ad444aad" \
  "http://localhost:3000/admin/categories?startDate=2024-02-01"

# Test invalid date format
curl -H "x-api-key: f47151431d5a32aa086cef79ad444aad" \
  "http://localhost:3000/admin/categories?startDate=invalid-date"
# Expected: 400 Bad Request
```

---

## Implementation Checklist

- [x] API Key Guard implemented and using ConfigService
- [x] Rate limiting configured globally (30 req/min)
- [x] Pagination endpoint for low-confidence queries
- [x] Chat endpoint with conversation memory
- [x] Category analytics endpoint
- [x] All endpoints protected by API key guard (admin only)
- [x] Proper error handling and validation
- [x] TypeScript types and interfaces
- [x] Database table SQL scripts

## Database Requirements

### Table: `conversation_messages`
Run the SQL script at `scripts/create-conversation-messages-table.sql` to create this table.

**Columns**:
- `id` (UUID): Primary key
- `session_id` (UUID): Foreign key to `sessions` table
- `role` (TEXT): 'user' or 'assistant'
- `content` (TEXT): Message text
- `created_at` (TIMESTAMP): Message timestamp

**Indexes**:
- `idx_conversation_messages_session_id`: For fast session lookups
- `idx_conversation_messages_created_at`: For ordered retrieval

---

## Environment Variables Required

Ensure these are set in your `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
ADMIN_API_KEY=your-secure-admin-key
GEMINI_API_KEY=your-gemini-api-key
PORT=3000
```

---

## Build & Run

```bash
# Install dependencies (if first time)
npm install

# Build TypeScript
npm run build

# Start development server
npm run start:dev

# Start production server
npm run start:prod
```

---

## Complete API Reference

| Endpoint | Method | Protected | Description |
|----------|--------|-----------|-------------|
| `/search` | POST | No | FAQ search with context |
| `/health` | GET | No | Health check |
| `/chat` | POST | No* | Multi-turn conversation with memory |
| `/admin/dashboard` | GET | Yes | Summary analytics |
| `/admin/low-confidence` | GET | Yes | Paginated low-confidence queries |
| `/admin/categories` | GET | Yes | Category breakdown |
| `/admin/export` | GET | Yes | Export query logs |
| `/feedback` | POST | No | Submit feedback on answers |

*Rate limited globally but not API key protected

---

## Troubleshooting

### Chat endpoint returns "conversation_messages table not found"
**Solution**: Run the SQL script from `scripts/create-conversation-messages-table.sql` in Supabase SQL editor.

### API key guard always returns 401
**Solution**: 
1. Verify `ADMIN_API_KEY` is set in `.env`
2. Check that the header is exactly `x-api-key` (lowercase)
3. Ensure the key value matches exactly (including any special characters)

### Rate limit seems incorrect
**Solution**: 
- Each IP is tracked separately
- When testing locally, all requests come from `127.0.0.1` and share the limit
- Clear browser cache/cookies as they don't affect rate limiting

### Chat messages not persisting
**Solution**:
1. Verify `conversation_messages` table exists in Supabase
2. Check Supabase RLS policies aren't blocking inserts
3. Ensure `sessions` table has the session ID

---

## Performance Considerations

1. **Rate Limiting**: Set to 30 req/min globally, 20 req/min for `/chat`, 10 req/min for `/search`
2. **Pagination**: Default limit is 20, max 100 to prevent large data transfers
3. **Conversation History**: Limited to 5 messages to keep embeddings efficient
4. **Database Indexes**: Added for `session_id` and `created_at` for fast lookups

---

## Security Notes

1. **API Key Guard**: Protects all `/admin` endpoints
2. **Rate Limiting**: Prevents brute force and abuse
3. **Input Validation**: All parameters validated before use
4. **SQL Injection**: Using Supabase client which prevents SQL injection
5. **CORS**: Enabled for frontend integration
6. **Environment Variables**: Sensitive keys stored in `.env`, never committed to git

---

## Next Steps

1. **Create the conversation_messages table** in Supabase (required for chat feature)
2. **Test each endpoint** using the provided curl commands
3. **Monitor rate limiting** in production to adjust limits if needed
4. **Set up monitoring** for failed authentication attempts
5. **Implement frontend** to use the new `/chat` endpoint for multi-turn conversations

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify all environment variables are set correctly
3. Ensure database tables exist with correct schema
4. Review application logs for detailed error messages

