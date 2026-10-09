# Phase C1 — Resource-Scoped Storage and Backfill Verification

**Date:** 10 October 2026  
**Scope:** QA branch `staging/advocatedesk-test` and isolated QA Supabase project `uqtsksgypncsbcnuanbk`. No production changes.

## Implemented

Migration: `supabase/migrations/20261010000300_practice_resources_backfill_phase_c1.sql`  
Commit: `8763325660484f2f2bebebeece8ac1a151f65de5`

- Added `public.practice_resources`, with one row per resource item, workspace scope, resource type, stable resource ID, optional case link, original JSON object, legacy source row, and content hash.
- Enabled RLS and added resource-type-aware SELECT/INSERT/UPDATE/DELETE policies using the Phase A permission helpers.
- Added explicit read permission keys for clients, hearings and tasks.
- Backfilled existing QA `workspace_state` collections into resource rows.
- Kept every legacy `practice_records.workspace_state` row intact. The app still reads and writes the legacy row; there is no cutover in this migration.

## Backfill reconciliation

A query compared each collection's source array length with the number of rows in `practice_resources`.

| Resource type | Source items | Copied rows | Difference |
|---|---:|---:|---:|
| Cases | 2 | 2 | 0 |
| Clients | 2 | 2 | 0 |
| Hearings | 2 | 2 | 0 |
| Tasks | 1 | 1 | 0 |
| Invoices | 1 | 1 | 0 |
| Payments | 1 | 1 | 0 |
| Meetings | 0 | 0 | 0 |
| Discussions | 0 | 0 | 0 |
| Courts | 0 | 0 | 0 |

All listed collection counts reconcile for the current QA data. This is a count reconciliation, not a full semantic checksum comparison across every original and copied collection.

## Security caveat — no application cutover yet

The browser application continues to SELECT and UPDATE the full shared JSONB workspace row. Existing workspace-level RLS still allows active members to access that full payload. Thus the newly created table does not yet protect the live app's data; it is a staging structure for the cutover.

Further, several case/client references in the legacy payload may use different representations (internal ID vs. case number). Before switching reads to the new table, reconcile all links and populate `case_assignments` with valid authenticated user IDs and case IDs. The current seed data has not been used to prove the authenticated role matrix.

## Next required work

1. Inventory every state collection and every mutation path in the app.
2. Resolve case/client/hearing/task relationships, including unlinked clients and records with missing case IDs.
3. Build an explicit assignment administration path, with server-side authorization and audit logging.
4. Update app bootstrap and module CRUD operations to use resource-scoped APIs; stop writing the entire workspace state after cutover.
5. Add a controlled migration/rollback mechanism and test preservation of stable IDs, invoice/payment links, calendar entries, and document links.
6. Run authenticated tests with real QA accounts for each role, including direct API attempts, cross-workspace isolation, unauthorized writes, and all existing regression workflows.
7. Promote only after independent acceptance; production remains unchanged.

## Status

- Resource-scoped schema: **installed in QA**.
- Backfill count reconciliation: **pass for current QA dataset**.
- Semantic relationship audit: **pending**.
- App read/write cutover: **pending**.
- Authenticated role matrix and browser regression: **pending**.
- Production release: **not performed**.
