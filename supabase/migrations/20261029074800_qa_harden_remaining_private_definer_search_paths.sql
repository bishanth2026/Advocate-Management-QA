-- QA-only hardening. Applied to AdvocateDesk-Test (uqtsksgypncsbcnuanbk) on 2026-10-29.
-- Production is intentionally untouched. Rehearse and review separately before any production migration.
ALTER FUNCTION private.assign_case_to_member(uuid, text, uuid) SET search_path = '';
ALTER FUNCTION private.unassign_case_from_member(uuid, text, uuid) SET search_path = '';
ALTER FUNCTION private.finance_case_directory(uuid) SET search_path = '';
ALTER FUNCTION private.finance_case_directory_v2(uuid) SET search_path = '';
ALTER FUNCTION private.finance_client_directory(uuid) SET search_path = '';
ALTER FUNCTION private.finance_client_directory_v2(uuid) SET search_path = '';
ALTER FUNCTION private.qa_list_workspace_advocates_internal(uuid) SET search_path = '';
