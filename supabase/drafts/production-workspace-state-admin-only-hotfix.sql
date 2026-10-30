-- DRAFT ONLY — NOT APPLIED TO Production or QA.
-- Purpose: immediate database-level containment for the monolithic workspace_state row.
-- Production schema currently has no private.has_workspace_permission() helper, so this
-- policy deliberately uses only Production-existing workspace_members/workspaces columns.
--
-- Security behavior:
--   * All non-workspace_state rows retain their current RLS behavior.
--   * A row with record_type='other' AND record_key='workspace_state' is restricted
--     to an authenticated user who is an active member with role='admin' in that workspace.
--   * The same condition applies to reads, inserts, updates, and deletes.
--
-- IMPORTANT:
--   * Review and rehearse in a disposable Production-schema clone before applying.
--   * This is a containment hotfix, NOT the final case-level authorization design.
--   * It intentionally blocks Advocate/Staff cloud sync while the app still uses the
--     monolithic payload. Do not deploy unless the resulting product impact is accepted.
--   * Confirm the exact persisted row uses record_type='other', record_key='workspace_state'
--     before applying. Do not guess or auto-backfill.
--
-- Apply only after a verified backup, authenticated positive/negative tests, and rollback rehearsal.

begin;

drop policy if exists production_workspace_state_admin_only on public.practice_records;

create policy production_workspace_state_admin_only
on public.practice_records
as restrictive
for all
to authenticated
using (
  record_type is distinct from 'other'
  or record_key is distinct from 'workspace_state'
  or exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = practice_records.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = 'admin'
      and w.status = 'active'
  )
)
with check (
  record_type is distinct from 'other'
  or record_key is distinct from 'workspace_state'
  or exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = practice_records.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = 'admin'
      and w.status = 'active'
  )
);

commit;

-- Rollback (only if this policy was the one applied and rollback is approved):
-- drop policy if exists production_workspace_state_admin_only on public.practice_records;
