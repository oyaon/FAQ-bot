# Architectural Weaknesses

## 1. Architectural Layering Violations

### a) ChatService God Class
- `ChatService` orchestrates every aspect of the chat flow: embedding generation, vector search, LLM synthesis, context rewriting, message persistence, and query logging
- This violates Single Responsibility Principle - it acts as an orchestrator, data fetcher, and logger simultaneously

### b) FaqController Duplication
- `FaqController` (`src/faq/faq.controller.ts` lines 35-108) duplicates the entire 3-tier routing logic found in `ChatService` (`src/chat/chat.service.ts` lines 89-144)
- Both implement identical routing: direct (>0.8), llm_synthesis (0.5-0.8), fallback (<0.5)
- This creates maintenance burden and inconsistent behavior

### c) Controller-Service Boundary Violation
- `FaqController` directly injects `EmbeddingService`, `LlmService`, and `FaqService`
- Controller contains business logic (routing decisions, embedding generation) that should be in the service layer

## 2. Service Responsibility Leakage

### a) ConversationService Dual Role
- `ConversationService` maintains both in-memory session state AND relies on Supabase for persistent conversation history
- `ChatService.getConversationHistory()` fetches from Supabase while `ConversationService` manages in-memory Map
- This creates dual state sources that can diverge

### b) FaqService Overreach
- `FaqService` handles vector search, keyword search, query logging, AND feedback storage
- Query logging (analytics concern) should be separated

### c) Hardcoded Orchestration in ChatService
```typescript
// Lines 89-144: ChatService orchestrates everything sequentially
const embedding = await this.embeddingService.generate(rewrittenQuery);
const results = await this.faqService.searchByVector(embedding, 0.5, 3);
// ... then conditional LLM synthesis
```
No separation between coordination and execution

## 3. Hidden Tight Coupling

### a) Hardcoded Thresholds
- Similarity thresholds (0.8, 0.5, 0.4) are hardcoded in both `ChatService` and `FaqController`
- No configuration for tuning these critical routing parameters

### b) Synchronous Model Loading
```typescript
// embedding.service.ts line 16
this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
```
- Model loads synchronously at startup, blocking application startup for 1-2 minutes on first run
- No lazy loading or background initialization option

### c) Direct Supabase Client Access
- Services directly call `supabaseService.getClient()` instead of using repository pattern
- No abstraction over database operations

## 4. Orchestration Design Weaknesses

### a) Sequential Processing Pipeline
- Embedding → Search → LLM are executed sequentially when some could be parallelized
- No message queue or async processing for heavy operations

### b) No Circuit Breaker
- No protection against cascade failures when Gemini API is slow or down
- LLM timeout (30s) is long and blocks thread

### c) No Request Batching
- Each embedding request is processed individually
- Vector search happens per-request without caching frequent queries

## 5. Scaling Blockers (Horizontal Scaling)

---

# Scalability Risks

## 1. In-Memory Session Store (CRITICAL)
```typescript
// conversation.service.ts lines 5-6
private sessions = new Map<string, Session>();
```
- Sessions stored in memory - **impossible to scale horizontally**
- Each server instance has isolated session state
- No sticky session configuration observed
- Sessions lost on restart/redeployment

**At 100 DAU**: ~10 messages × 100 sessions × ~1KB = ~1MB (manageable but fragile)
**At 1,000 DAU**: ~10MB in-memory, still works but no failover
**At 10,000 DAU**: ~100MB+ per instance, horizontal scaling impossible

## 2. Single Embedding Instance
```typescript
// embedding.service.ts line 9
private extractor: Pipeline | null = null;
```
- One instance of the embedding model per process
- No GPU pooling or model serving infrastructure
- Cannot handle concurrent requests efficiently at scale

## 3. Database Connection Pattern
- Each request creates new Supabase client calls
- No connection pooling configuration visible
- `SupabaseService` creates single client - may exhaust connections under load

## 4. No Caching Layer
- Every query generates a new embedding
- Frequently asked questions recompute embeddings unnecessarily
- No Redis or in-memory cache for query results

## 5. LLM Rate Limiting Vulnerability
```typescript
// llm.service.ts - direct Gemini API calls with no queue or rate limiting
const response = await fetch(this.apiUrl, {...});
```
- No queue for LLM requests
- No retry with exponential backoff
- No request batching for cost optimization

---

# State Management Risks

## 1. Dual State Sources
- **In-memory**: `ConversationService.sessions` Map
- **Persistent**: `conversation_messages` table in Supabase
- Risk: States can diverge if in-memory session expires but Supabase history exists

## 2. Silent Failures with Graceful Degradation
```typescript
// chat.service.ts lines 36-42
if (!supabase) {
  this.logger.warn('Supabase not initialized, returning empty history');
  return [];
}
```
- System continues with empty data instead of surfacing errors
- Users get degraded experience without notification
- Makes debugging production issues difficult

## 3. Session Cleanup Interval
```typescript
// conversation.service.ts line 14
setInterval(() => this.cleanup(), 30 * 60 * 1000);
```
- 30-minute cleanup interval may allow memory growth
- Stale sessions accumulate between cleanup cycles

## 4. No Session Persistence Guarantees
- Messages saved asynchronously after response returned
- If server crashes, recent messages may be lost

