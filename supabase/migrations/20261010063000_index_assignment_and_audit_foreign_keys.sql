-- QA-only performance hardening: index foreign-key columns used for joins/audit queries.
-- Additive and non-destructive; do not apply to production without a separate approved rollout.
CREATE INDEX IF NOT EXISTS case_assignments_assigned_by_idx
  ON public.case_assignments (assigned_by);

CREATE INDEX IF NOT EXISTS workspace_audit_log_actor_user_id_idx
  ON public.workspace_audit_log (actor_user_id);

CREATE INDEX IF NOT EXISTS workspace_audit_log_target_user_id_idx
  ON public.workspace_audit_log (target_user_id);
