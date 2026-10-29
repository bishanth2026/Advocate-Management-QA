# Production RLS and Storage Migration Rehearsal Plan

**Status: BLOCKED — planning/review only; no Production changes applied.**  
**Reviewed:** 2026-10-29  
**QA project:** `uqtsksgypncsbcnuanbk`  
**Production project:** `ykxfidrtvmkmmbxameji`

## Read-only inventory findings

A fresh read-only comparison of `pg_policies` and `information_schema.tables` confirms that QA and Production do not share the same authorization model.

### Material differences

1. **Case documents**
   - Production policies on `public.case_documents` authorize SELECT/DELETE using workspace membership; INSERT checks membership and uploader identity.
   - QA policies additionally require the corresponding `documents.view`, `documents.upload`, or `documents.delete` workspace permission and `private.can_access_case(workspace_id, case_id)`.
   - QA storage-object policies for bucket `advocatedesk-documents` authorize reads/deletes through matching `case_documents` metadata and the document permission plus case-scope checks. Upload checks bucket ID, UUID workspace folder, active membership, and upload permission.
   - These are not equivalent. Do not copy only the QA policies into Production without adding/validating their dependencies and verifying existing data/path conventions.

2. **Practice data model**
   - Production contains `public.practice_records` with member-based SELECT/INSERT/UPDATE/DELETE policies.
   - QA additionally contains `public.practice_resources`, `public.case_assignments`, `public.role_permissions`, and `public.workspace_audit_log`; these tables are absent from the Production table inventory inspected on 2026-10-29.
   - QA has a restrictive workspace-state policy and resource-type/case-scoped permission checks. Production's existing `practice_records` model is not a drop-in equivalent.
   - Do not deploy policies referencing QA-only tables or helper functions before an explicitly reviewed schema/backfill/compatibility plan exists.

3. **SECURITY DEFINER functions**
   - QA's inspected private functions currently use an empty `search_path`, including assignment, permission, case-scope, and finance-directory helpers.
   - Production's inspected SECURITY DEFINER inventory contains `private.is_workspace_member`, `private.is_workspace_owner`, and `public.handle_new_advocatedesk_user`, also with an empty `search_path`.
   - This inventory is not a complete function-body/ACL review. Do not port QA functions or grants by name alone.

4. **Auth setting**
   - Fresh Supabase Security Advisor scans still return `auth_leaked_password_protection: WARN` for both QA and Production.
   - This is an Auth configuration item, not a SQL migration. The setting must be enabled/verified separately in each project's Auth password-security settings, followed by a fresh Advisor scan. No Auth setting was changed during this review.

## Required staged migration sequence

1. Export/backup Production schema and required data; document and rehearse restore/forward-recovery before any write.
2. Inspect Production columns, constraints, indexes, bucket configuration, storage object naming, helper function bodies, function ownership/ACLs, and current grants.
3. Define the intended role/permission model and decide whether Production needs a phased migration/backfill for assignment and resource tables. Avoid introducing QA-only tables unless the app release explicitly requires them.
4. Draft a minimal, ordered migration for case-scoped document access, including matching Storage object policies. Preserve the current application path/metadata format or include a tested compatibility migration.
5. Rehearse against an isolated staging copy with authenticated positive and negative tests for Admin, Advocate, Staff, and Accountant, including cross-workspace reads/writes, unassigned case access, document upload/read/delete, guessed storage paths, and existing-record compatibility.
6. Run assignment, finance-directory, Cloud Sync save → successful HTTP response → hard refresh → reopen, and regression tests on the exact candidate SHA.
7. Review rollback/forward-recovery steps and confirm backup restore before scheduling Production deployment.
8. Verify the live hosting source branch and deployed commit SHA; run desktop/mobile smoke tests after staging approval.

## Current release gate

- [x] QA-only SECURITY DEFINER search-path configuration verified after migration.
- [x] Read-only QA-vs-Production RLS/table inventory completed.
- [ ] Leaked-password protection enabled and verified in both projects.
- [ ] Production-compatible RLS/Storage migration designed and reviewed.
- [ ] Isolated staging rehearsal and authenticated negative tests pass.
- [ ] Backup/restore rehearsal passes.
- [ ] Exact candidate CI and role/session regression checks pass.
- [ ] Live hosting branch and deployed SHA verified.
- [ ] Desktop/mobile smoke tests and rollback plan approved.

**Decision: DO NOT RELEASE TO PRODUCTION.** No Production database, Auth setting, Storage object, or hosting configuration was changed during this review.
