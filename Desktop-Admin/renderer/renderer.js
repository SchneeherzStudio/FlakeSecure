/**
 * ============================================================================
 * FlakeSecure Desktop Admin - Renderer Application Logic v2.0.3
 * ============================================================================
 * 
 * Provides interactive dashboard operations for message.md functions:
 * - Announcement creation (popups & banners) with live mobile mockup preview
 * - Announcement deletion and management
 * - Maintenance mode activation/deactivation with safety guards
 * - Server health and diagnostics
 * ============================================================================
 */

const adminIcons = {
  alert: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  check: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  checkCircle: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
  trashModal: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
  alertModal: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  warningModal: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8B020" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  send: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
  spinner: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin" aria-hidden="true"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`,
  inbox: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`,
  popup: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
  banner: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>`,
  bolt: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  plug: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22v-5"></path><path d="M9 8V2"></path><path d="M15 2v6"></path><path d="M18 8v5a6 6 0 0 1-12 0V8z"></path></svg>`,
  eye: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
  eyeOff: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
};

let appConfig = {
  serverUrl: 'https://flakesecure.snowystudio.dev',
  adminSecret: '',
  autoRefresh: true,
  refreshInterval: 10
};

let currentMaintenance = {
  active: false,
  message: null,
  until: null
};

let pollTimer = null;
let pendingConfirmAction = null;

// ─── Initialization ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupFormPreview();
  setupSettingsToggles();
  setupModals();

  // Load saved configuration from electron main process
  try {
    const saved = await window.adminAPI.getConfig();
    if (saved) {
      appConfig = { ...appConfig, ...saved };
    }
  } catch (err) {
    console.error('Failed to load initial config:', err);
  }

  populateSettingsForm();
  updateServerPill();

  // Initial data load
  await refreshAllData();

  // Start background polling
  startAutoRefresh();
});

// ─── Tab Navigation ───────────────────────────────────────────────────────────

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const content = document.getElementById(targetId);
      if (content) content.classList.add('active');
    });
  });

  document.getElementById('btn-global-refresh').addEventListener('click', () => {
    refreshAllData(true);
  });
}

// ─── Live Mobile Preview & Form Setup ─────────────────────────────────────────

function getAdminPriorityTheme(priority = 0) {
  const p = Number(priority) || 0;
  if (p >= 50) {
    return {
      level: 'critical',
      class: 'prio-red',
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.22)',
      border: 'rgba(239, 68, 68, 0.6)',
      iconCircle: 'rgba(239, 68, 68, 0.25)',
      gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)',
      icon: adminIcons.alert,
      title: 'Dringende Mitteilung',
      label: 'Kritisch',
      colorName: 'Rot',
    };
  } else if (p >= 10) {
    return {
      level: 'warning',
      class: 'prio-yellow',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.2)',
      border: 'rgba(245, 158, 11, 0.55)',
      iconCircle: 'rgba(245, 158, 11, 0.25)',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      icon: adminIcons.warning,
      title: 'Wichtige Mitteilung',
      label: 'Wichtig',
      colorName: 'Gelb',
    };
  } else {
    return {
      level: 'info',
      class: 'prio-blue',
      color: '#E8B020',
      bg: 'rgba(232, 176, 32, 0.14)',
      border: 'rgba(232, 176, 32, 0.4)',
      iconCircle: 'rgba(232, 176, 32, 0.2)',
      gradient: 'linear-gradient(135deg, #E8B020, #C9930A)',
      icon: adminIcons.info,
      title: 'Information',
      label: 'Normal',
      colorName: 'Gold',
    };
  }
}

