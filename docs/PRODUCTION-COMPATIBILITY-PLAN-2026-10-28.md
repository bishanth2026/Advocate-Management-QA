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

## Read-only Supabase schema comparison — 2026-10-28

Read-only schema inventory was retrieved for Production project `ykxfidrtvmkmmbxameji` and QA project `uqtsksgypncsbcnuanbk`. No SQL or settings were changed by this comparison.

- Production has the legacy tables `profiles`, `workspaces`, `workspace_members`, `practice_records`, and `case_documents`; QA additionally has `practice_resources`, `role_permissions`, `case_assignments`, and `workspace_audit_log`. This confirms QA schema cannot be assumed to exist in Production.
- Production `workspace_members.role` currently allows only `admin`, `advocate`, and `staff`. QA additionally allows `junior_advocate`, `clerk`, and `accountant`. Do not release UI/permission code that assumes those extra roles can be stored in Production until a reviewed additive migration and mapping are rehearsed.
- Production `workspaces.status` allows `active` and `suspended`; QA also permits `inactive`. Any migration or application logic must normalize this difference explicitly and safely.
- Production `case_documents` has different validation constraints from QA: Production does not show the same required document-name/original-file-name checks, MIME allowlist, or unique storage-path constraint in the inspected column metadata. Confirm the actual indexes, triggers, policies and storage policies before relying on either environment's behavior.
- Both projects reported RLS enabled for the inspected public tables. This does not by itself prove policies/grants are correct; policy definitions and role-based runtime denials still need separate verification.
- The table-list tool reported row counts of zero for several tables in both projects despite QA tables visibly listing some non-zero counts. Treat those counts as incomplete metadata, **not** evidence that Production has no user data. Use a verified export/count query in the approved read-only inventory process before migration planning.

- A direct read-only aggregate query confirmed Production currently has 7 workspaces, 7 workspace-membership rows, 5 legacy practice-record rows, and 1 case-document metadata row; QA has 3 workspaces, 7 memberships, 3 legacy records, and 3 document metadata rows. These are metadata counts only and do not replace a verified backup or content-level parity audit.
- RLS policy definitions differ materially. Production's legacy `practice_records` policies allow active workspace members to read/update workspace records, whereas QA adds a restrictive policy that limits `other/workspace_state` access to users with `users.manage`. Copying QA policy behavior to Production without a deliberate app/data migration could lock out existing Advocate/Staff users. Conversely, keeping broad legacy access during cutover must be a documented temporary compatibility decision with role-specific tests.
- QA's `case_documents` policies use permission checks and `can_access_case`; Production's inspected policies are workspace-membership scoped. Neither policy set should be transplanted blindly. Test cross-workspace and unassigned-case access, and decide the required document authorization model before production migration.
These findings make schema compatibility and role mapping concrete release blockers. No migration should be applied to Production based on this inventory alone.

## Additional read-only verification — role distribution, uniqueness and RLS flags

A further read-only SQL pass was completed on 2026-10-28.

- Production currently reports 7 `workspace_members` rows, all with role `admin`, and 7 active workspaces. QA reports 7 memberships: 3 admin, 3 advocate, and 1 accountant; its 3 workspaces are active. Therefore the existing Production data does not currently demonstrate a real Advocate or Accountant membership path. Live member-login acceptance cannot be inferred from the existing Production dataset.
- Production and QA both have RLS enabled on the inspected public tables, but `FORCE ROW LEVEL SECURITY` is false for those tables. Table-level RLS being enabled is not sufficient proof: policies, grants, function ownership/bypass behavior, and actual authenticated sessions still need tests.
- Both projects have a unique key for `practice_records(workspace_id, record_type, record_key)`, but the index names differ. QA also has a unique `case_documents(storage_path)` index and an explicit `workspace_members(workspace_id)` index that were not present in the inspected Production index list. Migration must check for duplicate storage paths and existing data before creating any new unique index.
- The read-only inventory found 5 Production legacy workspace-state records versus 3 in QA. Never use QA's record count as a Production target or overwrite Production payloads with QA data.

Acceptance consequence: seed synthetic member identities only in an isolated Production-like test project, verify invitation/activation, login, refresh, save/reload, role-specific navigation and negative authorization cases, and retain redacted evidence. Do not create or modify live Production users merely to run these tests.

## Current release decision
**NO-GO until all gates above are evidenced.** This plan is deliberately documentation-only because the exact Production schema/data model and a disposable Production-like database have not yet been verified. Do not apply QA migrations or merge the QA branch wholesale into Production.


## Additional Production-source findings — 2026-10-28
- `auth.js` currently validates every non-`super_admin` stored session through the `admin` portal path. That path filters workspace memberships to `role === 'admin'`; consequently a non-Admin Advocate/Accountant session may be rejected on refresh/re-login even if sign-in initially allowed it. This must be reproduced with synthetic QA accounts and corrected in a selective-port change before release. Session role must come from trusted database membership, not a client-controlled localStorage value.
- The main app marks cloud sync as “Synced” in static HTML before bootstrap and again before any save completes. The bootstrap later does set the status, but the initial label is misleading while the request is still pending. The production-compatible port should show a neutral loading state until the first authenticated read succeeds, and only show “Synced” after a confirmed successful read/write.
- The existing legacy write path uses optimistic concurrency via `id` + `updated_at` and returns a conflict when another session changed the row. Preserve and test this behavior during the compatibility transition; do not silently replace it with last-write-wins.
- The public anon key embedded in `auth.js` is a Supabase publishable client key, not an admin secret; still, access safety depends on correct RLS, grants, and server-side authorization. Never place a service-role key in browser code.


## Follow-up implementation prepared — 2026-10-28
- Draft Production-targeted PR #35: https://github.com/bishanth2026/Advocate-Management-QA/pull/35
- Changes are isolated from Production: a member login route was added, session revalidation now distinguishes Admin from non-admin membership flow, and auth.js cache-busting references were updated so clients receive the corrected session logic.
- Production safety CI passed on the latest PR head `8e098bb20ca5503d920aabb79e41f87ea1a26f6d`: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40631648484
- The initial smoke-test assertion failed because its matcher expected double quotes while the HTML uses single quotes; the assertion was corrected, then the updated check passed. The initial failed run is retained for traceability.
- These are syntax and repository safety smoke checks, not live end-to-end login tests. Real Production-like account tests still need to verify Admin, Advocate, Accountant, unassigned and inactive membership behavior, refresh/re-login, and session expiry before approval.
