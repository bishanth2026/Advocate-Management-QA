import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../auth.js", import.meta.url), "utf8");

function makeHarness({ memberships = [], profile = { user_id: "user-1", full_name: "Test User", email: "test@example.invalid", platform_role: "user" } } = {}) {
  const storage = new Map();
  let signOutCount = 0;
  const user = { id: "user-1", email: "test@example.invalid" };
  const client = {
    auth: {
      signInWithPassword: async () => ({ data: { user }, error: null }),
      signOut: async () => { signOutCount += 1; return { error: null }; },
      getSession: async () => ({ data: { session: { user } }, error: null })
    },
    from(table) {
      let selected = "";
      const query = {
        select(columns) { selected = columns; return query; },
        eq() { return query; },
        maybeSingle: async () => ({ data: table === "profiles" ? profile : null, error: null }),
        then(resolve, reject) {
          const data = table === "workspace_members" ? memberships : [];
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  const window = {
    supabase: { createClient: () => client },
    location: { replace() {} }
  };
  const localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  };
  vm.runInNewContext(source, { window, localStorage, URL, Date, String, JSON, Error });
  return { auth: window.ADAuth, storage, get signOutCount() { return signOutCount; } };
}

const activeAdmin = { workspace_id: "ws-1", role: "admin", workspaces: { id: "ws-1", name: "Workspace 1", status: "active" } };
const activeAdvocate = { workspace_id: "ws-2", role: "advocate", workspaces: { id: "ws-2", name: "Workspace 2", status: "active" } };
const inactiveAdmin = { workspace_id: "ws-old", role: "admin", workspaces: { id: "ws-old", name: "Old workspace", status: "inactive" } };

// Exactly one active membership resolves to that workspace.
{
  const h = makeHarness({ memberships: [activeAdvocate] });
  const session = await h.auth.signIn("test@example.invalid", "not-a-real-password", "member");
  assert.equal(session.workspaceId, "ws-2");
  assert.equal(session.workspaceRole, "advocate");
  assert.equal(JSON.parse(h.storage.get("advocateDeskAuth")).workspaceId, "ws-2");
  assert.equal(h.signOutCount, 0);
}

// Inactive memberships do not create false ambiguity.
{
  const h = makeHarness({ memberships: [activeAdvocate, inactiveAdmin] });
  const session = await h.auth.signIn("test@example.invalid", "not-a-real-password", "member");
  assert.equal(session.workspaceId, "ws-2");
}

// Multiple active memberships must fail closed and clear the authenticated session.
{
  const h = makeHarness({ memberships: [activeAdmin, activeAdvocate] });
  await assert.rejects(
    h.auth.signIn("test@example.invalid", "not-a-real-password", "member"),
    /multiple active workspaces/i
  );
  assert.equal(h.signOutCount, 1);
  assert.equal(h.storage.has("advocateDeskAuth"), false);
}

// Admin portal accepts only one active Admin membership; a non-admin membership is ignored.
{
  const h = makeHarness({ memberships: [activeAdmin, activeAdvocate] });
  const session = await h.auth.signIn("test@example.invalid", "not-a-real-password", "admin");
  assert.equal(session.workspaceId, "ws-1");
  assert.equal(session.workspaceRole, "admin");
}

// No active membership must fail closed.
{
  const h = makeHarness({ memberships: [inactiveAdmin] });
  await assert.rejects(
    h.auth.signIn("test@example.invalid", "not-a-real-password", "member"),
    /No active workspace/i
  );
  assert.equal(h.signOutCount, 1);
}

console.log("AdvocateDesk auth workspace-resolution regression tests: PASS (5 scenarios)");
