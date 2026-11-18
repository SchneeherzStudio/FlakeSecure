/**
 * ============================================================================
 * FlakeSecure - Browser Extension Popup Script v2.1.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. SETTINGS & LANGUAGE MANAGEMENT:
 *    - Loads and persists displayMode, autoLogin, autoOverlay, and app_language.
 *    - Updates popup UI text dynamically based on selected language (EN, DE, FR, ES).
 * 
 * 2. ZERO-KNOWLEDGE QR-CODE PAIRING:
 *    - Generates ephemeral sid (16 bytes) and AES key (32 bytes).
 *    - Renders pairing QR code (flakesecure://pair?...) via lib/qrcode.min.js.
 *    - Connects to relay server over Socket.IO and listens for real-time scan / pairing events.
 *    - Decrypts mobile credential payload via WebCrypto AES-256-CTR + HMAC-SHA256.
 *    - Persists session into extension storage.
 * 
 * 3. FALLBACK MANUAL AUTH & PROFILE VIEW:
 *    - Toggleable manual login fallback form.
 *    - Displays active user status and clean logout.
 * ============================================================================
 */

const storageAPI = (typeof browser !== 'undefined' && browser.storage) ? browser.storage : chrome.storage;
const extAPI = (typeof browser !== 'undefined' && browser.runtime) ? browser : (typeof chrome !== 'undefined' ? chrome : null);

