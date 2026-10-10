/*
 * Regression contract for workspace-wide task list visibility.
 * Static coverage only; it does not execute Supabase RLS or authenticated HTTP.
 */
const assert = require("node:assert/strict");
const source = require("./qa-authz-http.test.js");

const fs = require("node:fs");
const harness = fs.readFileSync(require("node:path").join(__dirname, "qa-authz-http.test.js"), "utf8");

for (const phrase of [
  "function workspaceTaskListQuery()",
  '"Admin workspace-wide task list"',
  '"Assigned Advocate workspace-wide task list"',
  '"Unassigned Advocate workspace-wide task list"',
  '"Accountant workspace-wide task list"',
  "[taskIds.unlinked, taskIds.assigned, taskIds.unassigned]",
  "[taskIds.assigned]",
  "[taskIds.unassigned]",
  "expectVisibleTaskIds"
]) {
  assert.ok(harness.includes(phrase), "missing workspace-wide list regression assertion: " + phrase);
}
assert.match(harness, /workspaceTaskListQuery\(\)/, "must exercise the workspace-wide task query");
console.log("PASS workspace-wide task-list regression contract (static only; no live RLS claim)");
