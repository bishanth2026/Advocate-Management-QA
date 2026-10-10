# Phase C7G — Resource Mutation Authorization Matrix Review (QA only)

**Status:** static policy review; no database changes applied.  
**Reviewed branch:** `staging/advocatedesk-test`  
**Reviewed migrations:** role/permission foundation, C6 resource policies, transaction support, case-party support, and final meeting/discussion scope migration.

## Decision

Do **not** implement or apply a general-purpose transactional save RPC until the mutation authorization contract below is resolved and tested with real QA JWTs. Existing row-level policies are useful safeguards for direct table requests, but they are not yet a sufficient, verified authorization contract for a privileged multi-resource RPC.

## Resource authorization observations

| Resource type | Intended permission | Case-scope concern | Required RPC behavior |
|---|---|---|---|
| case | `cases.edit`; reads `cases.view_all` or assigned-case access | Case uses `resource_id` as the case key; ensure payload and ID agree | Validate both old and proposed case identity; no cross-workspace references |
| client | `cases.edit`; reads client view permissions | Some rows can be unlinked; client may relate to multiple cases in legacy payload | Preserve relationship data; never silently collapse multi-case links |
| hearing | `hearings.manage`; read view permission | Case-linked rows need assigned-case check; workspace-wide rows should be deliberate | Require valid case linkage unless explicitly classified as workspace-wide |
| task | `hearings.manage` in current policy | Permission name is semantically surprising for tasks; confirm intended business permission | Do not invent a new permission or silently alter seeded role grants |
| invoice/payment/transaction | `finance.edit` for mutation, `finance.view` for read | No case assignment check by design; must still enforce workspace status and finance permission | Finance-gate every upsert and delete, including type changes |
| meeting | `hearings.manage`; read view permission | Final migration scopes case-linked rows; unlinked rows require workspace-wide view permission for reads | Enforce same rule for insert, update, delete and both old/new case scope |
| discussion | `cases.edit`; read case view permission | Final migration scopes case-linked rows; unlinked rows require workspace-wide view permission | Enforce same rule for insert, update, delete and both old/new case scope |
| case_party | `cases.edit`; read case view permission | Must always resolve to a valid same-workspace case for assigned-only users | Reject missing, ambiguous or cross-workspace case references |
| court | `users.manage` for writes; workspace membership for reads | Workspace-wide reference data rather than case-specific data | Keep writes admin/permission gated; validate payload IDs |

## Concrete design constraints

1. **Old and new row scope:** UPDATE authorization must validate the stored row and the proposed row. A user must not be able to move a resource from an assigned case into an unassigned case or vice versa by changing `case_id`.
2. **Delete authorization:** check the existing row's exact resource type, workspace, and case scope before deletion. Do not authorize delete only from workspace membership.
3. **Type mutation:** either disallow changing `resource_type`/identity for an existing key or independently authorize the old type's deletion and the new type's insertion.
4. **Workspace-wide exceptions:** make unlinked client/meeting/discussion/task semantics explicit. Do not infer access merely because `case_id` is null.
5. **Case identity:** resolve canonical case IDs from the workspace's case resource set. Reject ambiguous aliases and any target that resolves outside the workspace.
6. **Permission catalogue:** role-permission rows are readable by authenticated users and not client-writable, but the permission list is scaffolding. A privileged RPC must use the current helper semantics and active workspace status; it must not trust role labels or a caller-provided actor ID.
7. **Resource set completeness:** the generic table allow-list excludes documents. Keep document metadata in `case_documents` and private Storage until a separate upload/cleanup transaction protocol exists.
8. **Revision and atomicity:** revision lock/check, all resource writes, and revision increment must occur in one Postgres transaction. Any error rolls everything back.
9. **Unknown keys:** reject unknown mutation fields/operations, duplicate (type, ID) keys, malformed JSON objects, and over-limit IDs/payloads before writing.
10. **Least privilege:** if SECURITY DEFINER is unavoidable, pin a safe search_path, revoke PUBLIC/anon execute, grant only to authenticated, derive actor from `auth.uid()`, and explicitly re-check every rule above inside the function.

## Required role tests

Run through actual authenticated HTTP requests using QA-only users, not SQL role simulation alone:

- Admin: allowed and denied resource mutations.
- Assigned Advocate: assigned case succeeds; unassigned case and moving a resource into it fail.
- Unassigned Advocate: case-linked write/read denied; finance access denied unless explicitly granted.
- Accountant: finance mutation succeeds only with finance permission; case edits denied.
- Inactive workspace member: all workspace resource mutation denied.
- Workspace non-member: read/write denied.
- Anonymous: read/write/RPC denied.
- Cross-workspace IDs and case links: denied without side effects.
- Forced failure on mutation 2 of 3: mutation 1 and revision update roll back.
- Two concurrent saves with same expected revision: exactly one succeeds; the other receives conflict with no side effects.

## Current test boundary

The unit tests and GitHub Actions validate JavaScript adapter behavior and static contracts. They do not prove RLS/RPC behavior under authenticated JWTs. No authenticated role matrix is claimed as passed. The revision-table draft remains unapplied, and no transactional save RPC or application cutover is implemented.

## Next gate

Resolve the explicit workspace-wide row semantics and task permission semantics with a documented decision, then implement a narrowly scoped RPC and its SQL/HTTP tests in QA. Apply no migration until test users/sessions can execute the required matrix.
