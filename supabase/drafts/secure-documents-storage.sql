-- DRAFT ONLY: Secure AdvocateDesk document storage
-- Review-only migration. Do not execute against production before isolated testing.
-- Verified live schema: workspace_members(workspace_id uuid,user_id uuid,role),
-- workspaces(id uuid,status), and private.is_workspace_member(uuid).
-- App case IDs are strings, therefore case_id is text. Case-level access is not yet modeled.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'advocatedesk-documents',
  'advocatedesk-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do nothing;

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  case_id text not null,
  document_name text not null check (char_length(trim(document_name)) between 1 and 255),
  category text not null default 'Other'
    check (category in ('Petition','Order','Evidence','Other')),
  original_file_name text not null check (char_length(trim(original_file_name)) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  )),
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.case_documents enable row level security;

create policy "case_documents_select_member"
on public.case_documents for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy "case_documents_insert_member"
on public.case_documents for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

create policy "case_documents_delete_member"
on public.case_documents for delete to authenticated
using (private.is_workspace_member(workspace_id));

-- Storage paths must be <workspace UUID>/<document UUID>/<filename>.
-- CASE guards the UUID cast against malformed object paths.
create policy "advocatedesk_documents_read_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'advocatedesk-documents'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.is_workspace_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy "advocatedesk_documents_insert_member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'advocatedesk-documents'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.is_workspace_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy "advocatedesk_documents_delete_member"
on storage.objects for delete to authenticated
using (
  bucket_id = 'advocatedesk-documents'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.is_workspace_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

commit;

-- Required before production:
-- 1. Validate policy names and storage bucket constraints in a disposable project.
-- 2. Add case-level authorization if case visibility is narrower than workspace membership.
-- 3. Enforce storage_path = workspace_id/document_id/filename at the application layer.
-- 4. Use signed URLs for preview/download; never make the bucket public.
-- 5. Implement compensating cleanup for orphaned objects/metadata and test cross-workspace denial.
