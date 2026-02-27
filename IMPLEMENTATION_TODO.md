# Implementation TODO - Items 14-20 + Build Errors

## Phase 1: Fix Build Errors (Prerequisite)
- [x] 1. Fix type mismatch in chat.service.ts (FaqResult.id string -> number)
- [x] 2. Fix type mismatch in faq.controller.ts
- [x] 3. Fix embedding service pipeline issue

## Phase 2: Implement Items 14-20
- [ ] 4. Item 14: Add hard cap to conversation history in chat.service.ts
- [ ] 5. Item 15: Move setInterval inside bootstrap() in main.ts
- [ ] 6. Item 16: Standardize @MaxLength on DTOs (1000)
- [ ] 7. Item 17: Add embedding model readiness to /health
- [ ] 8. Item 18: Add Supabase connection check to /health
- [ ] 9. Item 19: Make critical env vars required in Joi schema
- [ ] 10. Item 20: Add @IsUUID() to sessionId in search.dto.ts

## Verification
- [ ] Run npm run build to verify all fixes
- [ ] Test curl commands as specified in task

