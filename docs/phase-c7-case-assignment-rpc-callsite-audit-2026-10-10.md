# Phase C7 — Case Assignment RPC Call-Site Audit (2026-10-10)

**Environment:** isolated AdvocateDesk QA branch `staging/advocatedesk-test`  
**Review scope:** source files and migration definitions; no database writes.

## Result

A source review of the current QA app's `app.html`, `app.js`, `cases.js`, `user-roles.js`, `auth.js`, and the assignment RPC migrations found no application call site for either:

- `public.assign_case_to_member(uuid,text,uuid)`
- `public.unassign_case_from_member(uuid,text,uuid)`

The app's current case module stores case/party details in the legacy workspace state and saves through `ADCloudSync.save` to `practice_records`. The `user-roles.js` control is for platform Super Admin QA invitations via the `advocatedesk-provision-user` Edge Function; it is not the case-assignment UI. The RPC definitions are present in SQL migrations, but that alone does not establish that the browser currently invokes them.

## Security interpretation

- The database RPCs remain directly callable by authenticated users, but their function bodies require the caller to be an Admin of the active workspace.
- The inspected ACLs showed EXECUTE for `authenticated`, `service_role`, and the owner `postgres`; no explicit `anon` or `PUBLIC` EXECUTE entry was present in the effective ACL expansion.
- The earlier Advisor warning should be retained as a review item, not treated as proof of a currently exploitable bypass.
- Because no browser call site was found in the reviewed files, removing the authenticated grant is not currently justified by call-site evidence. Do not change grants until all app and Edge Function call sites are searched and live role tests are available.

## Functional gap

The QA UI does not currently provide a verified case assignment/unassignment workflow in the reviewed code. The task-role harness assumes case assignments exist, but the isolated QA database currently has zero `case_assignments` rows. Therefore the assigned-vs-unassigned advocate test cannot pass meaningfully until disposable users, a fresh test workspace, cases, and assignments are provisioned safely.

## Acceptance matrix to implement and execute

| Actor | Assign/unassign case | Read assigned-case task | Read other-case task | Read unlinked task |
|---|---|---|---|---|
| Admin of active workspace | Allow; audit event required | Allow | Allow | Allow only under explicit workspace-wide task permission |
| Assigned Advocate | Deny | Allow | Deny | Deny |
| Unassigned Advocate | Deny | Deny | Allow only for their own assigned case | Deny |
| Accountant | Deny | Deny | Deny | Deny |
| Active workspace non-member | Deny | Deny | Deny | Deny |
| Anonymous | Deny | Deny | Deny | Deny |
| Inactive workspace member | Deny | Deny | Deny | Deny |

The task row expected for an Advocate must be based on that user's actual case assignment; the labels “assigned” and “unassigned” in this table refer to the individual actor's relationship to the particular case.

## Next safe step

1. Keep all database changes on hold.
2. Review every repository file and Edge Function for assignment RPC calls before considering grant changes.
3. Add or restore an explicit Admin-only case assignment UI using the RPCs if the product requires this capability; do not create client-side direct writes to `case_assignments`.
4. Create dedicated QA Auth identities and seed fixtures only in a freshly created isolated workspace, in a reviewed transaction.
5. Run the GET-only JWT authorization harness and the assignment mutation tests using real short-lived JWTs stored locally, never in Git.
6. Do not enable the resource adapter until the transactional save RPC and rollback/concurrency tests pass.

## Gate

**No SQL migration, grant change, fixture seed, Auth user creation, or production change was made.** This document is an evidence record and a checklist, not a claim of live acceptance.
