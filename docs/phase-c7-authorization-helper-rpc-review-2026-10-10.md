# Phase C7 — Authorization Helper and RPC Review (2026-10-10)

**Environment:** isolated QA Supabase project `uqtsksgypncsbcnuanbk`  
**Branch:** `staging/advocatedesk-test`  
**Review type:** read-only function-definition inspection. No SQL writes or production access.

## CI and Pages status

For commit `916e2ecc1c1b6a5fa20af3efeefb7dc7a46eae74`:

- Validation passed: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38045328425
- QA Pages deployment passed: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38045328398

These prove the configured CI checks and Pages deployment completed. They do not prove live RLS, Auth JWT, transactional rollback/concurrency, or browser acceptance.

## Helper-function definitions inspected

Read-only `pg_get_functiondef` inspection covered:

- `private.has_workspace_permission(uuid,text)`
- `private.can_access_case(uuid,text)`
- `private.is_workspace_member(uuid)`
- `public.assign_case_to_member(uuid,text,uuid)`
- `public.unassign_case_from_member(uuid,text,uuid)`

### Observed positive controls

- The three private helpers return false when `auth.uid()` is null (the member helper evaluates membership using `auth.uid()`).
- Permission and case-access helpers require an active workspace.
- `can_access_case` grants the workspace Admin exception, otherwise checks a matching case assignment joined to workspace membership.
- Assignment RPCs reject unauthenticated callers and require the actor to be an Admin of the active workspace.
- The assignment RPC validates the target member and case against the same workspace and writes an audit event when it changes an assignment.
- Both assignment RPCs use a fixed search path of `public, private, pg_temp`; review this alongside explicit schema qualification and function grants.

### Remaining security questions

1. **Function EXECUTE exposure:** Supabase Security Advisor previously flagged both assignment RPCs for `authenticated_security_definer_function_executable`. The function bodies contain Admin checks, but the effective ACL/grant surface still needs an explicit, documented review. Do not revoke `authenticated` blindly because the UI may call these RPCs.
2. **Definer-function hardening:** verify ownership, EXECUTE ACLs for `PUBLIC`, `anon`, `authenticated`, and `service_role`, and confirm no overload has a broader grant. Preserve fixed search paths and fully qualified object references.
3. **Membership semantics:** `has_workspace_permission` gives any active workspace Admin a permission result of true without a `role_permissions` row. This is a deliberate superuser-like rule and must be reflected in test expectations.
4. **Resource type drift:** current generic resource policies use a permission mapping per resource type. Any new transactional RPC must match these semantics or intentionally document and test a change.
5. **Case moves:** a transactional save must authorize the existing row's old scope and the proposed row's new scope; checking only the new `case_id` is insufficient.
6. **Atomicity and stale writes:** none of the inspected helper functions supplies a workspace revision lock or atomic multi-resource save. The transactional RPC remains unimplemented.

## Required next verification

- Query `pg_proc`, `pg_namespace`, `pg_roles`, and `aclexplode(coalesce(proacl, acldefault('f', proowner)))` to capture the effective function ACLs, including PUBLIC.
- Inspect all overloads, dependent grants, and app call sites before changing EXECUTE privileges.
- Prepare a role-by-operation matrix for Admin, assigned Advocate, unassigned Advocate, Accountant, nonmember, and anonymous requests.
- Review the full C7H policy diff against currently deployed policies before any migration. The C7H draft is still **not approved to apply**.
- Use disposable Auth identities and local-only JWTs for live authorization tests. Run forced failure and two-client stale-revision tests against PostgreSQL, not just the JavaScript reference model.

## Gate decision

**Continue read-only review. Do not apply C7H, create live fixtures, change grants, create a privileged save RPC, cut over the app, or modify production** until the ACL review and real JWT/transaction acceptance plan are complete.