function setupFormPreview() {
  const messageInput = document.getElementById('ann-message');
  const typePopup = document.getElementById('type-popup');
  const typeBanner = document.getElementById('type-banner');
  const priorityInput = document.getElementById('ann-priority');
  const hasExpiryCheckbox = document.getElementById('ann-has-expiry');
  const expiryBox = document.getElementById('box-expiry-options');

  const mockPopupBackdrop = document.getElementById('mock-popup-backdrop');
  const mockPopupCard = document.getElementById('mock-popup-card');
  const mockPopupIcon = document.getElementById('mock-popup-icon');
  const mockPopupTitle = document.getElementById('mock-popup-title');
  const mockPopupText = document.getElementById('mock-popup-text');
  const mockPopupBtn = document.getElementById('mock-popup-btn');

  const mockBanner = document.getElementById('mock-banner');
  const mockBannerIcon = document.getElementById('mock-banner-icon');
  const mockBannerText = document.getElementById('mock-banner-text');
  const mockBannerClose = document.getElementById('mock-banner-close');
  const previewModeLabel = document.getElementById('preview-mode-label');

  function updatePreview() {
    const text = messageInput.value.trim() || 'Vorschautext für deine Nachricht...';
    const isPopup = typePopup.checked;
    const priorityVal = parseInt(priorityInput.value, 10) || 0;
    const theme = getAdminPriorityTheme(priorityVal);

    if (isPopup) {
      mockPopupBackdrop.classList.remove('hidden');
      mockBanner.classList.add('hidden');
      mockPopupText.textContent = text;
      mockPopupTitle.textContent = theme.title;
      mockPopupTitle.style.color = theme.color;
      mockPopupIcon.innerHTML = theme.icon;
      mockPopupCard.style.borderColor = theme.border;
      mockPopupBtn.style.background = theme.gradient;

      previewModeLabel.textContent = `Popup-Modus (${theme.colorName} • Prio ${priorityVal})`;
      previewModeLabel.style.color = theme.color;
      previewModeLabel.style.borderColor = theme.border;
    } else {
      mockPopupBackdrop.classList.add('hidden');
      mockBanner.classList.remove('hidden');
      mockBannerText.textContent = text;
      mockBannerIcon.innerHTML = theme.icon;
      mockBanner.style.backgroundColor = theme.bg;
      mockBanner.style.borderColor = theme.border;
      if (mockBannerClose) mockBannerClose.style.color = theme.color;

      previewModeLabel.textContent = `Banner-Modus (${theme.colorName} • Prio ${priorityVal})`;
      previewModeLabel.style.color = theme.color;
      previewModeLabel.style.borderColor = theme.border;
    }
  }

  messageInput.addEventListener('input', updatePreview);
  typePopup.addEventListener('change', updatePreview);
  typeBanner.addEventListener('change', updatePreview);
  priorityInput.addEventListener('input', updatePreview);

  window.__updateAdminPreview = updatePreview;

  hasExpiryCheckbox.addEventListener('change', () => {
    if (hasExpiryCheckbox.checked) {
      expiryBox.classList.remove('hidden');
    } else {
      expiryBox.classList.add('hidden');
      document.getElementById('ann-expires-at').value = '';
    }
  });

  // Create Announcement Form Submission
  const form = document.getElementById('form-create-announcement');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!appConfig.adminSecret) {
      showToast('Bitte trage zuerst dein Admin-Secret in den Einstellungen ein!', 'error');
      switchToTab('tab-settings');
      return;
    }

    const message = messageInput.value.trim();
    const type = typePopup.checked ? 'popup' : 'banner';
    const display = document.getElementById('disp-once').checked ? 'once' : 'always';
    const priority = parseInt(document.getElementById('ann-priority').value, 10) || 0;

    let expires_at = null;
    if (hasExpiryCheckbox.checked) {
      const expVal = document.getElementById('ann-expires-at').value;
      if (expVal) {
        expires_at = new Date(expVal).toISOString();
      }
    }

    const submitBtn = document.getElementById('btn-create-ann');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `${adminIcons.spinner} <span>Sende Nachricht...</span>`;

    try {
      const res = await window.adminAPI.createAnnouncement({
        message,
        type,
        display,
        priority,
        expires_at
      });

      if (res.ok) {
        showToast('Mitteilung erfolgreich an alle mobilen Apps gesendet!', 'success');
        messageInput.value = '';
        hasExpiryCheckbox.checked = false;
        expiryBox.classList.add('hidden');
        document.getElementById('ann-expires-at').value = '';
        updatePreview();
        await loadAnnouncements();
      } else {
        const errorMsg = (res.data && res.data.error) ? res.data.error : `Fehler ${res.status}: ${res.statusText}`;
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      showToast(`Netzwerkfehler: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${adminIcons.send} <span>Nachricht an alle Apps senden</span>`;
    }
  });

  document.getElementById('btn-refresh-announcements').addEventListener('click', () => {
    loadAnnouncements(true);
  });
}

// Global helper for quick presets
window.setPriority = function (val) {
  document.getElementById('ann-priority').value = val;
  if (typeof window.__updateAdminPreview === 'function') {
    window.__updateAdminPreview();
  }
};

window.setExpiryPreset = function (days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  document.getElementById('ann-expires-at').value = d.toISOString().slice(0, 16);
};

