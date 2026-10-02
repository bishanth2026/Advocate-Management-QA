#!/usr/bin/env node
'use strict';

/*
 * AdvocateDesk legacy workspace_state preview.
 * Read-only: never connects to Supabase and never writes to the input file.
 * Usage: node scripts/preview-cloud-migration.js <export.json>
 *
 * Input may be the raw workspace_state payload or a practice_records row
 * containing a payload object. Output is a summary only; no client data is
 * printed. Missing IDs receive deterministic preview keys, NOT persisted IDs.
 */
const fs = require('node:fs');
const crypto = require('node:crypto');

const COLLECTIONS = Object.freeze({
  cases: 'case',
  clients: 'client',
  hearings: 'hearing',
  tasks: 'task',
  discussions: 'discussion',
  meetings: 'meeting',
  payments: 'payment',
  invoices: 'invoice',
  documents: 'document',
  caseParties: 'case_party'
});
const OTHER_COLLECTIONS = Object.freeze(['courts', 'transactions']);
const args = process.argv.slice(2);
if (args.length !== 1 || args[0] === '--help') {
  process.stdout.write('Usage: node scripts/preview-cloud-migration.js <export.json>\n');
  process.exit(args[0] === '--help' ? 0 : 2);
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);
}
function readPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Input must be a JSON object.');
  const payload = Object.prototype.hasOwnProperty.call(value, 'payload') ? value.payload : value;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('payload must be a JSON object.');
  return payload;
}
function reference(obj, keys) {
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim()) return String(obj[key]).trim();
  return '';
}
function main() {
  const inputPath = args[0];
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const state = readPayload(raw);
  const summary = {};
  const issues = [];
  const records = [];
  const metadataKeys = Object.keys(state).filter(k => ![...Object.keys(COLLECTIONS), ...OTHER_COLLECTIONS].includes(k));
  const idSets = {};

  for (const [collection, recordType] of Object.entries(COLLECTIONS)) {
    const rows = state[collection];
    if (rows === undefined) { summary[collection] = {recordType, count: 0, missingId: 0, duplicateId: 0}; continue; }
    if (!Array.isArray(rows)) {
      issues.push({code:'COLLECTION_NOT_ARRAY', collection});
      summary[collection] = {recordType, count: 0, missingId: 0, duplicateId: 0};
      continue;
    }
    const seen = new Set();
    let missingId = 0, duplicateId = 0;
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        issues.push({code:'RECORD_NOT_OBJECT', collection, index});
        return;
      }
      const id = reference(row, ['id', 'caseId', 'clientId', 'hearingId', 'taskId', 'invoiceId', 'paymentId']);
      const key = id || 'preview-' + collection + '-' + hash(row);
      if (!id) {
        missingId++;
        issues.push({code:'MISSING_STABLE_ID', collection, index, previewKey:key});
      }
      if (seen.has(key)) {
        duplicateId++;
        issues.push({code:'DUPLICATE_RECORD_KEY', collection, index, previewKey:key});
      }
      seen.add(key);
      records.push({record_type:recordType, record_key:key, payload:row, source_collection:collection, source_index:index, id_missing:!id});
    });
    idSets[collection] = seen;
    summary[collection] = {recordType, count:rows.length, missingId, duplicateId};
  }

  for (const collection of OTHER_COLLECTIONS) {
    const rows = state[collection];
    if (rows === undefined) { summary[collection] = {recordType:'other', count:0, missingId:0, duplicateId:0}; continue; }
    if (!Array.isArray(rows)) {
      issues.push({code:'COLLECTION_NOT_ARRAY', collection});
      summary[collection] = {recordType:'other', count:0, missingId:0, duplicateId:0};
      continue;
    }
    const seen = new Set(); let missingId=0, duplicateId=0;
    rows.forEach((row,index)=>{
      if (!row || typeof row !== 'object' || Array.isArray(row)) {issues.push({code:'RECORD_NOT_OBJECT',collection,index});return;}
      const id=reference(row,['id','key','code','name']);
      const key=id||'preview-'+collection+'-'+hash(row);
      if(!id){missingId++;issues.push({code:'MISSING_STABLE_ID',collection,index,previewKey:key});}
      if(seen.has(key)){duplicateId++;issues.push({code:'DUPLICATE_RECORD_KEY',collection,index,previewKey:key});}
      seen.add(key);
      // The database CHECK constraint permits only known record_type values.
      // These collections are therefore namespaced under "other" in preview.
      records.push({record_type:'other',record_key:collection+':'+key,payload:{collection,item:row},source_collection:collection,source_index:index,id_missing:!id});
    });
    summary[collection]={recordType:'other',count:rows.length,missingId,duplicateId};
  }

  // Flag references that appear to use stable IDs but do not resolve in this snapshot.
  const clientIds=idSets.clients||new Set(), caseIds=idSets.cases||new Set();
  for(const r of records){
    const p=r.payload;
    if(r.source_collection==='cases'){
      const refs=Array.isArray(p.clientIds)?p.clientIds:(p.clientId?[p.clientId]:[]);
      refs.forEach(id=>{if(!clientIds.has(String(id)))issues.push({code:'UNRESOLVED_CLIENT_REFERENCE',collection:'cases',index:r.source_index});});
    }
    if(['hearings','tasks','invoices','payments'].includes(r.source_collection)){
      const caseRef=reference(p,['caseId','case_id']);
      if(caseRef&&!caseIds.has(caseRef))issues.push({code:'UNRESOLVED_CASE_REFERENCE',collection:r.source_collection,index:r.source_index});
      const clientRef=reference(p,['clientId','client_id']);
      if(clientRef&&!clientIds.has(clientRef))issues.push({code:'UNRESOLVED_CLIENT_REFERENCE',collection:r.source_collection,index:r.source_index});
    }
  }

  const recognized=[...Object.keys(COLLECTIONS),...OTHER_COLLECTIONS];
  const metadata={};
  metadataKeys.forEach(k=>metadata[k]=state[k]);
  const total=records.length;
  const codeCounts={};
  issues.forEach(i=>codeCounts[i.code]=(codeCounts[i.code]||0)+1);
  const output={
    mode:'read-only-preview',
    source:inputPath,
    recordsPreviewed:total,
    byCollection:summary,
    unclassifiedTopLevelKeys:metadataKeys,
    unclassifiedKeyCount:metadataKeys.length,
    issueCount:issues.length,
    issueCounts:codeCounts,
    blocked:issues.some(i=>['COLLECTION_NOT_ARRAY','RECORD_NOT_OBJECT','DUPLICATE_RECORD_KEY'].includes(i.code)),
    note:'Preview only. No Supabase calls, no writes, and generated preview keys are not production IDs.'
  };
  process.stdout.write(JSON.stringify(output,null,2)+'\n');
}
try { main(); } catch (err) { process.stderr.write('Preview failed: '+err.message+'\n'); process.exit(1); }
