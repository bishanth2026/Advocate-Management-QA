# Phase C7 — Live QA preflight snapshot (2026-10-10)

**Environment:** isolated Supabase project `uqtsksgypncsbcnuanbk` (AdvocateDesk-Test)  
**Repository branch:** `staging/advocatedesk-test`  
**Scope:** read-only inspection only. No Auth users, rows, policies, tables, or migrations were created or changed by this check. Production was not accessed.

## Deployment and CI

- QA Pages deployment for commit `0edc8ab37d5392656c8ec5a9979eaebb511c7d23`: completed successfully.
- Validation workflow for the same commit: completed successfully.
- These are repository/CI checks, not live JWT authorization tests. The HTTP harness must not be considered passed if it skips due to missing isolated-QA configuration.

## Live schema and fixture observations

Read-only inspection of the QA project returned:

| Item | Current observation |
|---|---:|
| `public.practice_resources` rows | 9 |
| Case resources | 2 |
| Task resources | 1 |
| `public.case_assignments` rows | 0 |
| `public.workspace_members` rows | 3 |
| `public.profiles` rows | 4 |
| `public.practice_resource_revisions` | Not present |
| `tasks.manage` permission | Not present |

The existing role permission rows include `admin: tasks.view_all=true`, `advocate: tasks.view_assigned=true`, and `junior_advocate: tasks.view_assigned=true`. The live role permission query did not return a `tasks.manage` row. Existing resource policies and the C7H draft still require separate review; the draft has not been applied.

## Readiness decision

**Not ready for live authorization acceptance or application cutover.**

The current database does not have the case assignments and distinct task fixtures required by the role matrix. No authenticated disposable test identities/JWTs have been supplied, and the revision/transaction API is not implemented. CI tests use fake Supabase clients or static contracts; they do not prove live RLS behavior or transaction atomicity.

## Required next steps

1. Create five dedicated disposable Auth identities only in the isolated QA project, then verify each UUID against `auth.users`. Keep tokens local and untracked; never commit tokens or service-role keys.
2. Prepare one reviewed, fail-fast, single-transaction fixture script that creates a new isolated workspace, adds only the dedicated Admin, two Advocates, and Accountant, creates two distinct case resources and three task resources (one unlinked), and assigns each case to only its intended Advocate. Keep the nonmember out of workspace membership.
3. Before execution, verify the workspace and fixture identifiers are new, all supplied Auth UUIDs exist, role values match the actual constraints, and cleanup can be scoped safely. Do not execute a partial script.
4. Run the existing GET-only harness with real, separate short-lived JWTs and capture the full results. A skipped run is not a pass.
5. Only after the baseline is captured, review C7H policy changes and the C7D transactional design independently. Keep all drafts unapplied until authorization, rollback, concurrency, and regression tests are ready and explicit authorization is given.

## Expected read-only role matrix

- Admin: all fixture tasks, including the unlinked task.
- Assigned Advocate: only the task linked to their assigned case.
- Unassigned Advocate: only the task linked to their own assigned case.
- Neither Advocate: the unlinked task or the other Advocate's case task.
- Accountant, nonmember, and anonymous: no task visibility.
- No live result should be inferred from static CI tests.

## Safety boundary

This document is an evidence snapshot, not a migration or seed script. Do not use it to authorize writes. Production remains out of scope.


## Follow-up verification — disposable fixture template (2026-10-10)

A second read-only schema inspection was completed after the fixture template was committed.

- The deployment workflow for commit `0099a11b515b8705c9d21dac38aec1e753e6c49c` completed successfully: [workflow run](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38036591114).
- The validation workflow for the same commit completed successfully: [workflow run](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38036591125).
- The live schema confirms `public.workspaces(name, owner_id, status)`, `public.workspace_members(workspace_id, user_id, role)`, and the expected columns in `public.practice_resources` and `public.case_assignments`. The workspace status and workspace role constraints include the fixture values used by the template.
- The fixture SQL remains **unexecuted**. This check did not create Auth users, insert fixture rows, change policies, or apply migrations.
- These successful GitHub Actions runs establish repository validation/deployment only. They are not live JWT/RLS authorization tests.

### Execution gate remains closed

Before using the template, review the actual live constraints and policies one more time, create and verify five dedicated Auth users in this QA project, and prepare separate short-lived JWTs for the GET-only harness. The SQL Editor seed is a privileged setup operation and cannot itself demonstrate RLS enforcement. Do not use any real user's identity as a fixture. Do not proceed to migration application or persistence cutover based on CI status alone.
