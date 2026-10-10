# Phase C7K — QA Deployment and Test Identity Provisioning Review

Date: 2026-10-10. Scope is the isolated AdvocateDesk-Test Supabase project and `staging/advocatedesk-test` branch only. Production remains untouched.

## Latest workflow verification

The prior QA advisor-review commit (`9c6a337057c2147cd9362dd8d6bf910b400a63b5`) has both workflows completed successfully:

- Validation run: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38054293543
- QA Pages deployment: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38054293508

These are static CI and Pages deployment results; they do not mean the role authorization matrix or case assignment browser flow has passed.

## Test identity provisioning review

The isolated project currently exposes the active Edge Function `advocatedesk-provision-user` (version 6, JWT verification enabled). Its source checks the caller's authenticated identity and requires `profiles.platform_role = 'super_admin'` before performing provisioning actions. The `invite_member` path permits only the approved non-Admin workspace roles: `advocate`, `junior_advocate`, `clerk`, `accountant`, and `staff`; it requires an existing workspace ID and valid email. Admin invitations use the separate `invite_admin` action and require a workspace name.

This endpoint is a privileged provisioning workflow, not a test fixture generator. Do not call it with guessed identities, do not create real-looking test users without controlled test inboxes, and do not bypass its Super Admin check. No invitations or Auth users were created during this review.

## Blocker to live authorization tests

To run the required matrix, an authorized project operator must create or invite dedicated disposable accounts through the supported dashboard/app workflow and confirm the inboxes are controlled test addresses. Required identities: Admin, assigned Advocate, unassigned Advocate, Accountant, and non-member. Anonymous requests need no account. Then provision a new QA-only workspace, add only the appropriate members, seed the two case and three task fixtures transactionally, and run the existing GET-only authorization harness using short-lived JWTs kept locally and untracked.

Do not use the service-role key as an actor token. Do not commit JWTs or place them in issue comments. Stop if the target project is not exactly `AdvocateDesk-Test` or any account/workspace ID is uncertain.

## Next acceptance gates

1. Verify test identities and their role/workspace membership.
2. Run the read-only role matrix and record PASS/FAIL/SKIP distinctly.
3. Test assignment RPCs with real JWTs and verify database state before/after allowed and denied calls.
4. Implement assignment UI integration on the QA branch only, then test assign/unassign, refresh, re-login, workspace switching, and mobile layout.
5. Re-run CI and Pages deployment; do not claim browser acceptance based on CI alone.

## Changes made

This document only. No database write, migration, function deployment, grant change, Auth setting change, invitation, or production change was made.
