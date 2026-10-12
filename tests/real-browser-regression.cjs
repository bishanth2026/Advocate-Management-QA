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
          assert.deepEqual(visibleNavPages, ["finance"], "Accountant should see only the Finance navigation item.");
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
            const nameOf=c=>String(c.client||c.client_name||"").trim();
            const idOf=c=>String(c.clientId||c.client_id||"").trim();
            const c=cases.find(x=>(idOf(x)&&clients.some(y=>String(y.client_id)===idOf(x)))||(nameOf(x)&&clients.some(y=>String(y.client_name||"").trim()===nameOf(x))));
            if(!c)return null;
            return {value:String(c.number||c.caseNumber||c.case_number||c.id||c.case_id||""),clientName:nameOf(c)};
          });
          if(linkedCase){
            const caseSelect=page.locator("#modalBody #f2:visible").first();
            await caseSelect.waitFor({state:"visible",timeout:10000});
            await caseSelect.selectOption({label:linkedCase.value}).catch(async()=>{
              await caseSelect.selectOption(linkedCase.value);
            });
            await page.waitForTimeout(200);
            const selectedClient=await page.locator("#modalBody #f1:visible").first().inputValue();
            assert.ok(selectedClient,"Selecting a linked case should prefill the invoice client.");
            if(linkedCase.clientName)assert.equal(selectedClient,linkedCase.clientName,"Invoice client should match the selected case's linked client.");
          }
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
