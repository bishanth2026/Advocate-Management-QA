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
async function restGet(session, table, query) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + query, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: "Bearer " + session.accessToken }
  });
  const body = await response.text();
  assert.equal(response.status, 200, "QA read " + table + " failed: " + body);
  return JSON.parse(body);
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
    // Positive-path Admin test: use only a case/member pair in this disposable QA workspace
    // that has no existing assignment. Always remove the test assignment in finally.
    const ws = admin.session.workspaceId;
    const [caseRows, memberRows, assignmentRows] = await Promise.all([
      restGet(admin.session, "practice_resources", "select=resource_id&resource_type=eq.case&workspace_id=eq." + encodeURIComponent(ws) + "&limit=100"),
      restGet(admin.session, "workspace_members", "select=user_id,role&workspace_id=eq." + encodeURIComponent(ws)),
      restGet(admin.session, "case_assignments", "select=case_id,user_id&workspace_id=eq." + encodeURIComponent(ws))
    ]);
    const target = memberRows.find(m => m.user_id !== admin.session.userId && ["advocate", "staff"].includes(String(m.role || "").toLowerCase()));
    assert.ok(target, "Need an active same-workspace Advocate/Staff fixture for positive assignment test");
    const occupied = new Set(assignmentRows.map(a => String(a.case_id) + "::" + String(a.user_id)));
    const qaCase = caseRows.find(row => !occupied.has(String(row.resource_id) + "::" + String(target.user_id)));
    assert.ok(qaCase, "Need an existing case with no assignment for the disposable target member");
    let assigned = false;
    try {
      const assignResponse = await rpc(admin.session, "assign_case_to_member", {
        p_workspace_id: ws, p_case_id: qaCase.resource_id, p_user_id: target.user_id
      });
      const assignBody = await assignResponse.text();
      assert.equal(assignResponse.status, 200, "Authorized Admin assignment failed: " + assignBody);
      const assignmentId = JSON.parse(assignBody);
      assert.ok(typeof assignmentId === "string" && assignmentId.length > 10, "Assignment RPC must return an assignment UUID");
      assigned = true;
      const [afterAssign, assignAudit] = await Promise.all([
        restGet(admin.session, "case_assignments", "select=id,case_id,user_id,assigned_by&workspace_id=eq." + encodeURIComponent(ws) + "&case_id=eq." + encodeURIComponent(qaCase.resource_id) + "&user_id=eq." + encodeURIComponent(target.user_id)),
        restGet(admin.session, "workspace_audit_log", "select=action,target_user_id,case_id&workspace_id=eq." + encodeURIComponent(ws) + "&action=eq.case.assigned&target_user_id=eq." + encodeURIComponent(target.user_id) + "&case_id=eq." + encodeURIComponent(qaCase.resource_id) + "&actor_user_id=eq." + encodeURIComponent(admin.session.userId) + "&limit=10")
      ]);
      assert.ok(afterAssign.some(a => a.id === assignmentId), "Assignment row not visible after successful RPC");
      assert.ok(assignAudit.length > 0, "case.assigned audit event not visible after successful RPC");
      results.push("PASS Admin same-workspace assignment — assignment row and case.assigned audit event verified");
      const unassignResponse = await rpc(admin.session, "unassign_case_from_member", {
        p_workspace_id: ws, p_case_id: qaCase.resource_id, p_user_id: target.user_id
      });
      const unassignBody = await unassignResponse.text();
      assert.equal(unassignResponse.status, 200, "Authorized Admin unassignment failed: " + unassignBody);
      assert.equal(JSON.parse(unassignBody), true, "Unassignment RPC must return true for the test assignment");
      assigned = false;
      const [afterUnassign, unassignAudit] = await Promise.all([
        restGet(admin.session, "case_assignments", "select=id&workspace_id=eq." + encodeURIComponent(ws) + "&case_id=eq." + encodeURIComponent(qaCase.resource_id) + "&user_id=eq." + encodeURIComponent(target.user_id)),
        restGet(admin.session, "workspace_audit_log", "select=action,target_user_id,case_id&workspace_id=eq." + encodeURIComponent(ws) + "&action=eq.case.unassigned&target_user_id=eq." + encodeURIComponent(target.user_id) + "&case_id=eq." + encodeURIComponent(qaCase.resource_id) + "&actor_user_id=eq." + encodeURIComponent(admin.session.userId) + "&limit=10")
      ]);
      assert.equal(afterUnassign.length, 0, "Test assignment remains after unassign");
      assert.ok(unassignAudit.length > 0, "case.unassigned audit event not visible after successful RPC");
      results.push("PASS Admin same-workspace unassignment — assignment removed and case.unassigned audit event verified");
    } finally {
      if (assigned) {
        const cleanup = await rpc(admin.session, "unassign_case_from_member", {
          p_workspace_id: ws, p_case_id: qaCase.resource_id, p_user_id: target.user_id
        });
        if (!cleanup.ok) throw new Error("CRITICAL: test assignment cleanup failed: " + await cleanup.text());
      }
    }
    console.log(results.join("\\n"));
    console.log("PASS All RPC negative-path checks and positive Admin assignment lifecycle checks used genuine browser-issued Supabase session tokens. The test assignment is removed after verification.");
  } finally {
    if (admin) await admin.context.close();
    if (advocate) await advocate.context.close();
    await browser.close();
  }
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
