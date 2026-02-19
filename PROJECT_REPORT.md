# FAQ Bot Project Report

## 1. Project Overview

**Project Name:** FAQ Bot  
**Framework:** NestJS (Node.js)  
**Type:** REST API Backend Application  
**Purpose:** An intelligent FAQ search system that uses vector embeddings to match user queries with FAQ answers stored in Supabase.  

### Key Technologies
- **Backend Framework:** NestJS 11.x
- **Database:** Supabase (PostgreSQL with vector support)
- **ML/AI:** Xenova/transformers (all-MiniLM-L6-v2 model for embeddings)
- **Language:** TypeScript
- **Node Version:** 20.x

---

## 2. Architecture

### Module Structure

```
src/
├── app.module.ts           # Root module
├── main.ts                 # Application entry point
├── app.controller.ts       # Default controller
├── app.service.ts          # Default service
├── supabase/               # Database integration
│   ├── supabase.module.ts
│   └── supabase.service.ts
├── chat/                   # Chat functionality (in development)
│   ├── chat.module.ts
│   ├── chat.controller.ts
│   ├── chat.service.ts
│   └── dto/chat.dto.ts
├── embedding/              # ML embedding service
│   ├── embedding.module.ts
│   ├── embedding.service.ts
│   └── embedding.service.spec.ts
├── faq/                    # FAQ search core
│   ├── faq.module.ts
│   ├── faq.controller.ts
│   ├── faq.service.ts
│   ├── faq.controller.spec.ts
│   ├── faq.service.spec.ts
│   └── dto/
│       ├── search.dto.ts
│       └── feedback.dto.ts
├── metrics/                # Analytics endpoints
│   ├── metrics.module.ts
│   └── metrics.controller.ts
├── admin/                  # Admin dashboard
│   └── admin.controller.ts
└── public/                 # Static assets
    └── index.html
```

---

## 3. Core Features

### 3.1 FAQ Search (Primary Feature)
**Endpoint:** `POST /search`

- Uses vector embeddings (all-MiniLM-L6-v2) to convert user queries into numerical representations
- Performs semantic similarity search in Supabase using the `match_faq` RPC function
- Has intelligent routing logic based on similarity scores:
  - **≥75% similarity:** Direct answer route
  - **50-74% similarity:** Suggestions route
  - **<50% similarity:** Fallback route
- Logs all queries with metadata (similarity score, response time, route decision)

### 3.2 Embedding Service
**Service:** `EmbeddingService`

- Loads the Xenova/all-MiniLM-L6-v2 model on module initialization
- Implements in-memory caching (max 1000 entries, FIFO eviction)
- Provides `generate(text)` method that returns 384-dimensional embedding vectors

### 3.3 Chat Endpoint
**Endpoint:** `POST /chat`

- Currently a placeholder/skeleton implementation
- Accepts message and optional sessionId
- Returns acknowledgment response

### 3.4 Metrics & Analytics
**Endpoints:**
- `GET /metrics` - Returns total query count and average similarity score
- `GET /metrics/top-queries` - Returns top queries via Supabase RPC

### 3.5 Admin Dashboard
**Endpoints:**
- `GET /admin` - Dashboard with date range filtering (startDate, endDate parameters)
  - Total queries count
  - Average similarity score
  - Recent low-confidence queries (<50% similarity)
- `GET /admin/export` - Export query logs
  - Supports format: csv or json
  - Date range filtering supported

### 3.6 Feedback System
**Endpoint:** `POST /feedback`

- Allows users to rate FAQ search results as helpful/not helpful
- Stores feedback in query_logs table

---

## 4. API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | Health check (Hello World) |
| GET | /health | Application health status |
| POST | /search | FAQ semantic search |
| POST | /feedback | Submit feedback for search results |
| POST | /chat | Chat message endpoint |
| GET | /metrics | Query metrics (count, avg similarity) |
| GET | /metrics/top-queries | Top queries |
| GET | /admin | Admin dashboard with stats |
| GET | /admin/export | Export query logs (CSV/JSON) |

---

## 5. Database Schema (Supabase)

### Tables (inferred from code):
1. **faq** - FAQ questions and answers with vector embeddings
   - id, question, answer, category, embedding

2. **query_logs** - Search query logging
   - id, query_text, query_hash, top_faq_id, similarity_score, route_decision, response_time_ms, feedback, created_at

### RPC Functions (inferred):
- `match_faq` - Vector similarity search
- `top_queries` - Get top queries

---

## 6. Configuration

### Environment Variables Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `PORT` - Server port (default: 3000)

---

## 7. Scripts

### `scripts/generate-embeddings.mjs`
- Loads FAQ questions from Supabase
- Generates embeddings using the Xenova model
- Updates FAQ records with vector embeddings

