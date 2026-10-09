# Phase C4 — Resource Store Adapter (QA, Not Activated)

**Environment:** `staging/advocatedesk-test` and QA Supabase only. Production remains unchanged.

## Files added

- `resource-store.js` — defines `window.ADResourceStore.load(client, workspaceId)` and `save(client, workspaceId, state)`.
- `tests/resource-store.test.js` — Node smoke test using a fake Supabase client.

## Adapter safeguards

- Reads only from `practice_resources` for the supplied workspace ID; server RLS still determines which rows the authenticated role can see.
- Maps resource rows into the existing state collection names.
- Writes via resource-scoped upserts keyed by `workspace_id,resource_type,resource_id`.
- Never bulk-deletes records missing from the caller's state, because role-filtered reads make destructive reconciliation unsafe.
- Resolves case references from stable IDs or a unique case label; ambiguous labels are not guessed.
- The adapter is not included by `app.html` and is not called by the existing app. This is intentional: switching persistence before compatibility and role testing could break existing features or expose/overwrite data.

## Verification status

The smoke test source was added, but it has **not been executed in a real browser or against authenticated Supabase sessions**. No claim of passing runtime tests is made. Next verification should run the Node smoke test in the QA repository environment, then add real authenticated RLS tests for Admin, assigned Advocate, unassigned Advocate, Clerk, Accountant and Staff.

## Known blockers before cutover

1. App state shape and resource payload IDs need full parity checks across every module.
2. Existing `app.js` currently expects one shared payload; saving role-filtered state to resource tables must not be enabled globally without per-role module handling.
3. Assignment UI and authenticated assignment RPC tests remain incomplete.
4. The direct privilege-hardening SQL still needs its matching repository migration file.
5. Production remains on its current code and schema; no production deployment has occurred.
