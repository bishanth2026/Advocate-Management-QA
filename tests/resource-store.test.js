/* Node-compatible smoke tests for resource-store.js. Run with:
   node tests/resource-store.test.js
   This tests adapter mapping and non-destructive write behavior with a fake Supabase client;
   it is not a substitute for authenticated Supabase/RLS integration tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const calls = [];
const rows = [
  { workspace_id: "ws-1", resource_type: "case", resource_id: "CASE-1", case_id: null,
    payload: { id: "CASE-1", number: "OS 1/2026", title: "Case One" } },
  { workspace_id: "ws-1", resource_type: "hearing", resource_id: "HEAR-1", case_id: "CASE-1",
    payload: { id: "HEAR-1", caseId: "CASE-1", title: "Hearing One" } }
];
const client = {
  from(table) {
    assert.equal(table, "practice_resources");
    return {
      select() { return this; },
      eq(field, value) {
        if (field === "workspace_id") this.workspaceId = value;
        return this;
      },
      then(resolve, reject) {
        Promise.resolve({ data: rows.filter(r => r.workspace_id === this.workspaceId), error: null }).then(resolve, reject);
      },
      upsert(batch, options) {
        calls.push({ batch, options });
        return Promise.resolve({ error: null });
      }
    };
  }
};
const sandbox = { window: {}, Date, Promise, Error, Object, String, JSON };
vm.runInNewContext(fs.readFileSync("resource-store.js", "utf8"), sandbox, { filename: "resource-store.js" });

(async () => {
  const state = await sandbox.window.ADResourceStore.load(client, "ws-1");
  assert.equal(state.cases.length, 1);
  assert.equal(state.hearings.length, 1);
  assert.equal(state.hearings[0].caseId, "CASE-1");
  const saved = await sandbox.window.ADResourceStore.save(client, "ws-1", {
    cases: [{ id: "CASE-1", number: "OS 1/2026" }],
    hearings: [{ id: "HEAR-1", caseId: "CASE-1" }],
    clients: [], tasks: [], invoices: [], payments: [], meetings: [], discussions: [], courts: []
  });
  assert.equal(saved.saved, 2);
  assert.equal(saved.destructiveDeletes, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.onConflict, "workspace_id,resource_type,resource_id");
  assert.equal(calls[0].batch[1].case_id, "CASE-1");
  assert.equal(calls[0].batch[0].workspace_id, "ws-1");
  await assert.rejects(() => sandbox.window.ADResourceStore.load(client, ""), /workspace ID/);
  console.log("resource-store adapter smoke tests: PASS");
})().catch(err => { console.error(err); process.exitCode = 1; });
