#!/usr/bin/env node
'use strict';

/**
 * AdvocateDesk snapshot -> per-record preview converter.
 * READ-ONLY with respect to Supabase: consumes a JSON export and writes a local
 * preview/report only. It never connects to a network or database.
 *
 * Usage:
 *   node scripts/dry-run-per-record-migration.js <snapshot.json> [preview.json]
 *
 * Input may be the raw workspace state, a practice_records row whose payload
 * contains the state, or an object with a "payload" wrapper.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const knownCollections = new Set([
  'cases', 'clients', 'hearings', 'tasks', 'discussions', 'meetings',
  'payments', 'invoices', 'courts', 'transactions', 'caseParties',
  'caseRecords', 'allCases', 'documents', 'caseDocuments'
]);
const scalarIdFields = ['id', 'recordId', 'record_id', 'uuid'];
const relationFields = {
  case: ['caseId', 'case_id', 'linkedCaseId'],
  client: ['clientId', 'client_id', 'linkedClientId'],
  invoice: ['invoiceId', 'invoice_id', 'linkedInvoiceId'],
  payment: ['paymentId', 'payment_id', 'linkedPaymentId']
};
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 20);
const canonical = value => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
};
function unwrap(input) {
  let value = input;
  for (let i = 0; i < 4; i++) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) break;
    if (value.record_type === 'other' && value.record_key === 'workspace_state' && value.payload && typeof value.payload === 'object') { value = value.payload; continue; }
    if (value.payload && typeof value.payload === 'object' && !Array.isArray(value.payload)) { value = value.payload; continue; }
    if (value.state && typeof value.state === 'object' && !Array.isArray(value.state)) { value = value.state; continue; }
    break;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Input must resolve to a workspace-state JSON object.');
  return value;
}
function firstId(obj) {
  for (const field of scalarIdFields) {
    const value = obj[field];
    if (typeof value === 'string' || typeof value === 'number') {
      const s = String(value).trim();
      if (s) return { field, value: s };
    }
  }
  return null;
}
function main() {
  const inputPath = process.argv[2];
  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error('Usage: node scripts/dry-run-per-record-migration.js <snapshot.json> [preview.json]');
    process.exitCode = 2; return;
  }
  const outputPath = process.argv[3] || path.resolve(process.cwd(), 'per-record-migration-preview.json');
  const state = unwrap(JSON.parse(fs.readFileSync(inputPath, 'utf8')));
  const workspaceId = state.workspace_id || state.workspaceId || null;
  const collections = Object.keys(state).filter(k => Array.isArray(state[k]));
  const rows = [], issues = [], counts = {};
  const identityMaps = { case: new Set(), client: new Set(), invoice: new Set(), payment: new Set() };
  const typeFor = key => ({
    cases:'case', caseRecords:'case', allCases:'case',
    clients:'client', hearings:'hearing', tasks:'task', discussions:'discussion',
    meetings:'meeting', payments:'payment', invoices:'invoice', courts:'court',
    transactions:'transaction', caseParties:'case_party', documents:'document',
    caseDocuments:'document'
  }[key] || 'other_' + key.replace(/[^a-zA-Z0-9_-]/g, '_'));

  for (const collection of collections) {
    const list = state[collection], recordType = typeFor(collection);
    counts[collection] = { source: list.length, emitted: 0, missingId: 0, duplicateId: 0, nonObject: 0 };
    const seen = new Set();
    list.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        counts[collection].nonObject++;
        issues.push({ severity:'error', code:'NON_OBJECT_ITEM', collection, index, message:'Collection item is not a JSON object; preserved as payload.' });
      }
      const payload = item && typeof item === 'object' && !Array.isArray(item) ? item : { value:item };
      const found = firstId(payload);
      let recordKey, idSource;
      if (found) {
        recordKey = found.value; idSource = found.field;
        if (seen.has(recordKey)) {
          counts[collection].duplicateId++;
          issues.push({ severity:'error', code:'DUPLICATE_ID', collection, index, recordKey, message:'Duplicate stable ID within collection; resolve before migration.' });
        }
      } else {
        counts[collection].missingId++;
        recordKey = 'needs-id-' + hash(collection + ':' + index + ':' + canonical(payload));
        idSource = 'generated_preview_only';
        issues.push({ severity:'warning', code:'MISSING_ID', collection, index, proposedKey:recordKey, message:'Proposed key is preview-only; assign and persist a stable ID before production migration.' });
      }
      seen.add(recordKey);
      if (['case','client','invoice','payment'].includes(recordType)) identityMaps[recordType].add(recordKey);
      rows.push({
        workspace_id: workspaceId,
        record_type: recordType,
        record_key: recordKey,
        payload,
        _source: { collection, index, id_source:idSource }
      });
      counts[collection].emitted++;
    });
  }
  for (const [kind, fields] of Object.entries(relationFields)) {
    const target = identityMaps[kind];
    for (const row of rows) {
      if (!row.payload || typeof row.payload !== 'object') continue;
      for (const field of fields) {
        const value = row.payload[field];
        if (value === undefined || value === null || String(value).trim() === '') continue;
        if (!target.has(String(value))) {
          issues.push({ severity:'warning', code:'UNRESOLVED_REFERENCE', collection:row._source.collection, index:row._source.index, field, value:String(value), target:kind, message:'Reference did not match an ID in the recognized target collection. It may use a display name or alternate ID field; review manually.' });
        }
      }
    }
  }
  const duplicateKeys = new Map();
  rows.forEach(r => {
    const k = r.record_type + '|' + r.record_key;
    duplicateKeys.set(k, (duplicateKeys.get(k)||0)+1);
  });
  for (const [key, n] of duplicateKeys) if (n > 1) issues.push({severity:'error',code:'TARGET_KEY_COLLISION',key,occurrences:n,message:'Multiple source rows would share the target workspace/type/key.'});
  const report = {
    mode:'DRY_RUN_ONLY',
    source_file:path.basename(inputPath),
    workspace_id:workspaceId,
    generated_at:new Date().toISOString(),
    source_collection_count:collections.length,
    source_record_count:rows.length,
    output_record_count:rows.length,
    issue_summary:{
      errors:issues.filter(x=>x.severity==='error').length,
      warnings:issues.filter(x=>x.severity==='warning').length
    },
    collections:counts,
    issues
  };
  const preview = { _migration_report:report, records:rows };
  fs.writeFileSync(outputPath, JSON.stringify(preview, null, 2) + '\n', {flag:'w'});
  console.log(JSON.stringify(report, null, 2));
  console.log('\nPreview written locally to: ' + path.resolve(outputPath));
  console.log('No database connection or Supabase write was attempted.');
  if (report.issue_summary.errors) process.exitCode = 1;
}
main();
