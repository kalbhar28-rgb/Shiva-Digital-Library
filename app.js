/* ============================================================
   LibraNova — Library Management System
   app.js — Full Application Logic
   Admin: username="admin" password="lib@2025"
   ============================================================ */

// ============================================================ DATA LAYER
const DB = {
  // Storage keys
  STUDENTS_KEY: 'libranова_students',
  FEES_KEY: 'libranова_fees',
  ACTIVITY_KEY: 'libranова_activity',

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

  // Get all occupied seat numbers
  getOccupiedSeats() { return Object.keys(this.getStudents()).map(Number); },

  // Get fees for a seat
  getSeatsFeesForMonth(seat, month, year) {
    return this.getFees().filter(f => +f.seat === +seat && +f.month === +month && +f.year === +year);
  },

  // Income for a month+year
  getIncome(month, year) {
    const fees = this.getFees();
    return fees
      .filter(f => (!month || +f.month === +month) && (!year || +f.year === +year))
      .reduce((sum, f) => sum + (+f.amount || 0), 0);
  },

  // Generate unique fee ID
  newFeeId() { return 'fee_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
};

// ============================================================ CONSTANTS
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
const SHIFT_FEES = { 'Morning': 500, 'Evening': 500, 'Double Shift': 800, 'Night': 500 };
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'lib@2025';
const TOTAL_SEATS = 42;
const YEARS = (() => {
  const base = 2023;
  const arr = [];
  for (let y = base; y <= new Date().getFullYear() + 1; y++) arr.push(y);
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
  // Set today's date defaults
  const today = new Date().toISOString().split('T')[0];
  if (document.getElementById('f-admDate')) document.getElementById('f-admDate').value = today;
  if (document.getElementById('ff-paidDate')) document.getElementById('ff-paidDate').value = today;
});

function initYearDropdowns() {
  const ids = ['searchYear', 'ff-year', 'inc-year', 'feeFilterYear',
                'seatGridYear', 'admin-seatGridYear', 'dash-chart-year'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const hasAll = ['searchYear', 'feeFilterYear'].includes(id);
    if (hasAll) el.innerHTML = '<option value="">All Years</option>';
    else el.innerHTML = '';
    const curYear = new Date().getFullYear();
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
  if (el) el.textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

// ============================================================ THEME TOGGLE
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
  t.className = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ============================================================ NAVBAR STATS
function updateNavStats() {
  const occupied = Object.keys(DB.getStudents()).length;
  const empty = TOTAL_SEATS - occupied;
  document.getElementById('nav-occupied').textContent = occupied;
  document.getElementById('nav-empty').textContent = empty;
  document.getElementById('nav-total').textContent = TOTAL_SEATS;
}

// ============================================================ SCROLL
function scrollToSeats() {
  document.getElementById('seatsSection').scrollIntoView({ behavior: 'smooth' });
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
    const student = students[s];
    const btn = document.createElement('button');
    btn.className = 'seat-btn';
    if (!student) {
      btn.classList.add('empty');
      btn.innerHTML = `<span class="seat-num">${String(s).padStart(2,'0')}</span><span class="seat-status">Empty</span>`;
      btn.title = `Seat ${s} — Available`;
    } else {
      const feeRec = DB.getSeatsFeesForMonth(s, month, year);
      const hasFee = feeRec.length > 0;
      btn.classList.add(hasFee ? 'paid' : 'pending');
      btn.innerHTML = `<span class="seat-num">${String(s).padStart(2,'0')}</span><span class="seat-status">${hasFee ? '✓ Paid' : '⚠ Due'}</span>`;
      btn.title = `Seat ${s} — ${student.name}`;
    }
    btn.addEventListener('click', () => openSeatModal(s, month, year));
    grid.appendChild(btn);
  }
}

// ============================================================ SEAT MODAL (PUBLIC)
function openSeatModal(seatNum, month, year) {
  const students = DB.getStudents();
  const student = students[seatNum];
  const modal = document.getElementById('seatModal');
  document.getElementById('modalSeatNum').textContent = `S-${String(seatNum).padStart(2,'0')}`;
  if (!student) {
    document.getElementById('modalStudentName').textContent = 'Empty Seat';
    document.getElementById('modalStudentShift').textContent = 'No student assigned';
    document.getElementById('modalBody').innerHTML = `<div class="no-data">This seat is currently available.</div>`;
  } else {
    document.getElementById('modalStudentName').textContent = student.name;
    document.getElementById('modalStudentShift').textContent = `${student.shift} • Since ${student.admDate}`;
    const fees = DB.getFees().filter(f => +f.seat === +seatNum).sort((a,b)=> b.year-a.year || b.month-a.month);
    let html = fees.length ? '' : '<div class="no-data">No fee records yet.</div>';
    fees.forEach(f => {
      html += `<div class="fee-row">
        <div class="fee-row-left"><strong>${MONTHS[f.month]} ${f.year}</strong><br><small style="color:var(--text-muted)">${f.shift} — Paid: ${f.paidDate}</small></div>
        <div class="fee-row-right">₹${f.amount}</div>
      </div>`;
    });
    document.getElementById('modalBody').innerHTML = html;
  }
  modal.classList.add('active');
}

function closeSeatModal(e) {
  if (e.target === document.getElementById('seatModal')) {
    document.getElementById('seatModal').classList.remove('active');
  }
}

// ============================================================ PUBLIC SEARCH
function searchStudent() {
  const seat = document.getElementById('searchSeat').value.trim();
  const year = document.getElementById('searchYear').value;
  if (!seat && !year) { showToast('Please enter seat number or select year', 'error'); return; }
  const students = DB.getStudents();
  const fees = DB.getFees();
  let rows = [];
  fees.forEach(f => {
    const s = students[f.seat];
    if (!s) return;
    if (seat && +f.seat !== +seat) return;
    if (year && +f.year !== +year) return;
    rows.push({ seat: f.seat, name: s.name, admDate: s.admDate, shift: f.shift, month: f.month, year: f.year, amount: f.amount, paidDate: f.paidDate });
  });
  rows.sort((a,b) => b.year-a.year || b.month-a.month || a.seat-b.seat);
  renderResultsTable(rows);
  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

function searchAll() {
  const students = DB.getStudents();
  const fees = DB.getFees();
  const rows = fees.map(f => {
    const s = students[f.seat];
    if (!s) return null;
    return { seat: f.seat, name: s.name, admDate: s.admDate, shift: f.shift, month: f.month, year: f.year, amount: f.amount, paidDate: f.paidDate };
  }).filter(Boolean);
  rows.sort((a,b) => b.year-a.year || b.month-a.month || a.seat-b.seat);
  renderResultsTable(rows);
  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

function renderResultsTable(rows) {
  const body = document.getElementById('resultsBody');
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8" class="no-data">No records found.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(r => `
    <tr>
      <td><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--accent)">S-${String(r.seat).padStart(2,'0')}</span></td>
      <td>${r.name}</td>
      <td>${r.admDate || '—'}</td>
      <td><span class="badge badge-${r.shift.toLowerCase().replace(' ','-')}">${r.shift}</span></td>
      <td>${MONTHS[r.month]}</td>
      <td>${r.year}</td>
      <td style="font-family:'JetBrains Mono',monospace;color:var(--green)">₹${r.amount}</td>
      <td>${r.paidDate || '—'}</td>
    </tr>`).join('');
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
    document.getElementById('loginError').textContent = '⚠️ Invalid credentials. Try again.';
    document.getElementById('loginPass').value = '';
    setTimeout(() => document.getElementById('loginError').textContent = '', 3000);
  }
}

document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
document.getElementById('loginUser').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });

function closeLoginModal(e) {
  if (e.target === document.getElementById('loginModal')) {
    document.getElementById('loginModal').classList.remove('active');
  }
}

function adminLogout() {
  isAdminLoggedIn = false;
  document.getElementById('adminDashboard').style.display = 'none';
  document.body.style.overflow = '';
  showToast('Logged out successfully.', 'info');
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
  document.getElementById(`adminTab-${tabName}`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
  const titles = { dashboard:'Dashboard', students:'All Students', addStudent:'Add / Edit Student',
                   fees:'Fee Management', income:'Income Report', seats:'Seat Grid' };
  document.getElementById('topbarTitle').textContent = titles[tabName] || tabName;
  if (tabName === 'dashboard') { refreshDashboard(); renderIncomeChart(); renderActivityList(); }
  if (tabName === 'students') renderStudentsTable();
  if (tabName === 'fees') { renderFeeTable(); populateFeeSeats(); }
  if (tabName === 'seats') renderAdminSeatGrid();
  if (window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); sidebarOpen = false; }
}

// ============================================================ DASHBOARD REFRESH
function refreshDashboard() {
  const students = DB.getStudents();
  const occupied = Object.keys(students).length;
  const empty = TOTAL_SEATS - occupied;
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  const monthlyInc = DB.getIncome(curMonth, curYear);
  const yearlyInc = DB.getIncome('', curYear);
  const fees = DB.getFees();
  // Pending: occupied seats without fee this month
  let pending = 0;
  Object.keys(students).forEach(seat => {
    const hasFee = fees.some(f => +f.seat === +seat && +f.month === curMonth && +f.year === curYear);
    if (!hasFee) pending++;
  });
  document.getElementById('dash-total').textContent = TOTAL_SEATS;
  document.getElementById('dash-occupied').textContent = occupied;
  document.getElementById('dash-empty').textContent = empty;
  document.getElementById('dash-monthly').textContent = `₹${monthlyInc.toLocaleString()}`;
  document.getElementById('dash-yearly').textContent = `₹${yearlyInc.toLocaleString()}`;
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
    const student = students[s];
    const div = document.createElement('div');
    div.className = 'mini-seat';
    div.textContent = s;
    if (!student) { div.classList.add('empty'); div.title = `Seat ${s}: Empty`; }
    else {
      const paid = DB.getSeatsFeesForMonth(s, month, year).length > 0;
      div.classList.add(paid ? 'paid' : 'pending');
      div.title = `Seat ${s}: ${student.name} — ${paid ? 'Paid' : 'Pending'}`;
    }
    div.onclick = () => openAdminSeatClick(s);
    grid.appendChild(div);
  }
}

function openAdminSeatClick(seatNum) {
  const students = DB.getStudents();
  const student = students[seatNum];
  if (!student) {
    showAdminTab('addStudent');
    document.getElementById('f-seat').value = seatNum;
    return;
  }
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
  const maxInc = Math.max(...MONTHS.slice(1).map((_,i) => DB.getIncome(i+1, year)), 1);
  chart.innerHTML = '';
  MONTHS.slice(1).forEach((m, i) => {
    const inc = DB.getIncome(i+1, year);
    const pct = Math.max((inc / maxInc) * 100, 3);
    const wrap = document.createElement('div');
    wrap.className = 'chart-bar-wrap';
    wrap.innerHTML = `
      <div class="chart-bar" style="height:${pct}%" data-val="₹${inc.toLocaleString()}" title="${m}: ₹${inc.toLocaleString()}"></div>
      <div class="chart-label">${m.slice(0,3)}</div>`;
    chart.appendChild(wrap);
  });
}

// ============================================================ ACTIVITY LIST
function renderActivityList() {
  const el = document.getElementById('activityList');
  if (!el) return;
  const acts = DB.getActivity();
  if (!acts.length) {
    el.innerHTML = '<div class="no-data">No activity yet.</div>';
    return;
  }
  el.innerHTML = acts.slice(0, 10).map(a => `
    <div class="activity-item">
      <span class="activity-icon">${a.icon}</span>
      <span class="activity-text">${a.text}</span>
      <span class="activity-time">${a.time}</span>
    </div>`).join('');
}

// ============================================================ STUDENTS TABLE
function renderStudentsTable() {
  const body = document.getElementById('studentsBody');
  const search = (document.getElementById('studentSearch') || {}).value || '';
  const shiftFilter = (document.getElementById('filterShift') || {}).value || '';
  const students = DB.getStudents();
  const rows = Object.entries(students)
    .filter(([seat, s]) => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || seat.includes(search);
      const matchShift = !shiftFilter || s.shift === shiftFilter;
      return matchSearch && matchShift;
    })
    .sort(([a],[b]) => a-b);

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">👥</div><p>No students found.</p></div></td></tr>`;
    return;
  }
  body.innerHTML = rows.map(([seat, s]) => `
    <tr>
      <td><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--accent)">S-${String(seat).padStart(2,'0')}</span></td>
      <td>${s.name}${s.phone ? `<br><small style="color:var(--text-muted)">${s.phone}</small>` : ''}</td>
      <td>${s.admDate || '—'}</td>
      <td><span class="badge badge-${s.shift.toLowerCase().replace(' ','-')}">${s.shift}</span></td>
      <td>
        <button class="btn-icon btn-edit" onclick="editStudent(${seat})" title="Edit">✏️</button>
        <button class="btn-icon btn-del" onclick="confirmDeleteStudent(${seat})" title="Delete">🗑️</button>
      </td>
    </tr>`).join('');
}

function filterStudents() { renderStudentsTable(); }

// ============================================================ ADD/EDIT STUDENT
function saveStudent() {
  const seat    = +document.getElementById('f-seat').value;
  const name    = document.getElementById('f-name').value.trim();
  const admDate = document.getElementById('f-admDate').value;
  const shift   = document.getElementById('f-shift').value;
  const phone   = document.getElementById('f-phone').value.trim();
  const notes   = document.getElementById('f-notes').value.trim();
  const editSeat= document.getElementById('f-editSeat').value;
  const msgEl   = document.getElementById('studentFormMsg');

  if (!seat || seat < 1 || seat > 42) { showFormMsg(msgEl, '⚠️ Seat number must be 1–42', 'error'); return; }
  if (!name) { showFormMsg(msgEl, '⚠️ Full name is required', 'error'); return; }
  if (!admDate) { showFormMsg(msgEl, '⚠️ Admission date is required', 'error'); return; }
  if (!shift) { showFormMsg(msgEl, '⚠️ Please select a shift', 'error'); return; }

  const students = DB.getStudents();
  const isEdit = !!editSeat;
  const conflictSeat = students[seat];

  if (!isEdit && conflictSeat) { showFormMsg(msgEl, `⚠️ Seat ${seat} is already occupied by ${conflictSeat.name}`, 'error'); return; }
  if (isEdit && +editSeat !== seat && conflictSeat) { showFormMsg(msgEl, `⚠️ Seat ${seat} is already occupied by ${conflictSeat.name}`, 'error'); return; }

  // If editing and seat changed, remove old
  if (isEdit && +editSeat !== seat) {
    delete students[+editSeat];
    // Update fee records' seat number
    const fees = DB.getFees();
    fees.forEach(f => { if (+f.seat === +editSeat) { f.seat = seat; f.seatLabel = `S-${String(seat).padStart(2,'0')}`; } });
    DB.setFees(fees);
  }

  students[seat] = { name, admDate, shift, phone, notes, createdAt: students[seat]?.createdAt || new Date().toISOString() };
  DB.setStudents(students);
  DB.addActivity('👤', `${isEdit ? 'Updated' : 'Added'} student: ${name} (Seat ${seat})`);

  showFormMsg(msgEl, `✅ Student ${isEdit ? 'updated' : 'added'} successfully!`, 'success');
  showToast(`Student ${isEdit ? 'updated' : 'added'} — ${name}`);
  clearStudentForm();
  renderStudentsTable();
  populateFeeSeats();
  refreshDashboard();
  renderAdminSeatGrid();
}

function editStudent(seat) {
  const students = DB.getStudents();
  const s = students[seat];
  if (!s) return;
  document.getElementById('f-seat').value = seat;
  document.getElementById('f-name').value = s.name;
  document.getElementById('f-admDate').value = s.admDate || '';
  document.getElementById('f-shift').value = s.shift;
  document.getElementById('f-phone').value = s.phone || '';
  document.getElementById('f-notes').value = s.notes || '';
  document.getElementById('f-editSeat').value = seat;
  document.getElementById('addStudentTitle').textContent = `Edit Student — Seat ${seat}`;
  showAdminTab('addStudent');
  window.scrollTo(0,0);
}

function clearStudentForm() {
  ['f-seat','f-name','f-admDate','f-shift','f-phone','f-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'f-admDate' ? new Date().toISOString().split('T')[0] : '';
  });
  document.getElementById('f-editSeat').value = '';
  document.getElementById('addStudentTitle').textContent = 'Add New Student';
  document.getElementById('studentFormMsg').textContent = '';
}

function confirmDeleteStudent(seat) {
  const students = DB.getStudents();
  const s = students[seat];
  if (!s) return;
  showConfirm(
    `Delete Student`,
    `Delete ${s.name} from Seat ${seat}? All fee records will also be deleted and income will be updated.`,
    () => deleteStudent(seat)
  );
}

function deleteStudent(seat) {
  const students = DB.getStudents();
  const s = students[seat];
  if (!s) return;
  const name = s.name;
  delete students[seat];
  DB.setStudents(students);
  // Remove all fees for this seat (income auto-decreases)
  const fees = DB.getFees().filter(f => +f.seat !== +seat);
  DB.setFees(fees);
  DB.addActivity('🗑️', `Deleted student: ${name} (Seat ${seat}) — fees removed`);
  showToast(`Deleted: ${name} (Seat ${seat})`, 'error');
  renderStudentsTable();
  populateFeeSeats();
  refreshDashboard();
  renderAdminSeatGrid();
  renderFeeTable();
}

// ============================================================ FEE MANAGEMENT
function populateFeeSeats() {
  const sel = document.getElementById('ff-seat');
  if (!sel) return;
  const cur = sel.value;
  const students = DB.getStudents();
  sel.innerHTML = '<option value="">Select Seat</option>';
  Object.entries(students).sort(([a],[b])=>a-b).forEach(([seat, s]) => {
    const opt = document.createElement('option');
    opt.value = seat;
    opt.textContent = `Seat ${seat} — ${s.name}`;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

function autoFillFeeForm() {
  const seat = document.getElementById('ff-seat').value;
  if (!seat) { document.getElementById('ff-name').value = ''; document.getElementById('ff-shift').value = ''; return; }
  const students = DB.getStudents();
  const s = students[seat];
  if (s) {
    document.getElementById('ff-name').value = s.name;
    document.getElementById('ff-shift').value = s.shift;
    document.getElementById('ff-amount').value = document.getElementById('ff-amount').value || SHIFT_FEES[s.shift] || 500;
  }
}

function saveFee() {
  const seat     = +document.getElementById('ff-seat').value;
  const amount   = +document.getElementById('ff-amount').value;
  const month    = +document.getElementById('ff-month').value;
  const year     = +document.getElementById('ff-year').value;
  const paidDate = document.getElementById('ff-paidDate').value;
  const note     = document.getElementById('ff-note').value.trim();
  const editId   = document.getElementById('ff-editId').value;
  const msgEl    = document.getElementById('feeFormMsg');

  if (!seat) { showFormMsg(msgEl, '⚠️ Please select a seat', 'error'); return; }
  if (!amount || amount <= 0) { showFormMsg(msgEl, '⚠️ Enter a valid amount', 'error'); return; }
  if (!month) { showFormMsg(msgEl, '⚠️ Select month', 'error'); return; }
  if (!year) { showFormMsg(msgEl, '⚠️ Select year', 'error'); return; }
  if (!paidDate) { showFormMsg(msgEl, '⚠️ Enter paid date', 'error'); return; }

  const students = DB.getStudents();
  const s = students[seat];
  if (!s) { showFormMsg(msgEl, '⚠️ No student at this seat', 'error'); return; }

  let fees = DB.getFees();
  // Duplicate check (same seat, month, year) — skip if editing same record
  const dup = fees.find(f => +f.seat === +seat && +f.month === +month && +f.year === +year && f.id !== editId);
  if (dup) { showFormMsg(msgEl, `⚠️ Fee for ${MONTHS[month]} ${year} already exists for this seat`, 'error'); return; }

  if (editId) {
    const idx = fees.findIndex(f => f.id === editId);
    if (idx !== -1) {
      fees[idx] = { ...fees[idx], seat, amount, month, year, paidDate, shift: s.shift, note, studentName: s.name };
      DB.addActivity('✏️', `Updated fee: ${s.name} — ${MONTHS[month]} ${year} — ₹${amount}`);
    }
  } else {
    fees.push({ id: DB.newFeeId(), seat, amount, month, year, paidDate, shift: s.shift, note, studentName: s.name, createdAt: new Date().toISOString() });
    DB.addActivity('💰', `Fee added: ${s.name} (Seat ${seat}) — ${MONTHS[month]} ${year} — ₹${amount}`);
  }
  DB.setFees(fees);
  showFormMsg(msgEl, `✅ Fee ${editId ? 'updated' : 'saved'} — ₹${amount} for ${MONTHS[month]} ${year}`, 'success');
  showToast(`Fee saved — ₹${amount} for ${s.name}`);
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
    body.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">💳</div><p>No fee records for this filter.</p></div></td></tr>`;
    return;
  }
  body.innerHTML = fees.map(f => {
    const s = students[f.seat];
    return `<tr>
      <td><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--accent)">S-${String(f.seat).padStart(2,'0')}</span></td>
      <td>${s ? s.name : f.studentName || '—'}</td>
      <td><span class="badge badge-${(f.shift||'').toLowerCase().replace(' ','-')}">${f.shift || '—'}</span></td>
      <td>${MONTHS[f.month]}</td>
      <td>${f.year}</td>
      <td style="font-family:'JetBrains Mono',monospace;color:var(--green);font-weight:700">₹${f.amount}</td>
      <td>${f.paidDate || '—'}</td>
      <td>
        <button class="btn-icon btn-edit" onclick="editFee('${f.id}')" title="Edit">✏️</button>
        <button class="btn-icon btn-del" onclick="confirmDeleteFee('${f.id}')" title="Delete">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function editFee(id) {
  const fees = DB.getFees();
  const f = fees.find(x => x.id === id);
  if (!f) return;
  populateFeeSeats();
  document.getElementById('ff-seat').value = f.seat;
  autoFillFeeForm();
  document.getElementById('ff-amount').value = f.amount;
  document.getElementById('ff-month').value = f.month;
  document.getElementById('ff-year').value = f.year;
  document.getElementById('ff-paidDate').value = f.paidDate;
  document.getElementById('ff-note').value = f.note || '';
  document.getElementById('ff-editId').value = id;
  showAdminTab('fees');
  document.querySelector('.admin-main').scrollTo(0, 0);
  showToast('Edit mode — update fee and save', 'info');
}

function confirmDeleteFee(id) {
  const fees = DB.getFees();
  const f = fees.find(x => x.id === id);
  if (!f) return;
  const students = DB.getStudents();
  const name = (students[f.seat] || {}).name || f.studentName || 'Unknown';
  showConfirm(
    'Delete Fee Record',
    `Delete ₹${f.amount} fee for ${name} — ${MONTHS[f.month]} ${f.year}? Income will be reduced automatically.`,
    () => deleteFee(id)
  );
}

function deleteFee(id) {
  const fees = DB.getFees();
  const f = fees.find(x => x.id === id);
  if (!f) return;
  const students = DB.getStudents();
  const name = (students[f.seat] || {}).name || f.studentName || 'Unknown';
  const newFees = fees.filter(x => x.id !== id);
  DB.setFees(newFees);
  DB.addActivity('🗑️', `Deleted fee: ${name} (Seat ${f.seat}) — ${MONTHS[f.month]} ${f.year} — ₹${f.amount}`);
  showToast(`Fee deleted — ₹${f.amount} removed from income`, 'error');
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
    const student = students[s];
    const btn = document.createElement('button');
    btn.className = 'seat-btn';
    if (!student) {
      btn.classList.add('empty');
      btn.innerHTML = `<span class="seat-num">${String(s).padStart(2,'0')}</span><span class="seat-status">Empty</span>`;
    } else {
      const hasFee = DB.getSeatsFeesForMonth(s, month, year).length > 0;
      btn.classList.add(hasFee ? 'paid' : 'pending');
      btn.innerHTML = `<span class="seat-num">${String(s).padStart(2,'0')}</span><span class="seat-status">${hasFee ? '✓ Paid' : '⚠ Due'}</span>`;
    }
    btn.title = student ? `Seat ${s} — ${student.name}` : `Seat ${s} — Available`;
    btn.addEventListener('click', () => {
      if (!student) {
        showAdminTab('addStudent');
        document.getElementById('f-seat').value = s;
      } else {
        showAdminTab('fees');
        document.getElementById('ff-seat').value = s;
        autoFillFeeForm();
      }
    });
    grid.appendChild(btn);
  }
}

// ============================================================ INCOME REPORT
function generateIncomeReport() {
  const month = +document.getElementById('inc-month').value;
  const year  = +document.getElementById('inc-year').value;
  const area  = document.getElementById('incomeReportArea');
  const fees  = DB.getFees();
  const students = DB.getStudents();

  let filtered = fees.filter(f => (!month || +f.month === month) && (!year || +f.year === year));
  filtered.sort((a,b) => b.year-a.year || b.month-a.month || a.seat-b.seat);

  const totalIncome = filtered.reduce((sum, f) => sum + (+f.amount||0), 0);

  // Group by month
  const grouped = {};
  filtered.forEach(f => {
    const key = `${f.year}-${String(f.month).padStart(2,'0')}`;
    if (!grouped[key]) grouped[key] = { month: f.month, year: f.year, total: 0, records: [] };
    grouped[key].total += +f.amount || 0;
    grouped[key].records.push(f);
  });

  if (!filtered.length) {
    area.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>No income records for this period.</p></div>`;
    return;
  }

  let html = `<div class="income-summary-cards">
    <div class="income-summary-card">
      <div class="inc-amount">₹${totalIncome.toLocaleString()}</div>
      <div class="inc-label">${month ? MONTHS[month] : 'All Months'} ${year} Total Income</div>
    </div>
    <div class="income-summary-card">
      <div class="inc-amount" style="color:var(--accent)">${filtered.length}</div>
      <div class="inc-label">Total Transactions</div>
    </div>
    <div class="income-summary-card">
      <div class="inc-amount" style="color:var(--orange)">${Object.keys(grouped).length}</div>
      <div class="inc-label">Months with Income</div>
    </div>
  </div>`;

  Object.values(grouped).sort((a,b) => b.year-a.year || b.month-a.month).forEach(g => {
    html += `<div class="dash-card" style="margin-bottom:1.5rem">
      <div class="dash-card-title-row">
        <h3 class="dash-card-title">📅 ${MONTHS[g.month]} ${g.year}</h3>
        <span style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;font-weight:700;color:var(--green)">₹${g.total.toLocaleString()}</span>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Seat</th><th>Name</th><th>Shift</th><th>Amount</th><th>Paid Date</th></tr></thead>
          <tbody>
            ${g.records.map(f => {
              const s = students[f.seat];
              return `<tr>
                <td style="font-family:'JetBrains Mono',monospace;color:var(--accent);font-weight:700">S-${String(f.seat).padStart(2,'0')}</td>
                <td>${s ? s.name : f.studentName || '—'}</td>
                <td><span class="badge badge-${(f.shift||'').toLowerCase().replace(' ','-')}">${f.shift||'—'}</span></td>
                <td style="font-family:'JetBrains Mono',monospace;color:var(--green);font-weight:700">₹${f.amount}</td>
                <td>${f.paidDate||'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
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

// ============================================================ FORM MESSAGE
function showFormMsg(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = `form-msg ${type}`;
  setTimeout(() => { if (el) el.textContent = ''; }, 4000);
}

// ============================================================ KEYBOARD SHORTCUTS
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    if (document.getElementById('sidebar').classList.contains('open')) {
      document.getElementById('sidebar').classList.remove('open');
      sidebarOpen = false;
    }
  }
});

// ============================================================ SAMPLE DATA (first run)
(function seedSampleData() {
  const students = DB.getStudents();
  if (Object.keys(students).length > 0) return; // Already has data

  const sampleStudents = {
    1: { name: 'Arjun Sharma', admDate: '2025-01-10', shift: 'Morning', phone: '9876543210', notes: '' },
    2: { name: 'Priya Verma', admDate: '2025-02-15', shift: 'Evening', phone: '9988776655', notes: '' },
    3: { name: 'Rahul Singh', admDate: '2025-01-20', shift: 'Double Shift', phone: '9123456789', notes: '' },
    5: { name: 'Ananya Gupta', admDate: '2025-03-05', shift: 'Night', phone: '9011223344', notes: '' },
    7: { name: 'Vikram Patel', admDate: '2025-02-28', shift: 'Morning', phone: '9876512345', notes: '' },
    10: { name: 'Sneha Yadav', admDate: '2025-04-01', shift: 'Evening', phone: '9871234560', notes: '' },
    12: { name: 'Rohan Tiwari', admDate: '2025-01-15', shift: 'Morning', phone: '9887766554', notes: '' },
    15: { name: 'Kavita Joshi', admDate: '2025-03-20', shift: 'Double Shift', phone: '9012345678', notes: '' },
    18: { name: 'Amit Kumar', admDate: '2025-02-10', shift: 'Night', phone: '9900112233', notes: '' },
    21: { name: 'Riya Mishra', admDate: '2025-04-12', shift: 'Morning', phone: '9955443322', notes: '' },
  };
  DB.setStudents(sampleStudents);

  const now = new Date();
  const curM = now.getMonth() + 1;
  const curY = now.getFullYear();
  const prevM = curM === 1 ? 12 : curM - 1;
  const prevY = curM === 1 ? curY - 1 : curY;

  const sampleFees = [];
  const addFee = (seat, amount, month, year, paidDate, shift) => {
    sampleFees.push({ id: DB.newFeeId(), seat, amount, month, year, paidDate, shift, studentName: sampleStudents[seat]?.name || '', note: '', createdAt: new Date().toISOString() });
  };

  // Current month fees (some paid)
  [[1,500,'Morning'],[2,500,'Evening'],[3,800,'Double Shift'],[7,500,'Morning'],[10,500,'Evening']].forEach(([seat,amt,shift]) => {
    addFee(seat, amt, curM, curY, now.toISOString().split('T')[0], shift);
  });
  // Previous month fees
  [[1,500,'Morning'],[2,500,'Evening'],[3,800,'Double Shift'],[5,500,'Night'],[7,500,'Morning'],[12,500,'Morning'],[15,800,'Double Shift']].forEach(([seat,amt,shift]) => {
    const d = new Date(prevY, prevM-1, 5).toISOString().split('T')[0];
    addFee(seat, amt, prevM, prevY, d, shift);
  });
  DB.setFees(sampleFees);
  DB.addActivity('🚀', 'LibraNova initialized with sample data');
})();