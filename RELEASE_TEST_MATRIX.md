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
| AUTH-02 | Workspace Admin sign-in | Active workspace membership required; no accidental Super Admin access | NOT RUN — real-session verification still required |
| AUTH-03 | Advocate sign-in | Member route works; permissions are role-scoped | Portal route/static smoke assertion PASS; real sign-in NOT VERIFIED |
| AUTH-04 | Staff / Accountant sign-in | Only permitted modules and records are visible | Portal route/static smoke assertion PASS; real sign-in NOT VERIFIED |
| AUTH-05 | Invalid password / unknown account | Generic safe error; no sensitive account enumeration | NOT RUN |
| AUTH-06 | Password recovery and redirect | Recovery link returns to the approved domain and safely resets password | NOT RUN |
| AUTH-07 | Expired/revoked session | Protected pages and APIs deny access; user can reauthenticate | NOT RUN |
| AUTH-08 | Leaked-password protection | Supabase Auth setting is enabled and verified; compromised test password is rejected | BLOCKED: setting previously reported disabled; must enable and verify in Supabase Auth |

## C. Workspace and case authorization

For every test, run both the allowed action and the negative action with distinct test users and workspaces.

| ID | Test | Expected result | Status |
|---|---|---|---|
| SEC-01 | Active workspace member reads own workspace | Only authorized workspace records returned | NOT RUN |
| SEC-02 | User attempts another workspace's records | Denied by server-side RLS/API, not just hidden in UI | NOT RUN |
| SEC-03 | Assigned advocate opens assigned case | Access allowed within granted role | NOT RUN |
| SEC-04 | Assigned-only advocate opens unassigned case | Denied unless an explicit workspace-wide permission exists | NOT RUN |
| SEC-05 | Staff attempts admin-only action | Denied by server-side permission check | NOT RUN |
| SEC-06 | Client attempts direct table/RPC access outside policy | Denied | PARTIAL PASS: anonymous Finance RPC EXECUTE denied; direct authenticated table/RPC negative tests NOT RUN |
| SEC-07 | Workspace membership suspended/revoked during session | Subsequent protected requests denied or revalidated | NOT RUN |
| SEC-08 | Assignment/unassignment audit | Correct actor, workspace, case, and target are logged without leaking unrelated data | NOT RUN |

## D. Finance, sync, and documents

| ID | Test | Expected result | Status |
|---|---|---|---|
| DATA-01 | Create/update case and client in QA | Save, refresh, and re-open preserve data | NOT RUN |
| DATA-02 | Cloud sync under each role | No 403/RLS error for allowed writes; denied writes remain denied | NOT RUN — prior QA Cloud Sync 403/RLS error requires real-session retest after policy fix |
| DATA-03 | Invoice/payment records | Authorized accountant/admin can use allowed actions; other roles follow policy | NOT RUN |
| DOC-01 | Upload valid PDF/DOCX/PNG/JPEG within size limit | Upload succeeds and metadata matches stored object | NOT RUN |
| DOC-02 | Upload invalid type, spoofed MIME, or oversized file | Rejected server-side | NOT RUN |
| DOC-03 | User downloads document from assigned case | Authorized download only | NOT RUN |
| DOC-04 | User guesses another workspace's storage path | Download denied by storage policies | NOT RUN |
| DOC-05 | Delete/revoke access and retry old URL | Access revoked or URL expires according to the approved policy | NOT RUN |
| UI-01 | Desktop and mobile portal navigation | No missing portal, blank screen, or unusable layout | NOT RUN |


## Previously confirmed QA evidence (do not repeat unless a regression is suspected)

These are partial-scope results recorded from earlier QA work. They are not a substitute for the pending real-session tests above.

| Area | Previously confirmed result | Boundary / remaining gap |
|---|---|---|
| Workspace state policy | `workspace_state` restrictive RLS check: PASS | Does not establish every table's policy or cross-workspace isolation. |
| Finance RPC | Anonymous EXECUTE denied: PASS | Authenticated role grants and direct API/table access still need negative tests. |
| Accountant Clients & Cases UI | Read-only UI accepted; Edit/Delete controls absent: PASS | Direct API mutation denial and refresh/cloud-sync behavior not confirmed. |
| Advocate/Staff portal | Portal route and static production-safety assertions: PASS | Actual Advocate/Staff account sign-in, role session, and permitted operations not confirmed. |
| Production safety CI | Workflow `40660002462` passed syntax/static smoke checks: PASS | Not browser E2E, real auth, or deployment verification. |

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
