# AdvocateDesk QA Security Verification — 2026-10-11

Scope: isolated QA project `AdvocateDesk-Test` (`uqtsksgypncsbcnuanbk`) and the `staging/advocatedesk-test` code baseline. Production was not accessed or changed.

## Data reconciliation

- Legacy workspace snapshots inspected: 3 across 3 workspaces.
- Records represented by mapped collections in those snapshots: 11.
- Before correction, 2 records were missing from `practice_resources` (one case and one client).
- Inserted only those 2 missing rows with an idempotent `ON CONFLICT DO NOTHING` operation. The client was linked to its single case using the explicit case `clientId` reference.
- Corrected the newly backfilled case row so its own `case_id` is null, matching the table's case-row convention.
- Post-correction comparison: 0 missing rows, 0 payload mismatches, 0 legacy-record-link mismatches.
- All 5 existing `qa-c7h-20261011-run-001-*` fixture rows were preserved. No existing resource payload was overwritten and no resource row was deleted.

## RLS simulation results

Tests used database transactions with `SET LOCAL ROLE authenticated` and the relevant QA user's JWT claim values. These are database-level role simulations, not independent browser sessions.

| Actor | Legacy snapshot rows visible before draft policy | `practice_resources` rows visible in test workspace |
|---|---:|---:|
| Workspace admin | 1 | 7 |
| Accountant | 1 | 0 existing rows; synthetic finance-only probe was visible |
| Advocate A | 1 | 2 (assigned case + linked task) |
| Advocate B | 1 | 2 (their assigned case + linked task) |

The synthetic accountant probe ran inside a transaction and was rolled back. It confirmed the accountant could read a finance invoice resource and could not read case resources, while still seeing the whole legacy snapshot. This isolates the bypass: the resource policies scope data correctly, but the legacy snapshot policy defeats those restrictions.

## Draft snapshot-policy validation

A restrictive policy requiring `private.has_workspace_permission(workspace_id, 'users.manage')` for the exact `other/workspace_state` record was created and tested inside a transaction, then rolled back.

- Accountant: snapshot rows visible = 0.
- Admin: snapshot rows visible = 1.
- The policy is only a draft under `supabase/drafts/`; it is not installed in the QA database.
- It must be applied only after the new application bootstrap is deployed and real-session tests confirm that the app no longer depends on the legacy snapshot.

## Application changes in draft PR #13

- `app.html` no longer requests `practice_records.workspace_state`.
- `resource-sync.js` loads only rows returned by `practice_resources` RLS and writes per-record inserts/updates/deletes with optimistic concurrency.
- The adapter rejects unknown state properties, missing IDs, duplicate IDs, and ambiguous case references. It preserves database case links when a legacy payload omits the relation.
- Mock-client tests verify that only `practice_resources` is used and that a row hidden by RLS is not deleted.
- GitHub Actions per-resource sync tests passed on commit `575712dbf1948132b70e04517c85ce562638510b`; the latest policy-draft commit's check should also be confirmed before promotion.

## Release gate still open

1. Complete browser-session regression tests on the QA site for admin, accountant, assigned advocate, unassigned advocate, non-member, and anonymous actors.
2. Verify create/edit/delete operations for every module, including finance, cases, clients, hearings, tasks, calendar, courts, transactions, meetings, discussions, and case parties.
3. Verify conflict handling, refresh persistence, and that no role can recover the full snapshot through direct REST calls.
4. Only then apply the restrictive snapshot policy in QA and repeat direct REST/RPC tests.
5. Do not promote to production until all QA tests pass and rollback is verified.

No policy change was left installed by the transactional policy test. Production remains untouched.
