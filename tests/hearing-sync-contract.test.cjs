const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../app.js"), "utf8");
const start = source.indexOf("function syncCaseNextHearing(caseRecord, options={}){");
const end = source.indexOf("\nstate.hearings=Array.isArray(state.hearings)?state.hearings:[];", start);
assert.ok(start >= 0 && end > start, "syncCaseNextHearing implementation must be present");
const implementation = source.slice(start, end);

function runSync(caseRecord, hearings) {
  const state = { hearings };
  const context = { state };
  vm.runInNewContext(implementation + "\nsyncCaseNextHearing(input);", { ...context, input: caseRecord });
  return state.hearings;
}

test("case update preserves an existing hearing time when legacy case has no hearingTime", () => {
  const hearings = [{ id: "H-1", caseId: "CS-1", caseNumber: "OS 22/2026", date: "2026-10-12", time: "10:10" }];
  const result = runSync({ id: "CS-1", number: "OS 22/2026", next: "2026-10-12", title: "Legacy case" }, hearings);
  assert.equal(result[0].time, "10:10");
  assert.equal(result[0].date, "2026-10-12");
});

test("explicit case hearingTime updates the linked hearing time", () => {
  const hearings = [{ id: "H-1", caseId: "CS-1", caseNumber: "OS 22/2026", date: "2026-10-12", time: "10:10" }];
  const result = runSync({ id: "CS-1", number: "OS 22/2026", next: "2026-10-13", hearingTime: "11:30" }, hearings);
  assert.equal(result[0].time, "11:30");
  assert.equal(result[0].date, "2026-10-13");
});

test("new case hearing creates a linked record with its supplied time", () => {
  const result = runSync({ id: "CS-2", number: "OS 23/2026", next: "2026-10-14", hearingTime: "09:45" }, []);
  assert.equal(result.length, 1);
  assert.equal(result[0].time, "09:45");
  assert.equal(result[0].caseId, "CS-2");
});
