-- Restrict the legacy whole-workspace JSON snapshot to workspace admins.
-- QA-only migration. The application now loads/saves authorized rows through
-- public.practice_resources and no longer reads/writes workspace_state.
BEGIN;

DROP POLICY IF EXISTS practice_records_workspace_state_admin_only
  ON public.practice_records;

CREATE POLICY practice_records_workspace_state_admin_only
  ON public.practice_records
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    record_type IS DISTINCT FROM 'other'
    OR record_key IS DISTINCT FROM 'workspace_state'
    OR private.has_workspace_permission(workspace_id, 'users.manage')
  )
  WITH CHECK (
    record_type IS DISTINCT FROM 'other'
    OR record_key IS DISTINCT FROM 'workspace_state'
    OR private.has_workspace_permission(workspace_id, 'users.manage')
  );

COMMIT;
