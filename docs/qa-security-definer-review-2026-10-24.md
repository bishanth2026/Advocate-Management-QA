# QA Security Review — SECURITY DEFINER Functions

**Scope:** QA Supabase project `uqtsksgypncsbcnuanbk` only  
**Repository branch:** `staging/advocatedesk-test`  
**Review type:** Read-only catalog and policy inspection  
**Production:** Not accessed or changed by this review.

## Summary

Six public functions are flagged by Security Advisor because they use `SECURITY DEFINER`. Catalog inspection confirms that none grants EXECUTE to `anon` or `PUBLIC`; each is executable by `authenticated`, the owner (`postgres`), and `service_role`. All six now set a fixed function `search_path` to `pg_catalog, public, private, pg_temp` (verified after QA-only hardening migration).

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


### Assignment RPC additional transaction tests

Further QA transaction tests used existing QA identities and an existing QA case. All test writes were rolled back.

| Test | Result |
|---|---|
| Authenticated identity with no workspace membership attempts assignment | PASS — rejected with authorization SQLSTATE `42501` |
| Same non-member attempts unassignment | PASS — rejected with authorization SQLSTATE `42501` |
| Authorized workspace Admin assigns an existing case to an active workspace member | PASS — returned assignment ID and generated the expected `case.assigned` audit event within the test transaction |
| Same Admin unassigns the case/member pair | PASS — returned success within the test transaction |

The successful Admin test confirms both intended operation paths and audit creation in the transaction, then rolled the transaction back to avoid leaving test changes behind.

**Important limitation:** SQL transaction-local identity claims test function logic but do not fully prove the deployed PostgREST/API behavior with genuine JWTs. The real-browser/API negative-path suite and a fresh Security Advisor review remain open.


## Real browser authenticated RPC regression results (2026-10-24)

GitHub Actions workflow: [Real browser role and module regression](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40074429736)  
Commit tested: `76b0bf48d2dd2d9cc9d83848f09354ccfec9573f`  
Result: **PASS** — workflow and both browser test steps completed successfully using disposable QA role credentials. No production credentials were used.

| Real API test | Result |
|---|---|
| `finance_case_directory` called by authenticated Advocate in own workspace | PASS — 0 rows |
| `finance_case_directory` called by Advocate/Admin in foreign workspace | PASS — 0 rows |
| `finance_case_directory_v2` called by authenticated Advocate in own/foreign workspace | PASS — 0 rows |
| `finance_client_directory` called by authenticated Advocate in own/foreign workspace | PASS — 0 rows |
| `finance_client_directory_v2` called by authenticated Advocate in own/foreign workspace | PASS — 0 rows |
| `assign_case_to_member` called by non-Admin Advocate | PASS — denied |
| `unassign_case_from_member` called by non-Admin Advocate | PASS — denied |
| `assign_case_to_member` called by Admin for foreign workspace | PASS — denied |
| `unassign_case_from_member` called by Admin for foreign workspace | PASS — denied |
| Existing browser regression: Admin/Advocate/Accountant pages, non-member login, workspace isolation, atomic rollback, case-hearing-calendar synchronization | PASS |

The new RPC checks used genuine access tokens retrieved from successful browser logins and made authenticated requests against the QA project's PostgREST RPC endpoints. No authorized write RPC was called during this negative-path suite; therefore these API tests created no assignment or audit records.

## Post-run Security Advisor status (2026-10-24)

A fresh Security Advisor query after the regression still reports:
- 6 authenticated `SECURITY DEFINER` functions (reviewed; not cleared)
- 1 Leaked Password Protection warning (previously deferred)

No function grants or security modes were changed. This is intentional: authenticated API negative-path tests passed, and the reviewed functions' `search_path`, role/workspace checks, and `finance.view` guards remain in place. Revoking execution or switching to invoker rights without a separate equivalence test of existing app workflows could break legitimate finance or assignment operations.

**QA status:** Real browser authenticated negative-path regression completed successfully. **Security Advisor findings remain open** pending a controlled remediation decision; no production changes made.

## Invoker-equivalence review — 2026-10-24 (QA only)

### What was checked

