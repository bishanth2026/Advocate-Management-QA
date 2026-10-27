# AdvocateDesk Production Readiness Gate — 27 October 2026

## Decision: NO-GO

Production release is not approved. Continue QA-only work; do not deploy or modify production systems until every blocker below is closed with observed evidence.

## Latest source review

Reviewed `app.html` on `staging/advocatedesk-test` (blob `10babad89681375ff3ef729c9c0dd3df2cc984f7`):

- Loads `resource-sync.js`.
- Calls `ADResourceSync.create(client, auth, ...)`.
- Does not load `resource-store.js`.
- Source contains a comment that this path should not load/save the shared `workspace_state` snapshot.

This corrects any stale wording that says the currently inspected `app.html` is necessarily using the legacy aggregate as its active sync path. However, `workspace_state` is still present in the codebase/database and must not be removed or restricted until runtime and compatibility tests prove that no active paths depend on it.

## Latest read-only QA database audit

QA Supabase project: `uqtsksgypncsbcnuanbk`. Queries were read-only.

### `practice_resources`

- Total: 40 rows.
- By resource type: 10 cases, 8 clients, 8 hearings, 4 tasks, 5 invoices, 5 payments.
- Payload not a JSON object: 0.
- Payload `id` differs from `resource_id`: 0.
- Empty `resource_id`: 0.
- Unsupported resource types: 0.
- Non-case rows whose non-null `case_id` points to no case in the same workspace: 0.

### `practice_records`

- Contains three `record_type='other'` snapshot rows, one per QA workspace.
- Snapshot payloads have keys for cases, clients, courts, discussions, hearings, invoices, meetings, payments and tasks.
- Snapshot array counts currently observed:
  - Workspace A: 1 case, 1 client, 1 hearing, 1 task, 1 invoice, 1 payment; 0 transactions, meetings, discussions, courts, case parties.
  - Workspace B: 1 case, 1 client, 1 hearing; 0 tasks, invoices, payments, transactions, meetings, discussions, courts, case parties.
  - Disposable QA workspace: 1 case, 1 client; 0 hearings, tasks, invoices, payments, transactions, meetings, discussions, courts, case parties.

These are structural/count observations only. They do not establish full field-level parity, correct relationship mapping, delete semantics, or that these synthetic snapshots represent the complete intended module data. No data was modified.

## Previously recorded automation

The branch report previously recorded these runs as passing:
- QA validation: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40090283569
- Browser role/module regression: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40090283610
- QA Pages deployment: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40090283684

These are historical results; they have not been rerun as part of this read-only audit.


## New QA-only security work — 27 October 2026

### Creator-visible resource policy hardening

A fresh policy audit found that the practice_resources SELECT policy allowed a matching payload.createdBy value as an alternative to permission checks without independently requiring current active workspace membership. That could preserve creator-based visibility after membership is removed if a row remains accessible under that policy.

- Applied QA Supabase migration: require_active_workspace_membership_for_creator_visible_resources_qa.
- Added the corresponding repository migration: supabase/migrations/20261027140000_require_active_workspace_membership_for_creator_visible_resources_qa.sql.
- The policy now requires private.is_workspace_member(workspace_id) before evaluating the existing per-resource visibility branches.
- This was applied only to QA project uqtsksgypncsbcnuanbk; no production changes were made.
- NOT YET RUNTIME-VERIFIED: role/session-based tests must still prove active members retain intended access and removed/non-members are denied. Do not treat the policy change alone as complete security acceptance.

### Current Supabase Security Advisor

Latest QA Security Advisor returned two warnings:
- qa_list_workspace_advocates(uuid) is SECURITY DEFINER and executable by authenticated. Its body checks for an admin membership in the supplied workspace, but it remains an exposed security-definer function that needs an explicit usage/grant and inactive-workspace review.
- Leaked-password protection remains disabled, deferred per user instruction, and must be revisited before production approval.

These warnings are not marked resolved. Review the function's actual app usage before revoking access or changing its security mode; avoid breaking the QA app while hardening it.


## Follow-up QA-only security hardening — 27 October 2026

The QA admin-only case-assignment UI calls qa_list_workspace_advocates(uuid), so simply revoking authenticated EXECUTE would break that workflow. Instead, the function was hardened to require the requesting user to be an admin member of the requested workspace AND for that workspace to be active. PUBLIC and anon EXECUTE privileges are revoked; authenticated and service_role retain EXECUTE for the intended admin workflow.

- Applied QA Supabase migration: harden_qa_advocate_listing_active_admin_workspace_20261027.
- Added matching repository migration: supabase/migrations/20261027143000_harden_qa_advocate_listing_active_admin_workspace.sql.
- Security Advisor still reports the SECURITY DEFINER RPC because authenticated callers must invoke it for the admin assignment workflow. Treat this as an intentional, narrowly guarded exception pending runtime tests, not as a cleared warning.
- Leaked-password protection remains disabled/deferred.
- Runtime negative tests (non-admin, non-member, inactive workspace) and positive admin test are still required before this can be marked accepted.


