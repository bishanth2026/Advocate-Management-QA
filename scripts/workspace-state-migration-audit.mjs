#!/usr/bin/env node
/**
 * Read-only audit/planning tool for exported public.practice_records rows.
 * It never connects to Supabase and never writes to a database.
 *
 * Usage:
 *   node scripts/workspace-state-migration-audit.mjs export.json
 *   node scripts/workspace-state-migration-audit.mjs export.json --plan-out migration-plan.json
 *   node scripts/workspace-state-migration-audit.mjs --self-test
 *
 * The optional plan contains full record payloads and may contain confidential
 * legal/client data. Store it securely and do not commit exports or plans.
 */
import fs from "node:fs";
import { createHash } from "node:crypto";

const COLLECTION_TYPES = Object.freeze({
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
  case_parties: "case_party",
  caseParties: "case_party",
});

const asObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const stableStringify = (value) => {
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  if (asObject(value)) return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
  return JSON.stringify(value);
};
const countValue = (value) => Array.isArray(value) ? value.length : asObject(value) ? Object.keys(value).length : value == null ? 0 : 1;

function buildMigrationAudit(rows) {
  if (!Array.isArray(rows)) throw new Error("Input must be an array of exported practice_records rows.");
  const snapshots = rows.filter((row) => row && row.record_type === "other" && row.record_key === "workspace_state");
  const report = {
    mode: "read-only-dry-run",
    inputRows: rows.length,
    workspaceSnapshots: snapshots.length,
    workspaces: [],
    blockers: [],
    warnings: [],
    planEntryCount: 0,
    unknownTopLevelKeys: [],
    unsupportedCollectionKeys: [],
    checksumAlgorithm: "SHA-256 is not computed here; normalized payloads are compared structurally in tests.",
  };
  const plan = [];
  const seenSnapshots = new Set();
  const seenResources = new Set();
  const mappedCollections = new Set(Object.keys(COLLECTION_TYPES));

  for (const snapshot of snapshots) {
    const workspaceId = String(snapshot.workspace_id || "");
    if (!workspaceId) report.blockers.push({ workspaceId: null, reason: "Snapshot has no workspace_id." });
    const snapshotKey = workspaceId + "::workspace_state";
    if (seenSnapshots.has(snapshotKey)) report.blockers.push({ workspaceId, reason: "More than one workspace_state snapshot exists for this workspace." });
    seenSnapshots.add(snapshotKey);

    if (!asObject(snapshot.payload)) {
      report.blockers.push({ workspaceId, reason: "Snapshot payload is not a JSON object." });
      continue;
    }

    const casesByClient = new Map();
    const caseIdsByReference = new Map();
    const caseItems = Array.isArray(snapshot.payload.cases) ? snapshot.payload.cases : [];
    for (const caseItem of caseItems) {
      if (!asObject(caseItem) || caseItem.id == null) continue;
      const caseId = String(caseItem.id).trim();
      for (const ref of [caseId, caseItem.number, caseItem.caseNumber, caseItem.case_number]) {
        if (ref == null || String(ref).trim() === "") continue;
        const key = String(ref).trim();
        const refs = caseIdsByReference.get(key) || [];
        if (!refs.includes(caseId)) refs.push(caseId);
        caseIdsByReference.set(key, refs);
      }
      const clientRefs = [
        caseItem.clientId,
        ...(Array.isArray(caseItem.clientIds) ? caseItem.clientIds : []),
        ...(Array.isArray(caseItem.clients) ? caseItem.clients.map((client) => asObject(client) ? (client.id ?? client.clientId ?? client.client_id) : client) : []),
      ].filter((ref) => ref != null && String(ref).trim() !== "").map((ref) => String(ref).trim());
      for (const clientId of clientRefs) {
        const links = casesByClient.get(clientId) || [];
        if (!links.includes(caseId)) links.push(caseId);
        casesByClient.set(clientId, links);
      }
    }

    const collectionReport = {};
    const keys = Object.keys(snapshot.payload);
    for (const key of keys) {
      const value = snapshot.payload[key];
      const type = COLLECTION_TYPES[key];
      if (!type) {
        report.unknownTopLevelKeys.push({ workspaceId, key, valueType: Array.isArray(value) ? "array" : value === null ? "null" : typeof value, itemOrPropertyCount: countValue(value) });
        if (Array.isArray(value)) report.unsupportedCollectionKeys.push({ workspaceId, key, count: value.length });
        continue;
      }
      if (!Array.isArray(value)) {
        report.blockers.push({ workspaceId, collection: key, reason: "Mapped collection must be an array; no automatic coercion is safe." });
        continue;
      }

      collectionReport[key] = { resourceType: type, sourceCount: value.length, planCount: 0, missingIdCount: 0, duplicateIdCount: 0 };
      for (let index = 0; index < value.length; index += 1) {
        const item = value[index];
        if (!asObject(item)) {
          report.blockers.push({ workspaceId, collection: key, index, reason: "Collection item is not a JSON object." });
          continue;
        }
        const idValue = item.id ?? item.resource_id ?? item.resourceId;
        if (idValue === undefined || idValue === null || String(idValue).trim() === "") {
          collectionReport[key].missingIdCount += 1;
          report.blockers.push({ workspaceId, collection: key, index, reason: "Resource has no stable ID; assign and persist an ID before conversion." });
          continue;
        }
        const resourceId = String(idValue).trim();
        if (resourceId.length > 200) {
          report.blockers.push({ workspaceId, collection: key, resourceIdLength: resourceId.length, reason: "Resource ID exceeds the target table's 200-character limit." });
          continue;
        }
        const uniqueKey = [workspaceId, type, resourceId].join("::");
        if (seenResources.has(uniqueKey)) {
          collectionReport[key].duplicateIdCount += 1;
          report.blockers.push({ workspaceId, collection: key, resourceId, reason: "Duplicate resource ID for this workspace and resource type." });
          continue;
        }
        seenResources.add(uniqueKey);
        let caseId = null;
        if (type !== "case") {
          const directCaseRef = item.case_id ?? item.caseId ?? item.case_id_text ?? null;
          const displayCaseRef = item.case ?? item.caseNumber ?? item.case_number ?? null;
          const candidate = directCaseRef ?? displayCaseRef;
          if (candidate != null && String(candidate).trim() !== "") {
            const ref = String(candidate).trim();
            const resolved = caseIdsByReference.get(ref) || [];
            caseId = resolved.length === 1 ? resolved[0] : ref;
            if (resolved.length > 1) {
              report.blockers.push({ workspaceId, collection: key, resourceId, reason: "Case reference resolves to multiple cases; manual review required." });
              continue;
            }
          } else if (type === "client") {
            const linkedCases = casesByClient.get(resourceId) || [];
            if (linkedCases.length === 1) caseId = linkedCases[0];
            else if (linkedCases.length > 1) {
              report.blockers.push({ workspaceId, collection: key, resourceId, reason: "Client is linked from multiple cases but target schema supports only one case_id; manual review required." });
              continue;
            }
          }
        }
        if (caseId && caseId.length > 200) {
          report.blockers.push({ workspaceId, collection: key, resourceId, reason: "case_id exceeds the target table's 200-character limit." });
          continue;
        }
        plan.push({
          workspace_id: workspaceId,
          resource_type: type,
          resource_id: resourceId,
          case_id: caseId,
          payload: structuredClone(item),
          legacy_record_id: snapshot.id ?? null,
          source_hash: null,
          _source: { collection: key, index },
        });
        collectionReport[key].planCount += 1;
      }
    }
    report.workspaces.push({
      workspaceId,
      legacyRecordId: snapshot.id ?? null,
      updatedAt: snapshot.updated_at ?? null,
      sourcePayloadKeys: keys.sort(),
      collectionReport,
      normalizedPayloadSha256: createHash("sha256").update(stableStringify(snapshot.payload)).digest("hex"),
    });
  }

  report.planEntryCount = plan.length;
  if (snapshots.length === 0) report.blockers.push({ reason: "No workspace_state snapshots found in input." });
  const workspaceIds = new Set(snapshots.map((row) => String(row.workspace_id || "")));
  const rowsWithoutSnapshot = rows.filter((row) => row && row.record_type === "other" && row.record_key !== "workspace_state");
  if (rowsWithoutSnapshot.length) {
    report.warnings.push({ count: rowsWithoutSnapshot.length, reason: "Other practice_records exist; this tool intentionally leaves them unchanged." });
  }
  report.readiness = report.blockers.length === 0 && report.unknownTopLevelKeys.length === 0 ? "review-required" : "blocked";
  report.notes = [
    "This report is not permission to write data or switch application reads.",
    "Unknown top-level keys are intentionally not discarded; they require an explicit metadata strategy.",
    "Existing practice_resources rows must be reconciled against this plan before any insert/update.",
    "The tool does not infer missing IDs, rewrite relationships, call Supabase, or mutate exported data.",
  ];
  return { report, plan };
}

