# AdvocateDesk case-level authorization — implementation design (DRAFT)

**Status: design only; not approved for Production.**  
**Target:** `release/advocatedesk-production-readiness`  
**Reason:** Production currently stores the application state as a single JSON `practice_records` row with `record_key='workspace_state'`. Case-scoped RLS cannot safely hide individual cases inside one row without changing the data contract.

## Security invariant

A user must not receive, mutate, export, or obtain a document URL for a case unless the authenticated user's active workspace membership and explicit case assignment/permission allow that action. Client-side filtering is not an authorization boundary.

## Findings confirmed from the current Production schema/source

- `practice_records` has `workspace_id`, `record_type`, `record_key`, and a JSONB `payload`; it does not have a normalized case UUID FK.
- The app persists cases, clients, hearings, tasks, discussions, meetings, payments, and invoices together in the `workspace_state` payload.
- `case_documents.case_id` is TEXT, not a foreign key to a normalized cases table.
- Production does not have `case_assignments` or `role_permissions`; QA helper functions depend on those tables.
- `auth.js` resolves workspace membership from server-readable `workspace_members`, but selects `members[0]` when multiple active memberships exist. This needs an explicit workspace-selection contract or a fail-closed ambiguity check before multi-workspace use is approved.
- A Storage metadata-path policy alone is insufficient while the full workspace state is readable as one row.

## Required target model

1. Introduce a normalized `cases` table with immutable UUID primary key, workspace FK, and a unique legacy case key per workspace for migration compatibility.
2. Introduce `case_assignments` keyed by workspace, normalized case UUID, and auth user UUID. Assignment creation/removal must be an explicit Admin-authorized operation, audited and validated against workspace membership.
3. Introduce a reviewed `role_permissions` matrix or equivalent explicit permission table. Avoid hard-coded assumptions that every Staff/Advocate role has the same access.
4. Normalize sensitive case-scoped records (case metadata, client/case parties, hearings, tasks, invoices/payments, documents) or create server-enforced access-filtered RPCs that never return unrelated case data. Do not continue exposing the monolithic `workspace_state` payload to assigned-only users.
5. Link `case_documents` to normalized case IDs, preserving the existing text case key temporarily only for compatibility; reconcile every existing document before enforcing FK/strict RLS.
6. Storage read/delete authorization must check both exact metadata/path match and the same case-level permission. Upload path must be bound to the normalized case and document ID, with owner/workspace checks.
7. Add a deliberate workspace picker for users with multiple active memberships, or fail closed with a clear message until a workspace is explicitly selected. Never silently choose the first membership.

## Migration plan — do not execute against Production yet

### Phase A — inventory and dry run
- Export schema, policies, function definitions, migration history, and counts from Production.
- Take a restorable backup and prove restore in a disposable project.
- Inspect representative redacted `workspace_state` payloads; identify all case IDs and references across all collections.
- Produce counts for duplicate/missing case keys, orphaned references, and documents with no matching case. No guessed assignments.

### Phase B — additive schema in disposable staging
- Add normalized case and assignment/permission tables with strict FKs, uniqueness, indexes, RLS, and grants.
- Seed only explicit Admin-created assignments in test fixtures.
- Keep legacy tables readable only for a controlled migration window; do not weaken existing RLS.
- Add audited RPCs for assignment management if direct table writes would expose privilege escalation.

### Phase C — app contract
- Change cloud sync to read/write case-scoped records instead of one all-cases JSON row.
- Implement Admin assignment UI and explicit workspace selection.
- Make unauthorized reads/writes produce visible errors and never silently fall back to local-only success.
- Keep a compatibility adapter only if it can be shown not to leak unassigned case data.

### Phase D — authenticated negative/positive tests
Use at least two workspaces and Admin, Advocate, Staff, and unassigned users:
- Assigned Advocate can read and perform only explicitly granted actions on assigned case.
- Same-workspace unassigned Advocate cannot list/read/search/export case or its documents.
- Staff can perform only permissions explicitly granted by the matrix.
- Cross-workspace access is denied for every table, RPC, and Storage operation.
- Tampered case ID, workspace ID, document ID, storage path, and user ID are denied.
- Anonymous and expired-session requests are denied.
- Admin can assign/unassign only within their own workspace; attempts to add outsiders or change another workspace are denied.
- Data survives save, reload, token refresh, and sign-in on a second device.
- Existing legitimate documents remain available and orphan handling is tested.
- Capture request/response status and assertions, never passwords, access tokens, or client confidential content.

### Phase E — cutover
- Review migration and rollback scripts; rehearse both in disposable staging.
- Reconcile counts and hashes before/after migration.
- Deploy application and schema as a coordinated release with a documented rollback boundary.
- Verify the live host's configured source and deployed SHA, then run the same authenticated smoke suite on the release candidate.
- Do not merge this draft PR as a deployment trigger.

## Go/no-go rule

Case-level authorization remains **NO-GO** until phases A–D pass in a disposable environment and the live deployed candidate passes authenticated tests. Leaked-password protection remains the user's explicitly accepted exception; it is not marked fixed. Backup/restore remains required before real customer data or cutover.
