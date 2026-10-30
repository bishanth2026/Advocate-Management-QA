# Production RLS Migration Design — Draft Only

**Status: DESIGN DRAFT — NOT APPROVED TO APPLY**  
**Target:** production Supabase project `ykxfidrtvmkmmbxameji`  
**Reference QA project:** `uqtsksgypncsbcnuanbk`  
**Prepared:** 2026-10-29

This document translates the observed production/QA policy differences into a safe implementation and verification plan. It intentionally does not contain executable migration SQL: the available policy comparison is not enough to prove the full schema, helper-function semantics, grants, storage policies, or all application query paths. Do not apply QA migrations wholesale or treat this document as approval for a production write.

## 1. Confirmed observations from read-only review

- Production `case_documents` read/delete policies are workspace-membership based; insert also checks uploader identity.
- QA document policy design uses case access and explicit `documents.view`, `documents.upload`, and `documents.delete` permissions.
- Production `practice_records` policies are generally workspace-member based. QA has additional role/case-scoped behavior for QA-specific resource/state structures.
- QA-only tables/helpers include `case_assignments`, `role_permissions`, `practice_resources`, and `workspace_audit_log`; their policies cannot be copied without dependency and application-compatibility analysis.
- These observations identify a security-design mismatch, not proof that a live incident has occurred.

## 2. Migration design sequence

### Gate A — inventory and baseline (read-only)
- [ ] Export the exact production `pg_policies` definitions for affected tables and storage objects.
- [ ] Inventory production columns, constraints, indexes, triggers, grants, RLS flags, and all relevant functions, including function owner, SECURITY DEFINER/INVOKER mode, search_path, and EXECUTE grants.
- [ ] Map application reads/writes to `case_documents`, `practice_records`, case assignment, workspace membership, and document storage.
- [ ] Confirm which production role/permission model is authoritative; do not assume QA-only roles or tables exist in production.
- [ ] Record baseline row counts and representative non-sensitive test cases; obtain a verified backup and restore evidence before any change.

**Exit criterion:** a reviewed dependency map that identifies every referenced table/function/claim and the expected behavior for each role.

### Gate B — choose the smallest compatible design
- [ ] Define explicit allow/deny behavior for Admin, Advocate, Staff, Accountant, unassigned case members, workspace-only members, anonymous users, and cross-workspace requests.
- [ ] Define whether case access derives from an assignment table, an existing case owner/assignee field, or another production source of truth.
- [ ] Design least-privilege SELECT/INSERT/UPDATE/DELETE policies for document metadata, including uploader identity and case/workspace consistency.
- [ ] Inspect object-storage policies separately; database RLS does not automatically secure file objects.
- [ ] Ensure helper functions cannot be abused through SECURITY DEFINER/search_path or broad EXECUTE grants.
- [ ] Avoid adding QA-only role names or schema objects unless the production application and migration set explicitly require them.
- [ ] Specify a rollback or forward-fix plan and note whether old clients remain compatible during rollout.

**Exit criterion:** SQL reviewed by a second reviewer against the actual production schema; no unresolved dependencies.

### Gate C — isolated staging rehearsal
- [ ] Create/use an isolated staging database with schema and migration history representative of production. Never use a QA schema as a substitute without reconciling drift.
- [ ] Apply migrations in order and capture output, timings, locks, and errors.
- [ ] Run the test matrix below with real authenticated sessions for each role.
- [ ] Verify legitimate document reads/uploads/deletes still work, unauthorized case/workspace operations fail, and cloud sync remains functional.
- [ ] Test existing documents and storage objects, not just newly created rows.
- [ ] Verify backup restoration or a documented recovery rehearsal.
- [ ] Run application smoke tests on desktop and mobile.

**Exit criterion:** all required positive and negative tests pass on a recorded candidate migration SHA; no unexplained regression.

### Gate D — production change window
- [ ] Confirm exact reviewed migration SHA, backup/restore evidence, rollback owner, monitoring, and recovery steps.
- [ ] Apply only the approved minimal migration during an agreed window.
- [ ] Immediately run a small authenticated smoke suite and inspect database/auth/storage errors.
- [ ] Stop rollout and execute the approved recovery plan if any legitimate workflow fails or any negative authorization test unexpectedly succeeds.
- [ ] Recheck policy definitions and critical workflows after the change.

**This gate is not authorized by this draft.**

## 3. Required authenticated test matrix

| Scenario | Expected result | Evidence required |
|---|---|---|
| Assigned Advocate reads own case document | Allow | Real session + API result |
| Advocate reads unassigned case document without broader permission | Deny | Real session + API result |
| Staff reads document within explicitly granted scope | Allow only if policy grants it | Real session + API result |
| Workspace member reads unrelated case document | Deny unless explicit permission permits it | Real session + API result |
| User reads another workspace's document | Deny | Real session + API result |
| User inserts document with another user's uploader ID | Deny | Direct API/RPC negative test |
| User inserts document whose case belongs to another workspace | Deny | Direct API/RPC negative test |
| User without `documents.delete` deletes a document | Deny | Direct API negative test |
| Authorized upload and subsequent refresh/cloud sync | Allow | UI + network/API evidence |
| Anonymous request reads or mutates protected data | Deny | API evidence |
| Storage object access outside permitted case/workspace | Deny | Storage API evidence |
| Finance RPC/table operations outside grants | Deny | Authenticated API evidence |

