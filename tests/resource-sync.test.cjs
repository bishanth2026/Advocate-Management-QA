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
  ];
  const state = buildInitialState(rows);
  assert.equal(state.cases[0].custom.keep, true);
  assert.equal(state.clients[0].id, "CL-1");
  assert.equal(state.transactions[0].id, "TX-1");
  assert.equal(state.caseParties[0].id, "CP-1");
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