```typescript
// chat.service.ts lines 177-179
await this.saveMessage(sessionId, 'user', userMessage);
await this.saveMessage(sessionId, 'assistant', answer);
```
- Fire-and-forget pattern would improve response time but lose messages on failure

---

# Failure Scenarios

## 1. Embedding Model Failure at Startup
```typescript
// embedding.service.ts lines 21-25
} catch (error) {
  this.logger.error('Failed to load embedding model:', error);
  throw error;
}
```
- Entire application crashes if model fails to load
- No fallback to keyword search or external embedding service

## 2. Gemini API Failure
```typescript
// llm.service.ts lines 123-130
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    this.logger.error('LLM API request timeout after 30s');
  }
  return null;
}
```
- Returns `null` causing fallback to direct answer
- Users receive potentially irrelevant FAQ answers
- No retry mechanism

## 3. Database Unavailable at Runtime
- Supabase connection failures silently handled
- Query logging fails silently
- Analytics become incomplete
- User sessions not persisted

## 4. Cascade Failure from Throttling
```typescript
// chat.controller.ts line 14
@Throttle({ default: { limit: 20, ttl: 60000 } })
```
- Rate limiting may cause legitimate users to be rejected
- No queue or graceful overload handling

## 5. Memory Exhaustion Under Load
- Unbounded session accumulation during traffic spikes
- No memory limits or circuit breakers
- Node.js process could be OOM killed

---

# Technical Fragility Points

## 1. Configuration Weaknesses
```typescript
// app.module.ts lines 18-27
validationSchema: Joi.object({
  SUPABASE_URL: Joi.string().optional(),
  SUPABASE_ANON_KEY: Joi.string().optional(),
  ADMIN_API_KEY: Joi.string().optional(),
  GEMINI_API_KEY: Joi.string().optional(),
```
- All critical integrations are optional - system starts degraded
- No health checks to detect degraded state

## 2. Security Gaps
- Admin API only protected by static API key (no rotation, no audit logging)
- No rate limiting on admin endpoints
- CORS origins are hardcoded

```typescript
// main.ts line 57
const validKey = this.configService?.get<string>('ADMIN_API_KEY') || process.env.ADMIN_API_KEY;
```
- Environment variables checked at runtime - not validated at startup

## 3. Error Handling Inconsistencies
- Some errors return 500, others return 200 with error in body
- No standardized error response format

## 4. Duplicated Context Rewriting Logic
- `ContextRewriterService` imported in ChatService
- FaqController has commented-out context rewriting
- Unclear which path is actually used

```typescript
// faq.controller.ts lines 27-30
// TEMPORARILY DISABLED - ConversationService causing crashes
// Context rewriting disabled with no timeline to re-enable
```

## 5. Missing Feature Flags
- All features always enabled
- Cannot toggle LLM synthesis independently
- Cannot switch embedding providers

## 6. No Health Check for Dependencies
- `/health` endpoint returns basic status
- Doesn't verify Supabase connectivity
- Doesn't check embedding model readiness
- Doesn't verify Gemini API accessibility

---

# Overall Architecture Maturity Score: 42/100

## Breakdown:
| Category | Score | Issues |
|----------|-------|--------|
| Layering & Responsibilities | 4/10 | God class, duplicated logic, boundary violations |
| Coupling | 5/10 | Hardcoded values, direct dependencies |
| Scalability | 2/10 | In-memory sessions, single model instance |
| State Management | 4/10 | Dual sources, silent failures |
| Failure Handling | 5/10 | No circuit breakers, cascade risks |
| Observability | 5/10 | Limited metrics, no tracing |
| Security | 6/10 | Static API key, limited RBAC |
| Configuration | 4/10 | Optional integrations, no validation |
| Testability | 6/10 | Some unit tests exist, no integration tests |
| DevOps Readiness | 4/10 | No graceful degradation, blocking startup |

## Critical Path to Production Maturity:
1. **Immediate**: Replace in-memory sessions with distributed cache (Redis)
2. **Immediate**: Add circuit breakers for Gemini API
3. **Short-term**: Extract orchestration layer, consolidate routing logic
4. **Short-term**: Add dependency health checks
5. **Medium-term**: Implement request caching and batching
6. **Medium-term**: Add configuration management for thresholds
7. **Long-term**: Consider model serving infrastructure for embeddings

---

# Simulation Analysis by DAU

## 100 DAU
| Component | Status | Risk Level |
|-----------|--------|------------|
| Sessions (in-memory) | ~1MB | LOW |
| Embedding model | Single instance | MEDIUM |
| Database connections | Limited | LOW |
| LLM calls | ~50-100/day | LOW |
| **Primary Risk** | Model startup time | MEDIUM |

## 1,000 DAU
| Component | Status | Risk Level |
|-----------|--------|------------|
| Sessions (in-memory) | ~10MB | MEDIUM |
| Embedding model | Bottleneck | HIGH |
| Database connections | May exhaust | HIGH |
| LLM calls | ~500-1000/day | MEDIUM |
| **Primary Risk** | Horizontal scaling impossible | CRITICAL |

## 10,000 DAU
| Component | Status | Risk Level |
|-----------|--------|------------|
| Sessions (in-memory) | ~100MB+ | CRITICAL |
| Embedding model | Severely constrained | CRITICAL |
| Database connections | Exhausted | CRITICAL |
| LLM calls | ~5000-10000/day | CRITICAL |
| **Primary Risk** | Complete system failure under load | CRITICAL |

