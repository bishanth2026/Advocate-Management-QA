# Production Compatibility Plan — AdvocateDesk (2026-10-28)

## Status
**Preparation only — NOT production-ready, NOT a deployment authorization.** This document is on `release-prep/production-compatibility-2026-10-28`, branched from `production/advocatedesk-final`. No Production database, Auth setting, RLS policy, storage object, or hosting target was changed.

## Why a selective port is required
The current Production `app.html` bootstraps workspace state from `public.practice_records` using `record_type='other'` and `record_key='workspace_state'`. QA's newer resource-sync flow expects `practice_resources`, `role_permissions`, and `case_assignments`, which are absent from the audited Production schema. A frontend-only port risks losing access to existing records and breaking saves. A whole-branch merge is not safe.

## Required implementation sequence

### Gate 0 — freeze scope and inventory (read-only)
1. Pin the Production app commit and the Production Supabase project ID in the change record; verify both against the deployment configuration.
2. Export schema-only inventory for all existing tables, columns, constraints, indexes, triggers, RLS policies, grants, functions, views, and migration history.
3. Record row counts and payload shape for `practice_records` and `case_documents` without exporting client/case content to logs. Use synthetic or redacted samples only.
4. Confirm current login/session and workspace-membership contracts in `auth.js` and every existing edge function the app invokes.
5. Capture a verified database backup and document who can restore it. Do not proceed without a restore test in an isolated environment.

### Gate 1 — define a reversible data model (no Production writes)
1. Review the QA schema and app contract, then map each legacy `workspace_state.payload` collection to a resource type. Do not assume a field mapping until actual payload shape and all writers/readers are inspected.
2. Define stable resource IDs and idempotent migration keys so retries cannot duplicate cases, clients, hearings, tasks, invoices, or payments.
3. Define workspace scoping and role permissions for Admin, Advocate, Accountant, and any other supported roles. Default to deny. Assigned-only users must not gain access to unassigned cases or unlinked records without the required workspace permission.
4. Preserve the legacy state as the rollback source. A migration must not delete or overwrite `practice_records` payloads during initial backfill.
5. Document conflict handling for concurrent writes, timestamp/version semantics, audit records, and atomic batch behavior.

### Gate 2 — implement a Production-specific additive migration (disposable clone only)
1. Create a new migration with a unique timestamp and Production-specific review; do not copy the QA-only advocate-directory migration blindly.
2. Prefer additive tables, constraints, and indexes first. Enable RLS and grants in the same controlled rollout; every policy must be tested as authenticated roles, including cross-workspace and unassigned-case denial.
3. Implement a dry-run/backfill report that shows counts by workspace and resource type, duplicates, invalid relationships, orphaned records, and conflicts. It must not expose personal case data.
4. Backfill in an idempotent transaction/batched process with checkpoints. Verify source-to-target counts and representative redacted field comparisons.
5. Keep dual-read/dual-write or compatibility behavior explicit. Do not switch the UI to the new store until migration parity and failure handling are demonstrated.
6. Test failure injection and atomic rollback: interrupted backfill, duplicate IDs, invalid workspace, unauthorized write, stale update, and partial batch failure.

### Gate 3 — compatibility application change (isolated branch)
1. Port only the necessary UI/auth/data-access changes from QA onto this Production-based branch. Keep the existing `practice_records` reader/writer available until the new store passes parity tests.
2. Remove any misleading default “Cloud: Synced” state during bootstrap; show loading/error/saved states based on completed operations.
3. Test sign-in, session expiry, refresh, re-login, offline/error behavior, and save failures. Do not log tokens, passwords, or case contents.
4. Run browser tests for all roles and modules, including Case–Hearing–Calendar–Dashboard consistency, finance, document access, assignment lifecycle, and negative authorization paths.

### Gate 4 — security and release rehearsal
1. Enable and verify Supabase Leaked Password Protection in QA and the production-like clone before requesting release approval.
2. Run database/security advisors and inspect all public RPCs, SECURITY DEFINER functions, search paths, grants, and RLS policies. Any privileged helper must enforce workspace and role checks and be inaccessible directly from exposed schemas unless intentionally designed.
3. Test the full migration and rollback on a disposable clone using the intended Production backup snapshot.
4. Confirm hosting build output, asset paths, cache busting, environment/project IDs, edge function versions, and a post-deploy smoke-test/rollback checklist.
5. Require successful CI, browser regression, security tests, data parity checks, restore rehearsal, and human review before release approval.

## Rollback requirements
- Preserve an immutable pre-change backup and confirm restore steps and responsible operator.
- Keep the legacy `practice_records` data intact through the observation window.
- Define the exact application rollback commit and reverse/forward-fix strategy for additive schema changes.
- Never drop new tables or reverse data transformations automatically during an application rollback.
- If parity, authorization, or write health fails, stop rollout, return the application to the verified legacy build, and follow the rehearsed database recovery plan.

## Acceptance checklist
- [ ] Production source and Supabase project identity verified and pinned.
- [ ] Schema, RLS, grants, functions, and data-shape inventory reviewed.
- [ ] Backup restore demonstrated in isolated environment.
- [ ] Migration dry-run has no unexplained duplicates/orphans/conflicts.
- [ ] Idempotent backfill and source/target parity tests pass.
- [ ] Cross-workspace, non-member, unassigned-case, and role-negative tests pass.
- [ ] Atomic write failure and rollback tests pass.
- [ ] Leaked Password Protection enabled and verified.
- [ ] Full browser regression passes against production-like environment.
- [ ] Rollback rehearsal passes.
- [ ] Human release approval explicitly recorded.

## Current release decision
**NO-GO until all gates above are evidenced.** This plan is deliberately documentation-only because the exact Production schema/data model and a disposable Production-like database have not yet been verified. Do not apply QA migrations or merge the QA branch wholesale into Production.
