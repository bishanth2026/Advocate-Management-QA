-- PHASE C7 DISPOSABLE FIXTURE TEMPLATE — DO NOT RUN UNTIL REVIEWED.
-- QA project uqtsksgypncsbcnuanbk only. Never production.
-- This script writes data when executed. Replace all five UUID constants with
-- verified disposable auth.users.id values before execution. It deliberately
-- fails before INSERTs while any placeholder remains or any Auth user is absent.
-- Run the whole file as one transaction in the QA SQL Editor. Never run fragments.
--
-- Create dedicated Auth users first using the Supabase Dashboard:
-- admin, assigned advocate, unassigned advocate, accountant, nonmember.
-- Keep tokens out of this file/repository. This script creates a fresh workspace
-- and fixtures only; it does not create Auth users or retrieve JWTs.

BEGIN;

DO $fixture$
DECLARE
  -- REQUIRED: replace with verified Auth UUIDs from the isolated QA project.
  v_admin uuid := '00000000-0000-4000-8000-000000000001';
  v_assigned_advocate uuid := '00000000-0000-4000-8000-000000000002';
  v_unassigned_advocate uuid := '00000000-0000-4000-8000-000000000003';
  v_accountant uuid := '00000000-0000-4000-8000-000000000004';
  v_nonmember uuid := '00000000-0000-4000-8000-000000000005';

  -- Change this run key for every seed attempt; keep <= 200 characters.
  v_run_key text := 'qa-c7h-20261010-run-001';
  v_workspace_id uuid;
  v_case_assigned text;
  v_case_unassigned text;
