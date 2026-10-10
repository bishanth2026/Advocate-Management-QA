-- QA-only additive migration: support legacy transaction records in resource-scoped storage.
-- Transactions are finance-sensitive: reads require finance.view and writes require finance.edit.
-- This migration does not enable application cutover or modify production.
BEGIN;

ALTER TABLE public.practice_resources
  DROP CONSTRAINT IF EXISTS practice_resources_resource_type_check;
ALTER TABLE public.practice_resources
  ADD CONSTRAINT practice_resources_resource_type_check
  CHECK (resource_type = ANY (ARRAY[
    'case','client','hearing','task','invoice','payment','transaction','meeting','discussion','court'
  ]));

DROP POLICY IF EXISTS practice_resources_select_authorized ON public.practice_resources;
CREATE POLICY practice_resources_select_authorized ON public.practice_resources
FOR SELECT TO authenticated USING (
 CASE resource_type
  WHEN 'case' THEN private.has_workspace_permission(workspace_id,'cases.view_all') OR (private.has_workspace_permission(workspace_id,'cases.view_assigned') AND private.can_access_case(workspace_id,resource_id))
  WHEN 'client' THEN private.has_workspace_permission(workspace_id,'clients.view_all') OR (private.has_workspace_permission(workspace_id,'clients.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'hearing' THEN private.has_workspace_permission(workspace_id,'hearings.view_all') OR (private.has_workspace_permission(workspace_id,'hearings.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'task' THEN private.has_workspace_permission(workspace_id,'tasks.view_all') OR (private.has_workspace_permission(workspace_id,'tasks.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'invoice' THEN private.has_workspace_permission(workspace_id,'finance.view')
  WHEN 'payment' THEN private.has_workspace_permission(workspace_id,'finance.view')
  WHEN 'transaction' THEN private.has_workspace_permission(workspace_id,'finance.view')
  WHEN 'meeting' THEN private.has_workspace_permission(workspace_id,'hearings.view_all')
  WHEN 'discussion' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
  WHEN 'court' THEN private.is_workspace_member(workspace_id)
  ELSE false END
);

DROP POLICY IF EXISTS practice_resources_insert_authorized ON public.practice_resources;
CREATE POLICY practice_resources_insert_authorized ON public.practice_resources
FOR INSERT TO authenticated WITH CHECK (
 private.has_workspace_permission(workspace_id,CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage' WHEN 'task' THEN 'hearings.manage'
  WHEN 'invoice' THEN 'finance.edit' WHEN 'payment' THEN 'finance.edit'
  WHEN 'transaction' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND (resource_type NOT IN ('hearing','task','meeting') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id)) OR private.has_workspace_permission(workspace_id,'cases.view_all'))
);

DROP POLICY IF EXISTS practice_resources_update_authorized ON public.practice_resources;
CREATE POLICY practice_resources_update_authorized ON public.practice_resources
FOR UPDATE TO authenticated USING (
 private.has_workspace_permission(workspace_id,CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage' WHEN 'task' THEN 'hearings.manage'
  WHEN 'invoice' THEN 'finance.edit' WHEN 'payment' THEN 'finance.edit'
  WHEN 'transaction' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND (resource_type NOT IN ('hearing','task','meeting') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id)) OR private.has_workspace_permission(workspace_id,'cases.view_all'))
) WITH CHECK (
 private.has_workspace_permission(workspace_id,CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage' WHEN 'task' THEN 'hearings.manage'
  WHEN 'invoice' THEN 'finance.edit' WHEN 'payment' THEN 'finance.edit'
  WHEN 'transaction' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND (resource_type NOT IN ('hearing','task','meeting') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id)) OR private.has_workspace_permission(workspace_id,'cases.view_all'))
);

DROP POLICY IF EXISTS practice_resources_delete_authorized ON public.practice_resources;
CREATE POLICY practice_resources_delete_authorized ON public.practice_resources
FOR DELETE TO authenticated USING (
 private.has_workspace_permission(workspace_id,CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage' WHEN 'task' THEN 'hearings.manage'
  WHEN 'invoice' THEN 'finance.edit' WHEN 'payment' THEN 'finance.edit'
  WHEN 'transaction' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
);

-- Backfill only transaction arrays from the existing workspace_state aggregate.
WITH source AS (
 SELECT id AS legacy_id,workspace_id,payload
 FROM public.practice_records
 WHERE record_type='other' AND record_key='workspace_state'
), tx AS (
 SELECT s.legacy_id,s.workspace_id,e.ordinality,e.value AS item,
   COALESCE(NULLIF(e.value->>'id',''),NULLIF(e.value->>'key',''),'transaction-'||e.ordinality::text) AS item_id,
   COALESCE(NULLIF(e.value->>'caseId',''),NULLIF(e.value->>'case_id',''),NULLIF(e.value->>'case',''),NULLIF(e.value->>'caseNumber','')) AS raw_case_id
 FROM source s
 CROSS JOIN LATERAL jsonb_array_elements(
   CASE WHEN jsonb_typeof(s.payload->'transactions')='array' THEN s.payload->'transactions' ELSE '[]'::jsonb END
 ) WITH ORDINALITY AS e(value,ordinality)
), normalized AS (
 SELECT t.*,
   (SELECT COALESCE(NULLIF(c.value->>'id',''),NULLIF(c.value->>'caseId',''),NULLIF(c.value->>'number',''))
    FROM source s2
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(s2.payload->'cases')='array' THEN s2.payload->'cases' ELSE '[]'::jsonb END
    ) AS c(value)
    WHERE s2.workspace_id=t.workspace_id
      AND (COALESCE(NULLIF(c.value->>'id',''),NULLIF(c.value->>'caseId',''),NULLIF(c.value->>'number',''))=t.raw_case_id
        OR c.value->>'number'=t.raw_case_id OR c.value->>'caseNumber'=t.raw_case_id)
    LIMIT 1
   ) AS resolved_case_id
 FROM tx t
)
INSERT INTO public.practice_resources
 (workspace_id,resource_type,resource_id,case_id,payload,legacy_record_id,source_hash,migrated_at)
SELECT workspace_id,'transaction',item_id,resolved_case_id,item,legacy_id,md5(item::text),now()
FROM normalized
WHERE item_id IS NOT NULL AND btrim(item_id)<>''
ON CONFLICT(workspace_id,resource_type,resource_id) DO UPDATE SET
 case_id=EXCLUDED.case_id,payload=EXCLUDED.payload,legacy_record_id=EXCLUDED.legacy_record_id,
 source_hash=EXCLUDED.source_hash,migrated_at=EXCLUDED.migrated_at,updated_at=now();

COMMIT;
