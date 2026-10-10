# AdvocateDesk QA Security Status — 10 October 2026

## Scope

QA-only review of `staging/advocatedesk-test` and the isolated Supabase project `AdvocateDesk-Test` (`uqtsksgypncsbcnuanbk`). Production repository and production Supabase project were not changed.

## Verified actions

- GitHub Actions run `AdvocateDesk Test Validation #107` passed on commit `0bcad7b3cf35fee7349e87a400db0ef084716648`.
- GitHub Pages QA deployment run #61 passed on the same commit.
- Added `node --check resource-store.js` and `node tests/resource-store.test.js` to the QA validation workflow.
- Revoked `TRUNCATE` from `anon` and `authenticated` on all current tables in the QA project's `public` schema; a follow-up grant query returned no remaining TRUNCATE grants for either role.
- Confirmed Row Level Security is enabled on all nine public application tables.

## Release-blocking finding: application cutover is not complete

The current `app.html` bootstrap still loads `practice_records` with `record_type='other'` and `record_key='workspace_state'`, and `ADCloudSync.save` writes the entire application state to that row. The corresponding policies on `practice_records` are workspace-membership scoped. Consequently, case-level policies on `practice_resources` do not protect cases while the UI continues to use the legacy aggregate row.

The resource-scoped adapter and RLS policies exist, including case-assignment checks, but `app.html` does not load `resource-store.js`. The application cutover must remain blocked until migration parity and authenticated browser authorization tests pass.

## QA database snapshot

Read-only counts after the test-only privilege change:

- Legacy workspace-state rows: 2
- Resource-scoped rows: 9
- Case resource rows: 2
- Case assignments: 0
- Active workspace memberships: 3

The zero-assignment count means an Advocate/Staff account will not have assigned-case access under the resource-scoped policy until a case is assigned through the authorized workflow. Do not weaken RLS or grant workspace-wide case access merely to make the UI appear populated.

## Remaining acceptance gates

1. Implement and review the QA-only application cutover to resource-scoped reads/writes.
2. Preserve save, update, delete, relationship, refresh, and conflict-handling behavior. Hidden rows must never be deleted just because they are absent from a role-filtered client state.
3. Provide/use the authorized Admin case-assignment workflow; verify the audit log records assignment and unassignment.
4. Using separate authenticated Admin and Advocate/Staff browser sessions, verify assigned-case allow and unassigned-case deny for case, client, hearing, task, document and linked finance data as appropriate.
5. Verify cross-workspace denial, Storage policies, and browser behavior before considering any production work.

## Additional Supabase advisor notices

- Leaked-password protection remains disabled and requires review in the QA Auth settings.
- Supabase reports the two case-assignment RPCs as callable SECURITY DEFINER functions for authenticated users. Read-only inspection confirmed both require an authenticated caller who is an Admin member of the same active workspace, validate the target case/member, and write assignment/unassignment audit events. `anon` execution is denied. The advisor warning is therefore not automatically a vulnerability, but authenticated negative tests remain required.
- Added the three missing foreign-key indexes to the isolated QA database via migration `20261010063000_index_assignment_and_audit_foreign_keys.sql`: `case_assignments.assigned_by`, `workspace_audit_log.actor_user_id`, and `workspace_audit_log.target_user_id`. The indexes were verified in `pg_indexes`. Remaining unused-index notices are informational; no indexes were dropped.
- Leaked-password protection remains disabled in QA Auth settings. This cannot be safely represented as a SQL migration; enable and verify it in Supabase Auth settings before production readiness.

**Status: QA only — not production-ready. Do not merge the resource-store cutover to production until all acceptance gates pass.**


## Follow-up verification — 10 October 2026

- QA-only migration `20261010063000_index_assignment_and_audit_foreign_keys.sql` committed at `e36ec12cf05847454ad9af493fbc07232b490f83` and successfully applied to the isolated QA Supabase project. Index existence was confirmed by a read-only catalog query.
- Authenticated browser/RLS tests are still not complete because no confirmed separate test-account credentials/session are available in this workflow. Do not infer them from static checks or service-side catalog access.
