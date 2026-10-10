/*
 * QA-only authenticated PostgREST authorization acceptance harness.
 *
 * Read-only: never creates, updates, or deletes records. Run only against the
 * isolated AdvocateDesk-Test project after the reviewed C7H policies are applied.
 * No default URL/key is provided; missing fixture configuration skips the suite.
 *
 * Required env (all fixtures must already exist in isolated QA):
 *   QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY, QA_WORKSPACE_ID
 *   QA_ASSIGNED_CASE_ID, QA_UNASSIGNED_CASE_ID
 *   QA_UNLINKED_TASK_ID, QA_LINKED_ASSIGNED_TASK_ID, QA_LINKED_UNASSIGNED_TASK_ID
 *   QA_ADMIN_JWT, QA_ASSIGNED_ADVOCATE_JWT, QA_UNASSIGNED_ADVOCATE_JWT
 *   QA_ACCOUNTANT_JWT, QA_NONMEMBER_JWT, QA_ANON_JWT
 *
 * Never point this harness at production. All three task fixture IDs must be
 * resource_id values of task rows in QA_WORKSPACE_ID. The linked fixtures must
 * have case_id equal to the respective case IDs. The unlinked fixture must have
 * case_id IS NULL. Assigned/unassigned advocates must be active workspace
 * members with only their stated case assignment; accountant must not have a
 * task-wide permission. This suite makes GET requests only.
 */
const assert = require("node:assert/strict");

const required = [
  "QA_SUPABASE_URL", "QA_SUPABASE_ANON_KEY", "QA_WORKSPACE_ID",
  "QA_ASSIGNED_CASE_ID", "QA_UNASSIGNED_CASE_ID",
  "QA_UNLINKED_TASK_ID", "QA_LINKED_ASSIGNED_TASK_ID", "QA_LINKED_UNASSIGNED_TASK_ID",
  "QA_ADMIN_JWT", "QA_ASSIGNED_ADVOCATE_JWT", "QA_UNASSIGNED_ADVOCATE_JWT",
  "QA_ACCOUNTANT_JWT", "QA_NONMEMBER_JWT", "QA_ANON_JWT"
];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.log("SKIP qa-authz-http: missing isolated-QA configuration: " + missing.join(", "));
  process.exit(0);
}
const configuredUrl = process.env.QA_SUPABASE_URL;
let parsedUrl;
try { parsedUrl = new URL(configuredUrl); } catch {
  throw new Error("QA_SUPABASE_URL must be a valid URL for the isolated QA project");
}
if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "uqtsksgypncsbcnuanbk.supabase.co" || parsedUrl.pathname !== "" && parsedUrl.pathname !== "/") {
  throw new Error("Refusing to run authorization harness: URL must be exactly the isolated AdvocateDesk-Test project (uqtsksgypncsbcnuanbk.supabase.co).");
}
const base = configuredUrl.replace(/\\/$/, "");
const anonKey = process.env.QA_SUPABASE_ANON_KEY;
const workspace = process.env.QA_WORKSPACE_ID;
const cases = {
  assigned: process.env.QA_ASSIGNED_CASE_ID,
  unassigned: process.env.QA_UNASSIGNED_CASE_ID
};
const taskIds = {
  unlinked: process.env.QA_UNLINKED_TASK_ID,
  assigned: process.env.QA_LINKED_ASSIGNED_TASK_ID,
  unassigned: process.env.QA_LINKED_UNASSIGNED_TASK_ID
};
const tokens = {
  admin: process.env.QA_ADMIN_JWT,
  assignedAdvocate: process.env.QA_ASSIGNED_ADVOCATE_JWT,
  unassignedAdvocate: process.env.QA_UNASSIGNED_ADVOCATE_JWT,
  accountant: process.env.QA_ACCOUNTANT_JWT,
  nonmember: process.env.QA_NONMEMBER_JWT,
  anonymous: process.env.QA_ANON_JWT
};

