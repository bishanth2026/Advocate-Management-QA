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


## Superseded interim finding — advocate directory RPC — 27 October 2026

The following interim finding was superseded by direct source inspection: the case-assignment UI does call `qa_list_workspace_advocates(uuid)`, so authenticated EXECUTE cannot simply be revoked without breaking the Admin assignment picker. The earlier claim that the RPC was unused, that authenticated EXECUTE had been revoked, and that the leaked-password warning was the sole remaining Security Advisor warning is stale. Current state is documented in the later corrective follow-up and final current-state correction below: authenticated EXECUTE is retained behind active-workspace Admin checks; PUBLIC and anon are revoked; two Security Advisor warnings remain; runtime positive/negative tests are outstanding. Do not use this interim section as release evidence.

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


## Reproducibility and final current-state correction — 27 October 2026

- Added repository migration `supabase/migrations/20261027155000_require_active_workspace_for_qa_advocate_directory.sql` so the active-target-workspace check currently applied in QA can be reproduced from the QA branch.
- Added repository migration `supabase/migrations/20261027160000_restore_admin_guarded_qa_advocate_directory_execute.sql` to preserve the authenticated Admin UI dependency while keeping PUBLIC and anon execution revoked.
- The database grant audit confirms EXECUTE for `authenticated`, `postgres`, and `service_role`; no EXECUTE for `PUBLIC` or `anon`.
- The latest Security Advisor reports two warnings: (1) the authenticated SECURITY DEFINER advocate-directory RPC and (2) disabled leaked-password protection. The first remains an intentional, narrowly guarded app dependency that requires live positive/negative tests; the second remains deferred and blocks production approval.
- GitHub combined status for the documentation commit returned no status checks. This means no CI success is established for this commit; it is not equivalent to a passing build.
- No production system was modified.

## Release blockers — deduplicated against existing evidence

### Already demonstrated in the historical browser regression (24 October 2026; before the latest 27 October security migrations)

The existing run `40090283610` was inspected from its job logs, not inferred from its green summary alone. It recorded:
- Admin, assigned Advocate, unassigned Advocate, and Accountant sign-in plus role-scoped fixture visibility/navigation checks.
- Non-member sign-in rejection.
- A live cross-workspace read attempt where an authenticated Admin could not read another workspace's `practice_resources`.
- Authenticated RPC negative-path checks for foreign-workspace directory access and non-Admin assignment/unassignment; same-workspace Admin assignment/unassignment lifecycle checks passed using real browser-issued session tokens.
- Atomic rollback on a duplicate-insert batch.
These results should be retained and not repeated wholesale. They predate the latest security migrations, so rerun only the affected checks for the changed RLS policy and advocate-directory RPC.

### Remaining gaps only

1. **Field-level data/relationship parity:** existing row-count and structural audits are not full field-level parity. Verify intended state contract, case/client/case-party relationships and delete semantics only where not already covered.
2. **Latest-change security regression:** rerun focused positive/negative real-session checks for the updated `practice_resources` membership gate and `qa_list_workspace_advocates` RPC: same-workspace active Admin allowed; Advocate/non-member denied; inactive target workspace denied; PUBLIC/anon not executable. Keep the existing broad role matrix results as prior evidence.
3. **Document/Storage acceptance:** direct Storage list, preview/download, delete, and cross-workspace denial using a real Workspace B session are not yet evidenced. Do not substitute a 404 or policy inspection for a real authorization test.
4. **Persistence/concurrency:** existing atomic rollback and transactional save reference-model tests passed, but they do not prove browser-level refresh/re-login persistence, edit conflict handling, simultaneous edits, deletion/recovery, or absence of data loss. Test only those uncovered behaviors.
5. **Security Advisor:** leaked-password protection remains disabled and must be enabled/reviewed before production approval. The authenticated SECURITY DEFINER RPC warning remains; accept only after focused runtime tests and design review.
6. **Release separation:** verify QA/production repositories, Supabase projects, keys, deployment targets, and protection rules remain separated before any production release.

The existing successful runs are historical evidence, not evidence that the latest 27 October changes have passed regression.

## Required sequence

1. Complete read-only field/relationship parity audit and document exceptions.
2. Fix only confirmed defects on the QA branch; preserve test evidence.
3. Run authenticated role, document, persistence, and concurrency acceptance tests with synthetic QA data.
4. Rerun validation, browser regression, and QA deployment after code changes.
5. Review all results and security warnings; only then make a separate, explicit production release plan.

## Production boundary

No production repository, database, data, credentials, or deployment target was modified during this work. Do not switch or migrate production until all blockers are closed and the release gate is explicitly approved.


## Verified follow-up regression — 27 October 2026

After the focused tests were added to `tests/real-browser-rpc-negative-path.cjs`, GitHub Actions run [40503259909](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40503259909) completed successfully on commit `15e528752fe8b9f8b4b92ef264832a51df1daef4`. The job logs were inspected and confirm these live checks passed using browser-issued Supabase sessions:

- Same-workspace Admin can call `qa_list_workspace_advocates`; returned rows are restricted to Advocate/Junior Advocate roles.
- Non-Admin Advocate receives zero rows from the directory RPC.
- Admin querying a foreign workspace receives zero rows from the directory RPC.
- Authenticated Admin reading foreign-workspace `practice_resources` receives zero rows.
- Existing finance RPC negative-path checks, non-Admin assignment denial, cross-workspace assignment denial, and Admin assignment/unassignment lifecycle checks also passed in the same run.

