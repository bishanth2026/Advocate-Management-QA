# Phase C5 — Resource Adapter Hardening and Automated Test Setup

**Environment:** QA branch `staging/advocatedesk-test`. The adapter remains disconnected from the application. Production is unchanged.

## Changes

1. Hardened `resource-store.js` relationship mapping:
   - Builds the case index from the state passed to `save`, not from a stale global.
   - Derives client-to-case links only when a case uniquely references the client via `clientId` or `clientIds`.
   - Derives payment-to-case links through the referenced invoice.
   - Resolves display case labels only when they uniquely match a case.
   - Does not guess ambiguous links.
2. Expanded `tests/resource-store.test.js` to cover workspace filtering, case/client/hearing/invoice/payment relationship mapping, stable ID validation, invalid collection input, no destructive delete behavior, and surfaced write errors.
3. Added `.github/workflows/resource-store-tests.yml` to run the Node unit tests automatically on relevant QA-branch pushes and pull requests.

## Verification status

The code and workflow have been committed. I have not retrieved a GitHub Actions run result, so the tests are **not yet reported as executed or passing**. The tests use a fake Supabase client and cannot prove real RLS enforcement.

## Security and release status

- `resource-store.js` is still not loaded by `app.html`.
- Existing app persistence still uses the shared JSON `practice_records.workspace_state` record.
- Real authenticated role/RLS tests and full app regression are still required.
- No production files or production database changes were made.

## Next

Check the workflow run result, fix any test failures, then plan a controlled read-only QA integration test for an Admin and restricted roles. Do not activate writes until row visibility, relationship parity, concurrency/conflict handling, and every module's regression tests have been demonstrated.
