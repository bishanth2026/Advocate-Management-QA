# Phase C6 — Case-linked resource RLS hardening

**Environment:** QA Supabase only (`uqtsksgypncsbcnuanbk`)  
**Branch:** `staging/advocatedesk-test`  
**Production:** untouched  
**Status:** SQL policies applied and catalog-verified; authenticated non-admin authorization tests remain blocked pending a safe non-admin QA account.

## Finding fixed

The Phase C1 resource policies had gaps:
- Meetings and discussions were not visible to assigned-only roles even when linked to an assigned case.
- Discussion writes were not case-assignment-scoped.
- DELETE policy did not enforce case assignment for hearings, tasks, or meetings.
- Case/client writes could be permitted by module edit permission without proving access to the specific case.

## Change

Migration file: `supabase/migrations/20261010000505_phase_c6_scope_case_linked_resource_policies.sql` (matches recorded Supabase migration version)

The migration updates SELECT, INSERT, UPDATE, and DELETE policies on `public.practice_resources`:
- Assigned-only meetings/discussions require the relevant assigned-view permission, a non-null `case_id`, and `private.can_access_case(...)`.
- Case/client/hearing/task/meeting/discussion writes require access to the linked case unless the user has the workspace-wide `cases.view_all` permission.
- Case writes are scoped using the case resource ID.
- Finance records continue to use finance-specific permissions; court access remains workspace-member scoped.
- Missing case links fail closed for case-linked resource writes.

Applied in QA under Supabase migration version `20261010000505`, name `phase_c6_scope_case_linked_resource_policies`.

## Verification

- Confirmed all four expected `practice_resources` policies exist.
- Catalog inspection confirms SELECT/INSERT/UPDATE/DELETE policy expressions include case-access checks and explicitly cover meetings and discussions.
- Resource row counts remain: 2 cases, 2 clients, 2 hearings, 1 task, 1 invoice, 1 payment. Existing linked rows remain linked.
- This is policy-catalog verification, **not** proof of end-to-end authorization as real authenticated roles.

## Remaining blockers

1. Create or identify a safe non-admin QA test account through the approved invitation flow; current QA memberships are both Admins.
2. Test assigned versus unassigned cases and documents, finance denial for non-accountants, and assignment RPC denial for non-admins using authenticated sessions.
3. Reconcile SQL migration file/version parity before any production promotion.
4. Keep `resource-store.js` disconnected from `app.html` until role tests, data parity, and regression tests pass. The existing app still persists the legacy `workspace_state` JSON blob.
5. Do not promote this QA-only change to production without a separate reviewed release approval.
