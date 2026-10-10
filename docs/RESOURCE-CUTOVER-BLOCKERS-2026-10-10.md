# Resource-Scoped Cutover Blockers — 10 October 2026

## Decision

Do not enable the resource-scoped store in the live QA UI until the blockers below are resolved. This is a security and data-integrity gate, not a UI-only change.

## Verified current behavior

- `app.html` does not load `resource-store.js`.
- The authenticated bootstrap in `app.html` selects the `practice_records` row where `record_type='other'` and `record_key='workspace_state'` for every non-Super-Admin role.
- `app.js` initializes state from `ADCloudInitialState` and persists the whole object through `ADCloudSync.save(state)`.
- `practice_records` policies allow active workspace members to select/update workspace rows; they do not filter individual cases within the JSON payload.
- The existing resource adapter supports only cases, clients, hearings, tasks, invoices, payments, meetings, discussions and courts. `app.js` also accesses `transactions`; modules may maintain additional relationships and transient state.
- **Transaction resource support added on QA:** migration `20261010000700_transaction_resource_support.sql` extends the allowed resource type, applies `finance.view` read and `finance.edit` write/delete policies, and backfills the legacy `transactions` array when present. It was applied to the isolated QA Supabase project only. Current verification shows no transaction rows in `practice_resources`, so there was no transaction data to backfill in the current QA seed. Adapter writes now include a required `source_hash` value; this is a non-cryptographic checksum and is not a security/audit signature. **Case-party resource support added on QA:** migration `20261010000800_case_party_resource_support.sql` adds `case_party`, backfills the legacy `caseParties` array, resolves links against cases in the same workspace, and restricts reads/writes by case access and `cases.edit`. Adapter support and unit tests now cover case-party mapping. This is still not proof of real authenticated RLS behavior.
- **Stable-ID handling improved on 10 October:** `resource-store.js` now restores `resource_id` into legacy payloads that lack `id`, and assigns an ID to new legacy-style records before upsert. Unit tests cover both cases. This removes the known missing-ID failure mode, but does not by itself establish full migration parity or safe authorization.
- The adapter uses upsert-only saves, which is safer than deleting all rows absent from a role-filtered state. A complete migration must still implement deliberate, permission-checked deletes.
- The QA test database currently has two legacy workspace-state rows (workspaces A and B), nine resource rows, two case rows, zero case assignments and three active memberships.

## Required implementation before cutover

1. Extend the adapter to guarantee stable IDs for existing and newly created supported resources, and restore row IDs during load when payloads have no ID. Ensure repeated saves do not create duplicate records.
2. Define the full canonical state contract. Account for `transactions`, case-party data and every other module's persisted fields. Do not silently drop unknown keys or move only a subset of records while the old aggregate remains authoritative.
3. Implement a single authoritative resource-scoped load/save path for all roles. Do not dual-write legacy and resource stores as competing sources of truth; concurrent Admin/member saves could overwrite one another.
4. Restrict legacy aggregate access only as part of the verified cutover, after confirming every role and every screen uses the new store. Do not make a change that causes the app to appear empty or prevents Admin saves.
5. Ensure missing case links are denied for case-linked data. Normalize links by stable case IDs, not ambiguous case titles/numbers.
   - **Client-to-case relationship parity remains unresolved:** the adapter derives client case access from `case.clientId`/`case.clientIds` only, while legacy cases may store a client name in `case.client` and client records may store only a count or label. A client row with no normalized `case_id` cannot pass the assigned-client SELECT policy. Do not infer a relationship from a name unless it uniquely resolves and the data model can preserve multiple case links; preferably use a normalized client-to-case join/assignment table for many-to-many relationships.
   - **Legacy aggregate remains a security bypass for the new model:** `practice_records` still grants workspace-member-wide read/update access to aggregate JSON. The new `practice_resources` policies do not protect the UI while it continues reading/writing `workspace_state`. Restrict aggregate access only in a staged, tested cutover after every screen and role is migrated.
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


## Follow-up findings — schema review for concurrency control (10 October 2026)

