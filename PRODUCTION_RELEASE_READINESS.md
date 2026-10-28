# AdvocateDesk Production Release Readiness

Date: 2026-10-28

## Release decision

**Status: NOT APPROVED FOR LIVE RELEASE YET.** This checklist is maintained in the QA repository. No production database schema or live hosting settings were changed by this readiness review.

## Repository and frontend

- Repository: `bishanth2026/Advocate-Management-QA`
- Release baseline: `production/advocatedesk-final`
- Release candidate branch: `release/advocatedesk-production-readiness`
- The release baseline contains `login.html` with Super Admin, Admin, and Advocate & Staff portals.
- `member-login.html` exists and routes through the member sign-in path.
- Custom domain file `CNAME` contains `advocate.biznexco.in`.
- GitHub Actions run 40660002462 completed successfully on 2026-10-28. It checked JavaScript syntax and the production safety smoke assertions. This is not an end-to-end browser test or proof that the live site deployed this commit.

## QA branch divergence — release blocker

A fresh compare of `main` against `production/advocatedesk-final` reports that the branches have diverged: `main` is 23 commits ahead and 41 commits behind the production baseline. The QA `main` branch's `auth.js` points to the QA Supabase project (`uqtsksgypncsbcnuanbk`), and its login page still includes demo-only branding. The production baseline instead points to the production Supabase project and has release smoke assertions protecting against QA configuration.

**Do not merge `main` wholesale into the production branch.** Select and review individual QA fixes, port them through a release candidate, and run automated checks plus authenticated QA tests before considering them for production.

## Database parity — release blocker

The production Supabase project (`ykxfidrtvmkmmbxameji`, `Advocate_Management`) has 7 recorded migrations. The QA Supabase project (`uqtsksgypncsbcnuanbk`, `AdvocateDesk-Test`) has 41 recorded migrations.

QA contains role-permission, case-assignment, practice-resource, audit-log, case-scoped resource-policy, and additional authorization hardening work not represented by the production migration history. The production database does not currently expose the same set of tables as QA; for example, QA has `role_permissions`, `case_assignments`, `practice_resources`, and `workspace_audit_log`, while the production table inventory reviewed did not show these tables.

**Do not copy QA schema wholesale or run all QA migrations blindly against production.** Prepare a reviewed, ordered migration set that is compatible with the current production schema, preserves existing data, applies least-privilege grants/RLS, and includes rollback/backup steps. Verify each migration on a disposable staging copy before production application.

## Security findings

- Supabase security advisor reports leaked-password protection is disabled in both production and QA. Enable and verify this Auth setting before general release.
- Production advisor did not report other security lint findings in the retrieved result; this is not a substitute for authorization tests.
- The secure document storage SQL under `supabase/drafts/` is explicitly draft-only and must not be applied without isolated testing and review.
- Verify workspace isolation, assigned-case-only access, finance permissions, document storage access, and denied cross-workspace requests with real authenticated sessions.

## Hosting / live verification blocker

The repository branch contains the third login portal, but the user's live screenshot showed only Super Admin and Admin login after a hard refresh. The live publishing source/branch has not been verified from the available repository tools.

Before release:
1. Verify the hosting provider's configured repository and publishing branch for `advocate.biznexco.in`.
2. Deploy the intended release commit through the configured pipeline.
3. Confirm the deployed `login.html` and `member-login.html` are served on the live domain.
4. Run browser-based tests on desktop and mobile, including all three portals, sign-in, password reset, session expiry, cloud sync, case permissions, finance, and document workflows.
5. Verify the production Supabase project, redirect URLs, allowed origins, and email recovery settings match the live domain.

## Release gate

Release only after database migration parity is deliberately resolved, the Auth security setting is verified, hosting source is confirmed, and authenticated end-to-end checks pass. Do not mark this release as production-ready based only on static smoke checks.
