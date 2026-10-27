-- QA-only hardening: creator visibility must never outlive active workspace membership.
-- Preserve the intended creator/assigned-role visibility rules, but require the
-- caller to remain an active member of the row's workspace first.
DROP POLICY IF EXISTS practice_resources_select_authorized ON public.practice_resources;
CREATE POLICY practice_resources_select_authorized
ON public.practice_resources
FOR SELECT
TO authenticated
USING (
  private.is_workspace_member(workspace_id)
  AND (
    CASE resource_type
      WHEN 'case' THEN (
        private.has_workspace_permission(workspace_id, 'cases.view_all')
        OR (private.has_workspace_permission(workspace_id, 'cases.view_assigned')
            AND private.can_access_case(workspace_id, resource_id))
        OR payload->>'createdBy' = auth.uid()::text
      )
      WHEN 'client' THEN (
        private.has_workspace_permission(workspace_id, 'clients.view_all')
        OR (private.has_workspace_permission(workspace_id, 'clients.view_assigned'
            ) AND case_id IS NOT NULL AND private.can_access_case(workspace_id, case_id))
        OR payload->>'createdBy' = auth.uid()::text
      )
      WHEN 'hearing' THEN (
        private.has_workspace_permission(workspace_id, 'hearings.view_all')
        OR (private.has_workspace_permission(workspace_id, 'hearings.view_assigned'
            ) AND case_id IS NOT NULL AND private.can_access_case(workspace_id, case_id))
        OR payload->>'createdBy' = auth.uid()::text
        OR (case_id IS NOT NULL AND private.is_case_creator(workspace_id, case_id))
      )
      WHEN 'task' THEN (
        private.has_workspace_permission(workspace_id, 'tasks.view_all')
        OR (private.has_workspace_permission(workspace_id, 'tasks.view_assigned'
            ) AND case_id IS NOT NULL AND private.can_access_case(workspace_id, case_id))
        OR payload->>'createdBy' = auth.uid()::text
      )
      WHEN 'case_party' THEN (
        private.has_workspace_permission(workspace_id, 'cases.view_all')
        OR (private.has_workspace_permission(workspace_id, 'cases.view_assigned'
            ) AND case_id IS NOT NULL AND private.can_access_case(workspace_id, case_id))
        OR payload->>'createdBy' = auth.uid()::text
      )
      WHEN 'invoice' THEN private.has_workspace_permission(workspace_id, 'finance.view')
      WHEN 'payment' THEN private.has_workspace_permission(workspace_id, 'finance.view')
      WHEN 'transaction' THEN private.has_workspace_permission(workspace_id, 'finance.view')
      WHEN 'meeting' THEN (
        private.has_workspace_permission(workspace_id, 'hearings.view_all')
        OR (private.has_workspace_permission(workspace_id, 'hearings.view_assigned'
            ) AND case_id IS NOT NULL AND private.can_access_case(workspace_id, case_id))
        OR payload->>'createdBy' = auth.uid()::text
      )
      WHEN 'discussion' THEN (
        private.has_workspace_permission(workspace_id, 'cases.view_all')
        OR (private.has_workspace_permission(workspace_id, 'cases.view_assigned'
            ) AND case_id IS NOT NULL AND private.can_access_case(workspace_id, case_id))
        OR payload->>'createdBy' = auth.uid()::text
      )
      WHEN 'court' THEN true
      ELSE false
    END
  )
);
