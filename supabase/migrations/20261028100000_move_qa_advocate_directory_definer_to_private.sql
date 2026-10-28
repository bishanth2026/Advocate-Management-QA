-- QA ONLY: keep the browser-facing RPC SECURITY INVOKER and move the
-- narrowly scoped privilege elevation into the non-exposed private schema.
-- Apply only to AdvocateDesk-Test (uqtsksgypncsbcnuanbk), then verify runtime.
CREATE OR REPLACE FUNCTION private.qa_list_workspace_advocates_internal(p_workspace_id uuid)
RETURNS TABLE(user_id uuid, role text, full_name text, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'pg_temp'
AS $function$
  SELECT wm.user_id, wm.role, p.full_name, p.email
  FROM public.workspace_members wm
  JOIN public.workspaces w ON w.id = wm.workspace_id
  LEFT JOIN public.profiles p ON p.user_id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
    AND w.status = 'active'
    AND wm.role IN ('advocate', 'junior_advocate')
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members admin_member
      JOIN public.workspaces admin_workspace ON admin_workspace.id = admin_member.workspace_id
      WHERE admin_member.workspace_id = p_workspace_id
        AND admin_member.user_id = auth.uid()
        AND admin_member.role = 'admin'
        AND admin_workspace.status = 'active'
    )
  ORDER BY COALESCE(NULLIF(TRIM(p.full_name), ''), p.email, wm.user_id::text)
$function$;

REVOKE ALL ON FUNCTION private.qa_list_workspace_advocates_internal(uuid) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.qa_list_workspace_advocates_internal(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.qa_list_workspace_advocates(p_workspace_id uuid)
RETURNS TABLE(user_id uuid, role text, full_name text, email text)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'private', 'pg_temp'
AS $function$
  SELECT * FROM private.qa_list_workspace_advocates_internal(p_workspace_id)
$function$;

REVOKE ALL ON FUNCTION public.qa_list_workspace_advocates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_list_workspace_advocates(uuid) TO authenticated, service_role;
