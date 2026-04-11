/* ============================================
   ADMIN PANEL - MAIN JS
   ============================================ */

const API = '/api';
let adminToken = null;
let adminUser = null;
let adminConfirmCallback = null;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
});

// ============================================
// API HELPERS
// ============================================
async function adminApiCall(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (adminToken) {
    headers['Authorization'] = `Bearer ${adminToken}`;
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
// AUTH
// ============================================
function checkAdminAuth() {
  adminToken = localStorage.getItem('adminToken');
  const savedUser = localStorage.getItem('adminUser');

  if (adminToken && savedUser) {
    adminApiCall('/admin/verify')
      .then(data => {
        adminUser = data.username;
        showAdminDashboard();
      })
      .catch(() => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        showAdminLogin();
      });
  } else {
    showAdminLogin();
  }
}

function showAdminLogin() {
  document.getElementById('adminLoginScreen').classList.remove('hidden');
  document.getElementById('adminDashboard').classList.add('hidden');
}

function showAdminDashboard() {
  document.getElementById('adminLoginScreen').classList.add('hidden');
  document.getElementById('adminDashboard').classList.remove('hidden');
  document.getElementById('adminSidebarUser').textContent = adminUser;
  document.getElementById('adminTopbarUser').textContent = adminUser;
  loadAdminOverview();
}

async function handleAdminLogin() {
  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value;

  if (!username || !password) {
    showAdminToast('Please enter both username and PIN', 'error');
    return;
  }

  const btn = document.getElementById('adminLoginBtn');
  btn.classList.add('loading');

  try {
    const data = await adminApiCall('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    adminToken = data.token;
    adminUser = data.username;
    localStorage.setItem('adminToken', adminToken);
    localStorage.setItem('adminUser', adminUser);

    showAdminDashboard();
  } catch (err) {
    showAdminToast(err.message, 'error');
  } finally {
    btn.classList.remove('loading');
  }
}

function handleAdminLogout() {
  showAdminConfirm('Logout', 'Are you sure you want to logout?', () => {
    adminToken = null;
    adminUser = null;
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
    showAdminLogin();
    showAdminToast('Logged out successfully', 'info');
  });
}

// ============================================
// NAVIGATION
// ============================================
function switchAdminSection(section) {
  document.querySelectorAll('.admin-content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById(`admin-section-${section}`);
  if (target) {
    target.classList.remove('active');
    target.offsetHeight;
    target.classList.add('active');
  }

  const navItem = document.querySelector(`.admin-nav-item[data-section="${section}"]`);
  if (navItem) navItem.classList.add('active');

  const titles = {
    overview: 'Overview',
    pending: 'Pending User Approvals',
    users: 'All Users',
    expiring: 'Expiring Licenses'
  };
  document.getElementById('adminPageTitle').textContent = titles[section] || 'Overview';

  if (section === 'overview') loadAdminOverview();
  if (section === 'pending') loadPendingUsers();
  if (section === 'users') loadAllUsers();
  if (section === 'expiring') loadExpiringRecords();

  document.getElementById('adminSidebar').classList.remove('open');
  return false;
}

function toggleAdminSidebar() {
  document.getElementById('adminSidebar').classList.toggle('open');
}

// ============================================
// OVERVIEW / STATS
// ============================================
async function loadAdminOverview() {
  try {
    const stats = await adminApiCall('/admin/stats');

    animateAdminCounter('statTotalUsers', stats.totalUsers);
    animateAdminCounter('statPendingUsers', stats.pendingUsers);
    animateAdminCounter('statApprovedUsers', stats.approvedUsers);
    animateAdminCounter('statTotalRecords', stats.totalRecords);
    animateAdminCounter('statActiveRecords', stats.activeRecords);
    animateAdminCounter('statExpiringRecords', stats.expiringCount);

    document.getElementById('pendingBadge').textContent = stats.pendingUsers;
  } catch (err) {
    showAdminToast('Error loading stats', 'error');
  }
}

function animateAdminCounter(id, target) {
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
// PENDING USERS
// ============================================
async function loadPendingUsers() {
  try {
    const users = await adminApiCall('/admin/users/pending');
    const tbody = document.querySelector('#pendingUsersTable tbody');
    const empty = document.getElementById('noPendingUsers');
    tbody.innerHTML = '';

    if (users.length === 0) {
      empty.classList.remove('hidden');
      document.querySelector('#pendingUsersTable').closest('.admin-table-responsive').classList.add('hidden');
      return;
    }

    empty.classList.add('hidden');
    document.querySelector('#pendingUsersTable').closest('.admin-table-responsive').classList.remove('hidden');

    users.forEach((u, i) => {
      const row = document.createElement('tr');
      row.style.animationDelay = `${i * 0.05}s`;
      row.innerHTML = `
        <td>${i + 1}</td>
        <td><strong>${escapeAdminHtml(u.username)}</strong></td>
        <td>${formatDate(u.createdAt)}</td>
        <td>
          <div class="admin-action-btns">
            <button class="admin-btn admin-btn-success admin-btn-sm" onclick="approveUser('${u._id}', '${escapeAdminHtml(u.username)}')">
              <i class="fas fa-check"></i> Approve
            </button>
            <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="rejectUser('${u._id}', '${escapeAdminHtml(u.username)}')">
              <i class="fas fa-times"></i> Reject
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });

    document.getElementById('pendingBadge').textContent = users.length;
  } catch (err) {
    showAdminToast('Error loading pending users', 'error');
  }
}

async function approveUser(id, username) {
  showAdminConfirm('Approve User', `Approve "${username}" to access the system?`, async () => {
    try {
      await adminApiCall(`/admin/users/${id}/approve`, { method: 'PATCH' });
      showAdminToast(`"${username}" has been approved!`, 'success');
      loadPendingUsers();
      loadAdminOverview();
    } catch (err) {
      showAdminToast(err.message, 'error');
    }
  });
}

async function rejectUser(id, username) {
  showAdminConfirm('Reject User', `Remove "${username}"? This will delete their account.`, async () => {
    try {
      await adminApiCall(`/admin/users/${id}`, { method: 'DELETE' });
      showAdminToast(`"${username}" has been removed.`, 'success');
      loadPendingUsers();
      loadAdminOverview();
    } catch (err) {
      showAdminToast(err.message, 'error');
    }
  });
}

// ============================================
// ALL USERS
// ============================================
async function loadAllUsers() {
  try {
    const users = await adminApiCall('/admin/users');
    const tbody = document.querySelector('#allUsersTable tbody');
    const empty = document.getElementById('noUsers');
    tbody.innerHTML = '';

    if (users.length === 0) {
      empty.classList.remove('hidden');
      document.querySelector('#allUsersTable').closest('.admin-table-responsive').classList.add('hidden');
      return;
    }

    empty.classList.add('hidden');
    document.querySelector('#allUsersTable').closest('.admin-table-responsive').classList.remove('hidden');

    users.forEach((u, i) => {
      const row = document.createElement('tr');
      row.style.animationDelay = `${i * 0.03}s`;
      const statusClass = u.isApproved ? 'admin-status-approved' : 'admin-status-pending';
      const statusText = u.isApproved ? 'Approved' : 'Pending';
      row.innerHTML = `
        <td>${i + 1}</td>
        <td><strong>${escapeAdminHtml(u.username)}</strong></td>
        <td><span class="admin-status-badge ${statusClass}">${statusText}</span></td>
        <td>${formatDate(u.createdAt)}</td>
        <td>
          <div class="admin-action-btns">
            ${!u.isApproved ? `
              <button class="admin-btn admin-btn-success admin-btn-sm" onclick="approveUser('${u._id}', '${escapeAdminHtml(u.username)}')">
                <i class="fas fa-check"></i> Approve
              </button>
            ` : `
              <button class="admin-btn admin-btn-warning admin-btn-sm" onclick="revokeUser('${u._id}', '${escapeAdminHtml(u.username)}')">
                <i class="fas fa-ban"></i> Revoke
              </button>
            `}
            <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="rejectUser('${u._id}', '${escapeAdminHtml(u.username)}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    showAdminToast('Error loading users', 'error');
  }
}

async function revokeUser(id, username) {
  showAdminConfirm('Revoke Access', `Revoke access for "${username}"? They will not be able to login.`, async () => {
    try {
      await adminApiCall(`/admin/users/${id}/revoke`, { method: 'PATCH' });
      showAdminToast(`Access revoked for "${username}".`, 'success');
      loadAllUsers();
      loadAdminOverview();
    } catch (err) {
      showAdminToast(err.message, 'error');
    }
  });
}

// ============================================
// EXPIRING LICENSES
// ============================================
async function loadExpiringRecords() {
  try {
    const days = document.getElementById('expiryDaysFilter').value;
    const records = await adminApiCall(`/admin/expiring?days=${days}`);
    const tbody = document.querySelector('#expiringTable tbody');
    const empty = document.getElementById('noExpiring');
    tbody.innerHTML = '';

    if (records.length === 0) {
      empty.classList.remove('hidden');
      document.querySelector('#expiringTable').closest('.admin-table-responsive').classList.add('hidden');
      return;
    }

    empty.classList.add('hidden');
    document.querySelector('#expiringTable').closest('.admin-table-responsive').classList.remove('hidden');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    records.forEach((r, i) => {
      const expiryDate = new Date(r.expiryDate + 'T00:00:00');
      const diffTime = expiryDate - today;
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let daysBadgeClass = 'admin-days-ok';
      if (daysLeft <= 2) daysBadgeClass = 'admin-days-critical';
      else if (daysLeft <= 5) daysBadgeClass = 'admin-days-warning';

      const row = document.createElement('tr');
      row.style.animationDelay = `${i * 0.03}s`;
      row.innerHTML = `
        <td>${i + 1}</td>
        <td>${escapeAdminHtml(r.customerName)}</td>
        <td>${escapeAdminHtml(r.vehicleName)}</td>
        <td>${escapeAdminHtml(r.vehicleNumber)}</td>
        <td>${escapeAdminHtml(r.telephoneNumber)}</td>
        <td>${r.expiryDate}</td>
        <td><span class="admin-days-badge ${daysBadgeClass}">${daysLeft} day${daysLeft !== 1 ? 's' : ''}</span></td>
        <td>
          <button class="admin-btn admin-btn-whatsapp admin-btn-sm" onclick="sendWhatsAppReminder('${escapeAdminHtml(r.telephoneNumber)}', '${escapeAdminHtml(r.customerName)}', '${escapeAdminHtml(r.vehicleNumber)}', '${r.expiryDate}')">
            <i class="fab fa-whatsapp"></i> Send
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    showAdminToast('Error loading expiring records', 'error');
  }
}

function sendWhatsAppReminder(phone, customer, vehicle, expiry) {
  const cleanPhone = phone.replace('+', '');
  const message = `Dear ${customer}, this is a reminder from *Afrigyei Testing Station (AWOSHIE DVLA)*.

Your vehicle *${vehicle}* roadworthy certificate is due to expire on *${expiry}*.

Please visit us to renew your certificate before the expiry date to avoid any inconvenience.

Thank you for choosing Afrigyei Testing Station.`;

  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  showAdminToast(`WhatsApp reminder opened for ${customer}`, 'success');
}

// ============================================
// TOAST
// ============================================
function showAdminToast(message, type = 'info') {
  const container = document.getElementById('adminToastContainer');
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = `admin-toast admin-toast-${type}`;
  toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${escapeAdminHtml(message)}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'adminToastOut 0.4s ease forwards';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ============================================
// CONFIRM DIALOG
// ============================================
function showAdminConfirm(title, message, callback) {
  document.getElementById('adminConfirmTitle').textContent = title;
  document.getElementById('adminConfirmMessage').textContent = message;
  adminConfirmCallback = callback;
  document.getElementById('adminConfirmDialog').classList.remove('hidden');
}

function adminConfirmAction() {
  document.getElementById('adminConfirmDialog').classList.add('hidden');
  if (adminConfirmCallback) adminConfirmCallback();
  adminConfirmCallback = null;
}

function closeAdminConfirm() {
  document.getElementById('adminConfirmDialog').classList.add('hidden');
  adminConfirmCallback = null;
}

// ============================================
// UTILITIES
// ============================================
function escapeAdminHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