- Read-only inspection of the isolated QA database confirms `practice_resources` currently has no version/revision column; its resource key is workspace + resource type + resource ID, and it stores payload, case link, source hash and timestamps.
- Therefore the current adapter cannot perform reliable compare-and-swap using a row version. Client-side timestamp checks alone would still race between two sessions.
- The safe implementation direction is a QA-only, authenticated, transaction-atomic RPC that checks a workspace revision, validates the caller's permissions for every submitted resource, applies all upserts as one transaction, and advances the revision only if the expected revision matches. It must never trust a client-supplied workspace or role without checking membership/permissions in the database.
- Do not deploy a partial RPC or grant broad `SECURITY DEFINER` privileges merely to get concurrency working. Before implementing it, inspect existing helper-function definitions, grants, and RLS policies so the RPC reuses the existing permission model. Real authenticated-session tests are still required.
- This was a read-only schema inspection; no QA database schema or production database was changed by this review.

## Follow-up findings — duplicate resource IDs and latest CI (10 October 2026)

- Added pre-write duplicate-ID validation per resource collection. If two records in the same module resolve to the same stable resource ID, save rejects the state before sending any upsert request. This prevents silent same-key overwrites inside a batch and is covered by a regression test.
- Latest QA-only commit: `a50139433d90ba431c663c0b2a5118050ede7e63`.
- Latest automated checks passed:
  - [Resource Store Unit Tests #38031466991](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38031466991)
  - [QA Validation #38031466953](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38031466953)
  - [QA Pages Deployment #38031466965](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38031466965)
- This safeguard is not concurrency control: simultaneous sessions can still overwrite each other's edits, and multiple batches can still partially persist if a later database request fails. Compare-and-swap/version checks or a transactional server-side save operation remain required before cutover.
- The aggregate `practice_records.workspace_state` path remains active in the UI; this update does not enable resource-store persistence or authorize production changes.

## Follow-up findings — 10 October 2026

- Added an adapter unit test for duplicate case labels; the hearing relationship remains null rather than arbitrarily choosing one case. Validation, QA Pages deployment, and the related workflow completed successfully on commit `5583d9ab0f7b909e8e2b3f5a94612660f59005c6`.
- Read-only inspection of the isolated QA policy catalog confirmed the aggregate `practice_records` policies remain workspace-member scoped, while `practice_resources` has per-resource permission policies. This reinforces that the UI must not cut over until complete-state parity and authenticated tests are finished.
- Current unresolved blocker highlighted: client-to-case link normalization for assigned-only client visibility. No production database was accessed or changed.


## Follow-up implementation guard — 10 October 2026

- Updated `resource-store.js` to fail closed when it receives a non-empty array for a module collection not present in the adapter's explicit resource map. This prevents a future module from being silently omitted during a proposed cutover.
- Added a unit test proving that an unknown collection such as `customModuleRecords` rejects the save. This is a defensive guard, not evidence that every non-array setting or every module field has been mapped.
- The adapter remains intentionally disconnected from `app.html`. Continue to block cutover until the canonical state contract, relationships, deletes, concurrency handling, and authenticated RLS/Storage tests are complete.


## Concurrency implementation checklist — 10 October 2026

The final concurrency fix must be a single authenticated database transaction. A workspace revision check must be combined with all resource writes in that same transaction; a revision-only RPC is not sufficient. Use the authenticated caller identity and existing resource-level RLS policies. Do not use a privileged function to bypass RLS.

Acceptance checks: stale revision conflicts; no revision advancement when any resource write fails; whole-batch rollback; unauthenticated and non-member requests denied; finance/case permissions enforced independently; two simultaneous requests cannot both claim the same revision; real authenticated PostgREST sessions used for verification.

The proposed separate design document and draft migration could not be created because repository write operations were blocked. No schema was changed in this attempt. Treat this checklist as planning guidance only, not implemented concurrency protection.


## Additional live RLS review — 10 October 2026

A read-only query of `pg_policies` confirms the main release blocker remains active: `practice_records` has SELECT and UPDATE policies based on workspace membership only. Those policies do not inspect case IDs inside the `workspace_state` JSON. Thus the resource-level policies on `practice_resources` cannot protect screens while the UI continues to load/save the aggregate record.

The current `practice_resources` policies are resource-type aware for SELECT/INSERT/UPDATE/DELETE, and the assignment table has scoped SELECT with no direct client mutation policies. However, this policy inspection is not a substitute for signed-in browser tests. The revision/RPC design must preserve these resource-level policies and must not make the revision table a way to mutate resources without their normal permissions.

No policy was modified in this review. The next safe step is an authenticated UI/DB acceptance suite against the isolated QA project, followed by the atomic save design; do not cut over or weaken aggregate policies until parity is demonstrated.
