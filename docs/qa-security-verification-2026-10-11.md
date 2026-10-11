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

## Snapshot-policy validation and QA deployment

The restrictive policy requiring `private.has_workspace_permission(workspace_id, 'users.manage')` for the exact `other/workspace_state` record was first tested inside a transaction and rolled back. After the new application bootstrap was deployed to the isolated QA site, the policy was applied persistently to the QA database via migration `20261011012626_restrict_legacy_workspace_state_to_admins_qa`.

Post-policy database role simulation:

| Actor | Snapshot rows visible | Resource rows visible |
|---|---:|---:|
| Workspace admin | 1 | 7 |
| Accountant | 0 | 0 existing rows; synthetic finance-only probe was visible |
| Advocate A | 0 | 2 (assigned case + linked task) |
| Advocate B | 0 | 2 (their assigned case + linked task) |
| Non-member | 0 | 0 |
| Anonymous | No SELECT grant; request denied | No protected rows |

The synthetic accountant invoice probe ran in a transaction and was rolled back. After the policy was installed, the accountant could still read the synthetic finance invoice, could not read case resources, and could not read the legacy snapshot. The anonymous query failed with permission denied on `practice_records`, as expected. The non-member saw no snapshot or resource rows.

The policy is now active in QA only. It is also recorded in `supabase/migrations/20261011012626_restrict_legacy_workspace_state_to_admins_qa.sql`. Production remains untouched.

## Application changes deployed to isolated QA

- `app.html` no longer requests `practice_records.workspace_state`.
- `resource-sync.js` loads only rows returned by `practice_resources` RLS and writes per-record inserts/updates/deletes with optimistic concurrency.
- The adapter rejects unknown state properties, missing IDs, duplicate IDs, and ambiguous case references. It preserves database case links when a legacy payload omits the relation.
- Mock-client tests verify that only `practice_resources` is used and that a row hidden by RLS is not deleted.
- GitHub Actions per-resource sync tests passed on the final code commit. The staging branch validation workflow and isolated GitHub Pages deployment both completed successfully after PR #13 was merged.

## Remaining Supabase Security Advisor findings

- `assign_case_to_member` and `unassign_case_from_member` remain SECURITY DEFINER functions and are still reported by the advisor. Their definitions were reviewed: they require an authenticated caller, verify the caller is an Admin in the selected active workspace, validate case/target membership, and write an audit log. Simulated direct calls by a non-admin advocate were denied with SQLSTATE `42501`; an admin assignment call succeeded inside a transaction that was rolled back.
- The functions are intentionally SECURITY DEFINER at present because `authenticated` has SELECT-only grants on `case_assignments` and `workspace_audit_log`; switching them to SECURITY INVOKER without first designing and testing admin-only write policies/grants would break assignment operations. Do not blindly revoke EXECUTE. A separate hardening change should either add narrowly scoped admin-only table policies/grants and convert to invoker, or route assignment through a trusted server/Edge Function.
- Supabase Auth also reports leaked-password protection disabled. This project setting was not changed by the database migration and requires a separate Auth configuration change.

## Release gate still open

1. Complete browser-session regression tests on the QA site for admin, accountant, assigned advocate, unassigned advocate, non-member, and anonymous actors.
2. Verify create/edit/delete operations for every module, including finance, cases, clients, hearings, tasks, calendar, courts, transactions, meetings, discussions, and case parties.
3. Verify conflict handling, refresh persistence, and that no role can recover the full snapshot through direct REST calls.
4. The restrictive snapshot policy is now active in QA; continue direct REST/RPC tests and browser-session regression checks.
5. Do not promote to production until all QA tests pass and rollback is verified.

The transactional policy test was rolled back; the separate QA migration was then applied and verified. Production remains untouched.
