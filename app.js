/* ============================================================
   Shiva Digital Library — app.js
   Admin: username="admin" password="lib@2025"

   DATA STRUCTURE:
   students[seat] = {
     Morning:  { name, admDate, phone, notes } or null,
     Evening:  { name, admDate, phone, notes } or null,
     Night:    { name, admDate, phone, notes } or null
   }
   ============================================================ */

// ============================================================ DATA LAYER
const DB = {
  STUDENTS_KEY: 'shiva_students',
  FEES_KEY:     'shiva_fees',
  ACTIVITY_KEY: 'shiva_activity',
  ARCHIVE_KEY:  'shiva_archive',

  getStudents() {
    try { return JSON.parse(localStorage.getItem(this.STUDENTS_KEY)) || {}; } catch { return {}; }
  },
  setStudents(data) { localStorage.setItem(this.STUDENTS_KEY, JSON.stringify(data)); },

  getFees() {
    try { return JSON.parse(localStorage.getItem(this.FEES_KEY)) || []; } catch { return []; }
  },
  setFees(data) { localStorage.setItem(this.FEES_KEY, JSON.stringify(data)); },

  getActivity() {
    try { return JSON.parse(localStorage.getItem(this.ACTIVITY_KEY)) || []; } catch { return []; }
  },
  addActivity(icon, text) {
    const acts = this.getActivity();
    acts.unshift({ icon, text, time: new Date().toLocaleString() });
    if (acts.length > 30) acts.pop();
    localStorage.setItem(this.ACTIVITY_KEY, JSON.stringify(acts));
  },

  getArchive() {
    try { return JSON.parse(localStorage.getItem(this.ARCHIVE_KEY)) || []; } catch { return []; }
  },
  setArchive(data) { localStorage.setItem(this.ARCHIVE_KEY, JSON.stringify(data)); },

  getFeesForMonth(seat, shift, month, year) {
    return this.getFees().filter(f =>
      +f.seat === +seat && f.shift === shift &&
      +f.month === +month && +f.year === +year
    );
  },

  getIncome(month, year) {
    return this.getFees()
      .filter(f => (!month || +f.month === +month) && (!year || +f.year === +year))
      .reduce((sum, f) => sum + (+f.amount || 0), 0);
  },

  getOccupiedCount() {
    const s = this.getStudents();
    return Object.keys(s).filter(seat =>
      SHIFTS.some(sh => s[seat] && s[seat][sh])
    ).length;
  },

  newFeeId() { return 'fee_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
};

// ============================================================ CONSTANTS
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const SHIFTS = ['Morning', 'Evening', 'Night'];
const SHIFT_ICON = { 'Morning': '🌅', 'Evening': '🌆', 'Night': '🌙', 'Double Shift': '☀️' };
const SHIFT_FEES = { 'Morning': 500, 'Evening': 500, 'Double Shift': 800, 'Night': 500 };
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'lib@2025';
const TOTAL_SEATS = 42;
const YEARS = (() => {
  const arr = [];
  for (let y = 2023; y <= new Date().getFullYear() + 1; y++) arr.push(y);
  return arr;
})();

let isAdminLoggedIn = false;
let sidebarOpen = false;

// ============================================================ INIT
document.addEventListener('DOMContentLoaded', () => {
  initYearDropdowns();
  renderSeatGrid();
  updateNavStats();
  setCurrentDate();
  const today = new Date().toISOString().split('T')[0];
  const d1 = document.getElementById('f-admDate');
  const d2 = document.getElementById('ff-paidDate');
  if (d1) d1.value = today;
  if (d2) d2.value = today;
});

function initYearDropdowns() {
  const ids = ['searchYear', 'ff-year', 'inc-year', 'feeFilterYear',
    'seatGridYear', 'admin-seatGridYear', 'dash-chart-year'];
  const curYear = new Date().getFullYear();
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const hasAll = ['searchYear', 'feeFilterYear'].includes(id);
    el.innerHTML = hasAll ? '<option value="">All Years</option>' : '';
    YEARS.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      if (y === curYear) opt.selected = true;
      el.appendChild(opt);
    });
  });
}

