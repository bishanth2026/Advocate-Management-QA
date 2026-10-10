/* Static contract tests for the unapplied C7H SQL draft.
 * These verify intended SQL policy shape, NOT live Postgres/RLS behavior.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const sql = fs.readFileSync("supabase/drafts/20261010_phase_c7h_task_permission_and_unlinked_scope_draft.sql", "utf8");

assert.ok(sql.includes("PHASE C7H DRAFT ONLY"));
assert.ok(sql.includes("'tasks.manage'"));
assert.ok(sql.includes("('admin','tasks.view_all',true)"));
assert.ok(sql.includes("('advocate','tasks.view_assigned',true)"));
assert.ok(sql.includes("('junior_advocate','tasks.view_assigned',true)"));
assert.ok(sql.includes("WHEN 'task' THEN 'tasks.manage'"));
assert.ok(!sql.includes("WHEN 'task' THEN 'hearings.manage'"));

for (const type of ["client", "hearing", "task", "meeting", "discussion", "case_party"]) {
  assert.ok(sql.includes("WHEN '" + type + "'"), "missing policy branch for " + type);
}
assert.ok((sql.match(/case_id IS NOT NULL/g) || []).length >= 12, "read/write paths must guard unlinked records");
assert.ok((sql.split("private.can_access_case").length - 1) >= 12, "read/write paths must call case assignment helper");

const update = sql.split("CREATE POLICY practice_resources_update_authorized")[1].split("DROP POLICY IF EXISTS practice_resources_delete_authorized")[0];
assert.ok(update.includes("USING ("), "UPDATE must authorize the existing row");
assert.ok(update.includes("WITH CHECK ("), "UPDATE must authorize the proposed row");
assert.ok(!sql.includes("CREATE FUNCTION") && !sql.includes("CREATE OR REPLACE FUNCTION"), "draft must not contain an unreviewed privileged RPC");
assert.ok(sql.toLowerCase().includes("do not apply until real jwt authorization and"));

for (const policy of [
  "CREATE POLICY practice_resources_insert_authorized",
  "CREATE POLICY practice_resources_update_authorized",
  "CREATE POLICY practice_resources_delete_authorized"
]) {
  const start = sql.indexOf(policy);
  assert.notEqual(start, -1, "missing mutation policy: " + policy);
  const next = sql.indexOf("DROP POLICY IF EXISTS practice_resources_", start + policy.length);
  const body = sql.slice(start, next === -1 ? sql.length : next);
  assert.ok(body.includes("WHEN 'task' THEN 'tasks.manage'"), policy + " must use tasks.manage");
  assert.ok(body.includes("WHEN 'task' THEN private.has_workspace_permission(workspace_id,'tasks.view_all')"),
    policy + " must use task-specific workspace-wide visibility, not cases.view_all");
  assert.ok(body.includes("case_id IS NOT NULL AND private.can_access_case(workspace_id,case_id)"),
    policy + " must deny assigned-only writes to unlinked tasks");
}
const selectStart = sql.indexOf("CREATE POLICY practice_resources_select_authorized");
const insertStart = sql.indexOf("DROP POLICY IF EXISTS practice_resources_insert_authorized", selectStart);
const selectBody = sql.slice(selectStart, insertStart);
assert.ok(selectBody.includes("WHEN 'task' THEN private.has_workspace_permission(workspace_id,'tasks.view_all')"));
assert.ok(selectBody.includes("private.has_workspace_permission(workspace_id,'tasks.view_assigned')"));
assert.ok(!selectBody.includes("WHEN 'task' THEN private.has_workspace_permission(workspace_id,'cases.view_all')"),
  "task visibility must not accidentally inherit case-wide visibility");
assert.ok(sql.includes("ON CONFLICT (role, permission_key)"), "role permission seeding must be repeatable");

console.log("resource policy draft static contract tests: PASS (not live RLS tests)");