const EXT_I18N = {
  en: {
    authTitle: "Account Login",
    identifierPlaceholder: "Username or Email",
    passwordPlaceholder: "Password",
    loginBtn: "Sign In",
    loggedInAs: "Logged in as",
    logoutBtn: "Log Out",
    statusLabel: "Status",
    statusReady: "Ready",
    statusPaused: "Paused (Direct site integration)",
    statusSaved: "Saved [OK]",
    embedNotice: "This site uses FlakeSecure directly – extension paused",
    displayModeLabel: "Display Mode",
    modePopup: "Open Popup directly",
    modeButton: 'Show "FlakeSecure" Button',
    autoLogin: "Auto-Login",
    autoOverlay: "Overlay on password field",
    encryption: "Encryption",
    footer: "FlakeSecure: Biometric Security",
    fillAllFields: "Please fill in all fields",
    loginError: "Login failed",
    pairTitle: "Pair with FlakeSecure App",
    pairSubtitle: "Scan with your FlakeSecure Mobile App",
    pairWaiting: "Waiting for scan...",
    pairConfirmOnPhone: "Confirm on your phone...",
    pairHelp: "Help / Download App",
    fallbackPassword: "Classic login with password",
    backToQr: "Back to QR code pairing",
    pairSuccess: "Browser extension paired successfully!"
  },
  de: {
    authTitle: "Account Anmeldung",
    identifierPlaceholder: "Benutzername oder E-Mail",
    passwordPlaceholder: "Passwort",
    loginBtn: "Anmelden",
    loggedInAs: "Angemeldet als",
    logoutBtn: "Abmelden",
    statusLabel: "Status",
    statusReady: "Bereit",
    statusPaused: "Pausiert (Direktintegration)",
    statusSaved: "Gespeichert [OK]",
    embedNotice: "Diese Website nutzt FlakeSecure direkt – Erweiterung pausiert",
    displayModeLabel: "Anzeige-Modus",
    modePopup: "Direkt Popup öffnen",
    modeButton: '"FlakeSecure" Button anzeigen',
    autoLogin: "Auto-Login",
    autoOverlay: "Overlay bei Passwortfeld",
    encryption: "Verschlüsselung",
    footer: "FlakeSecure: Biometrische Sicherheit",
    fillAllFields: "Bitte alle Felder ausfüllen",
    loginError: "Anmeldung fehlgeschlagen",
    pairTitle: "Mit FlakeSecure App koppeln",
    pairSubtitle: "Scan mit deiner FlakeSecure Mobile App",
    pairWaiting: "Warte auf Scan...",
    pairConfirmOnPhone: "Auf Smartphone bestätigen...",
    pairHelp: "Hilfe / App herunterladen",
    fallbackPassword: "Klassische Anmeldung mit Passwort",
    backToQr: "Zurück zur QR-Code Kopplung",
    pairSuccess: "Browser-Erweiterung erfolgreich gekoppelt!"
  },
  fr: {
    authTitle: "Connexion au Compte",
    identifierPlaceholder: "Nom d'utilisateur ou E-mail",
    passwordPlaceholder: "Mot de passe",
    loginBtn: "Se connecter",
    loggedInAs: "Connecté en tant que",
    logoutBtn: "Déconnexion",
    statusLabel: "Statut",
    statusReady: "Prêt",
    statusPaused: "En pause (Intégration directe)",
    statusSaved: "Enregistré [OK]",
    embedNotice: "Ce site utilise FlakeSecure directement – extension en pause",
    displayModeLabel: "Mode d'affichage",
    modePopup: "Ouvrir directement le popup",
    modeButton: 'Afficher le bouton "FlakeSecure"',
    autoLogin: "Connexion automatique",
    autoOverlay: "Superposition sur le mot de passe",
    encryption: "Chiffrement",
    footer: "FlakeSecure: Sécurité Biométrique",
    fillAllFields: "Veuillez remplir tous les champs",
    loginError: "Échec de connexion",
    pairTitle: "Associer avec l'application FlakeSecure",
    pairSubtitle: "Scannez avec votre application mobile FlakeSecure",
    pairWaiting: "En attente du scan...",
    pairConfirmOnPhone: "Confirmez sur votre smartphone...",
    pairHelp: "Aide / Télécharger l'application",
    fallbackPassword: "Connexion classique par mot de passe",
    backToQr: "Retour à l'association par QR",
    pairSuccess: "Extension de navigateur associée avec succès !"
  },
  es: {
    authTitle: "Inicio de Sesión",
    identifierPlaceholder: "Usuario o Correo",
    passwordPlaceholder: "Contraseña",
    loginBtn: "Iniciar sesión",
    loggedInAs: "Conectado como",
    logoutBtn: "Cerrar sesión",
    statusLabel: "Estado",
    statusReady: "Listo",
    statusPaused: "En pausa (Integración directa)",
    statusSaved: "Guardado [OK]",
    embedNotice: "Este sitio usa FlakeSecure directamente – extensión en pausa",
    displayModeLabel: "Modo de visualización",
    modePopup: "Abrir ventana emergente directamente",
    modeButton: 'Mostrar botón "FlakeSecure"',
    autoLogin: "Auto-Login",
    autoOverlay: "Superposición en campo de contraseña",
    encryption: "Cifrado",
    footer: "FlakeSecure: Seguridad Biométrica",
    fillAllFields: "Por favor, completa todos los campos",
    loginError: "Error de inicio de sesión",
    pairTitle: "Vincular con la app FlakeSecure",
    pairSubtitle: "Escanea con tu app móvil FlakeSecure",
    pairWaiting: "Esperando escaneo...",
    pairConfirmOnPhone: "Confirma en tu teléfono...",
    pairHelp: "Ayuda / Descargar app",
    fallbackPassword: "Inicio de sesión clásico con contraseña",
    backToQr: "Volver a vinculación por QR",
    pairSuccess: "¡Extensión de navegador vinculada con éxito!"
  }
};

let currentLang = 'en';
let isSiteUsingEmbed = false;
let pairingSocket = null;
let currentPairingSession = null; // { sid, keyHex }

const API_URL = 'https://flakesecure.snowystudio.dev';

