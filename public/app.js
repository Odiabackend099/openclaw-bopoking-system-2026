// VoxAn Control Center Dashboard - Client-Side Application
// Pure vanilla JavaScript - no frameworks

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let currentData = null;
let currentTab = 'overview';
let refreshInterval = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Load saved tab preference
  const savedTab = localStorage.getItem('currentTab');
  if (savedTab) {
    currentTab = savedTab;
  }

  // Set up tab navigation
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      showTab(tabName);
    });
  });

  // Set up refresh button
  const refreshBtn = document.querySelector('.btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadDashboardData();
    });
  }

  // Initial data load
  loadDashboardData();

  // Auto-refresh every 60 seconds
  refreshInterval = setInterval(() => {
    loadDashboardData();
  }, 60000);

  // Show saved tab
  showTab(currentTab);
});

// ============================================================================
// TAB NAVIGATION
// ============================================================================

function showTab(tabName) {
  // Update active tab button
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });

  // Show/hide tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
    if (content.id === `${tabName}-tab`) {
      content.classList.add('active');
    }
  });

  // Save preference
  currentTab = tabName;
  localStorage.setItem('currentTab', tabName);
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadDashboardData() {
  try {
    const response = await fetch('/api/dashboard');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    currentData = data;

    // Update last updated timestamp
    updateLastUpdated();

    // Render all sections
    renderOverview(data);
    renderCalls(data.calls || []);
    renderLeads(data.leads || []);
    renderAppointments(data.appointments || []);

  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    showError('Couldn\'t load your data. Check your internet and try again.');
  }
}

function updateLastUpdated() {
  const lastUpdatedEl = document.querySelector('.last-updated');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = 'Last updated: Just now';
  }
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function renderOverview(data) {
  const stats = data.stats || {};

  // Update stat cards
  updateStatCard('total-calls', stats.totalCalls || 0);
  updateStatCard('answer-rate', `${stats.answerRate || 0}%`);
  updateStatCard('bookings', stats.totalAppointments || 0);
  updateStatCard('ai-cost', `$${stats.totalCost || '0'}`);

  // Render recent activity
  renderRecentActivity(data);
}

function updateStatCard(id, value) {
  const card = document.getElementById(id);
  if (card) {
    const valueEl = card.querySelector('.stat-value');
    if (valueEl) {
      // Animate number counting up
      animateValue(valueEl, 0, parseFloat(value) || 0, 500);
    }
  }
}

function animateValue(element, start, end, duration) {
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;

  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      current = end;
      clearInterval(timer);
    }

    // Format based on content
    const formatted = element.textContent.includes('$')
      ? `$${Math.round(current)}`
      : element.textContent.includes('%')
      ? `${Math.round(current)}%`
      : Math.round(current).toString();

    element.textContent = formatted;
  }, 16);
}

