-- PHASE C7H DRAFT ONLY — DO NOT APPLY UNTIL REAL JWT AUTHORIZATION AND
-- TRANSACTION ROLLBACK TESTS RUN AGAINST THE QA DATABASE.
-- Introduces tasks.manage and explicitly denies unlinked case-scoped rows to
-- assigned-only users. QA branch only; production must never receive this draft.
BEGIN;

-- Keep task grants aligned with the roles currently granted hearings.manage,
-- but separate the permission keys so the modules can be administered independently.
INSERT INTO public.role_permissions(role, permission_key, allowed) VALUES
 ('admin','tasks.manage',true),
 ('advocate','tasks.manage',true),
 ('junior_advocate','tasks.manage',true),
 ('clerk','tasks.manage',true)
ON CONFLICT (role, permission_key)
DO UPDATE SET allowed=EXCLUDED.allowed, updated_at=now();

-- Read policy: assigned-only visibility always requires a non-null case_id.
-- Workspace-wide permissions are the only exception for unlinked case-scoped rows.
DROP POLICY IF EXISTS practice_resources_select_authorized ON public.practice_resources;
CREATE POLICY practice_resources_select_authorized ON public.practice_resources
FOR SELECT TO authenticated USING (
 CASE resource_type
  WHEN 'case' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (private.has_workspace_permission(workspace_id,'cases.view_assigned') AND private.can_access_case(workspace_id,resource_id))
  WHEN 'client' THEN private.has_workspace_permission(workspace_id,'clients.view_all')
    OR (case_id IS NOT NULL AND private.has_workspace_permission(workspace_id,'clients.view_assigned') AND private.can_access_case(workspace_id,case_id))
  WHEN 'hearing' THEN private.has_workspace_permission(workspace_id,'hearings.view_all')
    OR (case_id IS NOT NULL AND private.has_workspace_permission(workspace_id,'hearings.view_assigned') AND private.can_access_case(workspace_id,case_id))
  WHEN 'task' THEN private.has_workspace_permission(workspace_id,'tasks.view_all')
    OR (case_id IS NOT NULL AND private.has_workspace_permission(workspace_id,'tasks.view_assigned') AND private.can_access_case(workspace_id,case_id))
  WHEN 'case_party' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (case_id IS NOT NULL AND private.has_workspace_permission(workspace_id,'cases.view_assigned') AND private.can_access_case(workspace_id,case_id))
  WHEN 'invoice' THEN private.has_workspace_permission(workspace_id,'finance.view')
  WHEN 'payment' THEN private.has_workspace_permission(workspace_id,'finance.view')
  WHEN 'transaction' THEN private.has_workspace_permission(workspace_id,'finance.view')
  WHEN 'meeting' THEN private.has_workspace_permission(workspace_id,'hearings.view_all')
    OR (case_id IS NOT NULL AND private.has_workspace_permission(workspace_id,'hearings.view_assigned') AND private.can_access_case(workspace_id,case_id))
  WHEN 'discussion' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (case_id IS NOT NULL AND private.has_workspace_permission(workspace_id,'cases.view_assigned') AND private.can_access_case(workspace_id,case_id))
  WHEN 'court' THEN private.is_workspace_member(workspace_id)
  ELSE false
 END
);

-- Insert policy: every case-scoped type requires either a valid assigned case
-- or the corresponding workspace-wide permission. No implicit access for NULL case_id.
DROP POLICY IF EXISTS practice_resources_insert_authorized ON public.practice_resources;
CREATE POLICY practice_resources_insert_authorized ON public.practice_resources
FOR INSERT TO authenticated WITH CHECK (
 private.has_workspace_permission(workspace_id, CASE resource_type
  WHEN 'case' THEN 'cases.edit'
  WHEN 'client' THEN 'cases.edit'
  WHEN 'case_party' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage'
  WHEN 'task' THEN 'tasks.manage'
  WHEN 'invoice' THEN 'finance.edit'
  WHEN 'payment' THEN 'finance.edit'
  WHEN 'transaction' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage'
  WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage'
  ELSE '__deny__' END)
 AND CASE resource_type
  WHEN 'case' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR private.can_access_case(workspace_id,resource_id)
  WHEN 'client' THEN private.has_workspace_permission(workspace_id,'clients.view_all')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'hearing' THEN private.has_workspace_permission(workspace_id,'hearings.view_all')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'task' THEN private.has_workspace_permission(workspace_id,'tasks.view_all')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'case_party' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'meeting' THEN private.has_workspace_permission(workspace_id,'hearings.view_all')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'discussion' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  ELSE true
 END
);

