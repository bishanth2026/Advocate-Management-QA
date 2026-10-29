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
assert.match(shell, /auth\.js\?v=20261029-fail-closed-workspace/, "App shell must cache-bust the corrected Production session validation code");

console.log("AdvocateDesk production safety smoke checks: PASS");