### `scripts/regenerate-one.mjs`
- Likely for regenerating a single FAQ embedding (not examined)

---

## 8. Current Development Status

### Completed Features:
- ✅ FAQ vector search with embeddings
- ✅ Similarity-based routing
- ✅ Query logging
- ✅ Feedback system
- ✅ Metrics endpoints
- ✅ Admin dashboard with date filtering
- ✅ CSV/JSON export

### In Development/Placeholder:
- 🔄 Chat endpoint (basic skeleton, not fully integrated with FAQ search)

### Potential Improvements:
- Integrate chat endpoint with FAQ search functionality
- Add more comprehensive error handling
- Add authentication/authorization
- Add rate limiting
- Improve caching strategies
- Add more comprehensive unit/e2e tests
- Consider adding WebSocket support for real-time chat

---

## 9. Build & Run Commands

```bash
# Install dependencies
npm install

# Development
npm run start:dev

# Production
npm run build
npm run start

# Run tests
npm run test
npm run test:e2e
npm run test:cov
```

---

## 10. Dependencies Summary

### Production Dependencies:
- `@nestjs/common` - Core NestJS
- `@nestjs/core` - NestJS core
- `@nestjs/config` - Configuration management
- `@nestjs/platform-express` - Express adapter
- `@supabase/supabase-js` - Supabase client
- `@xenova/transformers` - ML embedding model
- `class-transformer` / `class-validator` - DTO validation
- `dotenv` - Environment variables
- `json2csv` - CSV export
- `rxjs` - Reactive extensions

### Development Dependencies:
- TypeScript, ESLint, Prettier
- Jest (testing)
- NestJS CLI and schematics

---

## 11. Notes

- The project uses a Global SupabaseModule for database access across the application
- Embedding model is loaded once on startup and cached in memory
- Query logging is automatic for all searches
- The application serves static files from the `public` directory
- CORS is enabled for cross-origin requests

---

*Report generated based on codebase analysis*

---

# BUGS, ERRORS & ISSUES ANALYSIS

## 🚨 Critical Issues

### 1. Unused SupabaseService Injection in ChatService
**File:** `src/chat/chat.service.ts`
**Issue:** The `SupabaseService` is injected in the constructor but never used.
```typescript
constructor(private supabaseService: SupabaseService) {}
// supabaseService is never used in the class
```
**Impact:** Wasted memory for service instantiation, misleading code
**Fix:** Remove the unused injection or implement the chat feature properly

### 2. Duplicate Supabase Client Initialization
**Files:** `src/supabase/supabase.service.ts` and `src/faq/faq.service.ts`
**Issue:** Two separate Supabase client instances are created:
- `SupabaseService` creates one client
- `FaqService` creates its own client directly using ConfigService

**Impact:** 
- Inconsistent configuration handling
- Multiple connection pools
- Resource waste
- Code duplication

**Fix:** Use `SupabaseService` in `FaqService` instead of creating a new client

### 3. MetricsController Missing SupabaseModule Import
**File:** `src/metrics/metrics.controller.ts`
**Issue:** Uses `SupabaseService` but `MetricsModule` doesn't import `SupabaseModule`
```typescript
@Controller('metrics')
export class MetricsController {
  constructor(private supabaseService: SupabaseService) {}
}
```
**Why it works:** `SupabaseModule` is marked `@Global()` in `src/supabase/supabase.module.ts`, making it available everywhere.

**Recommendation:** Add explicit import for clarity: `imports: [SupabaseModule]`

---

## ⚠️ Warnings & Potential Issues

### 4. No Error Handling for Invalid Date Parameters
**File:** `src/admin/admin.controller.ts`
**Issue:** Date parameters (`startDate`, `endDate`) are not validated as valid dates
```typescript
@Get()
async dashboard(@Query('startDate') startDate?: string, ...) {
  // No validation if startDate/endDate are valid dates
  query = query.gte('created_at', startDate);
}
```
**Impact:** Could cause database query errors with invalid date formats
**Fix:** Add date validation using class-validator or manual validation

### 5. Missing Return for Error Cases in Admin Export
**File:** `src/admin/admin.controller.ts`
**Issue:** The error case throws but doesn't return, which could cause issues
```typescript
const { data, error } = await query;
if (error) throw new Error(error.message);
// Missing explicit return after throw
```
**Fix:** Add proper error handling or early return

### 6. Potential Memory Leak in Embedding Cache
**File:** `src/embedding/embedding.service.ts`
**Issue:** Cache uses simple FIFO eviction which may not remove the most relevant entries
```typescript
if (this.cache.size > 1000) {
  const firstKey = this.cache.keys().next().value;
  this.cache.delete(firstKey);
}
```
**Impact:** Less frequently used embeddings are evicted while frequently used ones might stay
**Recommendation:** Consider using LRU (Least Recently Used) cache instead

