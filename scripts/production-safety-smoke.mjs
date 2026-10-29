import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const auth = read("../auth.js");
assert.match(auth, /members\.length!==1/, "Ambiguous active workspace memberships must fail closed");
const app = read("../app.js");
const shell = read("../app.html");
const reset = read("../reset-password.html");
const memberLogin = read("../member-login.html");
const portalSelection = read("../login.html");
assert.doesNotMatch(portalSelection, /Demo Frontend/i, "Production login portal must not carry demo-only branding");
const provisioning = read("../supabase/functions/advocatedesk-provision-user/index.ts");

assert.match(auth, /https:\/\/ykxfidrtvmkmmbxameji\.supabase\.co/, "Production auth must point to the production Supabase project");
assert.doesNotMatch(auth, /uqtsksgypncsbcnuanbk|Advocate-Management-QA/i, "Production auth must not contain QA Supabase/site configuration");
assert.match(reset, /https:\/\/ykxfidrtvmkmmbxameji\.supabase\.co/, "Production reset page must point to production Supabase");
assert.match(auth, /old&&old\.role===\"admin\"\?\"admin\":\"member\"/, "Non-admin sessions must validate through active member access, not the admin-only portal");
assert.match(portalSelection, /href=\"member-login\.html\"/, "Portal selection must expose Advocate and Staff login");
assert.match(memberLogin, /ADAuth\.signIn\([\s\S]*?,\x27member\x27\)/, "Member login must use the member access path");
assert.match(memberLogin, /https:\/\/cdn\.jsdelivr\.net\/npm\/\@supabase\/supabase-js@2/, "Member login must load Supabase client");
assert.doesNotMatch(memberLogin, /uqtsksgypncsbcnuanbk|Advocate-Management-QA/i, "Member login must not contain QA configuration");
assert.doesNotMatch(reset, /uqtsksgypncsbcnuanbk|Advocate-Management-QA/i, "Production reset page must not contain QA configuration");
assert.match(reset, /href="member-login\.html">Advocate &amp; Staff Login/, "Password reset page must provide the member login route");
assert.match(reset, /reset-page-version" content="20261028-03"/, "Password reset page must advertise the current version");
assert.match(app, /async function validateDocumentFileSignature\(file\)/, "Document signature validation must exist");
assert.match(app, /head\.includes\("%PDF-"\)/, "PDF signature check must exist");
assert.match(app, /starts\(\[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a\]\)/, "PNG signature check must exist");
assert.match(app, /starts\(\[0xff,0xd8,0xff\]\)/, "JPEG signature check must exist");
assert.match(app, /\[Content_Types\]\.xml.*word\/document\.xml/s, "DOCX package markers must be checked");
assert.match(provisioning, /async function listAllAuthUsers\(/, "Administrator listing must paginate Auth users");
assert.match(provisioning, /listUsers\(\{ page, perPage \}\)/, "Auth pagination must request each page");
assert.match(provisioning, /callerProfile\?\.platform_role !== "super_admin"/, "Provisioning must verify Super Admin role");
assert.match(provisioning, /action !== "invite_admin"/, "Unsupported provisioning actions must be rejected");
assert.doesNotMatch(shell, /uqtsksgypncsbcnuanbk|Advocate-Management-QA/i, "Production app shell must not contain QA configuration");
assert.match(shell, /id="cloudSyncStatus"[^>]*>Cloud: Connecting…<\/span>/, "Cloud status must not claim Synced before the initial workspace read completes");
assert.match(shell, /setSyncStatus\(result\.data\?'Cloud: Synced':'Cloud: Ready — not saved yet'/, "An empty, never-saved workspace must not be labeled Synced");
assert.match(shell, /auth\.js\?v=20261029-fail-closed-workspace/, "App shell must cache-bust the corrected Production session validation code");

// The monolithic workspace_state contains multiple cases. Until case-scoped RLS is verified,
// non-Admin roles must be blocked before the client fetches that payload.
const roleGuard = shell.indexOf("String(auth.workspaceRole||'').toLowerCase()!=='admin'");
const workspaceRead = shell.indexOf("from('practice_records').select('id,payload,updated_at')");
assert.ok(roleGuard >= 0, "Non-Admin workspace-state guard must exist");
assert.ok(workspaceRead > roleGuard, "Non-Admin guard must run before workspace-state read");
assert.match(shell, /Advocate\/Staff access will be restored after case-level permissions are deployed and verified/, "Blocked members must receive a clear security explanation");


const workspaceStatePolicy = read("../supabase/drafts/production-workspace-state-admin-only-hotfix.sql");
assert.match(workspaceStatePolicy, /DRAFT ONLY — NOT APPLIED/i, "Workspace-state containment SQL must remain draft-only");
assert.match(workspaceStatePolicy, /on public\.practice_records\s+as restrictive\s+for all\s+to authenticated/i, "Workspace-state policy must be restrictive for all authenticated operations");
assert.match(workspaceStatePolicy, /record_type is distinct from 'other'[\s\S]*record_key is distinct from 'workspace_state'/i, "Containment policy must target only the monolithic workspace_state record");
assert.match(workspaceStatePolicy, /wm\.user_id = \(select auth\.uid\(\)\)[\s\S]*wm\.role = 'admin'[\s\S]*w\.status = 'active'/i, "Workspace-state policy must require the caller's active Admin membership");
assert.match(workspaceStatePolicy, /using \([\s\S]*\)\s+with check \(/i, "Workspace-state policy must guard both reads/mutations and inserted/updated rows");
const workspaceStatePolicySql = workspaceStatePolicy.replace(/--.*$/gm, "");
assert.doesNotMatch(workspaceStatePolicySql, /private\.has_workspace_permission|private\.can_access_case/i, "Production hotfix draft must not depend on QA-only authorization helpers");



// The Storage hardening candidate must remain draft-only and enforce exact metadata/path
// matching. These assertions are static guardrails only; they do not execute PostgreSQL RLS.
const storagePolicy = read("../supabase/drafts/production-document-storage-hardening.sql");
assert.match(storagePolicy, /DRAFT ONLY — do not apply to Production/i, "Storage hardening SQL must remain draft-only");
assert.match(storagePolicy, /on storage\.objects[\s\S]*for select[\s\S]*to authenticated/i, "Storage read policy must be authenticated-only");
assert.match(storagePolicy, /on storage\.objects[\s\S]*for insert[\s\S]*to authenticated/i, "Storage upload policy must be authenticated-only");
assert.match(storagePolicy, /on storage\.objects[\s\S]*for delete[\s\S]*to authenticated/i, "Storage delete policy must be authenticated-only");
assert.match(storagePolicy, /d\.storage_path = objects\.name[\s\S]*d\.workspace_id = \(\(storage\.foldername\(objects\.name\)\)\[1\]\)::uuid[\s\S]*d\.id = \(\(storage\.foldername\(objects\.name\)\)\[2\]\)::uuid/i, "Storage read/delete must match exact object path, workspace and document IDs");
assert.match(storagePolicy, /owner_id = \(select \(auth\.uid\(\)\)::text\)/i, "Storage uploads must bind object ownership to the authenticated user");
assert.match(storagePolicy, /private\.is_workspace_member\(\(\(storage\.foldername\(name\)\)\[1\]\)::uuid\)/i, "Storage uploads must require active workspace membership helper");
assert.match(storagePolicy, /case\s+when[\s\S]*then exists[\s\S]*else false\s+end/i, "Malformed Storage path segments must fail closed");
assert.match(storagePolicy, /on storage\.objects\s+as restrictive\s+for select\\s+to authenticated/i, "Storage read must have a restrictive guard that cannot be bypassed by another permissive policy");
assert.match(storagePolicy, /on storage\.objects\s+as restrictive\s+for insert\\s+to authenticated/i, "Storage upload must have a restrictive guard that cannot be bypassed by another permissive policy");
assert.match(storagePolicy, /on storage\.objects\s+as restrictive\s+for delete\\s+to authenticated/i, "Storage delete must have a restrictive guard that cannot be bypassed by another permissive policy");
assert.match(storagePolicy, /Defense in depth: each operation has both a permissive grant and a matching/i, "Storage draft must document defense-in-depth policy semantics");
assert.match(storagePolicy, /Separately solve case-level authorization/i, "Storage draft must explicitly disclose that case-level authorization remains unresolved");

console.log("AdvocateDesk production safety smoke checks: PASS");
