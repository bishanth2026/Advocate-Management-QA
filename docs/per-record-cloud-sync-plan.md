# AdvocateDesk Per-Record Cloud Sync Migration Plan

## Status
Design stage only. This document does not change the live Supabase schema, existing production records, or application runtime.

## Current baseline
- The authenticated app loads one `practice_records` row per workspace using `record_type = 'other'` and `record_key = 'workspace_state'`.
- That row contains the complete application state as JSONB.
- Saves are serialized in the browser and use an `id + updated_at` optimistic-concurrency check. A conflict is surfaced rather than silently overwriting newer state.
- Workspace membership RLS currently scopes record access by `workspace_id`. Preserve these boundaries.
- The current UI has collections including cases, clients, hearings, tasks, discussions, meetings, payments, invoices, courts, transactions, and case parties. Some modules may introduce additional state properties, so migration must preserve unknown keys too.

## Target model
Continue using `public.practice_records` initially; avoid creating parallel tables before the app proves the per-record model. Store one logical entity per row:
- `workspace_id`: authenticated workspace boundary.
- `record_type`: stable collection discriminator (for example `case`, `client`, `hearing`, `task`, `discussion`, `meeting`, `payment`, `invoice`, `court`, `transaction`, `case_party`, and `other`).
- `record_key`: stable entity ID, scoped by workspace and type.
- `payload`: the full JSONB object for that entity, preserving existing optional/custom fields.
- `created_by`, `created_at`, `updated_at`: retain audit metadata.

Keep the unique constraint/index on `(workspace_id, record_type, record_key)`. Do not use array position as a long-term key. For legacy objects without an ID, create a persistent key during an explicit migration and store it in the payload before relying on per-record writes. Retain unknown top-level state fields in a versioned workspace metadata record rather than dropping them.

## Migration phases
1. **Freeze and backup:** export a verified backup of all `practice_records` rows and record per-workspace row counts/checksums. Do not migrate while users are actively editing.
2. **Inventory:** enumerate every top-level state collection and every create/edit/delete path across app modules. Confirm entity IDs and foreign-key-like references (case/client IDs, invoice/payment links, hearing/task links).
3. **Schema/RLS validation:** confirm the unique index and inspect all RLS policies. Test insert, select, update, delete and cross-workspace denial using separate Admin accounts. No policy should trust a client-supplied workspace ID without membership enforcement.
4. **Idempotent converter:** build a dry-run converter from the single `workspace_state` payload into per-record rows. It must preserve every object and unknown field, retain stable IDs, detect duplicate keys, and report counts by collection. Dry-run output must show zero unexplained losses before any write.
5. **Staging test:** run converter and app against a separate staging project/workspace using synthetic records. Test refresh persistence, two-browser concurrent edits to different records, same-record conflicts, deletes, network failure/retry, and workspace isolation.
6. **Dual-read/write rollout:** behind a disabled-by-default feature flag, write per-record changes while continuing to maintain the legacy snapshot. Read per-record rows only after validation; otherwise fall back to the legacy snapshot. Ensure queued writes cannot reorder or resurrect deleted records.
7. **Reconciliation:** compare each collection's counts and stable IDs, then compare normalized payloads. Verify links among clients, cases, hearings, invoices, and payments. Require an explicit zero-loss report.
8. **Controlled production cutover:** only after backup restoration is proven and staging passes, migrate one workspace at a time during a maintenance window. Keep legacy snapshots read-only and available for rollback.
9. **Retirement:** remove snapshot writes only after a monitored validation period and a tested rollback procedure. Do not automatically delete legacy rows.

## Conflict and concurrency rules
- Serialize client writes per entity key, not globally across the entire workspace.
- Use a version token such as `updated_at` (or a dedicated integer revision) in conditional updates.
- If an update affects zero rows, report a conflict and preserve the user's unsaved draft; do not silently reload over it.
- Treat deletes as version-checked operations or tombstones so stale clients cannot recreate deleted records.
- A successful save indicator must only appear after the server confirms the write.

## Acceptance criteria
- Existing 6/6 user-verified workflows continue to pass.
- All current collections and unknown state properties survive a dry-run round trip.
- Changes to one entity do not overwrite unrelated entities.
- Two distinct workspaces cannot read or mutate each other's records.
- Same-record concurrent changes are detected and presented without silent data loss.
- Refresh, logout/login, mobile layout, and existing case/client/finance/calendar workflows remain functional.
- Build/type checks pass, and user-run browser tests pass before production cutover.

## Explicitly out of scope for this design commit
- No production SQL migration or row rewrite.
- No deletion or modification of the existing `workspace_state` records.
- No migration of legacy browser localStorage data.
- No changes to user accounts, roles, invitations, or authentication.
