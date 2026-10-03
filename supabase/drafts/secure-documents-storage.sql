-- DRAFT ONLY: Secure AdvocateDesk document storage
-- Review against the live Supabase schema and test in a disposable project before execution.
-- This file is intentionally not auto-run and does not modify any Supabase project.
--
-- Assumptions confirmed from auth.js: public.workspace_members(user_id, workspace_id, role)
-- and public.workspaces(id, status) exist. Case IDs in app.js are strings (e.g. CS-...),
-- so case_id is text. Reconfirm both assumptions before applying.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'advocatedesk-documents',
  'advocatedesk-documents',
  false,
  20971520,
  array['application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png']
)
on conflict (id) do nothing;

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  case_id text not null,
  document_name text not null check (char_length(trim(document_name)) between 1 and 255),
  category text not null default 'Other'
    check (category in ('Petition','Order','Evidence','Other')),
  original_file_name text not null check (char_length(trim(original_file_name)) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  uploaded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.case_documents enable row level security;

-- Access is scoped to authenticated users who are members of an active workspace.
create policy "case_documents_select_member"
on public.case_documents for select to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = case_documents.workspace_id
      and wm.user_id = auth.uid()
      and w.status = 'active'
  )
);

create policy "case_documents_insert_member"
on public.case_documents for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = case_documents.workspace_id
      and wm.user_id = auth.uid()
      and w.status = 'active'
  )
);

create policy "case_documents_delete_member"
on public.case_documents for delete to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = case_documents.workspace_id
      and wm.user_id = auth.uid()
      and w.status = 'active'
  )
);

-- Storage object paths must be <workspace UUID>/<document UUID>/<filename>.
create policy "advocatedesk_documents_read_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'advocatedesk-documents'
  and exists (
    select 1 from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.user_id = auth.uid()
      and w.status = 'active'
  )
);

create policy "advocatedesk_documents_insert_member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'advocatedesk-documents'
  and exists (
    select 1 from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.user_id = auth.uid()
      and w.status = 'active'
  )
);

create policy "advocatedesk_documents_delete_member"
on storage.objects for delete to authenticated
using (
  bucket_id = 'advocatedesk-documents'
  and exists (
    select 1 from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.user_id = auth.uid()
      and w.status = 'active'
  )
);

commit;

-- Before production use:
-- 1. Verify actual schema, existing policy names, bucket configuration and RLS.
-- 2. Test cross-workspace read/insert/delete denial in a disposable Supabase project.
-- 3. Add case-membership validation if case access is narrower than workspace access.
-- 4. Add coordinated metadata/object cleanup and upload rollback in application code.
-- 5. Use short-lived signed URLs for downloads; never make this bucket public.