function setCurrentDate() {
  const el = document.getElementById('currentDate');
  if (el) el.textContent = new Date().toLocaleDateString('en-IN',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ============================================================ THEME
document.getElementById('themeToggle').addEventListener('click', () => {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';
});

// ============================================================ TOAST
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ============================================================ NAV STATS
function updateNavStats() {
  const occupied = DB.getOccupiedCount();
  document.getElementById('nav-occupied').textContent = occupied;
  document.getElementById('nav-empty').textContent = TOTAL_SEATS - occupied;
  document.getElementById('nav-total').textContent = TOTAL_SEATS;
}

function scrollToSeats() {
  document.getElementById('seatsSection').scrollIntoView({ behavior: 'smooth' });
}

// ============================================================ BUILD SEAT CARD HTML
function buildSeatCard(seatNum, seatData, month, year) {
  const hasAny = seatData && SHIFTS.some(sh => seatData[sh]);
  if (!hasAny) {
    return {
      cls: 'empty',
      html: '<span class="seat-num">' + String(seatNum).padStart(2,'0') + '</span>' +
        '<div class="shift-rows">' +
        '<div class="shift-row sr-empty"><span>🌅</span><span class="sr-name">empty</span></div>' +
        '<div class="shift-row sr-empty"><span>🌆</span><span class="sr-name">empty</span></div>' +
        '<div class="shift-row sr-empty"><span>🌙</span><span class="sr-name">empty</span></div>' +
        '</div>'
    };
  }

  let shiftHtml = '';
  let anyPaid = false, anyPending = false;
  SHIFTS.forEach(sh => {
    const student = seatData[sh];
    if (!student) {
      shiftHtml += '<div class="shift-row sr-empty"><span>' + SHIFT_ICON[sh] + '</span><span class="sr-name">empty</span></div>';
    } else {
      const paid = DB.getFeesForMonth(seatNum, sh, month, year).length > 0;
      if (paid) anyPaid = true; else anyPending = true;
      const firstName = student.name.split(' ')[0];
      shiftHtml += '<div class="shift-row ' + (paid ? 'sr-paid' : 'sr-pending') + '">' +
        '<span>' + SHIFT_ICON[sh] + '</span>' +
        '<span class="sr-name">' + firstName + '</span>' +
        '<span class="sr-status">' + (paid ? '✓' : '!') + '</span>' +
        '</div>';
    }
  });

  const cls = (anyPaid && !anyPending) ? 'paid' : (!anyPaid && anyPending) ? 'pending' : 'mixed';
  return {
    cls,
    html: '<span class="seat-num">' + String(seatNum).padStart(2,'0') + '</span>' +
      '<div class="shift-rows">' + shiftHtml + '</div>'
  };
}

// ============================================================ PUBLIC SEAT GRID
function renderSeatGrid() {
  const grid = document.getElementById('seatGrid');
  if (!grid) return;
  const month = +document.getElementById('seatGridMonth').value || (new Date().getMonth() + 1);
  const year  = +document.getElementById('seatGridYear').value  || new Date().getFullYear();
  const students = DB.getStudents();
  grid.innerHTML = '';

  for (let s = 1; s <= TOTAL_SEATS; s++) {
    const card = buildSeatCard(s, students[s], month, year);
    const btn = document.createElement('button');
    btn.className = 'seat-btn seat-btn-new ' + card.cls;
    btn.innerHTML = card.html;
    btn.addEventListener('click', () => openSeatModal(s, month, year));
    grid.appendChild(btn);
  }
}

// ============================================================ SEAT MODAL (PUBLIC)
function openSeatModal(seatNum, month, year) {
  const students = DB.getStudents();
  const seatData = students[seatNum];
  const modal = document.getElementById('seatModal');
  document.getElementById('modalSeatNum').textContent = 'S-' + String(seatNum).padStart(2,'0');

  const hasAny = seatData && SHIFTS.some(sh => seatData[sh]);

  if (!hasAny) {
    document.getElementById('modalStudentName').textContent = 'empty Seat';
    document.getElementById('modalStudentShift').textContent = 'Koi student nahi';
    document.getElementById('modalBody').innerHTML = '<div class="no-data">Yeh seat abhi available hai.</div>';
  } else {
    const firstShift = SHIFTS.find(sh => seatData[sh]);
    document.getElementById('modalStudentName').textContent = seatData[firstShift].name;
    document.getElementById('modalStudentShift').textContent = 'Seat ' + seatNum;

    let html = '';
    SHIFTS.forEach(sh => {
      const student = seatData[sh];
      html += '<div class="modal-shift-block">';
      html += '<div class="modal-shift-header">';
      html += '<span>' + SHIFT_ICON[sh] + ' ' + sh + '</span>';
      if (student) {
        html += '<span class="badge badge-' + sh.toLowerCase() + '">' + student.name + '</span>';
      } else {
        html += '<span style="color:var(--text-muted);font-size:.75rem">empty</span>';
      }
      html += '</div>';
      if (student) {
        const fees = DB.getFees()
          .filter(f => +f.seat === +seatNum && f.shift === sh)
          .sort((a, b) => b.year - a.year || b.month - a.month);
        if (fees.length) {
          fees.forEach(f => {
            html += '<div class="fee-row">' +
              '<div class="fee-row-left"><strong>' + MONTHS[f.month] + ' ' + f.year + '</strong><br>' +
              '<small style="color:var(--text-muted)">Paid: ' + f.paidDate + '</small></div>' +
              '<div class="fee-row-right">₹' + f.amount + '</div>' +
              '</div>';
          });
        } else {
          html += '<div class="no-data" style="padding:.5rem">Koi fee record nahi</div>';
        }
      }
      html += '</div>';
    });
    document.getElementById('modalBody').innerHTML = html;
  }
  modal.classList.add('active');
}

function closeSeatModal(e) {
  if (e.target === document.getElementById('seatModal'))
    document.getElementById('seatModal').classList.remove('active');
}

// ============================================================ PUBLIC SEARCH
function searchStudent() {
  const seat = document.getElementById('searchSeat').value.trim();
  const year = document.getElementById('searchYear').value;
  if (!seat && !year) { showToast('Seat number ya year select karo', 'error'); return; }

  const students = DB.getStudents();
  const fees = DB.getFees();
  let rows = [];
  fees.forEach(f => {
    const seatData = students[f.seat];
    if (!seatData) return;
    const student = seatData[f.shift];
    if (!student) return;
    if (seat && +f.seat !== +seat) return;
    if (year && +f.year !== +year) return;
    rows.push({ seat: f.seat, name: student.name, admDate: student.admDate, shift: f.shift, month: f.month, year: f.year, amount: f.amount, paidDate: f.paidDate });
  });
  rows.sort((a, b) => b.year - a.year || b.month - a.month || a.seat - b.seat);
  renderResultsTable(rows);
  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

function searchAll() {
  const students = DB.getStudents();
  const fees = DB.getFees();
  const rows = [];
  fees.forEach(f => {
    const seatData = students[f.seat];
    if (!seatData) return;
    const student = seatData[f.shift];
    if (!student) return;
    rows.push({ seat: f.seat, name: student.name, admDate: student.admDate, shift: f.shift, month: f.month, year: f.year, amount: f.amount, paidDate: f.paidDate });
  });
  rows.sort((a, b) => b.year - a.year || b.month - a.month || a.seat - b.seat);
  renderResultsTable(rows);
  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

function renderResultsTable(rows) {
  const body = document.getElementById('resultsBody');
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8" class="no-data">Koi record nahi mila.</td></tr>';
    return;
  }
  body.innerHTML = rows.map(r =>
    '<tr>' +
    '<td><span style="font-family:\'JetBrains Mono\',monospace;font-weight:700;color:var(--accent)">S-' + String(r.seat).padStart(2,'0') + '</span></td>' +
    '<td>' + r.name + '</td>' +
    '<td>' + (r.admDate || '—') + '</td>' +
    '<td><span class="badge badge-' + r.shift.toLowerCase().replace(' ','-') + '">' + (SHIFT_ICON[r.shift]||'') + ' ' + r.shift + '</span></td>' +
    '<td>' + MONTHS[r.month] + '</td>' +
    '<td>' + r.year + '</td>' +
    '<td style="font-family:\'JetBrains Mono\',monospace;color:var(--green)">₹' + r.amount + '</td>' +
    '<td>' + (r.paidDate || '—') + '</td>' +
    '</tr>'
  ).join('');
}

function closeResults() {
  document.getElementById('resultsSection').style.display = 'none';
}

// ============================================================ ADMIN AUTH
document.getElementById('adminLoginBtn').addEventListener('click', () => {
  if (isAdminLoggedIn) { showAdminPanel(); return; }
  document.getElementById('loginModal').classList.add('active');
  setTimeout(() => document.getElementById('loginUser').focus(), 100);
});

function adminLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    isAdminLoggedIn = true;
    document.getElementById('loginModal').classList.remove('active');
    showAdminPanel();
    showToast('Welcome back, Admin! 👋');
  } else {
    document.getElementById('loginError').textContent = '⚠️ Galat username ya password';
    document.getElementById('loginPass').value = '';
    setTimeout(() => document.getElementById('loginError').textContent = '', 3000);
  }
}

document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
document.getElementById('loginUser').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });

