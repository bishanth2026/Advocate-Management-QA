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


## Operational Backup, Restore, Rollback & Final Release Runbook — 2026-10-28

This section separates work completed through the connected tools from checks that require the Supabase Dashboard or a controlled operator. **No Production write, restore, migration, merge, or deployment was performed while preparing this runbook.**

### A. Release identity and immutable references

- Production application branch: `production/advocatedesk-final`
- Production baseline commit at review time: `7b8548a9ba2037c5777cd60aae30dd8acd13789d`
- Production Supabase project: `ykxfidrtvmkmmbxameji`
- QA Supabase project (test only): `uqtsksgypncsbcnuanbk`
- Application change under review: PR #35, `fix/production-member-login-session-2026-10-28`; latest reviewed head recorded in the change log as `b34648c22973242aa0ae343c98ba5424e7ca2c47`.
- Compatibility/runbook change: this document in PR #34, branch `release-prep/production-compatibility-2026-10-28`.
- Production migration history observed read-only: `20261002003752`, `20261002003819`, `20261002003848`, `20261002004143`, `20261002031851`, `20261008003328`, `20261008063535`.
- The baseline commit is a reference for source rollback; it does **not** prove which build is currently deployed to hosting. Before release, verify the hosting deployment's commit and project configuration match these values.

### B. Backup and restore — evidence status

**Status: NOT VERIFIED; release gate remains open.** The connected Supabase tools expose migration history and a project-restore action, but do not expose a backup-list/export or restore-rehearsal workflow. Migration history is not a database backup. The restore action was deliberately not called because it can change Production state and no specific verified snapshot/target was supplied.

Before approval, an authorized operator must:
1. In Supabase Dashboard for the Production project, inspect the plan's available backup/PITR options and record the exact snapshot/restore point, timestamp and retention. Do not assume a Free-plan backup capability that the dashboard does not show.
2. If a usable backup/export is available, create or select a pre-release recovery point and securely retain its metadata outside the application repository. Never commit client/case payloads, credentials, dumps, or secret keys to GitHub.
3. Restore that backup into an isolated disposable project/environment—not into Production—and record the restore completion time and result.
4. Verify schema/migration version, workspace and membership counts, legacy `practice_records`/workspace-state availability, `case_documents` metadata and storage-object references, and representative redacted data integrity.
5. Run sign-in, read, create/update, refresh/re-login and authorization-denial checks against the restored isolated environment.
6. Record operator, snapshot identifier/time, target project, checks performed, pass/fail evidence and any data-loss window. If no restorable backup is available on the current plan, stop release and agree an approved export/recovery path before deployment.

### C. Rollback decision tree

**Application-only rollback (no database migration applied):**
1. Stop further deployment and record the incident time and last known-good deployment.
2. Redeploy the verified last-known-good Production build corresponding to baseline `7b8548a9ba2037c5777cd60aae30dd8acd13789d` only after confirming that this commit is the correct build for the hosting target.
3. Keep the Production database, Auth, RLS and Storage unchanged; do not attempt a database restore for a frontend-only regression.
4. Run the post-rollback smoke suite: all portal login paths, workspace selection, case create/read/update, invoice save/reload, refresh/re-login, document access, and cross-workspace denial.
5. Verify existing records remain present and cloud status reflects confirmed reads/writes. Capture the deployment URL, commit SHA, time, test result and incident decision.

**Database/schema rollback (only if a future approved migration has been applied):**
1. Pause rollout and writes if necessary under the incident owner's direction; preserve logs and the pre-change snapshot.
2. Do not blindly reverse/drop additive tables or transform/delete legacy payloads. Prefer a reviewed forward-fix or an explicitly rehearsed reverse migration.
3. Restore a snapshot only under the approved recovery procedure after assessing the data-loss window and obtaining explicit operator authorization.
4. Verify restored data and authorization in isolation first where feasible; then follow the approved recovery procedure and rerun the complete smoke suite.
5. Record the decision, approver, recovery point, actual data-loss window and reconciliation actions.

### D. Final release checks and evidence ledger

| Gate | Evidence/status as of 2026-10-28 | Decision |
|---|---|---|
| Cross-workspace unauthorized-access test | User confirms this was tested earlier; preserve the existing test record/evidence | User-confirmed PASS; no repeat requested |
| Advocate/Staff login | User-reported QA pass | PASS in user-reported QA |
| Accountant invoice edit/save + refresh | User-reported QA pass | PASS in user-reported QA |
| Admin case create/save + refresh/re-login | User-reported QA pass | PASS in user-reported QA |
| Production Safety workflow | GitHub Actions run 40634357956 returned completed/success for the reviewed PR commit | PASS for repository smoke checks only; not browser E2E |
| Production schema compatibility | QA/Production schemas and role constraints differ; no Production migration approved | BLOCKED for any schema cutover |
| Backup existence and restore rehearsal | No verifiable backup or isolated restore evidence available through current connected tools | BLOCKED |
| Rollback rehearsal | Written application/database rollback decision tree added here; actual restore/rollback rehearsal not run | BLOCKED |
| Leaked Password Protection | Previously discussed and deferred; current Production Security Advisor still warns it is disabled | OPEN; do not repeatedly treat it as new work |
| Hosting target/current deployed SHA | Not independently verified by the available connected tools | OPEN |
| Post-deployment Production smoke test | Not run; no deployment performed | OPEN |
| Explicit human release approval | Not recorded | OPEN |

### E. Release execution order (do not skip gates)

1. Finish the backup and isolated restore proof above.
2. Verify hosting target and deployed commit; confirm a deployable release artifact and environment/project IDs.
3. Review PR #35 changes and latest CI; keep QA-only schema/policies out of Production.
4. Resolve documented Auth/security gates under the current Supabase plan, or formally record an authorized risk acceptance if policy permits; do not mislabel a disabled setting as enabled.
5. Approve and deploy only the reviewed application change using the hosting platform's supported deployment process.
6. Immediately run the controlled Production smoke suite and confirm the pre-existing Production records still load and persist.
7. If any critical check fails, execute the appropriate rollback path above and stop the release.
8. Record the final decision, deployed SHA, backup/recovery-point reference, smoke-test evidence and approver.

**Current release decision: NO-GO.** Documentation and evidence tracking are improved, but the actual backup/restore rehearsal, hosting verification, post-deploy Production smoke test, and approval cannot be honestly marked complete from the current connected tools. No Production changes have been made.
