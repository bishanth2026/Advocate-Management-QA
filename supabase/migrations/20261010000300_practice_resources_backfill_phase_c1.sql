-- AdvocateDesk QA Phase C1: resource-scoped storage and safe legacy backfill.
-- Additive only. Legacy workspace_state is retained; application cutover is NOT performed here.
BEGIN;

INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
 ('admin','clients.view_all',true),('admin','hearings.view_all',true),('admin','tasks.view_all',true),
 ('advocate','clients.view_assigned',true),('advocate','hearings.view_assigned',true),('advocate','tasks.view_assigned',true),
 ('junior_advocate','clients.view_assigned',true),('junior_advocate','hearings.view_assigned',true),('junior_advocate','tasks.view_assigned',true),
 ('clerk','hearings.view_all',true),('clerk','tasks.view_all',true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed=EXCLUDED.allowed,updated_at=now();

CREATE TABLE IF NOT EXISTS public.practice_resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 resource_type text NOT NULL CHECK (resource_type = ANY (ARRAY['case','client','hearing','task','invoice','payment','meeting','discussion','court'])),
 resource_id text NOT NULL CHECK (char_length(btrim(resource_id)) BETWEEN 1 AND 200),
 case_id text,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object'),
 legacy_record_id uuid REFERENCES public.practice_records(id) ON DELETE SET NULL,
 source_hash text NOT NULL,
 migrated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,resource_type,resource_id)
);
CREATE INDEX IF NOT EXISTS practice_resources_workspace_type_idx ON public.practice_resources(workspace_id,resource_type);
CREATE INDEX IF NOT EXISTS practice_resources_case_scope_idx ON public.practice_resources(workspace_id,case_id,resource_type);
CREATE INDEX IF NOT EXISTS practice_resources_legacy_idx ON public.practice_resources(legacy_record_id);
ALTER TABLE public.practice_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS practice_resources_select_authorized ON public.practice_resources;
CREATE POLICY practice_resources_select_authorized ON public.practice_resources FOR SELECT TO authenticated USING (
 CASE resource_type
  WHEN 'case' THEN private.has_workspace_permission(workspace_id,'cases.view_all') OR (private.has_workspace_permission(workspace_id,'cases.view_assigned') AND private.can_access_case(workspace_id,resource_id))
  WHEN 'client' THEN private.has_workspace_permission(workspace_id,'clients.view_all') OR (private.has_workspace_permission(workspace_id,'clients.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'hearing' THEN private.has_workspace_permission(workspace_id,'hearings.view_all') OR (private.has_workspace_permission(workspace_id,'hearings.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'task' THEN private.has_workspace_permission(workspace_id,'tasks.view_all') OR (private.has_workspace_permission(workspace_id,'tasks.view_assigned') AND case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id))
  WHEN 'invoice' THEN private.has_workspace_permission(workspace_id,'finance.view')
  WHEN 'payment' THEN private.has_workspace_permission(workspace_id,'finance.view')
  WHEN 'meeting' THEN private.has_workspace_permission(workspace_id,'hearings.view_all')
  WHEN 'discussion' THEN private.has_workspace_permission(workspace_id,'cases.view_all')
  WHEN 'court' THEN private.is_workspace_member(workspace_id)
  ELSE false END
);

DROP POLICY IF EXISTS practice_resources_insert_authorized ON public.practice_resources;
CREATE POLICY practice_resources_insert_authorized ON public.practice_resources FOR INSERT TO authenticated WITH CHECK (
 private.has_workspace_permission(workspace_id,CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage' WHEN 'task' THEN 'hearings.manage'
  WHEN 'invoice' THEN 'finance.edit' WHEN 'payment' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND (resource_type NOT IN ('hearing','task','meeting') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id)) OR private.has_workspace_permission(workspace_id,'cases.view_all'))
);

DROP POLICY IF EXISTS practice_resources_update_authorized ON public.practice_resources;
CREATE POLICY practice_resources_update_authorized ON public.practice_resources FOR UPDATE TO authenticated USING (
 private.has_workspace_permission(workspace_id,CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage' WHEN 'task' THEN 'hearings.manage'
  WHEN 'invoice' THEN 'finance.edit' WHEN 'payment' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND (resource_type NOT IN ('hearing','task','meeting') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id)) OR private.has_workspace_permission(workspace_id,'cases.view_all'))
) WITH CHECK (
 private.has_workspace_permission(workspace_id,CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage' WHEN 'task' THEN 'hearings.manage'
  WHEN 'invoice' THEN 'finance.edit' WHEN 'payment' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
 AND (resource_type NOT IN ('hearing','task','meeting') OR (case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id)) OR private.has_workspace_permission(workspace_id,'cases.view_all'))
);