function closeLoginModal(e) {
  if (e.target === document.getElementById('loginModal'))
    document.getElementById('loginModal').classList.remove('active');
}

function adminLogout() {
  isAdminLoggedIn = false;
  document.getElementById('adminDashboard').style.display = 'none';
  document.body.style.overflow = '';
  showToast('Logout ho gaye.', 'info');
}

function showAdminPanel() {
  document.getElementById('adminDashboard').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  populateFeeSeats();
  initYearDropdowns();
  refreshDashboard();
  renderStudentsTable();
  renderFeeTable();
  renderAdminSeatGrid();
  renderIncomeChart();
  renderActivityList();
}

// ============================================================ SIDEBAR
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  sidebarOpen = !sidebarOpen;
  sb.classList.toggle('open', sidebarOpen);
}

// ============================================================ ADMIN TABS
function showAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('adminTab-' + tabName).classList.add('active');
  document.getElementById('tab-' + tabName).classList.add('active');
  const titles = { dashboard:'Dashboard', students:'All Students', addStudent:'Add / Edit Student', fees:'Fee Management', income:'Income Report', seats:'Seat Grid' };
  document.getElementById('topbarTitle').textContent = titles[tabName] || tabName;
  if (tabName === 'dashboard') { refreshDashboard(); renderIncomeChart(); renderActivityList(); }
  if (tabName === 'students') renderStudentsTable();
  if (tabName === 'fees') { renderFeeTable(); populateFeeSeats(); }
  if (tabName === 'seats') renderAdminSeatGrid();
  if (window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); sidebarOpen = false; }
}

// ============================================================ DASHBOARD
function refreshDashboard() {
  const occupied = DB.getOccupiedCount();
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  const monthlyInc = DB.getIncome(curMonth, curYear);
  const yearlyInc = DB.getIncome('', curYear);

  const students = DB.getStudents();
  let pending = 0;
  Object.keys(students).forEach(seat => {
    SHIFTS.forEach(sh => {
      if (students[seat] && students[seat][sh]) {
        const hasFee = DB.getFees().some(f => +f.seat === +seat && f.shift === sh && +f.month === curMonth && +f.year === curYear);
        if (!hasFee) pending++;
      }
    });
  });

  document.getElementById('dash-total').textContent = TOTAL_SEATS;
  document.getElementById('dash-occupied').textContent = occupied;
  document.getElementById('dash-empty').textContent = TOTAL_SEATS - occupied;
  document.getElementById('dash-monthly').textContent = '₹' + monthlyInc.toLocaleString();
  document.getElementById('dash-yearly').textContent = '₹' + yearlyInc.toLocaleString();
  document.getElementById('dash-pending').textContent = pending;
  updateNavStats();
  renderMiniSeatGrid();
}

