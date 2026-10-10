# Phase C7C — QA Supabase Advisor Review — 10 October 2026

## Scope
Ran Supabase Security and Performance Advisors against the isolated QA project `uqtsksgypncsbcnuanbk`. No database or Auth settings were changed. Production was not accessed.

## Security findings

### 1. SECURITY DEFINER RPC lint — review required, not an automatic vulnerability
The advisor reports authenticated EXECUTE access to:
- `public.assign_case_to_member(uuid,text,uuid)`
- `public.unassign_case_from_member(uuid,text,uuid)`

These functions are SECURITY DEFINER and are exposed through the PostgREST RPC schema. Their current function bodies explicitly require `auth.uid()` and an active workspace Admin membership before assignment changes; the assignment function also validates the case and target membership, and both write audit entries as appropriate. This is a meaningful authorization check, but function execution should remain deliberate and narrowly granted. Do not switch them to SECURITY INVOKER without testing: they currently perform privileged writes to assignment and audit tables, and invoker RLS/grants may break that workflow. Next check: verify EXECUTE grants for PUBLIC, anon, and authenticated and confirm no other callable roles; keep only the intended authenticated execution if that is the application contract.

Advisor remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

### 2. Leaked-password protection disabled
Supabase Auth reports leaked-password protection is disabled in QA. Enable this in the QA Auth settings after confirming expected sign-in UX and plan availability. This setting was not changed by this audit.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Performance findings
The performance advisor lists nine indexes as unused in its observed statistics, including indexes on legacy records, document metadata, workspace ownership, assignment and audit fields, and the resource legacy link.

Do not drop them solely from this snapshot. This is a small QA dataset and indexes can be important for authorization predicates or production-scale workloads. Reassess after realistic query traffic and inspect query plans before any index removal.

## Automated workflow status
The report commit preceding this one passed both QA validation and QA Pages deployment:
- Validation: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38032710989
- QA Pages: https://github.com/bishanth2026/Advocate-Management-QA/actions/runs/38032710924

## Release gate
This advisor review does not certify production readiness. Continue to block resource-store cutover pending authenticated HTTP/RLS tests, transactional save implementation, concurrency/rollback tests, and verified document upload failure cleanup. All work remains confined to the QA project and staging branch.
