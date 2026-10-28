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
