# Phase C3 — Relationship Audit and Safe Link Backfill

**Environment:** AdvocateDesk QA only. Production unchanged.

## Findings

The two QA workspaces contain two cases and two clients. The case records use a stable `clientId` that matches the client resource IDs. Hearing/task records already carry a `caseId`. The invoice carries a case reference, and the payment references the invoice.

## Applied backfill

A deterministic QA data update linked:
- Both client resources to their uniquely matching case using the case payload's `clientId`.
- The payment to its uniquely referenced invoice's case.

No case rows were modified and no ambiguous relationship was guessed. Resource link audit after update:
- cases: 2 total, 0 case-linked (expected; a case is the root resource)
- clients: 2 total, 2 linked
- hearings: 2 total, 2 linked
- tasks: 1 total, 1 linked
- invoices: 1 total, 1 linked
- payments: 1 total, 1 linked

This was a data-only update in QA, not a schema migration. The original `practice_records.workspace_state` source rows remain intact.

## Remaining risks

1. Case assignment table is empty; no positive role-based access test can pass until test users are assigned to cases.
2. Case/client IDs and all resource payload relationships still need validation across broader test fixtures.
3. The app continues to load/save the shared `practice_records.workspace_state` payload. Resource-scoped RLS does not protect app data until the app is cut over to resource-based reads/writes.
4. Assignment UI and live authenticated RPC tests are not yet complete.
5. A separate QA privilege-hardening SQL change was applied directly but its migration file was not successfully committed; repository/database migration parity remains outstanding.

## Next implementation stage

Build and test the resource API/client adapter without switching the current UI's persistence path yet. Only after read/write parity, role filtering, conflict handling and regression checks pass should the app's cloud bootstrap/save path be switched from the shared JSON row to `practice_resources`.
