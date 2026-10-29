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
