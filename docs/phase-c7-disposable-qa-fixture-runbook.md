# Phase C7 — Disposable QA identity and fixture runbook

**QA project only:** `uqtsksgypncsbcnuanbk`  
**Branch:** `staging/advocatedesk-test`  
**Never use this procedure on production.**

## Why this is needed

The current QA database has no case assignments and only one task resource, so the authenticated role matrix cannot run. The test suite needs real, separate Supabase Auth users and fixture rows. Do not reuse an ordinary user's account or invent UUIDs.

## A. Create dedicated disposable Auth users

In the Supabase Dashboard for the isolated AdvocateDesk-Test project:

1. Open **Authentication → Users** and create five dedicated test users using controlled test inboxes: `qa-admin`, `qa-assigned-advocate`, `qa-unassigned-advocate`, `qa-accountant`, and `qa-nonmember`.
2. Use the dashboard's supported invite/create flow. Complete email confirmation if required by the project's Auth settings.
3. Copy each Auth user UUID from the Users page. Do not copy access tokens into GitHub, issue comments, or this repository.
4. Use a separate temporary client session to sign in as each test user and obtain a short-lived access token locally. Keep tokens in a local, untracked `.env` file only. Do not use a service-role key in the HTTP harness.
5. Anonymous coverage uses the project's anon key with no user token; it does not need a sixth account.

Do not proceed if any of these accounts are real end users, belong to another environment, or cannot be cleaned up.

## B. Provision an isolated workspace and fixture data

Use the Supabase SQL Editor only after confirming the dashboard project name and URL are **AdvocateDesk-Test**. The SQL Editor is privileged, so the operator must review every substituted UUID before running any setup SQL.

Create one new workspace owned by the disposable Admin. Add the two advocate users and the accountant as members with their corresponding roles. Keep the non-member user out of `workspace_members`. Use only the new workspace; do not add these users to an existing workspace.

Fixture shape required:

| Fixture | Required shape |
|---|---|
| Assigned case | A `practice_resources` row with `resource_type='case'`, stable `resource_id`, and unique QA-only case identifier |
| Unassigned case | A second case row with a different stable identifier |
| Unlinked task | A task row with `case_id IS NULL` |
| Assigned task | A task row whose `case_id` equals the assigned case identifier |
| Other-case task | A task row whose `case_id` equals the unassigned case identifier |
| Assignments | Assign only the first case to the assigned Advocate and only the second case to the unassigned Advocate |

Use unique fixture IDs with a prefix such as `qa-c7h-` and a run-specific suffix. Record the workspace ID, both case IDs, and all three task IDs in a local note. Verify the resource relationships before testing. Do not store any JWTs in the note or repository.

**Important:** the SQL setup must be a single transaction and must fail if any supplied Auth UUID is missing, any fixture ID already exists, or the workspace is not newly created. Never run a partial seed by manually selecting only some statements.

## C. Run the read-only authorization matrix

Configure these environment variables locally for the harness in `tests/qa-authz-http.test.js`:

- `QA_SUPABASE_URL` and `QA_SUPABASE_ANON_KEY`
- `QA_WORKSPACE_ID`, `QA_ASSIGNED_CASE_ID`, `QA_UNASSIGNED_CASE_ID`
- `QA_UNLINKED_TASK_ID`, `QA_LINKED_ASSIGNED_TASK_ID`, `QA_LINKED_UNASSIGNED_TASK_ID`
- `QA_ADMIN_JWT`, `QA_ASSIGNED_ADVOCATE_JWT`, `QA_UNASSIGNED_ADVOCATE_JWT`, `QA_ACCOUNTANT_JWT`, `QA_NONMEMBER_JWT`, `QA_ANON_JWT`

Run `node tests/qa-authz-http.test.js` only against the exact isolated QA hostname enforced by the harness. This harness performs GET requests only. Run it first against current policy to capture baseline behavior; after any reviewed migration, run it again and compare expected outcomes.

Expected visibility: Admin can read all three tasks; each Advocate can read only the task on their assigned case; neither Advocate can read the unlinked task or the other Advocate's case task; Accountant, non-member, and anonymous requests are denied or return an empty result.

Do not claim the suite passed if it printed `SKIP`.

## D. Cleanup

After evidence is saved, delete only the dedicated QA workspace and its associated test rows in the isolated QA project, then delete the five disposable Auth users through the dashboard. Workspace deletion cascades must be verified against the actual foreign keys first. If cleanup is not proven safe, leave the isolated fixtures disabled and documented rather than running a broad delete.

## E. Stop conditions

Stop before any write if the target project URL/name does not match the isolated QA project, any UUID is uncertain, a fixture key already exists, or the workspace contains non-test data. Never run these steps in production.

## Current status

This runbook is documentation only. No Auth users, workspace memberships, assignments, resources, or migrations were created by committing it.
