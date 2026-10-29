# AdvocateDesk Production Release Test Matrix

Date: 2026-10-28  
Repository: `bishanth2026/Advocate-Management-QA`  
Target baseline: `production/advocatedesk-final`  
Release candidate: `release/advocatedesk-production-readiness`

## Purpose and current gate

This is an execution record for tests required before production approval. Static syntax/smoke checks passed in workflow run `40660002462`; they do not prove authenticated end-to-end behavior. Previously recorded QA evidence is preserved below; only the remaining unverified authenticated/live checks should be repeated. Do not enter real client/case data into test fixtures.

Current decision: **BLOCKED — do not deploy yet.** No production database or hosting configuration is changed by this file.

## A. Branch and build integrity

| ID | Test | Expected result | Evidence/status |
|---|---|---|---|
| BR-01 | Verify production branch SHA and workflow result | Tested commit matches intended release commit; workflow green | Existing static run passed; new release SHA not validated |
| BR-02 | Confirm production `auth.js`, `reset-password.html`, and `member-login.html` use production Supabase project | No QA project URL or QA branding in production bundle | Static smoke test previously passed; re-run on final candidate |
| BR-03 | Compare QA vs production application files | Every promoted change has a reviewed diff and regression test | BLOCKED: branches diverged; no bulk merge |
| BR-04 | Confirm hosting repository and publishing branch for `advocate.biznexco.in` | Live host serves the approved commit | BLOCKED: publishing source not verified |

## B. Authentication and sessions

Use dedicated, non-production test accounts. Never include passwords or access tokens in evidence.

| ID | Test | Expected result | Status |
|---|---|---|---|
| AUTH-01 | Super Admin sign-in | Correct privileged portal only; session profile validated | NOT RUN — real-session verification still required |
| AUTH-02 | Workspace Admin sign-in | Active workspace membership required; no accidental Super Admin access | PARTIAL PASS: prior real-browser regression recorded Admin login/navigation; repeat only if release candidate/auth code changed. |
| AUTH-03 | Advocate sign-in | Member route works; permissions are role-scoped | PARTIAL PASS: prior real-browser regression recorded Advocate login/navigation; latest candidate/session coverage still needs confirmation. |
| AUTH-04 | Staff / Accountant sign-in | Only permitted modules and records are visible | Accountant: prior real-browser regression recorded login/navigation (PARTIAL PASS). Staff: NOT VERIFIED; prior QA fixture did not include a Staff membership/account. |
| AUTH-05 | Invalid password / unknown account | Generic safe error; no sensitive account enumeration | NOT RUN |
| AUTH-06 | Password recovery and redirect | Recovery link returns to the approved domain and safely resets password | NOT RUN |
| AUTH-07 | Expired/revoked session | Protected pages and APIs deny access; user can reauthenticate | NOT RUN |
| AUTH-08 | Leaked-password protection | Supabase Auth setting is enabled and verified; compromised test password is rejected | USER REPORTS SETTING WAS CHANGED; latest security-advisor scans on 2026-10-29 still report disabled in BOTH QA and Production. Treat as NOT VERIFIED until the exact Auth setting is rechecked/saved in each project and advisor re-scan clears. |

## C. Workspace and case authorization

For every test, run both the allowed action and the negative action with distinct test users and workspaces.

| ID | Test | Expected result | Status |
|---|---|---|---|
| SEC-01 | Active workspace member reads own workspace | Only authorized workspace records returned | NOT RUN |
| SEC-02 | User attempts another workspace's records | Denied by server-side RLS/API, not just hidden in UI | PARTIAL PASS: prior browser regression recorded cross-workspace isolation and non-member denial; direct alternate-workspace authenticated-session coverage and current-candidate retest remain to be confirmed. |
| SEC-03 | Assigned advocate opens assigned case | Access allowed within granted role | PARTIAL PASS: prior browser regression recorded Advocate assignment flow; confirm case-scoped read behavior on current candidate. |
| SEC-04 | Assigned-only advocate opens unassigned case | Denied unless an explicit workspace-wide permission exists | PARTIAL PASS: earlier assignment/case-scope work exists; exact negative access case must be evidenced on the current candidate. |
| SEC-05 | Staff attempts admin-only action | Denied by server-side permission check | NOT RUN |
| SEC-06 | Client attempts direct table/RPC access outside policy | Denied | PARTIAL PASS: anonymous Finance RPC EXECUTE denied; prior authenticated Finance RPC/browser regression recorded. Direct authenticated table/RLS negative tests remain incomplete. |
| SEC-07 | Workspace membership suspended/revoked during session | Subsequent protected requests denied or revalidated | NOT RUN |
| SEC-08 | Assignment/unassignment audit | Correct actor, workspace, case, and target are logged without leaking unrelated data | NOT RUN |

