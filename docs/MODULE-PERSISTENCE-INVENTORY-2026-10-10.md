# AdvocateDesk Module Persistence Inventory — QA Only
Date: 10 October 2026
Branch: `staging/advocatedesk-test`

## Purpose
Inventory the state contract before enabling `ADResourceStore`. This is a read-only code audit; it does not switch the app's persistence path or change production.

## Bootstrap and authoritative state today
- `app.html` loads the Supabase client and `auth.js`, validates the session, then reads one `practice_records` row with `record_type='other'` and `record_key='workspace_state'` for non-Super-Admin users.
- `app.html` defines `ADCloudSync.save(state)`, which updates the whole JSON payload using an `updated_at` compare-and-swap check.
- `app.html` does not load `resource-store.js`.
- `app.js` initializes `window.appState` from `ADCloudInitialState` and `saveAdvocateDeskState` ultimately writes the whole state through `ADCloudSync.save`.
- The app currently initializes these state arrays: `cases`, `clients`, `hearings`, `tasks`, `discussions`, `meetings`, `payments`, `invoices`, and `courts`. The resource adapter also defines `transactions` and `caseParties`.
- `cases.js` explicitly edits `caseParties`; it writes through `window.saveAdvocateDeskState`.
- `finance.js` and core app logic use `window.appState`; `task.js` reads app state with a localStorage fallback; `calendar.js` reads the shared app state and derives calendar events from hearings, meetings and tasks.
- The QA validation workflow checks syntax, runs resource-store fake-client tests, and runs static security smoke checks. It is not a real browser/authenticated RLS integration suite.

## Resource contract mapping
| App state key | DB resource type | Current UI module evidence | Important parity concerns |
|---|---|---|---|
| `cases` | `case` | `app.js`, `cases.js` | Must retain stable case IDs and assignment relationships. |
| `clients` | `client` | `app.js`, finance autocomplete | Client visibility may depend on associated case and role; orphan clients need explicit policy. |
| `hearings` | `hearing` | `app.js`, `calendar.js`, `hearing-filter.js` | Must retain case link, date/time and court. |
| `tasks` | `task` | `app.js`, `task.js`, `calendar.js` | Must retain due dates, status and case link. |
| `invoices` | `invoice` | `app.js`, finance module | Finance permissions; client/case relationships must be normalized. |
| `payments` | `payment` | `app.js`, finance module | Finance permissions; invoice and case links must be retained. |
| `transactions` | `transaction` | finance/state adapter contract | Not included in the current `app.js` empty-state defaults; ensure consumers initialize safely. |
| `meetings` | `meeting` | `app.js`, `calendar.js`, client-management | Case-linked visibility; orphan meetings need explicit admin-only handling. |
| `discussions` | `discussion` | `app.js` | Case link and confidentiality must be preserved. |
| `courts` | `court` | `app.js` | Workspace-level lookup data; confirm whether editable courts are persisted elsewhere too. |
| `caseParties` | `case_party` | `cases.js` | UI currently keys party linkage by case number; adapter must resolve to stable case ID or deny. |

## Critical issues to resolve before cutover
1. **Deletion parity:** adapter saves are upsert-only and deliberately do not delete missing rows. A UI delete would therefore leave the database row in place and it may reappear after reload. Do not add broad delete-by-workspace or infer deletions from role-filtered arrays. Implement explicit, stable-ID, permission-checked deletion actions and tests.
2. **Partial visibility versus state completeness:** a member's resource query will return only rows allowed by RLS. That filtered state must never be treated as the full workspace state for deletion, overwrite, or counts.
3. **Case relationship normalization:** UI fields sometimes use case number/title, while policies require `case_id`. Normalize once using workspace + stable case ID; unresolved/ambiguous records must be reported for admin reconciliation, not silently attached.
4. **Orphan records:** client, meeting and discussion records without a case link need a documented visibility rule. A policy that only permits assigned-case access will intentionally hide unlinked records from members.
5. **Unknown and transient state:** preserve all fields used by all screens, including any non-array preferences or settings not yet mapped. Do not load the adapter's narrower `EMPTY` object and then overwrite the legacy payload.
6. **Concurrency:** keep the existing compare-and-swap/conflict behavior or provide equivalent resource-level conflict handling. Add two-session tests.
7. **Real authorization tests:** test with separate authenticated QA Admin and member sessions, including assigned/unassigned cases, finance restrictions, case guessing, cross-workspace access and assignment changes. Fake Supabase unit tests are not sufficient.

## Recommended migration sequence
1. Add a schema/state-contract test that enumerates known state keys and fails when a module introduces an unmapped persistent field.
2. Add adapter tests for duplicate IDs, unresolved case references, filtered-load preservation, explicit deletion, and conflict/error propagation.
3. Build a read-only parity utility that compares canonical payloads and relationships, not only counts, and outputs discrepancies without modifying data.
4. Use a dedicated QA workspace with known Admin/member users and at least two cases: one assigned and one unassigned. Record the expected allow/deny matrix.
5. Only after tests pass, integrate the adapter behind a QA-only feature flag, initially read-only. Compare displayed data with the legacy path without writing either store.
6. Enable resource writes only after parity and RLS tests pass; use explicit deletion operations and audit events. Retain rollback capability and legacy snapshots until sign-off.

## Decision
**Do not cut over yet.** Current QA workflows pass, but the app still uses aggregate persistence, adapter deletion semantics are intentionally incomplete, and authenticated RLS acceptance tests have not been demonstrated. Production remains untouched.