// ============================================================ MINI SEAT GRID
function renderMiniSeatGrid() {
  const grid = document.getElementById('miniSeatGrid');
  if (!grid) return;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const students = DB.getStudents();
  grid.innerHTML = '';
  for (let s = 1; s <= TOTAL_SEATS; s++) {
    const seatData = students[s];
    const div = document.createElement('div');
    div.className = 'mini-seat';
    div.textContent = s;
    const hasAny = seatData && SHIFTS.some(sh => seatData[sh]);
    if (!hasAny) {
      div.classList.add('empty');
      div.title = 'Seat ' + s + ': empty';
    } else {
      const allPaid = SHIFTS.every(sh => !seatData[sh] || DB.getFeesForMonth(s, sh, month, year).length > 0);
      const anyPaid = SHIFTS.some(sh => seatData[sh] && DB.getFeesForMonth(s, sh, month, year).length > 0);
      div.classList.add(allPaid ? 'paid' : anyPaid ? 'mixed' : 'pending');
      const names = SHIFTS.filter(sh => seatData[sh]).map(sh => seatData[sh].name.split(' ')[0]).join(', ');
      div.title = 'Seat ' + s + ': ' + names;
    }
    div.onclick = () => openAdminSeatClick(s);
    grid.appendChild(div);
  }
}

function openAdminSeatClick(seatNum) {
  showAdminTab('fees');
  document.getElementById('ff-seat').value = seatNum;
  autoFillFeeForm();
}

// ============================================================ INCOME CHART
function renderIncomeChart() {
  const chart = document.getElementById('incomeChart');
  if (!chart) return;
  const yearEl = document.getElementById('dash-chart-year');
  const year = yearEl ? +yearEl.value : new Date().getFullYear();
  const maxInc = Math.max.apply(null, MONTHS.slice(1).map(function(_, i) { return DB.getIncome(i + 1, year); }).concat([1]));
  chart.innerHTML = '';
  MONTHS.slice(1).forEach((m, i) => {
    const inc = DB.getIncome(i + 1, year);
    const pct = Math.max((inc / maxInc) * 100, 3);
    const wrap = document.createElement('div');
    wrap.className = 'chart-bar-wrap';
    wrap.innerHTML = '<div class="chart-bar" style="height:' + pct + '%" data-val="₹' + inc.toLocaleString() + '" title="' + m + ': ₹' + inc.toLocaleString() + '"></div><div class="chart-label">' + m.slice(0,3) + '</div>';
    chart.appendChild(wrap);
  });
}

// ============================================================ ACTIVITY LIST
function renderActivityList() {
  const el = document.getElementById('activityList');
  if (!el) return;
  const acts = DB.getActivity();
  if (!acts.length) { el.innerHTML = '<div class="no-data">Koi activity nahi.</div>'; return; }
  el.innerHTML = acts.slice(0, 10).map(a =>
    '<div class="activity-item">' +
    '<span class="activity-icon">' + a.icon + '</span>' +
    '<span class="activity-text">' + a.text + '</span>' +
    '<span class="activity-time">' + a.time + '</span>' +
    '</div>'
  ).join('');
}

// ============================================================ STUDENTS TABLE
function renderStudentsTable() {
  const body = document.getElementById('studentsBody');
  const search = (document.getElementById('studentSearch') || {}).value || '';
  const shiftFilter = (document.getElementById('filterShift') || {}).value || '';
  const students = DB.getStudents();

  let rows = [];
  Object.entries(students).forEach(([seat, seatData]) => {
    SHIFTS.forEach(sh => {
      const s = seatData && seatData[sh];
      if (!s) return;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !seat.includes(search)) return;
      if (shiftFilter && sh !== shiftFilter) return;
      rows.push({ seat: +seat, shift: sh, name: s.name, admDate: s.admDate, phone: s.phone });
    });
  });
  rows.sort((a, b) => a.seat - b.seat);

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">👥</div><p>Koi student nahi mila.</p></div></td></tr>';
    return;
  }
  body.innerHTML = rows.map(r =>
    '<tr>' +
    '<td><span style="font-family:\'JetBrains Mono\',monospace;font-weight:700;color:var(--accent)">S-' + String(r.seat).padStart(2,'0') + '</span></td>' +
    '<td>' + r.name + (r.phone ? '<br><small style="color:var(--text-muted)">' + r.phone + '</small>' : '') + '</td>' +
    '<td>' + (r.admDate || '—') + '</td>' +
    '<td><span class="badge badge-' + r.shift.toLowerCase().replace(' ','-') + '">' + (SHIFT_ICON[r.shift]||'') + ' ' + r.shift + '</span></td>' +
    '<td>' +
    '<button class="btn-icon btn-edit" onclick="editStudent(' + r.seat + ',\'' + r.shift + '\')" title="Edit">✏️</button> ' +
    '<button class="btn-icon btn-del" onclick="confirmDeleteStudent(' + r.seat + ',\'' + r.shift + '\')" title="Delete">🗑️</button>' +
    '</td>' +
    '</tr>'
  ).join('');
}

function filterStudents() { renderStudentsTable(); }

