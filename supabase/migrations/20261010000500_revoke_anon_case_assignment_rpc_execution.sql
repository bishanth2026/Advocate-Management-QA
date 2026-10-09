-- Restrict case-assignment RPC execution to authenticated callers.
-- Each function still performs its own active-Admin authorization check.
REVOKE EXECUTE ON FUNCTION public.assign_case_to_member(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unassign_case_from_member(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_case_to_member(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unassign_case_from_member(uuid, text, uuid) TO authenticated;