## D. Finance, sync, and documents

| ID | Test | Expected result | Status |
|---|---|---|---|
| DATA-01 | Create/update case and client in QA | Save, refresh, and re-open preserve data | NOT RUN |
| DATA-02 | Cloud sync under each role | No 403/RLS error for allowed writes; denied writes remain denied | PARTIAL / OPEN: prior per-resource sync PR and GitHub Actions tests passed, but the historical 403/RLS error needs post-fix real-session save + refresh/persistence verification across roles. Do not repeat already-passed static/action tests absent regression. |
| DATA-03 | Invoice/payment records | Authorized accountant/admin can use allowed actions; other roles follow policy | NOT RUN |
| DOC-01 | Upload valid PDF/DOCX/PNG/JPEG within size limit | Upload succeeds and metadata matches stored object | NOT VERIFIED: policies reviewed, but real-session upload evidence is absent. |
| DOC-02 | Upload invalid type, spoofed MIME, or oversized file | Rejected server-side | NOT RUN |
| DOC-03 | User downloads document from assigned case | Authorized download only | NOT VERIFIED: storage policy review completed; real-session preview/download evidence is absent. |
| DOC-04 | User guesses another workspace's storage path | Download denied by storage policies | PARTIAL: storage policies inspected; real authenticated negative access test remains absent. |
| DOC-05 | Delete/revoke access and retry old URL | Access revoked or URL expires according to the approved policy | NOT RUN |
| UI-01 | Desktop and mobile portal navigation | No missing portal, blank screen, or unusable layout | NOT RUN |


## Previously confirmed QA evidence (do not repeat unless a regression is suspected)

These are partial-scope results recorded from earlier QA work. They are not a substitute for the pending real-session tests above.

| Area | Previously confirmed result | Boundary / remaining gap |
|---|---|---|
| Workspace state policy | `workspace_state` restrictive RLS check: PASS | Does not establish every table's policy or cross-workspace isolation. |
| Finance RPC | Anonymous EXECUTE denied: PASS | Authenticated role grants and direct API/table access still need negative tests. |
| Accountant Clients & Cases UI | Read-only UI accepted; Edit/Delete controls absent: PASS | Direct API mutation denial and refresh/cloud-sync behavior not confirmed. |
| Advocate/Staff portal | Portal route/static assertions PASS; earlier browser regression recorded Admin, Advocate, and Accountant login/navigation | Staff real-session evidence absent; verify role permissions and exact current release candidate rather than rerunning passed portal/static checks. |
| Production safety CI | Workflow `40660002462` passed syntax/static smoke checks: PASS | Not browser E2E, real auth, or deployment verification. |

## Fresh production-vs-QA RLS policy review — 2026-10-28

A read-only comparison of `pg_policies` on the connected production and QA databases found a material authorization gap that must be addressed before release:

- Production `case_documents` SELECT/DELETE policies currently check workspace membership; INSERT checks membership plus uploader identity. They do not call the QA-style `has_workspace_permission(..., 'documents.*')` and `can_access_case(...)` checks. Therefore case-scoped document authorization is not equivalent between production and QA.
- Production `practice_records` policies generally allow workspace members to select/insert/update/delete records (with creator identity on insert). QA has an additional restrictive `workspace_state` policy, while role-specific `practice_resources` policies enforce resource-type permissions and case scope. These models are not interchangeable.
- QA-only `case_assignments`, `role_permissions`, `practice_resources`, and `workspace_audit_log` policies depend on schema/helper functions that are not present in the inspected production table inventory. They cannot be copied as isolated policies.

**Required action:** design a minimal, ordered production-compatible migration set for case-scoped document access and required role/assignment infrastructure; inspect helper functions, grants, storage-object policies, and application compatibility; rehearse on an isolated staging database with positive and negative authenticated tests. Do not change production policies until the exact migration and rollback plan are reviewed and staging tests pass.

## E. Database migration safety

Do not apply QA migrations wholesale. Prepare a new, ordered, reviewed release migration set.

