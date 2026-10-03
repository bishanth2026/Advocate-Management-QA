/* AdvocateDesk compatibility fixes */
(function () {
  'use strict';
  if (typeof window.esc !== 'function') window.esc = function (v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  function data() {
    try { return window.appState || {}; }
    catch (_) { return {}; }
  }
  function date(v) { if (!v) return null; var d = new Date(String(v).slice(0, 10) + 'T00:00:00'); return isNaN(d.getTime()) ? null : d; }
  function norm(v) { return String(v || '').replace(/[*:\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function control(labelText, root) {
    var scope = root || document, wanted = norm(labelText);
    var labels = Array.from(scope.querySelectorAll('label'));
    var label = labels.find(function (l) { return norm(l.textContent) === wanted || norm(l.textContent).indexOf(wanted) === 0; });
    if (label) {
      var field = label.closest('.field') || label.parentElement;
      var found = field && field.querySelector('input,select,textarea');
      if (found) return found;
      if (label.htmlFor) { found = document.getElementById(label.htmlFor); if (found) return found; }
    }
    var candidates = Array.from(scope.querySelectorAll('input,select,textarea'));
    return candidates.find(function (el) {
      return norm(el.getAttribute('aria-label')) === wanted || norm(el.getAttribute('placeholder')) === wanted;
    }) || null;
  }
  function fillHearingCase(modal, id) {
    var all = data(), list = Array.isArray(all.cases) ? all.cases : [];
    var c = list.find(function (x) { return String(x.id) === String(id) || String(x.number) === String(id); });
    if (!c) return;
    var title = modal.querySelector('#f4') || control('Case Title', modal);
    var clientInput = modal.querySelector('#fClient') || control('Client', modal);
    var court = modal.querySelector('#f5') || control('Court', modal);
    var stage = modal.querySelector('#f6') || control('Stage', modal);
    var clients = Array.isArray(all.clients) ? all.clients : [];
    var ids = Array.isArray(c.clientIds) ? c.clientIds : (c.clientId ? [c.clientId] : []);
    var linked = clients.find(function(x){ return ids.indexOf(x.id) !== -1; });
    if (title) title.value = c.title || '';
    if (clientInput) clientInput.value = linked ? (linked.name || '') : (c.client || '');
    if (court) court.value = c.court || '';
    if (stage) stage.value = c.stage || '';
    var hidden = modal.querySelector('input[name="caseId"]');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'caseId';
      modal.appendChild(hidden);
    }
    hidden.value = c.id || '';
  }
  function enhanceHearing() {
    var modal = Array.from(document.querySelectorAll('.modal,[role="dialog"]')).find(function (m) {
      return (m.offsetWidth || m.offsetHeight || m.getClientRects().length) && /Schedule Hearing|Edit Hearing/i.test(m.textContent || '');
    });
    if (!modal) return;
    /* hearings-case-typeahead.js owns this control. Never create a second
       searchable control on top of it. */
    if (modal.querySelector('.adv-hearing-case-typeahead')) return;
    var select = modal.querySelector('#f3');
    if (select) return;
    return;
  }
  function hidePast() {
    var table = document.getElementById('hearingTable'); if (!table) return;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    table.querySelectorAll('tbody tr').forEach(function (row) {
      var cell = row.querySelector('td'), d = cell && date(cell.textContent.trim());
      if (d) row.style.display = d < today ? 'none' : '';
    });
  }
  function dashboardFix() {
    var content = document.getElementById('content');
    var dashboardNav = document.querySelector('.nav-item[data-page="dashboard"].active');
    /* Finance and other modules also use .cards. Only apply Dashboard greeting fixes
       when Dashboard is actually the active SPA page. */
    if (!dashboardNav || !content || !content.querySelector('.cards')) return;
    var now = new Date(), hour = now.getHours();
    var greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    var session = null;
    try { session = window.ADAuth && typeof window.ADAuth.get === 'function' ? window.ADAuth.get() : null; } catch (_) {}
    /* app.js renders the authoritative greeting and workspace after secure bootstrap.
       Never replace authenticated cloud identity with demo fallback text. */
    if (!session || !session.cloudAuth) {
      var title = content.querySelector('.page-title h1');
      if (title) title.textContent = greeting + ', Advocate';
      var subtitle = content.querySelector('.page-title p');
      if (subtitle) subtitle.textContent = now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) + ' • Demo Workspace';
    }
    var hearings = Array.isArray(data().hearings) ? data().hearings : [], start = new Date(now); start.setHours(0, 0, 0, 0); var end = new Date(start); end.setDate(end.getDate() + 30);
    var count = hearings.filter(function (h) { var d = date(h.date); return d && d >= start && d <= end; }).length;
    var cards = content.querySelectorAll('.stat'), value = cards[1] && cards[1].querySelector('.stat-value');
    if (value) value.textContent = String(count);
  }
  function mobileNav() {
    var sidebar = document.querySelector('.sidebar'), overlay = document.getElementById('mobileOverlay');
    if (!sidebar || !overlay) return;
    sidebar.classList.remove('open'); overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true');
  }
  function run() { enhanceHearing(); hidePast(); dashboardFix(); }
  document.addEventListener('click', function (e) {
    var page = e.target.closest && e.target.closest('[data-page]');
    if (page) { mobileNav(); window.setTimeout(run, 80); }
    window.setTimeout(run, 80);
  }, false);
  document.addEventListener('change', function (e) {
    if (e.target && e.target.closest && e.target.closest('.modal,[role="dialog"]')) window.setTimeout(run, 20);
  }, false);
  window.addEventListener('hashchange', function () { window.setTimeout(run, 80); });
  run();
  // No polling timer: fixes run on relevant navigation/change events only.
  var style = document.createElement('style');
  style.textContent = 'button,a,[role="button"]{-webkit-tap-highlight-color:transparent;touch-action:manipulation}@media(max-width:900px){.sidebar{transition:transform .2s ease}.sidebar.open{transform:translateX(0)}.mobile-overlay{display:none}.mobile-overlay.open{display:block}.adv-hearing-case-option:focus{background:#eef4ff!important}}';
  document.head.appendChild(style);
})();