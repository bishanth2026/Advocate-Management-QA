-- DRAFT ONLY — do not apply to Production.
-- Purpose: harden Storage object access to the current app path convention:
--   <workspace UUID>/<document UUID>/<sanitized filename>
-- Verified in production/advocatedesk-final app.js on 2026-10-29.
--
-- This is NOT a complete release migration:
-- * It does not add case-level authorization to public.case_documents.
-- * Production has no case_assignments / role_permissions / can_access_case model.
-- * The existing metadata table policies still authorize workspace members.
-- * Apply only after disposable-project testing and a reviewed release plan.
--
-- Defense in depth: each operation has both a permissive grant and a matching
-- restrictive guard. Restrictive policies are ANDed with every permissive policy,
-- so an unrelated/legacy permissive policy cannot bypass these conditions.
-- Review the complete live policy inventory before applying; this draft has not run.
-- Intended protections:
-- * read/delete only when an exact case_documents.storage_path metadata row exists
--   and its workspace_id and id match the first two path segments;
-- * upload only to a well-formed workspace/document UUID path by a workspace
--   member, with owner_id matching auth.uid();
-- * malformed UUID folder names deny instead of raising UUID cast errors.
--
-- Keep bucket private. The existing UI uploads the object first and then inserts
-- metadata; reads use createSignedUrl; deletes remove the object before metadata.
-- Thus INSERT cannot require a metadata row yet, while SELECT/DELETE can.

begin;

drop policy if exists "Workspace members can read case document files" on storage.objects;
drop policy if exists "Workspace members can upload case document files" on storage.objects;
drop policy if exists "Workspace members can delete case document files" on storage.objects;

create policy "AdvocateDesk document files require metadata match for read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'advocatedesk-documents'
  and case
    when
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (
      select 1
      from public.case_documents d
      where d.storage_path = objects.name
        and d.workspace_id = ((storage.foldername(objects.name))[1])::uuid
        and d.id = ((storage.foldername(objects.name))[2])::uuid
    )
    else false
  end
);

create policy "AdvocateDesk document files restrictive metadata guard for read"
on storage.objects
as restrictive
for select
to authenticated
using (
  bucket_id = 'advocatedesk-documents'
  and case
    when
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (
      select 1
      from public.case_documents d
      where d.storage_path = objects.name
        and d.workspace_id = ((storage.foldername(objects.name))[1])::uuid
        and d.id = ((storage.foldername(objects.name))[2])::uuid
    )
    else false
  end
);

create policy "AdvocateDesk document files require member owner and valid path for upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'advocatedesk-documents'
  and owner_id = (select (auth.uid())::text)
  and case
    when
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.is_workspace_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy "AdvocateDesk document files restrictive owner and path guard for upload"
on storage.objects
as restrictive
for insert
to authenticated
with check (
  bucket_id = 'advocatedesk-documents'
  and owner_id = (select (auth.uid())::text)
  and case
    when
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.is_workspace_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy "AdvocateDesk document files require metadata match for delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'advocatedesk-documents'
  and case
    when
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (
      select 1
      from public.case_documents d
      where d.storage_path = objects.name
        and d.workspace_id = ((storage.foldername(objects.name))[1])::uuid
        and d.id = ((storage.foldername(objects.name))[2])::uuid
    )
    else false
  end
);

create policy "AdvocateDesk document files restrictive metadata guard for delete"
on storage.objects
as restrictive
for delete
to authenticated
using (
  bucket_id = 'advocatedesk-documents'
  and case
    when
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (
      select 1
      from public.case_documents d
      where d.storage_path = objects.name
        and d.workspace_id = ((storage.foldername(objects.name))[1])::uuid
        and d.id = ((storage.foldername(objects.name))[2])::uuid
    )
    else false
  end
);

commit;

-- REQUIRED TESTS BEFORE APPROVAL:
-- 1. Valid upload path and metadata insert: allowed; signed URL works for member.
-- 2. Existing valid object with exact metadata row: read/delete allowed.
-- 3. Guessed path with no metadata row: signed URL/read and delete denied.
-- 4. Metadata path whose workspace/document UUID disagrees with path: denied.
-- 5. Malformed first/second folder UUID: denied without SQL exception.
-- 6. Cross-workspace member: read/upload/delete denied.
-- 7. Upload as non-owner / owner_id mismatch: denied.
-- 8. Upload object then fail metadata insert: object cleanup still works; verify no orphan.
-- 9. Delete object then metadata delete failure: verify recoverability and retry behavior.
-- 10. Existing legitimate documents remain readable and deletable.
-- 11. Run all tests with real authenticated sessions and anon/unauthenticated requests.
-- 12. Separately solve case-level authorization for metadata and Storage before release.
