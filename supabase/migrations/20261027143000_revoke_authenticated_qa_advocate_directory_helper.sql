-- QA-only: this helper has no reference in the inspected application source.
-- It returns advocate names/emails and should not be exposed as an authenticated RPC.
REVOKE EXECUTE ON FUNCTION public.qa_list_workspace_advocates(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.qa_list_workspace_advocates(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.qa_list_workspace_advocates(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.qa_list_workspace_advocates(uuid) TO service_role;
