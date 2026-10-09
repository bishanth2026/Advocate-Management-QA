-- AdvocateDesk QA Phase B: enforce least-privilege case-document metadata access.
-- QA only. Shared practice_records workspace_state remains a separate unresolved security boundary.
BEGIN;

DROP POLICY IF EXISTS case_documents_select_member ON public.case_documents;
CREATE POLICY case_documents_select_authorized
  ON public.case_documents FOR SELECT TO authenticated
  USING (
    private.has_workspace_permission(workspace_id, 'documents.view')
    AND private.can_access_case(workspace_id, case_id)
  );

DROP POLICY IF EXISTS case_documents_insert_member ON public.case_documents;
CREATE POLICY case_documents_insert_authorized
  ON public.case_documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND private.has_workspace_permission(workspace_id, 'documents.upload')
    AND private.can_access_case(workspace_id, case_id)
  );

DROP POLICY IF EXISTS case_documents_delete_member ON public.case_documents;
CREATE POLICY case_documents_delete_authorized
  ON public.case_documents FOR DELETE TO authenticated
  USING (
    private.has_workspace_permission(workspace_id, 'documents.delete')
    AND private.can_access_case(workspace_id, case_id)
  );

-- Storage reads/deletes are only allowed for objects that have a matching metadata
-- row and whose case the current user is authorized to access. Upload remains scoped
-- to an active workspace member with the upload permission; metadata insert then
-- enforces case assignment. This avoids assuming the storage path encodes case_id.
DROP POLICY IF EXISTS advocatedesk_documents_read_member ON storage.objects;
CREATE POLICY advocatedesk_documents_read_authorized
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'advocatedesk-documents'
    AND EXISTS (
      SELECT 1
      FROM public.case_documents d
      WHERE d.storage_path = storage.objects.name
        AND private.has_workspace_permission(d.workspace_id, 'documents.view')
        AND private.can_access_case(d.workspace_id, d.case_id)
    )
  );

DROP POLICY IF EXISTS advocatedesk_documents_delete_member ON storage.objects;
CREATE POLICY advocatedesk_documents_delete_authorized
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'advocatedesk-documents'
    AND EXISTS (
      SELECT 1
      FROM public.case_documents d
      WHERE d.storage_path = storage.objects.name
        AND private.has_workspace_permission(d.workspace_id, 'documents.delete')
        AND private.can_access_case(d.workspace_id, d.case_id)
    )
  );

DROP POLICY IF EXISTS advocatedesk_documents_insert_member ON storage.objects;
CREATE POLICY advocatedesk_documents_insert_authorized
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'advocatedesk-documents'
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN private.is_workspace_member(((storage.foldername(name))[1])::uuid)
           AND private.has_workspace_permission(((storage.foldername(name))[1])::uuid, 'documents.upload')
      ELSE false
    END
  );

COMMIT;