async function rest(role, path) {
  const response = await fetch(base + "/rest/v1/" + path, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: "Bearer " + tokens[role],
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    }
  });
  const bodyText = await response.text();
  let body;
  try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = bodyText; }
  return { status: response.status, body };
}
function expectDenied(result, label) {
  assert.ok([401, 403].includes(result.status) ||
    (result.status >= 200 && result.status < 300 && Array.isArray(result.body) && result.body.length === 0),
    label + " expected denied/empty, got HTTP " + result.status + " " + JSON.stringify(result.body));
}
function expectOne(result, label) {
  assert.ok(result.status >= 200 && result.status < 300,
    label + " expected success, got HTTP " + result.status + " " + JSON.stringify(result.body));
  assert.ok(Array.isArray(result.body) && result.body.length === 1,
    label + " expected exactly one visible fixture, got " + JSON.stringify(result.body));
}
function taskQuery(id) {
  return "practice_resources?select=resource_id,case_id&workspace_id=eq." +
    encodeURIComponent(workspace) + "&resource_type=eq.task&resource_id=eq." +
    encodeURIComponent(id) + "&limit=2";
}
function taskListQuery(caseId) {
  return "practice_resources?select=resource_id,case_id&workspace_id=eq." +
    encodeURIComponent(workspace) + "&resource_type=eq.task&case_id=eq." +
    encodeURIComponent(caseId) + "&limit=100";
}

(async () => {
  const adminRead = await rest("admin", taskListQuery(cases.assigned));
  expectAllowed(adminRead, "Admin assigned-case task list");
  function expectAllowed(result, label) {
    assert.ok(result.status >= 200 && result.status < 300,
      label + " expected success, got HTTP " + result.status + " " + JSON.stringify(result.body));
  }

  expectDenied(await rest("nonmember", taskListQuery(cases.assigned)), "Non-member task read");
  expectDenied(await rest("anonymous", taskListQuery(cases.assigned)), "Anonymous task read");

  const adminUnlinked = await rest("admin", taskQuery(taskIds.unlinked));
  expectOne(adminUnlinked, "Admin unlinked task");
  assert.equal(adminUnlinked.body[0].case_id, null, "unlinked fixture must have null case_id");
  expectDenied(await rest("assignedAdvocate", taskQuery(taskIds.unlinked)), "Assigned Advocate unlinked task");
  expectDenied(await rest("unassignedAdvocate", taskQuery(taskIds.unlinked)), "Unassigned Advocate unlinked task");
  expectDenied(await rest("accountant", taskQuery(taskIds.unlinked)), "Accountant unlinked task");

  const adminAssigned = await rest("admin", taskQuery(taskIds.assigned));
  expectOne(adminAssigned, "Admin assigned task fixture");
  assert.equal(adminAssigned.body[0].case_id, cases.assigned, "assigned task must point to assigned case");
  expectOne(await rest("assignedAdvocate", taskQuery(taskIds.assigned)), "Assigned Advocate assigned-case task");
  expectDenied(await rest("unassignedAdvocate", taskQuery(taskIds.assigned)), "Unassigned Advocate assigned-case task");
  expectDenied(await rest("accountant", taskQuery(taskIds.assigned)), "Accountant assigned-case task");

  const adminUnassigned = await rest("admin", taskQuery(taskIds.unassigned));
  expectOne(adminUnassigned, "Admin unassigned task fixture");
  assert.equal(adminUnassigned.body[0].case_id, cases.unassigned, "unassigned task must point to unassigned case");
  expectOne(await rest("unassignedAdvocate", taskQuery(taskIds.unassigned)), "Unassigned Advocate assigned-case task");
  expectDenied(await rest("assignedAdvocate", taskQuery(taskIds.unassigned)), "Assigned Advocate unassigned-case task");
  expectDenied(await rest("accountant", taskQuery(taskIds.unassigned)), "Accountant unassigned-case task");

  console.log("PASS qa-authz-http: read-only Admin/nonmember/anonymous/assigned/unassigned/accountant task visibility matrix");
})().catch(err => { console.error("FAIL qa-authz-http", err); process.exitCode = 1; });
