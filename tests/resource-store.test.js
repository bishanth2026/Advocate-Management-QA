/* Resource store adapter tests. Run: node tests/resource-store.test.js
   Uses a fake Supabase client. These tests do not prove database RLS behavior. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function makeClient(seedRows = [], failWrites = false) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, "practice_resources");
      const query = {
        workspaceId: null,
        select() { return this; },
        eq(field, value) { if (field === "workspace_id") this.workspaceId = value; return this; },
        then(resolve, reject) {
          Promise.resolve({ data: seedRows.filter(r => r.workspace_id === this.workspaceId), error: null }).then(resolve, reject);
        },
        upsert(batch, options) {
          calls.push({ batch, options });
          return Promise.resolve(failWrites
            ? { error: { message: "simulated RLS denial", code: "42501" } }
            : { error: null });
        }
      };
      return query;
    }
  };
}

const sandbox = { window: {}, Date, Promise, Error, Object, String, JSON };
vm.runInNewContext(fs.readFileSync("resource-store.js", "utf8"), sandbox, { filename: "resource-store.js" });
const store = sandbox.window.ADResourceStore;

(async () => {
  const seeded = [
    { workspace_id: "ws-1", resource_type: "case", resource_id: "CASE-1", case_id: null, payload: { id: "CASE-1", number: "OS 1/2026" } },
    { workspace_id: "ws-1", resource_type: "hearing", resource_id: "HEAR-1", case_id: "CASE-1", payload: { id: "HEAR-1", caseId: "CASE-1" } },
    { workspace_id: "ws-2", resource_type: "case", resource_id: "SECRET", case_id: null, payload: { id: "SECRET" } }
  ];
  const client = makeClient(seeded);
  const state = await store.load(client, "ws-1");
  assert.equal(state.cases.length, 1, "loads only requested workspace rows");
  assert.equal(state.hearings.length, 1);
  assert.equal(state.hearings[0].caseId, "CASE-1");

  const result = await store.save(client, "ws-1", {
    cases: [{ id: "CASE-1", number: "OS 1/2026" }],
    hearings: [{ id: "HEAR-1", caseId: "CASE-1" }],
    clients: [], tasks: [], invoices: [], payments: [], meetings: [], discussions: [], courts: []
  });
  assert.equal(result.saved, 2);
  assert.equal(result.destructiveDeletes, 0, "never bulk-deletes hidden records");
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].options.onConflict, "workspace_id,resource_type,resource_id");
  assert.equal(client.calls[0].batch[1].case_id, "CASE-1");
  assert.equal(client.calls[0].batch[0].workspace_id, "ws-1");

  const labelClient = makeClient();
  await store.save(labelClient, "ws-1", {
    cases: [{ id: "CASE-1", number: "OS 1/2026" }],
    hearings: [{ id: "H-2", case: "OS 1/2026" }],
    clients: [], tasks: [], invoices: [], payments: [], meetings: [], discussions: [], courts: []
  });
  assert.equal(labelClient.calls[0].batch[1].case_id, "CASE-1", "unique case label resolves after case list indexed");

  await assert.rejects(() => store.load(client, ""), /workspace ID/);
  await assert.rejects(() => store.save(client, "ws-1", { cases: [{ title: "Missing stable ID" }] }), /stable ID/);
  await assert.rejects(() => store.save(client, "ws-1", { cases: "not-an-array" }), /Expected cases to be an array/);

  const denied = makeClient([], true);
  await assert.rejects(() => store.save(denied, "ws-1", {
    cases: [{ id: "CASE-1" }], clients: [], hearings: [], tasks: [], invoices: [], payments: [], meetings: [], discussions: [], courts: []
  }), /simulated RLS denial/);

  console.log("resource-store adapter unit tests: PASS (fake Supabase only)");
})().catch(err => { console.error(err); process.exitCode = 1; });
