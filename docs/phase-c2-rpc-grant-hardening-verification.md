# Phase C2 RPC Grant Hardening — QA Verification

Date: 2026-10-10

## Change applied

QA Supabase project `uqtsksgypncsbcnuanbk` was updated with migration version `20261009235918` (`revoke_anon_case_assignment_rpc_execution`).

The matching repository migration is:
`supabase/migrations/20261010000500_revoke_anon_case_assignment_rpc_execution.sql`

The migration revokes EXECUTE from PUBLIC and anon for:
- `public.assign_case_to_member(uuid, text, uuid)`
- `public.unassign_case_from_member(uuid, text, uuid)`

It grants EXECUTE to authenticated. Both functions still enforce a non-null authenticated identity and active-workspace Admin membership internally.

## Verified from the database

- Both functions exist and are SECURITY DEFINER with a fixed search_path.
- `anon_execute = false` for both functions.
- `authenticated_execute = true` for both functions.
- Migration history contains `20261009235918 / revoke_anon_case_assignment_rpc_execution`.
- RLS is enabled on `practice_resources`, `case_documents`, `role_permissions`, `case_assignments`, and `workspace_audit_log`.
- Authenticated table grants on `case_assignments` and `workspace_audit_log` are SELECT only.

## Remaining verification

- No active non-Admin QA member was present in `workspace_members` during this check; the two observed memberships were Admins. Therefore non-Admin positive/negative behavior has not been verified with a real test account.
- Real authenticated browser/API tests for case assignment and document/storage policies remain outstanding.
- The resource-store adapter is still not loaded by `app.html`; the app still uses the legacy `practice_records.workspace_state` path.
- No production changes were made.

## Release status

QA security hardening is progressing, but this is not a production approval. Do not cut over the app or promote these changes to production until authenticated role tests, data parity checks, and regression testing are complete.