- [ ] Capture a production backup/export and verify a restore procedure.
- [ ] Reconcile actual production table/row counts with expected live data.
- [ ] Map dependencies from QA-only migrations to the production schema.
- [ ] Review each DDL, backfill, function, grant, RLS policy, and storage policy.
- [ ] Run migrations against an isolated staging copy first.
- [ ] Verify idempotency or document one-time execution requirements.
- [ ] Record rollback/forward-recovery steps and lock/downtime expectations.
- [ ] Confirm production app compatibility before scheduling the migration.

## Release approval checklist

Release may be approved only when all of these are evidenced:

- [ ] Final release candidate has a reviewed, narrow diff.
- [ ] Required automated checks pass on the exact candidate SHA.
- [ ] Authenticated end-to-end tests pass, including negative authorization tests.
- [ ] Migration set is tested on staging and backup/restore is verified.
- [ ] Leaked-password protection is enabled and verified.
- [ ] Live hosting source and deployed SHA are confirmed.
- [ ] Desktop/mobile smoke tests pass on the live deployment.
- [ ] Rollback owner, window, and recovery steps are agreed.

Until then the status remains **BLOCKED / NOT APPROVED FOR PRODUCTION**.


## QA follow-up review — 2026-10-29

A read-only QA Supabase security-advisor review returned:
- `auth_leaked_password_protection`: WARN; leaked-password protection is disabled. This requires an Auth configuration change and a subsequent verification; it was not changed by this review.
- `auth_rls_initplan`: WARN on `public.practice_resources_select_authorized`, which may re-evaluate auth/current-setting expressions per row. Treat as a performance optimization, not an authorization failure; benchmark and review the exact policy before changing it.
- Six unused-index INFO findings were returned. Do not drop indexes based solely on this advisory; confirm workload and query plans first.

A read-only inventory of QA `SECURITY DEFINER` functions found seven private functions still configured with `search_path = pg_catalog, public, private, pg_temp`: `assign_case_to_member`, `unassign_case_from_member`, `finance_case_directory`, `finance_case_directory_v2`, `finance_client_directory`, `finance_client_directory_v2`, and `qa_list_workspace_advocates_internal`. Their bodies use schema-qualified table/function references in the inspected definitions, but this alone is not sufficient to change them safely without verifying every referenced object and execution/grant behavior.

An attempted QA-only migration to set those seven functions' search paths to empty was blocked before execution. **No change to these seven functions is claimed.** Reassess function bodies, privileges, and application callers, then prepare a migration through the approved migration path and verify it after application.

### New status
- QA security-advisor scan: completed; findings documented above.
- Remaining seven QA function search paths: OPEN.
- Leaked-password protection: OPEN.
- Real authenticated session tests, cross-workspace denial tests, Cloud Sync 403 retest, storage access tests, backup/restore rehearsal, and live hosting SHA verification: OPEN.
- Production database/hosting changes: NONE.

Release remains **BLOCKED / NOT APPROVED FOR PRODUCTION**.


## Historical browser regression evidence reconciliation — 2026-10-29

The previous matrix understated some work already completed. Based on earlier recorded QA results, the following are **partial passes**, not wholly unrun: real-browser Admin, Advocate, and Accountant login/navigation; non-member denial; cross-workspace isolation; authenticated Finance RPC checks; Advocate assignment/unassignment and denial of cross-workspace Admin assignment. These earlier browser regression results were recorded on 2026-10-24. Do not rerun those same checks solely because this matrix was updated; rerun only if the tested code/candidate changed or the evidence does not identify the exact tested SHA.

Important limits:
- Staff real-session access was not evidenced; the earlier QA fixture did not have a Staff membership/account.
- The earlier cross-workspace result does not prove every direct alternate-workspace API/table path is denied on the current release candidate.
- Storage policies were inspected, but authenticated document upload/preview/download/delete and guessed-path denial were not evidenced as real-session tests.
- Per-resource sync PR / GitHub Actions checks passed, but the previous Cloud Sync 403/RLS error still needs post-fix authenticated save + refresh/persistence verification for relevant roles.
- Production release remains blocked by the production-vs-QA authorization design gap, leaked-password protection, unverified hosting SHA, and outstanding release checks.


## Latest tester-reported manual results — 2026-10-29

