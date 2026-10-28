# AdvocateDesk Production Release Gate Execution — 2026-10-28

## Purpose
This checklist is a QA-only release preparation record. It does not authorize a Production deployment.

## QA validation sequence
1. Run the staging push validation workflow against the current staging branch head.
2. Inspect every job result and log; do not infer success from a missing status record.
3. Run real-browser regression with disposable QA credentials for Admin, Advocate, Accountant, non-member and cross-workspace cases.
4. Verify document list/preview/download and denied cross-workspace access using separate QA workspaces; preserve sanitized evidence only.
5. Verify create/update, refresh, logout/login persistence, edit conflict/concurrency, and deletion/recovery with disposable QA data.
6. Recheck the QA Supabase Security Advisor findings and document each finding's disposition. Leaked Password Protection must be enabled and verified in QA before production approval.
7. Verify QA and Production repository, Supabase project, keys, hosting target, backups and rollback procedure are distinct and documented.
8. Prepare a separate selective-port PR against the actual Production source only after tests and source/deployment mapping are confirmed.

## Hard stop conditions
- Any failed or unverified mandatory test.
- Unresolved authorization or cross-workspace data leak.
- Leaked Password Protection not enabled/verified.
- Unconfirmed Production source or deployment target.
- No tested backup/rollback path.
- Any attempt to wholesale merge the divergent QA candidate branch.

## Current decision
**Production NO-GO until all gates above have evidence and are reviewed.**

No Production system is changed by this document.