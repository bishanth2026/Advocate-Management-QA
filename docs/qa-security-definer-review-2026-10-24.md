# QA Security Review — SECURITY DEFINER Functions

**Scope:** QA Supabase project `uqtsksgypncsbcnuanbk` only  
**Repository branch:** `staging/advocatedesk-test`  
**Review type:** Read-only catalog and policy inspection  
**Production:** Not accessed or changed by this review.

## Summary

Six public functions are flagged by Security Advisor because they use `SECURITY DEFINER`. Catalog inspection confirms that none grants EXECUTE to `anon` or `PUBLIC`; each is executable by `authenticated`, the owner (`postgres`), and `service_role`. All six set a fixed function `search_path` to `public, private, pg_temp`.

The warning is **not marked resolved**. These functions have different authorization purposes, and removing `SECURITY DEFINER` or revoking authenticated execution without replacement tests could break assignment and finance-directory workflows. No database changes were made.

## Function-by-function findings

| Function | Purpose / observed guard | Assessment |
|---|---|---|
| `assign_case_to_member(uuid,text,uuid)` | Requires non-null `auth.uid()`; checks caller is an Admin in the selected active workspace; verifies the case belongs to that workspace and target user is an active member of the same workspace; records an audit event. | Guarded. Keep elevated execution only with authorization regression coverage. |
| `unassign_case_from_member(uuid,text,uuid)` | Requires authenticated caller and Admin membership in the selected active workspace; deletes only the assignment matching workspace, case and user; records audit event on success. | Guarded. Keep elevated execution only with authorization regression coverage. |
| `finance_case_directory(uuid)` | Filters cases by requested workspace and `private.has_workspace_permission(workspace,'finance.view')`. | Permission-scoped; elevated execution appears to support finance users whose general case visibility is narrower. |
| `finance_case_directory_v2(uuid)` | Same workspace filter and `finance.view` permission check; returns additional case/hearing fields. | Permission-scoped; test denied cross-workspace and no-finance-permission calls. |
| `finance_client_directory(uuid)` | Filters clients by workspace and `finance.view`; omits clients without a name. | Permission-scoped; test denied cross-workspace and no-finance-permission calls. |
| `finance_client_directory_v2(uuid)` | Same workspace and `finance.view` guard; computes associated case counts. | Permission-scoped; test denied cross-workspace and no-finance-permission calls. |

## Grant verification

Catalog ACL checks returned the following for all six functions:

- `anon EXECUTE = false`
- `PUBLIC EXECUTE = false`
- `authenticated EXECUTE = true`
- `service_role EXECUTE = true`
- Owner: `postgres`

The shared helper `private.has_workspace_permission(uuid,text)` is also `SECURITY DEFINER`, has a fixed search path, returns false when `auth.uid()` is null, and checks active workspace membership plus role permission (with active workspace Admins allowed). Its grants are limited to `authenticated` and `postgres` in the inspected ACL.

The `practice_resources` SELECT RLS policy is resource-type-specific. Case/client visibility is controlled by case/client view permissions and assignment rules; finance resources require `finance.view`. This is why converting the finance directory functions to invoker rights without verifying RLS equivalence may change expected finance access.

## Remaining validation before declaring this warning resolved

1. Add authenticated negative-path tests for each finance directory function: no workspace membership, a different workspace, and a member without `finance.view` must return no rows / be denied as appropriate.
2. Test assignment and unassignment as Admin, non-Admin, non-member, and cross-workspace caller; confirm audit rows are written only for authorized operations.
3. Confirm application call sites for both directory versions and assignment RPCs before changing grants or function security mode.
4. Re-run live QA browser regression and Security Advisor after any proposed migration.

## Decision

**No schema change in this review.** The observed guards and restricted grants provide positive evidence, but catalog inspection alone does not prove every runtime authorization path. Treat the six Advisor findings as **reviewed, not cleared** until negative-path tests are run. The user's separate choice to defer Leaked Password Protection is unchanged.


## Additional QA negative-path checks (2026-10-24)

Executed read-only / rollback-scoped SQL checks in the QA database by setting the transaction-local JWT subject claim to existing QA test identities. These checks exercise the function authorization logic, but are **not a substitute for real PostgREST requests with real browser-issued JWTs**.

| Test | Result |
|---|---|
| Advocate without `finance.view` calls each of the four finance directory functions in own workspace | PASS — all returned 0 rows |
| Same advocate requests the other workspace through each finance directory function | PASS — all returned 0 rows |
| Non-admin advocate attempts case assignment | PASS — rejected with authorization SQLSTATE `42501` |
| Non-admin advocate attempts case unassignment | PASS — rejected with authorization SQLSTATE `42501` |
| Workspace A Admin attempts assignment in workspace B | PASS — rejected with authorization SQLSTATE `42501` |
| Workspace A Admin attempts unassignment in workspace B | PASS — rejected with authorization SQLSTATE `42501` |

The checks ran inside a transaction that was rolled back. No case assignments, audit entries, or other persistent application rows were intentionally created by these checks.

## Remaining before closure

- Repeat these negative paths through the deployed QA application's authenticated PostgREST API / browser session (not only transaction-local SQL claims).
- Add a real non-member test for each assignment RPC and confirm no audit event is written after a denied request.
- Run the complete QA browser workflow after any test-code change.
- Revisit Security Advisor; these findings remain **reviewed, not cleared** until the end-to-end checks and Advisor review are complete.