The tester supplied screenshots and reported the following actions on the QA site:
- Admin dashboard and Clients & Cases / Case 360 pages opened.
- Accountant role and Finance page opened.
- Assigned Advocate dashboard and Documents page opened.
- The Documents list showed the `identity` image and two other files; the count increased from 2 to 3 after upload.
- The tester confirmed Preview / Download opened the `identity` image.
- The tester refreshed the page, then logged out, logged in again, and refreshed; the document list remained present.
- The tester stated Staff login and cross-workspace access denial were checked and were OK.

These are recorded as tester-reported manual PASS results for the visible flows. They are **not** treated as independent API/security verification because the evidence supplied does not include request/response traces, identity/workspace IDs, or a Staff-specific screenshot. The document list surviving re-login proves visible document metadata persistence for this session, not that the historical case/client 403/RLS write path works for every role.

| ID | Latest result | Remaining proof |
|---|---|---|
| AUTH-04 Staff | Tester-reported PASS | Capture a Staff-specific session/role view and verify restricted actions through API/RLS. |
| SEC-02 Cross-workspace | Tester-reported PASS | Authenticated negative API test against a known different workspace; confirm zero rows/403 without leaking data. |
| DOC-01 Upload | Manual PASS reported; screenshot shows 3 files | Verify allowed type/size and storage metadata with API evidence. |
| DOC-03 Preview/download | Tester-reported PASS; image opened in browser tab | Verify Storage API response and authorization on a distinct account. |
| DATA-02 Cloud Sync | Partial manual PASS for document list across refresh/re-login | Still must test a case/client/practice-record save → refresh → reopen after the historical 403/RLS issue, using each relevant role and capturing API response. |

No additional automated/browser session was run by the assistant in this update. The above results were transcribed from the tester's screenshots and statements. Production database, authentication settings, storage objects, and live hosting remain unchanged. Release status remains **BLOCKED / NOT APPROVED FOR PRODUCTION**.


## Cloud Sync case/client persistence retest — 2026-10-29

The tester reported that the Cloud Sync case/client save-and-reopen check was performed. The supplied screenshot corroborates that the QA app displayed **“Cloud: Synced”** and that the All Cases list rendered multiple case records, including the test case. This is useful manual evidence that the app currently displays synced case-list data.

| ID | Latest result | Evidence boundary / remaining proof |
|---|---|---|
| DATA-01 Case/client persistence | **Tester-reported manual check; screenshot corroborates synced case list (PARTIAL PASS)** | Screenshot does not show the edited field/value before and after save, nor the exact record reopened after a hard refresh. Keep as tester-reported rather than independently verified. Capture a harmless QA-only field change, save, hard refresh, reopen the same record and confirm the changed value persists. |
| DATA-02 Cloud Sync 403/RLS | **MANUAL PASS — tester confirms Save → successful API response → Refresh → Reopen completed** | User-confirmed completed flow. The previous screenshot corroborates the synced QA state. Keep any redacted API/Network evidence with QA release records if available; do not repeat this exact test unless the candidate code changes or a regression appears. This does not independently certify every role/resource or production behavior. |

No production data or settings were changed. This screenshot does not independently establish API-level authorization or prove that all role-specific write paths are fixed. Release remains **BLOCKED / NOT APPROVED FOR PRODUCTION**.


## Follow-up engineering review — 2026-10-29

### Latest static validation

- Release-readiness commit: `2cff81e5da56fd0b1b896b16b7e158b11af31312`.
- GitHub Actions workflow run `40803918611`: completed successfully.
- Scope: production safety/static validation only; it is not authenticated browser E2E, RLS negative testing, or proof of the deployed live SHA.

### Fresh Supabase security-advisor recheck

Read-only advisor calls were run against both connected projects:
- QA `uqtsksgypncsbcnuanbk`: `auth_leaked_password_protection` WARN; disabled.
- Production `ykxfidrtvmkmmbxameji`: `auth_leaked_password_protection` WARN; disabled.

This setting is an Auth configuration item, not a SQL/RLS migration. It has not been changed by this review because the available Supabase actions do not expose a verified Auth-settings update operation. It remains a release blocker and must be enabled in Supabase Auth settings, then rechecked with the advisor.

### Cloud-save source review

