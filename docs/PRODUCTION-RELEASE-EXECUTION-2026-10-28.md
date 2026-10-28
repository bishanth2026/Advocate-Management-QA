# AdvocateDesk Production Release Gate Execution — 2026-10-28

## Purpose
This checklist is a QA-only release preparation record. It does not authorize a Production deployment.

## Latest QA verification — 2026-10-28
- **Static/unit/contract validation passed:** [workflow run 40629552777](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40629552777) on commit `34397f799764b0ce3490ec6287fb7c0755d87628`.
- **QA Pages deployment passed:** [workflow run 40629552750](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40629552750).
- **Real-browser role/module regression passed:** [workflow run 40629552769](https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/40629552769). With real browser-issued QA sessions, the suite passed Admin, assigned Advocate, unassigned Advocate, Accountant and non-member flows; refresh/re-login persistence checks; role-scoped fixture visibility; 11 navigation pages; Case–Hearing–Calendar–Dashboard synchronization; finance invoice dropdowns and WhatsApp-link construction; cross-workspace resource read denial; and real database atomic rollback.
- **Authenticated RPC negative-path suite passed** in the same browser run: same-workspace Admin directory access; non-Admin and foreign-workspace directory denial; foreign-workspace resource denial; finance-directory role/workspace denial; non-Admin assignment denial; cross-workspace assignment denial; and Admin assignment/unassignment audit lifecycle.
- The browser test harness itself had two defects that were fixed in QA: an incorrectly escaped refresh URL matcher and a race that allowed a static “Cloud: Synced” label to be mistaken for completed bootstrap. The rerun passed. No passwords or tokens were written to logs.

## QA security remediation completed — 2026-10-28
- Added migration `supabase/migrations/20261028100000_move_qa_advocate_directory_definer_to_private.sql` on the QA staging branch; commit `7e2f43178b8eb459db4f75a6f592298985dc6e0a`.
- Applied the migration only to isolated QA Supabase project `AdvocateDesk-Test` (`uqtsksgypncsbcnuanbk`). No Production project was targeted.
- Public `public.qa_list_workspace_advocates(uuid)` is now `SECURITY INVOKER`; its narrowly scoped helper lives in the non-exposed `private` schema, has a fixed search path, and requires an Admin of the same active workspace.
- Verified via catalog query and transaction-scoped authenticated-role simulations: public wrapper is not SECURITY DEFINER; same-workspace Admin returned only Advocate rows; non-Admin Advocate and foreign-workspace Admin received zero rows.
- Re-ran QA Security Advisor. The public authenticated SECURITY DEFINER warning is resolved. One warning remains: **Leaked Password Protection is disabled**.

## Production source/schema audit — 2026-10-28
- The inspected `production/advocatedesk-final` branch still has a legacy `app.html` bootstrap that references `practice_records`; it does not contain `resource-sync.js`.
- The Production Supabase project referenced by that branch's `auth.js` is `Advocate_Management` (`ykxfidrtvmkmmbxameji`). Its current public schema inventory includes `practice_records` and `case_documents`, but **does not include** the QA cutover tables `practice_resources`, `role_permissions`, or `case_assignments`. Its migration history is limited to the existing baseline/workspace-state/document migrations.
- Therefore the QA cutover is **not drop-in compatible with Production**. Copying only the QA frontend would break data loading/saving; merging the entire divergent QA branch would also import unreviewed QA-only changes. Production needs a separately reviewed, production-named migration/backfill/rollback plan and a selective-port PR against the actual Production source. Do not run QA migrations on Production as-is.

## Remaining release gates
1. Enable and verify Leaked Password Protection in QA Supabase Auth settings; the available connector does not expose this setting for direct configuration.
2. Create and review production-specific migrations for resource-level tables, permissions, case assignments, policies, atomic batch save and safe backfill; validate on a production-like disposable clone before any Production application.
3. Confirm Production backup/restore and rollback using a tested procedure, and verify repository/project/keys/hosting target boundaries.
4. Prepare a separate selective-port PR against the actual Production source, including all required migration and application changes, then run equivalent browser/security tests against a production-like environment.
5. Obtain explicit human approval before any Production database, Auth, RLS, storage, or hosting change.

## Hard stop conditions
- Leaked Password Protection not enabled/verified.
- Any failed or unverified mandatory test.
- Unresolved authorization or cross-workspace data leak.
- Production schema migration/backfill/rollback not tested.
- Unconfirmed Production source or deployment target.
- Any attempt to wholesale merge the divergent QA candidate branch.

## Current decision
**Production NO-GO.** QA browser regression and its automated checks are now passing, but the Production branch/schema still use the legacy aggregate state and do not contain the resource-level schema. The remaining production migration/backfill and Auth setting gates must be completed before release.

No Production database, Auth, RLS, storage, hosting settings, or Production code were changed by this work.
