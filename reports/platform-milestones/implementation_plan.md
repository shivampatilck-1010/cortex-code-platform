# Cortex Phase 1A.1 Implementation Plan

## Goal
Complete Phase 1A.1: Fix the failed authentication phase. Implement a true, secure identity system backed by Cortex ID, Email, and hashed passwords using real Database records and HttpOnly cookies, and completely remove all spoofable header/query-parameter trust logic.

## User Review Required
This is a critical security and identity rewrite. No UI will be redesigned, but dedicated Auth pages (Login, Register, etc.) will be created using the existing design language. Please review the database and API changes to ensure they match the requirements.

## Open Questions
- Is there an existing email delivery service (like Resend, Sendgrid) configured, or should password reset tokens just be logged to the console for development testing as permitted by the spec ("For development testing only, use the existing safe development reset-token mechanism if appropriate")?

## Proposed Changes

### Database Layer (`src/lib/classroom/db/index.ts`)
*   **[MODIFY]** `createTables()`: Inject SQL to add `cortex_id` (UNIQUE) and `password_hash` to the existing `users` table via defensive ALTER statements.
*   **[MODIFY]** `createTables()`: Create `sessions` table (`id`, `user_id`, `expires_at`).
*   **[MODIFY]** `createTables()`: Create `password_reset_tokens` table (`token`, `user_id`, `expires_at`, `used`).
*   **[MODIFY]** Add repository methods: `getUserByEmail`, `getUserByCortexId`, `createSession`, `getSession`, `deleteSession`, `createResetToken`, `verifyResetToken`, `updateUserPassword`.

### Authentication Logic (`src/lib/classroom/auth.ts`)
*   **[MODIFY]** `authenticateRequest`: **COMPLETELY REWRITE**. Remove all trust in `x-user-id`, `x-user-role`, `query.userId`, and `localStorage`. It must ONLY validate the `cortex_session` cookie against the `sessions` database table. Remove auto-registration.
*   **[NEW]** Add utility methods for bcrypt/scrypt password hashing and validation (using native WebCrypto API since this runs on Cloudflare Workers).

### Auth API Endpoints
*   **[NEW]** `src/app/api/v1/auth/register/route.ts`: Validate Name, Email (Regex), Cortex ID (Regex), and Password (Policy). Hash password and create User.
*   **[NEW]** `src/app/api/v1/auth/login/route.ts`: Authenticate via Email OR Cortex ID + Password. Create DB session and set `HttpOnly` cookie.
*   **[NEW]** `src/app/api/v1/auth/logout/route.ts`: Delete DB session and clear cookie.
*   **[NEW]** `src/app/api/v1/auth/me/route.ts`: Return current authenticated user.
*   **[NEW]** `src/app/api/v1/auth/forgot-password/route.ts` & `reset-password/route.ts`.

### Frontend Routes & UI
*   **[NEW]** `src/app/login/page.tsx`: Login form matching existing Cortex styling.
*   **[NEW]** `src/app/register/page.tsx`: Registration form.
*   **[NEW]** `src/app/forgot-password/page.tsx` & `src/app/reset-password/page.tsx`.
*   **[MODIFY]** `src/app/classroom/page.tsx`: Remove the fake "Profile Modal" that trusts `localStorage`. Wire the app to fetch identity from `/api/v1/auth/me`. If unauthenticated, `router.push('/login')`.

### Automated Testing (`scripts/test-auth.ts`)
*   **[NEW]** A comprehensive test suite using Node `fetch` against the local dev server (`http://localhost:3000`). It will run through all 40 test cases specified in the prompt (Registration, Login, Session Persistence, Identity Spoofing, Role Security, etc.).

## Verification Plan

### Automated Tests
*   `npm run build:vinext` to ensure compilation.
*   Execute `npx tsx scripts/test-auth.ts` against the live local database to mathematically prove that identity spoofing fails and secure sessions work.

### Manual Verification (Two-Browser Test)
*   **Browser A**: Register and login as Professor.
*   **Browser B**: Register and login as Student.
*   Verify cross-contamination is impossible and sessions isolate perfectly.