Read-only comparison of `app.js` on QA `main` and production `production/advocatedesk-final` found that both save handlers invoke `window.ADCloudSync.save(state)` asynchronously and surface a failure through a catch handler. This does not by itself prove the reported 403 defect, but it means a rendered list or sync indicator must not be treated as proof that a particular mutation persisted. The sync implementation and its role-specific table writes need to be traced before a code patch is selected; no speculative change was made to either application bundle.

### Current action decision

- Do not merge PR #36: it is a draft readiness/documentation PR, not a tested production code release.
- Do not apply QA-only schema or policies to Production.
- Next required proof remains: authenticated case/client/practice-record write → successful network response (no 403) → hard refresh → reopen same record; direct negative authorization checks; Auth leaked-password protection enabled; migration rehearsal; and live hosting branch/deployed SHA confirmation.

No production application code, database schema/data, Auth setting, storage object, or hosting configuration was changed during this review. Release remains **BLOCKED / NOT APPROVED FOR PRODUCTION**.


## Follow-up security work — 2026-10-29

### Leaked-password protection status reconciliation
The tester reports that leaked-password protection was changed. However, fresh Supabase security-advisor scans run on 2026-10-29 still returned `auth_leaked_password_protection: WARN` for both QA project `uqtsksgypncsbcnuanbk` and Production project `ykxfidrtvmkmmbxameji`. The setting is therefore **not verified as enabled**. Recheck/save the Auth password-security setting separately in each project, then rerun the advisor. No Auth configuration was changed by this check.

### Additional QA-only SECURITY DEFINER hardening
Applied migration to QA project `uqtsksgypncsbcnuanbk`:
- Migration: `qa_harden_remaining_private_definer_search_paths_20261029`
- Repository source on QA `main`: `supabase/migrations/20261029074800_qa_harden_remaining_private_definer_search_paths.sql`
- Functions: `private.assign_case_to_member`, `private.unassign_case_from_member`, `private.finance_case_directory`, `private.finance_case_directory_v2`, `private.finance_client_directory`, `private.finance_client_directory_v2`, `private.qa_list_workspace_advocates_internal`.
- Change: each function's `search_path` set to empty; function bodies and ACLs were not changed.
- Post-migration read-only verification: all seven remain `SECURITY DEFINER` and report empty `search_path`.
- Scope: QA only. No production function, policy, data, Auth setting, or hosting configuration was changed.

This is a targeted configuration hardening step, not proof that all authorization logic or app flows pass. Run the existing QA assignment, finance directory, and role access regression checks before promoting any equivalent change. Do not copy this migration into production without checking production function inventory and dependencies.


### Cloud Sync 403/RLS retest — tester confirmation (2026-10-29)

The tester has now confirmed the Cloud Sync case/client save-and-reopen check was completed and is considered successful. The latest supplied dashboard screenshot also shows **Cloud: Synced** and the active QA Assigned Advocate workspace.

- **Tester-reported result:** PASS for the manual save/reopen check.
- **Screenshot corroboration:** Cloud sync status is green and dashboard loads with workspace data.
- **Evidence limitation:** The screenshot itself is a dashboard view; it does not show the changed field before/after save or an HTTP response. Therefore record this as **manual tester-confirmed PASS, with screenshot corroboration**, not independently verified API-level proof.
- **Remaining release evidence:** If not already captured, retain a redacted Network trace or explicit save result showing no 403 for the same record, and repeat the save/refresh/reopen check for relevant roles/resources (case, client, practice record).
- **Production status:** No production database, Auth setting, RLS policy, or hosting configuration was changed by this retest. Production release remains blocked pending the remaining release gates.


### Supabase post-migration verification — QA only (2026-10-29)

After applying `qa_harden_remaining_private_definer_search_paths_20261029`, a fresh read-only query against QA project `uqtsksgypncsbcnuanbk` confirmed all seven target functions remain `SECURITY DEFINER` and each now has an empty `search_path`:
`assign_case_to_member`, `unassign_case_from_member`, `finance_case_directory`, `finance_case_directory_v2`, `finance_client_directory`, `finance_client_directory_v2`, and `qa_list_workspace_advocates_internal`.

This resolves the prior QA function search-path configuration item. It does **not** verify runtime behavior; run the QA assignment and finance directory regression flows before considering promotion. No equivalent change was applied to Production.

### Release gate reconciliation

