(function () {
  'use strict';

  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;

  const I18N = {
    de: {
      pillSub: 'Mit FlakeSecure anmelden',
      qrHint: 'Mit FlakeSecure auf dem Handy scannen',
      waiting: 'Warte auf Scan…',
      scannedTitle: 'QR-Code gescannt',
      scannedBy: 'Gescannt von {user}',
      confirmPhone: 'Auf Smartphone bestätigen…',
      refreshQr: 'Neuer QR-Code',
      menu: 'Menü',
      confirmed: 'Bestätigt',
      injecting: 'Zugangsdaten werden übertragen…',
      autotypeDone: 'Erfolgreich eingetragen!',
      autotypeErr: 'Auto-Type fehlgeschlagen — Buttons nutzen',
      clipUser: '1/2 Benutzername kopiert (Strg+V drücken)',
      clipPass: '2/2 Passwort kopiert (löscht sich automatisch)',
      clipCleared: 'Zwischenablage sicher geleert',
      manualReady: 'Aktion wählen:',
      btnAutotype: 'Auto-Fill starten',
      btnUser: 'Username',
      btnPass: 'Passwort',
      btnTotp: '2FA Code',
      close: 'Schließen',
      serverError: 'Relay nicht erreichbar',
      expired: 'QR-Code abgelaufen — erneuern'
    },
    en: {
      pillSub: 'Sign in with FlakeSecure',
      qrHint: 'Scan with FlakeSecure on your phone',
      waiting: 'Waiting for scan…',
      scannedTitle: 'QR Code scanned',
      scannedBy: 'Scanned by {user}',
      confirmPhone: 'Confirm on your phone…',
      refreshQr: 'Refresh QR',
      menu: 'Menu',
      confirmed: 'Verified',
      injecting: 'Transferring credentials…',
      autotypeDone: 'Credentials filled!',
      autotypeErr: 'Auto-type failed — use buttons below',
      clipUser: '1/2 Username copied (press Ctrl+V)',
      clipPass: '2/2 Password copied (auto-clears after paste)',
      clipCleared: 'Protected clipboard cleared',
      manualReady: 'Choose delivery action:',
      btnAutotype: 'Run Auto-Fill',
      btnUser: 'Username',
      btnPass: 'Password',
      btnTotp: '2FA Code',
      close: 'Close',
      serverError: 'Relay unreachable',
      expired: 'QR expired — click refresh'
    },
    fr: {
      pillSub: 'Connexion avec FlakeSecure',
      qrHint: 'Scanner avec FlakeSecure sur votre mobile',
      waiting: 'En attente du scan…',
      scannedTitle: 'QR Code scanné',
      scannedBy: 'Scanné par {user}',
      confirmPhone: 'Confirmez sur votre téléphone…',
      refreshQr: 'Actualiser QR',
      menu: 'Menu',
      confirmed: 'Confirmé',
      injecting: 'Transfert des identifiants…',
      autotypeDone: 'Identifiants saisis !',
      autotypeErr: 'Saisie auto échouée — utilisez les boutons',
      clipUser: '1/2 Identifiant copié (Ctrl+V)',
      clipPass: '2/2 Mot de passe copié (effacement auto)',
      clipCleared: 'Presse-papiers nettoyé',
      manualReady: 'Choisir une action :',
      btnAutotype: 'Remplissage auto',
      btnUser: 'Identifiant',
      btnPass: 'Mot de passe',
      btnTotp: 'Code 2FA',
      close: 'Fermer',
      serverError: 'Serveur injoignable',
      expired: 'QR expiré'
    },
    es: {
      pillSub: 'Iniciar sesión con FlakeSecure',
      qrHint: 'Escanea con FlakeSecure en tu móvil',
      waiting: 'Esperando escaneo…',
      scannedTitle: 'QR escaneado',
      scannedBy: 'Escaneado por {user}',
      confirmPhone: 'Confirma en tu teléfono…',
      refreshQr: 'Nuevo QR',
      menu: 'Menú',
      confirmed: 'Confirmado',
      injecting: 'Transfiriendo credenciales…',
      autotypeDone: '¡Credenciales ingresadas!',
      autotypeErr: 'Auto-relleno falló — usa los botones',
      clipUser: '1/2 Usuario copiado (pulsa Ctrl+V)',
      clipPass: '2/2 Contraseña copiada (auto-limpieza)',
      clipCleared: 'Portapapeles limpio',
      manualReady: 'Elige una acción:',
      btnAutotype: 'Auto-Rellenar',
      btnUser: 'Usuario',
      btnPass: 'Contraseña',
      btnTotp: 'Código 2FA',
      close: 'Cerrar',
      serverError: 'Sin conexión al servidor',
      expired: 'QR expirado'
    }
  };

  let currentLang = 'de';
  let activeSession = null;
  let relaySocket = null;
  let autoCloseTimer = null;

  const pillView = document.getElementById('pill-view');
  const sheetView = document.getElementById('sheet-view');
  const qrStage = document.getElementById('qr-stage');
  const doneStage = document.getElementById('done-stage');
  const qrVeil = document.getElementById('qr-scanned-veil');
  const qrBox = document.getElementById('overlay-qrcode');
  const statusBar = document.getElementById('status-bar');
  const statusText = document.getElementById('status-text');
  const manualActions = document.getElementById('manual-actions');
  const btnAutotype = document.getElementById('btn-autotype');
  const btnCopyUser = document.getElementById('btn-copy-user');
  const btnCopyPass = document.getElementById('btn-copy-pass');
  const btnCopyTotp = document.getElementById('btn-copy-totp');
  const doneUserChip = document.getElementById('done-user-chip');
  const deliveryDetail = document.getElementById('delivery-detail');

  function t() {
    return I18N[currentLang] || I18N.de;
  }

  function applyThemeAndLang(theme, lang) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    currentLang = I18N[lang] ? lang : 'de';
    const dict = t();
    document.getElementById('pill-subtitle').textContent = dict.pillSub;
    document.getElementById('qr-hint-text').textContent = dict.qrHint;
    document.getElementById('refresh-qr-btn').textContent = dict.refreshQr;
    document.getElementById('open-menu-btn').textContent = dict.menu;
    document.getElementById('done-title').textContent = dict.confirmed;
    document.getElementById('btn-autotype').textContent = dict.btnAutotype;
    document.getElementById('btn-copy-user').textContent = dict.btnUser;
    document.getElementById('btn-copy-pass').textContent = dict.btnPass;
    document.getElementById('btn-copy-totp').textContent = dict.btnTotp;
    document.getElementById('done-close-btn').textContent = dict.close;
  }

  function disconnectSocket() {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    if (relaySocket) {
      try { relaySocket.disconnect(); } catch (_) {}
      relaySocket = null;
    }
  }

  function setStatus(kind, text) {
    statusBar.className = `status-pill status-${kind}`;
    statusText.textContent = text;
  }

  function renderQR(deepLink) {
    qrBox.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrBox, {
        text: deepLink,
        width: 204,
        height: 204,
        colorDark: '#080a12',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.L
      });
    }
  }

  function connectRelay(session) {
    disconnectSocket();
    if (typeof io !== 'function') {
      setStatus('error', t().serverError);
      return;
    }

    relaySocket = io(session.server_url, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 8,
      timeout: 10000
    });

    relaySocket.on('connect', () => {
      relaySocket.emit('join-session', {
        sid: session.sid,
        domain: session.domain,
        token: session.auth_token || null
      });
      setStatus('waiting', t().waiting);
    });

    relaySocket.on('connect_error', () => {
      setStatus('error', t().serverError);
    });

    relaySocket.on('qr-scanned', (msg) => {
      if (!activeSession || activeSession.sid !== session.sid) return;
      invoke('mark_overlay_scanned', { sid: session.sid }).catch(() => {});

      const rawUser = msg && msg.username && String(msg.username).trim().toLowerCase() !== 'user'
        ? String(msg.username).trim()
        : '';
      document.getElementById('scanned-title').textContent = rawUser
        ? t().scannedBy.replace('{user}', rawUser)
        : t().scannedTitle;
      document.getElementById('scanned-sub').textContent = t().confirmPhone;
      qrVeil.classList.remove('hidden');
      setStatus('waiting', t().confirmPhone);
    });

    relaySocket.on('login-data', async (payload) => {
      if (!activeSession || activeSession.sid !== session.sid) return;
      try {
        const meta = await invoke('receive_encrypted_login', {
          sid: session.sid,
          payload: {
            iv: Array.from(payload.iv || []),
            data: Array.from(payload.data || [])
          }
        });

        qrStage.classList.add('hidden');
        doneStage.classList.remove('hidden');

        if (meta.masked_username) {
          doneUserChip.textContent = meta.masked_username;
          doneUserChip.classList.remove('hidden');
        } else {
          doneUserChip.classList.add('hidden');
        }

        btnAutotype.classList.toggle('hidden', !meta.can_autotype);
        btnCopyUser.classList.toggle('hidden', !meta.has_username);
        btnCopyPass.classList.toggle('hidden', !meta.has_password);
        btnCopyTotp.classList.toggle('hidden', !meta.has_totp);

        if (meta.delivery_mode === 'manual_buttons') {
          manualActions.classList.remove('hidden');
          deliveryDetail.textContent = t().manualReady;
        } else {
          manualActions.classList.add('hidden');
          deliveryDetail.textContent = t().injecting;
        }
      } catch (err) {
        setStatus('error', String(err));
      }
    });

    relaySocket.on('totp-data', async (payload) => {
      if (!activeSession || activeSession.sid !== session.sid) return;
      try {
        await invoke('receive_encrypted_totp', {
          sid: session.sid,
          payload: {
            iv: Array.from(payload.iv || []),
            data: Array.from(payload.data || [])
          }
        });
        btnCopyTotp.classList.remove('hidden');
      } catch (_) {}
    });

    relaySocket.on('session-expired', () => {
      if (!activeSession || activeSession.sid !== session.sid) return;
      setStatus('error', t().expired);
    });
  }

  function loadSession(session) {
    activeSession = session;
    applyThemeAndLang(session.theme, session.language);

    document.getElementById('pill-app-name').textContent = session.app_name;
    document.getElementById('sheet-app-pill').textContent = session.app_name;
    document.getElementById('sheet-domain').textContent = session.domain;

    qrVeil.classList.add('hidden');
    qrStage.classList.remove('hidden');
    doneStage.classList.add('hidden');
    manualActions.classList.add('hidden');

    if (session.is_pill) {
      pillView.classList.remove('hidden');
      sheetView.classList.add('hidden');
    } else {
      pillView.classList.add('hidden');
      sheetView.classList.remove('hidden');
    }

    renderQR(session.deep_link);
    connectRelay(session);
  }

  // Event Listeners
  document.getElementById('pill-expand-btn').addEventListener('click', () => {
    invoke('expand_overlay').catch(() => {});
  });

  document.getElementById('pill-close-btn').addEventListener('click', () => {
    disconnectSocket();
    invoke('dismiss_overlay', { recordDismissal: true }).catch(() => {});
  });

  document.getElementById('sheet-close-btn').addEventListener('click', () => {
    disconnectSocket();
    invoke('dismiss_overlay', { recordDismissal: true }).catch(() => {});
  });

  document.getElementById('done-close-btn').addEventListener('click', () => {
    disconnectSocket();
    invoke('dismiss_overlay', { recordDismissal: false }).catch(() => {});
  });

  document.getElementById('refresh-qr-btn').addEventListener('click', () => {
    invoke('refresh_overlay_session').catch(() => {});
  });

  document.getElementById('open-menu-btn').addEventListener('click', () => {
    invoke('open_menu_window').catch(() => {});
  });

  btnAutotype.addEventListener('click', () => {
    deliveryDetail.textContent = t().injecting;
    invoke('trigger_manual_autotype').catch(() => {});
  });

  btnCopyUser.addEventListener('click', () => {
    invoke('copy_secret_field', { field: 'username' }).catch(() => {});
  });

  btnCopyPass.addEventListener('click', () => {
    invoke('copy_secret_field', { field: 'password' }).catch(() => {});
  });

  btnCopyTotp.addEventListener('click', () => {
    invoke('copy_secret_field', { field: 'totp' }).catch(() => {});
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      disconnectSocket();
      invoke('dismiss_overlay', { recordDismissal: true }).catch(() => {});
    }
  });

  listen('overlay-session', (event) => {
    if (event.payload) loadSession(event.payload);
  });

  listen('overlay-expanded', () => {
    pillView.classList.add('hidden');
    sheetView.classList.remove('hidden');
  });

  listen('overlay-reset', () => {
    disconnectSocket();
    activeSession = null;
    qrVeil.classList.add('hidden');
  });

  listen('config-updated', (event) => {
    if (event.payload) {
      applyThemeAndLang(event.payload.theme, event.payload.language);
    }
  });

  listen('delivery-status', (event) => {
    const st = event.payload;
    if (!st) return;
    if (st.stage === 'autotype_done') {
      deliveryDetail.textContent = t().autotypeDone;
      autoCloseTimer = setTimeout(() => {
        disconnectSocket();
        invoke('dismiss_overlay', { recordDismissal: false }).catch(() => {});
      }, 1600);
    } else if (st.stage === 'autotype_error') {
      deliveryDetail.textContent = t().autotypeErr;
      manualActions.classList.remove('hidden');
    } else if (st.stage === 'clipboard_username') {
      deliveryDetail.textContent = t().clipUser;
      manualActions.classList.remove('hidden');
    } else if (st.stage === 'clipboard_password') {
      deliveryDetail.textContent = t().clipPass;
    } else if (st.stage === 'clipboard_cleared') {
      deliveryDetail.textContent = t().clipCleared;
      autoCloseTimer = setTimeout(() => {
        disconnectSocket();
        invoke('dismiss_overlay', { recordDismissal: false }).catch(() => {});
      }, 1200);
    } else if (st.detail) {
      deliveryDetail.textContent = st.detail;
    }
  });

  // Initial sync if window opens while session already exists
  invoke('get_overlay_state')
    .then((sess) => {
      if (sess) loadSession(sess);
    })
    .catch(() => {});
})();
