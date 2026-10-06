import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const auth = read("../auth.js");
const app = read("../app.js");
const shell = read("../app.html");
const reset = read("../reset-password.html");
const provisioning = read("../supabase/functions/advocatedesk-provision-user/index.ts");

assert.match(auth, /https:\/\/ykxfidrtvmkmmbxameji\.supabase\.co/, "Production auth must point to the production Supabase project");
assert.doesNotMatch(auth, /uqtsksgypncsbcnuanbk|Advocate-Management-QA/i, "Production auth must not contain QA Supabase/site configuration");
assert.match(reset, /https:\/\/ykxfidrtvmkmmbxameji\.supabase\.co/, "Production reset page must point to production Supabase");
assert.doesNotMatch(reset, /uqtsksgypncsbcnuanbk|Advocate-Management-QA/i, "Production reset page must not contain QA configuration");
assert.match(app, /async function validateDocumentFileSignature\(file\)/, "Document signature validation must exist");
assert.match(app, /head\.includes\("%PDF-"\)/, "PDF signature check must exist");
assert.match(app, /starts\(\[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a\]\)/, "PNG signature check must exist");
assert.match(app, /starts\(\[0xff,0xd8,0xff\]\)/, "JPEG signature check must exist");
assert.match(app, /\[Content_Types\]\.xml.*word\/document\.xml/s, "DOCX package markers must be checked");
assert.match(provisioning, /async function listAllAuthUsers\(/, "Administrator listing must paginate Auth users");
assert.match(provisioning, /listUsers\(\{ page, perPage \}\)/, "Auth pagination must request each page");
assert.match(provisioning, /callerProfile\?\.platform_role !== "super_admin"/, "Provisioning must verify Super Admin role");
assert.match(provisioning, /action !== "invite_admin"/, "Unsupported provisioning actions must be rejected");
assert.doesNotMatch(provisioning, /invite_super_admin/, "Production provisioning endpoint must not expose Super Admin invitation");
assert.doesNotMatch(provisioning, /bishanth2026\.github\.io\/Advocate-Management-QA/, "Production provisioning endpoint must not contain QA redirect URLs");
assert.match(provisioning, /advocate\.biznexco\.in\/reset-password\.html/, "Production provisioning invites must use the production reset URL");
assert.doesNotMatch(shell, /uqtsksgypncsbcnuanbk|Advocate-Management-QA/i, "Production app shell must not contain QA configuration");

console.log("AdvocateDesk production safety smoke checks: PASS");
