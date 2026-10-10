-- PHASE C7E DRAFT — QA ONLY; DO NOT APPLY WITHOUT AUTHENTICATED-JWT REGRESSION TESTS.
-- Hardens search_path on existing SECURITY DEFINER authorization helpers.
-- Every relation and auth.uid() reference in these bodies is schema-qualified.
-- This file is intentionally stored under supabase/drafts, not migrations.
-- No database has been changed by adding this draft.

BEGIN;

CREATE OR REPLACE FUNCTION private.can_access_case(p_workspace_id uuid, p_case_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      WHERE wm.workspace_id = p_workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
        AND w.status = 'active'
    ) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.case_assignments ca
      JOIN public.workspace_members wm
        ON wm.workspace_id = ca.workspace_id AND wm.user_id = ca.user_id
      JOIN public.workspaces w ON w.id = ca.workspace_id
      WHERE ca.workspace_id = p_workspace_id
        AND ca.case_id = p_case_id
        AND ca.user_id = auth.uid()
        AND w.status = 'active'
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION private.has_workspace_permission(
  p_workspace_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      WHERE wm.workspace_id = p_workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
        AND w.status = 'active'
    ) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      JOIN public.role_permissions rp ON rp.role = wm.role
      WHERE wm.workspace_id = p_workspace_id
        AND wm.user_id = auth.uid()
        AND w.status = 'active'
        AND rp.permission_key = p_permission_key
        AND rp.allowed = true
    )
  END;
$function$;

-- Preserve the existing narrow caller model; do not grant anon/PUBLIC execution.
REVOKE ALL ON FUNCTION private.can_access_case(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_workspace_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_access_case(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_workspace_permission(uuid, text) TO authenticated, service_role;

COMMIT;

-- Required validation before considering promotion to a real migration:
-- * Compare pg_get_functiondef and ACLs before/after.
-- * Exercise Admin, assigned Advocate, unassigned Advocate, Accountant, inactive
--   workspace member, non-member, anon, and service_role in isolated QA.
-- * Re-run every RLS policy and case-assignment regression test.
-- * Confirm callers depend only on boolean behavior, not on current search_path.
-- * This draft does not change function owners or table grants.
