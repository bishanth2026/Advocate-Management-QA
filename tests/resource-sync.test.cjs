const test = require("node:test");
const assert = require("node:assert/strict");
const {
  create,
  buildInitialState,
  buildDesiredRows,
} = require("../resource-sync.js");

const emptyState = () => ({
  cases: [], clients: [], hearings: [], tasks: [], invoices: [],
  payments: [], transactions: [], meetings: [], discussions: [],
  courts: [], caseParties: [],
});

test("buildInitialState maps every supported type and preserves custom payload fields", () => {
  const rows = [
    { resource_type: "case", resource_id: "CS-1", payload: { id: "CS-1", number: "OS 1/2026", custom: { keep: true } } },
    { resource_type: "client", resource_id: "CL-1", payload: { id: "CL-1", name: "Example" } },
    { resource_type: "transaction", resource_id: "TX-1", payload: { id: "TX-1", amount: 100 } },
    { resource_type: "case_party", resource_id: "CP-1", payload: { id: "CP-1", role: "Petitioner" } },
    { resource_type: "court", resource_id: "court:district%20court", payload: { id: "court:district%20court", name: "District Court" } },
  ];
  const state = buildInitialState(rows);
  assert.equal(state.cases[0].custom.keep, true);
  assert.equal(state.clients[0].id, "CL-1");
  assert.equal(state.transactions[0].id, "TX-1");
  assert.equal(state.caseParties[0].id, "CP-1");
  assert.deepEqual(state.courts, ["District Court"]);
  const desired = buildDesiredRows(state);
  assert.equal(desired.get("court::court:district%20court").payload.name, "District Court");
  assert.deepEqual(state.hearings, []);
});

test("buildDesiredRows resolves case number and invoice links to stable case IDs", () => {
  const state = emptyState();
  state.cases = [{ id: "CS-1", number: "OS 1/2026", clientId: "CL-1" }];
  state.clients = [{ id: "CL-1", name: "Example" }];
  state.hearings = [{ id: "H-1", case: "OS 1/2026" }];
  state.invoices = [{ id: "INV-1", caseId: "CS-1", amount: 100 }];
  state.payments = [{ id: "PAY-1", invoiceId: "INV-1", amount: 25 }];
  const desired = buildDesiredRows(state);
  assert.equal(desired.get("case::CS-1").case_id, null);
  assert.equal(desired.get("client::CL-1").case_id, "CS-1");
  assert.equal(desired.get("hearing::H-1").case_id, "CS-1");
  assert.equal(desired.get("payment::PAY-1").case_id, "CS-1");
});

test("buildDesiredRows refuses unknown state properties, missing IDs, and duplicate IDs", () => {
  const state = emptyState();
  state.cases = [{ number: "OS 1/2026" }];
  assert.throws(() => buildDesiredRows(state), /no stable ID/);
  state.cases = [{ id: "CS-1" }, { id: "CS-1" }];
  assert.throws(() => buildDesiredRows(state), /Duplicate record ID/);
  state.cases = [];
  state.unreviewedMetadata = { value: true };
  assert.throws(() => buildDesiredRows(state), /Unsupported state properties/);
});

