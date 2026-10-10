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
      return {
        workspaceId: null,
        select() { return this; },
        eq(field, value) { if (field === "workspace_id") this.workspaceId = value; return this; },
        then(resolve, reject) {
          Promise.resolve({ data: seedRows.filter(r => r.workspace_id === this.workspaceId), error: null }).then(resolve, reject);
        },
        upsert(batch, options) {
          calls.push({ batch, options });
          return Promise.resolve(failWrites ? { error: { message: "simulated RLS denial", code: "42501" } } : { error: null });
        }
      };
    }
  };
}
const sandbox = { window: {}, Date, Promise, Error, Object, String, JSON };
vm.runInNewContext(fs.readFileSync("resource-store.js", "utf8"), sandbox, { filename: "resource-store.js" });
const store = sandbox.window.ADResourceStore;

(async () => {
  const client = makeClient([
    { workspace_id: "ws-1", resource_type: "case", resource_id: "CASE-1", case_id: null, payload: { id: "CASE-1", number: "OS 1/2026" } },
    { workspace_id: "ws-1", resource_type: "hearing", resource_id: "HEAR-1", case_id: "CASE-1", payload: {} },
    { workspace_id: "ws-2", resource_type: "case", resource_id: "SECRET", case_id: null, payload: { id: "SECRET" } }
  ]);
  await assert.rejects(
    () => store.load(makeClient([
      { workspace_id: "ws-1", resource_type: "future_module", resource_id: "X-1", case_id: null, payload: { id: "X-1" } }
    ]), "ws-1"),
    /Unsupported resource type returned by database: future_module/,
    "unknown resource types must fail closed rather than silently disappear"
  );
  const loaded = await store.load(client, "ws-1");
  assert.equal(loaded.cases.length, 1, "maps rows returned for requested workspace");
  assert.equal(loaded.hearings.length, 1);
  assert.equal(loaded.hearings[0].id, "HEAR-1", "restores row ID when legacy payload has no ID");
  assert.equal(loaded.hearings[0].caseId, "CASE-1", "restores normalized case relationship on load");

  const saveClient = makeClient();
  const result = await store.save(saveClient, "ws-1", {
    cases: [{ id: "CASE-1", number: "OS 1/2026", clientId: "CL-1" }],
    clients: [{ id: "CL-1", name: "Client" }],
    hearings: [{ case: "OS 1/2026" }],
    invoices: [{ id: "INV-1", case: "OS 1/2026" }],
    payments: [{ id: "PAY-1", invoiceId: "INV-1" }],
    transactions: [{ id: "TX-1", case: "OS 1/2026", amount: 100 }],
    caseParties: [{ id: "PARTY-1", caseNumber: "OS 1/2026", type: "petitioner" }],
    tasks: [], meetings: [], discussions: [], courts: []
  });
  assert.equal(result.saved, 7);
  assert.equal(result.destructiveDeletes, 0, "never bulk-deletes hidden records");
  assert.equal(saveClient.calls.length, 1);
  assert.equal(saveClient.calls[0].options.onConflict, "workspace_id,resource_type,resource_id");
  const savedRows = saveClient.calls[0].batch;
  assert.equal(savedRows.find(r => r.resource_type === "hearing").case_id, "CASE-1");
  assert.ok(savedRows.find(r => r.resource_type === "hearing").resource_id, "generates a stable ID for new legacy-style hearing");
  assert.equal(savedRows.find(r => r.resource_type === "hearing").payload.id, savedRows.find(r => r.resource_type === "hearing").resource_id, "writes generated ID into payload");
  assert.equal(savedRows.find(r => r.resource_type === "client").case_id, "CASE-1");
  assert.equal(savedRows.find(r => r.resource_type === "invoice").case_id, "CASE-1");
  assert.equal(savedRows.find(r => r.resource_type === "payment").case_id, "CASE-1");
  assert.equal(savedRows.find(r => r.resource_type === "transaction").case_id, "CASE-1");
  assert.equal(savedRows.find(r => r.resource_type === "case_party").case_id, "CASE-1", "links case-party record to its stable case ID");
  assert.ok(savedRows.every(r => typeof r.source_hash === "string" && r.source_hash.length > 0), "supplies required source_hash for real database writes");

  // Ambiguous case labels must not be guessed into a relationship.
  const ambiguousClient = makeClient();
  await store.save(ambiguousClient, "ws-1", {
    cases: [
      { id: "CASE-A", number: "OS 9/2026" },
      { id: "CASE-B", number: "OS 9/2026" }
    ],
    hearings: [{ id: "HEAR-AMBIG", case: "OS 9/2026" }],
    clients: [], tasks: [], invoices: [], payments: [], transactions: [],
    meetings: [], discussions: [], courts: [], caseParties: []
  });
  const ambiguousHearing = ambiguousClient.calls[0].batch.find(r => r.resource_type === "hearing");
  assert.equal(ambiguousHearing.case_id, null, "ambiguous case labels must remain unresolved instead of linking to an arbitrary case");

  await assert.rejects(() => store.load(client, ""), /workspace ID/);
  const idClient = makeClient();
  const legacyRecord = { title: "Legacy-style hearing" };
  await store.save(idClient, "ws-1", { hearings: [legacyRecord] });
  assert.ok(legacyRecord.id, "generates and persists an ID on legacy-style records");
  assert.equal(idClient.calls[0].batch[0].resource_id, legacyRecord.id);
  await assert.rejects(() => store.save(client, "ws-1", { cases: "not-an-array" }), /Expected cases to be an array/);
  await assert.rejects(
    () => store.save(client, "ws-1", { cases: [], clients: [], customModuleRecords: [{ id: "CUSTOM-1" }] }),
    /Unsupported non-empty resource collections: customModuleRecords/,
    "unknown module collections must fail closed instead of being silently dropped"
  );
  const denied = makeClient([], true);
  await assert.rejects(() => store.save(denied, "ws-1", {
    cases: [{ id: "CASE-1" }], clients: [], hearings: [], tasks: [], invoices: [], payments: [], transactions: [], meetings: [], discussions: [], courts: [], caseParties: []
  }), err => err && err.message === "simulated RLS denial" && err.code === "42501");
  console.log("resource-store adapter unit tests: PASS (fake Supabase only)");
})().catch(err => { console.error(err); process.exitCode = 1; });
