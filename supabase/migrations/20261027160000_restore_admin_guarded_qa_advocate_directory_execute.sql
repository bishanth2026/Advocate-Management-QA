REVOKE EXECUTE ON FUNCTION public.qa_list_workspace_advocates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_list_workspace_advocates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_list_workspace_advocates(uuid) TO service_role;
