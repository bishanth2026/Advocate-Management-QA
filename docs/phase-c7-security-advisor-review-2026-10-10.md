# Phase C7 — Live Supabase Security Advisor Review (2026-10-10)

**Environment:** isolated AdvocateDesk-Test project `uqtsksgypncsbcnuanbk`  
**Scope:** read-only Supabase Security/Performance Advisor inspection and function-definition review.  
**Production:** not accessed. No SQL writes, migrations, fixture seeds, or Auth changes were performed.

## Security Advisor findings

### 1. SECURITY DEFINER assignment RPCs callable by authenticated users — WARN

Supabase Security Advisor reported two functions as executable by the `authenticated` role:

- `public.assign_case_to_member(uuid,text,uuid)`
- `public.unassign_case_from_member(uuid,text,uuid)`

The definitions were inspected read-only. Both functions:
- reject requests without `auth.uid()`;
- require the caller to be an Admin member of the same active workspace;
- use the caller identity from `auth.uid()`, not a caller-supplied actor;
- write assignment audit records.

The assignment function additionally validates that the case exists in the selected workspace and that the target user is an active member of that workspace. The unassignment function deletes only the specified workspace/case/user assignment.

**ACL verification (read-only):** `information_schema.routine_privileges` returned `EXECUTE` grants for `authenticated`, `service_role`, and `postgres` on both functions. It returned no `anon` or `PUBLIC` grant rows for either function. This supports the conclusion that the RPCs are not directly executable by anonymous/PUBLIC roles under the inspected routine ACLs; it does not replace real JWT/API negative tests or rule out indirect exposure through other functions.\n\n**Assessment:** The Advisor warning is not by itself proof of an authorization bypass; these functions appear intentionally designed for authenticated Admin actions and include explicit checks. Do not blindly revoke authenticated EXECUTE because the application may depend on these RPCs. Test non-admin and cross-workspace calls with real JWTs, and consider a narrowly granted API design. Fixed `search_path` is present.

Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

### 2. Leaked-password protection disabled — WARN

Supabase Auth Advisor reports leaked-password protection is disabled. This is an Auth project setting, not a SQL migration. Enable it in the isolated QA project after confirming the current sign-in/password-reset flows are compatible, then verify the setting in the dashboard. Do not assume the warning has been fixed.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Performance Advisor

The Advisor reported nine indexes as unused, including indexes on `practice_records`, `case_documents`, `workspaces`, `case_assignments`, `workspace_audit_log`, and `practice_resources`.

**No indexes were removed.** Low row counts and limited workload can make a valid index appear unused. Revisit only after representative workload measurements and a separate index review.

## Existing release blockers remain

Read-only schema inspection confirms:
- `practice_resources` has 9 rows, but `case_assignments` has 0 rows.
- `practice_resource_revisions` is absent.
- `tasks.manage` is absent.
- The fixture identities/JWTs and live authorization matrix are not yet available.
- Transaction rollback and stale-revision/concurrency tests have not run against PostgreSQL.

Therefore this review does **not** approve the C7H/C7D/C7E drafts, persistence adapter cutover, or production deployment.

## Safe next actions

1. Review EXECUTE ACLs for the two assignment RPCs; establish that anonymous/PUBLIC callers are denied without disrupting authenticated Admin usage.
2. Run real JWT negative tests: anonymous, non-admin member, nonmember, cross-workspace case ID, and target user outside the workspace.
3. Enable leaked-password protection in QA and run sign-in/reset regression checks.
4. Provision dedicated disposable identities and run the documented read-only task visibility matrix.
5. Implement and test the transactional save/revision API only after authorization scope is independently reviewed.

## Latest CI and isolated Pages status\n\nFor commit `3e5c0e74bc3fb4c1295bfc9c85f73372f0adbc61` (`docs: record live QA security advisor findings`), GitHub Actions completed successfully:\n\n- [AdvocateDesk Test Validation — run 38038599552](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38038599552): syntax checks, resource-store unit tests, and static security contracts passed.\n- [AdvocateDesk Test Pages Deployment — run 38038599475](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38038599475): isolated QA Pages deployment workflow passed.\n\nThese are source/CI checks and a successful deployment workflow, **not** proof that live JWT/RLS authorization, browser workflows, or transactional persistence have passed.\n\n**Evidence boundary:** Advisor findings, routine ACL metadata, and SQL function definitions were read only. No finding has been marked remediated merely because the code contains checks.