- Re-read live function definitions, ACLs, and pg_policies for public.practice_resources in QA project uqtsksgypncsbcnuanbk.
- At the time of the initial invoker-equivalence review, the functions had search_path = public, private, pg_temp. A later QA-only migration changed all six to `pg_catalog, public, private, pg_temp`. Owner remains postgres; anon EXECUTE=false, PUBLIC EXECUTE=false, and authenticated EXECUTE=true. The two assignment functions and four finance directory functions also have service_role EXECUTE=true.
- Reconfirmed the four finance directory functions explicitly scope results to p_workspace_id and call private.has_workspace_permission(p_workspace_id, 'finance.view').
- Inspected the live practice_resources_select_authorized RLS policy. For resource_type='case', SELECT is gated by cases.view_all, cases.view_assigned plus case access, or creator visibility. For resource_type='client', SELECT is gated by clients.view_all, clients.view_assigned plus case access, or creator visibility. These are not equivalent to the finance directory functions' finance.view check.
- Inspected the deployed QA Finance UI source and the QA accountant-directory migration; the directory functions supply case/client choices and expanded directory fields for Finance workflows. The regression suite directly calls all four RPCs over authenticated PostgREST sessions.

### Decision: do not switch the six functions to SECURITY INVOKER yet

**The Finance functions are not invoker-equivalent under the current RLS policy.** Under invoker rights, PostgreSQL applies the caller's practice_resources SELECT RLS policy as well as the function's finance.view predicate. A legitimate Accountant who has finance.view but does not have the separate case/client view permissions can therefore lose rows or have Finance case/client pickers appear empty. The current policy/function predicates are materially different, so changing these four functions to SECURITY INVOKER now carries a demonstrated policy-level workflow regression risk. This is a reasoned RLS equivalence assessment, not a claim that an actual invoker-mode experiment was run.

The two assignment RPCs perform controlled writes to case_assignments and workspace_audit_log under an explicit active-workspace Admin check. Switching these to invoker rights may additionally make them depend on direct table grants and INSERT/DELETE RLS policies; no evidence currently establishes that those requirements are equivalent. Do not change their security mode or revoke authenticated execution until a replacement path and positive/negative tests are ready.

### Security review result

- **Authorization checks:** present and workspace-scoped for all six functions; negative-path real-browser RPC tests previously passed.
- **search_path:** hardened on all six functions to `pg_catalog, public, private, pg_temp` in a QA-only migration. Catalog settings were verified after the migration; full browser regression still needs rerunning after this change.
- **Grants:** no anon or PUBLIC execution; authenticated execution is intentional for the browser's Finance directory and assignment workflows. Do not blanket-revoke it. The Advisor warnings remain actionable review findings, not evidence of an observed authorization bypass.
- **Database:** no function definitions, grants, policies, or data changed in this review.
- **Production:** not accessed or changed.

### Next safe remediation option

If the goal is to remove the four Finance warnings, first design and test a narrowly scoped invoker-safe read path (for example, a dedicated RLS policy/view that grants only the same finance.view-authorized case/client directory rows without broadening general case/client visibility). Verify it with Admin, Accountant-with-finance-only, Advocate-without-finance, foreign-workspace, and non-member identities. Only then consider changing the Finance RPC security mode. Keep assignment RPCs separate; do not weaken their checks or make assignment tables broadly readable/writable to silence the Advisor.

## QA search_path hardening applied — 2026-10-24

Applied QA-only migration `qa_security_definer_search_path_hardening_20261024` to project `uqtsksgypncsbcnuanbk`. It changes only the function-level search_path setting for the six public functions to `pg_catalog, public, private, pg_temp`.

Post-migration catalog verification confirmed for all six functions:
- `SECURITY DEFINER` remains enabled.
- `search_path=pg_catalog, public, private, pg_temp` is active.
- `anon EXECUTE=false`, `PUBLIC EXECUTE=false`, and `authenticated EXECUTE=true` remain unchanged.
- No function bodies, grants, RLS policies, or application rows were changed by this migration.
- Production was not accessed or changed.

A fresh Security Advisor check at 2026-10-24T07:41:15.829Z still reports six `authenticated_security_definer_function_executable` warnings and one `auth_leaked_password_protection` warning. This is expected: search_path hardening does not remove the Advisor's SECURITY DEFINER warning. The six functions remain guarded but the Advisor findings are not cleared.

### Validation status after migration

The catalog configuration and grants were re-read successfully after migration. The full authenticated browser regression has **not yet been rerun after this database-only change**. The prior real-browser negative-path suite passed before this search_path adjustment. Run the QA real-browser regression workflow before treating this hardening step as fully validated.

