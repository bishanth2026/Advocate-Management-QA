-- AdvocateDesk QA Phase A: permission and case-assignment foundation.
-- Additive only. This migration does NOT yet enforce module permissions on practice_records.
-- Do not promote to production until the shared workspace_state JSON is replaced or mediated
-- by a server-enforced authorization layer and the negative tests pass.

BEGIN;

-- Expand supported office roles while preserving existing role values.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.workspace_members'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.workspace_members DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role = ANY (ARRAY[
    'admin'::text,
    'advocate'::text,
    'junior_advocate'::text,
    'clerk'::text,
    'accountant'::text,
    'staff'::text
  ]));

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role text NOT NULL CHECK (role = ANY (ARRAY['admin','advocate','junior_advocate','clerk','accountant','staff'])),
  permission_key text NOT NULL CHECK (char_length(permission_key) BETWEEN 3 AND 100),
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission_key)
);

CREATE TABLE IF NOT EXISTS public.case_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  case_id text NOT NULL CHECK (char_length(btrim(case_id)) BETWEEN 1 AND 200),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, case_id, user_id)
);

CREATE INDEX IF NOT EXISTS case_assignments_user_scope_idx
  ON public.case_assignments (user_id, workspace_id);
CREATE INDEX IF NOT EXISTS case_assignments_case_scope_idx
  ON public.case_assignments (workspace_id, case_id);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_assignments ENABLE ROW LEVEL SECURITY;

-- Permission definitions can be read by authenticated users, but are writable only
-- through a future validated server-side administration path (no client write policies).
DROP POLICY IF EXISTS role_permissions_read_authenticated ON public.role_permissions;
CREATE POLICY role_permissions_read_authenticated
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- A member can see their own assignments; an Admin can see assignments in their workspace.
DROP POLICY IF EXISTS case_assignments_read_scoped ON public.case_assignments;
CREATE POLICY case_assignments_read_scoped
  ON public.case_assignments FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      private.is_workspace_member(workspace_id)
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = case_assignments.workspace_id
          AND wm.user_id = (SELECT auth.uid())
          AND wm.role = 'admin'
      )
    )
  );

-- No direct INSERT/UPDATE/DELETE policies are intentionally created. Assignment changes
-- must be implemented via a server-side, authorization-checked RPC/Edge Function.

CREATE OR REPLACE FUNCTION private.has_workspace_permission(p_workspace_id uuid, p_permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION private.can_access_case(p_workspace_id uuid, p_case_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
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
$$;

REVOKE ALL ON FUNCTION private.has_workspace_permission(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_case(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_workspace_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_case(uuid, text) TO authenticated;

-- Seed an explicit deny-by-default permission catalogue. These definitions are
-- scaffolding until app/data APIs are updated to call the helpers.
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('admin','cases.view_all',true),
  ('admin','cases.edit',true),
  ('admin','hearings.manage',true),
  ('admin','documents.view',true),
  ('admin','documents.upload',true),
  ('admin','documents.delete',true),
  ('admin','finance.view',true),
  ('admin','finance.edit',true),
  ('admin','reports.finance',true),
  ('admin','users.manage',true),
  ('admin','audit.view',true),
  ('advocate','cases.view_assigned',true),
  ('advocate','cases.edit',true),
  ('advocate','hearings.manage',true),
  ('advocate','documents.view',true),
  ('advocate','documents.upload',true),
  ('junior_advocate','cases.view_assigned',true),
  ('junior_advocate','hearings.manage',true),
  ('junior_advocate','documents.view',true),
  ('junior_advocate','documents.upload',true),
  ('clerk','hearings.manage',true),
  ('clerk','documents.view',true),
  ('clerk','documents.upload',true),
  ('accountant','finance.view',true),
  ('accountant','finance.edit',true),
  ('accountant','reports.finance',true),
  ('staff','documents.view',true)
ON CONFLICT (role, permission_key)
DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now();

COMMIT;