// ============================================================ ADD/EDIT STUDENT
function saveStudent() {
  const seat     = +document.getElementById('f-seat').value;
  const name     = document.getElementById('f-name').value.trim();
  const admDate  = document.getElementById('f-admDate').value;
  const shift    = document.getElementById('f-shift').value;
  const phone    = document.getElementById('f-phone').value.trim();
  const notes    = document.getElementById('f-notes').value.trim();
  const editSeat  = document.getElementById('f-editSeat').value;
  const editShift = document.getElementById('f-editShift').value;
  const msgEl    = document.getElementById('studentFormMsg');

  if (!seat || seat < 1 || seat > 42) { showFormMsg(msgEl, '⚠️ Seat number 1–42 hona chahiye', 'error'); return; }
  if (!name) { showFormMsg(msgEl, '⚠️ Naam zaruri hai', 'error'); return; }
  if (!admDate) { showFormMsg(msgEl, '⚠️ Admission date zaruri hai', 'error'); return; }
  if (!shift) { showFormMsg(msgEl, '⚠️ Shift select karo', 'error'); return; }

  const students = DB.getStudents();
  const isEdit = !!(editSeat && editShift);

  // Conflict check: kya same seat+shift pe already koi hai
  const existingInSlot = students[seat] && students[seat][shift];
  const editingSameSlot = isEdit && +editSeat === seat && editShift === shift;

  if (existingInSlot && !editingSameSlot) {
    showFormMsg(msgEl, '⚠️ Seat ' + seat + ' ki ' + shift + ' shift mein pehle se ' + existingInSlot.name + ' hain!', 'error');
    return;
  }

  // Remove old slot if editing and slot changed
  if (isEdit && (+editSeat !== seat || editShift !== shift)) {
    if (students[editSeat]) {
      delete students[editSeat][editShift];
      if (Object.keys(students[editSeat]).length === 0) delete students[editSeat];
    }
  }

  if (!students[seat]) students[seat] = {};
  students[seat][shift] = { name, admDate, phone, notes, createdAt: new Date().toISOString() };
  DB.setStudents(students);
  DB.addActivity('👤', (isEdit ? 'Update' : 'Add') + ': ' + name + ' — Seat ' + seat + ' ' + shift);

  showFormMsg(msgEl, '✅ ' + name + ' — Seat ' + seat + ' (' + shift + ') mein ' + (isEdit ? 'update' : 'add') + ' ho gaye!', 'success');
  showToast(name + ' — Seat ' + seat + ' (' + shift + ')');
  clearStudentForm();
  renderStudentsTable();
  populateFeeSeats();
  refreshDashboard();
  renderAdminSeatGrid();
  renderSeatGrid();
}

function editStudent(seat, shift) {
  const students = DB.getStudents();
  const s = students[seat] && students[seat][shift];
  if (!s) return;
  document.getElementById('f-seat').value = seat;
  document.getElementById('f-name').value = s.name;
  document.getElementById('f-admDate').value = s.admDate || '';
  document.getElementById('f-shift').value = shift;
  document.getElementById('f-phone').value = s.phone || '';
  document.getElementById('f-notes').value = s.notes || '';
  document.getElementById('f-editSeat').value = seat;
  document.getElementById('f-editShift').value = shift;
  document.getElementById('addStudentTitle').textContent = 'Edit — Seat ' + seat + ' (' + shift + ')';
  showAdminTab('addStudent');
}

