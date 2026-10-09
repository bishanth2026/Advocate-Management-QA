# Phase C2 — Audited Case Assignment Controls

**Environment:** QA only, branch `staging/advocatedesk-test`, Supabase project `uqtsksgypncsbcnuanbk`. Production remains unchanged.

## Implemented

Migration `supabase/migrations/20261010000400_audited_case_assignment_rpc_phase_c2.sql` (commit `98be862db02941ac9dba777aa9e8e1b2ece017c4`) adds:
- `workspace_audit_log` for case assignment/unassignment events.
- `assign_case_to_member(workspace_id, case_id, user_id)` and `unassign_case_from_member(...)` SECURITY DEFINER RPCs with fixed search paths.
- Explicit checks that the caller is an Admin of the active workspace, the case exists in that workspace, and the target user is an active member of the same workspace.
- No direct client INSERT/UPDATE/DELETE policies on `case_assignments`; audit rows are not directly writable by clients.
- RLS-controlled audit-log reads using `audit.view`.

A follow-up SQL migration was applied directly in QA to revoke all direct table privileges on `case_assignments` and `workspace_audit_log` from PUBLIC, anon and authenticated, then grant SELECT to authenticated. The resulting grants were verified: authenticated has SELECT only on each table. The matching migration file still needs to be committed to the QA repository because the GitHub file-write call was blocked; do not assume the database migration history is fully mirrored in the repository until that file is added.

## Verification

- Both assignment RPCs exist and report SECURITY DEFINER.
- Authenticated table grants for assignment and audit tables were queried after the privilege hardening; only SELECT remains.
- No real authenticated Admin/target-user call has been made, so successful assignment/unassignment and audit event creation are not yet end-to-end verified.
- No UI assignment management has been integrated.

## Remaining blockers

1. Add the follow-up privilege migration file to GitHub and verify repo/database migration parity.
2. Test RPCs using a real authenticated QA Admin and target members, plus non-admin negative tests.
3. Implement a UI for assignments that invokes the RPCs rather than writing the table directly.
4. Resolve case-ID relationship consistency and backfill valid assignments.
5. Cut the app over from shared `workspace_state` only after resource mapping and authenticated role tests pass.
6. Do not promote to production until the shared-payload exposure is removed and regression tests pass.