Use synthetic test records where possible. Do not place real client information in test logs or commit credentials/tokens to the repository.

## 4. Release blockers that remain independent of this migration

- Real-session Admin/Advocate/Staff/Accountant authentication and role authorization have not been fully verified.
- The prior QA cloud-sync error `new row violates row-level security policy` (403) requires a real-session retest after the relevant policy change.
- Leaked-password protection was reported disabled; enable and verify it in the Supabase Auth settings.
- Confirm the actual hosting source and deployed commit SHA; repository branch state alone does not prove what is live.
- Run final desktop/mobile smoke tests and retain evidence tied to the exact release candidate.

## 5. Current decision

**Production release remains BLOCKED / NOT APPROVED.** This is a planning artifact only. No production SQL, policies, schema, data, authentication settings, or hosting configuration were changed when preparing this document.


## 6. Additional read-only production findings — 2026-10-29

The production project was inspected with read-only SQL after this draft was created:

- The only matching private helper functions found were `private.is_workspace_member(uuid)` and `private.is_workspace_owner(uuid)`; no production `can_access_case` or `has_workspace_permission` helper was found in the inspected schemas.
- Both helpers are `SECURITY DEFINER`, owned by `postgres`, and configured with an empty search_path. `is_workspace_member` checks an active workspace and a membership row for `auth.uid()`; `is_workspace_owner` checks `workspaces.owner_id = auth.uid()`. This is a useful hardening baseline, but workspace membership is not case-level authorization.
- Storage bucket `advocatedesk-documents` has authenticated SELECT, INSERT, and DELETE policies based on the workspace UUID in the first object-path segment and workspace membership. INSERT additionally checks object owner ID equals the authenticated user. These are workspace-scoped rather than case/permission-scoped.
- The storage policy query did not return a corresponding UPDATE policy for this bucket. Confirm whether update/overwrite is intentionally denied and whether the application depends on it; do not assume the current behavior.
- `authenticated` has table-level SELECT/INSERT/UPDATE/DELETE grants on `case_documents` and `practice_records`, so the effective authorization depends on the RLS policies. A separate review of column grants, views, RPCs, and service-role paths is still required.

**Impact on design:** the migration design must cover both `public.case_documents` and `storage.objects`; changing only table RLS would leave storage authorization at workspace-member scope. The missing case/permission helpers mean a migration cannot safely reference QA helper names without first designing and testing production-compatible implementations and assignment source-of-truth.

These observations were read-only. No production schema, policy, data, auth setting, or storage object was changed.


## 7. QA-only hardening completed — 2026-10-29

To continue preparation without touching production, a narrow QA-only migration was applied to project `uqtsksgypncsbcnuanbk`:

- Migration: `20261029011135_qa_harden_case_authorization_search_path_20261029`
- Source committed to QA `main`: `supabase/migrations/20261029011135_qa_harden_case_authorization_search_path_20261029.sql`
- Functions updated: `private.can_access_case`, `private.has_workspace_permission`, `private.is_case_creator`.
- Change: set `search_path = ''` while preserving function logic and grants. All referenced tables and auth functions are schema-qualified.
- Post-change verification: all three remain `SECURITY DEFINER`; `anon` still has no EXECUTE privilege; `authenticated` retains EXECUTE; the QA document table policies (3) and storage policies (3) remain present.

This is a configuration/static verification PASS only. Real authenticated-session positive/negative tests, cloud-sync tests, and full application regression tests have not yet been run. The QA migration does not resolve production/QA schema drift and has **not** been applied to production. Production release remains blocked.


## 8. QA private-function search-path follow-up — 2026-10-29

A second QA-only migration was applied after reviewing the seven function definitions and ACLs:
- Migration: `qa_harden_remaining_private_definer_search_paths_20261029`
- Source of record: `supabase/migrations/20261029074800_qa_harden_remaining_private_definer_search_paths.sql` on QA `main`.
- Seven functions were changed to `search_path = ''`: `assign_case_to_member`, `unassign_case_from_member`, `finance_case_directory`, `finance_case_directory_v2`, `finance_client_directory`, `finance_client_directory_v2`, and `qa_list_workspace_advocates_internal`.
- Post-change read-only verification confirms all seven remain SECURITY DEFINER and use an empty search_path. Function bodies and ACLs were not modified.

The existing release safety workflow is not triggered by a push to QA `main`; the recorded GitHub workflow lookup returned no run for this QA commit. This change therefore has database configuration verification but still requires the QA assignment/finance regression suite and an explicit syntax/smoke validation on the release candidate. It has not been applied to production.

## 9. Leaked-password protection — latest status

The user reports changing this setting. However, fresh security-advisor scans on 2026-10-29 still show `auth_leaked_password_protection` as WARN in both QA and Production. This may indicate the setting was not saved in one or both projects, or the advisor has not reflected the change yet; do not claim verified until each project's Auth password-security setting and a subsequent scan agree. No Auth setting was modified by this work.
