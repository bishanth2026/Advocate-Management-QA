-- QA only: expose the read-only Accountant directory fields required by Clients & Cases.
-- Keeps the existing workspace finance.view permission check; no write RPCs are added.

create or replace function public.finance_client_directory_v2(p_workspace_id uuid)
returns table(
  client_id text,
  client_name text,
  client_phone text,
  client_number text,
  client_role text,
  client_status text,
  case_count integer
)
language sql
stable
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
  select
    coalesce(cl.payload->>'id', cl.resource_id)::text,
    coalesce(cl.payload->>'name', cl.payload->>'clientName', cl.payload->>'client_name')::text,
    coalesce(cl.payload->>'phone', cl.payload->>'mobile', cl.payload->>'whatsapp', cl.payload->>'phoneNumber', cl.payload->>'phone_number')::text,
    coalesce(cl.payload->>'clientNo', cl.payload->>'client_no', '')::text,
    coalesce(cl.payload->>'role', '')::text,
    coalesce(cl.payload->>'status', '')::text,
    (
      select count(distinct ca.id)::integer
      from public.practice_resources ca
      where ca.workspace_id = p_workspace_id
        and ca.resource_type = 'case'
        and (
          coalesce(ca.payload->>'clientId', ca.payload->>'client_id', '') = coalesce(cl.payload->>'id', cl.resource_id)
          or exists (
            select 1
            from jsonb_array_elements(
              case when jsonb_typeof(ca.payload->'clientIds') = 'array'
                   then ca.payload->'clientIds' else '[]'::jsonb end
            ) ci
            where ci.value #>> '{}' = coalesce(cl.payload->>'id', cl.resource_id)
          )
          or coalesce(ca.payload->>'client', ca.payload->>'clientName', ca.payload->>'client_name', '') =
             coalesce(cl.payload->>'name', cl.payload->>'clientName', cl.payload->>'client_name', '')
          or exists (
            select 1
            from jsonb_array_elements(
              case when jsonb_typeof(ca.payload->'clients') = 'array'
                   then ca.payload->'clients' else '[]'::jsonb end
            ) cp
            where coalesce(cp.value->>'id', cp.value->>'clientId', cp.value #>> '{}', '') =
                    coalesce(cl.payload->>'id', cl.resource_id)
               or coalesce(cp.value->>'name', cp.value->>'clientName', cp.value #>> '{}', '') =
                    coalesce(cl.payload->>'name', cl.payload->>'clientName', cl.payload->>'client_name', '')
          )
        )
    )
  from public.practice_resources cl
  where cl.workspace_id = p_workspace_id
    and cl.resource_type = 'client'
    and private.has_workspace_permission(p_workspace_id, 'finance.view')
    and coalesce(cl.payload->>'name', cl.payload->>'clientName', cl.payload->>'client_name') is not null
  order by 2, 1;
$function$;

create or replace function public.finance_case_directory_v2(p_workspace_id uuid)
returns table(
  case_id text,
  case_number text,
  case_title text,
  client_id text,
  client_name text,
  court_name text,
  next_hearing text,
  hearing_time text,
  case_status text
)
language sql
stable
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
  select
    coalesce(ca.payload->>'id', ca.resource_id)::text,
    coalesce(ca.payload->>'number', ca.payload->>'caseNumber', ca.payload->>'case_number', ca.resource_id)::text,
    coalesce(ca.payload->>'title', ca.payload->>'caseTitle', ca.payload->>'case_title', '')::text,
    coalesce(ca.payload->>'clientId', ca.payload->>'client_id', '')::text,
    coalesce(ca.payload->>'client', ca.payload->>'clientName', ca.payload->>'client_name', '')::text,
    coalesce(ca.payload->>'court', ca.payload->>'courtName', ca.payload->>'court_name', '')::text,
    coalesce(ca.payload->>'next', ca.payload->>'nextHearing', ca.payload->>'next_hearing', '')::text,
    coalesce(ca.payload->>'hearingTime', ca.payload->>'hearing_time', '')::text,
    coalesce(ca.payload->>'status', '')::text
  from public.practice_resources ca
  where ca.workspace_id = p_workspace_id
    and ca.resource_type = 'case'
    and private.has_workspace_permission(p_workspace_id, 'finance.view')
  order by 2, 1;
$function$;

revoke all on function public.finance_client_directory_v2(uuid) from public;
revoke all on function public.finance_case_directory_v2(uuid) from public;
grant execute on function public.finance_client_directory_v2(uuid) to authenticated;
grant execute on function public.finance_case_directory_v2(uuid) to authenticated;
