(function () {
  'use strict';

  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;

  const I18N = {
    de: {
      daemonOn: 'Hintergrund-Wächter aktiv',
      daemonOff: 'Auto-Erkennung pausiert',
      tabQuick: 'Quick-Login',
      tabMappings: 'App-Mappings',
      tabSettings: 'Account & Setup',
      manualDomain: 'Direktes QR-Overlay für Domain',
      openQr: 'QR öffnen',
      runningApps: 'Laufende Desktop-Apps',
      knownProfiles: 'Konfigurierte App-Profile',
      addMapping: '+ App-Mapping hinzufügen',
      fromRunning: 'Aus laufender App',
      saveSettings: 'Einstellungen speichern',
      settingsSaved: 'Einstellungen gespeichert',
      mappingSaved: 'Mapping gespeichert',
      waitingScan: 'Warte auf Scan…',
      confirmPhone: 'Auf Smartphone bestätigen…',
      pairSuccess: 'FlakeSecure Konto gekoppelt!',
      noRunning: 'Keine passenden Desktop-Fenster gefunden',
      edit: 'Bearbeiten',
      del: 'Löschen',
      addForApp: 'Zuordnen'
    },
    en: {
      daemonOn: 'Background watcher active',
      daemonOff: 'Auto-detection paused',
      tabQuick: 'Quick Login',
      tabMappings: 'App Mappings',
      tabSettings: 'Account & Setup',
      manualDomain: 'Direct QR Overlay for Domain',
      openQr: 'Open QR',
      runningApps: 'Running Desktop Apps',
      knownProfiles: 'Configured App Profiles',
      addMapping: '+ Add App Mapping',
      fromRunning: 'From Running App',
      saveSettings: 'Save Settings',
      settingsSaved: 'Settings saved',
      mappingSaved: 'Mapping saved',
      waitingScan: 'Waiting for scan…',
      confirmPhone: 'Confirm on your phone…',
      pairSuccess: 'FlakeSecure account paired!',
      noRunning: 'No matching desktop windows found',
      edit: 'Edit',
      del: 'Delete',
      addForApp: 'Map App'
    },
    fr: {
      daemonOn: 'Surveillance active',
      daemonOff: 'Détection en pause',
      tabQuick: 'Connexion rapide',
      tabMappings: 'Applications',
      tabSettings: 'Compte & Paramètres',
      manualDomain: 'Overlay QR direct par domaine',
      openQr: 'Ouvrir QR',
      runningApps: 'Applications actives',
      knownProfiles: 'Profils configurés',
      addMapping: '+ Ajouter une app',
      fromRunning: 'Depuis app active',
      saveSettings: 'Enregistrer',
      settingsSaved: 'Paramètres enregistrés',
      mappingSaved: 'Mapping enregistré',
      waitingScan: 'En attente du scan…',
      confirmPhone: 'Confirmez sur mobile…',
      pairSuccess: 'Compte associé !',
      noRunning: 'Aucune fenêtre détectée',
      edit: 'Modifier',
      del: 'Supprimer',
      addForApp: 'Associer'
    },
    es: {
      daemonOn: 'Vigilancia activa',
      daemonOff: 'Detección pausada',
      tabQuick: 'Inicio rápido',
      tabMappings: 'Apps y Dominios',
      tabSettings: 'Cuenta y Ajustes',
      manualDomain: 'Overlay QR directo por dominio',
      openQr: 'Abrir QR',
      runningApps: 'Apps en ejecución',
      knownProfiles: 'Perfiles configurados',
      addMapping: '+ Añadir App',
      fromRunning: 'Desde app activa',
      saveSettings: 'Guardar ajustes',
      settingsSaved: 'Ajustes guardados',
      mappingSaved: 'Regla guardada',
      waitingScan: 'Esperando escaneo…',
      confirmPhone: 'Confirma en tu móvil…',
      pairSuccess: '¡Cuenta vinculada!',
      noRunning: 'No hay ventanas activas',
      edit: 'Editar',
      del: 'Eliminar',
      addForApp: 'Mapear'
    }
  };

  let state = {
    config: null,
    mappings: [],
    running_windows: []
  };
  let pairSocket = null;
  let pairSessionId = null;

  function t() {
    const lang = state.config?.language || 'de';
    return I18N[lang] || I18N.de;
  }

  function showToast(msg, kind = 'info') {
    const box = document.getElementById('toast-box');
    box.textContent = msg;
    box.className = `toast-box ${kind}`;
    setTimeout(() => {
      box.classList.add('hidden');
    }, 3200);
  }

  function applyTranslations() {
    const d = t();
    const active = !!state.config?.auto_detect_enabled;
    const dot = document.querySelector('#daemon-status-badge .status-dot');
    dot.classList.toggle('active', active);
    document.getElementById('daemon-status-text').textContent = active ? d.daemonOn : d.daemonOff;

    document.getElementById('tab-btn-quick').textContent = d.tabQuick;
    document.getElementById('tab-btn-mappings').textContent = d.tabMappings;
    document.getElementById('tab-btn-settings').textContent = d.tabSettings;
    document.getElementById('lbl-manual-domain').textContent = d.manualDomain;
    document.getElementById('manual-domain-launch-btn').textContent = d.openQr;
    document.getElementById('lbl-running-apps').textContent = d.runningApps;
    document.getElementById('lbl-known-profiles').textContent = d.knownProfiles;
    document.getElementById('open-add-mapping-btn').textContent = d.addMapping;
    document.getElementById('scan-running-for-mapping-btn').textContent = d.fromRunning;
    document.getElementById('save-settings-btn').textContent = d.saveSettings;

    document.documentElement.setAttribute('data-theme', state.config?.theme === 'light' ? 'light' : 'dark');
    document.getElementById('theme-icon').textContent = state.config?.theme === 'light' ? '☀' : '☾';
    document.getElementById('lang-select').value = state.config?.language || 'de';
  }

  function findMappingByExe(exeName) {
    const lower = (exeName || '').toLowerCase();
    return state.mappings.find((m) =>
      (m.executables || []).some((e) => e.toLowerCase() === lower)
    );
  }

  function renderQuickTab() {
    const d = t();
    const q = (document.getElementById('quick-search-input').value || '').trim().toLowerCase();
    const runningBox = document.getElementById('running-apps-list');
    const profilesBox = document.getElementById('quick-profiles-list');

    runningBox.innerHTML = '';
    const filteredWin = state.running_windows.filter((w) => {
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        w.exe_name.toLowerCase().includes(q)
      );
    });
    document.getElementById('running-count').textContent = String(filteredWin.length);

    if (filteredWin.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'muted-text';
      empty.textContent = d.noRunning;
      runningBox.appendChild(empty);
    } else {
      filteredWin.forEach((win) => {
        const mapped = findMappingByExe(win.exe_name);
        const card = document.createElement('div');
        card.className = `item-card ${mapped ? 'matched' : ''}`;

        const info = document.createElement('div');
        info.className = 'item-info';

        const titleEl = document.createElement('div');
        titleEl.className = 'item-title';
        titleEl.textContent = mapped ? `${mapped.app_name} — ${win.title}` : win.title;

        const subEl = document.createElement('div');
        subEl.className = 'item-sub';
        subEl.textContent = mapped ? `${win.exe_name} • ${mapped.domain}` : win.exe_name;

        info.appendChild(titleEl);
        info.appendChild(subEl);

        const actions = document.createElement('div');
        actions.className = 'item-actions';

        if (mapped) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'primary-btn';
          btn.textContent = d.openQr;
          btn.addEventListener('click', () => {
            invoke('trigger_overlay_for_app', {
              appName: mapped.app_name,
              domain: mapped.domain,
              targetHwnd: win.hwnd,
              twoStep: mapped.two_step_login
            }).catch((err) => showToast(String(err), 'error'));
          });
          actions.appendChild(btn);
        } else {
          const mapBtn = document.createElement('button');
          mapBtn.type = 'button';
          mapBtn.className = 'secondary-btn';
          mapBtn.textContent = d.addForApp;
          mapBtn.addEventListener('click', () => openMappingModalForWindow(win));
          actions.appendChild(mapBtn);
        }

        card.appendChild(info);
        card.appendChild(actions);
        runningBox.appendChild(card);
      });
    }

    profilesBox.innerHTML = '';
    const filteredProfiles = state.mappings.filter((m) => {
      if (!m.enabled) return false;
      if (!q) return true;
      return (
        m.app_name.toLowerCase().includes(q) ||
        m.domain.toLowerCase().includes(q) ||
        m.executables.some((e) => e.toLowerCase().includes(q))
      );
    });
    document.getElementById('profiles-count').textContent = String(filteredProfiles.length);

    filteredProfiles.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'item-card';

      const info = document.createElement('div');
      info.className = 'item-info';
      const titleEl = document.createElement('div');
      titleEl.className = 'item-title';
      titleEl.textContent = m.app_name;
      const subEl = document.createElement('div');
      subEl.className = 'item-sub item-domain';
      subEl.textContent = `${m.domain} (${m.executables.join(', ')})`;
      info.appendChild(titleEl);
      info.appendChild(subEl);

      const runningMatch = state.running_windows.find((w) =>
        m.executables.some((e) => e.toLowerCase() === w.exe_name.toLowerCase())
      );

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'primary-btn';
      btn.textContent = d.openQr;
      btn.addEventListener('click', () => {
        invoke('trigger_overlay_for_app', {
          appName: m.app_name,
          domain: m.domain,
          targetHwnd: runningMatch ? runningMatch.hwnd : null,
          twoStep: m.two_step_login
        }).catch((err) => showToast(String(err), 'error'));
      });

      card.appendChild(info);
      card.appendChild(btn);
      profilesBox.appendChild(card);
    });
  }

  function renderMappingsTab() {
    const d = t();
    const list = document.getElementById('mappings-list');
    list.innerHTML = '';

    state.mappings.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'item-card';

      const info = document.createElement('div');
      info.className = 'item-info';

      const titleEl = document.createElement('div');
      titleEl.className = 'item-title';
      titleEl.textContent = m.app_name;

      const subEl = document.createElement('div');
      subEl.className = 'item-sub';
      subEl.textContent = `${m.domain} • ${m.executables.join(', ')}`;

      info.appendChild(titleEl);
      info.appendChild(subEl);

      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'switch';
      const toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.checked = m.enabled;
      toggleInput.addEventListener('change', async () => {
        const updated = { ...m, enabled: toggleInput.checked };
        state.mappings = await invoke('save_mapping', { mapping: updated });
        renderQuickTab();
      });
      const slider = document.createElement('span');
      slider.className = 'slider';
      toggleLabel.appendChild(toggleInput);
      toggleLabel.appendChild(slider);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'secondary-btn';
      editBtn.textContent = d.edit;
      editBtn.addEventListener('click', () => openMappingModal(m));

      actions.appendChild(toggleLabel);
      actions.appendChild(editBtn);

      if (m.is_custom) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'danger-outline-btn';
        delBtn.textContent = d.del;
        delBtn.addEventListener('click', async () => {
          state.mappings = await invoke('delete_mapping', { id: m.id });
          renderMappingsTab();
          renderQuickTab();
        });
        actions.appendChild(delBtn);
      }

      card.appendChild(info);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function renderSettingsTab() {
    const cfg = state.config;
    if (!cfg) return;

    document.getElementById('set-autodetect').checked = !!cfg.auto_detect_enabled;
    document.getElementById('set-overlay-mode').value = cfg.overlay_trigger_mode || 'auto_overlay';
    document.getElementById('set-delivery-mode').value = cfg.delivery_mode || 'hybrid_autotype';
    document.getElementById('set-autosubmit').checked = !!cfg.auto_submit;
    document.getElementById('set-anticapture').checked = !!cfg.anti_capture;
    document.getElementById('set-hotkey').value = cfg.global_hotkey || 'Alt+Shift+F';
    document.getElementById('set-server-url').value = cfg.server_url || 'https://flakesecure.snowystudio.dev';

    renderPairingState(cfg.paired_user);
  }

  function stopPairingSocket() {
    if (pairSocket) {
      try { pairSocket.disconnect(); } catch (_) {}
      pairSocket = null;
    }
    pairSessionId = null;
    invoke('stop_pairing_session').catch(() => {});
  }

  async function startQrPairing() {
    stopPairingSocket();
    const info = await invoke('start_pairing_session');
    pairSessionId = info.sid;

    const qrEl = document.getElementById('pair-qrcode');
    qrEl.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrEl, {
        text: info.deep_link,
        width: 112,
        height: 112,
        colorDark: '#080a12',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    document.getElementById('pair-status-dot').className = 'status-dot';
    document.getElementById('pair-status-text').textContent = t().waitingScan;

    if (typeof io === 'function') {
      pairSocket = io(info.server_url, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 6,
        timeout: 10000
      });

      pairSocket.on('connect', () => {
        pairSocket.emit('join-session', { sid: info.sid, domain: 'FlakeSecure Desktop' });
      });

      pairSocket.on('qr-scanned', () => {
        document.getElementById('pair-status-dot').className = 'status-dot scanned';
        document.getElementById('pair-status-text').textContent = t().confirmPhone;
      });

      const handlePair = async (payload) => {
        if (!pairSessionId || pairSessionId !== info.sid) return;
        try {
          const user = await invoke('receive_encrypted_pairing', {
            sid: info.sid,
            payload: {
              iv: Array.from(payload.iv || []),
              data: Array.from(payload.data || [])
            }
          });
          stopPairingSocket();
          state.config.paired_user = user;
          renderPairingState(user);
          showToast(t().pairSuccess, 'success');
        } catch (err) {
          showToast(String(err), 'error');
        }
      };

      pairSocket.on('pairing-data', handlePair);
      pairSocket.on('login-data', handlePair);
      pairSocket.on('session-expired', () => {
        if (!state.config?.paired_user) startQrPairing();
      });
    }
  }

  function renderPairingState(user) {
    const pairedView = document.getElementById('paired-account-view');
    const qrView = document.getElementById('pair-qr-view');
    const pwView = document.getElementById('pair-pw-view');

    if (user) {
      stopPairingSocket();
      pairedView.classList.remove('hidden');
      qrView.classList.add('hidden');
      pwView.classList.add('hidden');
      const name = user.username || user.email || 'User';
      document.getElementById('paired-username').textContent = name;
      document.getElementById('paired-email').textContent = user.email || 'FlakeSecure Account';
      document.getElementById('paired-avatar').textContent = name.charAt(0).toUpperCase();
    } else {
      pairedView.classList.add('hidden');
      if (pwView.classList.contains('hidden')) {
        qrView.classList.remove('hidden');
        if (!pairSocket) startQrPairing();
      }
    }
  }

  /* ─── Modal Logic ───────────────────────────────────────────────────────── */
  function openMappingModal(existing = null, showProcessPicker = false) {
    document.getElementById('map-id').value = existing?.id || '';
    document.getElementById('map-app-name').value = existing?.app_name || '';
    document.getElementById('map-exes').value = existing?.executables?.join(', ') || '';
    document.getElementById('map-domain').value = existing?.domain || '';
    document.getElementById('map-login-kw').value = existing?.login_title_keywords?.join(', ') || '';
    document.getElementById('map-exclude-kw').value = existing?.exclude_title_keywords?.join(', ') || '';
    document.getElementById('map-twostep').checked = !!existing?.two_step_login;

    const picker = document.getElementById('modal-process-picker');
    const chipList = document.getElementById('modal-process-list');
    chipList.innerHTML = '';

    if (showProcessPicker && state.running_windows.length > 0) {
      picker.classList.remove('hidden');
      state.running_windows.forEach((w) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'process-chip';
        chip.textContent = `${w.exe_name} (${w.title.slice(0, 24)})`;
        chip.addEventListener('click', () => fillModalFromWindow(w));
        chipList.appendChild(chip);
      });
    } else {
      picker.classList.add('hidden');
    }

    document.getElementById('mapping-modal').classList.remove('hidden');
  }

  function fillModalFromWindow(win) {
    const cleanName = win.exe_name.replace(/\.exe$/i, '');
    document.getElementById('map-app-name').value = cleanName;
    document.getElementById('map-exes').value = win.exe_name;
    document.getElementById('map-domain').value = `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    document.getElementById('map-login-kw').value = 'sign in, log in, anmelden, login';
  }

  function openMappingModalForWindow(win) {
    openMappingModal(null, false);
    fillModalFromWindow(win);
  }

  function splitCsv(val) {
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /* ─── DOM Bindings ──────────────────────────────────────────────────────── */
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById(`tab-${tab}`).classList.add('active');
      if (tab === 'settings' && !state.config?.paired_user) {
        renderPairingState(null);
      }
    });
  });

  document.getElementById('quick-search-input').addEventListener('input', renderQuickTab);

  document.getElementById('refresh-windows-btn').addEventListener('click', async () => {
    state.running_windows = await invoke('list_running_apps');
    renderQuickTab();
  });

  document.getElementById('manual-domain-launch-btn').addEventListener('click', () => {
    const dom = document.getElementById('manual-domain-input').value.trim();
    if (!dom) return;
    invoke('trigger_overlay_for_app', {
      appName: dom,
      domain: dom,
      targetHwnd: null,
      twoStep: false
    }).catch((err) => showToast(String(err), 'error'));
  });

  document.getElementById('open-add-mapping-btn').addEventListener('click', () => {
    openMappingModal(null, false);
  });

  document.getElementById('scan-running-for-mapping-btn').addEventListener('click', async () => {
    state.running_windows = await invoke('list_running_apps');
    openMappingModal(null, true);
  });

  document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('mapping-modal').classList.add('hidden');
  });

  document.getElementById('cancel-modal-btn').addEventListener('click', () => {
    document.getElementById('mapping-modal').classList.add('hidden');
  });

  document.getElementById('save-mapping-btn').addEventListener('click', async () => {
    const appName = document.getElementById('map-app-name').value.trim();
    const exes = splitCsv(document.getElementById('map-exes').value);
    const domain = document.getElementById('map-domain').value.trim();
    if (!appName || exes.length === 0 || !domain) {
      showToast('App-Name, Prozess (.exe) und Domain sind erforderlich.', 'error');
      return;
    }
    const existingId = document.getElementById('map-id').value.trim();
    const prev = state.mappings.find((m) => m.id === existingId);

    const mapping = {
      id: existingId || `custom-${Date.now()}`,
      app_name: appName,
      executables: exes,
      domain,
      login_title_keywords: splitCsv(document.getElementById('map-login-kw').value),
      exclude_title_keywords: splitCsv(document.getElementById('map-exclude-kw').value),
      max_login_width: prev ? prev.max_login_width : null,
      max_login_height: prev ? prev.max_login_height : null,
      two_step_login: document.getElementById('map-twostep').checked,
      enabled: prev ? prev.enabled : true,
      is_custom: prev ? prev.is_custom : true
    };

    state.mappings = await invoke('save_mapping', { mapping });
    document.getElementById('mapping-modal').classList.add('hidden');
    renderMappingsTab();
    renderQuickTab();
    showToast(t().mappingSaved, 'success');
  });

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const updated = {
      ...state.config,
      auto_detect_enabled: document.getElementById('set-autodetect').checked,
      overlay_trigger_mode: document.getElementById('set-overlay-mode').value,
      delivery_mode: document.getElementById('set-delivery-mode').value,
      auto_submit: document.getElementById('set-autosubmit').checked,
      anti_capture: document.getElementById('set-anticapture').checked,
      global_hotkey: document.getElementById('set-hotkey').value.trim() || 'Alt+Shift+F',
      server_url: document.getElementById('set-server-url').value.trim() || 'https://flakesecure.snowystudio.dev'
    };
    state.config = await invoke('save_app_config', { newConfig: updated });
    applyTranslations();
    showToast(t().settingsSaved, 'success');
  });

  document.getElementById('lang-select').addEventListener('change', async (e) => {
    const updated = { ...state.config, language: e.target.value };
    state.config = await invoke('save_app_config', { newConfig: updated });
    applyTranslations();
    renderQuickTab();
    renderMappingsTab();
  });

  document.getElementById('theme-toggle-btn').addEventListener('click', async () => {
    const nextTheme = state.config?.theme === 'light' ? 'dark' : 'light';
    const updated = { ...state.config, theme: nextTheme };
    state.config = await invoke('save_app_config', { newConfig: updated });
    applyTranslations();
  });

  document.getElementById('show-pw-login-btn').addEventListener('click', () => {
    stopPairingSocket();
    document.getElementById('pair-qr-view').classList.add('hidden');
    document.getElementById('pair-pw-view').classList.remove('hidden');
  });

  document.getElementById('back-to-pair-qr-btn').addEventListener('click', () => {
    document.getElementById('pair-pw-view').classList.add('hidden');
    document.getElementById('pair-qr-view').classList.remove('hidden');
    startQrPairing();
  });

  document.getElementById('auth-login-submit-btn').addEventListener('click', async () => {
    const identifier = document.getElementById('auth-identifier').value.trim().toLowerCase();
    const password = document.getElementById('auth-password').value;
    if (!identifier || !password) return;

    const api = state.config?.server_url || 'https://flakesecure.snowystudio.dev';
    try {
      const res = await fetch(`${api}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      const userObj = {
        username: data.user?.username || data.user?.email || identifier,
        email: data.user?.email || null,
        auth_token: data.token || null
      };
      await invoke('set_paired_account', { user: userObj });
      state.config.paired_user = userObj;
      document.getElementById('auth-password').value = '';
      renderPairingState(userObj);
      showToast(t().pairSuccess, 'success');
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
    }
  });

  document.getElementById('logout-account-btn').addEventListener('click', async () => {
    const token = state.config?.paired_user?.auth_token;
    const api = state.config?.server_url || 'https://flakesecure.snowystudio.dev';
    if (token) {
      fetch(`${api}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
    await invoke('set_paired_account', { user: null });
    state.config.paired_user = null;
    renderPairingState(null);
  });

  listen('config-updated', (event) => {
    if (event.payload) {
      state.config = event.payload;
      applyTranslations();
      renderSettingsTab();
    }
  });

  listen('mappings-updated', (event) => {
    if (event.payload) {
      state.mappings = event.payload;
      renderMappingsTab();
      renderQuickTab();
    }
  });

  listen('pairing-updated', (event) => {
    if (state.config) {
      state.config.paired_user = event.payload || null;
      renderPairingState(state.config.paired_user);
    }
  });

  listen('hotkey-unmapped-window', (event) => {
    if (event.payload) {
      document.querySelector('[data-tab="mappings"]').click();
      openMappingModalForWindow(event.payload);
    }
  });

  async function init() {
    state = await invoke('get_state');
    applyTranslations();
    renderQuickTab();
    renderMappingsTab();
    renderSettingsTab();
  }

  init().catch((err) => showToast(String(err), 'error'));
})();