function clearStudentForm() {
  ['f-seat','f-name','f-shift','f-phone','f-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const d = document.getElementById('f-admDate');
  if (d) d.value = new Date().toISOString().split('T')[0];
  document.getElementById('f-editSeat').value = '';
  document.getElementById('f-editShift').value = '';
  document.getElementById('addStudentTitle').textContent = 'Add New Student';
  document.getElementById('studentFormMsg').textContent = '';
}

function confirmDeleteStudent(seat, shift) {
  const students = DB.getStudents();
  const s = students[seat] && students[seat][shift];
  if (!s) return;
  showConfirm(
    'Student Hatao — Seat ' + seat + ' (' + shift + ')',
    s.name + ' ko Seat ' + seat + ' ke ' + shift + ' shift se hatana chahte ho? Seat khali ho jayegi lekin fee history SAFE rahegi.',
    () => deleteStudent(seat, shift)
  );
}

function deleteStudent(seat, shift) {
  const students = DB.getStudents();
  const s = students[seat] && students[seat][shift];
  if (!s) return;
  const name = s.name;

  const archive = DB.getArchive();
  archive.push(Object.assign({}, s, { seat, shift, archivedAt: new Date().toISOString() }));
  DB.setArchive(archive);

  delete students[seat][shift];
  if (Object.keys(students[seat]).length === 0) delete students[seat];
  DB.setStudents(students);

  DB.addActivity('📦', name + ' — Seat ' + seat + ' (' + shift + ') archived, fees safe hain');
  showToast(name + ' archive ho gaye — fee history safe hai', 'info');
  renderStudentsTable();
  populateFeeSeats();
  refreshDashboard();
  renderAdminSeatGrid();
  renderSeatGrid();
  renderFeeTable();
}

// ============================================================ FEE MANAGEMENT
function populateFeeSeats() {
  const sel = document.getElementById('ff-seat');
  if (!sel) return;
  const cur = sel.value;
  const students = DB.getStudents();
  sel.innerHTML = '<option value="">Seat aur Shift Select Karo</option>';
  Object.entries(students).sort(([a],[b]) => a-b).forEach(([seat, seatData]) => {
    SHIFTS.forEach(sh => {
      if (seatData && seatData[sh]) {
        const opt = document.createElement('option');
        opt.value = seat + '__' + sh;
        opt.textContent = 'Seat ' + seat + ' — ' + seatData[sh].name + ' (' + sh + ')';
        sel.appendChild(opt);
      }
    });
  });
  if (cur) sel.value = cur;
}

function autoFillFeeForm() {
  const val = document.getElementById('ff-seat').value;
  if (!val) {
    document.getElementById('ff-name').value = '';
    document.getElementById('ff-shift').value = '';
    document.getElementById('ff-amount').value = '';
    return;
  }
  const parts = val.split('__');
  const seat = parts[0]; const shift = parts[1];
  const students = DB.getStudents();
  const s = students[seat] && students[seat][shift];
  if (s) {
    document.getElementById('ff-name').value = s.name;
    document.getElementById('ff-shift').value = shift;
    if (!document.getElementById('ff-amount').value)
      document.getElementById('ff-amount').value = SHIFT_FEES[shift] || 500;
  }
}

function saveFee() {
  const seatShift = document.getElementById('ff-seat').value;
  const amount    = +document.getElementById('ff-amount').value;
  const month     = +document.getElementById('ff-month').value;
  const year      = +document.getElementById('ff-year').value;
  const paidDate  = document.getElementById('ff-paidDate').value;
  const note      = document.getElementById('ff-note').value.trim();
  const editId    = document.getElementById('ff-editId').value;
  const msgEl     = document.getElementById('feeFormMsg');

  if (!seatShift) { showFormMsg(msgEl, '⚠️ Seat aur shift select karo', 'error'); return; }
  if (!amount || amount <= 0) { showFormMsg(msgEl, '⚠️ Sahi amount daalo', 'error'); return; }
  if (!month) { showFormMsg(msgEl, '⚠️ Month select karo', 'error'); return; }
  if (!year) { showFormMsg(msgEl, '⚠️ Year select karo', 'error'); return; }
  if (!paidDate) { showFormMsg(msgEl, '⚠️ Paid date daalo', 'error'); return; }

  const parts = seatShift.split('__');
  const seat = +parts[0]; const shift = parts[1];
  const students = DB.getStudents();
  const s = students[seat] && students[seat][shift];
  if (!s) { showFormMsg(msgEl, '⚠️ Is seat/shift mein koi student nahi', 'error'); return; }

  let fees = DB.getFees();
  const dup = fees.find(f => +f.seat === seat && f.shift === shift && +f.month === month && +f.year === year && f.id !== editId);
  if (dup) {
    showFormMsg(msgEl, '⚠️ ' + MONTHS[month] + ' ' + year + ' ka fee already add hai — ' + shift + ' shift', 'error');
    return;
  }

  if (editId) {
    const idx = fees.findIndex(f => f.id === editId);
    if (idx !== -1) {
      fees[idx] = Object.assign({}, fees[idx], { seat, shift, amount, month, year, paidDate, note, studentName: s.name });
      DB.addActivity('✏️', 'Fee update: ' + s.name + ' — ' + MONTHS[month] + ' ' + year + ' — ₹' + amount);
    }
  } else {
    fees.push({ id: DB.newFeeId(), seat, shift, amount, month, year, paidDate, note, studentName: s.name, createdAt: new Date().toISOString() });
    DB.addActivity('💰', 'Fee add: ' + s.name + ' (Seat ' + seat + ' ' + shift + ') — ' + MONTHS[month] + ' ' + year + ' — ₹' + amount);
  }
  DB.setFees(fees);
  showFormMsg(msgEl, '✅ ₹' + amount + ' — ' + s.name + ' (' + MONTHS[month] + ' ' + year + ') save ho gaya!', 'success');
  showToast('Fee saved — ₹' + amount + ' for ' + s.name);
  clearFeeForm();
  renderFeeTable();
  refreshDashboard();
  renderAdminSeatGrid();
  renderSeatGrid();
}

function clearFeeForm() {
  document.getElementById('ff-seat').value = '';
  document.getElementById('ff-name').value = '';
  document.getElementById('ff-shift').value = '';
  document.getElementById('ff-amount').value = '';
  document.getElementById('ff-month').value = '';
  document.getElementById('ff-year').value = new Date().getFullYear();
  document.getElementById('ff-paidDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('ff-note').value = '';
  document.getElementById('ff-editId').value = '';
  document.getElementById('feeFormMsg').textContent = '';
}

function renderFeeTable() {
  const body = document.getElementById('feeBody');
  if (!body) return;
  const mf = +document.getElementById('feeFilterMonth').value;
  const yf = +document.getElementById('feeFilterYear').value;
  const students = DB.getStudents();
  let fees = DB.getFees()
    .filter(f => (!mf || +f.month === mf) && (!yf || +f.year === yf))
    .sort((a,b) => b.year-a.year || b.month-a.month || a.seat-b.seat);

  if (!fees.length) {
    body.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">💳</div><p>Koi fee record nahi.</p></div></td></tr>';
    return;
  }
  body.innerHTML = fees.map(f => {
    const seatData = students[f.seat];
    const student = seatData && seatData[f.shift];
    const name = student ? student.name : (f.studentName || '—');
    return '<tr>' +
      '<td><span style="font-family:\'JetBrains Mono\',monospace;font-weight:700;color:var(--accent)">S-' + String(f.seat).padStart(2,'0') + '</span></td>' +
      '<td>' + name + '</td>' +
      '<td><span class="badge badge-' + (f.shift||'').toLowerCase().replace(' ','-') + '">' + (SHIFT_ICON[f.shift]||'') + ' ' + (f.shift||'—') + '</span></td>' +
      '<td>' + MONTHS[f.month] + '</td>' +
      '<td>' + f.year + '</td>' +
      '<td style="font-family:\'JetBrains Mono\',monospace;color:var(--green);font-weight:700">₹' + f.amount + '</td>' +
      '<td>' + (f.paidDate||'—') + '</td>' +
      '<td>' +
      '<button class="btn-icon btn-edit" onclick="editFee(\'' + f.id + '\')" title="Edit">✏️</button> ' +
      '<button class="btn-icon btn-del" onclick="confirmDeleteFee(\'' + f.id + '\')" title="Delete">🗑️</button>' +
      '</td></tr>';
  }).join('');
}

function editFee(id) {
  const fees = DB.getFees();
  const f = fees.find(x => x.id === id);
  if (!f) return;
  populateFeeSeats();
  document.getElementById('ff-seat').value = f.seat + '__' + f.shift;
  autoFillFeeForm();
  document.getElementById('ff-amount').value = f.amount;
  document.getElementById('ff-month').value = f.month;
  document.getElementById('ff-year').value = f.year;
  document.getElementById('ff-paidDate').value = f.paidDate;
  document.getElementById('ff-note').value = f.note || '';
  document.getElementById('ff-editId').value = id;
  showAdminTab('fees');
  document.querySelector('.admin-main').scrollTo(0, 0);
  showToast('Edit mode — update kar ke save karo', 'info');
}

function confirmDeleteFee(id) {
  const fees = DB.getFees();
  const f = fees.find(x => x.id === id);
  if (!f) return;
  showConfirm('Fee Delete Karo', '₹' + f.amount + ' ka fee — ' + (f.studentName||'') + ' (' + MONTHS[f.month] + ' ' + f.year + ') delete karna chahte ho?', () => deleteFee(id));
}

function deleteFee(id) {
  const fees = DB.getFees();
  const f = fees.find(x => x.id === id);
  if (!f) return;
  DB.setFees(fees.filter(x => x.id !== id));
  DB.addActivity('🗑️', 'Fee delete: ' + (f.studentName||'') + ' Seat ' + f.seat + ' ' + f.shift + ' — ' + MONTHS[f.month] + ' ' + f.year + ' — ₹' + f.amount);
  showToast('Fee delete ho gayi — ₹' + f.amount, 'error');
  renderFeeTable();
  refreshDashboard();
  renderAdminSeatGrid();
  renderSeatGrid();
}

// ============================================================ ADMIN SEAT GRID
function renderAdminSeatGrid() {
  const grid = document.getElementById('adminSeatGrid');
  if (!grid) return;
  const month = +document.getElementById('admin-seatGridMonth').value || (new Date().getMonth() + 1);
  const year  = +document.getElementById('admin-seatGridYear').value  || new Date().getFullYear();
  const students = DB.getStudents();
  grid.innerHTML = '';

  for (let s = 1; s <= TOTAL_SEATS; s++) {
    const card = buildSeatCard(s, students[s], month, year);
    const btn = document.createElement('button');
    btn.className = 'seat-btn seat-btn-new ' + card.cls;
    btn.innerHTML = card.html;
    btn.addEventListener('click', () => openAdminSeatClick(s));
    grid.appendChild(btn);
  }
}

// ============================================================ INCOME REPORT
function generateIncomeReport() {
  const month = +document.getElementById('inc-month').value;
  const year  = +document.getElementById('inc-year').value;
  const area  = document.getElementById('incomeReportArea');
  const students = DB.getStudents();

  let filtered = DB.getFees().filter(f => (!month || +f.month === month) && (!year || +f.year === year));
  filtered.sort((a,b) => b.year-a.year || b.month-a.month || a.seat-b.seat);
  const totalIncome = filtered.reduce((sum,f) => sum + (+f.amount||0), 0);

  const grouped = {};
  filtered.forEach(f => {
    const key = f.year + '-' + String(f.month).padStart(2,'0');
    if (!grouped[key]) grouped[key] = { month: f.month, year: f.year, total: 0, records: [] };
    grouped[key].total += +f.amount || 0;
    grouped[key].records.push(f);
  });

  if (!filtered.length) {
    area.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Is period mein koi income nahi.</p></div>';
    return;
  }

  let html = '<div class="income-summary-cards">' +
    '<div class="income-summary-card"><div class="inc-amount">₹' + totalIncome.toLocaleString() + '</div><div class="inc-label">' + (month ? MONTHS[month] : 'Sabhi Mahine') + ' ' + year + ' Total</div></div>' +
    '<div class="income-summary-card"><div class="inc-amount" style="color:var(--accent)">' + filtered.length + '</div><div class="inc-label">Total Transactions</div></div>' +
    '<div class="income-summary-card"><div class="inc-amount" style="color:var(--orange)">' + Object.keys(grouped).length + '</div><div class="inc-label">Months</div></div>' +
    '</div>';

  Object.values(grouped).sort((a,b) => b.year-a.year || b.month-a.month).forEach(g => {
    html += '<div class="dash-card" style="margin-bottom:1.5rem"><div class="dash-card-title-row"><h3 class="dash-card-title">📅 ' + MONTHS[g.month] + ' ' + g.year + '</h3><span style="font-family:\'JetBrains Mono\',monospace;font-size:1.1rem;font-weight:700;color:var(--green)">₹' + g.total.toLocaleString() + '</span></div><div class="table-wrapper"><table class="data-table"><thead><tr><th>Seat</th><th>Name</th><th>Shift</th><th>Amount</th><th>Paid Date</th></tr></thead><tbody>';
    g.records.forEach(f => {
      const seatData = students[f.seat];
      const st = seatData && seatData[f.shift];
      const nm = st ? st.name : (f.studentName || '—');
      html += '<tr><td style="font-family:\'JetBrains Mono\',monospace;color:var(--accent);font-weight:700">S-' + String(f.seat).padStart(2,'0') + '</td><td>' + nm + '</td><td><span class="badge badge-' + (f.shift||'').toLowerCase().replace(' ','-') + '">' + (SHIFT_ICON[f.shift]||'') + ' ' + (f.shift||'—') + '</span></td><td style="font-family:\'JetBrains Mono\',monospace;color:var(--green);font-weight:700">₹' + f.amount + '</td><td>' + (f.paidDate||'—') + '</td></tr>';
    });
    html += '</tbody></table></div></div>';
  });
  area.innerHTML = html;
}

// ============================================================ CONFIRM MODAL
function showConfirm(title, msg, onYes) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  const yesBtn = document.getElementById('confirmYes');
  const newBtn = yesBtn.cloneNode(true);
  yesBtn.parentNode.replaceChild(newBtn, yesBtn);
  newBtn.addEventListener('click', () => {
    document.getElementById('confirmModal').classList.remove('active');
    onYes();
  });
  document.getElementById('confirmModal').classList.add('active');
}

function showFormMsg(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = 'form-msg ' + type;
  setTimeout(() => { if (el) el.textContent = ''; }, 4000);
}

// ============================================================ KEYBOARD
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    if (document.getElementById('sidebar').classList.contains('open')) {
      document.getElementById('sidebar').classList.remove('open');
      sidebarOpen = false;
    }
  }
});

