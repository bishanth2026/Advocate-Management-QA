-- QA-only least-privilege hardening.
-- The application uses authenticated sessions for resource access. RLS policies
-- on practice_resources are explicitly TO authenticated; anonymous table grants
-- are unnecessary and broaden the SQL privilege surface.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.practice_resources FROM anon;
COMMIT;
