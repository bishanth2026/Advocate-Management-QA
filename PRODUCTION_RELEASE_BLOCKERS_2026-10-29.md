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

A release-branch code change now fails closed if an account has anything other than exactly one active workspace membership, instead of silently selecting `members[0]`. The app shell and login pages have cache-busting versions updated so clients should request the candidate auth script. The static smoke assertion for the fail-closed guard and the candidate syntax/static CI passed in workflow run #62. This prevents ambiguous tenant selection but does **not** implement a workspace picker and is not live-verified. Multi-workspace users will be denied until a proper selector is implemented.

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
- [x] Candidate syntax/static smoke CI passed on code commit `17b225fc056e4ab6b582d40052c02b20ec52f199` (workflow run #62); this does not replace authenticated end-to-end or live-host testing.
- [ ] Live hosting source and deployed SHA verified.
- [ ] Exact candidate desktop/mobile end-to-end checks pass.
- [ ] Backup/restore passes before production customer data.
- [ ] Final release approval.

**Do not release to Production while any mandatory gate above remains open.**
