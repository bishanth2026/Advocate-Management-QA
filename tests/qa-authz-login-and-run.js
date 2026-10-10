/*
 * Local-only helper: sign in as the five disposable QA identities, then run
 * the GET-only authorization harness. Never commit .env files or paste tokens.
 *
 * Required environment:
 * QA_SUPABASE_URL, QA_SUPABASE_ANON_KEY
 * QA_ADMIN_PASSWORD, QA_ASSIGNED_ADVOCATE_PASSWORD,
 * QA_UNASSIGNED_ADVOCATE_PASSWORD, QA_ACCOUNTANT_PASSWORD, QA_NONMEMBER_PASSWORD
 *
 * Optional fixture overrides: QA_WORKSPACE_ID, QA_ASSIGNED_CASE_ID,
 * QA_UNASSIGNED_CASE_ID, QA_UNLINKED_TASK_ID,
 * QA_LINKED_ASSIGNED_TASK_ID, QA_LINKED_UNASSIGNED_TASK_ID
 */
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");

const expectedHost = "uqtsksgypncsbcnuanbk.supabase.co";
const url = process.env.QA_SUPABASE_URL;
const anonKey = process.env.QA_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error("Set QA_SUPABASE_URL and QA_SUPABASE_ANON_KEY locally.");
const parsed = new URL(url);
if (parsed.protocol !== "https:" || parsed.hostname !== expectedHost || !["", "/"].includes(parsed.pathname)) {
  throw new Error("Refusing to run: QA_SUPABASE_URL must target the isolated AdvocateDesk-Test project.");
}

const actors = [
  ["admin", "QA_ADMIN_PASSWORD", "bishanth2026+advocatedesk.admin01@gmail.com", "057363e5-2fbc-447c-affc-9b40160f3873"],
  ["assignedAdvocate", "QA_ASSIGNED_ADVOCATE_PASSWORD", "bishanth2026+advocatedesk.assigned02@gmail.com", "142890e2-e277-4e52-8cbe-d329dc798dbc"],
  ["unassignedAdvocate", "QA_UNASSIGNED_ADVOCATE_PASSWORD", "bishanth2026+advocatedesk.unassigned03@gmail.com", "d9b005d3-dc99-47ea-b52c-34c3f36e3d5a"],
  ["accountant", "QA_ACCOUNTANT_PASSWORD", "bishanth2026+advocatedesk.accountant04@gmail.com", "d3b8d937-f623-49d1-a091-ae372b7cffc7"],
  ["nonmember", "QA_NONMEMBER_PASSWORD", "bishanth2026+advocatedesk.nonmember05@gmail.com", "a3de7c15-d61e-49c1-85fd-2298f7efe5a2"]
];
for (const [, envName] of actors) {
  if (!process.env[envName]) throw new Error("Missing local password variable: " + envName);
}

async function signIn(email, password, expectedUid) {
  const response = await fetch(url.replace(/\/$/, "") + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token || !body.user?.id) {
    throw new Error("Sign-in failed for " + email + " (HTTP " + response.status + "). Check password/Auth settings; response details intentionally omitted.");
  }
  assert.equal(body.user.id, expectedUid, "Signed-in user UID mismatch for " + email);
  return body.access_token;
}

(async () => {
  const childEnv = {
    ...process.env,
    QA_ANON_JWT: anonKey,
    QA_WORKSPACE_ID: process.env.QA_WORKSPACE_ID || "e183d24d-9f64-4283-af54-571f83ca7e3d",
    QA_ASSIGNED_CASE_ID: process.env.QA_ASSIGNED_CASE_ID || "qa-c7h-20261011-run-001-case-assigned",
    QA_UNASSIGNED_CASE_ID: process.env.QA_UNASSIGNED_CASE_ID || "qa-c7h-20261011-run-001-case-unassigned",
    QA_UNLINKED_TASK_ID: process.env.QA_UNLINKED_TASK_ID || "qa-c7h-20261011-run-001-task-unlinked",
    QA_LINKED_ASSIGNED_TASK_ID: process.env.QA_LINKED_ASSIGNED_TASK_ID || "qa-c7h-20261011-run-001-task-assigned",
    QA_LINKED_UNASSIGNED_TASK_ID: process.env.QA_LINKED_UNASSIGNED_TASK_ID || "qa-c7h-20261011-run-001-task-unassigned"
  };
  for (const [role, envName, email, uid] of actors) {
    childEnv["QA_" + role.replace(/[A-Z]/g, m => "_" + m).toUpperCase() + "_JWT"] =
      await signIn(email, process.env[envName], uid);
  }
  const result = spawnSync(process.execPath, ["tests/qa-authz-http.test.js"], {
    env: childEnv, stdio: "inherit"
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
})().catch(error => {
  console.error("QA auth setup/test failed:", error.message);
  process.exitCode = 1;
});