test("load/save uses only practice_resources and never deletes rows hidden by RLS", async () => {
  const calls = [];
  const workspaceId = "ws-1";
  const backingRows = [
    { id: "row-visible", workspace_id: workspaceId, resource_type: "case", resource_id: "CS-1", case_id: null, payload: { id: "CS-1", number: "OS 1/2026" }, legacy_record_id: "legacy-1", updated_at: "2026-10-11T00:00:00.000Z" },
    { id: "row-hidden", workspace_id: workspaceId, resource_type: "case", resource_id: "CS-2", case_id: null, payload: { id: "CS-2", number: "OS 2/2026" }, legacy_record_id: "legacy-1", updated_at: "2026-10-11T00:00:00.000Z" },
    { id: "row-task", workspace_id: workspaceId, resource_type: "task", resource_id: "TASK-1", case_id: "CS-1", payload: { id: "TASK-1", title: "Task with DB-only case link" }, legacy_record_id: "legacy-1", updated_at: "2026-10-11T00:00:00.000Z" },
  ];
  const visibleRows = () => backingRows.filter((row) => row.resource_id !== "CS-2");
  class Query {
    constructor(table) { this.table = table; this.op = "select"; this.filters = {}; this.values = null; }
    select() { return this; }
    eq(key, value) { this.filters[key] = value; return this; }
    insert(values) { this.op = "insert"; this.values = values; return this; }
    update(values) { this.op = "update"; this.values = values; return this; }
    delete() { this.op = "delete"; return this; }
    async execute(single) {
      if (this.table !== "practice_resources") throw new Error("Unexpected table: " + this.table);
      calls.push({ table: this.table, op: this.op });
      if (this.op === "select") return { data: visibleRows().filter((row) => Object.entries(this.filters).every(([k,v]) => row[k] === v)), error: null };
      if (this.op === "insert") {
        const row = { ...this.values, id: "row-new", legacy_record_id: null, updated_at: "2026-10-11T00:01:00.000Z" };
        backingRows.push(row);
        return { data: row, error: null };
      }
      const index = backingRows.findIndex((row) => Object.entries(this.filters).every(([k,v]) => row[k] === v));
      if (index < 0) return { data: null, error: null };
      if (this.op === "update") {
        backingRows[index] = { ...backingRows[index], ...this.values, updated_at: "2026-10-11T00:02:00.000Z" };
        return { data: backingRows[index], error: null };
      }
      const [removed] = backingRows.splice(index, 1);
      return { data: { id: removed.id }, error: null };
    }
    then(resolve, reject) { return this.execute(false).then(resolve, reject); }
    single() { return this.execute(true); }
    maybeSingle() { return this.execute(true); }
  }
  const client = { from(table) { return new Query(table); } };
  const sync = create(client, { workspaceId });
  const state = await sync.load();
  assert.deepEqual(state.cases.map((item) => item.id), ["CS-1"]);
  assert.equal(state.tasks[0].id, "TASK-1");
  state.cases[0].title = "Edited assigned case";
  await sync.save(state);
  assert.equal(backingRows.find((row) => row.resource_id === "CS-1").payload.title, "Edited assigned case");
  assert.ok(backingRows.some((row) => row.resource_id === "CS-2"), "RLS-hidden row must not be deleted");
  assert.equal(backingRows.find((row) => row.resource_id === "TASK-1").case_id, "CS-1", "a DB-only case link must be preserved");
  assert.ok(calls.every((call) => call.table === "practice_resources"), "legacy snapshot table must never be queried or mutated");
});


test("save round-trip persists linked hearing date and time without changing live QA data", async () => {
  const workspaceId = "ws-hearing-roundtrip";
  const backingRows = [
    { id: "row-case", workspace_id: workspaceId, resource_type: "case", resource_id: "CASE-QA-1", case_id: null, payload: { id: "CASE-QA-1", number: "QA/1/2026", next: "2026-10-12" }, updated_at: "2026-10-12T00:00:00.000Z" },
    { id: "row-hearing", workspace_id: workspaceId, resource_type: "hearing", resource_id: "HEARING-QA-1", case_id: "CASE-QA-1", payload: { id: "HEARING-QA-1", caseId: "CASE-QA-1", caseNumber: "QA/1/2026", date: "2026-10-12", time: "10:10" }, updated_at: "2026-10-12T00:00:00.000Z" },
  ];
  class Query {
    constructor(table) { this.table = table; this.op = "select"; this.filters = {}; this.values = null; }
    select() { return this; }
    eq(key, value) { this.filters[key] = value; return this; }
    insert(values) { this.op = "insert"; this.values = values; return this; }
    update(values) { this.op = "update"; this.values = values; return this; }
    delete() { this.op = "delete"; return this; }
    async execute() {
      assert.equal(this.table, "practice_resources", "sync must only use the per-resource table");
      const matches = () => backingRows.filter(row => Object.entries(this.filters).every(([k,v]) => row[k] === v));
      if (this.op === "select") return { data: matches().map(row => ({...row})), error: null };
      if (this.op === "update") {
        const row = matches()[0];
        if (!row) return { data: null, error: null };
        Object.assign(row, this.values);
        return { data: {...row}, error: null };
      }
      if (this.op === "insert") {
        const row = {...this.values, id: "row-inserted"};
        backingRows.push(row);
        return { data: {...row}, error: null };
      }
      const row = matches()[0];
      if (row) backingRows.splice(backingRows.indexOf(row), 1);
      return { data: row ? {id: row.id} : null, error: null };
    }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
    single() { return this.execute(); }
    maybeSingle() { return this.execute(); }
  }
  const sync = create({ from: table => new Query(table) }, { workspaceId });
  const state = await sync.load();
  assert.equal(state.hearings[0].time, "10:10");
  state.cases[0].next = "2026-10-13";
  // Mirrors the intended result of case-to-hearing synchronization for a
  // legacy case with no hearingTime: update the date, retain the saved time.
  state.hearings[0].date = state.cases[0].next;
  await sync.save(state);
  const storedCase = backingRows.find(row => row.resource_id === "CASE-QA-1");
  const storedHearing = backingRows.find(row => row.resource_id === "HEARING-QA-1");
  assert.equal(storedCase.payload.next, "2026-10-13", "case date should persist");
  assert.equal(storedHearing.payload.date, "2026-10-13", "linked hearing date should persist");
  assert.equal(storedHearing.payload.time, "10:10", "linked hearing time should remain unchanged");
  const reloaded = await sync.load();
  assert.equal(reloaded.hearings[0].date, "2026-10-13", "linked hearing date should survive reload");
  assert.equal(reloaded.hearings[0].time, "10:10", "linked hearing time should survive reload");
});


