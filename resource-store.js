(function (global) {
  "use strict";
  // QA-only adapter. Not loaded by app.html; do not switch persistence until
  // parity, authorization and regression tests pass.
  const TYPES = Object.freeze({
    cases: "case", clients: "client", hearings: "hearing", tasks: "task",
    invoices: "invoice", payments: "payment", meetings: "meeting",
    discussions: "discussion", courts: "court"
  });
  const EMPTY = Object.freeze({
    cases: [], clients: [], hearings: [], tasks: [], invoices: [],
    payments: [], meetings: [], discussions: [], courts: []
  });
  function requireClient(client, workspaceId) {
    if (!client || typeof client.from !== "function") throw new Error("Supabase client is required.");
    if (!workspaceId || typeof workspaceId !== "string") throw new Error("An authenticated workspace ID is required.");
  }
  function stableId(type, item) {
    const candidate = type === "case"
      ? (item.id || item.caseId || item.number || item.caseNumber)
      : (item.id || item.key || item[type + "Id"]);
    if (candidate == null || String(candidate).trim() === "") throw new Error("Cannot save " + type + " without a stable ID.");
    return String(candidate).trim();
  }
  function normalize(v) { return String(v == null ? "" : v).trim().toLowerCase(); }
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
      if (key) state[key].push(row.payload || {});
    });
    state.__resourceStore = { mode: "resource-scoped", loadedAt: new Date().toISOString() };
    return state;
  }
  async function save(client, workspaceId, state) {
    requireClient(client, workspaceId);
    if (!state || typeof state !== "object") throw new Error("A state object is required.");
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