function renderRecentActivity(data) {
  const activityList = document.querySelector('.activity-list');
  if (!activityList) return;

  const activities = [];

  // Add recent calls
  const recentCalls = (data.calls || []).slice(0, 5);
  recentCalls.forEach(call => {
    activities.push({
      type: 'call',
      timestamp: new Date(call.created_at),
      html: formatCallActivity(call)
    });
  });

  // Add recent appointments
  const recentAppts = (data.appointments || []).slice(0, 5);
  recentAppts.forEach(appt => {
    activities.push({
      type: 'appointment',
      timestamp: new Date(appt.created_at),
      html: formatAppointmentActivity(appt)
    });
  });

  // Sort by timestamp (most recent first)
  activities.sort((a, b) => b.timestamp - a.timestamp);

  // Render
  if (activities.length === 0) {
    activityList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">No activity yet</div>
        <div class="empty-state-text">
          Your AI agent hasn't received any calls yet. Once someone calls your business number,
          their activity will appear here automatically.
        </div>
      </div>
    `;
  } else {
    activityList.innerHTML = activities.slice(0, 5).map(a => a.html).join('');
  }
}

function formatCallActivity(call) {
  const status = call.success ? '✅' : '❌';
  const outcome = call.outcome || 'No outcome recorded';
  return `
    <div class="activity-item">
      ${status} ${call.caller_name || 'Unknown caller'} called — ${outcome}
    </div>
  `;
}

function formatAppointmentActivity(appt) {
  const date = formatDate(appt.appointment_time);
  return `
    <div class="activity-item">
      ✅ ${appt.contact_name || 'Unknown'} — Booked for ${date}
    </div>
  `;
}

// ============================================================================
// CALLS TAB
// ============================================================================

function renderCalls(calls) {
  const callsList = document.querySelector('.calls-list');
  if (!callsList) return;

  if (calls.length === 0) {
    callsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📞</div>
        <div class="empty-state-title">No calls yet</div>
        <div class="empty-state-text">
          Your AI agent will log calls here automatically as they happen.
          No action needed — calls will show up here as they occur.
        </div>
      </div>
    `;
    return;
  }

  callsList.innerHTML = calls.map(call => {
    const statusIcon = getCallStatusIcon(call.status);
    const statusLabel = getCallStatusLabel(call.status);
    const duration = formatDuration(call.duration_seconds || 0);
    const cost = formatCost(call.cost || 0);
    const date = formatDate(call.created_at);
    const phone = formatPhone(call.phone_number || call.from_number);

    return `
      <div class="call-item">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div>
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">
              ${statusIcon} ${call.caller_name || phone}
            </div>
            <div style="font-size: 13px; color: #6b7280;">
              ${statusLabel} · ${duration} · ${cost}
            </div>
          </div>
          <div style="font-size: 13px; color: #6b7280;">
            ${date}
          </div>
        </div>
        ${call.outcome ? `
          <div style="font-size: 14px; margin-top: 8px; color: #1f2937;">
            Outcome: ${call.outcome}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function getCallStatusIcon(status) {
  const icons = {
    'completed': '✅',
    'no-answer': '❌',
    'voicemail': '📱',
    'in-progress': '⏳',
    'outbound': '📤'
  };
  return icons[status] || '📞';
}

function getCallStatusLabel(status) {
  const labels = {
    'completed': 'Answered',
    'no-answer': 'Missed',
    'voicemail': 'Voicemail',
    'in-progress': 'In Progress',
    'outbound': 'Outbound'
  };
  return labels[status] || status;
}

// ============================================================================
// LEADS TAB
// ============================================================================

function renderLeads(leads) {
  const leadsGrid = document.querySelector('.leads-grid');
  if (!leadsGrid) return;

  if (leads.length === 0) {
    leadsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">No leads yet</div>
        <div class="empty-state-text">
          Leads are created automatically when someone calls your business.
          They'll appear here with contact information and lead scores.
        </div>
      </div>
    `;
    return;
  }

  leadsGrid.innerHTML = leads.map(lead => {
    const badge = getLeadBadge(lead.lead_status);
    const phone = formatPhone(lead.phone);
    const lastContact = lead.last_contact_at ? formatDate(lead.last_contact_at) : 'Never';
    const contactCount = lead.contact_count || 0;

    return `
      <div class="lead-card">
        <div class="lead-header">
          <div class="lead-name">${lead.first_name} ${lead.last_name}</div>
          <span class="lead-badge ${badge.class}">${badge.label}</span>
        </div>
        ${lead.practice_name ? `
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
            ${lead.practice_name}
          </div>
        ` : ''}
        <div style="font-size: 14px; margin-bottom: 4px;">
          📞 ${phone}
        </div>
        ${lead.email ? `
          <div style="font-size: 14px; margin-bottom: 8px;">
            ✉️ ${lead.email}
          </div>
        ` : ''}
        <div style="font-size: 13px; color: #6b7280;">
          Last contact: ${lastContact} · Called ${contactCount} ${contactCount === 1 ? 'time' : 'times'}
        </div>
        <div class="lead-actions">
          <button class="btn btn-primary" onclick="callLead('${lead.phone}', '${lead.first_name} ${lead.last_name}')">
            📞 Call Now
          </button>
          <button class="btn" onclick="viewLeadDetails('${lead.id}')">
            📝 Notes
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function getLeadBadge(status) {
  const badges = {
    'hot': { label: '🔥 Hot Lead', class: 'badge-hot' },
    'warm': { label: '🟡 Warm', class: 'badge-warm' },
    'new': { label: '🔵 New', class: 'badge-new' },
    'cold': { label: '⚪ Cold', class: 'badge-cold' }
  };
  return badges[status] || badges.new;
}

// ============================================================================
// APPOINTMENTS TAB
// ============================================================================

function renderAppointments(appointments) {
  const apptList = document.querySelector('.appointments-list');
  if (!apptList) return;

  if (appointments.length === 0) {
    apptList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <div class="empty-state-title">No appointments yet</div>
        <div class="empty-state-text">
          When someone books an appointment through your AI agent,
          it will appear here with all the details.
        </div>
      </div>
    `;
    return;
  }

  // Group by date
  const grouped = groupAppointmentsByDate(appointments);

  apptList.innerHTML = Object.entries(grouped).map(([date, appts]) => {
    const apptHtml = appts.map(appt => {
      const time = formatTime(appt.appointment_time);
      const status = getAppointmentStatus(appt.status);

      return `
        <div class="appointment-item">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                ${time} — ${appt.contact_name || 'Unknown'}
              </div>
              <div style="font-size: 14px; color: #6b7280;">
                ${appt.service_name || 'General Appointment'}
              </div>
            </div>
            <span style="font-size: 14px;">${status}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
          ${date}
        </div>
        ${apptHtml}
      </div>
    `;
  }).join('');
}

function groupAppointmentsByDate(appointments) {
  const grouped = {};
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  appointments.forEach(appt => {
    const apptDate = new Date(appt.appointment_time);
    let dateKey;

    if (isSameDay(apptDate, today)) {
      dateKey = `TODAY — ${formatDateHeader(apptDate)}`;
    } else if (isSameDay(apptDate, tomorrow)) {
      dateKey = `TOMORROW — ${formatDateHeader(apptDate)}`;
    } else {
      dateKey = formatDateHeader(apptDate);
    }

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(appt);
  });

  return grouped;
}

function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

function formatDateHeader(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getAppointmentStatus(status) {
  const statuses = {
    'confirmed': '✅ Confirmed',
    'pending': '⏳ Pending',
    'cancelled': '❌ Cancelled',
    'completed': '✅ Completed'
  };
  return statuses[status] || status;
}

// ============================================================================
// ACTIONS
// ============================================================================

async function callLead(phone, name) {
  if (!phone) {
    alert('Phone number is required');
    return;
  }

  if (!confirm(`Call ${name || phone}?`)) {
    return;
  }

  const button = event.target;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Calling...';

  try {
    const response = await fetch('/api/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone })
    });

    if (!response.ok) {
      throw new Error('Call failed');
    }

    showToast('✅ Your AI agent is calling now. You\'ll see the results here when the call ends.');

    // Refresh data after 5 seconds
    setTimeout(() => {
      loadDashboardData();
    }, 5000);

  } catch (error) {
    console.error('Call error:', error);
    showToast('❌ Couldn\'t start the call. Check your internet and try again.');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function viewLeadDetails(leadId) {
  // Placeholder for future implementation
  showToast('Lead details coming soon!');
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

function formatPhone(raw) {
  if (!raw) return 'Unknown';

  // Remove all non-digits
  const digits = raw.replace(/\D/g, '');

  // Format as (555) 123-4567
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return raw;
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0 sec';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds} sec`;
  } else {
    return `${minutes} min ${remainingSeconds} sec`;
  }
}

function formatCost(amount) {
  if (!amount || amount === 0) return '$0.00';

  // If amount is in cents, convert to dollars
  const dollars = amount > 100 ? amount / 100 : amount;

  return `$${dollars.toFixed(2)}`;
}

function formatDate(isoString) {
  if (!isoString) return 'Unknown';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Today
  if (diffDays === 0 && date.getDate() === now.getDate()) {
    return `Today ${formatTime(isoString)}`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getDate() === yesterday.getDate()) {
    return `Yesterday ${formatTime(isoString)}`;
  }

  // Within 7 days
  if (diffDays < 7) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    return `${dayName} ${formatTime(isoString)}`;
  }

  // Older
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

// ============================================================================
// UI UTILITIES
// ============================================================================

function showToast(message) {
  // Simple toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #1f2937;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'empty-state';
  errorDiv.innerHTML = `
    <div class="empty-state-icon">⚠️</div>
    <div class="empty-state-title">Error</div>
    <div class="empty-state-text">${message}</div>
    <button class="btn btn-primary" onclick="loadDashboardData()" style="margin-top: 16px;">
      Try Again
    </button>
  `;

  // Replace current tab content with error
  const activeTab = document.querySelector('.tab-content.active');
  if (activeTab) {
    activeTab.innerHTML = '';
    activeTab.appendChild(errorDiv);
  }
}

// ============================================================================
// CSS ANIMATIONS
// ============================================================================

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
