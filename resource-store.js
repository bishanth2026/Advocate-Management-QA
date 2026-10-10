(function (global) {
  "use strict";
  // QA-only adapter. Not loaded by app.html; do not switch persistence until
  // parity, authorization and regression tests pass.
  const TYPES = Object.freeze({
    cases: "case", clients: "client", hearings: "hearing", tasks: "task",
    invoices: "invoice", payments: "payment", transactions: "transaction", meetings: "meeting",
    discussions: "discussion", courts: "court", caseParties: "case_party"
  });
  const EMPTY = Object.freeze({
    cases: [], clients: [], hearings: [], tasks: [], invoices: [],
    payments: [], transactions: [], meetings: [], discussions: [], courts: [], caseParties: []
  });
  function requireClient(client, workspaceId) {
    if (!client || typeof client.from !== "function") throw new Error("Supabase client is required.");
    if (!workspaceId || typeof workspaceId !== "string") throw new Error("An authenticated workspace ID is required.");
  }
  let generatedIdCounter = 0;
  function stableId(type, item) {
    const candidate = type === "case"
      ? (item.id || item.caseId || item.number || item.caseNumber)
      : (item.id || item.key || item[type + "Id"]);
    if (candidate != null && String(candidate).trim() !== "") return String(candidate).trim();
    // Legacy UI modules sometimes create hearings/tasks without IDs. Assign the
    // ID onto the object before upsert so subsequent saves reuse the same key.
    const randomPart = global.crypto && typeof global.crypto.randomUUID === "function"
      ? global.crypto.randomUUID()
      : (Date.now().toString(36) + "_" + (++generatedIdCounter).toString(36) + "_" + Math.random().toString(36).slice(2, 10));
    item.id = type + "_" + randomPart;
    return item.id;
  }
  function normalize(v) { return String(v == null ? "" : v).trim().toLowerCase(); }
  // Stable non-cryptographic checksum for change/provenance tracking. This is
  // not used for authorization or tamper-proof audit guarantees.
  function sourceHash(value) {
    const input = JSON.stringify(value);
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  function buildRelationships(state) {
    const cases = Array.isArray(state.cases) ? state.cases : [];
    const byLabel = new Map();
    cases.forEach(c => [c.id, c.number, c.caseNumber, c.title].filter(Boolean).forEach(v => {
      const k = normalize(v);
      if (!byLabel.has(k)) byLabel.set(k, []);
      byLabel.get(k).push(c);
    }));
    const clientCase = new Map();
    cases.forEach(c => {
      const linked = [c.clientId].concat(Array.isArray(c.clientIds) ? c.clientIds : [])
        .filter(v => v != null && String(v).trim()).map(String);
      linked.forEach(id => {
        if (!clientCase.has(id)) clientCase.set(id, []);
        clientCase.get(id).push(c);
      });
    });
    const invoices = Array.isArray(state.invoices) ? state.invoices : [];
    const invoiceCase = new Map();
    invoices.forEach(inv => {
      const key = String(inv.id || inv.invoiceId || "");
      const cId = inv.caseId || inv.case_id || resolveLabel(inv.case || inv.caseNumber, byLabel);
      if (key && cId) invoiceCase.set(key, String(cId));
    });
    return { byLabel, clientCase, invoiceCase, cases };
  }
  function resolveLabel(label, byLabel) {
    const matches = byLabel.get(normalize(label)) || [];
    if (matches.length !== 1) return null;
    const c = matches[0];
    return c.id || c.caseId || c.number || c.caseNumber || null;
  }
  function caseId(type, item, rel) {
    const direct = item.caseId || item.case_id;
    if (direct != null && String(direct).trim()) return String(direct).trim();
    if (type === "client") {
      const matches = rel.clientCase.get(String(item.id || item.clientId || ""));
      return matches && matches.length === 1 ? String(matches[0].id || matches[0].caseId || matches[0].number) : null;
    }
    if (type === "payment") {
      const invoice = String(item.invoiceId || item.invoice_id || "");
      return rel.invoiceCase.get(invoice) || null;
    }
    return resolveLabel(item.case || item.caseNumber, rel.byLabel);
  }
  async function load(client, workspaceId) {
    requireClient(client, workspaceId);
    const result = await client.from("practice_resources")
      .select("workspace_id,resource_type,resource_id,case_id,payload,updated_at")
      .eq("workspace_id", workspaceId);
    if (result.error) throw result.error;
    const state = JSON.parse(JSON.stringify(EMPTY));
    (result.data || []).forEach(row => {
      const key = Object.keys(TYPES).find(k => TYPES[k] === row.resource_type);
      if (!key) {
        throw new Error("Unsupported resource type returned by database: " + String(row.resource_type));
      }
      if (key) {
        const payload = JSON.parse(JSON.stringify(row.payload || {}));
        // Legacy rows may have a database resource_id while their JSON payload
        // lacks an ID. Restore it to avoid generating a different key on save.
        if (!payload.id && row.resource_id) payload.id = row.resource_id;
        // Preserve the normalized relationship column when loading. Otherwise
        // a later upsert could erase links that exist only in case_id.
        if (row.case_id && !payload.caseId && !payload.case_id) payload.caseId = row.case_id;
        state[key].push(payload);
      }
    });
    state.__resourceStore = { mode: "resource-scoped", loadedAt: new Date().toISOString() };
    return state;
  }
  async function save(client, workspaceId, state) {
    requireClient(client, workspaceId);
    if (!state || typeof state !== "object") throw new Error("A state object is required.");
    // Fail closed if a future module adds a collection that this adapter cannot persist.
    // Silent omission here would make a cutover appear successful while losing module data.
    const unsupportedCollections = Object.keys(state).filter(key =>
      !Object.prototype.hasOwnProperty.call(TYPES, key) &&
      key !== "__resourceStore" &&
      Array.isArray(state[key]) &&
      state[key].length > 0
    );
    if (unsupportedCollections.length) {
      throw new Error("Unsupported non-empty resource collections: " + unsupportedCollections.join(", "));
    }
    const rel = buildRelationships(state);
    const rows = [];
    Object.keys(TYPES).forEach(key => {
      const list = state[key];
      if (list == null) return;
      if (!Array.isArray(list)) throw new Error("Expected " + key + " to be an array.");
      const type = TYPES[key];
      list.forEach(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid " + key + " record.");
        rows.push({
          workspace_id: workspaceId,
          resource_type: type,
          resource_id: stableId(type, item),
          case_id: caseId(type, item, rel),
          payload: item,
          source_hash: sourceHash(item),
          updated_at: new Date().toISOString()
        });
      });
    });
    // Upsert only: never delete rows omitted from potentially role-filtered state.
    for (let i = 0; i < rows.length; i += 100) {
      const result = await client.from("practice_resources")
        .upsert(rows.slice(i, i + 100), { onConflict: "workspace_id,resource_type,resource_id" });
      if (result.error) throw result.error;
    }
    return { saved: rows.length, mode: "resource-scoped", destructiveDeletes: 0 };
  }
  global.ADResourceStore = Object.freeze({ load, save, types: TYPES });
})(window);
