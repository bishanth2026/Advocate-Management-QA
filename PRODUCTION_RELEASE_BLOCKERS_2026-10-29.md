# AdvocateDesk Production Release Blockers — 2026-10-29

**Decision: NO-GO.** This file records work actually completed and the remaining external/schema gates. It is not a release approval.

## Work completed during this pass

- Read-only inspection of Production `public.case_documents`, `storage.objects` policies, helper function availability, table columns, bucket configuration, and metadata/object counts.
- Confirmed Production's app source constructs Storage paths as `<workspace UUID>/<document UUID>/<sanitized filename>`, inserts the Storage object first, inserts `case_documents` metadata second, creates signed URLs for read/preview, and removes the object before deleting metadata.
- Confirmed the Production bucket `advocatedesk-documents` is private with a 20 MiB limit and PDF/DOCX/JPEG/PNG MIME allowlist.
- Added a draft-only Storage hardening candidate: `supabase/drafts/production-document-storage-hardening.sql`.
- Added read-only preflight diagnostics: `supabase/drafts/production-rls-storage-preflight.sql`.
- No Production SQL, Auth settings, Storage policies/objects, app source, or hosting settings were changed.

## Draft Storage hardening candidate

The draft requires:
- A valid workspace UUID and document UUID in the first two path segments.
- The authenticated user to be an active workspace member and the Storage object owner when uploading.
- An exact matching `case_documents.storage_path`, `workspace_id`, and document `id` for Storage reads/deletes.
- Malformed UUID path segments to be denied rather than raising UUID cast errors.

**This is only a partial hardening candidate.** It is not sufficient to declare the whole release ready because it does not implement case-level authorization in the metadata table, and it has not been run in a disposable Supabase project or against real authenticated sessions. Do not apply it to Production yet.

## Required authenticated test matrix

Execute in a disposable project or approved staging environment using real signed-in test accounts. Record evidence and user IDs/roles without recording passwords or tokens.

| Test | Expected result | Status |
|---|---|---|
| Active workspace member uploads `workspace UUID/document UUID/file` then inserts metadata | Upload and metadata insert succeed | NOT RUN |
| Valid metadata row points to exact Storage object | Signed URL/preview works for authorized user | NOT RUN |
| Guessed object path without metadata row | Read/sign URL and delete denied | NOT RUN |
| Path workspace UUID disagrees with metadata workspace | Read/delete denied | NOT RUN |
| Path document UUID disagrees with metadata id | Read/delete denied | NOT RUN |
| Malformed workspace/document path UUID | Denied without server-side SQL cast error | NOT RUN |
| User from another workspace reads/updates/deletes object | Denied | NOT RUN |
| User uploads with mismatched owner_id | Denied | NOT RUN |
| Upload succeeds but metadata insert fails | Object cleanup succeeds; no orphan remains | NOT RUN |
| Object delete succeeds but metadata delete fails | Recovery/retry path verified; no silent data inconsistency | NOT RUN |
| Existing legitimate document | Preview/download/delete continue working | NOT RUN |
| Advocate accesses assigned case | Allowed only for explicit permitted actions | BLOCKED — Production lacks a normalized assignment/permission model |
| Advocate/Staff accesses unassigned case in same workspace | Denied unless explicitly granted by approved role model | BLOCKED — Production lacks a normalized assignment/permission model |
| Accountant tries document access | Denied unless policy explicitly grants it | NOT RUN |
| Cross-workspace metadata/API read and mutation | Denied | NOT RUN |
| Anonymous request attempts metadata/Storage access | Denied | NOT RUN |
| Cloud Sync save → success response → hard refresh → reopen | Persisted data reappears correctly | User previously confirmed functional check; must revalidate exact release candidate |
| Mobile/desktop document and login workflow | Works without console/API errors | User previously confirmed general functional checks; exact release candidate not yet browser-verified |

## Schema compatibility finding

