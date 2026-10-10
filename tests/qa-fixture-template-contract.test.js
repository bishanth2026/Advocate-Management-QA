/*
 * Static safety contract for the disposable QA fixture SQL template.
 * This test reads SQL as text only; it never executes SQL or touches Supabase.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sql = fs.readFileSync(path.join(__dirname, "../supabase/drafts/20261010_phase_c7_disposable_fixture_seed_template.sql"), "utf8");

assert.match(sql, /DO NOT RUN UNTIL REVIEWED/i, "fixture SQL must remain explicitly gated");
assert.match(sql, /BEGIN;[\s\S]*COMMIT;/, "all fixture writes must be in one transaction");
assert.match(sql, /Replace every placeholder with a verified disposable Auth UUID/, "placeholder UUIDs must fail before writes");
assert.match(sql, /SELECT count\(\*\) FROM auth\.users[\s\S]*<> 5/, "all five Auth identities must exist before writes");
assert.match(sql, /Each test role must use a distinct disposable Auth identity/, "identities must be distinct");
assert.match(sql, /already belongs to a workspace; stop and investigate/, "existing workspace members must fail closed");
assert.match(sql, /'admin','advocate','advocate','accountant'/, "fixture must add only intended four workspace roles");
assert.match(sql, /The nonmember intentionally is NOT inserted into workspace_members/, "nonmember must remain outside workspace");
assert.match(sql, /resource_type='task'\) <> 3/, "must verify exactly three task fixtures");
assert.match(sql, /FROM public\.case_assignments[\s\S]*<> 2/, "must verify exactly two case assignments");
assert.match(sql, /This is a privileged SQL Editor seed, not an RLS test/, "must not confuse seed execution with RLS acceptance");
assert.match(sql, /Do not run broad cleanup DELETEs/, "must prohibit unsafe broad cleanup");
assert.doesNotMatch(sql, /DELETE\s+FROM/i, "template must not contain cleanup deletes");
console.log("PASS disposable QA fixture SQL static safety contract (SQL not executed)");
