# Phase C7 — Live QA Schema Gate Review (2026-10-10)

**Environment:** isolated AdvocateDesk-Test Supabase project `uqtsksgypncsbcnuanbk`  
**Repository branch:** `staging/advocatedesk-test`  
**Scope:** read-only live schema inspection plus repository/CI evidence. No migration, fixture seed, policy update, or production change was performed.

## Verified CI state

Latest commit before this document: `9fe6930dfb5ce6c33e1dc482bc36b6a96842c033`.

- Validation workflow: PASS — https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38045088528
- Resource Store unit tests: PASS — https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38045088535
- QA Pages deployment: PASS — https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38045088538

These are static, unit, and deployment checks. They do not establish live JWT/RLS correctness, real database atomicity, or browser end-to-end acceptance.

## Read-only live schema observations

The QA project was inspected with read-only SQL.

- `public.practice_resource_revisions` does not exist.
- `public.practice_resources` has 9 rows.
- `public.case_assignments` has 0 rows.
- `public.workspace_members` has 3 rows across 2 workspaces.
- No `role_permissions` row currently grants `tasks.manage`.
- `practice_resources` has four policies: SELECT, INSERT, UPDATE, DELETE, all scoped to `authenticated`.
- `practice_resources` uses text for `resource_type`, `resource_id`, and nullable `case_id`; `payload` is JSONB. Resource `id` and `workspace_id` are UUIDs.

Current task policy gaps visible in the deployed policy definitions:

1. Task INSERT/UPDATE/DELETE permission mapping currently uses `hearings.manage`, not a separate `tasks.manage` grant.
2. Assigned-only task reads require non-null `case_id` and `private.can_access_case`; the Admin/workspace-wide exception is driven by `tasks.view_all`.
3. No case assignments exist in the QA database, so an assigned-versus-unassigned advocate test cannot yet be meaningful with current live data.

## Gate decision

**DO NOT apply the C7H draft or switch the app to the resource adapter yet.**

Reasons:
- No disposable Auth identities/JWTs have been verified for the role matrix.
- No assignments/fixtures exist for the role matrix.
- No revision table or transactional save RPC exists; browser-side batches remain non-atomic.
- CI tests intentionally model the transaction contract in JavaScript; they are not Postgres transaction tests.
- The C7H draft recreates four policies and changes multiple resource categories, so it requires a full policy/grant diff and actual JWT regression tests before application.

## Required next acceptance sequence

1. Create five disposable QA-only Auth identities using the documented fixture runbook; never reuse real users or store JWTs in the repository.
2. Provision a fresh, isolated workspace and minimal case/task fixtures in one reviewed transaction, with the required assignments.
3. Capture read-only authorization baseline results using the existing GET-only harness.
4. Design and review an additive revision schema plus a single transactional RPC. The RPC must derive actor identity from `auth.uid()`, enforce active membership and per-mutation permission/case scope, reject stale revisions, and roll back all mutations if any item fails.
5. Test with real JWTs: anonymous/nonmember denial, each role's visibility/write matrix, cross-workspace and case-move denial, forced mid-batch rollback, and concurrent stale-revision conflict.
6. Only after acceptance, consider enabling the resource adapter behind a QA-only feature flag; keep legacy data and rollback plan intact.

## Safety boundary

No production project was queried or modified as part of this review. No live QA writes were performed. Do not interpret successful GitHub Pages deployment as database or app acceptance.
