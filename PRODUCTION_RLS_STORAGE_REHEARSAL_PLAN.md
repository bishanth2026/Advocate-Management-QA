# Production RLS and Storage Migration Rehearsal Plan

**Status: BLOCKED — read-only inspection and draft diagnostics only; no Production changes applied.**  
**Reviewed:** 2026-10-29  
**QA project:** `uqtsksgypncsbcnuanbk`  
**Production project:** `ykxfidrtvmkmmbxameji`  
**Read-only preflight commit:** `a5142013421cec6dec41d889414ab939eba3daea`

## Confirmed Production findings

1. **RLS is weaker than QA for documents.**
   - `public.case_documents` SELECT/DELETE policies currently check active workspace membership; INSERT checks workspace membership and uploader identity.
   - Production `storage.objects` policies for `advocatedesk-documents` check workspace membership based on the first folder in the object path. They do not enforce a matching `case_documents.storage_path` metadata row or case-scoped permission.
   - QA uses role/permission and case-scope dependencies that are not all available in Production. Do not copy QA policies verbatim.

2. **Production schema is not a drop-in match for QA.**
   - Production has `public.practice_records`, `case_documents`, `workspace_members`, and `workspaces`.
   - QA-only dependencies include `case_assignments`, `role_permissions`, `practice_resources`, and `workspace_audit_log`; these were not found in the Production table inventory.
   - Production helper `private.is_workspace_member(uuid)` checks membership and active workspace status. It does not provide case-level authorization.

3. **Bucket configuration and current metadata reconciliation.**
   - `advocatedesk-documents` is private (`public=false`), has a 20 MiB limit, and permits PDF, DOCX, JPEG, and PNG.
   - Read-only counts returned 1 `case_documents` metadata row, 1 object in the bucket, and 1 exact `storage_path = storage.objects.name` match at the time checked. This small count is not proof of general path compatibility or authorization safety.
   - Keep the bucket private; do not change existing object paths until the application path convention is confirmed.

4. **No Production changes were made.**
   - No Production SQL migration, RLS/Storage policy, Auth setting, object, or hosting configuration was changed during this work.
   - Staging branch creation was attempted only after the user approved the previously quoted estimate, but Supabase returned: `Branching is supported only on the Pro plan or above`. The branch was not created; no hourly branch charge was started by a successful creation.

## Work completed on the no-staging-cost path

- Added `supabase/drafts/production-rls-storage-preflight.sql` on `release/advocatedesk-production-readiness`. It contains SELECT-only diagnostics for bucket configuration, current policies, metadata/object path reconciliation, path layout, schema dependencies, and helper definitions.
- Executed read-only checks against Production. Bucket privacy/limits and current metadata/object counts were confirmed.
- Did not apply the existing `secure-documents-storage.sql` draft: it only checks workspace membership and does not safely enforce case-scoped authorization.
- Did not apply QA migrations wholesale or create missing QA tables in Production.

## Required next steps before any Production write

1. Confirm how the live app constructs `storage_path` and whether case visibility is narrower than workspace membership.
2. Decide and document a Production-compatible authorization model. Since Production currently lacks QA's case assignment and role-permission tables/helpers, either implement a separately reviewed phased schema/backfill or define an explicitly supported equivalent using existing Production structures. Do not silently weaken case access to workspace access.
3. Build a minimal migration only after schema, function ACLs, grants, object paths, and app behavior are reviewed. Include matching metadata checks for Storage read/upload/delete and malformed-path denial without breaking current legitimate objects.
4. Test positive and negative behavior with authenticated sessions for each relevant role: same-workspace assigned case, same-workspace unassigned case, cross-workspace case, guessed object path, upload, preview/download, delete, and metadata/object mismatch. SQL-only inspection is not a substitute for real authenticated API tests.
5. Run Cloud Sync save → successful response → hard refresh → reopen, document CRUD, finance, assignment, and role regression tests on the exact candidate SHA.
6. Confirm live hosting source branch and deployed commit SHA, then perform desktop/mobile smoke tests.
7. Backup/restore rehearsal is **deferred by user** because current data is demo/test data. It remains a mandatory precondition before storing real customer data or production cutover; it is not marked as passed.

## Accepted scope exceptions

- Leaked Password Protection is intentionally excluded from this scope per user direction. It has not been changed or verified as enabled; treat it as an accepted exception, not a fix.
- Backup/restore rehearsal is deferred as noted above; it remains outstanding for real customer data.

## Release gate

- [x] Read-only QA-vs-Production RLS/table inventory completed.
- [x] Production bucket remains private and its current limits were verified.
- [x] Read-only metadata/object path count check completed (small current sample only).
- [x] Read-only preflight SQL committed to the release branch.
- [x] Leaked Password Protection exception recorded per user direction.
- [x] Backup/restore deferral recorded per user direction.
- [ ] Production-compatible RLS/Storage migration designed and reviewed.
- [ ] Authenticated positive/negative RLS and Storage tests pass in a safe test environment.
- [ ] Exact candidate CI and role/session regression checks pass.
- [ ] Live hosting branch and deployed SHA verified.
- [ ] Before real customer data: backup/restore rehearsal passes.
- [ ] Desktop/mobile smoke tests and rollback/forward-recovery plan approved.

**Decision: DO NOT RELEASE TO PRODUCTION yet.** No Production database, Auth setting, Storage object, or hosting configuration was changed during this review.
