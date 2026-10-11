/* AdvocateDesk per-resource cloud synchronization.
 * QA cutover adapter: reads only rows permitted by practice_resources RLS and
 * writes per-record diffs with optimistic concurrency. Never reads/writes the
 * legacy workspace_state snapshot.
 */
(function (root) {
  "use strict";

  const STATE_TO_TYPE = Object.freeze({
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
    caseParties: "case_party",
  });
  const TYPE_TO_STATE = Object.freeze(Object.fromEntries(
    Object.entries(STATE_TO_TYPE).map(([stateKey, resourceType]) => [resourceType, stateKey])
  ));
  const COLLECTION_KEYS = new Set(Object.keys(STATE_TO_TYPE));
  const DELETE_ORDER = Object.freeze([
    "payment", "transaction", "invoice", "hearing", "task", "meeting",
    "discussion", "case_party", "client", "case", "court"
  ]);
  const selectColumns = "id,workspace_id,resource_type,resource_id,case_id,payload,legacy_record_id,updated_at";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    if (isRecord(value)) {
      return "{" + Object.keys(value).sort().map((key) =>
        JSON.stringify(key) + ":" + stableStringify(value[key])
      ).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  function recordKey(resourceType, resourceId) {
    return resourceType + "::" + String(resourceId);
  }

  function courtResourceId(name) {
    const normalized = String(name || "").trim().toLocaleLowerCase();
    if (!normalized) throw new Error("Court name cannot be empty.");
    const encoded = encodeURIComponent(normalized);
    const id = "court:" + encoded;
    if (id.length > 200) throw new Error("Court name is too long to create a stable resource ID.");
    return id;
  }

  function indexCases(state) {
    const byReference = new Map();
    const byClient = new Map();
    const addReference = (ref, id) => {
      if (ref == null || String(ref).trim() === "") return;
      const key = String(ref).trim();
      const ids = byReference.get(key) || [];
      if (!ids.includes(id)) ids.push(id);
      byReference.set(key, ids);
    };
    (Array.isArray(state.cases) ? state.cases : []).forEach((item) => {
      if (!isRecord(item) || item.id == null) return;
      const id = String(item.id).trim();
      [id, item.number, item.caseNumber, item.case_number].forEach((ref) => addReference(ref, id));
      const refs = [
        item.clientId,
        ...(Array.isArray(item.clientIds) ? item.clientIds : []),
        ...(Array.isArray(item.clients) ? item.clients.map((client) =>
          isRecord(client) ? (client.id ?? client.clientId ?? client.client_id) : client
        ) : []),
      ];
      refs.filter((ref) => ref != null && String(ref).trim() !== "").forEach((ref) => {
        const clientId = String(ref).trim();
        const ids = byClient.get(clientId) || [];
        if (!ids.includes(id)) ids.push(id);
        byClient.set(clientId, ids);
      });
    });
    return { byReference, byClient };
  }

  function resolveCaseId(resourceType, payload, state, indexes) {
    if (resourceType === "case") return null;
    const directRef = payload.case_id ?? payload.caseId ?? payload.case_id_text ?? null;
    const displayRef = payload.case ?? payload.caseNumber ?? payload.case_number ?? null;
    let candidate = directRef ?? displayRef;
    if (resourceType === "payment" || resourceType === "transaction") {
      const invoiceId = payload.invoiceId ?? payload.invoice_id;
      if (invoiceId != null && Array.isArray(state.invoices)) {
        const invoice = state.invoices.find((item) => item && String(item.id) === String(invoiceId));
        if (invoice) candidate = invoice.case_id ?? invoice.caseId ?? invoice.case ?? invoice.caseNumber ?? candidate;
      }
    }
    if (candidate != null && String(candidate).trim() !== "") {
      const ref = String(candidate).trim();
      const matches = indexes.byReference.get(ref) || [];
      if (matches.length > 1) throw new Error("Case reference is ambiguous for " + resourceType + " " + (payload.id || "") + ".");
      return matches.length === 1 ? matches[0] : ref;
    }
    if (resourceType === "client") {
      const matches = indexes.byClient.get(String(payload.id)) || [];
      if (matches.length === 1) return matches[0];
      // Existing clients may legitimately be related to multiple cases. The
      // existing row's case_id is preserved during sync; a new ambiguous client
      // is blocked below because the current schema stores only one case_id.
      if (matches.length > 1) return null;
    }
    return null;
  }

  function buildInitialState(rows) {
    const state = {};
    for (const key of COLLECTION_KEYS) state[key] = [];
    for (const row of rows) {
      const stateKey = TYPE_TO_STATE[row.resource_type];
      if (!stateKey) throw new Error("Unsupported practice_resources type: " + row.resource_type + ".");
      if (!isRecord(row.payload)) throw new Error("Resource payload must be a JSON object for " + row.resource_id + ".");
      if (row.payload.id == null || String(row.payload.id) !== String(row.resource_id)) {
        throw new Error("Resource ID does not match its payload ID for " + row.resource_id + ".");
      }
      if (stateKey === "courts") {
        const name = row.payload.name ?? row.payload.value ?? row.payload.label;
        if (typeof name !== "string" || !name.trim()) throw new Error("Court resource is missing its display name.");
        state.courts.push(name.trim());
      } else {
        state[stateKey].push(clone(row.payload));
      }
    }
    return state;
  }

  function buildDesiredRows(state) {
    if (!isRecord(state)) throw new Error("Application state must be an object.");
    const unknownKeys = Object.keys(state).filter((key) => !COLLECTION_KEYS.has(key));
    if (unknownKeys.length) throw new Error("Unsupported state properties block per-record save: " + unknownKeys.join(", ") + ".");
    const indexes = indexCases(state);
    const desired = new Map();
    for (const [stateKey, resourceType] of Object.entries(STATE_TO_TYPE)) {
      if (!Array.isArray(state[stateKey])) throw new Error("State collection '" + stateKey + "' is missing or is not an array; save was stopped to prevent accidental deletion.");
      for (const item of state[stateKey]) {
        let payload = item;
        let resourceId;
        if (stateKey === "courts" && typeof item === "string") {
          const name = item.trim();
          resourceId = courtResourceId(name);
          payload = { id: resourceId, name };
        } else {
          if (!isRecord(payload)) throw new Error("Collection '" + stateKey + "' contains a non-object item.");
          if (payload.id == null || String(payload.id).trim() === "") throw new Error("A record in '" + stateKey + "' has no stable ID; save was stopped.");
          resourceId = String(payload.id).trim();
        }
        if (resourceId.length > 200) throw new Error("Record ID exceeds 200 characters: " + resourceId.slice(0, 40) + "…");
        const key = recordKey(resourceType, resourceId);
        if (desired.has(key)) throw new Error("Duplicate record ID in collection '" + stateKey + "': " + resourceId);
        desired.set(key, {
          resource_type: resourceType,
          resource_id: resourceId,
          case_id: resolveCaseId(resourceType, payload, state, indexes),
          payload: clone(payload),
        });
      }
    }
    return desired;
  }

  function create(client, auth, options) {
    options = options || {};
    const onStatus = typeof options.onStatus === "function" ? options.onStatus : function () {};
    const workspaceId = String(auth && auth.workspaceId || "").trim();
    if (!workspaceId) throw new Error("A verified workspace ID is required for per-resource sync.");

    let baseline = new Map();
    let queue = Promise.resolve();
    let sequence = 0;

    function status(label, color) { onStatus(label, color); }

    async function load() {
      status("Cloud: Loading authorized records…", "#a16207");
      const response = await client.from("practice_resources").select(selectColumns).eq("workspace_id", workspaceId);
      if (response.error) throw response.error;
      const rows = Array.isArray(response.data) ? response.data : [];
      baseline = new Map();
      for (const row of rows) {
        const key = recordKey(row.resource_type, row.resource_id);
        if (baseline.has(key)) throw new Error("Duplicate resource returned by the database: " + key);
        baseline.set(key, clone(row));
      }
      const state = buildInitialState(rows);
      status("Cloud: Synced", "#15803d");
      return state;
    }

    async function persist(snapshot, version) {
      const desired = buildDesiredRows(snapshot);
      // Only rows returned by RLS are in baseline. Omitted/unauthorized rows are
      // never inferred as deletions because they were never placed in baseline.
      const changes = [];
      const caseIndexes = indexCases(snapshot);
      for (const [key, next] of desired) {
        const previous = baseline.get(key);
        if (!previous) {
          if (next.resource_type === "client" && (caseIndexes.byClient.get(next.resource_id) || []).length > 1) {
            throw new Error("New client " + next.resource_id + " is linked to multiple cases; manual relationship handling is required.");
          }
          changes.push({ kind: "insert", key, next });
        } else {
          // Do not erase a valid database case link merely because a legacy
          // payload omits the relationship field or the linked case is not in
          // the current authorized result set.
          if (next.case_id == null && previous.case_id != null) next.case_id = previous.case_id;
          if (
            stableStringify(previous.payload) !== stableStringify(next.payload) ||
            (previous.case_id ?? null) !== (next.case_id ?? null)
          ) {
            changes.push({ kind: "update", key, next, previous });
          }
        }
      }
      const desiredKeys = new Set(desired.keys());
      for (const [key, previous] of baseline) {
        if (!desiredKeys.has(key)) changes.push({ kind: "delete", key, previous });
      }
      const deleteRank = (resourceType) => {
        const index = DELETE_ORDER.indexOf(resourceType);
        return index < 0 ? DELETE_ORDER.length : index;
      };
      changes.sort((a, b) => {
        if (a.kind === "delete" && b.kind === "delete") return deleteRank(a.previous.resource_type) - deleteRank(b.previous.resource_type);
        if (a.kind === "delete") return 1;
        if (b.kind === "delete") return -1;
        return a.key.localeCompare(b.key);
      });

      for (const change of changes) {
        if (change.kind === "insert") {
          const response = await client.from("practice_resources").insert({
            workspace_id: workspaceId,
            resource_type: change.next.resource_type,
            resource_id: change.next.resource_id,
            case_id: change.next.case_id,
            payload: change.next.payload,
          }).select(selectColumns).single();
          if (response.error) {
            if (response.error.code === "23505") {
              const conflict = new Error("This record was created in another session. Refresh and review before retrying.");
              conflict.code = "AD_CLOUD_CONFLICT";
              throw conflict;
            }
            throw response.error;
          }
          if (!response.data) throw new Error("The server did not confirm the new record.");
          baseline.set(change.key, clone(response.data));
        } else if (change.kind === "update") {
          const response = await client.from("practice_resources").update({
            payload: change.next.payload,
            case_id: change.next.case_id,
            updated_at: new Date().toISOString(),
          }).eq("id", change.previous.id).eq("updated_at", change.previous.updated_at).select(selectColumns).maybeSingle();
          if (response.error) throw response.error;
          if (!response.data) {
            const conflict = new Error("This record changed in another session or your role cannot edit it. Refresh before continuing.");
            conflict.code = "AD_CLOUD_CONFLICT";
            throw conflict;
          }
          baseline.set(change.key, clone(response.data));
        } else {
          const response = await client.from("practice_resources").delete().eq("id", change.previous.id).eq("updated_at", change.previous.updated_at).select("id").maybeSingle();
          if (response.error) throw response.error;
          if (!response.data) {
            const conflict = new Error("This record changed in another session or your role cannot delete it. Refresh before continuing.");
            conflict.code = "AD_CLOUD_CONFLICT";
            throw conflict;
          }
          baseline.delete(change.key);
        }
      }
      if (version === sequence) status("Cloud: Synced", "#15803d");
      return { saved: changes.length };
    }

    function save(state) {
      const snapshot = clone(state);
      const version = ++sequence;
      status("Cloud: Saving…", "#a16207");
      const request = queue.catch(function () { return null; }).then(function () { return persist(snapshot, version); });
      queue = request;
      request.catch(function (error) {
        console.error("AdvocateDesk per-resource sync failed", error);
        if (version === sequence) {
          if (error && error.code === "AD_CLOUD_CONFLICT") status("Cloud: Conflict — refresh required", "#b91c1c");
          else status("Cloud: Sync error — retry after checking connection", "#b91c1c");
        }
      });
      return request;
    }

    return { load, save };
  }

  const api = { create, buildInitialState, buildDesiredRows, resolveCaseId, stableStringify, STATE_TO_TYPE };
  root.ADResourceSync = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