function runSelfTest() {
  const input = [
    { id: "snap-1", workspace_id: "ws-a", record_type: "other", record_key: "workspace_state", updated_at: "2026-10-01T00:00:00Z", payload: {
      cases: [{ id: "CASE-1", title: "Example", extraCustomField: { keep: true } }],
      clients: [{ id: "CLIENT-1", caseId: "CASE-1", custom: "preserve" }],
      invoices: [],
      customSettings: { language: "en" },
    } },
    { id: "snap-2", workspace_id: "ws-b", record_type: "other", record_key: "workspace_state", payload: {
      cases: [{ id: "CASE-1", title: "Different workspace" }],
      tasks: [{ title: "Missing stable id" }],
    } },
  ];
  const result = buildMigrationAudit(input);
  const caseA = result.plan.find((row) => row.workspace_id === "ws-a" && row.resource_type === "case");
  const clientA = result.plan.find((row) => row.workspace_id === "ws-a" && row.resource_type === "client");
  if (result.report.workspaceSnapshots !== 2) throw new Error("Self-test failed: snapshot count.");
  if (result.report.planEntryCount !== 3) throw new Error("Self-test failed: expected three plan entries.");
  if (caseA?.payload?.extraCustomField?.keep !== true) throw new Error("Self-test failed: unknown object fields were not preserved.");
  if (caseA?.case_id !== null) throw new Error("Self-test failed: case rows should not point case_id to themselves.");
  if (clientA?.case_id !== "CASE-1" || clientA?.payload?.custom !== "preserve") throw new Error("Self-test failed: relation/custom field preservation.");
  if (!result.report.blockers.some((item) => item.reason?.includes("stable ID"))) throw new Error("Self-test failed: missing ID was not blocked.");
  if (!result.report.unknownTopLevelKeys.some((item) => item.key === "customSettings")) throw new Error("Self-test failed: unknown top-level key was not reported.");
  if (result.report.readiness !== "blocked") throw new Error("Self-test failed: unsafe input should be blocked.");
  process.stdout.write("PASS: read-only converter audit self-tests (7 assertions)\n");
}

function main(argv) {
  if (argv.includes("--self-test")) return runSelfTest();
  const inputPath = argv.find((arg) => !arg.startsWith("--"));
  if (!inputPath) throw new Error("Usage: node scripts/workspace-state-migration-audit.mjs export.json [--plan-out plan.json] or --self-test");
  const rows = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const { report, plan } = buildMigrationAudit(rows);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  const planIndex = argv.indexOf("--plan-out");
  if (planIndex !== -1) {
    const outputPath = argv[planIndex + 1];
    if (!outputPath) throw new Error("--plan-out requires a file path.");
    fs.writeFileSync(outputPath, JSON.stringify(plan, null, 2) + "\n", { flag: "wx" });
    process.stderr.write("Wrote sensitive migration plan to " + outputPath + "; keep it private and do not commit it.\n");
  }
  if (report.readiness === "blocked") process.exitCode = 2;
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
export { buildMigrationAudit };
