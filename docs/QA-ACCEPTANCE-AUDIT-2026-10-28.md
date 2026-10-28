# QA Acceptance Audit — 28 October 2026

## Scope and safety boundary

Read-only inspection of the isolated QA Supabase project `uqtsksgypncsbcnuanbk`, the QA staging source branch `staging/advocatedesk-test`, and available GitHub workflow metadata. The operator has clarified that all records currently in QA are demo data, not real client/case data. No database rows, policies, storage objects, Auth settings, or production resources were changed by this audit. No production data was queried.

## 1. Authorization and demo-data integrity — structural checks

- PostgreSQL row-level security is enabled on all inspected application tables: `workspaces`, `workspace_members`, `practice_resources`, `practice_records`, `case_documents`, `case_assignments`, and `workspace_audit_log`. RLS is also enabled on the inspected Storage `objects` and `buckets` tables.
- Read-only integrity queries returned zero for:
  - `practice_resources` rows with no matching workspace;
  - `case_documents` rows with no matching workspace;
  - document metadata rows with no matching case resource in the same workspace;
  - duplicate `(workspace_id, resource_type, resource_id)` resource keys;
  - `case_assignments` rows with no matching workspace.
- The 40 `practice_resources` rows have object-shaped, non-null JSON payloads.
- **Demo-data observation:** 8 demo rows with `resource_type='case'` have an empty or null `case_id`. Because the operator confirms the current QA dataset is demo-only, this is not evidence of loss of real case data. It should be assessed as a demo-fixture/schema consistency issue and corrected in QA fixtures if the test contract requires a case ID.
- Earlier read-only Storage inspection found the `advocatedesk-documents` bucket is private and the 3 document metadata rows link to existing objects and matching case resources. The operator has reported the live view/download, cross-workspace denial, and unauthorized-delete checks complete; these remain operator-reported because sanitized request/response evidence was not attached.

## 2. Live authorization regression evidence

The existing GitHub Actions browser regression run [40503259909](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40503259909) passed the inspected live-session tests for:
- active same-workspace Admin access to the advocate directory;
- Advocate denial/empty result;
- foreign-workspace Admin directory query denial/empty result;
- cross-workspace `practice_resources` read denial;
- non-admin assignment/unassignment denial and cross-workspace assignment denial.

These tests predate the most recent QA-only resource-membership policy migration. They do not establish inactive-workspace denial, a true non-member RPC attempt, browser refresh/re-login persistence, or live concurrent edit conflict behavior. They must not be described as covering those gaps.

## 3. Persistence and concurrent edits

- QA `auth.js` configures Supabase Auth with `persistSession: true` and `autoRefreshToken: true`. This is source configuration evidence only, not a live refresh/re-login test.
- The existing persistence contract test intentionally keeps the resource-store cutover disabled pending parity, deletion, concurrency, and authenticated RLS acceptance.
- The existing transactional-save test is explicitly a reference-model test, not a live Supabase/Postgres concurrency test.
- Therefore, browser refresh/re-login persistence, simultaneous edit/conflict handling, and delete/recovery are still **not verified**. Use demo-only fixtures and disposable QA accounts for these checks. Do not switch the resource-store cutover on until these tests pass.

## 4. QA–Production separation

- QA app source `auth.js` points to `https://uqtsksgypncsbcnuanbk.supabase.co` and is explicitly marked test-only.
- The known production Supabase project `ykxfidrtvmkmmbxameji` is named `Advocate_Management`, is ACTIVE_HEALTHY, and is in `ap-southeast-1`; QA is `uqtsksgypncsbcnuanbk` in `ap-south-1`. Project IDs and regions differ.
- The QA source repository `bishanth2026/Advocate-Management-QA` exists separately from other Advocate repositories. The exact production repository/deployment mapping, live production key references, and all deployment targets were not conclusively established in this audit; do not assume a similarly named repository is the production source.
- GitHub API metadata reports the QA repository's `main` branch is not protected and has no required status checks. Branch-protection/ruleset coverage for the actual release branch and production repository remains unverified. This is a release-control gap.

## 5. Current Security Advisor and plan limitation

Latest QA Security Advisor still reports:
1. `public.qa_list_workspace_advocates(uuid)` is executable by `authenticated` as a SECURITY DEFINER function. The app requires this RPC for the Admin assignment picker; its active Admin/workspace guard is a mitigation, but the warning remains open pending design review and inactive/non-member runtime tests.
2. Leaked-password protection is disabled. The operator has deferred enabling it because the project uses the Supabase Free plan. This warning remains open; it is not marked resolved.

## Required follow-up

1. Review the 8 demo rows with missing `case_id`; decide whether the demo fixtures should include case IDs and correct only the QA fixture data if needed. This is a test-data quality issue, not evidence of real data loss.
2. Run focused live-session checks against the latest policy using disposable QA accounts and demo fixtures: active Admin success; Advocate and true non-member denial; inactive target workspace denial; confirm PUBLIC/anon cannot execute the RPC.
3. Retain sanitized evidence for document view/download, cross-workspace denial, and unauthorized delete. Do not store passwords, access tokens, signed URLs, or document contents.
4. Run real browser refresh/re-login persistence and simultaneous edit/conflict tests with demo records; test deletion/recovery without touching real user data.
5. Identify the exact production repository and deployment target; verify branch protections, secret/config separation, and project references before any release.
6. Keep leaked-password protection as an explicit deferred security blocker while the Free plan limitation applies.

## Decision

**NO-GO for production release.** Structural checks found no orphaned workspace/document/case links or duplicate resource keys in the queried sets. The 8 missing `case_id` values are demo-data consistency observations, not real-data loss. Live persistence/concurrency tests, remaining authorization edge cases, and release-separation checks remain open. No production system was changed.
