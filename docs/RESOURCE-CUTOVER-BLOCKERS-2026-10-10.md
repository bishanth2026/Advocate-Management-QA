# Resource-Scoped Cutover Blockers — 10 October 2026

## Decision

Do not enable the resource-scoped store in the live QA UI until the blockers below are resolved. This is a security and data-integrity gate, not a UI-only change.

## Verified current behavior

- `app.html` does not load `resource-store.js`.
- The authenticated bootstrap in `app.html` selects the `practice_records` row where `record_type='other'` and `record_key='workspace_state'` for every non-Super-Admin role.
- `app.js` initializes state from `ADCloudInitialState` and persists the whole object through `ADCloudSync.save(state)`.
- `practice_records` policies allow active workspace members to select/update workspace rows; they do not filter individual cases within the JSON payload.
- The existing resource adapter supports only cases, clients, hearings, tasks, invoices, payments, meetings, discussions and courts. `app.js` also accesses `transactions`; modules may maintain additional relationships and transient state.
- **Transaction resource support added on QA:** migration `20261010000700_transaction_resource_support.sql` extends the allowed resource type, applies `finance.view` read and `finance.edit` write/delete policies, and backfills the legacy `transactions` array when present. It was applied to the isolated QA Supabase project only. Current verification shows no transaction rows in `practice_resources`, so there was no transaction data to backfill in the current QA seed. Adapter writes now include a required `source_hash` value; this is a non-cryptographic checksum and is not a security/audit signature. The `caseParties` shape referenced by the app still needs explicit canonical mapping.
- **Stable-ID handling improved on 10 October:** `resource-store.js` now restores `resource_id` into legacy payloads that lack `id`, and assigns an ID to new legacy-style records before upsert. Unit tests cover both cases. This removes the known missing-ID failure mode, but does not by itself establish full migration parity or safe authorization.
- The adapter uses upsert-only saves, which is safer than deleting all rows absent from a role-filtered state. A complete migration must still implement deliberate, permission-checked deletes.
- The QA test database currently has two legacy workspace-state rows (workspaces A and B), nine resource rows, two case rows, zero case assignments and three active memberships.

## Required implementation before cutover

1. Extend the adapter to guarantee stable IDs for existing and newly created supported resources, and restore row IDs during load when payloads have no ID. Ensure repeated saves do not create duplicate records.
2. Define the full canonical state contract. Account for `transactions`, case-party data and every other module's persisted fields. Do not silently drop unknown keys or move only a subset of records while the old aggregate remains authoritative.
3. Implement a single authoritative resource-scoped load/save path for all roles. Do not dual-write legacy and resource stores as competing sources of truth; concurrent Admin/member saves could overwrite one another.
4. Restrict legacy aggregate access only as part of the verified cutover, after confirming every role and every screen uses the new store. Do not make a change that causes the app to appear empty or prevents Admin saves.
5. Ensure missing case links are denied for case-linked data. Normalize links by stable case IDs, not ambiguous case titles/numbers.
6. Add explicit permission-checked delete/update behavior and audit trail where required; do not use broad table deletes to sync a filtered state.
7. Run separate authenticated browser tests for Admin and non-Admin users and verify database results—not just rendered UI.

## Required acceptance tests

- Admin can read and manage all cases in their workspace.
- A member can read only assigned cases and associated client/hearing/task/discussion/meeting data as permitted.
- An unassigned case is not returned by direct Supabase queries and cannot be opened by guessing its ID.
- Finance data requires the intended finance permission; documents require document permission and case access.
- Cross-workspace reads and writes fail.
- Case assignment and unassignment are Admin-only and audit logged.
- Create/edit/delete, relationships, refresh/re-login, two-session concurrency, and conflict recovery work without data loss.
- Existing workspace data is reconciled against resource rows before the legacy aggregate is retired.

## Latest QA status — 10 October 2026

- Resource-store unit tests passed after stable-ID and transaction mapping changes: [run #38030673118](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38030673118).
- Main QA validation passed for the latest migration/code commit: [run #38030682993](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38030682993).
- QA Pages deployment passed: [run #38030497960](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38030497960).

## Status

QA-only. Stable-ID handling has been improved and automated checks/deployment pass, but the app still uses the legacy aggregate state and `resource-store.js` is not loaded by `app.html`. The authorization, complete-state mapping, migration reconciliation and authenticated browser tests remain release blockers. No production changes are authorized by this report.
