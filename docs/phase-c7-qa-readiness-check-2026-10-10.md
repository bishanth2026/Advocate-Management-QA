# Phase C7 QA Readiness Check — 2026-10-10

**Environment:** isolated AdvocateDesk-Test project `uqtsksgypncsbcnuanbk`  
**Repository branch:** `staging/advocatedesk-test`  
**Mode:** read-only schema/policy inspection plus CI review  
**Production:** not accessed or changed

## Current verified state

- The Resource Store Unit Tests, AdvocateDesk Test Validation, and QA Pages Deployment workflows passed for commit `a3ada0f005c71146fef0f487393d47607f346080`.
- The unit-test workflow explicitly skipped `tests/qa-authz-http.test.js` because the isolated-QA URL/key, workspace/case/task fixtures, and role JWTs are not configured in CI. Static contract checks passing are not live RLS evidence.
- Read-only database inspection found no `public.practice_resource_revisions` table.
- Read-only database inspection found no `tasks.manage` permission row. The `tasks.view_all` and `tasks.view_assigned` permission keys exist.
- The live `practice_resources` mutation policies still map task insert/update/delete to `hearings.manage`, not `tasks.manage`. Their shared case-scoped mutation predicate also allows `cases.view_all` as a workspace-wide exception. The C7H draft changes these semantics and remains unapplied.
- The C7D revision foundation and C7E helper hardening drafts are also not applied.

## Fixture preflight (read-only, latest check)

The QA schema currently contains 4 profile rows, 3 workspace membership rows, **0 case assignments**, and **1 task resource** (that task is linked; there are 0 unlinked task resources). This is insufficient for the required three-task/two-case visibility matrix. No fixtures or memberships were created.

The test fixture set must therefore be created intentionally in a dedicated disposable QA workspace, not improvised from current rows. Because `workspace_members` and `case_assignments` reference real `auth.users`, do not insert guessed user IDs or reuse unrelated users as test identities. Provision dedicated identities first, then create test records with recorded IDs and a cleanup plan.

## Decision

**Do not apply C7H/C7D/C7E yet and do not switch the app persistence adapter.** The intended policy differs from the live policy, and no authenticated JWT role matrix or database-level transaction rollback/concurrency acceptance has run.

## Required next steps

1. Prepare isolated, disposable test identities for Admin, assigned Advocate, unassigned Advocate, Accountant, and workspace non-member; use an anonymous request for the anonymous case.
2. Prepare distinct task fixtures: one unlinked task, one task linked to a case assigned to the assigned Advocate, and one linked to a different case assigned to the unassigned Advocate. Verify the workspace and relationship IDs before testing.
3. Supply the credentials/fixture IDs to a protected QA-only test environment (do not commit JWTs or service-role keys to GitHub).
4. Run the GET-only role matrix before and after any reviewed policy migration.
5. Implement and test one transactional save RPC with injected mid-batch failure, stale-revision conflict, and concurrent-save tests before UI cutover.
6. Keep the legacy `practice_records.workspace_state` path unchanged until data/relationship parity and rollback acceptance are documented.

## Evidence boundaries

This check used read-only database queries and CI logs. It did not create or modify database records, apply migrations, test real JWT access, or prove transactional atomicity. Do not describe these checks as a production security sign-off.