window.setMaintPreset = function (minutes) {
  if (minutes === 0) {
    document.getElementById('maint-until-input').value = '';
    return;
  }
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  document.getElementById('maint-until-input').value = d.toISOString().slice(0, 16);
};

window.setServerUrl = function (url) {
  document.getElementById('setting-server-url').value = url;
};

// ─── Announcements List & Delete ──────────────────────────────────────────────

async function loadAnnouncements(showToastOnSuccess = false) {
  const container = document.getElementById('announcements-container');
  const countBadge = document.getElementById('ann-count-badge');

  try {
    const res = await window.adminAPI.getAnnouncements();

    if (res.ok && res.data && Array.isArray(res.data.announcements)) {
      const items = res.data.announcements;
      countBadge.textContent = items.length;

      if (items.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="empty-icon">${adminIcons.inbox}</span>
            <p>Keine aktiven Mitteilungen auf dem Server vorhanden.</p>
          </div>
        `;
      } else {
        container.innerHTML = items.map(item => {
          const createdStr = item.created_at ? new Date(item.created_at).toLocaleString('de-DE') : '-';
          const expiryStr = item.expires_at ? new Date(item.expires_at).toLocaleString('de-DE') : 'Kein Ablauf';
          const typeClass = item.type === 'popup' ? 'popup' : 'banner';
          const typeLabel = item.type === 'popup' ? 'POPUP' : 'BANNER';
          const typeIcon = item.type === 'popup' ? adminIcons.popup : adminIcons.banner;
          const theme = getAdminPriorityTheme(item.priority);

          return `
            <div class="ann-item-card ${theme.class}" data-id="${item.id}" style="border-left: 4px solid ${theme.color};">
              <div class="ann-item-header">
                <div class="ann-badges-row">
                  <span class="pill-type ${typeClass}">${typeIcon} ${typeLabel}</span>
                  <span class="pill-disp">${item.display === 'once' ? 'Einmalig' : 'Immer'}</span>
                  <span class="pill-prio ${theme.class}">${theme.icon} Prio ${item.priority} (${theme.label})</span>
                </div>
                <div class="ann-actions">
                  <button type="button" class="btn-action-delete" onclick="confirmDeleteAnnouncement('${item.id}')">
                    ${adminIcons.trash} <span>Löschen</span>
                  </button>
                </div>
              </div>
              <div class="ann-message-body">${escapeHtml(item.message)}</div>
              <div class="ann-item-footer">
                <span>Erstellt: ${createdStr}</span>
                <span>Ablauf: ${expiryStr}</span>
              </div>
            </div>
          `;
        }).join('');
      }

      if (showToastOnSuccess) {
        showToast(`Mitteilungen aktualisiert (${items.length} aktiv)`, 'success');
      }
    } else {
      countBadge.textContent = '!';
    }
  } catch (err) {
    console.error('Error loading announcements:', err);
  }
}

window.confirmDeleteAnnouncement = function (id) {
  showConfirmModal({
    icon: adminIcons.trashModal,
    title: 'Mitteilung löschen?',
    desc: 'Diese Nachricht wird sofort vom Server entfernt und in den Apps nicht mehr angezeigt.',
    confirmLabel: 'Ja, unwiderruflich löschen',
    onConfirm: async () => {
      try {
        const res = await window.adminAPI.deleteAnnouncement(id);
        if (res.ok) {
          showToast('Mitteilung gelöscht', 'success');
          await loadAnnouncements();
        } else {
          const err = res.data?.error || `Fehler ${res.status}`;
          showToast(`Löschen fehlgeschlagen: ${err}`, 'error');
        }
      } catch (err) {
        showToast(`Netzwerkfehler: ${err.message}`, 'error');
      }
    }
  });
};

// ─── Maintenance Mode Setup ───────────────────────────────────────────────────

function setupMaintenanceControls() {
  const btnActivate = document.getElementById('btn-activate-maint');
  const btnDeactivate = document.getElementById('btn-deactivate-maint');
  const msgInput = document.getElementById('maint-message-input');
  const untilInput = document.getElementById('maint-until-input');

  btnActivate.addEventListener('click', () => {
    if (!appConfig.adminSecret) {
      showToast('Bitte trage zuerst dein Admin-Secret in den Einstellungen ein!', 'error');
      switchToTab('tab-settings');
      return;
    }

    const message = msgInput.value.trim() || 'Wartungsarbeiten laufen – Server vorübergehend nicht erreichbar.';
    let until = null;
    if (untilInput.value) {
      until = new Date(untilInput.value).toISOString();
    }

    showConfirmModal({
      icon: adminIcons.alertModal,
      title: 'Wartungsmodus aktivieren?',
      desc: 'ACHTUNG: Die mobile App schaltet für alle Nutzer sofort auf den Sperrbildschirm um. Kein Nutzer kann sich mehr anmelden oder Logins abrufen!',
      confirmLabel: 'Ja, Apps sperren',
      onConfirm: async () => {
        try {
          const res = await window.adminAPI.setMaintenance({
            active: true,
            message,
            until
          });

          if (res.ok) {
            showToast('Wartungsmodus AKTIVIERT! Mobile Apps sind jetzt gesperrt.', 'success');
            await loadSystemStatus();
          } else {
            const err = res.data?.error || `Fehler ${res.status}`;
            showToast(`Aktivierung fehlgeschlagen: ${err}`, 'error');
          }
        } catch (err) {
          showToast(`Netzwerkfehler: ${err.message}`, 'error');
        }
      }
    });
  });

  btnDeactivate.addEventListener('click', () => {
    if (!appConfig.adminSecret) {
      showToast('Bitte trage zuerst dein Admin-Secret in den Einstellungen ein!', 'error');
      switchToTab('tab-settings');
      return;
    }

    showConfirmModal({
      icon: adminIcons.checkCircle,
      title: 'Wartungsmodus beenden?',
      desc: 'Die Mobile App wird sofort wieder freigegeben. Alle Nutzer können sich wieder regulär anmelden.',
      confirmLabel: 'Ja, Wartung beenden & Apps freigeben',
      onConfirm: async () => {
        try {
          const res = await window.adminAPI.setMaintenance({
            active: false
          });

          if (res.ok) {
            showToast('Wartungsmodus BEENDET. Apps sind wieder freigegeben!', 'success');
            await loadSystemStatus();
          } else {
            const err = res.data?.error || `Fehler ${res.status}`;
            showToast(`Deaktivierung fehlgeschlagen: ${err}`, 'error');
          }
        } catch (err) {
          showToast(`Netzwerkfehler: ${err.message}`, 'error');
        }
      }
    });
  });
}

async function loadSystemStatus() {
  const card = document.getElementById('maint-status-card');
  const iconBox = document.getElementById('maint-icon-box');
  const headline = document.getElementById('maint-headline');
  const desc = document.getElementById('maint-desc');
  const tag = document.getElementById('maint-tag');
  const untilBox = document.getElementById('maint-until-box');
  const untilText = document.getElementById('maint-until-text');

  const btnActivate = document.getElementById('btn-activate-maint');
  const btnDeactivate = document.getElementById('btn-deactivate-maint');
  const maintPill = document.getElementById('pill-maint-active');

  try {
    const res = await window.adminAPI.getStatus();
    if (res.ok && res.data) {
      const data = res.data;
      const maint = data.maintenance || { active: false };
      currentMaintenance = maint;

      // Update Header Pill
      if (maint.active) {
        maintPill.classList.remove('hidden');
      } else {
        maintPill.classList.add('hidden');
      }

      // Update UI Card
      if (maint.active) {
        card.classList.add('active');
        iconBox.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        tag.textContent = 'WARTUNG AKTIV';
        headline.textContent = 'Wartungsmodus AKTIV: Apps gesperrt!';
        desc.textContent = maint.message || 'Wartungsarbeiten laufen - Server vorübergehend nicht erreichbar.';

        if (maint.until) {
          untilBox.classList.remove('hidden');
          untilText.textContent = new Date(maint.until).toLocaleString('de-DE');
        } else {
          untilBox.classList.add('hidden');
        }

        btnActivate.classList.add('hidden');
        btnDeactivate.classList.remove('hidden');
      } else {
        card.classList.remove('active');
        iconBox.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
        tag.textContent = 'SERVER STATUS';
        headline.textContent = 'Normalbetrieb: Apps freigegeben';
        desc.textContent = 'Alle mobilen Apps und Schnittstellen sind regulär erreichbar.';
        untilBox.classList.add('hidden');

        btnActivate.classList.remove('hidden');
        btnDeactivate.classList.add('hidden');
      }

      // Update Health Tab versions
      document.getElementById('metric-version').textContent = `v${data.version || '2.0.3'}`;
      document.getElementById('metric-min-app').textContent = `Mindest-App: v${data.minAppVersion || '2.0.3'}`;
    }
  } catch (err) {
    console.error('Error loading system status:', err);
  }
}

// ─── Health & Diagnostics ─────────────────────────────────────────────────────

async function loadHealth() {
  const dot = document.getElementById('metric-status-dot');
  const statusTxt = document.getElementById('metric-server-status');
  const uptimeTxt = document.getElementById('metric-uptime');
  const pingTxt = document.getElementById('metric-ping');
  const sessionsTxt = document.getElementById('metric-sessions');

  try {
    const res = await window.adminAPI.getHealth();
    if (res.ok && res.data) {
      dot.style.background = '#10b981';
      statusTxt.textContent = 'Online';
      statusTxt.style.color = '#34d399';
      pingTxt.textContent = `${res.latency} ms`;

      const uptimeSec = Math.floor(res.data.uptime || 0);
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      uptimeTxt.textContent = `Uptime: ${hours}h ${mins}m`;
      sessionsTxt.textContent = res.data.activeSessions || 0;

      updateServerPill(true, res.latency);
    } else {
      dot.style.background = '#ef4444';
      statusTxt.textContent = 'Offline / Fehler';
      statusTxt.style.color = '#f87171';
      updateServerPill(false);
    }
  } catch (_) {
    dot.style.background = '#ef4444';
    statusTxt.textContent = 'Nicht erreichbar';
    statusTxt.style.color = '#f87171';
    updateServerPill(false);
  }
}

async function runDiagnostics() {
  const btn = document.getElementById('btn-ping-now');
  btn.disabled = true;
  btn.innerHTML = `${adminIcons.spinner} <span>Teste...</span>`;

  const endpoints = [
    { ep: '/health', elStatus: 'diag-health-status', elPing: 'diag-health-ping', elDetails: 'diag-health-details' },
    { ep: '/api/system/status', elStatus: 'diag-status-status', elPing: 'diag-status-ping', elDetails: 'diag-status-details' },
    { ep: '/api/system/announcements', elStatus: 'diag-ann-status', elPing: 'diag-ann-ping', elDetails: 'diag-ann-details' },
    { ep: '/api/system/announcement', method: 'POST', body: {}, elStatus: 'diag-auth-status', elPing: 'diag-auth-ping', elDetails: 'diag-auth-details' }
  ];

  for (const item of endpoints) {
    try {
      const res = await window.adminAPI.request({
        endpoint: item.ep,
        method: item.method || 'GET',
        body: item.body
      });

      const statusEl = document.getElementById(item.elStatus);
      const pingEl = document.getElementById(item.elPing);
      const detailsEl = document.getElementById(item.elDetails);

      if (res.ok) {
        statusEl.innerHTML = `<span style="color:#34d399;font-weight:700;">${res.status} OK</span>`;
      } else if (item.method === 'POST' && res.status === 400) {
        // 400 is expected for empty test body on POST /announcement, meaning auth was accepted!
        statusEl.innerHTML = `<span style="color:#34d399;font-weight:700;">Auth Gültig (${res.status})</span>`;
      } else if (res.status === 403) {
        statusEl.innerHTML = `<span style="color:#ef4444;font-weight:700;">403 Forbidden</span>`;
      } else {
        statusEl.innerHTML = `<span style="color:#f59e0b;font-weight:700;">HTTP ${res.status}</span>`;
      }

      pingEl.textContent = `${res.latency} ms`;

      if (res.status === 403) {
        detailsEl.textContent = 'Admin-Secret ungültig oder fehlt!';
      } else if (res.ok) {
        detailsEl.textContent = 'Erfolgreich';
      }
    } catch (err) {
      document.getElementById(item.elStatus).textContent = 'Fehler';
      document.getElementById(item.elPing).textContent = '-';
      document.getElementById(item.elDetails).textContent = err.message;
    }
  }

  btn.disabled = false;
  btn.innerHTML = `${adminIcons.bolt} <span>Jetzt testen</span>`;
}

// ─── Settings Setup ───────────────────────────────────────────────────────────

function setupSettingsToggles() {
  const secretInput = document.getElementById('setting-admin-secret');
  const eyeBtn = document.getElementById('btn-toggle-secret');
  const form = document.getElementById('form-settings');
  const testBtn = document.getElementById('btn-test-connection');

  if (eyeBtn && secretInput) {
    eyeBtn.addEventListener('click', () => {
      if (secretInput.type === 'password') {
        secretInput.type = 'text';
        eyeBtn.innerHTML = adminIcons.eyeOff;
      } else {
        secretInput.type = 'password';
        eyeBtn.innerHTML = adminIcons.eye;
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const serverUrl = document.getElementById('setting-server-url').value.trim();
    const adminSecret = secretInput.value.trim();
    const autoRefresh = document.getElementById('setting-auto-refresh').checked;

    appConfig = { ...appConfig, serverUrl, adminSecret, autoRefresh };

    const res = await window.adminAPI.saveConfig(appConfig);
    if (res.success) {
      showToast('Einstellungen erfolgreich gespeichert!', 'success');
      updateServerPill();
      await refreshAllData(true);
    } else {
      showToast(`Fehler beim Speichern: ${res.error}`, 'error');
    }
  });

  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.innerHTML = `${adminIcons.spinner} <span>Teste Verbindung...</span>`;

    // Temporarily apply input values for test
    const tempUrl = document.getElementById('setting-server-url').value.trim();
    const tempSecret = secretInput.value.trim();
    await window.adminAPI.saveConfig({ serverUrl: tempUrl, adminSecret: tempSecret });

    try {
      // Test status
      const statusRes = await window.adminAPI.getStatus();
      if (!statusRes.ok) {
        showToast(`Server nicht erreichbar unter ${tempUrl}`, 'error');
        return;
      }

      // Test admin auth
      const authRes = await window.adminAPI.request({
        endpoint: '/api/system/announcement',
        method: 'POST',
        body: {}
      });

      if (authRes.status === 403) {
        showToast('Server erreichbar, aber ADMIN_SECRET ist falsch (403)!', 'error');
      } else {
        showToast(`Verbindung erfolgreich! Ping: ${statusRes.latency} ms`, 'success');
      }
    } catch (err) {
      showToast(`Verbindungsfehler: ${err.message}`, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = `${adminIcons.plug} <span>Verbindung testen</span>`;
    }
  });

  setupMaintenanceControls();
  document.getElementById('btn-ping-now').addEventListener('click', runDiagnostics);
}

function populateSettingsForm() {
  document.getElementById('setting-server-url').value = appConfig.serverUrl || '';
  document.getElementById('setting-admin-secret').value = appConfig.adminSecret || '';
  document.getElementById('setting-auto-refresh').checked = !!appConfig.autoRefresh;
}

function updateServerPill(isConnected = true, latency = null) {
  const pill = document.getElementById('server-status-pill');
  const dot = pill.querySelector('.status-dot');
  const name = document.getElementById('pill-server-host');

  try {
    const parsed = new URL(appConfig.serverUrl);
    name.textContent = `${parsed.hostname}${latency ? ` (${latency}ms)` : ''}`;
  } catch (_) {
    name.textContent = appConfig.serverUrl || 'Nicht konfiguriert';
  }

  if (isConnected) {
    dot.className = 'status-dot connected';
  } else {
    dot.className = 'status-dot disconnected';
  }
}

// ─── Modal Helpers ────────────────────────────────────────────────────────────

function setupModals() {
  const modal = document.getElementById('modal-confirm');
  const cancelBtn = document.getElementById('modal-btn-cancel');
  const confirmBtn = document.getElementById('modal-btn-confirm');

  cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    pendingConfirmAction = null;
  });

  confirmBtn.addEventListener('click', async () => {
    modal.classList.add('hidden');
    if (typeof pendingConfirmAction === 'function') {
      const action = pendingConfirmAction;
      pendingConfirmAction = null;
      await action();
    }
  });
}

function showConfirmModal({ icon = adminIcons.warningModal, title, desc, confirmLabel = 'Bestätigen', onConfirm }) {
  const modal = document.getElementById('modal-confirm');
  document.getElementById('modal-icon').innerHTML = icon;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-desc').textContent = desc;
  document.getElementById('modal-btn-confirm').textContent = confirmLabel;

  pendingConfirmAction = onConfirm;
  modal.classList.remove('hidden');
}

// ─── Toast Notifications ──────────────────────────────────────────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? adminIcons.check : type === 'error' ? adminIcons.error : adminIcons.info;
  toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── Auto Refresh & Data Sync ─────────────────────────────────────────────────

async function refreshAllData(showToastAlert = false) {
  await Promise.all([
    loadSystemStatus(),
    loadAnnouncements(),
    loadHealth()
  ]);

  if (showToastAlert) {
    showToast('Daten erfolgreich synchronisiert', 'success');
  }
}

function startAutoRefresh() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (appConfig.autoRefresh) {
      await Promise.all([
        loadSystemStatus(),
        loadAnnouncements(),
        loadHealth()
      ]);
    }
  }, (appConfig.refreshInterval || 10) * 1000);
}

function switchToTab(tabId) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.click();
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
