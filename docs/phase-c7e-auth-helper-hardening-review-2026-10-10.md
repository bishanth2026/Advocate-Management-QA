# Phase C7E — QA authorization-helper hardening review

**Environment:** isolated QA project `uqtsksgypncsbcnuanbk` and branch `staging/advocatedesk-test` only.  
**Status:** source draft only; not applied to the database.

## CI status

The commit adding the draft completed both GitHub workflows successfully:
- Validation: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38032974492
- QA Pages: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38032974393

These workflows validate the repository pipeline, not database execution or JWT authorization behavior.

## Live QA inspection

Read-only SQL inspection found the following application-owned SECURITY DEFINER functions:

| Function | Current search_path | anon EXECUTE | authenticated EXECUTE |
|---|---|---:|---:|
| private.can_access_case(uuid,text) | public, private, pg_temp | no | yes |
| private.has_workspace_permission(uuid,text) | public, private, pg_temp | no | yes |
| private.is_workspace_member(uuid) | empty | no | yes |
| private.is_workspace_owner(uuid) | empty | no | yes |
| public.assign_case_to_member(uuid,text,uuid) | public, private, pg_temp | no | yes |
| public.unassign_case_from_member(uuid,text,uuid) | public, private, pg_temp | no | yes |

Provider-managed `pgbouncer` and `vault` functions were not included in application changes.

## Draft change

`supabase/drafts/20261010_phase_c7e_auth_helper_search_path_hardening_draft.sql` proposes an empty `search_path` for the two private authorization helpers. Their bodies use schema-qualified application relations and `auth.uid()`. It explicitly revokes PUBLIC/anon execution and restores authenticated/service_role execution.

Draft URL: https://github.com/bishanth2026/Advocate-Management-QA/blob/staging/advocatedesk-test/supabase/drafts/20261010_phase_c7e_auth_helper_search_path_hardening_draft.sql

## Why not apply it yet

CI does not prove database privilege behavior. Before promotion, validate in QA with authenticated JWTs and check:
1. Existing RLS policies still evaluate as expected for Admin, assigned Advocate, unassigned Advocate, Accountant, inactive workspace, and non-member.
2. Anonymous execution remains denied.
3. Helper results are unchanged for each role and workspace.
4. Function owners, grants, and definitions match the intended before/after state.
5. Case assignment and unassignment continue to work and retain audit rows.
6. The new revision foundation is not mistaken for a complete atomic-save API.

The two public case-assignment RPCs also currently use a non-empty search path. Their bodies are schema-qualified, but they were deliberately not changed by this draft; assess them separately with dedicated regression coverage rather than expanding the migration without tests.

## Next gate

The next meaningful gate is authenticated API testing and transaction fault-injection. No schema migration or application cutover should occur until those tests can run with real QA sessions. Production remains untouched.
