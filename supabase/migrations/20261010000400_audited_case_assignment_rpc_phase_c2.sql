-- AdvocateDesk QA Phase C2: audited case assignment RPCs.
-- QA only. Prevents clients from directly writing case_assignments.
BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('case.assigned','case.unassigned')),
  target_user_id uuid REFERENCES auth.users(id),
  case_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workspace_audit_log_workspace_time_idx ON public.workspace_audit_log(workspace_id,created_at DESC);
ALTER TABLE public.workspace_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_audit_log_select_authorized ON public.workspace_audit_log;
CREATE POLICY workspace_audit_log_select_authorized ON public.workspace_audit_log FOR SELECT TO authenticated
USING (private.has_workspace_permission(workspace_id,'audit.view'));

DROP POLICY IF EXISTS case_assignments_insert_admin_rpc_only ON public.case_assignments;
DROP POLICY IF EXISTS case_assignments_update_admin_rpc_only ON public.case_assignments;
DROP POLICY IF EXISTS case_assignments_delete_admin_rpc_only ON public.case_assignments;

CREATE OR REPLACE FUNCTION public.assign_case_to_member(p_workspace_id uuid,p_case_id text,p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_assignment_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id=wm.workspace_id
  WHERE wm.workspace_id=p_workspace_id AND wm.user_id=auth.uid() AND wm.role='admin' AND w.status='active'
 ) THEN RAISE EXCEPTION 'Only an Admin of this active workspace can assign cases' USING ERRCODE='42501'; END IF;
 IF p_case_id IS NULL OR btrim(p_case_id)='' OR p_user_id IS NULL THEN
  RAISE EXCEPTION 'Case and target user are required' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.practice_resources pr WHERE pr.workspace_id=p_workspace_id AND pr.resource_type='case' AND pr.resource_id=p_case_id) THEN
  RAISE EXCEPTION 'Case does not exist in the selected workspace' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id=wm.workspace_id
  WHERE wm.workspace_id=p_workspace_id AND wm.user_id=p_user_id AND w.status='active'
 ) THEN RAISE EXCEPTION 'Target user must be an active member of the same workspace' USING ERRCODE='22023'; END IF;
 INSERT INTO public.case_assignments(workspace_id,case_id,user_id,assigned_by)
 VALUES(p_workspace_id,p_case_id,p_user_id,auth.uid())
 ON CONFLICT(workspace_id,case_id,user_id) DO UPDATE SET assigned_by=EXCLUDED.assigned_by
 RETURNING id INTO v_assignment_id;
 INSERT INTO public.workspace_audit_log(workspace_id,actor_user_id,action,target_user_id,case_id,details)
 VALUES(p_workspace_id,auth.uid(),'case.assigned',p_user_id,p_case_id,jsonb_build_object('assignment_id',v_assignment_id));
 RETURN v_assignment_id;
END; $$;

CREATE OR REPLACE FUNCTION public.unassign_case_from_member(p_workspace_id uuid,p_case_id text,p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.workspace_members wm JOIN public.workspaces w ON w.id=wm.workspace_id
  WHERE wm.workspace_id=p_workspace_id AND wm.user_id=auth.uid() AND wm.role='admin' AND w.status='active'
 ) THEN RAISE EXCEPTION 'Only an Admin of this active workspace can unassign cases' USING ERRCODE='42501'; END IF;
 DELETE FROM public.case_assignments WHERE workspace_id=p_workspace_id AND case_id=p_case_id AND user_id=p_user_id;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.workspace_audit_log(workspace_id,actor_user_id,action,target_user_id,case_id,details)
 VALUES(p_workspace_id,auth.uid(),'case.unassigned',p_user_id,p_case_id,'{}'::jsonb);
 RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.assign_case_to_member(uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unassign_case_from_member(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_case_to_member(uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unassign_case_from_member(uuid,text,uuid) TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.case_assignments FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.workspace_audit_log FROM authenticated;
GRANT SELECT ON public.workspace_audit_log TO authenticated;
COMMIT;