### Remaining decision

Do not change the four Finance directory functions to SECURITY INVOKER until an invoker-safe read design has been tested against the current RLS rules. Do not change the two assignment functions' security mode or revoke authenticated execution without a replacement path. The next remediation should be a QA-only design/test of a narrowly scoped Finance directory read path, avoiding a broad case/client RLS policy that would expose full payloads through the generic REST table API.


## Report consistency note — 2026-10-24

This document contains historical review sections written before the search_path hardening migration. Those earlier sections describe the pre-migration state and should not be read as the current catalog state. Current state is recorded in “QA search_path hardening applied” above: all six functions use `pg_catalog, public, private, pg_temp`. The real-browser tests passed before that migration; a post-migration run remains outstanding. No invoker-mode migration has been applied, and no production system was accessed or changed.


## Next remediation design — Finance directory least-privilege path (QA only)

### Current function contract verified from live catalog

The four directory functions return a deliberately narrow set of fields rather than the full `practice_resources.payload`:

- Case directory v1: case ID, number, title, linked client ID/name.
- Case directory v2: those fields plus court, next hearing, hearing time, and case status.
- Client directory v1: client ID, name, phone.
- Client directory v2: client ID, name, phone, client number, role, status, and associated case count.

All four filter by the supplied workspace and require `private.has_workspace_permission(p_workspace_id, 'finance.view')`. The case/client base-table SELECT policy instead uses case/client view permissions and assignment/creator visibility. These authorization contracts are not equivalent.

### Safe next design — no migration applied

Do not add a broad `finance.view` branch to the general `practice_resources` SELECT policy: that table contains full JSON payloads and a general REST read could expose more fields than the Finance pickers need.

Preferred candidate for a proof of concept is a **dedicated, minimal Finance directory projection** that exposes only the fields listed above and enforces workspace membership plus `finance.view` at the narrow read boundary. Before choosing its physical implementation (dedicated synchronized projection table versus another supported least-privilege pattern), confirm how case/client changes are written and synced so the projection cannot become stale or leak cross-workspace records. Do not create a view or table yet.

### Required acceptance matrix before rollout

1. Accountant with `finance.view` only: sees permitted directory rows and required picker fields in own workspace.
2. Advocate without `finance.view`: receives no directory data.
3. Authenticated non-member: receives no directory data.
4. User with access only to workspace A requests workspace B: receives no rows.
5. Admin in workspace A requests workspace B: receives no rows unless separately authorized for B.
6. Direct REST reads cannot return full case/client payloads through the new path.
7. Create/update/delete case and client records: directory projection remains synchronized, including linked-client IDs and case counts.
8. Existing invoice creation, payment, report, cancellation, and Accountant workflows remain green.
9. Repeat the real-browser RPC negative-path suite and full role/module regression after the change.
10. Re-query Security Advisor and document any remaining warnings; do not claim the six warnings are cleared unless the advisor confirms it.

### Workflow execution status

The available GitHub connector did not return a workflow run associated with commit `1350779199bd9bb4454591cd77cfbe755942d3bf`, and its commit-status endpoint returned no status checks. This is **not proof that GitHub Actions failed or passed**; the run status remains unverified. Open the repository's Actions tab and inspect “Real browser role and module regression” for the commit before treating the browser suite as rerun.

No Finance function body, grant, RLS policy, or application row was changed as part of this design step. QA only; production not accessed or changed.


## Data-sync dependency inspection — 2026-10-24

Read-only inspection of `resource-sync.js` confirms that the current app loads authorized records from `practice_resources` and persists resource-level insert/update/delete diffs through the existing atomic RPC (with a direct-write fallback for test doubles). Case and client payloads are therefore maintained by the shared resource sync path, not by a dedicated Finance projection today.

### Consequence for implementation

A separate projection table would require an explicit, tested synchronization design (ideally derived transactionally from the same write boundary) for every case/client insert, update, and delete, including client-case links and case counts. An independently updated projection risks stale Finance pickers and count mismatches. A broad SELECT RLS change on `practice_resources` is not acceptable because authenticated users already have SELECT privilege on that full-payload table and the policy is the primary data boundary.

**Decision:** do not create a projection table, view, trigger, new RPC, or RLS policy in this step. First identify the atomic sync RPC implementation and its write authorization, then prototype a narrow projection only on QA with automated sync consistency and authorization tests. No app source or database schema was changed during this inspection.