-- UPDATE checks both old row (USING) and proposed row (WITH CHECK).
DROP POLICY IF EXISTS practice_resources_update_authorized ON public.practice_resources;
CREATE POLICY practice_resources_update_authorized ON public.practice_resources
FOR UPDATE TO authenticated
USING (
 private.has_workspace_permission(workspace_id, CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'case_party' THEN 'cases.edit' WHEN 'hearing' THEN 'hearings.manage'
  WHEN 'task' THEN 'tasks.manage' WHEN 'invoice' THEN 'finance.edit'
  WHEN 'payment' THEN 'finance.edit' WHEN 'transaction' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND CASE resource_type
  WHEN 'case' THEN private.has_workspace_permission(workspace_id,'cases.view_all') OR private.can_access_case(workspace_id,resource_id)
  WHEN 'client' THEN private.has_workspace_permission(workspace_id,'clients.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'hearing' THEN private.has_workspace_permission(workspace_id,'hearings.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'task' THEN private.has_workspace_permission(workspace_id,'tasks.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'case_party' THEN private.has_workspace_permission(workspace_id,'cases.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'meeting' THEN private.has_workspace_permission(workspace_id,'hearings.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'discussion' THEN private.has_workspace_permission(workspace_id,'cases.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  ELSE true
 END
)
WITH CHECK (
 private.has_workspace_permission(workspace_id, CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'case_party' THEN 'cases.edit' WHEN 'hearing' THEN 'hearings.manage'
  WHEN 'task' THEN 'tasks.manage' WHEN 'invoice' THEN 'finance.edit'
  WHEN 'payment' THEN 'finance.edit' WHEN 'transaction' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND CASE resource_type
  WHEN 'case' THEN private.has_workspace_permission(workspace_id,'cases.view_all') OR private.can_access_case(workspace_id,resource_id)
  WHEN 'client' THEN private.has_workspace_permission(workspace_id,'clients.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'hearing' THEN private.has_workspace_permission(workspace_id,'hearings.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'task' THEN private.has_workspace_permission(workspace_id,'tasks.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'case_party' THEN private.has_workspace_permission(workspace_id,'cases.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'meeting' THEN private.has_workspace_permission(workspace_id,'hearings.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'discussion' THEN private.has_workspace_permission(workspace_id,'cases.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  ELSE true
 END
);

DROP POLICY IF EXISTS practice_resources_delete_authorized ON public.practice_resources;
CREATE POLICY practice_resources_delete_authorized ON public.practice_resources
FOR DELETE TO authenticated USING (
 private.has_workspace_permission(workspace_id, CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'case_party' THEN 'cases.edit' WHEN 'hearing' THEN 'hearings.manage'
  WHEN 'task' THEN 'tasks.manage' WHEN 'invoice' THEN 'finance.edit'
  WHEN 'payment' THEN 'finance.edit' WHEN 'transaction' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND CASE resource_type
  WHEN 'case' THEN private.has_workspace_permission(workspace_id,'cases.view_all') OR private.can_access_case(workspace_id,resource_id)
  WHEN 'client' THEN private.has_workspace_permission(workspace_id,'clients.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'hearing' THEN private.has_workspace_permission(workspace_id,'hearings.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'task' THEN private.has_workspace_permission(workspace_id,'tasks.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'case_party' THEN private.has_workspace_permission(workspace_id,'cases.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'meeting' THEN private.has_workspace_permission(workspace_id,'hearings.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'discussion' THEN private.has_workspace_permission(workspace_id,'cases.view_all') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  ELSE true
 END
);

COMMIT;

-- This draft updates direct-table policies only. It deliberately does not create
-- a privileged transactional RPC or revision table. Before applying, run actual
-- JWT role tests and transactional RPC rollback/concurrency tests in QA.
