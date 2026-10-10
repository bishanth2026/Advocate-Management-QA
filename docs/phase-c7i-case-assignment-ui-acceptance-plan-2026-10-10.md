# Phase C7I — Case Assignment UI Integration Acceptance Plan

**Scope:** QA repository branch `staging/advocatedesk-test` and isolated Supabase project `uqtsksgypncsbcnuanbk` only. Production must remain untouched.

## Current finding

The existing database functions are present:

- `public.assign_case_to_member(uuid, text, uuid)`
- `public.unassign_case_from_member(uuid, text, uuid)`

The latest call-site review did not find a browser/UI invocation of either RPC in the reviewed application files. The current case UI persists its legacy `appState` through `ADCloudSync.save` to `practice_records` / `workspace_state`. The role-management invitation flow uses `advocatedesk-provision-user`; it is not a case-assignment flow.

This is a verified source-review finding, not proof that no other unreviewed deployment or external client calls the RPCs.

## UI contract before implementation

Do not add assignment controls until the following design is approved and implemented on the QA branch:

1. Show assignment controls only when the signed-in actor is an Admin of the active workspace. Hiding the control is usability, not security; the database RPC must remain the enforcement boundary.
2. Load eligible workspace members from the active workspace only. Do not allow selecting arbitrary Auth user IDs or members from another workspace.
3. Display current case assignees from the canonical assignment relation, not a duplicate value stored only in `appState`.
4. Assign/unassign only by calling the existing RPCs with the case identifier, active workspace identifier, and selected member identifier in the exact parameter types defined by the database function.
5. Never insert, update, or delete `case_assignments` directly from the browser.
6. Disable duplicate submissions while an operation is pending; show a clear success or failure message; refresh canonical assignment state after success.
7. Fail closed when the active workspace is missing, membership is inactive, the target member is not eligible, or the RPC returns an authorization/validation error.
8. Do not optimistically show an assignment as saved before the RPC succeeds. Do not silently fall back to writing the legacy workspace snapshot.
9. Do not expose service-role credentials to the browser or put access tokens in logs.
10. Preserve unrelated case fields and navigation behavior. Assignment changes must not overwrite the full `workspace_state` snapshot.

## Required live QA fixture set

Use only dedicated disposable Auth identities and a newly created QA workspace, following `docs/phase-c7-disposable-qa-fixture-runbook.md`. Do not reuse real users or an existing workspace.

Required actors: Admin, assigned Advocate, unassigned Advocate, Accountant, non-member, and anonymous caller.

Required case states: one case assigned to an Advocate and one unassigned case. Verify assignment records are scoped to the test workspace. Do not seed until the dedicated identities and workspace are confirmed.

## RPC authorization matrix

| Actor / action | Expected result |
|---|---|
| Active workspace Admin assigns eligible workspace Advocate | Allowed; assignment and audit event are persisted |
| Active workspace Admin unassigns current Advocate | Allowed; assignment and audit event are persisted |
| Advocate attempts assignment or unassignment | Denied |
| Accountant attempts assignment or unassignment | Denied |
| Non-member attempts assignment or unassignment | Denied |
| Anonymous caller attempts assignment or unassignment | Denied |
| Admin supplies member from another workspace | Denied with no mutation |
| Admin supplies case from another workspace | Denied with no mutation |
| Invalid/missing IDs or inactive workspace | Denied with no mutation |
| Repeated assignment request | Deterministic idempotent behavior or a documented validation error; never duplicate assignment rows |

For each denied request, verify both the response and the database state. An HTTP error alone is insufficient evidence that no mutation occurred.

## Browser acceptance

- Admin sees assignment UI for a case; non-Admin roles do not.
- Admin assigns an Advocate; after refresh and re-login, the same assignment is shown.
- Admin unassigns; after refresh and re-login, no assignment remains.
- Network request invokes the named RPC and does not directly mutate `case_assignments`.
- RPC failure leaves the displayed canonical state unchanged and gives a useful message.
- Switching workspaces cannot retain stale assignee options or show another workspace's assignments.
- Assignment changes do not reset case details, other open modules, or the legacy workspace snapshot.
- Mobile layout remains usable at narrow viewport widths.

## Evidence and release gates

Before marking this feature complete, attach:

- Source diff and reviewer notes for the UI call site.
- CI run showing syntax and static contract tests passed.
- Real-JWT RPC results for every actor in the matrix.
- Before/after database evidence for allowed and denied mutations.
- Browser screenshots or a recorded manual run for assign, unassign, refresh, and re-login.
- A check that audit events were written.
- Confirmation that the test targeted only the isolated QA project.

Do not mark the feature PASS on static tests alone. The current environment has not yet demonstrated a real-JWT role matrix or browser end-to-end assignment flow.

## Current status

This file is an acceptance plan only. It does not add UI behavior, modify database functions or grants, create fixtures, or apply migrations. Production is untouched.
