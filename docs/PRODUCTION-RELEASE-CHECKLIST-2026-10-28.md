# AdvocateDesk Production Release Checklist
Date: 2026-10-28
Status: RELEASE BLOCKED — candidate preparation only

## Repository and candidate
- Repository: bishanth2026/Advocate-Management-QA
- QA branch: staging/advocatedesk-test
- Known candidate fix: ea54b34eeca6f94e1c33c463e3cee8dadc9d6da5 (Finance invoice/payment updates remain in Finance)
- Do not deploy directly from the QA branch to Production until the release gates below pass.

## Mandatory release gates
- [ ] Confirm the exact Production deployment target and its current source branch.
- [ ] Confirm GitHub Pages / hosting build completed successfully for the candidate commit.
- [ ] Browser-test Finance: edit invoice and payment, Update keeps Finance open, KPI totals refresh, values persist after refresh and re-login.
- [ ] Re-run role tests: Admin, Advocate, Staff and cross-workspace access; deny unauthorized actions server-side.
- [ ] Re-test document isolation: cross-workspace documents cannot be listed, opened, downloaded, or modified.
- [ ] Re-test case/client/hearing CRUD and related-record integrity.
- [ ] Re-test calendar handling of past and upcoming hearings.
- [ ] Verify QA and Production use separate Supabase project URLs/keys and no QA credentials are shipped into Production.
- [ ] Review RLS policies and SECURITY DEFINER function public.qa_list_workspace_advocates(uuid); verify all edge cases before changing grants.
- [ ] Document the leaked-password protection limitation and accepted mitigation/deferral.
- [ ] Confirm database backup/export and a tested rollback plan.
- [ ] Confirm release branch protection and required CI checks.
- [ ] Obtain explicit release approval after all checks pass.

## Deployment sequence
1. Freeze the QA candidate commit and record its SHA.
2. Run automated validation and manual browser acceptance checks.
3. Review changes into the Production branch through a pull request; do not force-push.
4. Verify production environment configuration and database target.
5. Deploy during a controlled release window.
6. Smoke-test login, workspace isolation, cases, documents, hearings, finance, and mobile layout.
7. If any critical smoke test fails, roll back to the recorded prior release and investigate.

## Current release decision
NO-GO for Production deployment until the mandatory gates are checked. This checklist does not claim that a browser test, Pages deployment, or production deployment has succeeded.
