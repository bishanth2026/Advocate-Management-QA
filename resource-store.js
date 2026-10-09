(function (global) {
  "use strict";
  // QA-only adapter. Not loaded by app.html; do not switch production or current persistence
  // until parity, authorization, and regression tests pass.
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
  function resourceId(type, item) {
    const candidate = type === "case"
      ? (item.id || item.caseId || item.number || item.caseNumber)
      : (item.id || item.key || item[type + "Id"]);
    if (candidate == null || String(candidate).trim() === "") {
      throw new Error("Cannot save " + type + " without a stable ID.");
    }
    return String(candidate).trim();
  }
  function caseId(type, item) {
    if (type === "case") return null;
    const direct = item.caseId || item.case_id;
    if (direct != null && String(direct).trim()) return String(direct).trim();
    // Resolve display-only case labels conservatively against the loaded case list.
    const label = String(item.case || item.caseNumber || "").trim().toLowerCase();
    if (!label) return null;
    const matches = (global.__ADResourceCaseIndex || []).filter(c =>
      [c.id, c.number, c.caseNumber, c.title].some(v => String(v || "").trim().toLowerCase() === label)
    );
    return matches.length === 1 ? String(matches[0].id || matches[0].caseId || matches[0].number) : null;
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
      if (!key) return;
      if (!Array.isArray(state[key])) state[key] = [];
      state[key].push(row.payload || {});
    });
    global.__ADResourceCaseIndex = state.cases.slice();
    state.__resourceStore = { mode: "resource-scoped", loadedAt: new Date().toISOString() };
    return state;
  }
  async function save(client, workspaceId, state) {
    requireClient(client, workspaceId);
    if (!state || typeof state !== "object") throw new Error("A state object is required.");
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
          resource_id: resourceId(type, item),
          case_id: caseId(type, item),
          payload: item,
          updated_at: new Date().toISOString()
        });
      });
    });
    // Upsert only. Never bulk-delete records: the current caller may have a role-filtered
    // view and deleting absent rows could destroy records the caller is not allowed to see.
    for (let i = 0; i < rows.length; i += 100) {
      const result = await client.from("practice_resources")
        .upsert(rows.slice(i, i + 100), { onConflict: "workspace_id,resource_type,resource_id" });
      if (result.error) throw result.error;
    }
    return { saved: rows.length, mode: "resource-scoped", destructiveDeletes: 0 };
  }
  global.ADResourceStore = Object.freeze({ load, save, types: TYPES });
})(window);
