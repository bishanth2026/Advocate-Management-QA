# AdvocateDesk QA Phase B Verification and Phase C Plan

**Date:** 10 October 2026  
**Environment:** QA repository `staging/advocatedesk-test`; QA Supabase project `uqtsksgypncsbcnuanbk`. Production remains unchanged.

## Phase B changes

Migration: `supabase/migrations/20261010000200_role_document_access_enforcement.sql`  
Commit: `ea1a582ce0600183d8fe15ce4d62be67b219671c`

The migration replaces workspace-membership-only policies for `case_documents` with policies requiring:
- `documents.view` plus authorized case access for SELECT;
- `documents.upload`, authorized case access, and `uploaded_by = auth.uid()` for INSERT;
- `documents.delete` plus authorized case access for DELETE.

It also replaces Storage object read/delete policies so an object must have matching `case_documents.storage_path` metadata and the caller must have the corresponding permission and case access. Storage upload requires an active workspace member and `documents.upload`.

## Database verification completed

- Confirmed the three new `case_documents` policies exist.
- Confirmed the three new Storage policies exist.
- Confirmed `role_permissions` and `case_assignments` are RLS-enabled and have no client INSERT/UPDATE/DELETE policies.
- Called both authorization helpers with a null authenticated identity context; both returned false for an unknown workspace/case. This is an anonymous-context smoke check only, not a full authenticated role test.
- No real-user positive/negative browser tests have been run yet.

## Important implementation limitation

The app still fetches and saves a single `practice_records` row with `record_key='workspace_state'`, containing cases, clients, hearings, tasks, invoices, payments, and other state in one JSON payload. Existing workspace-level RLS still permits active members to read that whole payload. Therefore the new document rules do **not** yet guarantee finance/case separation or full module-level RBAC.

Do not describe the system as fully secured until this shared payload is removed or mediated and negative tests pass.

## Phase C — required transition before module RBAC

1. Inventory every read/write of `practice_records` and every state collection used by the UI.
2. Define a normalized, workspace-scoped resource model for cases, clients, hearings, tasks, invoices, payments, and other sensitive resources. Preserve stable IDs and relationships.
3. Design a reversible/backfillable migration that copies existing JSON collections into normalized resources, with row counts and content checksums before any cutover.
4. Implement resource-specific RLS using workspace membership, permission keys, and case assignment. Finance resources must not be readable by non-finance roles; case notes/files must not be exposed to Accountant by default.
5. Update cloud bootstrap and each UI module to use the resource APIs. Do not continue syncing the full `workspace_state` after cutover.
6. Keep a controlled compatibility/rollback path until the normalized copy has been verified. Do not delete legacy payloads in the first migration.
7. Test each role with actual authenticated QA accounts, including direct PostgREST requests and UI paths. Include cross-workspace tests and unauthorized INSERT/UPDATE/DELETE attempts.
8. Run calendar, Case 360, case/client management, finance, documents, user administration, and Super Admin regression tests.
9. Only after evidence-based QA acceptance should reviewed changes be considered for production.

## Required negative tests

- Accountant cannot read full case payloads, case notes, unrelated documents, or modify hearings/cases.
- Clerk cannot read invoices/payments or finance reports.
- Junior Advocate cannot access an unassigned case by direct API request or URL.
- Staff cannot grant permissions, self-assign cases, or change workspace membership.
- Workspace A users cannot read or mutate Workspace B data.
- Office Admin cannot grant platform Super Admin privileges.
- Super Admin cannot load or write office practice records.
- Authorized roles retain expected workflows after cutover.

## Acceptance status

- Permission foundation: **installed in QA**.
- Case-document and Storage policy changes: **installed and policy definitions verified in QA**.
- Anonymous helper smoke check: **pass**.
- Authenticated role matrix / browser regression: **not yet run**.
- Shared-state removal and module-level data isolation: **not implemented**.
- Production promotion: **not approved / not performed**.
