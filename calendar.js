/* AdvocateDesk Calendar — consolidated module
   Consolidates the active calendar-fix-v2 implementation.
   Keeps Dashboard "Today's Calendar" and full Calendar module in one file.
   No other application modules are modified.
*/
(function () {
  'use strict';

  const pad = n => String(n).padStart(2, '0');
  function displayTime(value){
    const s = String(value || '').trim();
    const m = s.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
    if(!m) return s;
    let h = Number(m[1]); const min = m[2];
    const ap = m[3] ? m[3].toUpperCase() : (h >= 12 ? 'PM' : 'AM');
    if(h > 12) h -= 12;
    if(h === 0) h = 12;
    return h + ':' + min + ' ' + ap;
  }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  function readData() {
    try {
      return JSON.parse(localStorage.getItem('advocateDeskData') || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  let selectedDate = null;
  let selectedRecordKey = null;

  function records() {
    const d = readData();
    const clients = Array.isArray(d.clients) ? d.clients : [];
    const clientName = id => (clients.find(c => String(c.id) === String(id)) || {}).name || '';
    const out = [];

    (Array.isArray(d.hearings) ? d.hearings : []).forEach((h, i) => out.push({
      ...h, date:h.date, time:h.time || '', title:h.title || 'Court Hearing',
      caseNo:h.case || '', court:h.court || '', stage:h.stage || '',
      clientName:clientName(h.clientId), kind:'hearing',
      key:'hearing-' + i, purpose:h.stage || 'Hearing'
    }));

    (Array.isArray(d.tasks) ? d.tasks : []).forEach((t, i) => out.push({
      ...t, date:t.due || t.date, time:t.time || '', title:t.title || 'Task',
      caseNo:t.case || '', court:'', stage:t.status || '', kind:'task',
      key:'task-' + i, purpose:'Task'
    }));

    (Array.isArray(d.meetings) ? d.meetings : []).forEach((m, i) => out.push({
      ...m, date:m.date, time:m.time || '', title:m.subject || 'Client Meeting',
      caseNo:'', court:m.location || '', stage:m.mode || '',
      clientName:clientName(m.clientId), kind:'meeting',
      key:'meeting-' + i, purpose:'Client meeting'
    }));

    return out.filter(x => x.date);
  }

  function detailRows(e) {
    const rows = [
      ['Type', e.kind === 'hearing' ? 'Court Hearing' : e.kind === 'task' ? 'Task' : 'Client Meeting'],
      ['Date', e.date]
    ];
    if (e.time) rows.push(['Time', displayTime(e.time)]);

    if (e.kind === 'hearing') {
      rows.push(['Case Number', e.caseNo], ['Case Title', e.title],
        ['Client', e.clientName], ['Court', e.court], ['Stage / Purpose', e.stage]);
    }
    if (e.kind === 'task') {
      rows.push(['Task Subject', e.title], ['Case', e.caseNo],
        ['Due Date', e.date], ['Priority', e.priority], ['Status', e.status || e.stage]);
    }
    if (e.kind === 'meeting') {
      rows.push(['Client', e.clientName], ['Meeting Subject', e.title],
        ['Mode', e.mode || e.stage], ['Location / Link', e.location || e.court],
        ['Agenda', e.agenda], ['Details', e.details]);
    }

    return rows
      .filter(r => r[1] !== undefined && r[1] !== null && String(r[1]) !== '')
      .map(r => '<div class="calendar-detail-row"><b>' + esc(r[0]) +
        '</b><span>' + esc(r[1]) + '</span></div>').join('');
  }

  function render(target) {
    const content = target || document.getElementById('content');
    if (!content) return;

    const root = content;
    const now = new Date();

    if (!Number.isInteger(window.calendarYear)) window.calendarYear = now.getFullYear();
    if (!Number.isInteger(window.calendarMonth)) window.calendarMonth = now.getMonth();

    const year = window.calendarYear;
    const month = window.calendarMonth;
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const start = (first.getDay() + 6) % 7;

    const all = records();
    const by = {};
    all.forEach(e => (by[e.date] || (by[e.date] = [])).push(e));

    if (!selectedDate || !selectedDate.startsWith(year + '-' + pad(month + 1))) {
      const safeDay = Math.min(now.getDate(), days);
      selectedDate = year + '-' + pad(month + 1) + '-' + pad(safeDay);
    }

    const selected = by[selectedDate] || [];
    if (!selected.some(e => e.key === selectedRecordKey)) {
      selectedRecordKey = selected[0]?.key || null;
    }

    const chosen = selected.find(e => e.key === selectedRecordKey) || null;

    let cells = '';
    for (let i = 0; i < start; i++) {
      cells += '<button class="court-cal-cell muted-cell" disabled></button>';
    }

    const todayKey = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

    for (let day = 1; day <= days; day++) {
      const key = year + '-' + pad(month + 1) + '-' + pad(day);
      const list = by[key] || [];
      const isToday = key === todayKey;
      const active = key === selectedDate;

      cells += '<button class="court-cal-cell ' +
        (isToday ? 'today ' : '') + (active ? 'selected ' : '') +
        '" data-date="' + key + '"><span class="cal-number">' + day + '</span>' +
        (list.length ? '<span class="cal-count">' + list.length + '</span>' : '') +
        list.slice(0, 3).map(e => '<span class="cal-dot ' + e.kind + '"></span>').join('') +
        '</button>';
    }

    const leftItems = selected.length
      ? selected.map(e => {
          const label = e.kind === 'hearing' ? e.court :
            e.kind === 'task' ? e.title : 'Meeting with ' + (e.clientName || 'Client');

          return '<button class="calendar-record-link ' + e.kind +
            (e.key === selectedRecordKey ? ' active' : '') + '" data-record="' + esc(e.key) + '">' +
            '<span class="record-link-kind">' +
            (e.kind === 'hearing' ? 'COURT' : e.kind === 'task' ? 'TASK' : 'MEETING') +
            '</span><strong>' + esc(label || '—') + '</strong>' +
            (e.kind === 'hearing'
              ? '<small>' + esc(displayTime(e.time || '')) + ' • ' + esc(e.caseNo) + '</small>'
              : e.kind === 'task'
                ? '<small>' + esc(e.priority || '') + ' • ' + esc(e.status || '') + '</small>'
                : '<small>' + esc(displayTime(e.time || '')) + ' • ' + esc(e.title) + '</small>') +
            '</button>';
        }).join('')
      : '<div class="empty">No records on this date.</div>';

    const chosenDetails = chosen
      ? '<div class="selected-record ' + chosen.kind + '">' +
          '<div class="selected-record-head"><span class="record-type">' +
          esc(chosen.kind === 'hearing' ? 'HEARING' : chosen.kind === 'task' ? 'TASK' : 'MEETING') +
          '</span><strong>' + esc(chosen.title) + '</strong></div>' +
          detailRows(chosen) +
          (chosen.kind === 'hearing'
            ? '<div style="margin-top:16px"><button class="primary" id="calendarEditHearing">Edit Hearing</button></div>'
            : chosen.kind === 'task'
              ? '<div style="margin-top:16px"><button class="primary" id="calendarEditTask">Edit Task</button></div>'
              : '<div style="margin-top:16px"><button class="primary" id="calendarEditMeeting">Edit Client Meeting</button></div>') +
          '</div>'
      : '<div class="empty">Select a court, task subject or client meeting from the left.</div>';

    const selectedLabel = new Date(selectedDate + 'T00:00:00')
      .toLocaleDateString('en-IN', {day:'numeric', month:'long', year:'numeric'});
    const weekday = new Date(selectedDate + 'T00:00:00')
      .toLocaleDateString('en-IN', {weekday:'long'});

    content.innerHTML =
      (target ? '' :
        '<div class="page-title"><div><h1>Calendar</h1>' +
        '<p>Hearings, tasks and client meetings</p></div>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
        '<button class="secondary" onclick="navigate(\'dashboard\')">Back to Dashboard</button>' +
        '<button class="primary" onclick="openModal(\'hearing\')">＋ New Hearing</button>' +
        '</div></div>') +
      '<div class="court-calendar-layout">' +
        '<section class="court-calendar-card">' +
          '<div class="calendar-summary">' +
            '<div class="summary-date">' + esc(selectedLabel) + '</div>' +
            '<div class="summary-total">' + selected.length + ' <span>records on this date</span></div>' +
            '<div class="summary-rule"></div>' +
            '<div class="summary-label">Selected date</div>' +
            '<div class="summary-value">' + esc(weekday) + '</div>' +
            '<div class="summary-rule"></div>' +
            '<div class="summary-label">Courts, tasks & meetings</div>' +
            '<div class="summary-records">' + leftItems + '</div>' +
          '</div>' +
          '<div class="calendar-main">' +
            '<div class="calendar-toolbar">' +
              '<button class="secondary" id="calPrev">‹</button>' +
              '<h2>' + first.toLocaleString('en-IN', {month:'long', year:'numeric'}) + '</h2>' +
              '<button class="secondary" id="calNext">›</button>' +
              '<button class="secondary" id="calToday">Today</button>' +
            '</div>' +
            '<div class="calendar-weekdays">' +
              ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x => '<div>' + x + '</div>').join('') +
            '</div>' +
            '<div class="court-cal-grid">' + cells + '</div>' +
            '<div class="calendar-legend"><span class="legend-hearing">Hearings</span>' +
              '<span class="legend-task">Tasks</span><span class="legend-meeting">Meetings</span></div>' +
          '</div>' +
        '</section>' +
        '<section class="next-cases-card"><h2>Selected date details</h2>' +
          '<div class="selected-details">' + chosenDetails + '</div>' +
        '</section>' +
      '</div>';

    root.querySelector('#calPrev').onclick = () => {
      window.calendarMonth--;
      if (window.calendarMonth < 0) { window.calendarMonth = 11; window.calendarYear--; }
      selectedRecordKey = null;
      render();
    };

    root.querySelector('#calNext').onclick = () => {
      window.calendarMonth++;
      if (window.calendarMonth > 11) { window.calendarMonth = 0; window.calendarYear++; }
      selectedRecordKey = null;
      render();
    };

    root.querySelector('#calToday').onclick = () => {
      const d = new Date();
      window.calendarYear = d.getFullYear();
      window.calendarMonth = d.getMonth();
      selectedDate = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      selectedRecordKey = null;
      render();
    };

    root.querySelectorAll('[data-date]').forEach(b => {
      b.onclick = () => { selectedDate = b.dataset.date; selectedRecordKey = null; render(); };
    });

    root.querySelectorAll('[data-record]').forEach(b => {
      b.onclick = () => { selectedRecordKey = b.dataset.record; render(); };
    });

    const editHearingBtn = root.querySelector('#calendarEditHearing');
    if (editHearingBtn && chosen && chosen.kind === 'hearing') {
      const hearingIndex = Number(String(chosen.key).replace('hearing-', ''));
      editHearingBtn.onclick = () => {
        if (Number.isInteger(hearingIndex) && typeof window.openEditModal === 'function') {
          window.openEditModal('hearing', hearingIndex);
        }
      };
    }

    const editTaskBtn = root.querySelector('#calendarEditTask');
    if (editTaskBtn && chosen && chosen.kind === 'task') {
      const taskIndex = Number(String(chosen.key).replace('task-', ''));
      editTaskBtn.onclick = () => {
        if (Number.isInteger(taskIndex) && typeof window.openEditModal === 'function') {
          window.openEditModal('task', taskIndex);
        }
      };
    }

    const editMeetingBtn = root.querySelector('#calendarEditMeeting');
    if (editMeetingBtn && chosen && chosen.kind === 'meeting') {
      const meetingIndex = Number(String(chosen.key).replace('meeting-', ''));
      editMeetingBtn.onclick = () => {
        if (Number.isInteger(meetingIndex) && typeof window.openEditModal === 'function') {
          window.openEditModal('meeting', meetingIndex);
        }
      };
    }
  }

  window.calendar = () => render();

  window.renderCalendarModuleInto = target => {
    const d = new Date();
    window.calendarYear = d.getFullYear();
    window.calendarMonth = d.getMonth();
    selectedDate = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    selectedRecordKey = null;
    render(target);
  };

  /* Public API used by Dashboard date clicks. It opens the same date in
     the full Calendar module after SPA navigation. */
  window.openCalendarDate = date => {
    const value = String(date || '').slice(0, 10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const d = new Date(value + 'T00:00:00');
    if(Number.isNaN(d.getTime())) return;
    window.calendarYear = d.getFullYear();
    window.calendarMonth = d.getMonth();
    selectedDate = value;
    selectedRecordKey = null;
    render();
  };

  window.calendarPrev = () => {
    window.calendarMonth = (window.calendarMonth ?? new Date().getMonth()) - 1;
    if (window.calendarMonth < 0) { window.calendarMonth = 11; window.calendarYear--; }
    render();
  };

  window.calendarNext = () => {
    window.calendarMonth = (window.calendarMonth ?? new Date().getMonth()) + 1;
    if (window.calendarMonth > 11) { window.calendarMonth = 0; window.calendarYear++; }
    render();
  };

  window.calendarToday = () => {
    const d = new Date();
    window.calendarYear = d.getFullYear();
    window.calendarMonth = d.getMonth();
    selectedDate = null;
    selectedRecordKey = null;
    render();
  };

  /* Dashboard: show the same month-grid calendar used by the Calendar module.
     Dashboard intentionally shows only the calendar grid; event detail panels remain
     available inside the full Calendar module. */
  function renderDashboardTodayCalendarInto(target) {
    if (!target) return;
    if (typeof window.renderCalendarModuleInto !== 'function') return;
    window.renderCalendarModuleInto(target);
    setTimeout(function () {
      try {
        var root = target.querySelector('.court-calendar-layout');
        if (!root) return;
        var summary = root.querySelector('.calendar-summary');
        var details = root.querySelector('.next-cases-card');
        if (summary) summary.remove();
        if (details) details.remove();
        root.style.display = 'block';
        var card = root.querySelector('.court-calendar-card');
        if (card) card.style.width = '100%';
        if (card) card.style.gridTemplateColumns = '1fr';
        var main = root.querySelector('.calendar-main');
        if (main) main.style.width = '100%';

        /* Dashboard date cells open the same date in the full Calendar module. */
        target.querySelectorAll('[data-date]').forEach(function(cell) {
          cell.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var date = cell.getAttribute('data-date');
            if (date) {
              try { window.dashboardCalendarSelectedDate = date; } catch (ignore) {}
              try { location.hash = 'calendar'; } catch (ignore) {}
              if (typeof window.navigate === 'function') window.navigate('calendar');
              try {
                if (typeof window.openCalendarDate === 'function') {
                  window.openCalendarDate(date);
                }
              } catch (ignore) {}
            }
          }, true);
        });
      } catch (e) {}
    }, 0);
  }



  /* Expose the Dashboard renderer to the SPA navigation layer. */
  window.renderDashboardTodayCalendarInto = renderDashboardTodayCalendarInto;

  const dashboardTarget = document.getElementById('dashboard-calendar-module');
  if (dashboardTarget) renderDashboardTodayCalendarInto(dashboardTarget);

  const style = document.createElement('style');
  style.textContent =
    '.court-calendar-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(320px,1fr);gap:20px}' +
    '.court-calendar-card,.next-cases-card{background:var(--card,#fff);border:1px solid var(--border,#e2e8f0);border-radius:18px;overflow:hidden}' +
    '.court-calendar-card{display:grid;grid-template-columns:260px minmax(0,1fr)}' +
    '.calendar-summary{background:linear-gradient(160deg,#93c5fd,#60a5fa);color:#fff;padding:28px}' +
    '.summary-date{font-size:20px;font-weight:800;line-height:1.45}.summary-total{font-size:30px;font-weight:800;margin-top:28px}' +
    '.summary-total span{display:block;font-size:12px;font-weight:600;margin-top:4px}.summary-rule{height:1px;background:rgba(255,255,255,.45);margin:20px 0}' +
    '.summary-label{font-size:12px;opacity:.9}.summary-value{font-size:17px;font-weight:700;margin-top:7px}' +
    '.summary-records{display:flex;flex-direction:column;gap:8px;margin-top:10px}.calendar-record-link{display:block;text-align:left;width:100%;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.13);color:#fff;border-radius:10px;padding:10px;cursor:pointer}' +
    '.calendar-record-link.active{background:#fff;color:#1e3a8a;border-color:#fff}.calendar-record-link strong,.calendar-record-link small,.record-link-kind{display:block}' +
    '.calendar-record-link strong{font-size:12px;line-height:1.4;margin:3px 0}.calendar-record-link small{font-size:10px;opacity:.9}.record-link-kind{font-size:9px;font-weight:800;letter-spacing:.08em}' +
    '.calendar-main{padding:22px}.calendar-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:18px}.calendar-toolbar h2{flex:1;text-align:center;font-size:20px;margin:0}' +
    '.calendar-weekdays,.court-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.calendar-weekdays>div{text-align:center;font-weight:700;color:var(--muted,#64748b);font-size:12px;padding:8px 0}' +
    '.court-cal-cell{position:relative;min-height:66px;border:1px solid var(--border,#e2e8f0);border-radius:9px;background:var(--card,#fff);padding:8px;text-align:left;cursor:pointer}' +
    '.court-cal-cell.selected{background:#dbeafe;border:2px solid #60a5fa}.court-cal-cell.today .cal-number{background:#2563eb;color:#fff;border-radius:50%;width:27px;height:27px;display:grid;place-items:center}' +
    '.muted-cell{opacity:.3;cursor:default}.cal-number{font-weight:700;font-size:13px}.cal-count{position:absolute;right:6px;top:6px;font-size:10px;color:#2563eb}' +
    '.cal-dot{display:inline-block!important;width:7px;height:7px;border-radius:50%;margin:18px 3px 0 0;vertical-align:middle;opacity:1!important}.court-cal-cell .cal-dot.hearing{background:#16a34a!important}.court-cal-cell .cal-dot.task{background:#dc2626!important}.court-cal-cell .cal-dot.meeting{background:#2563eb!important}' +
    '.calendar-legend{display:flex;gap:15px;flex-wrap:wrap;margin-top:17px;font-size:12px}.legend-hearing:before,.legend-task:before,.legend-meeting:before{content:"● "}' +
    '.legend-hearing{color:#16a34a}.legend-task{color:#dc2626}.legend-meeting{color:#2563eb}.next-cases-card{padding:24px}' +
    '.selected-details{display:flex;flex-direction:column;gap:12px}.selected-record{border:1px solid var(--border,#e2e8f0);border-left:4px solid #16a34a;border-radius:12px;padding:14px;background:var(--surface,#f8fafc)}' +
    '.selected-record.task{border-left-color:#dc2626}.selected-record.meeting{border-left-color:#2563eb}.selected-record-head{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}' +
    '.record-type{font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--muted,#64748b)}.selected-record-head strong{font-size:15px;line-height:1.4}' +
    '.calendar-detail-row{display:grid;grid-template-columns:115px minmax(0,1fr);gap:10px;padding:6px 0;border-top:1px solid var(--border,#e2e8f0);font-size:12px;line-height:1.45}' +
    '.calendar-detail-row b{color:var(--muted,#64748b)}.calendar-detail-row span{overflow-wrap:anywhere}.empty{color:var(--muted,#64748b);padding:10px 0}' +
    '.dashboard-today-calendar{background:var(--card,#fff);border:1px solid var(--border,#e2e8f0);border-radius:18px;overflow:hidden}' +
    '.dashboard-today-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 24px;border-bottom:1px solid var(--border,#e2e8f0);background:linear-gradient(135deg,#eff6ff,#fff)}' +
    '.dashboard-today-kicker{font-size:10px;font-weight:800;letter-spacing:.12em;color:#2563eb}.dashboard-today-head h2{margin:4px 0 2px;font-size:20px}' +
    '.dashboard-today-head p{margin:0;color:var(--muted,#64748b);font-size:13px}.dashboard-today-count{padding:16px 24px;border-bottom:1px solid var(--border,#e2e8f0);display:flex;align-items:baseline;gap:8px}' +
    '.dashboard-today-count strong{font-size:28px;color:#2563eb}.dashboard-today-count span{font-size:12px;color:var(--muted,#64748b)}' +
    '.dashboard-today-list{padding:18px 24px;display:grid;gap:14px}.dashboard-today-record{border:1px solid var(--border,#e2e8f0);border-left:4px solid #2563eb;border-radius:12px;padding:16px;background:var(--surface,#f8fafc)}' +
    '.dashboard-today-record.task{border-left-color:#dc2626}.dashboard-today-record.meeting{border-left-color:#2563eb}.dashboard-today-record-head{display:flex;gap:12px;align-items:flex-start}' +
    '.dashboard-today-icon{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:#dbeafe;color:#2563eb;font-size:18px;flex:0 0 auto}' +
    '.dashboard-today-record.task .dashboard-today-icon{background:#fee2e2;color:#dc2626}.dashboard-today-record.meeting .dashboard-today-icon{background:#dbeafe;color:#2563eb}' +
    '.dashboard-today-record h3{margin:3px 0 2px;font-size:15px}.dashboard-today-record p{margin:0;color:var(--muted,#64748b);font-size:12px}.dashboard-today-details{margin-top:12px}.dashboard-today-details .calendar-detail-row{background:transparent}' +
    '@media(max-width:1050px){.court-calendar-card{grid-template-columns:1fr}.calendar-summary{padding:20px}.summary-total{margin-top:15px}}' +
    '@media(max-width:700px){.court-calendar-layout{grid-template-columns:1fr}.calendar-main{padding:12px}.court-cal-cell{min-height:48px;padding:5px}.cal-dot{margin-top:10px}.next-cases-card{padding:16px}.dashboard-today-head{padding:18px;align-items:flex-start;flex-direction:column}.dashboard-today-list{padding:14px}.dashboard-today-count{padding:14px 18px}}';

  document.head.appendChild(style);
})();