- Cloud Sync 403/RLS: **manual tester-confirmed PASS** for the save/reopen check; screenshot corroborates synced dashboard/list. API-level response evidence remains a recommended retained artifact.
- QA private SECURITY DEFINER search paths: **configuration PASS** after migration and read-only post-check; role/assignment/finance regression tests still required.
- Leaked-password protection: user reports the setting was changed, but fresh advisor scans still return WARN for QA and Production. **Not verified**; check/save the Auth setting in each project and rerun advisor.
- Production-vs-QA RLS and Storage policy mismatch: **OPEN — design/rehearsal required**; no Production migration applied.
- Live hosting source/deployed SHA: **OPEN**.
- Release decision: **BLOCKED / NOT APPROVED FOR PRODUCTION** until the independent gates above are evidenced.


## Release continuation — 2026-10-29 (fresh tool verification)

### Automated candidate checks
- Workflow `AdvocateDesk Production Safety Validation`, run `40806376444`: **SUCCESS** on commit `41ea4fd3e49d1e054636bb95c68deebf8a797ec6`.
- Job `Production safety and syntax checks`: successful steps included authentication syntax, application syntax, and production safety smoke checks.
- Scope limit: this is static/smoke validation only. It does not establish browser E2E, authenticated role/session behavior, real Storage authorization, or live deployment.

### Fresh Supabase comparison
- QA migration history contains role permissions, case assignments, practice resources, finance directory, and additional hardening migrations that are not present in Production migration history.
- Production migration history currently ends with the case-document/storage baseline and index optimization; QA-only migration history must not be replayed wholesale.
- QA `case_documents` SELECT/INSERT/DELETE policies enforce document permissions and case access; QA Storage read/delete policies join object paths to `case_documents` metadata and enforce document permission plus case access.
- Production `case_documents` and `storage.objects` policies still use workspace membership/path-based checks rather than the full QA case-scoped permission model. This is a material authorization difference.
- QA has `case_assignments`, `role_permissions`, `practice_resources`, and `workspace_audit_log`; the inspected Production schema does not have these tables. A compatible migration/backfill and application compatibility review is required before promoting dependent authorization rules.
- Fresh Security Advisor scans still report `auth_leaked_password_protection` WARN for both QA and Production. The setting is not confirmed fixed.

### Release gate update
- [x] Static syntax and production safety smoke checks passed on the earlier validated candidate commit `41ea4fd3e49d1e054636bb95c68deebf8a797ec6` (workflow run `40806376444`).
- [ ] Re-run/confirm CI for the latest release-branch documentation commit before treating that SHA as validated; the GitHub combined status lookup returned no status entries.
- [x] Read-only Production/QA migration, schema, and key RLS policy comparison refreshed.
- [ ] Leaked-password protection enabled and verified independently in QA and Production.
- [ ] Production-compatible schema/dependency plan reviewed; no wholesale QA migration replay.
- [ ] RLS/Storage migration rehearsed on isolated staging with authenticated positive and negative tests.
- [ ] Admin, Advocate, Staff, Accountant role-specific regression on the candidate SHA; Cloud Sync Save → API response → Refresh → Reopen is already tester-confirmed PASS for the tested QA flow, so do not repeat it unless code changes/regression occur. Verify only any still-untested role/resource paths.
- [ ] Production backup/restore rehearsal completed.
- [ ] Live hosting repository/branch/deployed SHA verified.
- [ ] Desktop/mobile smoke tests and rollback plan approved.

**Current decision remains BLOCKED / NOT APPROVED FOR PRODUCTION.** No Production database, Auth setting, Storage policy/object, or hosting configuration was changed during this continuation.


### Cloud Sync sequence completion update — 2026-10-29

The tester explicitly confirmed that the requested sequence is complete: **Save → API response → Refresh → Reopen**. Update DATA-02 from partial to **manual tester-confirmed PASS** for the tested QA record/flow. Do not ask the tester to repeat the same check absent a code change or regression.

Scope boundary: this confirms the reported manual QA flow only; it does not establish every role/resource path or prove production behavior. The independent production release blockers remain unchanged: leaked-password protection still needs advisor verification, Production/QA schema and RLS/Storage differences need a reviewed staging rehearsal, backup/restore and hosting SHA checks remain open. No Production setting or database was changed.


### Focused release gate re-check — 2026-10-29

Only the six requested release areas were re-checked; completed Cloud Sync was not repeated.

