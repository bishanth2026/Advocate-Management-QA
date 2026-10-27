-- QA-only: require the caller to be an admin of an active workspace before
-- returning advocate identities; do not expose this SECURITY DEFINER RPC to anon/PUBLIC.
CREATE OR REPLACE FUNCTION public.qa_list_workspace_advocates(p_workspace_id uuid)
RETURNS TABLE(user_id uuid, role text, full_name text, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'pg_temp'
AS $function$
  SELECT wm.user_id, wm.role, p.full_name, p.email
  FROM public.workspace_members wm
  LEFT JOIN public.profiles p ON p.user_id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
    AND wm.role IN ('advocate','junior_advocate')
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members admin_member
      JOIN public.workspaces w ON w.id = admin_member.workspace_id
      WHERE admin_member.workspace_id = p_workspace_id
        AND admin_member.user_id = auth.uid()
        AND admin_member.role = 'admin'
        AND w.status = 'active'
    )
  ORDER BY COALESCE(NULLIF(trim(p.full_name), ''), p.email, wm.user_id::text)
$function$;
REVOKE ALL ON FUNCTION public.qa_list_workspace_advocates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_list_workspace_advocates(uuid) TO authenticated, service_role;
