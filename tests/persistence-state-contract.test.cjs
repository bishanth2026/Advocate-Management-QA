/* QA-only persistence contract guard.
   This deliberately does not enable resource-store cutover; it checks the adapter's
   declared coverage and protects the known legacy bootstrap until cutover gates pass. */
const assert = require("node:assert/strict");
const fs = require("node:fs");

const adapter = fs.readFileSync("resource-store.js", "utf8");
const html = fs.readFileSync("app.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");

const expected = {
  cases: "case",
  clients: "client",
  hearings: "hearing",
  tasks: "task",
  invoices: "invoice",
  payments: "payment",
  transactions: "transaction",
  meetings: "meeting",
  discussions: "discussion",
  courts: "court",
  caseParties: "case_party"
};

for (const [stateKey, resourceType] of Object.entries(expected)) {
  assert.match(adapter, new RegExp("\\b" + stateKey + "\\s*:\\s*[\"']" + resourceType + "[\"']"),
    "resource adapter must map " + stateKey + " to " + resourceType);
  assert.match(adapter, new RegExp("\\b" + stateKey + "\\s*:\\s*\\[\\]"),
    "resource adapter EMPTY state must preserve " + stateKey);
}

for (const key of ["cases", "clients", "hearings", "tasks", "discussions", "meetings", "payments", "invoices"]) {
  assert.match(app, new RegExp("\\b" + key + "\\s*:"),
    "legacy app state must still account for " + key);
}

// Cutover is intentionally blocked until parity, deletion, concurrency and
// authenticated RLS acceptance gates pass.
assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*resource-store\.js/i,
  "do not enable resource-store in app.html before QA cutover gates are approved");
assert.match(html, /workspace_state/,
  "legacy aggregate bootstrap should remain explicit until cutover approval");

console.log("Persistence state-contract guard passed; resource-store cutover remains intentionally disabled.");
