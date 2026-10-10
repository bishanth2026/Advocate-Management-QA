# AdvocateDesk QA Cutover Parity Snapshot — 10 October 2026

## Scope
Read-only reconciliation against isolated QA Supabase project `AdvocateDesk-Test` (`uqtsksgypncsbcnuanbk`) and branch `staging/advocatedesk-test`. No production repository or production database was accessed or modified.

## Latest automation
- QA validation passed on commit `5f7cbc7acf21474e13d5d2b2ad6e565c4d698ace`: [run #38030919747](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38030919747).
- QA Pages deployment passed on the same commit: [run #38030919754](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38030919754).

## QA-only policy update
Migration `20261010000900_case_scoped_meeting_discussion_policies.sql` has been committed and applied to the QA database. Case-linked meetings and discussions can be read by users with the corresponding assigned-case view permission, while unlinked rows remain restricted to the relevant `view_all` permission. Case-linked writes/deletes also check case access, except that `view_all` can authorize access where intended.

The policy catalog query confirmed the updated four command policies are installed. This is a catalog verification, not a substitute for authenticated RLS integration tests.

## Read-only data parity snapshot
The two existing QA workspaces were checked by comparing array lengths in each legacy `workspace_state` payload with row counts in `practice_resources` for the matching resource type.

| Resource | Workspace A legacy / resource | Workspace B legacy / resource |
|---|---:|---:|
| Cases | 1 / 1 | 1 / 1 |
| Clients | 1 / 1 | 1 / 1 |
| Hearings | 1 / 1 | 1 / 1 |
| Tasks | 1 / 1 | 0 / 0 |
| Invoices | 1 / 1 | 0 / 0 |
| Payments | 1 / 1 | 0 / 0 |
| Meetings | 0 / 0 | 0 / 0 |
| Discussions | 0 / 0 | 0 / 0 |
| Courts | 0 / 0 | 0 / 0 |
| Transactions | 0 / 0 | 0 / 0 |
| Case parties | 0 / 0 | 0 / 0 |

The legacy JSON key inventory contains only `cases`, `clients`, `courts`, `discussions`, `hearings`, `invoices`, `meetings`, `payments`, and `tasks` in both QA workspace states. The snapshot showed count parity for the currently present arrays.

**Important limitation:** count parity does not prove payload equality, correct relationship resolution, delete semantics, full application compatibility, or role-based visibility. It is a useful baseline, not release approval.

## Remaining blockers
1. `app.html` still does not load `resource-store.js`; the UI still reads/writes the workspace-wide `practice_records` aggregate.
2. No separate authenticated Admin and Advocate/Staff browser sessions have been used for allow/deny RLS acceptance tests. QA currently has zero case assignments, so assigned-member access must be tested through the authorized Admin workflow.
3. Payload-by-payload reconciliation and relationship checks remain required, including ambiguous/missing case links.
4. Documents/Storage policies, cross-workspace isolation, assignment audit events, refresh/re-login, concurrent updates, and deliberate deletion behavior remain unverified.

## Decision
**Continue to block resource-store cutover and production release.** Current QA workflows pass and the latest QA-only RLS migration is installed, but the live UI has not been cut over and authenticated integration tests are not complete.