/* ─── Cryptography Utilities (AES-256-CTR + HMAC-SHA256) ───────────────────── */
function generateSessionId() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function generateAESKey() {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  return Array.from(raw, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.substr(i, 2), 16);
  return b;
}

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function decryptData(encryptedPayload, keyHex) {
  try {
    const { iv, data } = encryptedPayload;
    const ivBytes = new Uint8Array(iv);
    const dataBytes = new Uint8Array(data);
    const TAG_LEN = 32;
    const ciphertext = dataBytes.slice(0, dataBytes.length - TAG_LEN);
    const tagBytes = dataBytes.slice(dataBytes.length - TAG_LEN);

    const macInputHex = bytesToHex(ivBytes) + bytesToHex(ciphertext);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(macInputHex));
    const expected = new Uint8Array(hashBuffer);

    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ tagBytes[i];
    if (diff !== 0) throw new Error('HMAC verification failed – payload may be tampered');

    const cryptoKey = await crypto.subtle.importKey(
      'raw', hexToBytes(keyHex), { name: 'AES-CTR' }, false, ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CTR', counter: ivBytes, length: 64 },
      cryptoKey,
      ciphertext
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (e) {
    console.error('[FlakeSecure Popup] Decryption failed:', e);
    return null;
  }
}

/* ─── Translations Engine ─────────────────────────────────────────────────── */
function applyTranslations(lang) {
  currentLang = ['en', 'de', 'fr', 'es'].includes(lang) ? lang : 'en';
  const t = EXT_I18N[currentLang];

  const map = {
    't-auth-title': t.authTitle,
    't-logged-in-as': t.loggedInAs,
    't-status-label': t.statusLabel,
    't-embed-notice': t.embedNotice,
    't-display-mode-label': t.displayModeLabel,
    't-mode-popup': t.modePopup,
    't-mode-button': t.modeButton,
    't-auto-login': t.autoLogin,
    't-auto-overlay': t.autoOverlay,
    't-encryption': t.encryption,
    't-footer': t.footer,
    't-pair-title': t.pairTitle,
    't-pair-subtitle': t.pairSubtitle,
    't-pair-help': t.pairHelp,
    't-fallback-password': t.fallbackPassword,
    't-back-to-qr': t.backToQr
  };

  for (const [id, val] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  const elIdent = document.getElementById('login-identifier');
  if (elIdent) elIdent.placeholder = t.identifierPlaceholder;

  const elPass = document.getElementById('login-password');
  if (elPass) elPass.placeholder = t.passwordPlaceholder;

  const elLoginBtn = document.getElementById('login-btn');
  if (elLoginBtn) elLoginBtn.textContent = t.loginBtn;

  const elLogoutBtn = document.getElementById('logout-btn');
  if (elLogoutBtn) elLogoutBtn.textContent = t.logoutBtn;

  const elStatusMsg = document.getElementById('status-msg');
  if (elStatusMsg && elStatusMsg.textContent !== t.statusSaved) {
    elStatusMsg.textContent = isSiteUsingEmbed ? t.statusPaused : t.statusReady;
  }

  const langSelect = document.getElementById('ext-lang-select');
  if (langSelect) langSelect.value = currentLang;

  const pairStatusText = document.getElementById('pair-status-text');
  const pairStatusDot = document.getElementById('pair-status-dot');
  if (pairStatusText) {
    if (pairStatusDot && pairStatusDot.classList.contains('scanned')) {
      pairStatusText.textContent = t.pairConfirmOnPhone;
    } else {
      pairStatusText.textContent = t.pairWaiting;
    }
  }
}

/* ─── Toast System ────────────────────────────────────────────────────────── */
function showExtToast(message, severity = 'info') {
  const container = document.getElementById('ext-toast-container');
  if (!container || !message) return;
  const cfg = {
    error: { color: '#ef4444', duration: 6000 },
    warning: { color: '#f59e0b', duration: 4500 },
    success: { color: '#10b981', duration: 3500 },
    info: { color: '#3b82f6', duration: 3500 }
  }[severity] || { color: '#3b82f6', duration: 3500 };

  const toast = document.createElement('div');
  toast.className = `fs-ext-toast fs-ext-toast-${severity}`;
  const bodyEl = document.createElement('div');
  bodyEl.className = 'fs-ext-toast-body';
  bodyEl.textContent = message;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'fs-ext-toast-close';
  closeBtn.textContent = '×';
  const track = document.createElement('div');
  track.className = 'fs-ext-toast-track';
  const bar = document.createElement('div');
  bar.className = 'fs-ext-toast-bar';
  bar.style.background = cfg.color;
  bar.style.width = '100%';
  track.appendChild(bar);
  toast.appendChild(bodyEl);
  toast.appendChild(closeBtn);
  toast.appendChild(track);

  let remaining = cfg.duration;
  let lastTick = performance.now();
  let paused = false;
  let rafId = null;
  let removed = false;

  function dismiss() {
    if (removed) return;
    removed = true;
    if (rafId) cancelAnimationFrame(rafId);
    toast.classList.add('fs-ext-toast-hide');
    setTimeout(() => toast.remove(), 210);
  }

  function tick(now) {
    if (removed) return;
    if (!paused) {
      remaining = Math.max(0, remaining - (now - lastTick));
      bar.style.width = `${(remaining / cfg.duration) * 100}%`;
      if (remaining <= 0) {
        dismiss();
        return;
      }
    }
    lastTick = now;
    rafId = requestAnimationFrame(tick);
  }

  toast.addEventListener('mouseenter', () => { paused = true; });
  toast.addEventListener('mouseleave', () => { paused = false; lastTick = performance.now(); });
  closeBtn.addEventListener('click', dismiss);

  container.appendChild(toast);
  rafId = requestAnimationFrame(tick);
}

/* ─── Pairing Logic ───────────────────────────────────────────────────────── */
function stopPairingSession() {
  if (pairingSocket) {
    try { pairingSocket.disconnect(); } catch (e) {}
    pairingSocket = null;
  }
  currentPairingSession = null;
}

function startPairingSession() {
  stopPairingSession();

  const qrContainer = document.getElementById('pair-qr-code');
  const statusText = document.getElementById('pair-status-text');
  const statusDot = document.getElementById('pair-status-dot');
  if (!qrContainer) return;

  const sid = generateSessionId();
  const keyHex = generateAESKey();
  currentPairingSession = { sid, keyHex };

  const qrContent = `flakesecure://pair?s=${sid}&k=${keyHex}&d=FlakeSecure%20Extension&action=pair`;

  qrContainer.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(qrContainer, {
      text: qrContent,
      width: 140,
      height: 140,
      colorDark: '#080a12',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  if (statusDot) statusDot.classList.remove('scanned');
  const t = EXT_I18N[currentLang] || EXT_I18N.en;
  if (statusText) statusText.textContent = t.pairWaiting;

  if (typeof io !== 'undefined') {
    try {
      pairingSocket = io(API_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 15000
      });

      pairingSocket.on('connect', () => {
        pairingSocket.emit('join-session', { sid, domain: 'FlakeSecure Extension' });
      });

      pairingSocket.on('qr-scanned', () => {
        if (statusDot) statusDot.classList.add('scanned');
        const ct = EXT_I18N[currentLang] || EXT_I18N.en;
        if (statusText) statusText.textContent = ct.pairConfirmOnPhone;
      });

      const handlePayload = async (payload) => {
        if (!currentPairingSession || currentPairingSession.sid !== sid) return;
        const decrypted = await decryptData(payload, currentPairingSession.keyHex);
        if (!decrypted) return;

        const token = decrypted.token || decrypted.authToken;
        const user = decrypted.user || decrypted.authUser;
        if (token && user) {
          stopPairingSession();
          storageAPI.local.set({ authToken: token, authUser: user }, () => {
            updateAuthUI(user);
            const ct = EXT_I18N[currentLang] || EXT_I18N.en;
            showExtToast(ct.pairSuccess, 'success');
          });
        }
      };

      pairingSocket.on('pairing-data', handlePayload);
      pairingSocket.on('login-data', handlePayload);

      pairingSocket.on('session-expired', () => {
        storageAPI.local.get(['authUser'], (res) => {
          if (!res?.authUser) {
            startPairingSession();
          }
        });
      });
    } catch (err) {
      console.error('[FlakeSecure Popup] Pairing socket error:', err);
    }
  }
}

function updateAuthUI(user) {
  const pairView = document.getElementById('pair-view');
  const loginView = document.getElementById('login-view');
  const userView = document.getElementById('user-view');
  const authUsername = document.getElementById('auth-username');

  if (user) {
    stopPairingSession();
    if (pairView) pairView.style.display = 'none';
    if (loginView) loginView.style.display = 'none';
    if (userView) userView.style.display = 'flex';
    if (authUsername) authUsername.textContent = user.username || user.email;
  } else {
    if (userView) userView.style.display = 'none';
    if (loginView && loginView.style.display === 'block') {
      if (pairView) pairView.style.display = 'none';
    } else {
      if (pairView) pairView.style.display = 'block';
      if (loginView) loginView.style.display = 'none';
      startPairingSession();
    }
  }
}

/* ─── Main Lifecycle & Event Listeners ────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const modePopup = document.getElementById('mode-popup');
  const modeButton = document.getElementById('mode-button');
  const autoLoginToggle = document.getElementById('auto-login');
  const autoOverlayToggle = document.getElementById('auto-overlay');
  const statusMsg = document.getElementById('status-msg');
  const langSelect = document.getElementById('ext-lang-select');
  const themeToggleBtn = document.getElementById('ext-theme-toggle');
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');

  const pairView = document.getElementById('pair-view');
  const loginView = document.getElementById('login-view');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const loginIdentifier = document.getElementById('login-identifier');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const openWelcomeBtn = document.getElementById('open-welcome-btn');
  const togglePasswordLogin = document.getElementById('toggle-password-login');
  const toggleQrPairing = document.getElementById('toggle-qr-pairing');

  // Theme Initializer
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      if (sunIcon) sunIcon.style.display = 'block';
      if (moonIcon) moonIcon.style.display = 'none';
    } else {
      if (sunIcon) sunIcon.style.display = 'none';
      if (moonIcon) moonIcon.style.display = 'block';
    }
  }

  storageAPI.local.get(['ext_theme'], (res) => {
    let activeTheme = res?.ext_theme;
    if (!activeTheme) {
      activeTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    applyTheme(activeTheme);
  });

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      storageAPI.local.set({ ext_theme: nextTheme });
    });
  }

  // Settings & Language Initializer
  storageAPI.sync.get(['displayMode', 'autoLogin', 'autoOverlay', 'app_language'], (result) => {
    if (result?.displayMode === 'button') {
      if (modeButton) modeButton.checked = true;
    } else {
      if (modePopup) modePopup.checked = true;
    }
    if (result?.autoLogin !== undefined && autoLoginToggle) autoLoginToggle.checked = result.autoLogin;
    if (result?.autoOverlay !== undefined && autoOverlayToggle) autoOverlayToggle.checked = result.autoOverlay;

    const savedLang = result?.app_language || (navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en');
    applyTranslations(savedLang);
  });

  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      const newLang = e.target.value;
      storageAPI.sync.set({ app_language: newLang }, () => {
        applyTranslations(newLang);
        if (statusMsg) statusMsg.textContent = EXT_I18N[newLang].statusSaved;
        setTimeout(() => {
          if (statusMsg) {
            statusMsg.textContent = isSiteUsingEmbed ? EXT_I18N[newLang].statusPaused : EXT_I18N[newLang].statusReady;
          }
        }, 1800);
      });
    });
  }

  [modePopup, modeButton].forEach(radio => {
    if (!radio) return;
    radio.addEventListener('change', () => {
      const selected = document.querySelector('input[name="display-mode"]:checked')?.value || 'popup';
      storageAPI.sync.set({ displayMode: selected }, () => {
        const t = EXT_I18N[currentLang] || EXT_I18N.en;
        if (statusMsg) statusMsg.textContent = t.statusSaved;
        setTimeout(() => {
          if (statusMsg) {
            statusMsg.textContent = isSiteUsingEmbed ? t.statusPaused : t.statusReady;
          }
        }, 1800);
      });
    });
  });

  // Embed integration detection
  function showEmbedPausedUI() {
    isSiteUsingEmbed = true;
    const noticeEl = document.getElementById('embed-paused-notice');
    if (noticeEl) noticeEl.style.display = 'flex';
    const dotEl = document.getElementById('status-dot');
    if (dotEl) dotEl.classList.add('paused');
    const t = EXT_I18N[currentLang] || EXT_I18N.en;
    if (statusMsg) statusMsg.textContent = t.statusPaused;
    const elEmbedNotice = document.getElementById('t-embed-notice');
    if (elEmbedNotice) elEmbedNotice.textContent = t.embedNotice;
  }

  if (extAPI && extAPI.tabs && extAPI.tabs.query) {
    extAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) return;

      const checkViaScripting = () => {
        if (extAPI.scripting && extAPI.scripting.executeScript) {
          extAPI.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              try {
                if ((window.location.pathname || '').includes('/embed/widget.html')) return true;
                if (document.documentElement && document.documentElement.hasAttribute('data-flakesecure-embed')) return true;
                return !!document.querySelector(
                  'html[data-flakesecure-embed], meta[name="flakesecure-embed"], script[src*="/embed.js"], iframe[src*="/embed/widget.html"], .flakesecure-login-button, #flakesecure-modal-backdrop, .flakesecure-auto-container'
                );
              } catch (e) {
                return false;
              }
            }
          }, (results) => {
            if (!extAPI.runtime?.lastError && results && results[0] && results[0].result) {
              showEmbedPausedUI();
            }
          });
        }
      };

      try {
        extAPI.tabs.sendMessage(tab.id, { type: 'FS_CHECK_EMBED' }, (resp) => {
          if (!extAPI.runtime?.lastError && resp && resp.embedPresent) {
            showEmbedPausedUI();
            return;
          }
          checkViaScripting();
        });
      } catch (e) {
        checkViaScripting();
      }
    });
  }

  [autoLoginToggle, autoOverlayToggle].forEach(toggle => {
    if (!toggle) return;
    toggle.addEventListener('change', () => {
      storageAPI.sync.set({
        autoLogin: autoLoginToggle.checked,
        autoOverlay: autoOverlayToggle.checked
      });
    });
  });

  // Help / Welcome Button
  if (openWelcomeBtn) {
    openWelcomeBtn.addEventListener('click', () => {
      const url = extAPI?.runtime?.getURL ? extAPI.runtime.getURL('welcome.html') : 'welcome.html';
      if (extAPI?.tabs?.create) {
        extAPI.tabs.create({ url });
      } else {
        window.open(url, '_blank');
      }
    });
  }

  // Toggle between QR code pairing and manual password login
  if (togglePasswordLogin) {
    togglePasswordLogin.addEventListener('click', (e) => {
      e.preventDefault();
      stopPairingSession();
      if (pairView) pairView.style.display = 'none';
      if (loginView) loginView.style.display = 'block';
    });
  }

  if (toggleQrPairing) {
    toggleQrPairing.addEventListener('click', (e) => {
      e.preventDefault();
      if (loginView) loginView.style.display = 'none';
      if (pairView) pairView.style.display = 'block';
      startPairingSession();
    });
  }

  // Load Auth State
  storageAPI.local.get(['authToken', 'authUser'], (res) => {
    updateAuthUI(res?.authUser);
  });

  // Manual Password Login
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const identifier = loginIdentifier.value.trim().toLowerCase();
      const password = loginPassword.value;
      const t = EXT_I18N[currentLang] || EXT_I18N.en;

      if (!identifier || !password) {
        if (loginError) loginError.style.display = 'none';
        showExtToast(t.fillAllFields, 'error');
        return;
      }
      
      loginBtn.disabled = true;
      loginBtn.style.opacity = '0.5';
      if (loginError) loginError.style.display = 'none';
      
      try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || t.loginError);
        }
        
        storageAPI.local.set({
          authToken: data.token,
          authUser: data.user
        }, () => {
          updateAuthUI(data.user);
          loginIdentifier.value = '';
          loginPassword.value = '';
          showExtToast(`${t.loggedInAs}: ${data.user.username || data.user.email}`, 'success');
        });
      } catch (err) {
        if (loginError) loginError.style.display = 'none';
        showExtToast(err.message || t.loginError, 'error');
      } finally {
        loginBtn.disabled = false;
        loginBtn.style.opacity = '1';
      }
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const res = await new Promise(r => storageAPI.local.get(['authToken'], r));
        const authToken = res?.authToken;
        if (authToken) {
          await fetch(`${API_URL}/api/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            }
          }).catch(() => {});
        }
      } catch (e) {
      } finally {
        storageAPI.local.remove(['authToken', 'authUser'], () => {
          updateAuthUI(null);
        });
      }
    });
  }
});

window.addEventListener('unload', () => {
  stopPairingSession();
});
