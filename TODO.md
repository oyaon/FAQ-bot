# TODO: Fix ESLint Errors and Deploy

## Step 1: Fix tsconfig.json to include test files
- [x] Update tsconfig.json include to add test/**/*.ts

## Step 2: Fix src/admin/admin.controller.ts
- [ ] Line 88: Add explicit return type
- [ ] Line 251: Type the variable properly
- [ ] Line 252: Cast or type the arguments to string
- [ ] Line 296: Type the error properly with unknown and type guard

## Step 3: Fix src/chat/chat.service.ts
- [ ] Line 65: Add explicit return type annotation
- [ ] Line 89: Type the destructured object

## Step 4: Fix src/common/interceptors/correlation-id.interceptor.ts
- [ ] Type request and response objects with Express types

## Step 5: Fix src/conversation/conversation.service.ts
- [ ] Line 94: Type the Supabase response
- [ ] Lines 106-108: Type the destructured data and error

## Step 6: Verify and Build
- [ ] Run npm run lint
- [ ] Run npm run build
- [ ] Git commands to commit and push

