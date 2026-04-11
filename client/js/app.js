/* ============================================
   AFRIGYEI TESTING STATION - MAIN APP JS
   ============================================ */

const API = '/api';
let currentUser = null;
let authToken = null;
let editingRecordId = null;
let currentRecords = [];
let confirmCallback = null;
let promptCallback = null;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initPhoneInput();
  checkAuth();
});

// ============================================
// PARTICLES.JS BACKGROUND
// ============================================
function initParticles() {
  if (typeof tsParticles === 'undefined') return;

  tsParticles.load("particles-js", {
    fullScreen: { enable: false },
    background: { color: { value: "transparent" } },
    fpsLimit: 60,
    particles: {
      number: { value: 80, density: { enable: true, area: 800 } },
      color: { value: ["#3b82f6", "#60a5fa", "#93c5fd", "#ffffff"] },
      shape: { type: ["circle", "triangle"] },
      opacity: {
        value: { min: 0.1, max: 0.5 },
        animation: { enable: true, speed: 1, minimumValue: 0.1, sync: false }
      },
      size: {
        value: { min: 1, max: 4 },
        animation: { enable: true, speed: 2, minimumValue: 0.5, sync: false }
      },
      links: {
        enable: true,
        distance: 150,
        color: "#3b82f6",
        opacity: 0.15,
        width: 1
      },
      move: {
        enable: true,
        speed: 1.5,
        direction: "none",
        random: true,
        straight: false,
        outModes: { default: "out" },
        attract: { enable: true, rotateX: 600, rotateY: 1200 }
      }
    },
    interactivity: {
      detectsOn: "canvas",
      events: {
        onHover: { enable: true, mode: "grab" },
        onClick: { enable: true, mode: "push" },
        resize: true
      },
      modes: {
        grab: { distance: 140, links: { opacity: 0.4 } },
        push: { quantity: 4 }
      }
    },
    detectRetina: true
  });
}

// ============================================
// PHONE INPUT HANDLING
// ============================================
function initPhoneInput() {
  const phoneInput = document.getElementById('telephoneNumber');
  if (!phoneInput) return;

  phoneInput.value = '+233';
  phoneInput.addEventListener('input', enforcePhonePrefix);
  phoneInput.addEventListener('keydown', preventPrefixDeletion);
  phoneInput.addEventListener('paste', handlePhonePaste);
  phoneInput.addEventListener('focus', () => {
    if (phoneInput.value === '+233') {
      phoneInput.setSelectionRange(4, 4);
    }
  });
}

function enforcePhonePrefix(e) {
  const input = e.target;
  let value = input.value.replace(/[^0-9+]/g, '');
  if (!value.startsWith('+233')) {
    value = '+233' + value.replace(/^\+233/, '');
  }
  input.value = value.slice(0, 13);
  validatePhone(input);
}

function preventPrefixDeletion(e) {
  const input = e.target;
  if (input.selectionStart <= 4 && (e.key === 'Backspace' || e.key === 'Delete')) {
    e.preventDefault();
    input.setSelectionRange(4, 4);
  }
}

function handlePhonePaste(e) {
  e.preventDefault();
  const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
  e.target.value = '+233' + pasted.slice(0, 9);
  validatePhone(e.target);
}

function validatePhone(input) {
  const error = document.getElementById('phoneError');
  if (!/^\+233\d{9}$/.test(input.value) && input.value.length > 4) {
    error.classList.remove('hidden');
    input.style.borderColor = '#ef4444';
  } else {
    error.classList.add('hidden');
    input.style.borderColor = '';
  }
}

// ============================================
// API HELPERS
// ============================================
async function apiCall(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

// ============================================
// AUTH CHECK
// ============================================
function checkAuth() {
  authToken = localStorage.getItem('authToken');
  const savedUser = localStorage.getItem('currentUser');

  if (authToken && savedUser) {
    apiCall('/auth/verify')
      .then(data => {
        currentUser = data.username;
        showApp();
      })
      .catch(() => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        showAuthScreen();
      });
  } else {
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('appContainer').classList.add('hidden');
}

// ============================================
// AUTH ACTIONS
// ============================================
function showRegister() {
  document.getElementById('loginForm').classList.add('hidden');
  const reg = document.getElementById('registerForm');
  reg.classList.remove('hidden');
  reg.style.animation = 'none';
  reg.offsetHeight; // trigger reflow
  reg.style.animation = 'authSlideUp 0.5s ease forwards';
}

function showLogin() {
  document.getElementById('registerForm').classList.add('hidden');
  const login = document.getElementById('loginForm');
  login.classList.remove('hidden');
  login.style.animation = 'none';
  login.offsetHeight;
  login.style.animation = 'authSlideUp 0.5s ease forwards';
}

async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showToast('Please enter both username and PIN', 'error');
    return;
  }

  const btn = document.getElementById('loginBtn');
  btn.classList.add('loading');

  try {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    authToken = data.token;
    currentUser = data.username;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('currentUser', currentUser);

    showWelcomeTransition();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.classList.remove('loading');
  }
}

