-- QA-only draft: apply only after app.html no longer reads/writes
-- practice_records(record_type='other', record_key='workspace_state') and
-- per-resource sync has passed browser/session and regression tests.
--
-- A RESTRICTIVE policy combines with the existing PERMISSIVE membership
-- policies using AND, so membership alone can no longer expose the whole
-- JSON snapshot. Other practice_records types retain their existing policy.
-- This file is intentionally in supabase/drafts, not supabase/migrations.
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