Production's cases/clients/finance data currently live in the `practice_records` JSON payload (`record_key='workspace_state'`) rather than a normalized cases table. Production does not currently have QA's `case_assignments`, `role_permissions`, `practice_resources`, or `workspace_audit_log` tables/functions. QA's `private.can_access_case` depends on `case_assignments`; QA's `private.has_workspace_permission` depends on `role_permissions`.

Do not invent assignments by guessing fields from legacy JSON. Before case-level RLS can be safely enabled:
1. Agree how case assignment is represented and maintained for existing and new cases.
2. Add a production-compatible assignment/permission schema and admin workflow or safely migrate a confirmed existing assignment source.
3. Backfill only after reviewing actual payload shape and defining conflict/duplicate rules.
4. Update policies and app code in a candidate branch; ensure app supports assignment maintenance and understands denied API responses.
5. Test positive/negative sessions in staging before applying any Production migration.

### Additional blocker confirmed: monolithic workspace state

A follow-up review of the current Production schema and `auth.js` confirms that the main cloud-sync contract stores the entire workspace state (cases, clients, hearings, tasks, meetings, payments, and invoices) in one JSON payload row. Row-level security cannot safely filter individual cases inside that one row. Enabling assigned-only access for document metadata while leaving this payload accessible would give a false sense of security and could expose unassigned case data.

The current sign-in resolver also chooses `members[0]` when an account has multiple active workspace memberships, without an explicit user-selected workspace. This is not a reason to mutate Production immediately; the multi-workspace contract must be designed and tested fail-closed.

A release-branch code change now fails closed if an account has anything other than exactly one active workspace membership, instead of silently selecting `members[0]`. The app shell and login pages have cache-busting versions updated so clients should request the candidate auth script. The static smoke assertion for the fail-closed guard and candidate syntax/static CI passed in workflow run #62; the latest documentation commit also passed the same syntax/static workflow in run #63. These checks prevent a known ambiguous-tenant-selection bug but do **not** implement a workspace picker and are not live-verified. Multi-workspace users will be denied until a proper selector is implemented.

A design-only implementation plan has been added: `CASE_LEVEL_AUTHORIZATION_IMPLEMENTATION_DESIGN_DRAFT.md`. It describes the required normalized case model, explicit assignment/permission workflow, migration phases, and authenticated negative/positive test matrix. This is not executable migration SQL and has not changed Production.

**Consequence:** case-level authorization cannot be completed safely by merely adding QA tables or applying the Storage draft. The app data contract must be changed alongside the schema, then verified in a disposable environment. No Production migration was applied.

## Live hosting verification

Repository source includes `CNAME=advocate.biznexco.in` on the release branch and the production baseline has portal files, but repository contents do not prove the live host serves that commit. A web check of `https://advocate.biznexco.in` was inaccessible and the search returned no indexed result. The available GitHub connector does not expose the configured Pages/hosting source settings.

Still required:
- Read hosting settings and confirm repository + publishing branch/source.
- Verify deployed commit SHA and actual served `login.html` / `member-login.html`.
- Run live desktop/mobile smoke tests after deployment of the approved candidate.
- Do not merge the draft PR merely to trigger a deployment.

## User-approved scope exceptions

- Leaked Password Protection is excluded by the user's instruction. It remains disabled/WARN and is not represented as fixed.
- Backup/restore rehearsal is deferred because current data is demo/test data. It must pass before real customer data or production cutover.

## Release gate

