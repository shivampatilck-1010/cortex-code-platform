# Cortex Classroom Functionality Report

## Scope

This change set addresses security and data-authority defects found while reviewing
the classroom recovery specification. Existing classroom layouts and controls were
left unchanged.

## Changes

| Feature | Root cause | Fix | Status |
|---|---|---|---|
| Classroom authorization | Any platform user with the `teacher` role could access any classroom | Teacher access is now limited to the classroom owner or an active classroom membership; admins remain platform-authorized | Fixed |
| Browser identity | Unknown `x-user-id` values were auto-registered using browser-supplied name, email, and role | Requests must resolve to an existing authoritative user; unknown identities are rejected | Fixed |
| Production authentication | Production accepted unsigned browser identity headers and used fallback HMAC secrets | Production requires signed bearer/cookie or internal authentication, and development-only fallback secrets are disabled in production | Fixed |
| Classroom creation | Students could create classrooms and callers could provide predictable join codes | Creation requires teacher/admin authorization and join codes are generated server-side with UUID randomness | Fixed |
| Attendance feature | Legacy attendance tables and attendance-mode configuration were still present | Attendance tables are no longer created and are removed during database initialization; classroom copy refers to realtime availability | Fixed |
| Nested classroom pages | Protected APIs were called without the active classroom identity headers | Added a shared client identity-header helper and wired grades, submissions, assignment solve/builder, review, and live-session requests | Fixed |
| Live realtime transport | Browser connected to the Next API response instead of the development Node WebSocket port | Development realtime now targets the Node WebSocket server, which is started by the authenticated session endpoint | Fixed |
| Archived writes | Archived classrooms could still accept assignments, submissions, messages, and live-session writes | Added server-side read-only checks | Fixed |
| Grade adjustments | Manual adjustments were persisted but omitted from the calculated final score | Applied adjustments when no explicit final score is supplied | Fixed |
| Hidden/private data | Student response sanitization mutated database-returned objects | Sanitize deep copies instead of authoritative objects | Fixed |
| Live language execution | Live code execution always submitted C++ source | Live execution now derives source extension and language from session metadata | Fixed |
| Classroom lifecycle | Restore and permanent deletion were not exposed as server operations | Added restore action and exact-name-confirmed permanent deletion with realtime events | Fixed |

## Database and realtime

The existing relational classroom database and Durable Object/WebSocket realtime
architecture were preserved. No new polling, mock events, or UI replacement was
introduced.

## Frontend change log

| File | Why it changed | Functional connection | Visual change |
|---|---|---|---|
| `src/app/classroom/page.tsx` | Removed attendance wording from the existing member-management description | Aligns the existing copy with realtime presence semantics | No |

## Validation

- `npm run lint` — passed after the final changes.
- `npm run build` — passed.
- Existing standalone security scripts could not run directly under Node ESM because
  they import extensionless TypeScript/Next modules; this is a test-runner
  compatibility limitation, not a reported application assertion.

## Limitations

This change set does not claim that every item in the recovery specification has
been independently verified in production. The repository still contains legacy
development seed/fallback data and requires a real platform authentication
provider for production browser sessions.

## Final verdict

**CORTEX CLASSROOM — FUNCTIONAL WITH LIMITATIONS**