BEGIN
  IF v_admin::text LIKE '00000000-0000-4000-8000-00000000000_' OR
     v_assigned_advocate::text LIKE '00000000-0000-4000-8000-00000000000_' OR
     v_unassigned_advocate::text LIKE '00000000-0000-4000-8000-00000000000_' OR
     v_accountant::text LIKE '00000000-0000-4000-8000-00000000000_' OR
     v_nonmember::text LIKE '00000000-0000-4000-8000-00000000000_' THEN
    RAISE EXCEPTION 'Replace every placeholder with a verified disposable Auth UUID before running';
  END IF;

  IF v_admin = v_assigned_advocate OR v_admin = v_unassigned_advocate OR
     v_admin = v_accountant OR v_admin = v_nonmember OR
     v_assigned_advocate = v_unassigned_advocate OR
     v_assigned_advocate = v_accountant OR v_assigned_advocate = v_nonmember OR
     v_unassigned_advocate = v_accountant OR v_unassigned_advocate = v_nonmember OR
     v_accountant = v_nonmember THEN
    RAISE EXCEPTION 'Each test role must use a distinct disposable Auth identity';
  END IF;

  IF v_run_key IS NULL OR v_run_key !~ '^qa-c7h-[a-zA-Z0-9-]{8,80}$' THEN
    RAISE EXCEPTION 'Use a unique run key like qa-c7h-20261010-run-002';
  END IF;

  IF (SELECT count(*) FROM auth.users
      WHERE id IN (v_admin,v_assigned_advocate,v_unassigned_advocate,v_accountant,v_nonmember)) <> 5 THEN
    RAISE EXCEPTION 'One or more UUIDs are not present in auth.users in this QA project';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id IN (v_admin,v_assigned_advocate,v_unassigned_advocate,v_accountant,v_nonmember)
  ) THEN
    RAISE EXCEPTION 'At least one test identity already belongs to a workspace; stop and investigate before seeding';
  END IF;

  v_case_assigned := v_run_key || '-case-assigned';
  v_case_unassigned := v_run_key || '-case-unassigned';

  -- Generate workspace ID in the database. Workspace creation and every fixture
  -- below commit or roll back together.
  INSERT INTO public.workspaces(name, owner_id, status)
  VALUES ('Disposable AdvocateDesk QA ' || v_run_key, v_admin, 'active')
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES
    (v_workspace_id,v_admin,'admin'),
    (v_workspace_id,v_assigned_advocate,'advocate'),
    (v_workspace_id,v_unassigned_advocate,'advocate'),
    (v_workspace_id,v_accountant,'accountant');

  -- The nonmember intentionally is NOT inserted into workspace_members.
  INSERT INTO public.practice_resources
    (workspace_id,resource_type,resource_id,case_id,payload,source_hash)
  VALUES
    (v_workspace_id,'case',v_case_assigned,v_case_assigned,
     jsonb_build_object('title','QA fixture assigned case','qa_fixture',true,'qa_run',v_run_key),
     md5(v_run_key || '-case-assigned')),
    (v_workspace_id,'case',v_case_unassigned,v_case_unassigned,
     jsonb_build_object('title','QA fixture unassigned case','qa_fixture',true,'qa_run',v_run_key),
     md5(v_run_key || '-case-unassigned')),
    (v_workspace_id,'task',v_run_key || '-task-unlinked',NULL,
     jsonb_build_object('title','QA fixture unlinked task','qa_fixture',true,'qa_run',v_run_key),
     md5(v_run_key || '-task-unlinked')),
    (v_workspace_id,'task',v_run_key || '-task-assigned',v_case_assigned,
     jsonb_build_object('title','QA fixture assigned task','qa_fixture',true,'qa_run',v_run_key),
     md5(v_run_key || '-task-assigned')),
    (v_workspace_id,'task',v_run_key || '-task-unassigned',v_case_unassigned,
     jsonb_build_object('title','QA fixture other-case task','qa_fixture',true,'qa_run',v_run_key),
     md5(v_run_key || '-task-unassigned'));

  INSERT INTO public.case_assignments(workspace_id,case_id,user_id,assigned_by) VALUES
    (v_workspace_id,v_case_assigned,v_assigned_advocate,v_admin),
    (v_workspace_id,v_case_unassigned,v_unassigned_advocate,v_admin);

  -- Sanity checks run before transaction commits.
  IF (SELECT count(*) FROM public.workspace_members
      WHERE workspace_id=v_workspace_id) <> 4 THEN
    RAISE EXCEPTION 'Workspace membership count is not exactly four';
  END IF;
  IF EXISTS (SELECT 1 FROM public.workspace_members
             WHERE workspace_id=v_workspace_id AND user_id=v_nonmember) THEN
    RAISE EXCEPTION 'Nonmember unexpectedly has workspace membership';
  END IF;
  IF (SELECT count(*) FROM public.practice_resources
      WHERE workspace_id=v_workspace_id AND resource_type='task') <> 3 THEN
    RAISE EXCEPTION 'Task fixture count is not exactly three';
  END IF;
  IF (SELECT count(*) FROM public.case_assignments
      WHERE workspace_id=v_workspace_id) <> 2 THEN
    RAISE EXCEPTION 'Assignment count is not exactly two';
  END IF;

  RAISE NOTICE 'QA fixture created. workspace_id=%, assigned_case_id=%, unassigned_case_id=%, unlinked_task_id=%, assigned_task_id=%, unassigned_task_id=%',
    v_workspace_id, v_case_assigned, v_case_unassigned,
    v_run_key || '-task-unlinked', v_run_key || '-task-assigned',
    v_run_key || '-task-unassigned';
END
$fixture$;

COMMIT;

-- IMPORTANT:
-- 1. This is a privileged SQL Editor seed, not an RLS test. It bypasses the
--    authenticated HTTP request path and proves nothing about policy correctness.
-- 2. Copy the NOTICE IDs into a local, untracked note, then obtain short-lived
--    JWTs for each dedicated identity and run the GET-only harness.
-- 3. Do not seed again with the same users: this script deliberately stops if
--    any supplied identity is already a workspace member.
-- 4. Do not run broad cleanup DELETEs. Verify exact foreign keys and delete only
--    this workspace's fixture rows after the acceptance evidence is retained.
