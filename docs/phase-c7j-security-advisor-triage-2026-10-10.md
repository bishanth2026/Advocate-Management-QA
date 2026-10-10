# Phase C7J — QA Advisor Review (2026-10-10)

Project: AdvocateDesk-Test (`uqtsksgypncsbcnuanbk`, ap-south-1). Branch: `staging/advocatedesk-test`. Production was not changed.

## Findings

The project is healthy. The Supabase security advisor reports two warnings for authenticated execution of SECURITY DEFINER RPCs: `public.assign_case_to_member(uuid,text,uuid)` and `public.unassign_case_from_member(uuid,text,uuid)`. It also reports that leaked-password protection is disabled. The performance advisor reports nine unused-index informational findings.

## Case-assignment RPCs

The advisor warning needs review; it is not proof by itself that either function is exploitable. Do not revoke authenticated execution or change function security mode blindly, because the app may depend on these RPCs. Before closing the finding, review the exact deployed function definitions, execute privileges, fixed search path, and schema-qualified references. Then run real JWT tests for Admin, Advocate, Accountant, non-member, and anonymous callers, including cross-workspace case/member IDs. Confirm denied requests do not mutate assignment rows and successful requests write audit events.

If authenticated RPC use is intentional, document the authorization rationale and test evidence. If it is not intentional, design and test a narrower API boundary before changing privileges.

## Auth setting

Leaked-password protection remains a dashboard follow-up for the isolated QA project. Confirm the project name in the dashboard before enabling it, then verify sign-in and password-reset flows. Guidance: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Index findings

Do not drop the nine indexes only because current QA traffic has not used them. Review representative query plans and workload evidence first.

## Release gate

Case-assignment integration is still not acceptance-tested. It needs disposable QA identities, a new QA-only workspace and fixtures, live JWT role-matrix tests, and browser assign/unassign/refresh tests. Static CI success is not a substitute.

No SQL write, migration, grant change, Auth setting change, index removal, or production change was performed during this review.
