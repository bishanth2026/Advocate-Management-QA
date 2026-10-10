/* Static contract tests for the unapplied C7H SQL draft.
 * These verify intended SQL policy shape, NOT live Postgres/RLS behavior.
 * Run: node tests/resource-policy-draft.test.js
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const sql = fs.readFileSync("supabase/drafts/20261010_phase_c7h_task_permission_and_unlinked_scope_draft.sql", "utf8");

assert.match(sql, /PHASE C7H DRAFT ONLY/);
assert.match(sql, /'tasks\\.manage'/);
assert.match(sql, /\\('admin','tasks\\.view_all',true\\)/);
assert.match(sql, /\\('advocate','tasks\\.view_assigned',true\\)/);
assert.match(sql, /\\('junior_advocate','tasks\\.view_assigned',true\\)/);
assert.match(sql, /WHEN 'task' THEN 'tasks\\.manage'/);
assert.doesNotMatch(sql, /WHEN 'task' THEN 'hearings\\.manage'/);

// Every case-linked resource type must have a case-specific scope branch and
// assigned-only paths must require both a non-null case_id and case access.
for (const type of ["client", "hearing", "task", "meeting", "discussion", "case_party"]) {
  assert.match(sql, new RegExp("WHEN '" + type + "'"));
}
assert.ok((sql.match(/case_id IS NOT NULL/g) || []).length >= 12, "insert/update/read/delete paths explicitly guard unlinked records");
assert.ok((sql.match(/private\\.can_access_case\\(workspace_id,case_id\\)/g) || []).length >= 12, "scope checks use case assignment helper");

// UPDATE must protect both stored and proposed row scopes.
const update = sql.split("CREATE POLICY practice_resources_update_authorized")[1].split("DROP POLICY IF EXISTS practice_resources_delete_authorized")[0];
assert.match(update, /USING\\s*\\(/);
assert.match(update, /WITH CHECK\\s*\\(/);
// This is policy draft only; do not smuggle a partially reviewed privileged RPC into it.
assert.doesNotMatch(sql, /CREATE\\s+(OR REPLACE\\s+)?FUNCTION/i);
assert.match(sql, /Do not apply until real JWT authorization and/i);
console.log("resource policy draft static contract tests: PASS (not live RLS tests)");