async function handleRegister() {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;

  if (!username || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  if (username.length < 4) {
    showToast('Username must be at least 4 characters', 'error');
    return;
  }

  if (!/^\d{4}$/.test(password)) {
    showToast('PIN must be exactly 4 digits', 'error');
    return;
  }

  const btn = document.getElementById('registerBtn');
  btn.classList.add('loading');

  try {
    await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    showToast('Registration successful! Your account is pending admin approval.', 'success');
    showLogin();
    document.getElementById('regUsername').value = '';
    document.getElementById('regPassword').value = '';
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.classList.remove('loading');
  }
}

async function forgotCredentials() {
  showPrompt('Forgot Credentials', 'Type USERNAME to recover or PASSWORD to reset:', async (choice) => {
    if (!choice) return;
    const upper = choice.toUpperCase();

    if (upper === 'USERNAME') {
      try {
        const usernames = await apiCall('/auth/usernames');
        if (usernames.length === 0) {
          showToast('No users registered', 'info');
        } else {
          showToast('Users: ' + usernames.join(', '), 'info');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    } else if (upper === 'PASSWORD') {
      showPrompt('Reset PIN', 'Enter your username:', async (username) => {
        if (!username) return;
        showPrompt('New PIN', 'Enter new 4-digit PIN:', async (newPin) => {
          if (!newPin || !/^\d{4}$/.test(newPin)) {
            showToast('PIN must be exactly 4 digits', 'error');
            return;
          }
          try {
            await apiCall('/auth/reset-password', {
              method: 'POST',
              body: JSON.stringify({ username: username.trim(), newPassword: newPin })
            });
            showToast('PIN reset successfully!', 'success');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    } else {
      showToast('Invalid choice. Type USERNAME or PASSWORD', 'warning');
    }
  });
}

function handleLogout() {
  showConfirm('Logout', 'Are you sure you want to logout?', () => {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    showAuthScreen();
    showToast('Logged out successfully', 'info');
  });
}

// ============================================
// WELCOME TRANSITION
// ============================================
function showWelcomeTransition() {
  document.getElementById('authScreen').classList.add('hidden');
  const welcome = document.getElementById('welcomeScreen');
  welcome.classList.remove('hidden');

  setTimeout(() => {
    welcome.classList.add('hidden');
    showApp();
  }, 2500);
}

function showApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');

  document.getElementById('sidebarUser').textContent = currentUser;
  document.getElementById('topbarUsername').textContent = currentUser;

  loadDashboard();
  loadVehicleNames();
}

// ============================================
// NAVIGATION
// ============================================
function switchSection(section) {
  document.querySelectorAll('.content-section').forEach(s => {
    s.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
  });

  const target = document.getElementById(`section-${section}`);
  if (target) {
    target.classList.remove('active');
    target.offsetHeight; // reflow
    target.classList.add('active');
  }

  const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (navItem) navItem.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    addRecord: 'Add Record',
    records: 'Vehicle Records',
    editRecord: 'Edit Record',
    reminders: 'Expiry Reminders',
    export: 'Export Records'
  };
  document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';

  // Load data for section
  if (section === 'dashboard') loadDashboard();
  if (section === 'records') loadRecords();
  if (section === 'editRecord') loadEditSection();
  if (section === 'reminders') loadReminders();

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');

  return false;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  try {
    const [active, cleared, deleted, expiring] = await Promise.all([
      apiCall('/records?status=active'),
      apiCall('/records?status=cleared'),
      apiCall('/records?status=deleted'),
      apiCall('/records/reminders')
    ]);

    animateCounter('statActive', active.length);
    animateCounter('statCleared', cleared.length);
    animateCounter('statDeleted', deleted.length);
    animateCounter('statExpiring', expiring.length);

    // Recent records
    const tbody = document.querySelector('#recentTable tbody');
    tbody.innerHTML = '';

    const recent = active.slice(0, 10);
    if (recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:30px;">No recent records</td></tr>';
    } else {
      recent.forEach((r, i) => {
        const row = document.createElement('tr');
        row.style.animationDelay = `${i * 0.05}s`;
        row.innerHTML = `
          <td>${i + 1}</td>
          <td>${escapeHtml(r.customerName)}</td>
          <td>${escapeHtml(r.vehicleName)}</td>
          <td>${escapeHtml(r.vehicleNumber)}</td>
          <td>${r.expiryDate}</td>
          <td><span class="status-badge status-${r.status}">${r.status}</span></td>
        `;
        tbody.appendChild(row);
      });
    }
  } catch (err) {
    showToast('Error loading dashboard', 'error');
  }
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

// ============================================
// VEHICLE NAMES AUTOCOMPLETE
// ============================================
async function loadVehicleNames() {
  try {
    const names = await apiCall('/records/vehicle-names');
    const datalist = document.getElementById('vehicleNames');
    datalist.innerHTML = '';
    names.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      datalist.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load vehicle names:', err);
  }
}

// ============================================
// ADD / EDIT RECORD
// ============================================
async function handleAddRecord(e) {
  e.preventDefault();

  const customerName = document.getElementById('customerName').value.trim();
  const vehicleName = document.getElementById('vehicleName').value.trim();
  const vehicleNumber = document.getElementById('vehicleNumber').value.trim();
  const telephoneNumber = document.getElementById('telephoneNumber').value.trim();
  const chassisNumber = document.getElementById('chassisNumber').value.trim();
  const pc = document.getElementById('pc').value.trim();
  const expiryDate = document.getElementById('expiryDate').value;

  if (!customerName || !vehicleName || !vehicleNumber || !telephoneNumber || !chassisNumber || !pc || !expiryDate) {
    showToast('Please fill out all fields', 'error');
    return;
  }

  if (!/^\+233\d{9}$/.test(telephoneNumber)) {
    showToast('Please enter a valid Ghanaian telephone number', 'error');
    return;
  }

  const body = { customerName, vehicleName, vehicleNumber, telephoneNumber, chassisNumber, pc, expiryDate };

  try {
    await apiCall('/records', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    showToast('Record added successfully', 'success');

    clearForm();
    loadVehicleNames();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function clearForm() {
  document.getElementById('addRecordForm').reset();
  document.getElementById('telephoneNumber').value = '+233';
  document.getElementById('phoneError').classList.add('hidden');
  document.getElementById('telephoneNumber').style.borderColor = '';
}

function editRecord(id, record) {
  switchSection('editRecord');
  selectRecordForEdit(id, record);
}

// ============================================
// EDIT RECORDS SECTION
// ============================================
function loadEditSection() {
  searchEditRecords();
  loadEditVehicleNames();
}

async function loadEditVehicleNames() {
  try {
    const names = await apiCall('/records/vehicle-names');
    const datalist = document.getElementById('editVehicleNames');
    datalist.innerHTML = '';
    names.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      datalist.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load vehicle names:', err);
  }
}

async function searchEditRecords() {
  const search = document.getElementById('editSearchInput').value.trim();
  const status = document.getElementById('editStatusFilter').value;

  const params = new URLSearchParams();
  if (status && status !== 'all') params.append('status', status);
  if (search) params.append('search', search);

  try {
    const records = await apiCall(`/records?${params.toString()}`);
    renderEditRecordsTable(records);
  } catch (err) {
    showToast('Error searching records', 'error');
  }
}

function renderEditRecordsTable(records) {
  const tbody = document.querySelector('#editRecordsTable tbody');
  const noRecords = document.getElementById('noEditRecords');
  tbody.innerHTML = '';

  if (records.length === 0) {
    noRecords.classList.remove('hidden');
    document.getElementById('editSearchResults').classList.add('hidden');
    return;
  }

  noRecords.classList.add('hidden');
  document.getElementById('editSearchResults').classList.remove('hidden');

  records.forEach((r, i) => {
    const row = document.createElement('tr');
    row.style.animationDelay = `${i * 0.03}s`;
    if (editingRecordId === r._id) row.classList.add('edit-active-row');
    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(r.customerName)}</td>
      <td>${escapeHtml(r.vehicleName)}</td>
      <td>${escapeHtml(r.vehicleNumber)}</td>
      <td>${r.expiryDate}</td>
      <td><span class="status-badge status-${r.status}">${r.status}</span></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick='selectRecordForEdit("${r._id}", ${JSON.stringify(r).replace(/'/g, "&#39;")})'>
          <i class="fas fa-pen"></i> Edit
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function selectRecordForEdit(id, record) {
  editingRecordId = id;
  const wrapper = document.getElementById('editFormWrapper');
  wrapper.classList.remove('hidden');

  document.getElementById('editingVehicleLabel').textContent = record.vehicleNumber;
  document.getElementById('editCustomerName').value = record.customerName;
  document.getElementById('editVehicleName').value = record.vehicleName;
  document.getElementById('editVehicleNumber').value = record.vehicleNumber;
  document.getElementById('editTelephoneNumber').value = record.telephoneNumber;
  document.getElementById('editChassisNumber').value = record.chassisNumber;
  document.getElementById('editPc').value = record.pc;
  document.getElementById('editExpiryDate').value = record.expiryDate;

  // Highlight selected row
  document.querySelectorAll('#editRecordsTable tbody tr').forEach(tr => tr.classList.remove('edit-active-row'));
  const rows = document.querySelectorAll('#editRecordsTable tbody tr');
  rows.forEach(tr => {
    const btn = tr.querySelector('button');
    if (btn && btn.getAttribute('onclick').includes(id)) {
      tr.classList.add('edit-active-row');
    }
  });

  wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleEditRecord(e) {
  e.preventDefault();

  if (!editingRecordId) {
    showToast('No record selected', 'error');
    return;
  }

  const customerName = document.getElementById('editCustomerName').value.trim();
  const vehicleName = document.getElementById('editVehicleName').value.trim();
  const vehicleNumber = document.getElementById('editVehicleNumber').value.trim();
  const telephoneNumber = document.getElementById('editTelephoneNumber').value.trim();
  const chassisNumber = document.getElementById('editChassisNumber').value.trim();
  const pc = document.getElementById('editPc').value.trim();
  const expiryDate = document.getElementById('editExpiryDate').value;

  if (!customerName || !vehicleName || !vehicleNumber || !telephoneNumber || !chassisNumber || !pc || !expiryDate) {
    showToast('Please fill out all fields', 'error');
    return;
  }

  if (!/^\+233\d{9}$/.test(telephoneNumber)) {
    showToast('Please enter a valid Ghanaian telephone number', 'error');
    return;
  }

  const body = { customerName, vehicleName, vehicleNumber, telephoneNumber, chassisNumber, pc, expiryDate };
  const btn = document.getElementById('editSubmitBtn');
  btn.classList.add('loading');

  try {
    await apiCall(`/records/${editingRecordId}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    showToast('Record updated successfully', 'success');
    cancelEdit();
    searchEditRecords();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.classList.remove('loading');
  }
}

function cancelEdit() {
  editingRecordId = null;
  document.getElementById('editFormWrapper').classList.add('hidden');
  document.getElementById('editRecordForm').reset();
  document.querySelectorAll('#editRecordsTable tbody tr').forEach(tr => tr.classList.remove('edit-active-row'));
}

async function deleteRecord(id) {
  showConfirm('Delete Record', 'Are you sure you want to delete this record?', async () => {
    try {
      await apiCall(`/records/${id}`, { method: 'DELETE' });
      showToast('Record deleted', 'success');
      loadRecords();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ============================================
// LOAD RECORDS
// ============================================
async function loadRecords() {
  const search = document.getElementById('searchInput').value.trim();
  const status = document.getElementById('statusFilter').value;
  const month = document.getElementById('monthFilter').value;

  const params = new URLSearchParams();
  if (status && status !== 'all') params.append('status', status);
  if (search) params.append('search', search);
  if (month && month !== 'all') params.append('month', month);

  try {
    const records = await apiCall(`/records?${params.toString()}`);
    currentRecords = records;
    renderRecordsTable(records);
  } catch (err) {
    showToast('Error loading records', 'error');
  }
}

function renderRecordsTable(records) {
  const tbody = document.querySelector('#vehicleTable tbody');
  const noRecords = document.getElementById('noRecords');
  tbody.innerHTML = '';

  if (records.length === 0) {
    noRecords.classList.remove('hidden');
    return;
  }

  noRecords.classList.add('hidden');

  records.forEach((r, i) => {
    const row = document.createElement('tr');
    row.style.animationDelay = `${i * 0.03}s`;
    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(r.customerName)}</td>
      <td>${escapeHtml(r.vehicleName)}</td>
      <td>${escapeHtml(r.vehicleNumber)}</td>
      <td>${escapeHtml(r.telephoneNumber)}</td>
      <td>${escapeHtml(r.chassisNumber)}</td>
      <td>${escapeHtml(r.pc)}</td>
      <td>${r.expiryDate}</td>
      <td><span class="status-badge status-${r.status}">${r.status}</span></td>
      <td>${escapeHtml(r.createdBy)}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-sm btn-primary" onclick='editRecord("${r._id}", ${JSON.stringify(r).replace(/'/g, "&#39;")})'>
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick='deleteRecord("${r._id}")'>
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ============================================
// BULK ACTIONS
// ============================================
function confirmClearTable() {
  showPrompt('Clear Records', "Type CLEAR to clear active records or DELETE to mark as deleted:", async (action) => {
    if (!action) return;
    const upper = action.toUpperCase();

    if (upper === 'CLEAR') {
      try {
        const result = await apiCall('/records/bulk-status', {
          method: 'PATCH',
          body: JSON.stringify({ fromStatus: 'active', toStatus: 'cleared' })
        });
        showToast(`${result.modifiedCount} records cleared`, 'success');
        loadRecords();
      } catch (err) {
        showToast(err.message, 'error');
      }
    } else if (upper === 'DELETE') {
      showConfirm('Confirm Delete', 'Mark all active records as deleted?', async () => {
        try {
          const result = await apiCall('/records/bulk-status', {
            method: 'PATCH',
            body: JSON.stringify({ fromStatus: 'active', toStatus: 'deleted' })
          });
          showToast(`${result.modifiedCount} records marked as deleted`, 'success');
          loadRecords();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    } else {
      showToast('Invalid action. Type CLEAR or DELETE', 'warning');
    }
  });
}

function retrieveRecords() {
  showPrompt('Retrieve Records', "Type CLEARED or DELETED to retrieve those records:", async (choice) => {
    if (!choice) return;
    const upper = choice.toUpperCase();

    if (upper === 'CLEARED' || upper === 'DELETED') {
      const fromStatus = upper.toLowerCase();
      showConfirm('Confirm Retrieve', `Retrieve all ${fromStatus} records? They will be set to active.`, async () => {
        try {
          const result = await apiCall('/records/bulk-status', {
            method: 'PATCH',
            body: JSON.stringify({ fromStatus, toStatus: 'active' })
          });
          showToast(`${result.modifiedCount} records retrieved`, 'success');
          loadRecords();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    } else {
      showToast('Invalid choice. Type CLEARED or DELETED', 'warning');
    }
  });
}

// ============================================
// REMINDERS
// ============================================
async function loadReminders() {
  try {
    const records = await apiCall('/records/reminders');
    const tbody = document.querySelector('#reminderTable tbody');
    const noReminders = document.getElementById('noReminders');
    tbody.innerHTML = '';

    if (records.length === 0) {
      noReminders.classList.remove('hidden');
      return;
    }
    noReminders.classList.add('hidden');

    records.forEach((r, i) => {
      const row = document.createElement('tr');
      row.style.animationDelay = `${i * 0.05}s`;
      row.innerHTML = `
        <td>${escapeHtml(r.customerName)}</td>
        <td>${escapeHtml(r.vehicleNumber)}</td>
        <td>${escapeHtml(r.telephoneNumber)}</td>
        <td>${r.expiryDate}</td>
        <td>
          <button class="btn btn-sm btn-whatsapp" onclick="sendReminder('${r.telephoneNumber}', '${escapeHtml(r.customerName)}', '${escapeHtml(r.vehicleNumber)}', '${r.expiryDate}')">
            <i class="fab fa-whatsapp"></i> Send via WhatsApp
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    showToast('Error loading reminders', 'error');
  }
}

function exportRemindersToCSV() {
  const table = document.getElementById('reminderTable');
  const rows = table.querySelectorAll('tbody tr');
  if (rows.length === 0) {
    showToast('No contacts to export', 'error');
    return;
  }
  const headers = ['Customer', 'Vehicle Number', 'Telephone', 'Expiry Date'];
  const csvRows = [headers.join(',')];
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    const rowData = [
      '"' + cells[0].textContent.replace(/"/g, '""') + '"',
      '"' + cells[1].textContent.replace(/"/g, '""') + '"',
      '"' + cells[2].textContent.replace(/"/g, '""') + '"',
      '"' + cells[3].textContent.replace(/"/g, '""') + '"'
    ];
    csvRows.push(rowData.join(','));
  });
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'expiry_reminders_' + new Date().toISOString().slice(0, 10) + '.csv';
  link.click();
  URL.revokeObjectURL(url);
  showToast('Contacts exported to CSV', 'success');
}

function sendReminder(phone, customer, vehicle, expiry) {
  const cleanPhone = phone.replace('+', '');
  const message = `Dear ${customer}, this is a reminder from *Afrigyei Testing Station (AWOSHIE DVLA)*.

Your vehicle *${vehicle}* roadworthy certificate is due to expire on *${expiry}*.

Please visit us to renew your certificate before the expiry date to avoid any inconvenience.

Thank you for choosing Afrigyei Testing Station.`;

  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  showToast(`WhatsApp reminder opened for ${customer}`, 'success');
}

// ============================================
// EXPORT
// ============================================
async function exportRecords() {
  const form = document.getElementById('exportForm');
  const selectedColumns = Array.from(form.querySelectorAll('input[name="columns"]:checked')).map(i => i.value);
  const exportType = form.querySelector('input[name="exportType"]:checked').value;
  const exportFiltered = document.getElementById('exportFiltered').checked;

  if (selectedColumns.length === 0) {
    showToast('Select at least one column', 'error');
    return;
  }

  let records;
  if (exportFiltered && currentRecords.length > 0) {
    records = currentRecords;
  } else {
    try {
      records = await apiCall('/records?status=all');
    } catch (err) {
      showToast('Error fetching records for export', 'error');
      return;
    }
  }

  if (records.length === 0) {
    showToast('No records to export', 'warning');
    return;
  }

  const columnLabels = {
    customerName: 'Customer Name',
    vehicleName: 'Vehicle Name',
    vehicleNumber: 'Vehicle Number',
    telephoneNumber: 'Telephone',
    chassisNumber: 'Chassis Number',
    pc: 'P/C',
    expiryDate: 'Expiry Date',
    status: 'Status',
    createdBy: 'Created By'
  };

  const headers = selectedColumns.map(c => columnLabels[c] || c);

  try {
    if (exportType === 'pdf') {
      generatePDF(records, selectedColumns, headers);
    } else {
      generateExcel(records, selectedColumns, headers);
    }
    showToast('Export successful!', 'success');
  } catch (err) {
    console.error('Export error:', err);
    showToast('Export failed', 'error');
  }
}

function generatePDF(data, columns, headers) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Afrigyei Testing Station - Vehicle Inspection Report', 14, 20);
  doc.setFontSize(12);
  doc.text(`Inspector: ${currentUser || 'Unknown'}`, 14, 28);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

  const tableData = data.map((r, i) => [i + 1, ...columns.map(c => r[c] || '')]);

  doc.autoTable({
    head: [['S.No', ...headers]],
    body: tableData,
    startY: 45,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] }
  });

  doc.save(`report_${currentUser}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function generateExcel(data, columns, headers) {
  const wb = XLSX.utils.book_new();
  const excelData = data.map((r, i) => {
    const row = { 'S.No': i + 1 };
    columns.forEach((c, j) => { row[headers[j]] = r[c] || ''; });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(excelData);
  XLSX.utils.book_append_sheet(wb, ws, 'Vehicle Records');
  XLSX.writeFile(wb, `report_${currentUser}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${escapeHtml(message)}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.4s ease forwards';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ============================================
// CONFIRM / PROMPT DIALOGS
// ============================================
function showConfirm(title, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  confirmCallback = callback;
  document.getElementById('confirmDialog').classList.remove('hidden');
}

function confirmAction() {
  document.getElementById('confirmDialog').classList.add('hidden');
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
}

function closeConfirm() {
  document.getElementById('confirmDialog').classList.add('hidden');
  confirmCallback = null;
}

function showPrompt(title, message, callback) {
  document.getElementById('promptTitle').textContent = title;
  document.getElementById('promptMessage').textContent = message;
  document.getElementById('promptInput').value = '';
  promptCallback = callback;
  document.getElementById('promptDialog').classList.remove('hidden');
  document.getElementById('promptInput').focus();
}

function submitPrompt() {
  const value = document.getElementById('promptInput').value;
  document.getElementById('promptDialog').classList.add('hidden');
  if (promptCallback) promptCallback(value);
  promptCallback = null;
}

function closePrompt() {
  document.getElementById('promptDialog').classList.add('hidden');
  promptCallback = null;
}

// ============================================
// UTILITIES
// ============================================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
