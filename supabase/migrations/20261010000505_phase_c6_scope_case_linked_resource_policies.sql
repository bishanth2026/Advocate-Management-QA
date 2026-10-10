-- AdvocateDesk QA Phase C6: close case-scope gaps in resource RLS.
-- QA only. Keep application cutover disabled until authenticated role tests pass.
BEGIN;

DROP POLICY IF EXISTS practice_resources_select_authorized ON public.practice_resources;
CREATE POLICY practice_resources_select_authorized ON public.practice_resources
FOR SELECT TO authenticated USING (
 CASE resource_type
  WHEN 'case' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (private.has_workspace_permission(workspace_id,'cases.view_assigned') AND private.can_access_case(workspace_id,resource_id))
  WHEN 'client' THEN private.has_workspace_permission(workspace_id,'clients.view_all')
    OR (private.has_workspace_permission(workspace_id,'clients.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'hearing' THEN private.has_workspace_permission(workspace_id,'hearings.view_all')
    OR (private.has_workspace_permission(workspace_id,'hearings.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'task' THEN private.has_workspace_permission(workspace_id,'tasks.view_all')
    OR (private.has_workspace_permission(workspace_id,'tasks.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'invoice' THEN private.has_workspace_permission(workspace_id,'finance.view')
  WHEN 'payment' THEN private.has_workspace_permission(workspace_id,'finance.view')
  WHEN 'meeting' THEN private.has_workspace_permission(workspace_id,'hearings.view_all')
    OR (private.has_workspace_permission(workspace_id,'hearings.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'discussion' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (private.has_workspace_permission(workspace_id,'cases.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'court' THEN private.is_workspace_member(workspace_id)
  ELSE false
 END
);

-- Every case-linked write must be scoped to an assigned case unless the member
-- has the corresponding workspace-wide view permission. Missing case links deny writes.
DROP POLICY IF EXISTS practice_resources_insert_authorized ON public.practice_resources;
CREATE POLICY practice_resources_insert_authorized ON public.practice_resources
FOR INSERT TO authenticated WITH CHECK (
 private.has_workspace_permission(workspace_id,CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage' WHEN 'task' THEN 'hearings.manage'
  WHEN 'invoice' THEN 'finance.edit' WHEN 'payment' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND CASE
  WHEN resource_type='case' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR private.can_access_case(workspace_id,resource_id)
  WHEN resource_type='client' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN resource_type IN ('hearing','task','meeting','discussion') THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  ELSE true
 END
);

DROP POLICY IF EXISTS practice_resources_update_authorized ON public.practice_resources;
CREATE POLICY practice_resources_update_authorized ON public.practice_resources
FOR UPDATE TO authenticated USING (
 private.has_workspace_permission(workspace_id,CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage' WHEN 'task' THEN 'hearings.manage'
  WHEN 'invoice' THEN 'finance.edit' WHEN 'payment' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND CASE
  WHEN resource_type='case' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR private.can_access_case(workspace_id,resource_id)
  WHEN resource_type IN ('client','hearing','task','meeting','discussion') THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  ELSE true
 END
) WITH CHECK (
 private.has_workspace_permission(workspace_id,CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage' WHEN 'task' THEN 'hearings.manage'
  WHEN 'invoice' THEN 'finance.edit' WHEN 'payment' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND CASE
  WHEN resource_type='case' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR private.can_access_case(workspace_id,resource_id)
  WHEN resource_type IN ('client','hearing','task','meeting','discussion') THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  ELSE true
 END
);

DROP POLICY IF EXISTS practice_resources_delete_authorized ON public.practice_resources;
CREATE POLICY practice_resources_delete_authorized ON public.practice_resources
FOR DELETE TO authenticated USING (
 private.has_workspace_permission(workspace_id,CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage' WHEN 'task' THEN 'hearings.manage'
  WHEN 'invoice' THEN 'finance.edit' WHEN 'payment' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND CASE
  WHEN resource_type='case' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR private.can_access_case(workspace_id,resource_id)
  WHEN resource_type IN ('client','hearing','task','meeting','discussion') THEN private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  ELSE true
 END
);

COMMIT;
