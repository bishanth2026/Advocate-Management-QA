# AdvocateDesk Role-Based Access Control Audit

**Date:** 10 October 2026  
**Scope:** QA/staging repository `staging/advocatedesk-test` and isolated Supabase project `uqtsksgypncsbcnuanbk`. Production project `ykxfidrtvmkmmbxameji` was inspected read-only; no production schema or policy changes were made as part of this audit.

## Summary

The current implementation provides authentication, platform Super Admin separation, workspace membership checks, and workspace-level Row Level Security (RLS). It does **not yet provide complete module-level or case-assignment authorization** for roles such as Accountant, Clerk, Junior Advocate, and Staff.

## Evidence from current implementation

1. `workspace_members.role` currently permits only `admin`, `advocate`, and `staff`; `accountant`, `clerk`, and `junior_advocate` are not supported as explicit roles.
2. `practice_records` stores a broad workspace state in a JSONB `payload`. The `app.html` bootstrap loads the workspace's `record_type='other'`, `record_key='workspace_state'` row, and saves the complete state back to that row.
3. Existing `practice_records` RLS policies check `private.is_workspace_member(workspace_id)` for SELECT/INSERT/UPDATE/DELETE. They do not authorize individual modules, record types, or assigned cases.
4. Existing `case_documents` policies allow any active workspace member to view and delete workspace documents; insertion checks membership and uploader identity, but does not check assigned-case access or document category/role permissions.
5. The UI's `admin-only` navigation hiding is presentation logic, not an authorization boundary. The generic `ADAuth.require()` only checks that a cached session object indicates cloud authentication; secure decisions must be revalidated against Supabase Auth and database policies.
6. Production's current RLS policies similarly authorize active workspace membership on shared records. A read-only query found the Security Advisor warning `auth_leaked_password_protection` (leaked-password protection disabled); this remains separately deferred by the owner.

## Required target design

### Roles
- `super_admin`: platform administration only; no implicit access to office case/finance records.
- `admin`: all permitted modules within their own active workspace, user/role assignment, and audit review.
- `advocate`: authorized cases, clients, hearings, documents, tasks, and case-related reports.
- `junior_advocate`: explicitly assigned cases and associated hearings/documents/tasks; no office-wide finance.
- `clerk`: permitted schedules, filing/document operations, and minimal case metadata; no finance or unrelated case files.
- `accountant`: invoices, payments, receipts, and financial reports; only minimal client/case references needed for billing, not full case files.
- `staff`: explicit least-privilege permissions assigned by the office admin.

Roles must be combined with granular permissions and workspace/case scope. Role labels alone should not be the only rule.

### Permission model
Use a normalized permission map (e.g. `module_permissions` or equivalent role-permission tables) and explicit case assignments. Example permissions: `cases.view_all`, `cases.view_assigned`, `cases.edit`, `hearings.manage`, `documents.view`, `documents.upload`, `finance.view`, `finance.edit`, `reports.finance`, `users.manage`, and `audit.view`.

### Data model and enforcement
1. Avoid treating the entire `workspace_state` JSON object as a single security unit. Migrate modules to separately authorized records/tables (or a rigorously validated API/RPC layer that enforces the same rules) before enabling different staff permissions.
2. Add explicit roles and permission definitions, plus case assignment records.
3. Add `can_access_workspace`, `has_permission`, and `can_access_case` security-definer helpers with a fixed `search_path`, and write RLS policies per resource/action.
4. Enforce both workspace membership and module/case scope in `practice_records` during the transition. Do not grant finance/case separation while both are bundled in one readable JSON payload.
5. Secure documents and storage object access by workspace, case assignment, and document permission.
6. Derive UI navigation/buttons from the same server-verified permission map, but never rely on UI hiding alone.
7. Prevent users from self-upgrading their role/permissions; role changes must be performed by an authorized workspace admin through a validated server-side operation and logged.

## Required negative tests

- Accountant cannot SELECT case payloads, unrelated documents, or case notes; cannot edit cases/hearings.
- Clerk cannot SELECT invoices/payments or financial reports.
- Junior advocate cannot access an unassigned case by UI, direct URL, or direct PostgREST request.
- Staff cannot assign themselves permissions, promote their role, or change workspace membership.
- User in workspace A cannot read/write workspace B records or documents.
- Office Admin cannot grant platform `super_admin` or manage another office.
- Super Admin cannot implicitly load or write office practice records.
- Unauthorized INSERT/UPDATE/DELETE requests are denied by RLS, not merely hidden in the UI.
- Existing Admin invitation, login, calendar, Case 360°, finance, and document workflows continue to pass.

## Safe implementation sequence

1. Keep production unchanged while designing and testing.
2. Implement schema and policies in the isolated QA Supabase project only.
3. Replace bundled workspace-state sync with resource-scoped data access before enabling real module separation.
4. Add UI route/navigation checks and case assignment flows.
5. Run role-by-role positive and negative tests, plus cross-workspace isolation tests and Supabase Security Advisor.
6. Deploy QA and obtain owner acceptance before promoting a reviewed migration and code release to production.

## Audit conclusion

**Current state: workspace-level isolation exists; module-level and case-assignment authorization is incomplete.** Do not claim Accountant/Clerk/Jr Advocate access separation is secure until the shared-state architecture is removed or strictly mediated and the negative tests above pass. No production modifications were made by this audit.
