/* Static contract tests for the unapplied C7H SQL draft.
 * These verify intended SQL policy shape, NOT live Postgres/RLS behavior.
 * Run: node tests/resource-policy-draft.test.js
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const sql = fs.readFileSync("supabase/drafts/20261010_phase_c7h_task_permission_and_unlinked_scope_draft.sql", "utf8");

assert.match(sql, /PHASE C7H DRAFT ONLY/);
assert.match(sql, /'tasks\.manage'/);
assert.match(sql, /\('admin','tasks\.view_all',true\)/);
assert.match(sql, /\('advocate','tasks\.view_assigned',true\)/);
assert.match(sql, /\('junior_advocate','tasks\.view_assigned',true\)/);
assert.match(sql, /WHEN 'task' THEN 'tasks\.manage'/);
assert.doesNotMatch(sql, /WHEN 'task' THEN 'hearings\.manage'/);

// Assigned-only case-scoped access must require a real case link plus assignment.
// Check every operation policy block contains task/client/meeting/discussion guards.
const policies = sql.split(/CREATE POLICY practice_resources_(select|insert|update|delete)_authorized/).slice(1);
assert.equal(policies.length % 2, 0);
for (let i = 1; i < policies.length; i += 2) {
  const block = policies[i];
  for (const type of ["client", "hearing", "task", "meeting", "discussion", "case_party"]) {
    assert.match(block, new RegExp("WHEN '" + type + "'"));
  }
  assert.match(block, /case_id IS NOT NULL/);
  assert.match(block, /private\.can_access_case\(workspace_id,case_id\)/);
}
// UPDATE must protect both stored and proposed row scopes.
const update = sql.split("CREATE POLICY practice_resources_update_authorized")[1].split("DROP POLICY IF EXISTS practice_resources_delete_authorized")[0];
assert.match(update, /USING\s*\(/);
assert.match(update, /WITH CHECK\s*\(/);
// This is policy draft only; do not smuggle a partially reviewed privileged RPC into it.
assert.doesNotMatch(sql, /CREATE\s+(OR REPLACE\s+)?FUNCTION/i);
assert.match(sql, /Do not apply until real JWT authorization and/i);
console.log("resource policy draft static contract tests: PASS (not live RLS tests)");
