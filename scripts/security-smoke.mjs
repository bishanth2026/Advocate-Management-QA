import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const auth = read("../auth.js");
const app = read("../app.js");
const shell = read("../app.html");
const loginPages = ["../login.html", "../admin-login.html", "../super-admin-login.html"].map(read);
const provisioning = read("../supabase/functions/advocatedesk-provision-user/index.ts");

assert.match(auth, /https:\/\/uqtsksgypncsbcnuanbk\.supabase\.co/, "Auth must point to the isolated QA Supabase project");
assert.doesNotMatch(auth, /ykxfidrtvmkmmbxameji|advocate-management\.supabase\.co/i, "QA Auth must not point to production Supabase");
assert.match(auth, /sb_publishable_/, "Browser client must use a publishable key, not a service-role secret");
assert.match(app, /async function validateDocumentFileSignature\(file\)/, "Document signature preflight must exist");
assert.match(app, /head\.includes\("%PDF-"\)/, "PDF signature check must be present");
assert.match(app, /starts\(\[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a\]\)/, "PNG signature check must be present");
assert.match(app, /starts\(\[0xff,0xd8,0xff\]\)/, "JPEG signature check must be present");
assert.match(app, /\[Content_Types\]\.xml.*word\/document\.xml/s, "DOCX package markers must be checked");
const uploadAt = app.indexOf("async function uploadCaseDocument");
const validationAt = app.indexOf("validateDocumentFileSignature(file)", uploadAt);
const storageUploadAt = app.indexOf('.storage.from("advocatedesk-documents").upload', uploadAt);
assert.ok(uploadAt >= 0 && validationAt > uploadAt, "Upload must validate content before continuing");
assert.ok(storageUploadAt > validationAt, "Content validation must occur before Storage upload");
const deleteAt = app.indexOf("window.deleteCaseDocument=async function");
const storageRemoveAt = app.indexOf('.storage.from("advocatedesk-documents").remove', deleteAt);
const metadataDeleteAt = app.indexOf('.from("case_documents").delete()', deleteAt);
assert.ok(deleteAt >= 0 && storageRemoveAt > deleteAt && metadataDeleteAt > storageRemoveAt, "Deletion must remove the private object before deleting metadata");
assert.match(provisioning, /async function listAllAuthUsers\(/, "Central Control must paginate Auth administrator accounts");
assert.match(provisioning, /listUsers\(\{ page, perPage \}\)/, "Auth listing must request each page");
assert.match(provisioning, /new Map\(authUsers\.map\(\(u: any\) => \[u\.id, u\]\)\)/, "Auth lookup map must use the fully paginated user array");
assert.doesNotMatch(provisioning, /authUsers\?\.users/, "Do not treat the paginated user array as a response object");
assert.match(provisioning, /if \(batch\.length < perPage\) return \{ users, error: null \}/, "Auth pagination must stop only after the final short page");
assert.match(provisioning, /callerProfile\?\.platform_role !== "super_admin"/, "Provisioning endpoint must verify the caller's platform role");
assert.match(provisioning, /action !== "invite_admin"/, "Provisioning endpoint must reject unsupported actions including super-admin invitation");
assert.match(shell, /auth\.js\?v=20261009-superadmin-fix/, "App shell must use current auth cache-busting version");
for (const page of loginPages) assert.match(page, /auth\.js\?v=20261009-superadmin-fix/, "All login pages must use the same auth cache-busting version");

console.log("AdvocateDesk staging security smoke checks: PASS");
console.log("Scope: static source-contract checks only; not browser, RLS, Storage, or malware tests.");