1. **Leaked-password protection — BLOCKED.** Fresh Security Advisor responses still report `auth_leaked_password_protection` WARN in both `AdvocateDesk-Test` (QA, `uqtsksgypncsbcnuanbk`) and `Advocate_Management` (Production, `ykxfidrtvmkmmbxameji`). The connected tools available in this session expose project inspection and SQL/migration operations, but no Auth password-security settings update action. No SQL workaround is safe or appropriate for this Auth-level setting. It must be enabled in each project's Supabase Auth settings and then rechecked in Advisor.
2. **RLS/Storage compatibility — BLOCKED, migration not applied.** Read-only policy inspection confirms QA document policies enforce `documents.view/upload/delete` and case access; Production document policies currently permit workspace-member access. QA Storage reads/deletes verify matching `case_documents` metadata and case permissions; Production Storage policies use workspace-folder membership checks. QA also contains `case_assignments`, `role_permissions`, `practice_resources`, and `workspace_audit_log`, absent from inspected Production migration history/schema. A direct policy transplant would reference missing dependencies and risk locking out or exposing records; no migration was applied. Rehearsal must use an isolated disposable/staging database with compatible schema/backfill and positive/negative authenticated tests first.
3. **Staging/rollback — NOT VERIFIED.** No isolated disposable staging branch is currently listed for Production, and no migration/rollback rehearsal evidence exists. Do not run QA migrations wholesale against Production.
4. **Backup/restore — NOT VERIFIED.** No restorable backup artifact or successful isolated restore evidence is available through the connected tools. Do not claim a backup/restore pass.
5. **Hosting/deployed SHA — NOT VERIFIED.** The production PR #35 is merged at `ee166de86b33d5eb54d0c1c2de3ca4da65063729`, but a GitHub merge is not proof of deployment. Direct live-domain verification was unavailable through the current web check; hosting provider/project and deployed SHA remain unconfirmed.
6. **Role-specific/browser checks — PARTIAL.** Existing user-reported QA passes remain recorded. Production Supabase currently has the `advocatedesk-provision-user` function active with JWT verification enabled. The two password-recovery functions are active with platform JWT verification disabled; source inspection shows generic responses and server-side role/membership checks, but rate-limit/abuse behavior and live browser tests remain unverified. Do not mark the final role/security/mobile suite complete until authenticated tests run against the actual deployed candidate.

**Decision: NO-GO / BLOCKED.** No Production DB schema, RLS, Storage, Auth setting, or hosting configuration was changed. Completed Cloud Sync remains tester-confirmed PASS for the tested QA flow and is not a remaining task.


## User-confirmed QA functional test reconciliation — 2026-10-29

The user confirms that the following functional checks have already been executed and passed on the tested QA app. These are recorded as **user-confirmed manual PASS** and should not be repeated unless the tested code changes or a regression is suspected:

| Area | User-confirmed result | Scope note |
|---|---|---|
| Login | Super Admin, Admin, Advocate, Staff, Accountant | Manual QA pass reported by user. |
| Data Save | Client, Case, Documents, Finance | Manual QA pass reported by user. |
| Data Persistence | Data remains after refresh and logout/login | Manual QA pass reported by user. |
| Cloud Sync | Saved data successfully stored server-side | Manual QA pass reported by user; the previously confirmed Save → API response → Refresh → Reopen flow is not to be repeated without regression. |
| Permissions | Each role sees/changes only permitted information | Manual QA pass reported by user. |
| Document Storage | Upload, preview, download, delete according to permissions | Manual QA pass reported by user. |
| Error Handling | Invalid input, network failure, unauthorized access | Manual QA pass reported by user. |
| Desktop/Mobile | Login, navigation, save on both form factors | Manual QA pass reported by user. |

These results supersede earlier matrix rows that marked the same general functional flows as wholly unrun, but they do not constitute independent network/API traces or prove that the live Production deployment is running the same candidate SHA. Keep them as user-confirmed QA results and avoid asking for the same checks again absent a code change.

## Release-scope decisions — 2026-10-29

- **Backup/restore rehearsal:** deferred by explicit user decision because all current data is demo/test data and the user does not require a restore exercise for this stage. This is not recorded as a completed restore test. Before storing real customer data, establish a backup and verified recovery process.
- **Leaked-password protection:** user explicitly decided not to address QA or Production leaked-password protection during the current scope. Record this as an accepted exception for this work, not as fixed or enabled. No setting change is claimed.
- **No Production changes:** no Production schema, RLS/Storage policies, Auth settings, or hosting configuration were changed by this reconciliation.

