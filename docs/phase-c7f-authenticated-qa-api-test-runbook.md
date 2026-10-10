# Phase C7F — Authenticated QA API Test Runbook

**Scope:** AdvocateDesk QA only. Do not use production URL, production keys, or production accounts.  
**Status:** prepared; tests requiring real user sessions have not been executed.

## Why this runbook is necessary

GitHub Actions checks repository files and deployment. They do not authenticate as each workspace role, prove RLS behavior through PostgREST, or validate concurrent database transactions. The linked QA project has no test evidence yet from real authenticated JWT sessions. Do not treat SQL editor queries as a substitute for those tests.

## Safety setup

1. Open the QA deployment only and confirm its Supabase project is `uqtsksgypncsbcnuanbk`.
2. Use dedicated QA users in a disposable test workspace. Never paste access tokens, refresh tokens, passwords, service-role keys, or private document URLs into a GitHub issue or chat.
3. Prepare users with these exact cases: active Admin; assigned Advocate; unassigned Advocate; Accountant; active workspace non-member; inactive-workspace member; anonymous client.
4. Seed one harmless case and one resource of each currently supported type needed by the permission matrix. Record initial row counts and revision before every mutation test.
5. Keep the current legacy `practice_records.workspace_state` save path enabled. Do not turn on resource-store cutover during this run.

## Authenticated PostgREST tests

Run requests from the browser QA session or a local trusted test harness using the QA project's public anon key and each test user's own access token. Keep secrets local. For each role, use the REST endpoint `/rest/v1/practice_resources` and the documented application RPC endpoints.

| Test | Expected result |
|---|---|
| Anonymous SELECT of protected resources | Denied or no rows, per API policy; never leak another workspace |
| Active Admin reads own workspace resources | Only that workspace |
| Assigned Advocate reads assigned case | Allowed only where current role policy permits |
| Unassigned Advocate reads another case | Denied/no rows |
| Accountant reads permitted finance resources | Allowed for finance resources only |
| Workspace non-member queries known workspace UUID | Denied/no rows |
| User submits another workspace's UUID in a write | Denied |
| Non-admin calls assign/unassign case RPC | SQLSTATE 42501 / authorization failure |
| Admin assigns active member to same-workspace case | Success and audit row |
| Admin tries to assign a non-member | Rejected, no assignment/audit mutation |
| Anon invokes private authorization helper | Execute permission denied |

Record status code, response body with personal data removed, test role, timestamp, and before/after counts. Do not mark a test passed merely because the UI hid a button; the API result is authoritative.

## Transactional-save acceptance tests (must wait for a reviewed RPC)

These cannot be passed until a save RPC exists in QA and has been reviewed. Do not simulate success using several browser requests.

- Successful transaction: all mutations commit and revision increments exactly once.
- Fault injection: force a later mutation to violate a constraint; verify earlier mutation and revision both roll back.
- Stale revision: two clients start at revision N; first succeeds to N+1; second using N receives a conflict and changes nothing.
- Duplicate mutation key, unknown type, oversized payload, invalid case/workspace relationship, and unauthorized delete each fail without partial writes.
- Move between case scopes: authorization must validate both the prior and new scope.
- Retry: reload at the latest revision and retry; verify no duplicate rows.
- Confirm documents continue using `case_documents` and private Storage, not the generic resource RPC.

## Evidence required to close this gate

Attach a redacted test log showing all roles and expected outcomes, before/after counts, and SQLSTATE/status. Then re-check function definitions and ACLs. Only after all tests pass should a migration be considered for QA. Production deployment remains a separate decision and is out of scope.
