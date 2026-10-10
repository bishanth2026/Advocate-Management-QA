-- PHASE C7D DRAFT — DO NOT APPLY UNTIL AUTHENTICATED-JWT TESTS EXIST.
-- Additive transaction/revision foundation for QA review only.
-- This file is intentionally a design draft; it is not included in the applied migration history.
-- The current browser app still uses practice_records.workspace_state. Do not cut over.

BEGIN;

CREATE TABLE IF NOT EXISTS public.practice_resource_revisions (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.practice_resource_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS practice_resource_revisions_select_member
  ON public.practice_resource_revisions;
CREATE POLICY practice_resource_revisions_select_member
  ON public.practice_resource_revisions
  FOR SELECT TO authenticated
  USING (private.is_workspace_member(workspace_id));

-- Deliberately no client INSERT/UPDATE/DELETE policy in this draft.
-- The transactional RPC below requires a dedicated, reviewed privilege boundary
-- because revision increment and resource writes must be atomic and authorized.
-- A SECURITY INVOKER function cannot update the revision row without a mutation
-- policy; a SECURITY DEFINER function needs a narrow, audited authorization path.
-- Therefore the save RPC is NOT defined in this draft.

COMMIT;

-- Acceptance checklist before a later RPC migration:
-- 1. Decide and document SECURITY INVOKER vs SECURITY DEFINER. No implicit bypass.
-- 2. Validate auth.uid(), active workspace membership, resource-type permission,
--    and case assignment for every operation, including deletes.
-- 3. Reject unknown operation keys/types, malformed payloads, duplicate IDs,
--    blank/oversized IDs, unsupported document mutations, and mismatched case links.
-- 4. Lock revision row, compare expected_revision, and raise SQLSTATE 40001 when stale.
-- 5. Increment revision and perform all row changes in the same Postgres transaction.
-- 6. Prove rollback if any operation fails; prove two concurrent saves cannot both
--    commit from the same expected revision.
-- 7. Test using real authenticated JWTs for Admin, assigned Advocate, unassigned
--    Advocate, Accountant, workspace non-member, and anon. SQL role simulation alone
--    is insufficient.
-- 8. Only then wire the QA UI to RPC, preserving the legacy save path behind a flag
--    until payload parity and rollback acceptance are signed off.