## Current release decision

The user-confirmed QA functional tests above are treated as passed and should not be repeated unnecessarily. Static/syntax smoke workflow run `40807138835` on release candidate `d2d26c008cee149bbd7c39b2290c94e7e04d8b51` completed successfully. This workflow is not a browser E2E or deployment proof.

**Production release remains BLOCKED / NOT APPROVED** until the material Production-vs-QA RLS/Storage/schema compatibility gap is resolved safely and rehearsed, and the live hosting source/deployed SHA is verified. Do not merge draft PR #36 as a deployment action and do not replay QA migrations wholesale into Production.


## Fresh Production RLS/Storage and deployment verification — 2026-10-29

### Verified current state (read-only)

- Production Supabase project `ykxfidrtvmkmmbxameji` is `ACTIVE_HEALTHY` in `ap-southeast-1`; QA project `uqtsksgypncsbcnuanbk` is `ACTIVE_HEALTHY` in `ap-south-1`.
- Production migration history contains 7 migrations; QA migration history contains 41. Do not replay QA migrations wholesale.
- Production `public.case_documents` has only workspace-membership SELECT/DELETE checks and workspace-member + uploader INSERT checks. These do not enforce the QA permission/case-scope model.
- Production `storage.objects` policies for `advocatedesk-documents` allow workspace-member access based on the first object-path folder; they do not require a matching `case_documents.storage_path` row and case-scoped permission.
- QA document metadata policies use `private.has_workspace_permission(..., 'documents.view/upload/delete')` plus `private.can_access_case(...)`; QA Storage SELECT/DELETE policies require matching metadata and case access. These helpers and the role/assignment tables are not all present in Production.
- Production bucket `advocatedesk-documents` is private, capped at 20 MiB, and permits PDF, DOCX, JPEG, PNG. This configuration is retained; it does not compensate for the policy mismatch.
- Production branch `production/advocatedesk-final` is currently at SHA `cbad19fad0a1bdfa7f68caddccbf38aeb190420b`. Its repository contains `CNAME` set to `advocate.biznexco.in`, and its `login.html` contains Super Admin, Admin, and Advocate & Staff portal links. The `member-login.html` file exists in that branch.
- The live domain could not be fetched with the available web checker, and the GitHub Pages publishing configuration/deployed SHA could not be queried through the available connector. Therefore the CNAME and branch contents are **not proof** that the live host serves this SHA.
- Latest release documentation SHA `9a2c75367ab59488e3ce07d30750a61ea24b226e` has workflow run `40807935978` (run #49) completed successfully. Its job passed authentication syntax, application syntax, and production safety smoke checks only. It does not test browser E2E, database policies, or live deployment.

### Required safe RLS/Storage remediation

Do not apply the current `supabase/drafts/secure-documents-storage.sql` policy design as a Production fix: it is explicitly draft-only and only checks workspace membership. The correct change needs to reconcile Production schema with the QA authorization model, including case assignment, role permission definitions, helper functions, document metadata and storage-object paths. Implement this as a small, ordered, Production-compatible migration after reviewing all dependencies and existing records. Preserve private bucket settings and add positive and negative tests for workspace and case access, guessed object paths, upload, preview/download and delete.

An isolated Production-schema staging branch is not currently present in the connected Supabase project. Creating one previously returned a confirmed estimate of **US$0.01344/hour**. No branch was created because explicit cost approval has not yet been given. Until the user approves this cost or an equivalent isolated Production-schema test environment is supplied, the migration cannot be safely rehearsed. No Production SQL, RLS/Storage policy, Auth setting, or data has been changed.

### Scope decisions retained

- Backup/restore rehearsal is deferred by the user's explicit decision because current data is demo/test data. This is not a restore pass.
- Leaked-password protection remains an accepted exception by the user's explicit decision for this scope. The advisor still reports it disabled; no change is claimed.
- The user-confirmed manual QA functional checks are recorded as PASS and should not be repeated unless code changes or a regression is suspected.

### Final gate

**NO-GO / NOT APPROVED FOR PRODUCTION** until the Production-compatible RLS/Storage migration is rehearsed in an isolated Production-schema environment with authenticated positive/negative tests, and the actual live hosting source/deployed SHA is verified. Do not merge draft PR #36 as a deployment trigger. No Production application, database, Auth, Storage or hosting changes were made in this verification.
