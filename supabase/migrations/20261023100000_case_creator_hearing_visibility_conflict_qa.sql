-- QA ONLY: keep a case creator's generated next-hearing record RLS-visible/editable.
-- Root cause: the case creator can read an unassigned case, but the linked hearing
-- has no createdBy payload and was hidden by RLS. The client then tried to INSERT
-- the same deterministic HEAR-CASE-* ID; the unique constraint raised 23505.
-- Scope the exception to hearings linked to a case created by the current member.
BEGIN;

DROP POLICY IF EXISTS practice_resources_select_authorized ON public.practice_resources;
CREATE POLICY practice_resources_select_authorized
ON public.practice_resources FOR SELECT TO authenticated
USING (
  CASE resource_type
    WHEN 'case' THEN (
      private.has_workspace_permission(workspace_id,'cases.view_all')
      OR (private.has_workspace_permission(workspace_id,'cases.view_assigned') AND private.can_access_case(workspace_id,resource_id))
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'client' THEN (
      private.has_workspace_permission(workspace_id,'clients.view_all')
      OR (private.has_workspace_permission(workspace_id,'clients.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'hearing' THEN (
      private.has_workspace_permission(workspace_id,'hearings.view_all')
      OR (private.has_workspace_permission(workspace_id,'hearings.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
      OR payload->>'createdBy' = auth.uid()::text
      OR (case_id IS NOT NULL AND private.is_case_creator(workspace_id,case_id))
    )
    WHEN 'task' THEN (
      private.has_workspace_permission(workspace_id,'tasks.view_all')
      OR (private.has_workspace_permission(workspace_id,'tasks.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'case_party' THEN (
      private.has_workspace_permission(workspace_id,'cases.view_all')
      OR (private.has_workspace_permission(workspace_id,'cases.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'invoice' THEN private.has_workspace_permission(workspace_id,'finance.view')
    WHEN 'payment' THEN private.has_workspace_permission(workspace_id,'finance.view')
    WHEN 'transaction' THEN private.has_workspace_permission(workspace_id,'finance.view')
    WHEN 'meeting' THEN (
      private.has_workspace_permission(workspace_id,'hearings.view_all')
      OR (private.has_workspace_permission(workspace_id,'hearings.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'discussion' THEN (
      private.has_workspace_permission(workspace_id,'cases.view_all')
      OR (private.has_workspace_permission(workspace_id,'cases.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'court' THEN private.is_workspace_member(workspace_id)
    ELSE false
  END
);

DROP POLICY IF EXISTS practice_resources_update_authorized ON public.practice_resources;
CREATE POLICY practice_resources_update_authorized
ON public.practice_resources FOR UPDATE TO authenticated
USING (
  private.has_workspace_permission(workspace_id, CASE resource_type
    WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
    WHEN 'case_party' THEN 'cases.edit' WHEN 'hearing' THEN 'hearings.manage'
    WHEN 'task' THEN 'hearings.manage' WHEN 'invoice' THEN 'finance.edit'
    WHEN 'payment' THEN 'finance.edit' WHEN 'transaction' THEN 'finance.edit'
    WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
    WHEN 'court' THEN 'users.manage' ELSE '__deny__' END
  )
  AND (
    resource_type NOT IN ('hearing','task','meeting','case_party','discussion')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
    OR private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (resource_type='hearing' AND case_id IS NOT NULL AND private.is_case_creator(workspace_id,case_id))
  )
)
WITH CHECK (
  private.has_workspace_permission(workspace_id, CASE resource_type
    WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
    WHEN 'case_party' THEN 'cases.edit' WHEN 'hearing' THEN 'hearings.manage'
    WHEN 'task' THEN 'hearings.manage' WHEN 'invoice' THEN 'finance.edit'
    WHEN 'payment' THEN 'finance.edit' WHEN 'transaction' THEN 'finance.edit'
    WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
    WHEN 'court' THEN 'users.manage' ELSE '__deny__' END
  )
  AND (
    resource_type NOT IN ('hearing','task','meeting','case_party','discussion')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
    OR private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (resource_type='hearing' AND case_id IS NOT NULL AND private.is_case_creator(workspace_id,case_id))
  )
);

DROP POLICY IF EXISTS practice_resources_delete_authorized ON public.practice_resources;
CREATE POLICY practice_resources_delete_authorized
ON public.practice_resources FOR DELETE TO authenticated
USING (
  private.has_workspace_permission(workspace_id, CASE resource_type
    WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
    WHEN 'case_party' THEN 'cases.edit' WHEN 'hearing' THEN 'hearings.manage'
    WHEN 'task' THEN 'hearings.manage' WHEN 'invoice' THEN 'finance.edit'
    WHEN 'payment' THEN 'finance.edit' WHEN 'transaction' THEN 'finance.edit'
    WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
    WHEN 'court' THEN 'users.manage' ELSE '__deny__' END
  )
  AND (
    resource_type NOT IN ('hearing','task','meeting','case_party','discussion')
    OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
    OR private.has_workspace_permission(workspace_id,'cases.view_all')
    OR (resource_type='hearing' AND case_id IS NOT NULL AND private.is_case_creator(workspace_id,case_id))
  )
);

COMMIT;
