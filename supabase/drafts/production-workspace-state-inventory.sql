-- READ-ONLY PRE-FLIGHT — safe to run against Production.
-- Outputs workspace ID prefixes and aggregate collection counts only; no case/client names,
-- emails, descriptions, financial values, or document contents are returned.
-- This inventory is not a migration and does not alter data.

with workspace_state as (
  select workspace_id, payload
  from public.practice_records
  where record_type = 'other'
    and record_key = 'workspace_state'
    and jsonb_typeof(payload) = 'object'
)
select
  left(workspace_id::text, 8) as workspace_id_prefix,
  (select string_agg(k, ', ' order by k)
   from jsonb_object_keys(payload) as keys(k)) as present_top_level_keys,
  case when jsonb_typeof(payload->'cases')='array' then jsonb_array_length(payload->'cases') else null end as cases_count,
  case when jsonb_typeof(payload->'clients')='array' then jsonb_array_length(payload->'clients') else null end as clients_count,
  case when jsonb_typeof(payload->'hearings')='array' then jsonb_array_length(payload->'hearings') else null end as hearings_count,
  case when jsonb_typeof(payload->'tasks')='array' then jsonb_array_length(payload->'tasks') else null end as tasks_count,
  case when jsonb_typeof(payload->'invoices')='array' then jsonb_array_length(payload->'invoices') else null end as invoices_count,
  case when jsonb_typeof(payload->'payments')='array' then jsonb_array_length(payload->'payments') else null end as payments_count,
  case when jsonb_typeof(payload->'meetings')='array' then jsonb_array_length(payload->'meetings') else null end as meetings_count,
  case when jsonb_typeof(payload->'discussions')='array' then jsonb_array_length(payload->'discussions') else null end as discussions_count,
  case when jsonb_typeof(payload->'communications')='array' then jsonb_array_length(payload->'communications') else null end as communications_count,
  case when jsonb_typeof(payload->'courts')='array' then jsonb_array_length(payload->'courts') else null end as courts_count,
  (select count(*) from jsonb_each(payload) e where jsonb_typeof(e.value) <> 'array') as non_array_top_level_values
from workspace_state
order by workspace_id_prefix;

-- Additional shape/anomaly check: returns counts only.
with workspace_state as (
  select workspace_id, payload
  from public.practice_records
  where record_type = 'other'
    and record_key = 'workspace_state'
    and jsonb_typeof(payload) = 'object'
),
cases as (
  select ws.workspace_id, c.value as case_payload
  from workspace_state ws
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(ws.payload->'cases')='array' then ws.payload->'cases' else '[]'::jsonb end
  ) c(value)
)
select
  left(workspace_id::text, 8) as workspace_id_prefix,
  count(*) as case_rows,
  count(*) filter (where nullif(btrim(case_payload->>'id'), '') is null) as cases_missing_id,
  count(*) filter (where nullif(btrim(case_payload->>'id'), '') is not null)
    - count(distinct nullif(btrim(case_payload->>'id'), '')) as duplicate_case_id_rows
from cases
group by workspace_id
order by workspace_id_prefix;
