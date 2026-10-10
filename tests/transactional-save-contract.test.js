/* Reference-model tests for the required transaction contract.
 * These test the contract model, NOT a real Supabase/Postgres RPC.
 * Live rollback/concurrency acceptance remains mandatory before migration.
 */
const assert = require("node:assert/strict");

function createWorkspace(initialRows = []) {
  return { revision: 4, rows: new Map(initialRows.map(r => [r.id, structuredClone(r)])), locked: Promise.resolve() };
}
async function saveAtomically(workspace, expectedRevision, mutations, validate = () => {}) {
  // Serialize callers like a row lock; second caller sees the committed revision.
  let release;
  const prior = workspace.locked;
  workspace.locked = new Promise(resolve => { release = resolve; });
  await prior;
  try {
    if (expectedRevision !== workspace.revision) {
      const e = new Error("revision conflict"); e.code = "40001"; throw e;
    }
    const draft = new Map([...workspace.rows].map(([k,v]) => [k, structuredClone(v)]));
    for (let i=0; i<mutations.length; i++) {
      const m = mutations[i];
      validate(m, i);
      if (m.op === "delete") draft.delete(m.id);
      else if (m.op === "upsert") draft.set(m.id, structuredClone(m.value));
      else throw new Error("unknown operation");
    }
    workspace.rows = draft;
    workspace.revision += 1;
    return { revision: workspace.revision };
  } finally { release(); }
}

(async () => {
  const ws = createWorkspace([{id:"A",value:"before"}]);
  const before = JSON.stringify([...ws.rows]);
  await assert.rejects(
    () => saveAtomically(ws, 4, [
      {op:"upsert",id:"A",value:{id:"A",value:"first-write"}},
      {op:"upsert",id:"B",value:{id:"B",value:"second-write"}}
    ], (_m,i) => { if (i===1) throw new Error("injected second-mutation failure"); }),
    /injected second-mutation failure/
  );
  assert.equal(JSON.stringify([...ws.rows]), before, "failure on mutation 2 leaves mutation 1 unapplied");
  assert.equal(ws.revision, 4, "failed transaction does not increment revision");

  const results = await Promise.allSettled([
    saveAtomically(ws, 4, [{op:"upsert",id:"X",value:{id:"X"}}]),
    saveAtomically(ws, 4, [{op:"upsert",id:"Y",value:{id:"Y"}}])
  ]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length, 1, "only one concurrent save with revision N commits");
  const rejected = results.find(r=>r.status==="rejected");
  assert.equal(rejected.reason.code, "40001", "stale concurrent save returns revision conflict");
  assert.equal(ws.revision, 5, "successful concurrent save increments revision exactly once");
  assert.equal(ws.rows.has("X") !== ws.rows.has("Y"), true, "conflicting save has no partial row write");

  await assert.rejects(() => saveAtomically(ws, 4, [{op:"upsert",id:"Z",value:{id:"Z"}}]), e=>e.code==="40001");
  assert.equal(ws.rows.has("Z"), false, "stale revision causes no mutation");
  console.log("transactional save reference-model tests: PASS (not database integration tests)");
})().catch(err=>{ console.error(err); process.exitCode=1; });
