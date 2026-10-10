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


## Storage-object RLS inspection — 10 October 2026

A read-only inspection of `storage.objects` policies in the isolated QA project found three policies for the `advocatedesk-documents` bucket:

- SELECT and DELETE require a matching `case_documents` metadata row, the corresponding document permission, and `private.can_access_case(...)`.
- INSERT requires the first storage path segment to parse as a UUID, workspace membership, and `documents.upload` permission.

This is a useful policy-level check, not an end-to-end storage test. Acceptance testing must verify the exact upload path format, metadata insert/read/delete sequence, denied reads for unassigned cases, denied cross-workspace object access, and behavior when metadata is missing or stale. No storage policy or object was modified.

## Latest report CI verification

The report update was committed as `d5ee278a94a8633a91ccc8a64e99da3b43e53735`. Both workflows completed successfully:
- [QA validation #38031791584](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38031791584)
- [QA Pages deployment #38031791530](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38031791530)

These CI results validate the repository workflow and deployment, not authenticated RLS behavior in a browser.


## Document metadata and bucket configuration review — 10 October 2026

Read-only QA database checks confirmed:

- The `advocatedesk-documents` bucket is private, has a 20 MiB file-size limit, and allows PDF, DOCX, JPEG and PNG MIME types.
- `case_documents` SELECT requires `documents.view` plus case access; INSERT requires `uploaded_by = auth.uid()`, `documents.upload`, and case access; DELETE requires `documents.delete` plus case access.
- Storage object upload policy itself validates workspace membership and `documents.upload`, but it cannot verify case access from the current workspace-only path convention before the metadata row exists. Therefore an authorized uploader may be able to create an orphan object if metadata insertion fails. Such an object is not made public—the bucket is private—but the current object DELETE policy requires matching metadata, so cleanup of an orphan may need a trusted maintenance path. Verify this behavior with a real authenticated upload/metadata-failure test before release; do not broaden client privileges to fix cleanup.

No bucket settings, policies, files, or database rows were modified during this inspection.


## QA document-storage data reconciliation — 10 October 2026

A read-only reconciliation query compared the document metadata table with objects in the private `advocatedesk-documents` bucket. Current isolated QA counts:

- `case_documents` metadata rows: 0
- Storage objects in the bucket: 0
- Objects without matching metadata: 0
- Metadata rows without matching objects: 0

This is a clean empty baseline, not a successful upload/access test. No real document records exist in QA to demonstrate assigned-case access or orphan cleanup. Acceptance testing must create synthetic test documents under separate test accounts, verify allowed and denied operations, then remove test data and rerun the reconciliation query.

## Latest storage-review report CI

The storage review was documented in commit `e2b13c150e0d44805c11ff88f1f364f9affcf79c`. Both workflows passed:
- [QA validation #38031893954](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38031893954)
- [QA Pages deployment #38031893994](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38031893994)


## QA table privilege and RLS cross-check — 10 October 2026

Read-only catalog inspection confirmed row-level security is enabled on `practice_records`, `practice_resources`, `case_assignments`, `case_documents`, and `storage.objects`; FORCE ROW LEVEL SECURITY is not enabled on these tables.

The privilege catalog also reports direct table privileges for the `anon` role on `practice_resources` and `storage.objects`. The inspected `practice_resources` policies and document-storage policies are scoped to `authenticated`, so the grants alone do not demonstrate anonymous data access; RLS remains a separate enforcement layer. Still, this is a least-privilege review item: confirm whether these anonymous grants are necessary and, if not, revoke them through a reviewed QA migration after checking Supabase Storage's expected grants. Do not assume that enabling RLS removes SQL privileges, and do not change grants in production as part of this QA task.

No privileges or policies were changed by this read-only inspection.


## QA-only least-privilege remediation — 10 October 2026

- A reviewed migration `supabase/migrations/20261010070000_revoke_anon_practice_resource_grants.sql` was added and applied to the isolated QA project `uqtsksgypncsbcnuanbk` only.
- It revokes all direct table privileges on `public.practice_resources` from `anon`; it does not alter the authenticated grants or any RLS policies.
- Post-migration read-only verification shows no direct `anon` table grants for `practice_resources`; the existing authenticated grants remain. This verifies the SQL grant change, not end-to-end anonymous HTTP behavior or authenticated case authorization.
- No other tables, Storage grants, production projects, or production code were changed.


## Legacy aggregate policy confirmation — 10 October 2026

A fresh read-only query of `pg_policies` confirms that `practice_records` still has these authenticated policies:

- SELECT: `private.is_workspace_member(workspace_id)`
- UPDATE: `private.is_workspace_member(workspace_id)` for both row visibility and the resulting row check
- DELETE: `private.is_workspace_member(workspace_id)`
- INSERT: workspace membership plus `created_by = auth.uid()`

This policy design is workspace-member-scoped, not case-assignment-scoped. Because the current UI's legacy workspace-state path stores a whole workspace payload in a `practice_records` row, an authenticated workspace member with table access may read or overwrite the aggregate payload without going through the finer `practice_resources` per-resource policies. This is a cutover blocker, not proof of a successful exploit or of access between different workspaces. The resource-store migration must be completed and tested before the aggregate row can be retired; do not weaken the resource policies to accommodate the legacy path.

The same catalog query confirmed `practice_resources` policies are explicitly for `authenticated` and use resource-type permission checks. Catalog inspection is not a substitute for signed-in HTTP tests using accounts with different permissions and case assignments.


## Application call-path trace — 10 October 2026

Source inspection of the current QA branch confirms the cutover has not occurred:

- `app.html` bootstraps non-Super-Admin sessions by selecting the single `practice_records` row with `record_type='other'` and `record_key='workspace_state'`, then exposes its `payload` as `window.ADCloudInitialState`.
- The same bootstrap defines `window.ADCloudSync.save(state)` to update that aggregate row using an `updated_at` compare-and-set, or insert the row if it does not exist.
- `app.js` initializes cloud-authenticated application state from `window.ADCloudInitialState`; its `save()` function delegates to `window.ADCloudSync.save(state)`.
- `resource-store.js` explicitly says it is QA-only and not loaded by `app.html`. The existing adapter tests use a fake Supabase client and explicitly do not prove RLS behavior.
- `scripts/dry-run-per-record-migration.js` is documented as a local, read-only snapshot converter; it does not write to Supabase.

Therefore the aggregate path is the active production-like QA application path, while the resource store and converter remain preparatory only. The existing `updated_at` compare-and-set helps detect competing updates to that one aggregate row, but it does not provide per-resource authorization or atomic multi-resource persistence. Do not enable the adapter or retire the aggregate table until a parity-tested cutover is implemented and verified with authenticated sessions.

## Validation status after latest documentation update

GitHub Actions validation and QA Pages deployment both passed for report commit `bada4379004dab5cff3a6a502fdb4eab17eccc4b`. This validates the repository workflow, not authenticated authorization behavior or end-to-end browser persistence.


## Schema-to-adapter parity review — 10 October 2026

Read-only inspection of the QA schema and adapter source identifies additional hard cutover gates:

1. **No revision/CAS field in the resource schema.** The inspected `practice_resources` columns are `id`, `workspace_id`, `resource_type`, `resource_id`, `case_id`, `payload`, `legacy_record_id`, `source_hash`, `migrated_at`, `created_at`, and `updated_at`. There is no workspace revision/version column or transaction envelope. The current adapter performs independent upserts in batches of 100; a later batch failure can leave earlier batches persisted. The legacy aggregate row's `updated_at` compare-and-set does not solve atomic multi-resource saves.
2. **Documents are not adapter-supported.** The dry-run converter recognizes `documents` and `caseDocuments` and emits a `document` resource type, but `resource-store.js` has no document type in its `TYPES` map. A non-empty `documents` or `caseDocuments` collection is rejected as unsupported by the adapter. The application uses the separate `case_documents` metadata table and private storage bucket, which require a dedicated migration/preservation path—not JSON conversion into `practice_resources`.
3. **Other converter-only collections require mapping review.** The converter accepts `caseRecords` and `allCases` as case aliases, but the adapter only maps the `cases` state collection. The converter also emits `other_<collection>` for unrecognized array collections, while the adapter deliberately fails closed on unknown resource types/collections. A clean preview report alone is not evidence that these records can be loaded by the application.
4. **The revision-safe save API does not yet exist.** Before cutover, introduce a schema and authenticated save path that applies all changes and a workspace revision check in one database transaction, rolls back on any error, and returns a typed conflict for stale revisions. Preserve existing RLS/permission checks; do not solve this by granting broad access or by a SECURITY DEFINER function that bypasses user authorization. The exact implementation needs migration-level review and tests against the live QA schema before application wiring.

These findings are based on source and schema inspection only. No live resource rows were changed by this review, and no migration/cutover was performed.


## Database constraint review — 10 October 2026

A read-only inspection of live QA constraints confirms:

- `practice_resources` has a unique key on `(workspace_id, resource_type, resource_id)`, and validates that payloads are JSON objects and resource IDs are nonblank and at most 200 characters.
- The database CHECK constraint permits only `case`, `client`, `hearing`, `task`, `invoice`, `payment`, `transaction`, `meeting`, `discussion`, `court`, and `case_party`. It does not permit `document` or generic `other_<collection>` types. Therefore the converter's document/unknown-collection output cannot be inserted into this table as-is; changing the CHECK constraint alone would not supply the missing document authorization and storage lifecycle.
- `practice_records` has uniqueness on `(workspace_id, record_type, record_key)`, which supports one aggregate `workspace_state` row per workspace/type/key. This uniqueness helps prevent duplicate initial rows, but does not enforce case-level access inside the JSON payload.
- Both tables reference `workspaces(id)` with cascade delete. `practice_resources.legacy_record_id` references `practice_records(id)` with `ON DELETE SET NULL`; the migration plan must account for this linkage before any legacy cleanup.

These are QA schema facts only. No schema constraints or data were changed during this inspection.
