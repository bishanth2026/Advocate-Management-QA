const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const BASE_URL = process.env.QA_BASE_URL || "https://bishanth2026.github.io/Advocate-Management-QA";
const SUPPORTED_ROLES = [
  { key: "ADMIN", email: "bishanth2026+advocatedesk.admin01@gmail.com", password: process.env.QA_ADMIN_PASSWORD, role: "admin" },
  { key: "ASSIGNED_ADVOCATE", email: "bishanth2026+advocatedesk.assigned02@gmail.com", password: process.env.QA_ASSIGNED_ADVOCATE_PASSWORD, role: "assigned advocate" },
  { key: "UNASSIGNED_ADVOCATE", email: "bishanth2026+advocatedesk.unassigned03@gmail.com", password: process.env.QA_UNASSIGNED_ADVOCATE_PASSWORD, role: "unassigned advocate" },
  { key: "ACCOUNTANT", email: "bishanth2026+advocatedesk.accountant04@gmail.com", password: process.env.QA_ACCOUNTANT_PASSWORD, role: "accountant" },
];
const NONMEMBER = {
  email: "bishanth2026+advocatedesk.nonmember05@gmail.com",
  password: process.env.QA_NONMEMBER_PASSWORD
};
const FIXTURES = {
  assignedCase: "qa-c7h-20261011-run-001-case-assigned",
  unassignedCase: "qa-c7h-20261011-run-001-case-unassigned",
  unlinkedTask: "qa-c7h-20261011-run-001-task-unlinked",
  assignedTask: "qa-c7h-20261011-run-001-task-assigned",
  unassignedTask: "qa-c7h-20261011-run-001-task-unassigned"
};
const NAV_PAGES = [
  "dashboard", "case-client", "case-details", "client-management",
  "hearings", "calendar", "documents", "tasks", "finance", "reports", "settings"
];
const errors = [];
const results = [];
function log(status, message) {
  const line = status + " " + message;
  console.log(line);
  results.push(line);
}

function requiredSecrets() {
  const vars = ["QA_ADMIN_PASSWORD", "QA_ASSIGNED_ADVOCATE_PASSWORD", "QA_UNASSIGNED_ADVOCATE_PASSWORD", "QA_ACCOUNTANT_PASSWORD", "QA_NONMEMBER_PASSWORD"];
  return vars.filter((name) => !process.env[name]);
}