// ============================================================ SAMPLE DATA
(function seedSampleData() {
  const students = DB.getStudents();
  if (Object.keys(students).length > 0) return;

  const sd = {
    1:  { Morning: { name: 'Arjun Sharma',  admDate: '2025-01-10', phone: '9876543210', notes: '' } },
    2:  { Evening: { name: 'Priya Verma',   admDate: '2025-02-15', phone: '9988776655', notes: '' } },
    3:  { Morning: { name: 'Rahul Singh',   admDate: '2025-01-20', phone: '9123456789', notes: '' },
          Evening: { name: 'Neha Soni',     admDate: '2025-03-01', phone: '9011111111', notes: '' } },
    5:  { Night:   { name: 'Ananya Gupta',  admDate: '2025-03-05', phone: '9011223344', notes: '' } },
    7:  { Morning: { name: 'Vikram Patel',  admDate: '2025-02-28', phone: '9876512345', notes: '' } },
    10: { Evening: { name: 'Sneha Yadav',   admDate: '2025-04-01', phone: '9871234560', notes: '' } },
    12: { Morning: { name: 'Rohan Tiwari',  admDate: '2025-01-15', phone: '9887766554', notes: '' },
          Night:   { name: 'Suraj Kumar',   admDate: '2025-02-20', phone: '9900000001', notes: '' } },
    15: { Morning: { name: 'Kavita Joshi',  admDate: '2025-03-20', phone: '9012345678', notes: '' } },
    18: { Night:   { name: 'Amit Kumar',    admDate: '2025-02-10', phone: '9900112233', notes: '' } },
    21: { Morning: { name: 'Riya Mishra',   admDate: '2025-04-12', phone: '9955443322', notes: '' } }
  };
  DB.setStudents(sd);

  const now = new Date();
  const curM = now.getMonth() + 1, curY = now.getFullYear();
  const prevM = curM === 1 ? 12 : curM - 1, prevY = curM === 1 ? curY - 1 : curY;
  const today = now.toISOString().split('T')[0];
  const prevDate = new Date(prevY, prevM - 1, 5).toISOString().split('T')[0];

  const fees = [];
  const af = (seat, shift, amt, month, year, date, name) =>
    fees.push({ id: DB.newFeeId(), seat, shift, amount: amt, month, year, paidDate: date, studentName: name, note: '', createdAt: new Date().toISOString() });

  af(1,'Morning',500,curM,curY,today,'Arjun Sharma');
  af(3,'Morning',500,curM,curY,today,'Rahul Singh');
  af(7,'Morning',500,curM,curY,today,'Vikram Patel');
  af(10,'Evening',500,curM,curY,today,'Sneha Yadav');
  af(12,'Morning',500,curM,curY,today,'Rohan Tiwari');

  af(1,'Morning',500,prevM,prevY,prevDate,'Arjun Sharma');
  af(2,'Evening',500,prevM,prevY,prevDate,'Priya Verma');
  af(3,'Morning',500,prevM,prevY,prevDate,'Rahul Singh');
  af(3,'Evening',500,prevM,prevY,prevDate,'Neha Soni');
  af(5,'Night',500,prevM,prevY,prevDate,'Ananya Gupta');
  af(7,'Morning',500,prevM,prevY,prevDate,'Vikram Patel');
  af(12,'Morning',500,prevM,prevY,prevDate,'Rohan Tiwari');
  af(12,'Night',500,prevM,prevY,prevDate,'Suraj Kumar');

  DB.setFees(fees);
  DB.addActivity('🚀', 'Shiva Digital Library — System ready!');
})();
