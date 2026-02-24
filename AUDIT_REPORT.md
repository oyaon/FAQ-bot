# Production Readiness Audit Report

PROJECT: NestJS FAQ Chatbot
TECH STACK: NestJS 11.x, Supabase, Transformers.js, Google Gemini API

## CRITICAL ISSUES (Fix immediately - production blockers)

**Issue**: Build Failing on Render (rimraf not found)
**File**: `package.json:58`
**Problem**: The Render build environment removes `devDependencies` after installation or ignores them in production builds, but the `build` process (specifically Nest CLI) depends on `rimraf` to clean the dist folder before compilation. Because `rimraf` is in `devDependencies`, the build fails to find the command.
**Fix**: Move `rimraf` from `devDependencies` to `dependencies`. Alternately, disable `deleteOutDir` in `nest-cli.json` or use `node_modules/.bin/rimraf` directly. Moving to dependencies is easiest.
```json
  "dependencies": {
    ...
    "rimraf": "^5.0.10",
    ...
```
**Time**: 5 mins

**Issue**: Metrics Endpoint 500 Internal Server Error
**File**: `src/admin/admin.module.ts:5`, `src/metrics/metrics.module.ts`
**Problem**: The `ApiKeyGuard` uses `ConfigService` to retrieve `ADMIN_API_KEY`. However, `MetricsModule` and `AdminModule` do not explicitly import `ConfigModule` and it's not exported globally by `AppModule`. At runtime, the guards try to read properties of `undefined` for `configService`, crashing the health and metrics endpoints with 500s.
**Fix**: Add `@Global()` to the Config wrapper, or import `ConfigModule` into the affected modules. Or inject a fallback directly in the guard.
```typescript
// src/admin/api-key.guard.ts
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    
    // Quick Fix applied
    const configService = this.configService || new ConfigService();
    const validKey = configService.get<string>('ADMIN_API_KEY') || process.env.ADMIN_API_KEY;
```
**Time**: 15 mins

## HIGH PRIORITY (Fix before next deploy)

**Issue**: Database N+1 and Unbounded Queries
**File**: `src/metrics/metrics.controller.ts:43-47`
**Problem**: The metrics controller frequently performs `select('*')` without strict limits across multiple routes or loads `limit(1000)` into memory just to map them into aggregate statistics using JavaScript `.reduce()`. This will OOM the Render free tier quickly on a high traffic load.
**Fix**: Use Supabase Postgres RPC metrics aggregation (Views/Functions) instead of fetching arrays to Node.
**Time**: 2 hours

**Issue**: Hanging Database Connections in the Test Suite
**File**: `src/supabase/supabase.service.ts`
**Problem**: Tests are leaking Supabase client connections and Jest fails to exit cleanly because the app context handles initialization but never closes hanging async events natively for Postgres. 
**Fix**: Implement `OnModuleDestroy` on the Supabase service to release handles.
```typescript
  async onModuleDestroy() {
    // Optionally clean up or remove listeners 
  }
```
**Time**: 30 mins

**Issue**: Supabase Config Throwing Server Errors on App Start
**File**: `src/supabase/supabase.service.ts:14`
**Problem**: Missing Env variables completely crash app initialization instead of failing gracefully if the DB goes down. 
**Fix**: Better environment variable validation using `@nestjs/config` and `Joi` rather than hard throws in constructor.
**Time**: 20 mins

## MEDIUM PRIORITY (Fix this week)

**Issue**: Any Types
**File**: `src/embedding/embedding.service.ts:7`, `src/llm/llm.service.ts:106`
**Problem**: Use of `any` types for Transformers.js extractor and LLM responses bypassing TypeScript safety standards.
**Fix**: Define an explicit TS Interface for the Xenova Pipeline result and Google Gemini response JSON object.
**Time**: 45 mins

**Issue**: Lacking Automated Graceful Shutdown
**File**: `src/main.ts`
**Problem**: No `app.enableShutdownHooks()` enabled. If Render stops the instance, ongoing queries or LLM streams are killed immediately rather than finishing.
**Fix**:
```typescript
  app.enableShutdownHooks();
```
**Time**: 5 mins

## LOW PRIORITY (Technical debt)

**Issue**: Duplicate Validation Guard Check
**File**: `src/global.exception.filter.ts`
**Problem**: The global exception filter leaks full error stacks on unhandled async promises, but obfuscates too heavily on specific user errors.
**Fix**: Structure the exception filter to pipe `ValidationPipe` errors correctly to 400.
**Time**: 1 hr

---

### SCORES SUMMARY
- Overall Health: 6/10
- Security: 8/10
- Code Quality: 7/10
- Performance: 4/10
- Testing: 3/10
- Operations: 5/10
- Production Ready: NO (Pending Build and 500 fixes)

### TOP 5 RECOMMENDATIONS
1. **Fix package.json dependencies**: The Render `rimraf` error is solved simply by moving `rimraf` to standard `dependencies`. It blocks all deployment right now.
2. **Fix DI for API Keys**: Ensure `ConfigService` is either provided globally or accessed safely in all modules using API Guards to get metrics working. 
3. **Shift aggregations to PostgreSQL**: Do not load thousands of `query_logs` rows into NestJS memory just to count them or average scores. Use Supabase SQL views or RPCs to let the DB do the math. Your free tier RAM is highly limited.
4. **Fix Test Suite Connection Leaks**: Jest is timing out and failing to exit because `Transformers.js` and `Supabase` clients hang open. Clean these up.
5. **Add Environment Validation Schema**: Crash fast with clear error messages using Joi or class-validator *before* the app boots if keys are missing.

### IMMEDIATE ACTIONS (Next 30 minutes)
1. `npm install rimraf --save`
2. Update `api-key.guard.ts` to access `process.env.ADMIN_API_KEY` directly if `configService` is unbound, or make `ConfigModule` `@Global()`.
3. Add `app.enableShutdownHooks();` to `main.ts`

### FILES TO DELETE
- `test-local-500.ts` - Temporary reproduction file no longer needed.

### FILES TO CREATE
- `supabase/migrations/metrics_view.sql` - Purpose: Offload memory-heavy JS aggregation to DB views.

### DEPENDENCY CHANGES
**Add**: `rimraf` (regular dependency)
**Update**: `@nestjs/config` (ensure globally provided)
