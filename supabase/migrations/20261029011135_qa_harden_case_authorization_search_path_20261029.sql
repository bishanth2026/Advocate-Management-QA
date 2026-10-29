-- QA-only migration; applied to AdvocateDesk-Test (uqtsksgypncsbcnuanbk).
-- Hardens SECURITY DEFINER authorization helpers against search_path object shadowing.
-- The function logic and grants are intentionally unchanged. All application objects are schema-qualified.

create or replace function private.can_access_case(p_workspace_id uuid, p_case_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when auth.uid() is null then false
    when exists (
      select 1
      from public.workspace_members wm
      join public.workspaces w on w.id = wm.workspace_id
      where wm.workspace_id = p_workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'admin'
        and w.status = 'active'
    ) then true
    else exists (
      select 1
      from public.case_assignments ca
      join public.workspace_members wm
        on wm.workspace_id = ca.workspace_id and wm.user_id = ca.user_id
      join public.workspaces w on w.id = ca.workspace_id
      where ca.workspace_id = p_workspace_id
        and ca.case_id = p_case_id
        and ca.user_id = auth.uid()
        and w.status = 'active'
    )
  end;
$function$;

create or replace function private.has_workspace_permission(p_workspace_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when auth.uid() is null then false
    when exists (
      select 1
      from public.workspace_members wm
      join public.workspaces w on w.id = wm.workspace_id
      where wm.workspace_id = p_workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'admin'
        and w.status = 'active'
    ) then true
    else exists (
      select 1
      from public.workspace_members wm
      join public.workspaces w on w.id = wm.workspace_id
      join public.role_permissions rp on rp.role = wm.role
      where wm.workspace_id = p_workspace_id
        and wm.user_id = auth.uid()
        and w.status = 'active'
        and rp.permission_key = p_permission_key
        and rp.allowed = true
    )
  end;
$function$;

create or replace function private.is_case_creator(p_workspace_id uuid, p_case_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when auth.uid() is null or p_workspace_id is null or nullif(btrim(p_case_id), '') is null then false
    else exists (
      select 1
      from public.workspace_members wm
      join public.workspaces w on w.id = wm.workspace_id
      join public.practice_resources pr
        on pr.workspace_id = wm.workspace_id
       and pr.resource_type = 'case'
       and pr.resource_id = p_case_id
      where wm.workspace_id = p_workspace_id
        and wm.user_id = auth.uid()
        and w.status = 'active'
        and pr.payload->>'createdBy' = auth.uid()::text
    )
  end;
$function$;