DROP POLICY IF EXISTS practice_resources_delete_authorized ON public.practice_resources;
CREATE POLICY practice_resources_delete_authorized ON public.practice_resources FOR DELETE TO authenticated USING (
 private.has_workspace_permission(workspace_id,CASE resource_type
  WHEN 'case' THEN 'cases.edit' WHEN 'client' THEN 'cases.edit'
  WHEN 'hearing' THEN 'hearings.manage' WHEN 'task' THEN 'hearings.manage'
  WHEN 'invoice' THEN 'finance.edit' WHEN 'payment' THEN 'finance.edit'
  WHEN 'meeting' THEN 'hearings.manage' WHEN 'discussion' THEN 'cases.edit'
  WHEN 'court' THEN 'users.manage' ELSE '__deny__' END)
);

WITH source AS (
 SELECT id AS legacy_id,workspace_id,payload FROM public.practice_records
 WHERE record_type='other' AND record_key='workspace_state'
), items AS (
 SELECT s.legacy_id,s.workspace_id,kv.key AS resource_type,e.ordinality,e.value AS item,
  CASE WHEN kv.key='cases' THEN COALESCE(NULLIF(e.value->>'id',''),NULLIF(e.value->>'caseId',''),NULLIF(e.value->>'number',''))
       WHEN kv.key='clients' THEN COALESCE(NULLIF(e.value->>'id',''),NULLIF(e.value->>'clientId',''),'legacy-client-'||e.ordinality::text)
       ELSE COALESCE(NULLIF(e.value->>'id',''),NULLIF(e.value->>'key',''),kv.key||'-'||e.ordinality::text) END AS item_id,
  CASE WHEN kv.key='cases' THEN COALESCE(NULLIF(e.value->>'id',''),NULLIF(e.value->>'caseId',''),NULLIF(e.value->>'number',''))
       ELSE COALESCE(NULLIF(e.value->>'caseId',''),NULLIF(e.value->>'case_id',''),NULLIF(e.value->>'case','')) END AS raw_case_id
 FROM source s CROSS JOIN LATERAL jsonb_each(s.payload) AS kv(key,value)
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(kv.value)='array' THEN kv.value ELSE '[]'::jsonb END) WITH ORDINALITY AS e(value,ordinality)
 WHERE kv.key=ANY(ARRAY['cases','clients','hearings','tasks','invoices','payments','meetings','discussions','courts'])
), normalized AS (
 SELECT i.*,
  CASE i.resource_type WHEN 'cases' THEN 'case' WHEN 'clients' THEN 'client' WHEN 'hearings' THEN 'hearing'
   WHEN 'tasks' THEN 'task' WHEN 'invoices' THEN 'invoice' WHEN 'payments' THEN 'payment'
   WHEN 'meetings' THEN 'meeting' WHEN 'discussions' THEN 'discussion' WHEN 'courts' THEN 'court' END AS target_type,
  CASE WHEN i.resource_type='cases' THEN NULL ELSE COALESCE(
   (SELECT COALESCE(NULLIF(c.item->>'id',''),NULLIF(c.item->>'caseId',''),NULLIF(c.item->>'number',''))
    FROM items c WHERE c.workspace_id=i.workspace_id AND c.resource_type='cases'
    AND (c.item_id=i.raw_case_id OR c.item->>'number'=i.raw_case_id OR c.item->>'caseNumber'=i.raw_case_id) LIMIT 1),
   i.raw_case_id) END AS resolved_case_id
 FROM items i
)
INSERT INTO public.practice_resources(workspace_id,resource_type,resource_id,case_id,payload,legacy_record_id,source_hash,migrated_at)
SELECT workspace_id,target_type,item_id,resolved_case_id,item,legacy_id,md5(item::text),now()
FROM normalized WHERE target_type IS NOT NULL AND item_id IS NOT NULL AND btrim(item_id)<>''
ON CONFLICT(workspace_id,resource_type,resource_id) DO UPDATE SET
 case_id=EXCLUDED.case_id,payload=EXCLUDED.payload,legacy_record_id=EXCLUDED.legacy_record_id,
 source_hash=EXCLUDED.source_hash,migrated_at=now(),updated_at=now();

COMMIT;
