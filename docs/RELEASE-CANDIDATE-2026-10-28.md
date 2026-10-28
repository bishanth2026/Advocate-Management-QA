# AdvocateDesk Release Candidate — 2026-10-28

## Candidate branch
`release-candidate/2026-10-28`

## Scope
This branch freezes the current QA candidate and its release checklist for review. It is not a Production deployment.

## Known included fix
- Finance invoice/payment Update navigation remains in Finance.
- Fix commit: `ea54b34eeca6f94e1c33c463e3cee8dadc9d6da5`

## Required before Production
1. Verify this candidate branch includes the intended latest QA changes and no QA-only configuration or demo-only behavior is exposed in Production.
2. Confirm hosting deployment target, production branch and environment variables.
3. Run browser acceptance tests for Finance update, KPI refresh, persistence, login/logout and multi-device sync.
4. Re-run role and cross-workspace authorization tests, including document open/download isolation.
5. Confirm Supabase production project and backup/rollback procedure.
6. Review the SECURITY DEFINER workspace-advocates function and record the leaked-password-protection limitation.
7. Obtain successful automated checks and human approval.

## Decision
**HOLD / NO-GO for Production until all mandatory checks pass.**

No Production database, Supabase policy, authentication setting, or deployment target was changed as part of preparing this candidate.

## Follow-up review — 2026-10-28

I rechecked the release-candidate branch, PR #33, branch comparisons, release-gate report, and the workflow configuration.

### Verified state
- PR #33 remains a **Draft**, targeting `staging/advocatedesk-test`; it contains only the release-candidate handoff document.
- `release-candidate/2026-10-28` is diverged from `main` (400 ahead / 23 behind) and `production/advocatedesk-final` (390 ahead / 28 behind). A wholesale merge is not safe.
- The candidate contains extensive QA-specific code, workflows, test fixtures and Supabase migrations. QA-only migrations/configuration must not be copied to Production without a separate compatibility/security review.
- The release-gate report records two current Security Advisor warnings: authenticated execution of `public.qa_list_workspace_advocates(uuid)` as SECURITY DEFINER, and disabled Leaked Password Protection. These remain open.
- Browser-level refresh/re-login persistence and concurrency/conflict tests remain unverified in the current release gate.
- The connector returned no workflow runs associated with the candidate commit, which is not evidence of either pass or failure. Current checks must be triggered/inspected on the actual target branch before a release decision.

### Next safe actions
1. Keep this PR draft and QA-only; do not merge it into `main` or `production/advocatedesk-final`.
2. Trigger/inspect validation and real-browser regression on the QA staging branch after confirming the latest candidate changes are present.
3. Capture sanitized real-session evidence for document cross-workspace denial, refresh/re-login persistence, concurrency/edit conflict and deletion/recovery.
4. Address or explicitly disposition each Security Advisor warning in QA, enable and verify Leaked Password Protection through the supported QA Auth settings, and repeat tests.
5. Verify production repository/project/keys/deployment mapping and backup/rollback separately; then selectively port only reviewed fixes, never the whole branch.

**Decision: NO-GO for Production until the above release gates are evidenced.** No production code, database, Auth settings, RLS policies or hosting were changed during this follow-up.
