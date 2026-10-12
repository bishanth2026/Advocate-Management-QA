-- QA ONLY: atomic, RLS-preserving batch writes for practice_resources.
-- This migration is a draft and must be reviewed/tested on the QA project only.
-- SECURITY INVOKER is intentional: underlying practice_resources RLS remains in force.
CREATE OR REPLACE FUNCTION public.apply_practice_resource_batch(
  p_workspace_id uuid,
  p_changes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_change jsonb;
  v_op text;
  v_resource_type text;
  v_resource_id text;
  v_row_id uuid;
  v_expected_updated_at timestamptz;
  v_case_id text;
  v_payload jsonb;
  v_applied integer := 0;
  v_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_workspace_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND w.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active workspace membership required' USING ERRCODE = '42501';
  END IF;

  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'array' THEN
    RAISE EXCEPTION 'Changes must be a JSON array' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_changes) > 250 THEN
    RAISE EXCEPTION 'Batch exceeds the 250-change limit' USING ERRCODE = '22023';
  END IF;

  FOR v_change IN SELECT value FROM jsonb_array_elements(p_changes)
  LOOP
    IF jsonb_typeof(v_change) <> 'object' THEN
      RAISE EXCEPTION 'Every change must be an object' USING ERRCODE = '22023';
    END IF;

    v_op := v_change->>'op';

    IF v_op = 'insert' THEN
      v_resource_type := v_change->>'resource_type';
      v_resource_id := btrim(COALESCE(v_change->>'resource_id', ''));
      v_payload := v_change->'payload';
      v_case_id := NULLIF(btrim(v_change->>'case_id'), '');

      IF v_resource_type NOT IN (
        'case','client','hearing','task','invoice','payment','transaction',
        'meeting','discussion','court','case_party'
      ) OR v_resource_id = '' OR length(v_resource_id) > 200 THEN
        RAISE EXCEPTION 'Invalid resource type or resource ID' USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(v_payload) <> 'object'
         OR v_payload->>'id' IS DISTINCT FROM v_resource_id THEN
        RAISE EXCEPTION 'Payload ID must match resource_id' USING ERRCODE = '22023';
      END IF;

      INSERT INTO public.practice_resources
        (workspace_id, resource_type, resource_id, case_id, payload)
      VALUES
        (p_workspace_id, v_resource_type, v_resource_id, v_case_id, v_payload);

      v_applied := v_applied + 1;

    ELSIF v_op = 'update' THEN
      v_row_id := NULLIF(v_change->>'id', '')::uuid;
      v_expected_updated_at := NULLIF(v_change->>'expected_updated_at', '')::timestamptz;
      v_resource_type := v_change->>'resource_type';
      v_resource_id := btrim(COALESCE(v_change->>'resource_id', ''));
      v_payload := v_change->'payload';
      v_case_id := NULLIF(btrim(v_change->>'case_id'), '');

      IF v_row_id IS NULL OR v_expected_updated_at IS NULL
         OR v_resource_type NOT IN (
           'case','client','hearing','task','invoice','payment','transaction',
           'meeting','discussion','court','case_party'
         ) OR v_resource_id = '' OR length(v_resource_id) > 200 THEN
        RAISE EXCEPTION 'Update requires row ID, expected version, resource type and resource ID' USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(v_payload) <> 'object'
         OR v_payload->>'id' IS DISTINCT FROM v_resource_id THEN
        RAISE EXCEPTION 'Payload ID must match resource_id' USING ERRCODE = '22023';
      END IF;

      UPDATE public.practice_resources
         SET payload = v_payload,
             case_id = v_case_id,
             updated_at = now()
       WHERE id = v_row_id
         AND workspace_id = p_workspace_id
         AND resource_type = v_resource_type
         AND resource_id = v_resource_id
         AND updated_at = v_expected_updated_at;

      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Resource changed, is hidden by policy, or is not editable; refresh and retry' USING ERRCODE = '40001';
      END IF;

      v_applied := v_applied + 1;

    ELSIF v_op = 'delete' THEN
      v_row_id := NULLIF(v_change->>'id', '')::uuid;
      v_expected_updated_at := NULLIF(v_change->>'expected_updated_at', '')::timestamptz;

      IF v_row_id IS NULL OR v_expected_updated_at IS NULL THEN
        RAISE EXCEPTION 'Delete requires row ID and expected version' USING ERRCODE = '22023';
      END IF;

      DELETE FROM public.practice_resources
       WHERE id = v_row_id
         AND workspace_id = p_workspace_id
         AND updated_at = v_expected_updated_at;

      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Resource changed, is hidden by policy, or is not deletable; refresh and retry' USING ERRCODE = '40001';
      END IF;

      v_applied := v_applied + 1;

    ELSE
      RAISE EXCEPTION 'Unsupported batch operation' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN jsonb_build_object('applied', v_applied, 'atomic', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_practice_resource_batch(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_practice_resource_batch(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_practice_resource_batch(uuid, jsonb) TO authenticated;
