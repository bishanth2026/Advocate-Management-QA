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
assert.ok((sql.match(/private\\.can_access_case/g) || []).length >= 12, "read/write paths must call case assignment helper");

const update = sql.split("CREATE POLICY practice_resources_update_authorized")[1].split("DROP POLICY IF EXISTS practice_resources_delete_authorized")[0];
assert.ok(update.includes("USING ("), "UPDATE must authorize the existing row");
assert.ok(update.includes("WITH CHECK ("), "UPDATE must authorize the proposed row");
assert.ok(!/CREATE\\s+(OR REPLACE\\s+)?FUNCTION/i.test(sql), "draft must not contain an unreviewed privileged RPC");
assert.ok(sql.includes("Do not apply until real JWT authorization and"));
console.log("resource policy draft static contract tests: PASS (not live RLS tests)");