test("atomic RPC batches changes and reloads canonical baseline after success", async () => {
  const workspaceId = "ws-atomic";
  const backingRows = [
    { id: "row-case", workspace_id: workspaceId, resource_type: "case", resource_id: "CASE-1", case_id: null, payload: { id: "CASE-1", title: "Before" }, updated_at: "2026-10-12T00:00:00.000Z" }
  ];
  const rpcCalls = [];
  const client = {
    from(table) {
      assert.equal(table, "practice_resources");
      return {
        select() { return this; },
        eq(key, value) {
          assert.equal(key, "workspace_id");
          assert.equal(value, workspaceId);
          return Promise.resolve({ data: backingRows.map(row => ({...row})), error: null });
        }
      };
    },
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      assert.equal(name, "apply_practice_resource_batch");
      const next = backingRows.map(row => ({...row}));
      for (const change of args.p_changes) {
        if (change.op === "update") {
          const row = next.find(r => r.id === change.id && r.updated_at === change.expected_updated_at);
          if (!row) return { data: null, error: { code: "40001", message: "stale" } };
          row.payload = change.payload;
          row.case_id = change.case_id;
          row.updated_at = "2026-10-12T00:01:00.000Z";
        } else if (change.op === "insert") {
          next.push({ id: "row-" + change.resource_id, workspace_id: workspaceId, resource_type: change.resource_type, resource_id: change.resource_id, case_id: change.case_id, payload: change.payload, updated_at: "2026-10-12T00:01:00.000Z" });
        } else if (change.op === "delete") {
          const index = next.findIndex(r => r.id === change.id && r.updated_at === change.expected_updated_at && r.resource_type === change.resource_type && r.resource_id === change.resource_id);
          if (index < 0) return { data: null, error: { code: "40001", message: "stale" } };
          next.splice(index, 1);
        }
      }
      backingRows.splice(0, backingRows.length, ...next);
      return { data: { atomic: true, applied: args.p_changes.length }, error: null };
    }
  };
  const sync = create(client, { workspaceId });
  const state = await sync.load();
  state.cases[0].title = "After";
  state.clients.push({ id: "CLIENT-1", name: "New client" });
  const result = await sync.save(state);
  assert.deepEqual(result, { saved: 2, atomic: true });
  assert.equal(rpcCalls.length, 1, "all writes should use one atomic RPC call");
  assert.equal(rpcCalls[0].args.p_changes.length, 2);
  assert.equal(rpcCalls[0].args.p_changes.find(x => x.op === "update").expected_updated_at, "2026-10-12T00:00:00.000Z");
  assert.equal(backingRows.find(r => r.resource_id === "CASE-1").payload.title, "After");
  assert.ok(backingRows.some(r => r.resource_id === "CLIENT-1"));
  // Successful save reloads the server's updated_at version; unchanged save is a no-op.
  await sync.save(await sync.load());
  assert.equal(rpcCalls.length, 1);
});

test("atomic RPC failure reports conflict and does not advance client baseline", async () => {
  const workspaceId = "ws-atomic-rollback";
  const backingRows = [
    { id: "row-case", workspace_id: workspaceId, resource_type: "case", resource_id: "CASE-1", case_id: null, payload: { id: "CASE-1", title: "Original" }, updated_at: "2026-10-12T00:00:00.000Z" }
  ];
  const before = JSON.stringify(backingRows);
  let rpcCount = 0;
  const client = {
    from() {
      return { select() { return this; }, eq() { return Promise.resolve({ data: backingRows.map(row => ({...row})), error: null }); } };
    },
    async rpc() {
      rpcCount++;
      // Represents a PostgreSQL transaction returning a stale-version error:
      // no partial mutation is committed to the backing store.
      return { data: null, error: { code: "40001", message: "stale version" } };
    }
  };
  const sync = create(client, { workspaceId });
  const state = await sync.load();
  state.cases[0].title = "Must not partially commit";
  state.clients.push({ id: "CLIENT-NEW", name: "New client" });
  await assert.rejects(sync.save(state), error => error.code === "AD_CLOUD_CONFLICT");
  assert.equal(rpcCount, 1);
  assert.equal(JSON.stringify(backingRows), before, "failed atomic RPC must leave all rows unchanged");
});
