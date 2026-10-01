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
      return window.appState || {};
    } catch (_) {
      return {};
    }
  }

  let selectedDate = null;
  let selectedRecordKey = null;
  let calendarSearch = '';
  let calendarType = 'all';
  let suppressAutoSelect = false;

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

    const allRecords = records();
    const all = allRecords.filter(e => calendarType === 'all' || e.kind === calendarType);
    const by = {};
    all.forEach(e => (by[e.date] || (by[e.date] = [])).push(e));

    if (!selectedDate || !selectedDate.startsWith(year + '-' + pad(month + 1))) {
      const safeDay = Math.min(now.getDate(), days);
      selectedDate = year + '-' + pad(month + 1) + '-' + pad(safeDay);
    }

    const selected = by[selectedDate] || [];
    if (!selected.some(e => e.key === selectedRecordKey) && !suppressAutoSelect) {
      selectedRecordKey = selected[0]?.key || null;
    }
    suppressAutoSelect = false;

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
        '" data-date="' + key + '"><div class="cal-cell-top"><span class="cal-number">' + day + '</span>' +
        (list.length ? '<span class="cal-count">' + list.length + '</span>' : '') +
        '</div><div class="cal-dots">' +
        list.slice(0, 5).map(e => '<span class="cal-dot ' + e.kind + '"></span>').join('') + '</div>' +
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
            ? '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="primary" id="calendarEditHearing">Edit Hearing</button><button class="secondary" id="calendarDeleteRecord" style="border-color:#ef4444;color:#b91c1c">Delete</button></div>'
            : chosen.kind === 'task'
              ? '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="primary" id="calendarEditTask">Edit Task</button><button class="secondary" id="calendarDeleteRecord" style="border-color:#ef4444;color:#b91c1c">Delete</button></div>'
              : '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="primary" id="calendarEditMeeting">Edit Client Meeting</button><button class="secondary" id="calendarDeleteRecord" style="border-color:#ef4444;color:#b91c1c">Delete</button></div>') +
          '</div>'
      : '<div class="empty">Select a court, task subject or client meeting from the left.</div>';

    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcoming = allRecords
      .filter(e => {
        const d = String(e.date || '').slice(0,10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
        const dt = new Date(d + 'T00:00:00');
        const diff = Math.round((dt - todayDate) / 86400000);
        return diff >= 0 && diff <= 7 && (calendarType === 'all' || e.kind === calendarType);
      })
      .sort((a,b) => (String(a.date).localeCompare(String(b.date)) || String(a.time || '').localeCompare(String(b.time || ''))))
      .slice(0, 8);

    const alertPanel = '<div class="calendar-alert-panel" style="margin:0 0 16px;padding:12px 14px;border:1px solid #dbe3ef;border-radius:10px;background:#fff">' +
      '<div style="font-weight:700;margin-bottom:8px">Upcoming — next 7 days</div>' +
      (upcoming.length
        ? upcoming.map(e => {
            const dt = new Date(String(e.date).slice(0,10) + 'T00:00:00');
            const diff = Math.round((dt - todayDate) / 86400000);
            const label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff + ' days';
            const type = e.kind === 'hearing' ? 'Hearing' : e.kind === 'task' ? 'Task' : 'Meeting';
            const formattedDate = dt.toLocaleDateString('en-IN', {day:'numeric', month:'long', year:'numeric'});
            const subject = e.kind === 'meeting'
              ? ((e.clientName ? e.clientName + ' — ' : '') + (e.title || 'Client Meeting'))
              : (e.title || e.court || 'Record');
            return '<button type="button" data-alert-record="' + esc(e.key) + '" data-alert-date="' + esc(String(e.date).slice(0,10)) + '" data-alert-kind="' + esc(e.kind) + '" style="display:block;width:100%;text-align:left;border:0;border-top:1px solid #eef2f7;background:transparent;padding:8px 2px;cursor:pointer">' +
              '<strong>' + esc(label) + '</strong> · ' + esc(formattedDate) + ' · ' + esc(type) + ' · ' + esc(subject) +
              (e.time ? ' · ' + esc(displayTime(e.time)) : '') + '</button>';
          }).join('')
        : '<span style="font-size:13px;opacity:.7">No records due in the next 7 days.</span>') +
      '</div>';

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
      (target ? '' : alertPanel) +
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
            '<div class="calendar-search-bar" style="display:flex;gap:8px;align-items:center;margin:12px 0;flex-wrap:wrap">' +
              '<input id="calendarSearch" type="search" value="' + esc(calendarSearch) + '" placeholder="Search case, client, court, task or meeting..." autocomplete="off" style="flex:1;min-width:0;width:100%">' +
              '<button class="secondary" id="calendarSearchBtn">Find</button>' +
              '<button class="secondary" id="calendarSearchClear">Clear</button>' +
            '</div>' +
            '<div id="calendarSearchResult" style="font-size:13px;margin-bottom:8px"></div>' +
            '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">' +
              '<label for="calendarTypeFilter" style="font-size:13px;font-weight:600">Show:</label>' +
              '<select id="calendarTypeFilter" style="min-width:160px;padding:8px;border:1px solid #dbe3ef;border-radius:6px">' +
                '<option value="all">All records</option>' +
                '<option value="hearing">Hearings</option>' +
                '<option value="task">Tasks</option>' +
                '<option value="meeting">Client meetings</option>' +
              '</select>' +
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

    root.querySelectorAll('[data-alert-record]').forEach(btn => {
      btn.addEventListener('click', function () {
        const key = this.getAttribute('data-alert-record');
        const d = this.getAttribute('data-alert-date');
        const kind = this.getAttribute('data-alert-kind');
        const match = allRecords.find(e => String(e.key) === String(key) && e.kind === kind && String(e.date).slice(0,10) === d);
        if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
        const dt = new Date(d + 'T00:00:00');
        window.calendarYear = dt.getFullYear();
        window.calendarMonth = dt.getMonth();
        selectedDate = d;
        selectedRecordKey = match.key;
        suppressAutoSelect = true;
        render();
        requestAnimationFrame(() => {
          const calendarLayout = root.querySelector('.court-calendar-layout');
          if (calendarLayout) {
            calendarLayout.scrollIntoView({behavior: 'smooth', block: 'start'});
          }
        });
      });
    });

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

    const typeFilter = root.querySelector('#calendarTypeFilter');
    if (typeFilter) { typeFilter.value = calendarType; typeFilter.onchange = () => { calendarType = typeFilter.value || 'all'; selectedRecordKey = null; render(); }; }

    const searchInput = root.querySelector('#calendarSearch');
    const searchBtn = root.querySelector('#calendarSearchBtn');
    const clearBtn = root.querySelector('#calendarSearchClear');
    const searchResult = root.querySelector('#calendarSearchResult');

    const runCalendarSearch = () => {
      calendarSearch = String(searchInput?.value || '').trim();
      if (!calendarSearch) {
        selectedRecordKey = null;
        suppressAutoSelect = true;
        render();
        return;
      }
      const q = calendarSearch.toLowerCase();
      const matches = records().filter(e => (calendarType === 'all' || e.kind === calendarType) && [
        e.title, e.caseNo, e.clientName, e.court, e.stage, e.purpose, e.location, e.subject
      ].some(v => String(v || '').toLowerCase().includes(q)));
      if (!matches.length) {
        searchResult.textContent = 'No matching records found.';
        return;
      }
      const resultBox = document.getElementById('calendarSearchResult');
      if (resultBox) {
        resultBox.innerHTML = matches.map(e => {
          const safeKey = esc(e.key);
          const safeDate = esc(e.date || '');
          const safeTitle = esc(e.title || '');
          const safeTime = esc(displayTime(e.time || ''));
          const safeType = esc(e.kind === 'hearing' ? 'Hearing' : e.kind === 'task' ? 'Task' : 'Client Meeting');
          return '<button type="button" class="calendar-search-result" data-search-record="' + safeKey + '" style="display:block;width:100%;text-align:left;margin:4px 0;padding:7px 9px;border:1px solid #dbe3ef;border-radius:6px;background:#fff;cursor:pointer">' +
            '<strong>' + safeDate + '</strong> — ' + safeTitle + ' <span style="opacity:.7">(' + safeType + (safeTime ? ', ' + safeTime : '') + ')</span></button>';
        }).join('');
      }

      root.querySelectorAll('[data-search-record]').forEach(btn => {
        btn.onclick = () => {
          const match = matches.find(e => e.key === btn.dataset.searchRecord);
          if (!match) return;
          const d = String(match.date || '').slice(0,10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
          const dt = new Date(d + 'T00:00:00');
          window.calendarYear = dt.getFullYear();
          window.calendarMonth = dt.getMonth();
          selectedDate = d;
          selectedRecordKey = match.key;
          suppressAutoSelect = false;
          render();
          const box = document.getElementById('calendarSearchResult');
          if (box) box.innerHTML = '<span>' + matches.length + ' matching record' + (matches.length === 1 ? '' : 's') + '. Selected: ' + esc(match.title || '') + ' on ' + esc(match.date || '') + '.</span>';
        };
      });
    };

    if (searchBtn) searchBtn.onclick = runCalendarSearch;
    if (searchInput) searchInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); runCalendarSearch(); } };
    if (clearBtn) clearBtn.onclick = () => { calendarSearch = ''; selectedRecordKey = null; suppressAutoSelect = true; render(); };

    root.querySelectorAll('[data-date]').forEach(b => {
      b.onclick = () => { selectedDate = b.dataset.date; selectedRecordKey = null; render(); };
    });

    root.querySelectorAll('[data-record]').forEach(b => {
      b.onclick = () => { selectedRecordKey = b.dataset.record; render(); };
    });

    const deleteRecordBtn = root.querySelector('#calendarDeleteRecord');
    if (deleteRecordBtn && chosen) {
      deleteRecordBtn.onclick = () => {
        const typeLabel = chosen.kind === 'hearing' ? 'hearing' : chosen.kind === 'task' ? 'task' : 'client meeting';
        if (!window.confirm('Delete this ' + typeLabel + '?\n\n' + (chosen.title || 'This record') + '\n' + chosen.date + (chosen.time ? ' · ' + displayTime(chosen.time) : '') + '\n\nThis action cannot be undone.')) return;
        const keyParts = String(chosen.key).split('-');
        const collection = chosen.kind === 'hearing' ? 'hearings' : chosen.kind === 'task' ? 'tasks' : 'meetings';
        const index = Number(keyParts[1]);
        const state = window.appState;
        if (!state || !Array.isArray(state[collection]) || !Number.isInteger(index) || !state[collection][index]) return;
        state[collection].splice(index, 1);
        if(typeof window.saveAdvocateDeskState==='function') window.saveAdvocateDeskState();
        selectedRecordKey = null;
        render();
      };
    }

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
    '.court-calendar-layout{scroll-margin-top:84px;display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,.85fr);gap:20px;width:100%;max-width:100%;min-width:0;box-sizing:border-box}' +
    '.court-calendar-card,.next-cases-card{background:var(--card,#fff);border:1px solid var(--border,#e2e8f0);border-radius:18px;overflow:hidden;min-width:0;max-width:100%;box-sizing:border-box}' +
    '.court-calendar-card{display:grid;grid-template-columns:220px minmax(0,1fr)}' +
    '.calendar-summary{background:linear-gradient(160deg,#93c5fd,#60a5fa);color:#fff;padding:28px}' +
    '.summary-date{font-size:20px;font-weight:800;line-height:1.45}.summary-total{font-size:30px;font-weight:800;margin-top:28px}' +
    '.summary-total span{display:block;font-size:12px;font-weight:600;margin-top:4px}.summary-rule{height:1px;background:rgba(255,255,255,.45);margin:20px 0}' +
    '.summary-label{font-size:12px;opacity:.9}.summary-value{font-size:17px;font-weight:700;margin-top:7px}' +
    '.summary-records{display:flex;flex-direction:column;gap:8px;margin-top:10px}.calendar-record-link{display:block;text-align:left;width:100%;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.13);color:#fff;border-radius:10px;padding:10px;cursor:pointer}' +
    '.calendar-record-link.active{background:#fff;color:#1e3a8a;border-color:#fff}.calendar-record-link strong,.calendar-record-link small,.record-link-kind{display:block}' +
    '.calendar-record-link strong{font-size:12px;line-height:1.4;margin:3px 0}.calendar-record-link small{font-size:10px;opacity:.9}.record-link-kind{font-size:9px;font-weight:800;letter-spacing:.08em}' +
    '.calendar-main{padding:20px 18px}.calendar-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:18px}.calendar-toolbar h2{flex:1;text-align:center;font-size:20px;margin:0}' +
    '.calendar-weekdays,.court-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.calendar-weekdays>div{text-align:center;font-weight:700;color:var(--muted,#64748b);font-size:12px;padding:8px 0;min-width:0}' +
    '.court-cal-cell{position:relative;display:block;width:100%;min-width:0;min-height:86px;border:2px solid #dbeafe;border-radius:12px;background:#fff;padding:7px;text-align:left;cursor:pointer;overflow:hidden;transition:transform .15s,box-shadow .15s,border-color .15s}' +
    '.court-cal-cell:hover{transform:translateY(-2px);box-shadow:0 7px 18px rgba(30,64,175,.12);border-color:#6366f1}' +
    '.court-cal-cell.selected{background:linear-gradient(145deg,#dbeafe,#eff6ff);border:2px solid #2563eb;box-shadow:0 5px 14px rgba(37,99,235,.16)}' +
    '.court-cal-cell.today{background:linear-gradient(145deg,#ede9fe,#dbeafe);border:2px solid #8b5cf6;box-shadow:0 5px 16px rgba(124,58,237,.14)}' +
    '.court-cal-cell.today .cal-number{background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;border-radius:50%;width:30px;height:30px;box-shadow:0 3px 8px rgba(37,99,235,.25);margin:0 auto}' +
    '.muted-cell{opacity:.3;cursor:default}.cal-cell-top{display:block;width:100%;min-width:0;min-height:30px}.cal-number{font-weight:800;font-size:13px;color:#172554;display:flex;align-items:center;justify-content:center;width:100%;height:28px;line-height:1}.cal-count{position:absolute!important;top:6px!important;right:6px!important;display:flex!important;align-items:center;justify-content:center;min-width:18px;height:17px;font-size:9px;line-height:1;font-weight:800;color:#fff;background:linear-gradient(135deg,#2563eb,#7c3aed);padding:2px 5px;border-radius:999px;box-shadow:0 2px 6px rgba(37,99,235,.18);white-space:nowrap;z-index:3}' +
    '.cal-dots{display:flex;align-items:center;justify-content:center;gap:4px;min-height:18px;padding-top:2px;width:100%;min-width:0}.cal-dot{display:inline-block!important;width:8px;height:8px;border-radius:50%;margin:0;vertical-align:middle;opacity:1!important;box-shadow:0 1px 4px rgba(15,23,42,.16)}' +
    '.court-cal-cell .cal-dot.hearing{background:#16a34a!important}.court-cal-cell .cal-dot.task{background:#f97316!important}.court-cal-cell .cal-dot.meeting{background:#2563eb!important}' +
    '.court-cal-cell:has(.cal-dot.hearing){background:linear-gradient(145deg,#f0fdf4,#fff);border-color:#86efac}.court-cal-cell:has(.cal-dot.task){background:linear-gradient(145deg,#fff7ed,#fff);border-color:#fdba74}.court-cal-cell:has(.cal-dot.meeting){background:linear-gradient(145deg,#eff6ff,#fff);border-color:#93c5fd}' +
    '.court-cal-cell:has(.cal-dot.hearing):has(.cal-dot.task){background:linear-gradient(145deg,#f0fdf4,#fff7ed)}.court-cal-cell:has(.cal-dot.hearing):has(.cal-dot.meeting){background:linear-gradient(145deg,#f0fdf4,#eff6ff)}.court-cal-cell:has(.cal-dot.task):has(.cal-dot.meeting){background:linear-gradient(145deg,#fff7ed,#eff6ff)}' +
    '.calendar-legend{display:flex;gap:15px;flex-wrap:wrap;margin-top:17px;font-size:12px;font-weight:700}.legend-hearing:before,.legend-task:before,.legend-meeting:before{content:"● "}' +
    '.legend-hearing{color:#16a34a}.legend-task{color:#f97316}.legend-meeting{color:#2563eb}.next-cases-card{padding:24px}' +
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
    '@media(max-width:1000px){.court-calendar-layout{grid-template-columns:minmax(0,1fr)}.court-calendar-card{grid-template-columns:220px minmax(0,1fr)}}@media(max-width:700px){.court-calendar-layout{grid-template-columns:1fr}.court-calendar-card{grid-template-columns:1fr;width:100%;min-width:0}.calendar-summary{width:100%;min-width:0;padding:20px}.summary-total{font-size:26px;margin-top:18px}.summary-records{max-height:none}.calendar-main{width:100%;min-width:0;padding:14px 10px}.calendar-toolbar{margin-bottom:12px}.calendar-search-bar{margin:10px 0!important}.court-cal-grid,.calendar-weekdays{width:100%;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.court-cal-cell{min-height:64px;width:100%;min-width:0;padding:5px}.cal-cell-top{min-height:26px}.cal-number{height:24px}.cal-count{top:4px!important;right:4px!important;font-size:8px;min-width:16px;height:14px;padding:2px 4px}.cal-dots{bottom:6px;gap:3px}.next-cases-card{padding:16px}.dashboard-today-head{padding:18px;align-items:flex-start;flex-direction:column}.dashboard-today-list{padding:14px}.dashboard-today-count{padding:14px 18px}}';

  document.head.appendChild(style);
})();
