# Phase C7B — QA Storage Access Grant Review — 10 October 2026

## Scope
Read-only inspection of the isolated QA Supabase project's `storage.objects` table grants and RLS policies. No SQL changes were made. Production was not accessed.

## Findings

- `storage.objects` has RLS enabled; FORCE ROW LEVEL SECURITY is false.
- The `anon` database role has table-level grants on `storage.objects` for SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, and TRUNCATE.
- The `authenticated` role has the same table-level grants.
- The three application policies found on `storage.objects` are explicitly scoped to `authenticated`:
  - SELECT requires the private `advocatedesk-documents` bucket plus matching `case_documents` metadata, `documents.view`, and case access.
  - INSERT requires the private bucket, a UUID workspace path prefix, workspace membership, and `documents.upload`.
  - DELETE requires the private bucket plus matching metadata, `documents.delete`, and case access.
- No application UPDATE policy was returned by this query. This does not by itself prove every Storage API operation is blocked; provider-managed policies, service roles, and actual HTTP requests must be considered separately.

## Assessment

The grants are broader than the app's intended user model, but table grants alone are not proof of anonymous access because RLS also applies. The app policies are explicitly authenticated-only. Do not revoke provider-managed Storage grants based solely on this inventory: first verify expected Supabase Storage behavior, inspect all policies and role inheritance, and test anonymous versus authenticated requests against a harmless QA-only object.

## Required next tests

1. Confirm anonymous requests cannot list, read, upload, update, or delete objects in `advocatedesk-documents`.
2. Confirm authenticated users without workspace membership cannot upload.
3. Confirm an active member with `documents.upload` can upload only beneath their workspace UUID prefix.
4. Confirm document read/delete require metadata and case authorization.
5. Test failed metadata writes and upload cleanup, since DELETE is metadata-dependent.
6. Reassess FORCE ROW LEVEL SECURITY only after checking service-role and owner semantics; do not enable it speculatively.

## Release status

This is a QA-only grant/policy inventory. No remediation was applied. Document upload/download and transactional resource cutover remain unapproved pending end-to-end authenticated tests.
