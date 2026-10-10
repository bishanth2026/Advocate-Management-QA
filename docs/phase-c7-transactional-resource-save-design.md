# Phase C7 — Transactional Resource Save Design (QA only)

**Status:** design contract; not deployed or applied to Supabase.  
**Scope:** `staging/advocatedesk-test` and isolated QA project only. Production remains untouched.

## Why this phase is required

The current `ADResourceStore.save()` issues one or more independent PostgREST upsert requests, in batches of 100. A later request can fail after earlier batches have committed. There is no workspace revision/CAS row in the current schema. Therefore the adapter is not suitable for application cutover yet.

## Required transaction contract

The implementation must provide one authenticated database transaction per workspace save:

1. Accept the caller's workspace ID, expected workspace revision, and a JSON array of resource mutations (upsert/delete intent explicit per item).
2. Derive the actor from `auth.uid()`; never accept a caller-supplied actor ID as authoritative.
3. Verify active workspace membership and apply existing permission/case-access checks for every mutation, including both the old and new scope on moves.
4. Lock the workspace revision row (or use a conditional revision update) and compare it to the expected revision.
5. On mismatch, return SQLSTATE `40001` (or a documented typed conflict) without changing any resources or revision.
6. Validate all resource types against the database allow-list, all stable IDs, payload shape/size limits, duplicate mutation keys, and relationship targets before writing.
7. Apply all resource mutations and increment the workspace revision in the same transaction. Any validation, RLS, constraint, or write error must roll back the entire save.
8. Return the new revision and per-mutation outcome only after successful commit.
9. Use an invoker-context/RLS-preserving design wherever feasible. If a privileged function is proven necessary, document its narrow privileges and repeat every authorization check explicitly; do not create a general-purpose RLS bypass.
10. Treat delete as an explicit, individually authorized mutation. Never infer deletes from resources absent from a role-filtered read.

## Candidate schema (not yet implemented)

A small workspace revision table could contain:

- `workspace_id uuid primary key references workspaces(id) on delete cascade`
- `revision bigint not null default 0 check (revision >= 0)`
- `updated_at timestamptz not null default now()`

The authenticated client would read the current revision and send it as `expected_revision`. The transaction would lock/check that row, then apply resource changes and increment the revision. Workspace revision row access must be restricted; users should not be able to arbitrarily set revisions through direct table updates.

This schema alone is insufficient. The actual save API must guarantee that revision check, authorization, resource writes, and revision increment execute in one transaction. Do not emulate the transaction by multiple browser-side requests.

## Important authorization details

- Reuse the current `private.has_workspace_permission` and `private.can_access_case` semantics; preserve workspace status checks.
- Validate resource-type-specific permissions for select/insert/update/delete, not just membership.
- For case-linked resources, resolve and validate the case ID against the same workspace. Do not silently accept display labels as canonical foreign keys.
- For clients linked to multiple cases, preserve all relationships; the current single `case_id` column cannot represent full many-to-many client/case relationships without a separate relation table or a verified payload contract.
- Keep invoices, payments, and transactions finance-gated.
- Documents remain in `case_documents` and private Storage, with a separate upload/metadata cleanup protocol; do not add a `document` type to the generic table without an explicit design and policy review.
- Preserve audit logging for assignment and other sensitive operations.

## Required tests before app wiring

### Atomicity
- Force the second mutation to fail and verify that no first mutation or revision increment remains.
- Submit a duplicate key, unknown type, invalid relationship, oversized payload, and invalid ID; each must fail before any persistent changes.
- Verify the returned revision changes exactly once per successful transaction.

### Concurrency
- Two clients read revision N. First save succeeds and returns N+1; second save with N gets a conflict and changes no rows.
- Retry after reloading at N+1 succeeds without duplicate resources.
- Concurrent updates to different resources in the same workspace are deliberately serialized/conflicted; behavior is documented.

### Authorization
- Anonymous requests fail.
- Admin can perform only operations allowed by current admin policy.
- Assigned Advocate can access only permitted assigned-case resources.
- Unassigned Advocate cannot read/write another case.
- Accountant can access permitted finance resources but not case-edit operations outside permission grants.
- Cross-workspace resource IDs, case IDs, and revision IDs are rejected.
- Attempts to move a resource to an unauthorized case fail without altering the old resource.

### Application regression
- Refresh/re-login persistence for cases, clients, hearings, calendar, tasks, invoices, payments, meetings, discussions, and court lists.
- Documents retain metadata/file association and unauthorized users cannot download, replace, or delete files.
- Hidden role-filtered resources are never implicitly deleted.
- Export and reports reconcile against pre-cutover snapshots.

## Rollout and rollback

1. Add the revision schema and save function to QA as an additive migration; do not change `app.html`.
2. Test using real authenticated QA sessions and fault injection.
3. Run payload-level source-to-target reconciliation, including relationship semantics and document links.
4. Enable the adapter behind a QA-only feature flag for a dedicated test workspace.
5. Keep legacy rows intact during the acceptance period; do not dual-write unless a deterministic conflict-resolution strategy is tested.
6. Cut back to the legacy UI only if no new writes were accepted by the resource path or after an audited reverse reconciliation. Never assume a rollback can simply discard resource rows.
7. Production release requires independent security acceptance and an explicit separate deployment decision.

## Current status

- Existing QA schema and adapter reviewed.
- This is a design specification only; no migration, database function, app cutover, or production change has been made.
- Authenticated HTTP/JWT role-matrix tests remain outstanding.
