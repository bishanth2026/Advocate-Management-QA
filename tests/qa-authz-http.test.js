/*
 * QA-only authenticated PostgREST authorization acceptance harness.
 *
 * This test is intentionally opt-in and performs only reads until all required
 * fixture IDs and role JWTs are supplied. It does not create or mutate data.
 * Run after the C7H policy migration is reviewed/applied to the QA project:
 *   node tests/qa-authz-http.test.js
 *
 * Required env:
 *   QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY
 *   QA_WORKSPACE_ID, QA_ASSIGNED_CASE_ID, QA_UNASSIGNED_CASE_ID
 *   QA_ADMIN_JWT, QA_ASSIGNED_ADVOCATE_JWT, QA_UNASSIGNED_ADVOCATE_JWT,
 *   QA_ACCOUNTANT_JWT, QA_NONMEMBER_JWT, QA_ANON_JWT
 * Optional:
 *   QA_UNLINKED_TASK_ID, QA_LINKED_ASSIGNED_TASK_ID, QA_LINKED_UNASSIGNED_TASK_ID
 *
 * Fixtures must be created only in isolated QA. Never point this at production.
 * Tests are deliberately skipped with a clear error if required variables are
 * absent; there is no implicit fallback to a default Supabase URL/key.
 */
const assert = require("node:assert/strict");

const required = [
  "QA_SUPABASE_URL", "QA_SUPABASE_ANON_KEY", "QA_WORKSPACE_ID",
  "QA_ASSIGNED_CASE_ID", "QA_UNASSIGNED_CASE_ID", "QA_ADMIN_JWT",
  "QA_ASSIGNED_ADVOCATE_JWT", "QA_UNASSIGNED_ADVOCATE_JWT",
  "QA_ACCOUNTANT_JWT", "QA_NONMEMBER_JWT", "QA_ANON_JWT"
];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.log("SKIP qa-authz-http: missing isolated-QA configuration: " + missing.join(", "));
  process.exit(0);
}
const base = process.env.QA_SUPABASE_URL.replace(/\/$/, "");
const anonKey = process.env.QA_SUPABASE_ANON_KEY;
const workspace = process.env.QA_WORKSPACE_ID;
const assignedCase = process.env.QA_ASSIGNED_CASE_ID;
const unassignedCase = process.env.QA_UNASSIGNED_CASE_ID;
const tokens = {
  admin: process.env.QA_ADMIN_JWT,
  assignedAdvocate: process.env.QA_ASSIGNED_ADVOCATE_JWT,
  unassignedAdvocate: process.env.QA_UNASSIGNED_ADVOCATE_JWT,
  accountant: process.env.QA_ACCOUNTANT_JWT,
  nonmember: process.env.QA_NONMEMBER_JWT,
  anonymous: process.env.QA_ANON_JWT
};

async function rest(role, path, options = {}) {
  const response = await fetch(base + "/rest/v1/" + path, {
    method: options.method || "GET",
    headers: {
      apikey: anonKey,
      Authorization: "Bearer " + tokens[role],
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=minimal"
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const bodyText = await response.text();
  let body;
  try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = bodyText; }
  return { status: response.status, body };
}
function expectDenied(result, label) {
  assert.ok([401, 403].includes(result.status) || (result.status >= 200 && result.status < 300 && Array.isArray(result.body) && result.body.length === 0),
    label + " expected denied/empty, got HTTP " + result.status + " " + JSON.stringify(result.body));
}
function expectAllowed(result, label) {
  assert.ok(result.status >= 200 && result.status < 300, label + " expected success, got HTTP " + result.status + " " + JSON.stringify(result.body));
}

(async () => {
  // A workspace resource read is used as a harmless membership/access probe.
  const common = "practice_resources?select=resource_id,resource_type,case_id&workspace_id=eq." +
    encodeURIComponent(workspace) + "&resource_type=eq.task&limit=100";
  const adminRead = await rest("admin", common);
  expectAllowed(adminRead, "Admin task read");
  const nonmemberRead = await rest("nonmember", common);
  expectDenied(nonmemberRead, "Non-member task read");
  const anonRead = await rest("anonymous", common);
  expectDenied(anonRead, "Anonymous task read");

  // These fixtures must be pre-seeded by a QA operator. Read-only checks avoid
  // making assumptions about direct mutation behavior before the SQL contract
  // and the test data are aligned.
  const unlinkedId = process.env.QA_UNLINKED_TASK_ID;
  const assignedTaskId = process.env.QA_LINKED_ASSIGNED_TASK_ID;
  const unassignedTaskId = process.env.QA_LINKED_UNASSIGNED_TASK_ID;
  if (unlinkedId) {
    const q = "practice_resources?select=resource_id&workspace_id=eq." + encodeURIComponent(workspace) +
      "&resource_type=eq.task&resource_id=eq." + encodeURIComponent(unlinkedId);
    const all = await rest("admin", q);
    expectAllowed(all, "Admin read unlinked task");
    assert.ok(Array.isArray(all.body) && all.body.length === 1, "unlinked fixture must exist for Admin");
    const assigned = await rest("assignedAdvocate", q);
    expectDenied(assigned, "Assigned-only user read unlinked task");
    const unassigned = await rest("unassignedAdvocate", q);
    expectDenied(unassigned, "Unassigned Advocate read unlinked task");
  }
  if (assignedTaskId) {
    const q = "practice_resources?select=resource_id&workspace_id=eq." + encodeURIComponent(workspace) +
      "&resource_type=eq.task&resource_id=eq." + encodeURIComponent(assignedTaskId);
    const assigned = await rest("assignedAdvocate", q);
    expectAllowed(assigned, "Assigned Advocate read assigned-case task");
    assert.ok(Array.isArray(assigned.body) && assigned.body.length === 1, "assigned task fixture must be visible");
  }
  if (unassignedTaskId) {
    const q = "practice_resources?select=resource_id&workspace_id=eq." + encodeURIComponent(workspace) +
      "&resource_type=eq.task&resource_id=eq." + encodeURIComponent(unassignedTaskId);
    const assigned = await rest("assignedAdvocate", q);
    expectDenied(assigned, "Assigned Advocate read unassigned-case task");
  }
  console.log("PASS qa-authz-http read-only probes; any omitted fixture-dependent assertions were not run");
})().catch(err => { console.error("FAIL qa-authz-http", err); process.exitCode = 1; });
