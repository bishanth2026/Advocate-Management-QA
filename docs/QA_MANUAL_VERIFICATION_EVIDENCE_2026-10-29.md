# QA Manual Verification Evidence — 2026-10-29

Repository: `bishanth2026/Advocate-Management-QA`
Branch: `release/advocatedesk-production-readiness`
Purpose: Record the latest user-performed manual checks without overstating independent verification.

## Results reported by the tester

| Check | Result | Evidence boundary |
|---|---|---|
| Admin login and navigation | PASS (reported; screenshots supplied) | Screenshot shows Admin dashboard and Clients & Cases / Case 360 views. |
| Accountant login and Finance view | PASS (reported; screenshot supplied) | Screenshot shows Accountant role and Billing & Accounts page. |
| Assigned Advocate login and navigation | PASS (reported; screenshots supplied) | Screenshot shows Assigned Advocate dashboard and Documents view. |
| Staff login | PASS (reported by tester) | No screenshot or session/API trace specifically identifying Staff was included in the latest evidence; retain as tester-reported, not independently verified. |
| Document upload | PASS (reported; screenshots supplied) | Document count increased from 2 to 3 and new `identity` item appeared. |
| Document preview/download | PASS (reported by tester) | Tester confirmed the uploaded image opens; no independent API/storage trace attached. |
| Document persistence after refresh | PASS (reported; screenshot supplied) | Three document rows remain visible after refresh. |
| Document persistence after logout/login/refresh | PASS (reported; screenshot supplied) | Tester reported logout, relogin, refresh, and confirmed documents remained. This validates the visible document list, not all application data or every role. |
| Cross-workspace document access denial | PASS (reported by tester) | No request/response or alternate-workspace identity evidence attached; direct authenticated API denial remains unverified independently. |

## What these results establish

The supplied screenshots and tester reports support successful manual QA use of the tested screens and persistence of the listed documents across refresh and a fresh login. The green “Cloud: Synced” label alone is not proof that every data type and role passes the historical 403/RLS case/client save path.

## Remaining release blockers

1. **Cloud Sync 403/RLS:** run a real authenticated save → refresh → reopen test on a case/client or other affected practice record, capture the successful request and persisted result, and test each relevant role. Do not treat document-list persistence as a substitute for this test.
2. **Production RLS/storage design:** finish the production-compatible minimal migration design for `public.case_documents` and `storage.objects`, including authoritative case-assignment source, role permissions, grants, helper functions, and rollback plan. Rehearse on an isolated production-like staging database.
3. **Leaked-password protection:** previously reported disabled by the Supabase advisor. Enable only through the approved Auth settings workflow and verify afterward; not changed here.
4. **Hosting source and deployed SHA:** repository metadata confirms default branch is `main`, but does not identify the publishing branch for `advocate.biznexco.in` or the deployed commit. The public URL could not be fetched by the available web retrieval, so this remains unverified.
5. **Independent security evidence:** capture authenticated API/network evidence for cross-workspace denial, document upload/read/delete permissions, and role-specific denied actions.
6. **Final candidate checks:** verify the exact candidate SHA, required CI, desktop/mobile smoke tests, and backup/restore rehearsal before release approval.

## Change safety

This record is documentation only. No production database, authentication settings, storage objects, or live hosting configuration were changed. No claim is made that the live deployment SHA was verified.

**Decision: BLOCKED / NOT APPROVED FOR PRODUCTION.**