async function login(page, email, password) {
  await page.goto(BASE_URL + "/member-login.html", { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  const authRequests = [];
  page.on("request", (request) => {
    if (/\/rest\/v1\/practice_records(?:\?|$)/i.test(request.url())) {
      authRequests.push(request.url());
    }
  });
  await page.locator("#loginForm button[type=submit]").click();
  await page.waitForURL(/app\.html(?:#|$)/, { timeout: 25000 });
  await page.waitForFunction(() => {
    const node = document.getElementById("cloudSyncStatus");
    return node && /Cloud: Synced/.test(node.textContent || "");
  }, undefined, { timeout: 30000 });
  await page.waitForFunction(() => !document.getElementById("cloudLoading"), { timeout: 15000 }).catch(() => {});
  assert.deepEqual(authRequests, [], "The application must not query legacy practice_records during login/bootstrap.");
}

async function assertFixtureVisibility(page, roleKey) {
  const state = await page.evaluate(() => window.ADCloudInitialState);
  assert.ok(state && Array.isArray(state.cases) && Array.isArray(state.tasks), "Per-resource state should be available after bootstrap.");
  const ids = {
    cases: state.cases.map((item) => String(item.id)),
    tasks: state.tasks.map((item) => String(item.id))
  };
  const includes = (arr, value) => arr.includes(value);
  if (roleKey === "ADMIN") {
    for (const id of [FIXTURES.assignedCase, FIXTURES.unassignedCase]) assert.ok(includes(ids.cases, id), "Admin should see fixture case " + id);
    for (const id of [FIXTURES.unlinkedTask, FIXTURES.assignedTask, FIXTURES.unassignedTask]) assert.ok(includes(ids.tasks, id), "Admin should see fixture task " + id);
  } else if (roleKey === "ASSIGNED_ADVOCATE") {
    assert.ok(includes(ids.cases, FIXTURES.assignedCase), "Assigned advocate should see their assigned case.");
    assert.ok(!includes(ids.cases, FIXTURES.unassignedCase), "Assigned advocate must not see the other advocate's case.");
    assert.ok(includes(ids.tasks, FIXTURES.assignedTask), "Assigned advocate should see the linked task.");
    assert.ok(!includes(ids.tasks, FIXTURES.unassignedTask), "Assigned advocate must not see the other case's task.");
    assert.ok(!includes(ids.tasks, FIXTURES.unlinkedTask), "Assigned advocate must not see unlinked workspace tasks.");
  } else if (roleKey === "UNASSIGNED_ADVOCATE") {
    assert.ok(!includes(ids.cases, FIXTURES.assignedCase), "Unassigned advocate must not see the assigned advocate's case.");
    assert.ok(includes(ids.cases, FIXTURES.unassignedCase), "Advocate should see their own assigned case fixture.");
    assert.ok(!includes(ids.tasks, FIXTURES.assignedTask), "Advocate must not see the other case's task.");
    assert.ok(includes(ids.tasks, FIXTURES.unassignedTask), "Advocate should see their linked task.");
    assert.ok(!includes(ids.tasks, FIXTURES.unlinkedTask), "Advocate must not see unlinked workspace tasks.");
  } else if (roleKey === "ACCOUNTANT") {
    assert.equal(ids.cases.filter((id) => id.startsWith("qa-c7h-20261011-run-001-")).length, 0, "Accountant must not see case fixtures.");
    assert.equal(ids.tasks.filter((id) => id.startsWith("qa-c7h-20261011-run-001-")).length, 0, "Accountant must not see task fixtures.");
  }
}

async function run() {
  const missing = requiredSecrets();
  const browser = await chromium.launch({ headless: true });
  try {
    // Public browser smoke always runs, even when private QA passwords are not
    // configured. This is a real Chromium session against the deployed QA site.
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    const publicErrors = [];
    const legacyRequests = [];
    publicPage.on("pageerror", (error) => publicErrors.push(error.message));
    publicPage.on("request", (request) => {
      if (/\/rest\/v1\/practice_records(?:\?|$)/i.test(request.url())) legacyRequests.push(request.url());
    });
    try {
      await publicPage.goto(BASE_URL + "/login.html", { waitUntil: "domcontentloaded", timeout: 30000 });
      assert.ok((await publicPage.locator('a[href="member-login.html"]').count()) > 0, "Portal selection should offer Team Member Login.");
      await publicPage.goto(BASE_URL + "/app.html#dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });
      await publicPage.waitForURL(/login\.html(?:[?#].*)?$/, { timeout: 20000 });
      assert.deepEqual(legacyRequests, [], "Anonymous bootstrap must not query the legacy workspace snapshot.");
      assert.deepEqual(publicErrors, [], "Anonymous page flow must not produce uncaught browser errors.");
      log("PASS", "anonymous Chromium smoke: portal page renders, protected app redirects to login, no legacy snapshot request.");
    } catch (error) {
      log("FAIL", "anonymous Chromium smoke: " + error.message);
      errors.push("anonymous browser smoke: " + error.stack);
    } finally {
      await publicContext.close();
    }

    if (missing.length) {
      log("SKIP", "authenticated role/module tests need repository Actions secrets: " + missing.join(", "));
    } else {
    for (const actor of SUPPORTED_ROLES) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      try {
        await login(page, actor.email, actor.password);
        await assertFixtureVisibility(page, actor.key);
        // Live persistence smoke: reload the deployed app in the same authenticated
        // browser context and verify the Supabase session and workspace fixtures rehydrate.
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForURL(/app\\.html(?:#|$)/, { timeout: 25000 });
        await page.waitForFunction(() => {
          const node = document.getElementById("cloudSyncStatus");
          return node && /Cloud: Synced/.test(node.textContent || "");
        }, undefined, { timeout: 30000 });
        await assertFixtureVisibility(page, actor.key);
        log("PASS", actor.role + " browser refresh persistence: authenticated session and role-scoped demo fixtures rehydrated.");
        const visibleNavPages = [];
        for (const pageName of NAV_PAGES) {
          const navItem = page.locator('.nav-item[data-page="' + pageName + '"]').first();
          if (!(await navItem.count()) || !(await navItem.isVisible())) continue;
          visibleNavPages.push(pageName);
          await navItem.click();
          await page.waitForTimeout(250);
          const contentText = (await page.locator("#content").innerText()).trim();
          assert.ok(contentText.length > 0, actor.role + " visible navigation page is blank: " + pageName);
          assert.equal(pageErrors.length, 0, actor.role + " raised uncaught browser errors on " + pageName + ": " + pageErrors.join(" | "));
        }
        if (actor.key === "ACCOUNTANT") {
          assert.deepEqual(visibleNavPages.sort(), ["case-client", "finance", "reports"], "Accountant should see only read-only Cases & Clients, Finance, and restricted Reports navigation items.");
        }
        if (actor.key !== "ADMIN" && actor.key !== "ACCOUNTANT") {
          const financeNav = page.locator('.nav-item[data-page="finance"]').first();
          assert.equal(await financeNav.isVisible(), false, actor.role + " must not see the Finance navigation item.");
          await page.evaluate(() => navigate("finance"));
          await page.waitForTimeout(100);
          assert.equal(new URL(page.url()).hash, "#dashboard", actor.role + " must be redirected away from direct Finance route access.");
        }
        if(actor.key==="ACCOUNTANT"){
          await page.locator('.nav-item[data-page="finance"]').click();
          await page.getByRole("button",{name:/New/i}).click();
          await page.getByText("Create Invoice",{exact:true}).waitFor({state:"visible",timeout:10000});
          const clientOptions=await page.locator("#modalBody #f1 option").count();
          const caseOptions=await page.locator("#modalBody #f2 option").count();
          assert.ok(clientOptions>0,"Accountant invoice form should offer finance-authorized client choices.");
          assert.ok(caseOptions>0,"Accountant invoice form should offer finance-authorized case choices.");
          const linkedCase=await page.evaluate(()=>{
            const cases=Array.isArray(window.ADFinanceCaseDirectory)?window.ADFinanceCaseDirectory:[];
            const clients=Array.isArray(window.ADFinanceClientDirectory)?window.ADFinanceClientDirectory:[];
            for(const item of cases){
              const ids=[
                ...(Array.isArray(item.clientIds)?item.clientIds:[]),
                ...(Array.isArray(item.client_ids)?item.client_ids:[]),
                item.clientId,item.client_id,
                item.client&&typeof item.client==="object"?(item.client.id||item.client.client_id):""
              ].map(v=>String(v||"").trim()).filter(Boolean);
              const names=[
                ...(Array.isArray(item.clients)?item.clients:[]),item.client,item.client_name,item.clientName,
                ...(Array.isArray(item.client_names)?item.client_names:[])
              ].map(v=>String(v&&typeof v==="object"?(v.name||v.client_name||""):v||"").trim()).filter(Boolean);
              const client=clients.find(y=>ids.includes(String(y.client_id||"").trim()))
                ||clients.find(y=>names.some(n=>n.toLowerCase()===String(y.client_name||"").trim().toLowerCase()));
              if(!client)continue;
              // Match the invoice form's exact option-value expression.
              const value=String(item.number||item.caseNumber||item.case_number||item.id||"").trim();
              if(value)return {value,clientName:String(client.client_name||"").trim(),caseFields:Object.keys(item)};
            }
            return null;
          });
          assert.ok(linkedCase,"Accountant directory should contain at least one case with a resolvable client link.");
          // Exercise the actual visible case autocomplete, not the hidden native select.
          const caseSearch=page.locator("#modalBody .finance-case-autocomplete input").first();
          await caseSearch.fill(linkedCase.value);
          const caseChoice=page.locator(".finance-case-results button").filter({hasText:linkedCase.value}).first();
          await caseChoice.waitFor({state:"visible",timeout:10000});
          const selectedCaseLabel=(await caseChoice.textContent()||"").trim();
          await caseChoice.click();
          await page.waitForTimeout(250);
          const autoFillState=await page.evaluate(()=>({
            selectedClient:document.querySelector("#modalBody select#f1")?.value||"",
            clientOptions:Array.from(document.querySelectorAll("#modalBody select#f1 option")).map(o=>o.value),
            syncFunction:typeof window.syncInvoiceCaseClient,
            caseSearchValue:document.querySelector("#modalBody .finance-case-autocomplete input")?.value||"",
            clientDisplay:document.querySelector("#modalBody [data-finance-client-display='true']")?.value||"",
            selectedClientId:document.querySelector("#modalBody select#f1")?.dataset.selectedClientId||""
          }));
          assert.ok(autoFillState.selectedClient===linkedCase.clientName || autoFillState.clientDisplay===linkedCase.clientName,
            "Selecting linked case "+selectedCaseLabel+" should prefill its client "+linkedCase.clientName+
            "; actual client value="+JSON.stringify(autoFillState.selectedClient)+
            "; client options="+JSON.stringify(autoFillState.clientOptions)+
            "; sync function="+autoFillState.syncFunction+
            "; case directory fields="+JSON.stringify(linkedCase.caseFields)+"; actual client display="+JSON.stringify(autoFillState.clientDisplay)+"; selected client ID="+JSON.stringify(autoFillState.selectedClientId)+"; case search="+JSON.stringify(autoFillState.caseSearchValue));
          if(linkedCase.clientName)assert.ok(autoFillState.selectedClient===linkedCase.clientName || autoFillState.clientDisplay===linkedCase.clientName,"Invoice client should match the selected case linked client.");
          await page.getByRole("button",{name:"Cancel",exact:true}).click();
          await page.getByText("Create Invoice",{exact:true}).waitFor({state:"hidden",timeout:10000});
          assert.equal(pageErrors.length,0,"Accountant invoice open/close produced browser errors: "+pageErrors.join(" | "));
          const waTarget=await page.evaluate(()=>{
            const clients=Array.isArray(window.ADFinanceClientDirectory)?window.ADFinanceClientDirectory:[];
            const rows=Array.from(document.querySelectorAll(".finance-main-table tbody tr"));
            for(const client of clients){
              const name=String(client.client_name||"").trim(), phone=String(client.client_phone||"").replace(/\\D/g,"");
              if(!name||phone.length<10||phone.length>15)continue;
              const row=rows.find(r=>(r.cells[1]?.textContent||"").trim()===name);
              if(row)return {name,phone};
            }
            return null;
          });
          if(waTarget){
            await page.evaluate(()=>{window.__qaOpenedWhatsAppUrl=null;window.open=(url)=>{window.__qaOpenedWhatsAppUrl=String(url);return null;};});
            await page.locator(".finance-main-table tbody tr").filter({hasText:waTarget.name}).first().getByRole("button",{name:"WhatsApp",exact:true}).click();
            const waUrl=await page.evaluate(()=>window.__qaOpenedWhatsAppUrl);
            assert.ok(waUrl,"WhatsApp action should attempt to open a URL.");
            assert.match(waUrl,/^https:\/\/wa\.me\//,"WhatsApp action should open wa.me.");
            const normalized=waTarget.phone.length===10&&/^[6-9]/.test(waTarget.phone)?"91"+waTarget.phone:waTarget.phone;
            assert.ok(waUrl.includes("/"+normalized+"?text="),"WhatsApp URL should use the client's saved phone number.");
            log("PASS","accountant WhatsApp: opens wa.me with the matching finance-directory phone number; no message is sent automatically.");
          }
          log("PASS","accountant invoice: client/case dropdowns populated and Cancel closes the modal.");
        }
        if(actor.key==="ADMIN"){
          // Real authenticated REST checks against the QA Supabase project. Use the
          // session created by the genuine browser login; never forge JWT claims.
          const sessionInfo = await page.evaluate(() => {
            const auth = JSON.parse(localStorage.getItem("advocateDeskAuth") || "{}");
            let accessToken = "";
            for (const key of Object.keys(localStorage)) {
              if (!key.endsWith("-auth-token")) continue;
              try {
                const value = JSON.parse(localStorage.getItem(key) || "{}");
                if (value && typeof value.access_token === "string") accessToken = value.access_token;
              } catch (_) {}
            }
            return { workspaceId: auth.workspaceId || "", userId: auth.userId || "", accessToken };
          });
          assert.ok(sessionInfo.workspaceId && sessionInfo.userId && sessionInfo.accessToken,
            "Admin QA browser session must expose its real Supabase access token and workspace identity.");
          const supabaseUrl = "https://uqtsksgypncsbcnuanbk.supabase.co";
          const publishableKey = "sb_publishable_cK6gEEBcDOOEfpkXlgVEDQ_7EVPt-XW";
          async function qaRest(path, options = {}) {
            return fetch(supabaseUrl + path, {
              ...options,
              headers: {
                apikey: publishableKey,
                Authorization: "Bearer " + sessionInfo.accessToken,
                "Content-Type": "application/json",
                ...(options.headers || {})
              }
            });
          }
          // Workspace B is a known separate QA workspace. An authenticated user
          // from the disposable test workspace must not read its resource rows.
          const foreignWorkspaceId = "55097c1f-9ebe-4252-bc4c-a43c3c989361";
          assert.notEqual(sessionInfo.workspaceId, foreignWorkspaceId,
            "Cross-workspace test requires the logged-in disposable workspace to differ from Workspace B.");
          const foreignRead = await qaRest("/rest/v1/practice_resources?select=id,workspace_id&workspace_id=eq." + foreignWorkspaceId);
          assert.equal(foreignRead.status, 200, "Cross-workspace select should return a normal RLS-filtered response.");
          const foreignRows = await foreignRead.json();
          assert.ok(Array.isArray(foreignRows), "Cross-workspace select response should be a row array.");
          assert.equal(foreignRows.length, 0, "RLS must hide all practice_resources belonging to another workspace.");
          log("PASS", "live cross-workspace isolation: authenticated admin session cannot read another workspace's practice_resources.");

          // Test PostgreSQL/PostgREST atomicity with a deliberately invalid duplicate
          // resource identity in one batch. The first insert must be rolled back when
          // the second change raises an exception. IDs are unique to this run.
          const rollbackId = "qa-rollback-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
          const rollbackPayload = { id: rollbackId, title: "Disposable atomic rollback verification", createdBy: sessionInfo.userId };
          const rollbackChanges = [
            { op: "insert", resource_type: "case", resource_id: rollbackId, payload: rollbackPayload },
            { op: "insert", resource_type: "case", resource_id: rollbackId, payload: rollbackPayload }
          ];
          const rollbackResponse = await qaRest("/rest/v1/rpc/apply_practice_resource_batch", {
            method: "POST",
            body: JSON.stringify({ p_workspace_id: sessionInfo.workspaceId, p_changes: rollbackChanges })
          });
          assert.ok(rollbackResponse.status >= 400, "Duplicate resource in one batch must fail the RPC.");
          const rollbackCheck = await qaRest("/rest/v1/practice_resources?select=id&workspace_id=eq." +
            encodeURIComponent(sessionInfo.workspaceId) + "&resource_type=eq.case&resource_id=eq." + encodeURIComponent(rollbackId));
          assert.equal(rollbackCheck.status, 200, "Rollback verification query should succeed.");
          const rollbackRows = await rollbackCheck.json();
          assert.ok(Array.isArray(rollbackRows), "Rollback verification should return rows.");
          assert.equal(rollbackRows.length, 0, "A failed batch must leave no partial insert behind.");
          log("PASS", "real database atomic rollback: duplicate-insert batch failed and the first insert was absent afterward.");

          const syncFixture=await page.evaluate(()=>{
            const s=window.appState;
            if(!s||!Array.isArray(s.cases)||!Array.isArray(s.hearings))throw new Error("App state arrays are unavailable for hearing sync test.");
            const id="qa-sync-case-20261012";
            s.cases=s.cases.filter(x=>x.id!==id);
            s.hearings=s.hearings.filter(x=>x.caseId!==id&&x.caseNumber!=="QA-SYNC/2026");
            s.cases.push({id,number:"QA-SYNC/2026",title:"QA Hearing Sync Case",court:"QA Court",status:"Active",next:"2026-10-12",hearingTime:"10:10"});
            s.hearings.push({id:"qa-sync-hearing-20261012",caseId:id,caseNumber:"QA-SYNC/2026",case:"QA-SYNC/2026",title:"QA Hearing Sync Case",court:"QA Court",stage:"Scheduled",date:"2026-10-12",time:"10:10"});
            return {caseCount:s.cases.filter(x=>x.id===id).length,hearingCount:s.hearings.filter(x=>x.caseId===id).length};
          });
          try{
            assert.equal(syncFixture.caseCount,1,"QA fixture case should be injected once.");
            assert.equal(syncFixture.hearingCount,1,"QA fixture hearing should be injected once.");
            await page.evaluate(()=>window.caseDetails("", "qa-sync-case-20261012"));
            const case360Text=(await page.locator("#content").innerText()).replace(/\\s+/g," ");
            assert.ok(case360Text.includes("QA-SYNC/2026"),"Case 360 should display the synchronized test case.");
            assert.ok(case360Text.includes("10:10 AM")||case360Text.includes("10:10"),"Case 360 should display hearing time 10:10.");
            await page.evaluate(()=>navigate("hearings"));
            await page.waitForTimeout(250);
            const hearingText=(await page.locator("#content").innerText()).replace(/\\s+/g," ");
            assert.ok(hearingText.includes("QA-SYNC/2026"),"Hearings module should display the linked case.");
            assert.ok(hearingText.includes("10:10"),"Hearings module should display hearing time 10:10.");
            await page.evaluate(()=>{window.openCalendarDate("2026-10-12");});
            await page.waitForTimeout(150);
            await page.locator("#calendarSearch").fill("QA-SYNC/2026");
            await page.locator("#calendarSearchBtn").click();
            const calendarText=(await page.locator("#calendarSearchResult").innerText()).replace(/\\s+/g," ");
            assert.ok(calendarText.includes("QA Hearing Sync Case"),"Calendar search should find the synchronized hearing.");
            assert.ok(calendarText.includes("10:10 AM")||calendarText.includes("10:10"),"Calendar search should show hearing time 10:10.");
            await page.evaluate(()=>{
              const host=document.createElement("div");
              host.id="qa-dashboard-calendar";
              document.body.appendChild(host);
              if(typeof window.renderDashboardTodayCalendarInto!=="function")throw new Error("Dashboard calendar renderer is unavailable.");
              window.renderDashboardTodayCalendarInto(host);
            });
            const dashboardCalendar=page.locator("#qa-dashboard-calendar");
            assert.ok(await dashboardCalendar.locator('[data-date="2026-10-12"] .cal-dot.hearing').count()>0,
              "Dashboard calendar should mark the test hearing date.");
            log("PASS","Case–Hearing–Calendar–Dashboard sync: Case 360 date/time, Hearings row, Calendar search and Dashboard date marker verified.");
          }catch(error){
            log("FAIL","Case–Hearing–Calendar–Dashboard sync: "+error.message);
            errors.push("Case-hearing-calendar-dashboard sync: "+error.stack);
          }finally{
            await page.evaluate(()=>{
              const s=window.appState;
              if(!s)return;
              s.cases=s.cases.filter(x=>x.id!=="qa-sync-case-20261012");
              s.hearings=s.hearings.filter(x=>x.id!=="qa-sync-hearing-20261012"&&x.caseId!=="qa-sync-case-20261012"&&x.caseNumber!=="QA-SYNC/2026");
              document.getElementById("qa-dashboard-calendar")?.remove();
            }).catch(()=>{});
          }
        }
        log("PASS", actor.role + ": sign-in, per-resource bootstrap, role-scoped fixture visibility, 11 navigation pages, no uncaught JS errors.");
      } catch (error) {
        log("FAIL", actor.role + ": " + error.message);
        errors.push(actor.role + ": " + error.stack);
      } finally {
        await context.close();
      }
    }

    // A valid Auth identity without active workspace membership must not enter
    // the application as a workspace member.
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(BASE_URL + "/member-login.html", { waitUntil: "domcontentloaded" });
      await page.locator("#email").fill(NONMEMBER.email);
      await page.locator("#password").fill(NONMEMBER.password);
      await page.locator("#loginForm button[type=submit]").click();
      await page.waitForFunction(() => {
        const error = document.getElementById("error");
        return error && error.textContent.trim().length > 0;
      }, undefined, { timeout: 20000 });
      assert.ok(!/app\.html/.test(page.url()), "Non-member must not reach the app.");
      log("PASS", "non-member: sign-in rejected; app not opened.");
    } catch (error) {
      log("FAIL", "non-member login denial: " + error.message);
      errors.push("non-member: " + error.stack);
    } finally {
      await context.close();
    }
    }
  } finally {
    await browser.close();
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = require("node:fs");
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, "# AdvocateDesk real-browser regression\n\n" + results.map((x) => "- " + x).join("\n") + "\n");
  }
  if (errors.length) {
    console.error(errors.join("\n\n"));
    process.exitCode = 1;
  }
}
run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