- [x] Read-only Production policy/schema/bucket inventory.
- [x] Production app Storage path and upload/read/delete sequence reviewed.
- [x] Read-only preflight SQL added to the release branch.
- [x] Draft Storage hardening candidate added to the release branch.
- [ ] Disposable-project migration rehearsal and rollback test.
- [x] Case-assignment/role-permission implementation design documented (design-only; not approved/applied).\n- [ ] Normalized case data contract and Admin assignment/workspace-selection workflow implemented and reviewed.
- [ ] Real authenticated positive/negative authorization tests pass.
- [x] Candidate syntax/static smoke CI passed on code commit `17b225fc056e4ab6b582d40052c02b20ec52f199` (workflow run #62), and latest documentation commit CI passed in workflow run #63; this does not replace authenticated end-to-end or live-host testing.
- [ ] Live hosting source and deployed SHA verified.
- [ ] Exact candidate desktop/mobile end-to-end checks pass.
- [ ] Backup/restore passes before production customer data.
- [ ] Final release approval.

**Do not release to Production while any mandatory gate above remains open.**


## Fresh live Production policy verification — 2026-10-29

A further read-only query of the live Production project's `pg_policies`, public table definitions, migration history, and Supabase security advisor confirmed these release blockers:

- `public.practice_records` SELECT/INSERT/UPDATE/DELETE policies authorize by `private.is_workspace_member(workspace_id)`; they do not inspect case assignments inside `payload`. The application's `workspace_state` JSON therefore cannot provide database-enforced per-case row isolation.
- `public.case_documents` SELECT and DELETE policies authorize workspace members; INSERT checks workspace membership and `uploaded_by = auth.uid()`. They do not verify the caller's permission for the referenced case.
- Storage object SELECT/DELETE policies for `advocatedesk-documents` authorize by workspace membership based on the first folder UUID. INSERT additionally checks uploader ownership. They do not require a matching `case_documents.storage_path` metadata row or case-level authorization.
- The Production `case_documents.case_id` column is text and has no declared foreign key to a normalized case table. The existing Storage object path uses workspace UUID/document UUID/file name. A safe case-scoped migration must explicitly define how metadata, case IDs, and object paths relate before applying policy changes.
- Production still records 7 migrations and has no `case_assignments`, `role_permissions`, `practice_resources`, or `workspace_audit_log` tables in the inspected public schema. QA migrations cannot be replayed wholesale.
- The current Supabase security advisor reports leaked-password protection disabled. This remains the user's explicitly accepted exception for this work scope; it is not reported as fixed.

### Action taken

A fresh read-only reconciliation returned 1 document metadata row, 1 row with a storage path, 1 object in the private bucket, 1 exact metadata/object path match, 0 metadata rows without objects, and 0 objects without metadata. This is a very small sample and does not prove authorization correctness or broad path integrity.

This evidence is recorded as a release blocker. No Production SQL/DDL, RLS policy, Storage policy/object, Auth setting, or application deployment was changed by this inspection. The draft Storage hardening SQL remains unapplied because it is not a substitute for the missing case-level authorization model and has not passed isolated authenticated tests.

### Required pass evidence before changing the decision

1. A reviewed migration that introduces a normalized case identity and assignment/permission model without inventing assignments from legacy JSON.
2. A coordinated application migration away from relying on a single workspace-wide `workspace_state` JSON row for protected case data, or an equally strong server-enforced case-filtered API/RPC contract.
3. A metadata-to-case and metadata-to-Storage-object relationship with least-privilege policies.
4. Positive and negative authenticated tests for assigned/unassigned cases, cross-workspace users, finance permissions, document read/upload/delete, and failed upload/metadata compensation.
5. Migration/rollback rehearsal and browser E2E on the exact release candidate.
6. Verification of the actual live host's source branch and deployed commit SHA.

Static CI is green, but it does not cover any of these database or live-session requirements. The release remains **NO-GO**.


## QA-to-Production compatibility check — 2026-10-29 (read-only)

A new comparison of the live QA and Production migration histories and schemas confirms that this is not a simple migration replay:

- QA has **45 recorded migrations** in the current linked project; Production has **7**. The histories diverged early and the QA series includes role-permission, case-assignment, resource-backfill, finance-directory, legacy-state restriction, and multiple later security hardening migrations.
- QA currently has the expected authorization tables: `case_assignments` (4 rows), `role_permissions` (0 rows), `practice_resources` (46 rows), and `workspace_audit_log` (32 rows). Production does not have those tables in its public schema.
- QA's inspected `private.can_access_case(workspace_id, case_id)` allows active workspace admins and otherwise checks explicit `case_assignments` for the authenticated user. QA's `private.has_workspace_permission(workspace_id, permission_key)` grants active workspace admins or checks an allowed `role_permissions` row. These helpers depend on tables absent from Production; copying policies/functions alone would be incomplete and could fail or mis-authorize.
- QA's `practice_resources` is a separate case-linked resource model; Production's cloud-sync source remains the monolithic `practice_records.payload` JSONB row. The QA data model and current Production app contract are therefore not interchangeable.
- QA's current `role_permissions` table has zero rows in the inspected environment. Its existence does not itself prove a complete least-privilege role matrix has been populated and tested.

### Decision from this check

Do **not** replay QA migrations wholesale and do not apply the existing Storage hardening draft to Production. The safe next implementation step requires a disposable project cloned from the current Production schema, plus a reviewed additive migration and app contract changes. The existing linked QA project is not an equivalent Production-schema rehearsal target. No database writes were performed by this comparison.

The latest candidate static workflow #66 passed syntax and production safety smoke checks on `7b657b79de14a38e06a8bc75d5c90fb26ad59548`; it does not substitute for authenticated RLS/Storage tests. Release remains **NO-GO**.


## Follow-up candidate validation — 2026-10-29

- Added `scripts/auth-resolution.test.mjs` to exercise five mocked session-resolution scenarios: one active membership, inactive membership filtering, ambiguous active memberships, Admin-portal filtering, and no active membership.
- Updated `.github/workflows/production-safety.yml` to run the regression test in CI.
- Workflow #69 for candidate SHA `455913432380afeffc2c2c73848d2e2d014d56ba` passed syntax checks, production safety smoke checks, and the new mocked regression suite. Run: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40816507266
- Scope limitation: these tests use a mocked Supabase client; they do not establish live Supabase behavior, RLS/Storage enforcement, browser/mobile E2E, or hosting SHA. The release remains **NO-GO** until the mandatory blockers above are resolved and evidenced.


## Interim fail-closed guard added to release candidate — 2026-10-29

- In `app.html`, the candidate now blocks any workspace role other than `admin` before reading the monolithic `practice_records.workspace_state` payload. The gate displays a clear security message instead of exposing all cases to Advocate/Staff accounts.
- Added a production safety smoke assertion that checks the role guard exists and runs before the workspace-state query.
- This is an interim containment measure, **not** the final feature implementation. Advocate/Staff app access is intentionally unavailable until normalized case-scoped data and server-enforced assignment/permission checks are implemented and verified.
- Workspace Admin access is still scoped by existing workspace membership/RLS and is not proof of case-level isolation among non-admin users.
- The guard is on the release candidate branch only. It has not been deployed to the live host or applied to Production hosting.


## Cloud Sync status accuracy improvement — 2026-10-29

- The app shell previously displayed **Cloud: Synced** immediately after reading the workspace even when no `workspace_state` row existed. That could mislead a first-time user into believing the default/empty state had already been persisted.
- The release candidate now shows **Cloud: Ready — not saved yet** when no row exists; it shows **Cloud: Synced** only when a persisted row was read. A successful save still changes the status to Synced.
- Added a smoke-test assertion to prevent this false-success status from regressing. Workflow #76 passed the application change; Workflow #77 includes the new assertion and its test steps have passed so far. [Workflow #76](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40818016960) · [Workflow #77](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40818037270).
- This is a UI status-accuracy fix only; it does not prove the live Supabase save path works end-to-end.


## Newly confirmed database-level containment gap — 2026-10-29

A fresh read-only query against Production project `ykxfidrtvmkmmbxameji` enumerated the active RLS policies for `public.practice_records`, `public.case_documents`, and `storage.objects`.

- Production `practice_records` has permissive workspace-member policies for SELECT/INSERT/UPDATE/DELETE. No restrictive `workspace_state`-specific policy was present in the inspected policy set.
- QA has a restrictive policy named `practice_records_workspace_state_admin_only` that limits the monolithic `record_type='other', record_key='workspace_state'` row via `private.has_workspace_permission(..., 'users.manage')`. Production does not currently have that helper/model.
- The candidate's browser-side guard is useful containment but is not a database authorization boundary; direct authenticated API requests must be tested independently.
- Production also has workspace-member policies for `case_documents` and `storage.objects`; case-level checks are not yet enforced end-to-end in Production.

### Draft containment candidate added

`supabase/drafts/production-workspace-state-admin-only-hotfix.sql` adds a restrictive policy design that relies only on Production-existing `workspace_members` and `workspaces` columns, requiring the caller's own active Admin membership for the monolithic workspace-state row. The existing non-workspace-state rows are outside the policy's restrictive predicate.

**This SQL has NOT been applied to Production or QA and has NOT been executed in a disposable clone.** It is draft-only. Before any application, confirm the exact legacy row key, rehearse policy creation and rollback, and test real authenticated Admin/Advocate/Staff sessions against direct REST/API access. It intentionally blocks non-Admin workspace-state sync and is not a replacement for normalized case-level data access.

A static CI assertion now checks the shape and scope of this draft; static assertions do not prove PostgreSQL policy behavior. The release decision remains **NO-GO**.


## Read-only legacy payload inventory — 2026-10-29

The Production `workspace_state` rows were inspected without returning case/client names or financial/document contents. The query found **5 workspace-state rows**. Aggregate array counts observed across those rows: cases 9, clients 8, hearings 9, tasks 4, invoices 2, payments 2, meetings 1, discussions 1, communications 8, courts 0. Some workspaces omit the `communications` key entirely, and top-level key counts differ (9 or 10), so a migration must not assume identical payload keys across workspaces.

A reusable read-only query has been added at `supabase/drafts/production-workspace-state-inventory.sql`. It reports workspace ID prefixes, top-level keys, collection counts, and missing/duplicate case-ID counts only. It is an inventory tool, not a migration. Run it in a reviewed preflight and reconcile all anomalies before any data conversion.

## Latest CI status

- Workflow #84 passed on candidate commit `6e36153a98b885452c15b34421a5b937080e8eb4`: [Workflow #84](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40818940208).
- The workflow checks JavaScript syntax, safety assertions, and mocked workspace-resolution tests. It also statically checks the draft containment SQL structure.
- This pass does not execute the SQL against PostgreSQL or prove RLS behavior. The latest inventory SQL is read-only and draft-only; it has not yet been executed in a disposable clone.


The read-only inventory SQL was subsequently executed against Production successfully. It confirmed 5 workspace-state rows, 9 case entries, and **0 missing case IDs / 0 duplicate case-ID rows** in those 9 entries. This does not validate foreign-key references from hearings/tasks/documents, prove case assignment correctness, or authorize a migration; those checks remain required.


## Latest Storage-policy static guardrails — 2026-10-29

- Extended `scripts/production-safety-smoke.mjs` to assert that the Storage hardening candidate remains draft-only, requires authenticated sessions, matches exact object path/workspace/document identifiers to metadata, binds upload ownership to `auth.uid()`, requires workspace membership for uploads, fails closed for malformed path segments, and explicitly discloses the unresolved case-level authorization gap.
- Workflow #89 passed on commit `d28e285c07639837adcad2edd55b98a8ee3c6a1b`: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40819665268
- This is static/regex validation only. It does not execute the SQL against PostgreSQL, test real authenticated Storage sessions, verify rollback, or establish browser/mobile behavior.
- No Production or QA policy was applied. No billable disposable Supabase branch was created. The release decision remains **DRAFT / NO-GO**.
