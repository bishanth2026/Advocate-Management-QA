# Shared Workspace State Authorization Remediation

Status: QA remediation plan; no database migration applied by this document.

## Confirmed QA baseline (2026-10-11)

- Supabase QA project: `uqtsksgypncsbcnuanbk` (`AdvocateDesk-Test`).
- `public.practice_records` has RLS enabled, but its legacy policies authorize any workspace member to select/update/delete records in that workspace. Inserts require workspace membership and `created_by = auth.uid()`.
- The legacy state row is `record_type = 'other'`, `record_key = 'workspace_state'`. `app.html` loads the full payload and `ADCloudSync.save()` writes it as a whole.
- `public.practice_resources` has per-resource permission policies, but the backfill is incomplete (14 rows across three workspaces at inspection time). Do not switch reads or block snapshot access before parity is proven.
- The accountant role currently has `finance.view`, `finance.edit`, and `reports.finance`; these permission entries do not restrict the legacy JSON snapshot.
- Supabase security advisors flag authenticated execution of `assign_case_to_member` and `unassign_case_from_member` SECURITY DEFINER functions. Their bodies check that the caller is an admin of an active workspace; verify grants and direct-call behavior before changing grants.
- No SQL schema migration or data mutation was performed during this inspection.

## Non-negotiable role boundaries

- Admin: all authorized resources within the active workspace.
- Advocate/junior advocate: assigned cases and associated authorized resources.
- Accountant: finance records/reports and only minimum client/case references needed for accounting.
- Non-member: no protected workspace data.
- Anonymous: no protected workspace data.

Navigation hiding is not authorization. Every API request and database operation must be enforced server-side.

## Safe implementation sequence

### Phase 1 — Freeze, backup, and inventory

1. Export all `practice_records` rows for all QA workspaces, including IDs, `updated_at`, and complete payloads. Keep the backup outside the live table and verify it can be read back.
2. Capture workspace row counts, JSON keys, collection counts, stable IDs, and a deterministic normalized payload checksum.
3. Inventory every top-level property and all create/edit/delete/read paths in application modules, including unknown/custom fields.
4. Stop if any workspace cannot be backed up or any payload property is not accounted for.

### Phase 2 — Finish per-resource conversion without deleting legacy data

1. Implement an idempotent dry-run converter from each `workspace_state` payload to per-resource rows in `practice_resources` (or a versioned metadata record for non-collection keys).
2. Preserve every field, stable ID, relationship, and unknown property. Do not use array positions as permanent IDs.
3. Produce before/after counts per collection, duplicate-key report, unresolved-reference report, and normalized payload comparison.
4. Require zero unexplained losses and a verified restore before any write/cutover.

### Phase 3 — Application compatibility

1. Add a disabled-by-default feature flag for per-resource reads/writes.
2. Update bootstrap and each module to request only authorized resource types and use stable resource IDs.
3. Use version-checked updates; preserve unsaved drafts on conflict. Use tombstones/version checks for deletes to prevent stale clients resurrecting deleted data.
4. Ensure a save success indicator appears only after server confirmation.
5. Test refresh, logout/login, concurrent edits, retries, mobile, cases, clients, hearings/calendar, documents, finance, reports, and unknown metadata.

### Phase 4 — Restrict legacy snapshot access (only after Phase 3 passes)

1. Add a restrictive RLS policy specifically for the legacy `workspace_state` row so restricted roles cannot select, insert, update, or delete it. Keep other record types subject to their appropriate resource policies.
2. Confirm policy composition: permissive policies OR together, restrictive policies AND together. Review existing policies and grants before applying any migration.
3. Make legacy snapshots read-only during the rollback window; do not delete them.
4. Verify all app paths no longer depend on whole-snapshot writes before enabling the restrictive policy.

### Phase 5 — Real-session authorization tests

Use separate signed-in QA sessions and direct Supabase REST/RPC calls. Do not test only through UI visibility.

| Actor | Allowed test | Denied test |
|---|---|---|
| Admin | Read/write authorized resources in own active workspace | Read/write another workspace |
| Assigned advocate | Read assigned case and linked permitted resources | Read unassigned case or finance resources |
| Unassigned advocate | Read own assigned cases | Read unrelated case by changing ID |
| Accountant | Read/write finance resources and finance reports | Read unrelated case details, documents, discussions, or whole snapshot |
| Non-member | None | Select/insert/update/delete protected resources |
| Anonymous | None | All protected table and RPC calls |

For every actor, test SELECT, INSERT, UPDATE, DELETE, cross-workspace IDs, changed resource type, changed case ID, and direct RPC invocation. Record HTTP status and returned row counts. Verify denial does not disclose payloads.

### Phase 6 — Security review and release gate

1. Re-run Supabase security advisors and review each remaining finding.
2. Verify assignment RPCs reject non-admin, inactive workspace, non-member target, and invalid case IDs; adjust EXECUTE grants only after the direct-call tests.
3. Keep QA and production separate. No production deployment until QA authorization tests, data reconciliation, app regression tests, and rollback verification pass.

## Acceptance criteria

- Complete snapshot backup and proven restore.
- Every legacy collection and metadata field reconciles with zero unexplained losses.
- Restricted roles cannot read or overwrite the full shared snapshot.
- Direct API tests pass for allowed and denied actions for all six actor categories.
- No cross-workspace data access.
- Existing verified workflows and build checks pass.
- Security advisor findings are reviewed and documented.
- Production remains unchanged until explicit release approval.