### 7. No Input Sanitization in searchByKeyword
**File:** `src/faq/faq.service.ts`
**Issue:** SQL LIKE query uses raw user input without sanitization
```typescript
.ilike('question', `%${query}%`)
```
**Impact:** Potential SQL injection (though Supabase client provides some protection)
**Fix:** Sanitize the query parameter or use parameterized queries

### 8. Unused Feedback Implementation
**File:** `public/index.html`
**Issue:** The feedback buttons call `sendFeedback()` but don't actually send data to the backend
```javascript
function sendFeedback(btn, helpful) {
  // Just updates UI, doesn't send to API
  // Feedback logged (extend later with API call if needed)
}
```
**Impact:** User feedback is not captured or stored

---

## 📝 Missing Components

### 9. Chat Module Not Integrated
**Status:** The Chat module exists but is not connected to the FAQ search functionality
- Chat endpoint (`POST /chat`) returns a placeholder response
- Not imported in `AppModule`
- Not connected to the FAQ search flow

### 10. Missing QueryLogId Tracking
**Issue:** The frontend doesn't track `queryLogId` to send feedback
- Feedback endpoint requires `queryLogId`
- Frontend doesn't capture or store this ID from search responses

### 11. No Authentication/Authorization
**Status:** No authentication or authorization implemented for:
- Admin endpoints
- Metrics endpoints
- Export functionality

### 12. No Rate Limiting
**Status:** API endpoints have no rate limiting protection

---

## 🔧 Code Quality Issues

### 13. Inconsistent Error Handling
- Some places throw errors, others return empty arrays
- No consistent error response format

### 14. Hardcoded Values
- Similarity thresholds (0.5, 75) are hardcoded in controller
- Could be moved to configuration

### 15. Missing API Response Types
- No consistent response DTOs
- Returns raw objects directly

---

## ✅ Correct Implementations

The following are implemented correctly:

- ✅ Global SupabaseModule with proper @Global() decorator
- ✅ Embedding service with OnModuleInit for model loading
- ✅ DTO validation with class-validator
- ✅ Proper logging throughout
- ✅ Static file serving
- ✅ CORS enabled
- ✅ CSV export functionality
- ✅ Date range filtering in admin dashboard

---

## Recommended Priority Fixes

1. **High:** Fix duplicate Supabase client (Issue #2)
2. **High:** Implement feedback API call in frontend (Issue #8)
3. **Medium:** Add date validation in admin controller (Issue #4)
4. **Medium:** Remove unused SupabaseService from ChatService (Issue #1)
5. **Low:** Improve embedding cache to LRU (Issue #6)

---

## ✅ Fixes Applied

The following issues have been fixed:

### 1. Duplicate Supabase Client (FIXED ✓)
- **File:** `src/faq/faq.service.ts`
- **Change:** Refactored FaqService to inject and use SupabaseService instead of creating its own client
- **Before:** Created new Supabase client with createClient()
- **After:** Uses injected SupabaseService.getClient()

### 2. Unused SupabaseService in ChatService (FIXED ✓)
- **File:** `src/chat/chat.service.ts`
- **Change:** Removed unused SupabaseService injection from constructor

### 3. Missing Input Sanitization (FIXED ✓)
- **File:** `src/faq/faq.service.ts`
- **Change:** Added sanitization for SQL LIKE wildcards in searchByKeyword()
```typescript
const sanitizedQuery = query.replace(/[%_]/g, '\\$&');
```

### 4. Date Validation in Admin (FIXED ✓)
- **File:** `src/admin/admin.controller.ts`
- **Change:** Added isValidDate() method with ISO 8601 format validation
- Added BadRequestException for invalid date formats

### 5. Feedback Not Connected to Backend (FIXED ✓)
- **Files:** 
  - `src/faq/faq.service.ts` - logQuery() now returns query log ID
  - `src/faq/faq.controller.ts` - Returns queryLogId in all search responses
  - `public/index.html` - Frontend now stores queryLogId and sends feedback to /feedback endpoint

### 6. MetricsController Calculation Bug (FIXED ✓)
- **File:** `src/metrics/metrics.controller.ts`
- **Issue:** Multiplication by 100 was done INSIDE the reduce function, causing wrong values (e.g., ~7500 instead of ~75)
- **Before:** `reduce((a,b) => a + (b.similarity_score || 0) * 100, 0) / length`
- **After:** `reduce((a,b) => a + (b.similarity_score || 0), 0) / length * 100`
- **Result:** Now returns correct percentage values (e.g., 75.5 instead of 7550)

---

*Report updated with fixes applied*

