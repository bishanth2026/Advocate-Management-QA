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
- Supabase reports the two case-assignment RPCs as callable SECURITY DEFINER functions for authenticated users. The functions contain Admin-membership checks; retain the grants only if this is the intended Admin assignment interface and verify negative authorization tests.
- Performance advisor reports three foreign-key indexes that could be considered later; this is not the current release blocker.

**Status: QA only — not production-ready. Do not merge the resource-store cutover to production until all acceptance gates pass.**
