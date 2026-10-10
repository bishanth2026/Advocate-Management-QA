# Phase C7H — Pre-Apply SQL Code Review

**Review status:** Static review only; not applied to Supabase.  
**Target:** `staging/advocatedesk-test` and isolated AdvocateDesk-Test project only.  
**Production:** No changes made.

## Decision

**Do not apply the current C7H draft yet.** It addresses the task-specific `hearings.manage` write-permission coupling and the assigned-only unlinked-task issue, but it also replaces SELECT, INSERT, UPDATE, and DELETE policies for the shared `practice_resources` table across many resource types. The draft needs a policy-by-policy compatibility check and authenticated role tests before it is safe to apply.

## Findings

### 1. The migration has a wider blast radius than its title suggests

The draft drops and recreates four named `practice_resources` policies. The replacement branches cover `case`, `client`, `hearing`, `task`, `case_party`, `invoice`, `payment`, `transaction`, `meeting`, `discussion`, and `court`. This is not a task-only migration. Existing behavior for every one of these types can change.

**Required before apply:** Compare each branch against the currently deployed policy definition and a role/operation matrix. Any intentional behavior change must be called out explicitly.

### 2. Write permissions are now mapped differently for several resource types

The draft maps case/client/case-party/discussion writes to `cases.edit`, finance writes to `finance.edit`, and court writes to `users.manage`. These may be reasonable, but the draft alone does not prove these are equivalent to the current production-independent QA contract or that every expected role has these keys.

**Required before apply:** Query the live QA `role_permissions` values for every mapped permission and compare with the current policy behavior. Do not infer that missing permission rows mean a role should be granted access.

### 3. Task write access is more clearly separated, but must be tested by operation

Task INSERT, UPDATE, and DELETE use `tasks.manage`. Assigned-only scope requires a non-null `case_id` and `private.can_access_case`; workspace-wide task permission is the explicit exception for unlinked rows. UPDATE checks both old-row `USING` and new-row `WITH CHECK`, which is important for preventing cross-scope moves.

**Required before apply:** Verify assigned Advocate can create/update/delete only in an assigned case; cannot move a task from an assigned case into an unlinked or unauthorized case; cannot move an unauthorized task into an assigned case; and cannot alter `workspace_id` to cross workspace boundaries. Verify Admin behavior for unlinked tasks and Accountant denial.

### 4. Permission seeding is additive/updating, not a full permission-model migration

The `INSERT ... ON CONFLICT DO UPDATE` sets the listed `tasks.manage` and selected task-view keys to true. It does not define every role's task permissions and does not remove stale grants. This is safer than blanket deletion, but it means final behavior depends on existing rows and the helper function's semantics for missing rows.

**Required before apply:** Confirm all role/task permission rows, including Clerk and Accountant, before and after the proposed migration. Preserve least privilege; do not grant access merely to make tests pass.

### 5. The draft is not the transactional save fix

The draft updates direct-table RLS policies only. It does not implement the revision table, atomic save RPC, optimistic concurrency control, or all-or-nothing rollback required by the transactional design. It must not be treated as enabling app cutover.

## Required acceptance evidence

1. Save a pre-change snapshot of all `practice_resources` policies and relevant `role_permissions` rows in the isolated QA project.
2. Apply only after reviewing the complete SQL and confirming the target project identity.
3. Run real JWT-backed GET tests for Admin, assigned Advocate, unassigned Advocate, Accountant, non-member, and anonymous users.
4. Run write tests for INSERT/UPDATE/DELETE, including old/new case-scope moves and unlinked tasks.
5. Test all non-task resource types touched by the migration, especially finance records and hearings.
6. Run the transactional RPC atomicity and concurrent-revision tests before switching the application adapter.
7. Re-run the full QA regression suite and record failures as failures; skipped JWT tests are not passes.
8. Do not apply this draft to production.

## Current blocker

The QA project has no prepared dedicated fixture set for the role matrix, and real JWT-backed authorization acceptance has not been demonstrated. Static CI success is useful but is not a substitute for these tests.

## Links

- [C7H SQL draft](../supabase/drafts/20261010_phase_c7h_task_permission_and_unlinked_scope_draft.sql)
- [Transactional save design](phase-c7-transactional-resource-save-design.md)
- [Disposable QA fixture runbook](phase-c7-disposable-qa-fixture-runbook.md)
- [Authenticated HTTP authorization harness](../tests/qa-authz-http.test.js)
