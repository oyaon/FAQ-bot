# Conversation Memory Testing Guide

This document explains how to test the conversation memory system for your FAQ bot.

## How It Works

1. **Session Creation**: When a user sends their first query, a session ID is automatically created
2. **Context Rewriting**: Follow-up questions are rewritten using conversation history before searching
3. **Session Tracking**: All messages are stored in the session for context awareness
4. **Automatic Cleanup**: Sessions older than 1 hour are deleted automatically

## Test with cURL

### Step 1: First Question (Creates Session)

```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query":"What is your return policy?"}'
```

**Expected Response:**
```json
{
  "route": "direct",
  "similarity": 85,
  "answer": "You have 30 days to return items...",
  "question": "What is your return policy?",
  "category": "Returns",
  "results": [...],
  "queryLogId": 123,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "contextUsed": false
}
```

**⚠️ Note the `sessionId` in the response** - you'll use this for follow-up questions.

### Step 2: Follow-up Question (Uses Context)

```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What if it is damaged?",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Expected Response:**
```json
{
  "route": "direct",
  "similarity": 82,
  "answer": "For damaged items, contact support within 48 hours...",
  "question": "What about damaged items?",
  "category": "Returns",
  "results": [...],
  "queryLogId": 124,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "contextUsed": true,
  "rewrittenQuery": "What if it is damaged? (regarding returns and refunds)"
}
```

Notice:
- ✅ `contextUsed: true` - the query was rewritten
- ✅ `rewrittenQuery` shows what was actually searched
- ✅ Same `sessionId` preserved for conversation continuity

### Step 3: Another Follow-up (More Context)

```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "And what about shipping?",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

The system will track that you previously asked about returns and understand "shipping" in that context.

## Test with Frontend

Simply open `http://localhost:3000` in your browser and:

1. **First query**: "What is your return policy?"
2. **Second query**: "What if it is damaged?" 
   - Notice the "📝 Using conversation context" indicator appears
3. **Keep chatting** - context carries through the entire conversation

The session ID is automatically managed on the frontend - stored in the `sessionId` JavaScript variable.

## Understanding Query Rewriting

### Self-Contained Queries
These queries don't need context and are searched as-is:
- "What is your return policy?"
- "How do I track my order?"
- "Do you offer free shipping?"

### Context-Needing Queries
These are rewritten with context:
- "What if it is damaged?" → "What if it is damaged? (regarding returns and refunds)"
- "What about shipping?" → "What about shipping? (regarding returns and refunds)"
- "Can I do that instead?" → "Can I do that instead? (regarding returns and refunds)"

### Detection Logic

The system checks if a query needs context by looking for:
- **Pronouns**: "it", "that", "this", "they", "them", "those", "these"
- **References**: "the same", "what about", "how about", "and if"
- **Conditional**: "what if", "but what", "also", "too", "instead", "another"
- **Short length**: Queries under 4 words (unless they're known self-contained phrases)

## Debugging

To see what's happening in conversation memory:

1. **Check browser console** for network requests - look for `rewrittenQuery` in responses
2. **Monitor logs** - the context rewriter logs when it rewrites a query
3. **Test with minimal sessions** - use a new session ID to isolate behavior

## Features

| Feature | Behavior |
|---------|----------|
| **Session TTL** | Automatic cleanup after 1 hour of inactivity |
| **Message Limit** | Last 10 messages stored per session (prevents memory bloat) |
| **Context Window** | Last 4 messages used for rewriting (includes history) |
| **Response** | Always includes `sessionId` and `contextUsed` flag |

## Performance Notes

- Session storage uses in-memory Map (suitable for portfolio projects)
- Context rewriting is instant (< 1ms)
- For production: migrate to Redis for distributed session management
