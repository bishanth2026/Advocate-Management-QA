-- QA-only: let users read the practice records they created, even before case assignment.
-- This prevents an inserted unassigned case from disappearing from the creator's
-- RLS-visible baseline and being re-inserted on the next save. Workspace scoping
-- and existing role/case permissions remain required for all other records.
DROP POLICY IF EXISTS practice_resources_select_authorized ON public.practice_resources;

CREATE POLICY practice_resources_select_authorized
ON public.practice_resources
FOR SELECT
TO authenticated
USING (
  CASE resource_type
    WHEN 'case' THEN (
      private.has_workspace_permission(workspace_id, 'cases.view_all')
      OR (
        private.has_workspace_permission(workspace_id, 'cases.view_assigned')
        AND private.can_access_case(workspace_id, resource_id)
      )
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'client' THEN (
      private.has_workspace_permission(workspace_id, 'clients.view_all')
      OR (
        private.has_workspace_permission(workspace_id, 'clients.view_assigned')
        AND case_id IS NOT NULL
        AND private.can_access_case(workspace_id, case_id)
      )
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'hearing' THEN (
      private.has_workspace_permission(workspace_id, 'hearings.view_all')
      OR (
        private.has_workspace_permission(workspace_id, 'hearings.view_assigned')
        AND case_id IS NOT NULL
        AND private.can_access_case(workspace_id, case_id)
      )
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'task' THEN (
      private.has_workspace_permission(workspace_id, 'tasks.view_all')
      OR (
        private.has_workspace_permission(workspace_id, 'tasks.view_assigned')
        AND case_id IS NOT NULL
        AND private.can_access_case(workspace_id, case_id)
      )
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'case_party' THEN (
      private.has_workspace_permission(workspace_id, 'cases.view_all')
      OR (
        private.has_workspace_permission(workspace_id, 'cases.view_assigned')
        AND case_id IS NOT NULL
        AND private.can_access_case(workspace_id, case_id)
      )
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'invoice' THEN private.has_workspace_permission(workspace_id, 'finance.view')
    WHEN 'payment' THEN private.has_workspace_permission(workspace_id, 'finance.view')
    WHEN 'transaction' THEN private.has_workspace_permission(workspace_id, 'finance.view')
    WHEN 'meeting' THEN (
      private.has_workspace_permission(workspace_id, 'hearings.view_all')
      OR (
        private.has_workspace_permission(workspace_id, 'hearings.view_assigned')
        AND case_id IS NOT NULL
        AND private.can_access_case(workspace_id, case_id)
      )
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'discussion' THEN (
      private.has_workspace_permission(workspace_id, 'cases.view_all')
      OR (
        private.has_workspace_permission(workspace_id, 'cases.view_assigned')
        AND case_id IS NOT NULL
        AND private.can_access_case(workspace_id, case_id)
      )
      OR payload->>'createdBy' = auth.uid()::text
    )
    WHEN 'court' THEN private.is_workspace_member(workspace_id)
    ELSE false
  END
);
