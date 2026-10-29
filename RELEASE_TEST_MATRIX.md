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
| AUTH-08 | Leaked-password protection | Supabase Auth setting is enabled and verified; compromised test password is rejected | BLOCKED: setting previously reported disabled; must enable and verify in Supabase Auth |

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