## Role permission inventory reviewed — 27 October 2026

Read-only QA inventory confirms permission entries exist for admin, advocate, junior_advocate, accountant, clerk and staff. Highlights observed: accountant has finance.view, finance.edit and reports.finance; advocate/junior_advocate are assigned-case oriented for case/client/hearing/task visibility; clerk has hearings/tasks and document permissions; staff has documents.view only. This is a permission-table snapshot, not proof that every UI route or every database/storage policy enforces the intended matrix. No role-permission rows were modified in this audit.


## Follow-up QA security hardening — 27 October 2026

A source search across the inspected QA application did not find a reference to public RPC qa_list_workspace_advocates(uuid). The function returns advocate profile names/emails and was exposed as SECURITY DEFINER to authenticated users. To reduce unnecessary client exposure, a QA-only migration now revokes EXECUTE from PUBLIC, anon and authenticated, retaining EXECUTE only for postgres and service_role. The migration is recorded at supabase/migrations/20261027143000_revoke_authenticated_qa_advocate_directory_helper.sql on staging/advocatedesk-test.

Verification: information_schema.routine_privileges now reports EXECUTE only for postgres and service_role. The latest Supabase Security Advisor no longer reports the authenticated SECURITY DEFINER helper warning. Leaked-password protection remains the sole current Security Advisor warning and remains deferred per user instruction; it is still a production blocker. The app must still undergo authenticated regression to confirm no hidden path depends on the revoked RPC.


## Additional QA-only security work — 27 October 2026

### Active workspace checks for advocate directory RPC

A source review confirmed the QA-only case-assignment UI calls public.qa_list_workspace_advocates. Revoking authenticated execution without changing the UI would break case assignment, so that was not done. The RPC was updated in QA Supabase to return Advocate names only when both the target workspace and requesting Admin's workspace are active. Its existing Admin membership check remains in place.

- QA database function definition was re-read after the change and confirms both active-workspace checks.
- The Security Advisor may continue to flag this SECURITY DEFINER function because it remains callable by authenticated users; the function's admin-only gate is a mitigation, not proof that the warning is fully resolved.
- Runtime test of the case-assignment UI and inactive-workspace denial remains outstanding.
- No production changes were made.


## Corrective follow-up — authenticated case-assignment dependency — 27 October 2026

A deeper direct inspection of the current `app.html` and `qa-case-assignment-ui.js` found that the Admin case-assignment UI does call `qa_list_workspace_advocates(uuid)`. Therefore, the earlier statement that the application source had no reference to this RPC was incorrect, and revoking authenticated EXECUTE would break the assignment picker.

- QA database function now requires both an active target workspace and the requesting user's active Admin membership in that same workspace.
- QA grants were corrected: EXECUTE is granted to `authenticated` (needed by the Admin UI) and `service_role`; PUBLIC and `anon` remain revoked.
- A repository migration was added at `supabase/migrations/20261027160000_restore_admin_guarded_qa_advocate_directory_execute.sql`.
- Read-only verification confirms the current grants are `authenticated`, `postgres`, and `service_role`; neither `PUBLIC` nor `anon` has EXECUTE.
- The latest Security Advisor correctly reports the authenticated SECURITY DEFINER RPC warning again. This is not resolved; the function needs runtime positive/negative tests and a final design review. Do not label the security warning cleared.
- The source-review statement and previous suggestion to keep this RPC revoked are superseded by this correction. No production changes were made.

## Release blockers

1. **Field-level data and relationship parity:** compare every resource payload with the intended state contract and verify client/case, case-party, and other relationship semantics.
2. **Authenticated role matrix:** separate live sessions for Admin, assigned Advocate, unassigned Advocate, Accountant, non-member, and cross-workspace access.
3. **Document/Storage acceptance:** verify list, preview/download, delete, and direct cross-workspace denial using the Workspace B Admin's real session. A 401/404 alone is not proof of policy enforcement.
4. **Persistence and concurrency:** simultaneous edits, conflict handling, refresh/re-login persistence, explicit deletion, and recovery with no unintended data loss.
5. **Security Advisor:** leaked-password protection remains deferred per user instruction; record as deferred, not resolved, and revisit before production approval.
6. **Release separation:** verify QA and production repositories, Supabase projects, keys, deployment targets, and protection rules remain separated.

## Required sequence

1. Complete read-only field/relationship parity audit and document exceptions.
2. Fix only confirmed defects on the QA branch; preserve test evidence.
3. Run authenticated role, document, persistence, and concurrency acceptance tests with synthetic QA data.
4. Rerun validation, browser regression, and QA deployment after code changes.
5. Review all results and security warnings; only then make a separate, explicit production release plan.

## Production boundary

No production repository, database, data, credentials, or deployment target was modified during this work. Do not switch or migrate production until all blockers are closed and the release gate is explicitly approved.
