/*
 * Static contract checks for the opt-in QA HTTP authorization harness.
 * These checks validate test coverage wiring only; they are not live RLS tests.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync("tests/qa-authz-http.test.js", "utf8");

for (const role of ["admin", "assignedAdvocate", "unassignedAdvocate", "accountant", "nonmember", "anonymous"]) {
  assert.match(source, new RegExp("\\b" + role + "\\b"), "missing role fixture: " + role);
}
for (const phrase of [
  "Assigned Advocate unlinked task",
  "Unassigned Advocate unlinked task",
  "Accountant unlinked task",
  "Assigned Advocate assigned-case task",
  "Unassigned Advocate assigned-case task",
  "Accountant assigned-case task",
  "Assigned Advocate unassigned-case task",
  "Unassigned Advocate assigned-case task",
  "Accountant unassigned-case task",
  "unlinked fixture must have null case_id",
  "assigned task must point to assigned case",
  "unassigned task must point to unassigned case"
]) {
  assert.ok(source.includes(phrase), "missing authorization assertion: " + phrase);
}
assert.match(source, /method:\s*"GET"/, "harness must use read-only GET requests");
assert.doesNotMatch(source, /method:\s*"(POST|PATCH|PUT|DELETE)"/, "harness must not mutate data");
assert.match(source, /if \(missing\.length\)[\s\S]*?process\.exit\(0\)/, "missing secrets must skip without fallback");
assert.match(source, /QA_SUPABASE_URL/, "must require explicit QA URL");
assert.match(source, /uqtsksgypncsbcnuanbk\\.supabase\\.co/, "must fail closed unless targeting the isolated QA project");
assert.match(source, /Refusing to run authorization harness/, "must reject non-QA URLs at runtime");
assert.match(source, /Never point this harness at production/, "must document production exclusion");
console.log("PASS QA HTTP authorization harness static coverage contract (not live RLS)");
