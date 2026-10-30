-- AdvocateDesk Production RLS/Storage preflight (READ-ONLY ONLY)
-- Run in Supabase SQL Editor with a read-only reviewer account if possible.
-- This file deliberately contains no INSERT/UPDATE/DELETE/DDL and is NOT a migration.
-- Production project: ykxfidrtvmkmmbxameji
-- Do not infer case-level security from workspace membership alone.

-- 1) Confirm private bucket constraints.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'advocatedesk-documents';

-- 2) Current policies on the document metadata table and Storage objects.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename = 'case_documents')
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- 3) Document/object path reconciliation counts.
select
  (select count(*) from public.case_documents) as metadata_rows,
  (select count(*) from public.case_documents where storage_path is not null) as rows_with_storage_path,
  (select count(*) from storage.objects where bucket_id = 'advocatedesk-documents') as bucket_objects,
  (select count(*)
     from storage.objects o
     join public.case_documents d
       on d.storage_path = o.name
      and o.bucket_id = 'advocatedesk-documents') as exact_path_matches,
  (select count(*)
     from public.case_documents d
    where d.storage_path is not null
      and not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'advocatedesk-documents'
          and o.name = d.storage_path
      )) as metadata_rows_without_object,
  (select count(*)
     from storage.objects o
    where o.bucket_id = 'advocatedesk-documents'
      and not exists (
        select 1 from public.case_documents d
        where d.storage_path = o.name
      )) as objects_without_metadata;

-- 4) Review actual path layout without exposing full paths or file names.
select
  count(*) as object_count,
  count(*) filter (where (storage.foldername(o.name))[1] ~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as first_folder_uuid_count,
  count(*) filter (where coalesce(array_length(storage.foldername(o.name), 1), 0) < 2) as shallow_path_count
from storage.objects o
where o.bucket_id = 'advocatedesk-documents';

-- 5) Production schema dependencies available for a future compatibility migration.
select table_schema, table_name
from information_schema.tables
where table_schema in ('public', 'private')
  and table_name in (
    'case_documents', 'workspace_members', 'workspaces',
    'case_assignments', 'role_permissions', 'practice_resources',
    'practice_records', 'workspace_audit_log'
  )
order by table_schema, table_name;

-- 6) Helper function definitions relevant to authorization (review-only).
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.proname in (
    'is_workspace_member', 'is_workspace_owner',
    'has_workspace_permission', 'can_access_case'
  )
order by n.nspname, p.proname;

-- Gate:
-- Do not write a migration until the path format, metadata linkage, role model,
-- case-level access source, grants/function ACLs, and expected UI access pattern
-- are reviewed. Production currently lacks the QA role_permissions,
-- case_assignments, and practice_resources tables. QA policies must not be
-- copied as-is. Keep the bucket private and preserve the existing app path format.
