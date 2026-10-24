const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const BASE_URL = process.env.QA_BASE_URL || "https://bishanth2026.github.io/Advocate-Management-QA";
const SUPABASE_URL = "https://uqtsksgypncsbcnuanbk.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_cK6gEEBcDOOEfpkXlgVEDQ_7EVPt-XW";
const FOREIGN_WORKSPACE = "55097c1f-9ebe-4252-bc4c-a43c3c989361";
const roles = [
  { name: "Admin", email: "bishanth2026+advocatedesk.admin01@gmail.com", password: process.env.QA_ADMIN_PASSWORD },
  { name: "Advocate", email: "bishanth2026+advocatedesk.assigned02@gmail.com", password: process.env.QA_ASSIGNED_ADVOCATE_PASSWORD }
];
const financeRpcs = ["finance_case_directory", "finance_case_directory_v2", "finance_client_directory", "finance_client_directory_v2"];

async function login(browser, role) {
  assert.ok(role.password, "Missing disposable QA credential for " + role.name);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE_URL + "/member-login.html", { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(role.email);
  await page.locator("#password").fill(role.password);
  await page.locator("#loginForm button[type=submit]").click();
  await page.waitForURL(/app\.html(?:#|$)/, { timeout: 25000 });
  await page.waitForFunction(() => {
    const n = document.getElementById("cloudSyncStatus");
    return n && /Cloud: Synced/.test(n.textContent || "");
  }, undefined, { timeout: 30000 });
  const session = await page.evaluate(() => {
    const auth = JSON.parse(localStorage.getItem("advocateDeskAuth") || "{}");
    let accessToken = "";
    for (const key of Object.keys(localStorage)) {
      if (!key.endsWith("-auth-token")) continue;
      try {
        const v = JSON.parse(localStorage.getItem(key) || "{}");
        if (typeof v.access_token === "string") accessToken = v.access_token;
      } catch (_) {}
    }
    return { workspaceId: auth.workspaceId || "", userId: auth.userId || "", accessToken };
  });
  assert.ok(session.workspaceId && session.userId && session.accessToken, "Real browser-issued Supabase session is required");
  return { context, session };
}
async function rpc(session, name, body) {
  return fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, Authorization: "Bearer " + session.accessToken, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let admin, advocate;
  try {
    admin = await login(browser, roles[0]);
    advocate = await login(browser, roles[1]);
    assert.notEqual(admin.session.workspaceId, FOREIGN_WORKSPACE);
    assert.notEqual(advocate.session.workspaceId, FOREIGN_WORKSPACE);
    for (const name of financeRpcs) {
      for (const [label, session, workspace] of [
        ["Advocate own workspace", advocate.session, advocate.session.workspaceId],
        ["Advocate foreign workspace", advocate.session, FOREIGN_WORKSPACE],
        ["Admin foreign workspace", admin.session, FOREIGN_WORKSPACE]
      ]) {
        const response = await rpc(session, name, { p_workspace_id: workspace });
        assert.equal(response.status, 200, name + " " + label + " should be RLS/permission-filtered");
        const rows = await response.json();
        assert.ok(Array.isArray(rows));
        assert.equal(rows.length, 0, name + " " + label + " must return no finance rows");
        results.push("PASS " + name + " — " + label + ": 0 rows");
      }
    }
    for (const name of ["assign_case_to_member", "unassign_case_from_member"]) {
      const response = await rpc(advocate.session, name, {
        p_workspace_id: advocate.session.workspaceId,
        p_case_id: "qa-negative-path-nonexistent-case",
        p_user_id: advocate.session.userId
      });
      const body = await response.text();
      assert.ok([400, 401, 403].includes(response.status), name + " must deny non-Admin Advocate");
      assert.match(body, /42501|Only an Admin|permission|authorization|denied/i, "Expected authorization denial");
      results.push("PASS " + name + " — non-Admin Advocate denied");
    }
    for (const name of ["assign_case_to_member", "unassign_case_from_member"]) {
      const response = await rpc(admin.session, name, {
        p_workspace_id: FOREIGN_WORKSPACE,
        p_case_id: "qa-negative-path-cross-workspace-case",
        p_user_id: admin.session.userId
      });
      const body = await response.text();
      assert.ok([400, 401, 403].includes(response.status), name + " must deny cross-workspace Admin");
      assert.match(body, /42501|Only an Admin|permission|authorization|denied/i, "Expected workspace authorization denial");
      results.push("PASS " + name + " — cross-workspace Admin denied");
    }
    console.log(results.join("\n"));
    console.log("PASS All RPC negative-path checks used genuine browser-issued Supabase session tokens. No successful write RPC was called.");
  } finally {
    if (admin) await admin.context.close();
    if (advocate) await advocate.context.close();
    await browser.close();
  }
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
