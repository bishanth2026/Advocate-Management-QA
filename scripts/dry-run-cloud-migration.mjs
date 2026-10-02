#!/usr/bin/env node
/**
 * AdvocateDesk legacy workspace_state -> per-record converter (DRY RUN ONLY).
 *
 * Usage:
 *   node scripts/dry-run-cloud-migration.mjs <supabase-export.json> [--out report.json]
 *
 * Accepts a JSON array of practice_records rows, one row object, or a state/payload
 * object. Never connects to Supabase and never writes to the source file/database.
 * The optional --out writes only the generated report to a separate local file.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const COLLECTIONS = {
  cases: 'case',
  clients: 'client',
  hearings: 'hearing',
  tasks: 'task',
  discussions: 'discussion',
  meetings: 'meeting',
  payments: 'payment',
  invoices: 'invoice',
  courts: 'court',
  transactions: 'transaction',
  caseParties: 'case_party'
};
const RESERVED = new Set(['id','workspace_id','record_type','record_key','payload','created_by','created_at','updated_at']);
const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith('--'));
const outIndex = args.indexOf('--out');
const outFile = outIndex >= 0 ? args[outIndex + 1] : null;
if (!input || (outIndex >= 0 && !outFile)) {
  console.error('Usage: node scripts/dry-run-cloud-migration.mjs <export.json> [--out report.json]');
  process.exit(2);
}
const canonical = value => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
};
const fingerprint = value => crypto.createHash('sha256').update(canonical(value)).digest('hex').slice(0, 24);
const isObject = x => !!x && typeof x === 'object' && !Array.isArray(x);
function unwrap(raw) {
  if (Array.isArray(raw)) {
    const row = raw.find(r => isObject(r) && r.record_key === 'workspace_state' && isObject(r.payload));
    if (!row) throw new Error('Input array has no row with record_key "workspace_state" and object payload.');
    return { state: row.payload, workspaceId: row.workspace_id || null, sourceRowId: row.id || null };
  }
  if (!isObject(raw)) throw new Error('Input must be a JSON object or array of rows.');
  if (raw.record_key === 'workspace_state' && isObject(raw.payload))
    return { state: raw.payload, workspaceId: raw.workspace_id || null, sourceRowId: raw.id || null };
  if (isObject(raw.payload) && raw.record_type === 'other')
    return { state: raw.payload, workspaceId: raw.workspace_id || null, sourceRowId: raw.id || null };
  if (isObject(raw.state)) return { state: raw.state, workspaceId: raw.workspace_id || null, sourceRowId: raw.id || null };
  return { state: raw, workspaceId: raw.workspace_id || null, sourceRowId: raw.id || null };
}
function main() {
  const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
  const {state, workspaceId, sourceRowId} = unwrap(raw);
  const proposed = [], collections = {}, problems = [];
  for (const [collection, recordType] of Object.entries(COLLECTIONS)) {
    const value = state[collection];
    if (value == null) { collections[collection] = {recordType,count:0,missingIds:0,duplicateKeys:0}; continue; }
    if (!Array.isArray(value)) {
      problems.push({kind:'invalid_collection',collection,message:'Expected an array; preserved in metadata, not converted.'});
      collections[collection] = {recordType,count:0,missingIds:0,duplicateKeys:0,invalidType:true};
      continue;
    }
    const seen = new Set(); let missingIds = 0, duplicateKeys = 0;
    value.forEach((entity,index) => {
      if (!isObject(entity)) {
        problems.push({kind:'invalid_entity',collection,index,message:'Expected an object; entity not converted.'});
        return;
      }
      const rawId = entity.id ?? entity[collection === 'caseParties' ? 'partyId' : ''];
      const hasStableId = rawId !== undefined && rawId !== null && String(rawId).trim() !== '';
      const key = hasStableId ? String(rawId).trim() : 'dryrun-missing-id-' + fingerprint(entity);
      if (!hasStableId) {
        missingIds++;
        problems.push({kind:'missing_stable_id',collection,index,candidateKey:key,message:'Candidate key is content-derived and is NOT safe for production until a persistent ID is assigned.'});
      }
      if (seen.has(key)) {
        duplicateKeys++;
        problems.push({kind:'duplicate_key',collection,index,key,message:'Duplicate record key within collection; resolve before migration.'});
      }
      seen.add(key);
      proposed.push({workspace_id:workspaceId,record_type:recordType,record_key:key,payload:entity,__dry_run:{sourceIndex:index,stableIdPresent:hasStableId}});
    });
    collections[collection] = {recordType,count:value.filter(isObject).length,converted:value.filter(isObject).length,missingIds,duplicateKeys};
  }
  const metadata = {};
  for (const [key,value] of Object.entries(state)) if (!Object.hasOwn(COLLECTIONS,key)) metadata[key] = value;
  const invalidEntities = problems.filter(p=>p.kind==='invalid_entity').length;
  const duplicates = problems.filter(p=>p.kind==='duplicate_key').length;
  const missingIds = problems.filter(p=>p.kind==='missing_stable_id').length;
  const report = {
    mode:'DRY_RUN_NO_DATABASE_WRITES',
    source:{file:path.basename(input),workspaceId,legacyRowId:sourceRowId},
    summary:{sourceCollectionCount:Object.keys(COLLECTIONS).length,proposedRecordCount:proposed.length,missingStableIds:missingIds,duplicateKeys:duplicates,invalidEntities:Object.keys(collections).filter(k=>collections[k].invalidType).length,unknownTopLevelKeys:Object.keys(metadata).length,readyForProduction:false},
    collections,unknownTopLevelKeys:Object.keys(metadata),
    problems,
    proposedRecords:proposed,
    preservedMetadata:metadata,
    nextAction:'Resolve every missing stable ID, duplicate key, and invalid entity; review relationships and payloads; then test against a separate staging project. This report does not authorize production writes.'
  };
  const json = JSON.stringify(report,null,2) + '\n';
  if (outFile) fs.writeFileSync(outFile,json,{flag:'wx'});
  else process.stdout.write(json);
  console.error('DRY RUN ONLY: ' + proposed.length + ' proposed records; ' + problems.length + ' issue(s). No database writes performed.');
}
try { main(); } catch (error) { console.error('Dry-run failed: '+error.message); process.exit(1); }
