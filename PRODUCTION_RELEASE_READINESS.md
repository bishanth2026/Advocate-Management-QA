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


## Fresh schema parity inspection — 2026-10-28

A fresh live read-only inventory of the connected Supabase projects confirmed that the gap is functional, not only a migration-count difference.

| Area | Production | QA | Release implication |
|---|---|---|---|
| `workspaces.status` allowed values | `active`, `suspended` | `active`, `inactive`, `suspended` | Status-handling assumptions need explicit compatibility tests. |
| `workspace_members.role` allowed values | `admin`, `advocate`, `staff` | additionally `junior_advocate`, `clerk`, `accountant` | QA roles cannot be assumed to work in production. |
| `role_permissions` | Not present in inspected public tables | Present, RLS enabled | Permission-management code needs a reviewed schema migration before deployment. |
| `case_assignments` | Not present in inspected public tables | Present, RLS enabled; 4 rows in QA | Assigned-case access controls are not production-ready until schema and policy behavior are tested. |
| `practice_resources` | Not present in inspected public tables | Present, RLS enabled; 42 rows in QA | QA resource-sync model is not schema-compatible with production as-is. |
| `workspace_audit_log` | Not present in inspected public tables | Present, RLS enabled; 32 rows in QA | Assignment audit functionality needs a migration/data-retention review. |
| `case_documents` | Present, RLS enabled; no rows reported by inventory | Present, RLS enabled; 3 rows | Compare constraints, storage bucket policies, and real file access before release. |
| Recorded migrations | 7 | 41 | Migration histories are not interchangeable. |

The inventory reports zero rows for several production core tables and zero rows in `profiles` in both environments; this may be normal for the inspected projects, but must be reconciled with expected live-user data before any migration. QA's row counts above are QA-only and must not be copied into production.

### Required migration work order (do not apply automatically)

1. Export/backup production schema and data; confirm actual live record counts and recovery procedure.
2. Build a migration-by-migration dependency map from the 34 QA-only migration entries against the production baseline; do not simply replay them because the histories diverge.
3. Port only required schema changes into new, ordered release migrations, preserving existing production constraints and minimizing data-locking.
4. Recreate and verify RLS policies, grants, helper functions, and storage-object policies with least privilege.
5. Run positive and negative authenticated tests for admin, advocate, staff, accountant, unassigned case, assigned case, cross-workspace access, finance records, and document downloads.
6. Run the same release migration set on QA/staging first, capture rollback/restore evidence, and only then schedule production change.

No database changes were made during this inspection.


## Frontend source review — 2026-10-28

A direct read-only comparison of the QA `main` branch and `production/advocatedesk-final` confirms the current QA frontend files are not a safe drop-in replacement for production:

- QA `auth.js` SHA: `ed652d54e123fac641234a2c8cf688ecfc3122bd`; it points to the QA Supabase project. Production `auth.js` SHA: `31eea5d6268cbada4f86fb71fea094bf95652361`; it points to the production Supabase project.
- QA `app.js` SHA: `2fdaf5b1ca07b504f860fc3b436e044e572da5ed` (167,327 characters); production `app.js` SHA: `20b3a0df247f3489313e5b0a2bed16513914aec3` (179,512 characters). QA's application source is materially smaller and must not overwrite the production build without a reviewed feature-by-feature diff and regression suite.
- The portal selection and member login pages exist on both refs, but their presence alone does not prove the live host is serving them or that sign-in and authorization work end-to-end.

### Source promotion decision

Do not copy QA `auth.js`, `app.js`, or `app.html` over production as a bulk operation. Keep production's explicit production Supabase configuration and its safety assertions. Port a specific QA fix only after identifying its exact diff, checking compatibility with production schema and roles, and adding a regression test that fails before the fix and passes after it.

This review is read-only with respect to production application code and database.


## Release test matrix — 2026-10-28

Added `RELEASE_TEST_MATRIX.md` on the release-readiness branch. It defines the required build/branch, authentication, workspace/case authorization, finance, cloud-sync, document storage, migration-safety, and live-host checks. Test rows are deliberately marked NOT RUN or BLOCKED until evidence is captured; the matrix is not a claim that those tests passed.

The production safety workflow at `.github/workflows/production-safety.yml` currently runs JavaScript syntax checks and `scripts/production-safety-smoke.mjs`. Its triggers are workflow dispatch, pushes to `production/advocatedesk-final`, and pull requests targeting that branch (or `feature/secure-documents-draft`). The workflow does not itself deploy the site and does not perform real authenticated browser/API tests.

### Current gate after matrix creation

- Static production safety smoke checks: prior run passed on the production baseline; must be rerun on the exact final candidate.
- Authenticated role/negative-permission tests: NOT RUN.
- Production-compatible migration set and staging rehearsal: NOT READY.
- Leaked-password protection: BLOCKED until enabled and verified in Supabase Auth settings.
- Live hosting branch / deployed SHA: NOT VERIFIED.
- Release decision: **BLOCKED / NOT APPROVED FOR PRODUCTION**.

Do not merge this documentation-only readiness PR as a substitute for code, database, or live-site validation. No production database schema, data, hosting configuration, or application code was changed by this review.


## QA evidence reconciliation — 2026-10-28

Prior QA results have been reconciled with the release test matrix; they should not be treated as untested or needlessly repeated:

- `workspace_state` restrictive RLS check: PASS (limited to that policy).
- Anonymous Finance RPC EXECUTE denial: PASS (does not prove authenticated role permissions).
- Accountant Clients & Cases read-only UI and absent Edit/Delete controls: PASS (direct API mutation denial remains unverified).
- Advocate/Staff portal route and static smoke assertions: PASS (real account sign-in and end-to-end permissions remain unverified).
- Production safety CI run `40660002462`: PASS for syntax/static smoke checks only.

The release matrix now records these scoped results and focuses remaining execution on real-session login/session revalidation, allowed save-refresh-cloud-sync, denied direct API/cross-workspace/case access, document/finance authorization, migration rehearsal/backup restore, leaked-password protection, and live hosting/deployed SHA verification. The overall release gate remains blocked until these externally dependent checks have evidence. No production code, schema, data, or hosting settings were changed.
