# AdvocateDesk Production Release Gate Execution — 2026-10-28

## Purpose
This checklist is a QA-only release preparation record. It does not authorize a Production deployment.

## Verified QA automation results
- Baseline commit: `82797d07ebaaf610efb060207e2985a1cadf09b2` on `staging/advocatedesk-test`.
- **AdvocateDesk Test Validation:** successful — [workflow run 40627449456](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40627449456). Syntax, unit, static authorization/security contract, transactional-save reference-model and persistence state-contract checks passed.
- **AdvocateDesk Test Pages Deployment:** successful — [workflow run 40627449487](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40627449487). The staging test-site deployment job completed successfully.
- These checks are not equivalent to full real-browser regression or Production release approval.

## QA security remediation completed — 2026-10-28
- Added migration `supabase/migrations/20261028100000_move_qa_advocate_directory_definer_to_private.sql` on the QA staging branch; commit `7e2f43178b8eb459db4f75a6f592298985dc6e0a`.
- Applied the migration only to the isolated QA Supabase project `AdvocateDesk-Test` (`uqtsksgypncsbcnuanbk`). No Production project was targeted.
- The public `public.qa_list_workspace_advocates(uuid)` endpoint is now `SECURITY INVOKER`. Its narrowly scoped definer helper lives in the non-exposed `private` schema, has a fixed search path, requires the caller to be an Admin of the same active workspace, and returns only Advocate/Junior Advocate rows.
- Verified database catalog state: public wrapper is not SECURITY DEFINER; private helper is SECURITY DEFINER with fixed search path.
- Verified transaction-scoped authenticated-role simulations: same-workspace Admin returned only the two Advocate rows; a non-Admin Advocate received zero rows; an Admin requesting a different workspace received zero rows. These are SQL role/claim simulations, not real browser/PostgREST session tests.
- Re-ran QA Security Advisor after the migration. The authenticated SECURITY DEFINER warning for the public RPC is no longer reported. One warning remains: **Leaked Password Protection is disabled**.

## Remaining release gates
1. Enable and verify Leaked Password Protection in the QA Supabase Auth settings; the available connector does not expose this Auth setting for direct configuration.
2. Run real-browser regression with disposable QA credentials for Admin, assigned/unassigned Advocate, Accountant, non-member and cross-workspace cases.
3. Verify document list/preview/download and denied cross-workspace access using separate QA workspaces; retain sanitized evidence only.
4. Verify create/update, refresh, logout/login persistence, edit conflict/concurrency, and deletion/recovery with disposable QA data.
5. Verify QA and Production repository, Supabase project, keys, hosting target, backups and rollback procedure are distinct and documented.
6. Confirm the actual Production source repository/branch and deployment target, then prepare a separate selective-port PR against that source only after compatibility/security tests.

## Hard stop conditions
- Any failed or unverified mandatory test.
- Unresolved authorization or cross-workspace data leak.
- Leaked Password Protection not enabled/verified.
- Unconfirmed Production source or deployment target.
- No tested backup/rollback path.
- Any attempt to wholesale merge the divergent QA candidate branch.

## Current decision
**Production NO-GO until all gates above have evidence and are reviewed.** The candidate branch is divergent from both `main` and `production/advocatedesk-final`; do not merge it wholesale.

No Production database, Auth, RLS, storage, hosting settings, or Production code were changed by this work.