This closes the focused runtime gap for the tested active-workspace Admin/Advocate and foreign-workspace scenarios. It does **not** prove inactive-workspace denial, a separate non-member RPC call, or PUBLIC/anon grants at runtime. The grant audit remains separate evidence. The Storage acceptance, browser persistence/concurrency, leaked-password protection, SECURITY DEFINER design review, field/relationship parity, and release-separation blockers remain open. Production decision remains **NO-GO**. No production changes were made.

## Read-only Documents/Storage audit — 28 October 2026

Queried only the isolated QA Supabase project `uqtsksgypncsbcnuanbk` using read-only SQL. No records, policies, buckets, or objects were changed.

- `storage.buckets` confirms `advocatedesk-documents` exists and is private (`public = false`).
- `public.case_documents` currently has 3 metadata rows; all 3 have non-null `storage_path` and `case_id`.
- All 3 metadata rows currently join to a matching `practice_resources` row with `resource_type='case'` in the same workspace.
- All 3 metadata rows currently join to an object in the `advocatedesk-documents` bucket at the exact `storage_path`.
- The observed Storage object policies target only `authenticated`: SELECT requires a matching metadata row plus `documents.view` and case access; DELETE requires a matching metadata row plus `documents.delete` and case access; INSERT requires workspace membership and `documents.upload`.
- The observed `case_documents` metadata policies target only `authenticated`: SELECT requires `documents.view` and case access; INSERT requires uploader identity, `documents.upload`, and case access; DELETE requires `documents.delete` and case access.

**Interpretation:** schema and current-row linkage look structurally consistent for these 3 QA records, and the bucket is private. This is not a runtime authorization acceptance test. It does not prove that authorized users can list/preview/download, that unauthorized users cannot delete, or that cross-workspace reads are denied through the Storage API. Those real-session checks remain open.

### Current Security Advisor — 28 October 2026

A fresh QA Security Advisor query still reports exactly these two security warnings:
1. `public.qa_list_workspace_advocates(uuid)` is callable by `authenticated` as a SECURITY DEFINER function. This is an intentional Admin UI dependency but remains subject to final design review and the focused runtime tests.
2. Leaked-password protection is disabled. This remains a production blocker and must be enabled/reviewed before production approval.

No production system was changed. Production remains **NO-GO**.

### Runtime Storage test fixture gap discovered — 28 October 2026

A read-only workspace inventory found:
- Workspace A (`33d996c1-a402-41d0-a639-005f9767b3f8`): 1 document metadata row.
- Disposable QA workspace (`e183d24d-9f64-4283-af54-571f83ca7e3d`): 2 document metadata rows.
- Workspace B (`55097c1f-9ebe-4252-bc4c-a43c3c989361`): 0 document metadata rows.

Therefore, current data can support linkage checks but does not provide a document object inside Workspace B for a realistic cross-workspace Storage authorization test. Do not create/upload/delete test objects until a controlled test identity and cleanup plan are available. Runtime acceptance should use disposable synthetic metadata/object fixtures and real QA sessions from separate workspaces, then verify cleanup. This is a test-data gap, not evidence of a policy bypass.



## Release-gate follow-up — 28 October 2026

### Document/Storage checks reported complete by the QA operator

The QA operator reports that the following runtime checks have been performed:
- Authorized user can view and download documents.
- A user cannot access documents belonging to another workspace without authorization.
- A user without the required permission cannot delete documents.

These are recorded as **operator-reported results**. The current report update does not include attached browser/API logs, response codes, test identities/roles, or object identifiers that independently substantiate the three outcomes. Before production approval, retain sanitized evidence for each positive and negative case. Do not include access tokens, passwords, signed download URLs, or private document contents in the report.

### Remaining release blockers rechecked

A fresh read-only Security Advisor query on QA project `uqtsksgypncsbcnuanbk` at 2026-10-28 still returns two warnings:
1. `public.qa_list_workspace_advocates(uuid)` is callable by `authenticated` as a SECURITY DEFINER function. The current function body has a fixed search_path and requires the target workspace and requesting Admin membership to be active, but the warning remains open pending design review and runtime edge-case tests.
2. Leaked-password protection is disabled. This remains a production blocker; configure and verify it through the supported Supabase Auth settings before release.

A fresh read-only workspace inventory shows the three known QA workspaces are all active. No inactive workspace fixture is currently available for a direct inactive-target RPC test. A true non-member RPC test also remains unproven by the currently inspected browser test, which covers same-workspace Admin, non-Admin Advocate, and foreign-workspace Admin cases.

### Next acceptance work

1. Preserve sanitized evidence for the operator-reported document view/download, cross-workspace denial, and unauthorized-delete denial.
2. Add or provision a controlled QA-only inactive-workspace test fixture and a real authenticated non-member session, with a cleanup plan, then test the advocate-directory RPC fail-closed behavior.
3. Verify browser refresh and re-login persistence, edit conflicts/concurrent edits, and deletion/recovery; existing transaction tests do not establish these browser-level behaviors.
4. Verify QA/production repository, project, keys, deployment targets, and protection rules remain separated.
5. Re-run the affected validation and browser regression workflows after any code or configuration changes, inspect their logs, and update this gate with actual run IDs and results.

**Decision remains NO-GO.** This update is documentation-only on the QA branch. No QA database records, policies, storage objects, Auth settings, or production systems were changed.
