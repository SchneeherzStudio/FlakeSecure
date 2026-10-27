/**
 * ============================================================================
 * FlakeSecure - Browser Extension Popup Script (Chrome / Chromium) v2.0.3
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. SETTINGS & LANGUAGE MANAGEMENT:
 *    - Loads and persists displayMode, autoLogin, autoOverlay, and app_language from chrome.storage.
 *    - Updates popup UI text dynamically based on selected language (EN, DE, FR, ES).
 * 
 * 2. THEME ENGINE:
 *    - Detects OS prefers-color-scheme by default.
 *    - Manual toggle persisted in chrome.storage.local (ext_theme).
 * 
 * 3. AUTHENTICATION & SESSION HANDLING:
 *    - updateAuthUI(user): Toggles between login form and authenticated profile state.
 *    - Login handler: Calls /api/auth/login, stores JWT token and user info in chrome.storage.local.
 *    - Logout handler: Calls /api/auth/logout and clears local auth storage.
 * ============================================================================
 */

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
    loginError: "Login failed"
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
    loginError: "Anmeldung fehlgeschlagen"
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
    loginError: "Échec de connexion"
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
    loginError: "Error de inicio de sesión"
  }
};

let currentLang = 'en';
let isSiteUsingEmbed = false;

function applyTranslations(lang) {
  currentLang = ['en', 'de', 'fr', 'es'].includes(lang) ? lang : 'en';
  const t = EXT_I18N[currentLang];

  const elAuthTitle = document.getElementById('t-auth-title');
  if (elAuthTitle) elAuthTitle.textContent = t.authTitle;

  const elIdent = document.getElementById('login-identifier');
  if (elIdent) elIdent.placeholder = t.identifierPlaceholder;

  const elPass = document.getElementById('login-password');
  if (elPass) elPass.placeholder = t.passwordPlaceholder;

  const elLoginBtn = document.getElementById('login-btn');
  if (elLoginBtn) elLoginBtn.textContent = t.loginBtn;

  const elLoggedInAs = document.getElementById('t-logged-in-as');
  if (elLoggedInAs) elLoggedInAs.textContent = t.loggedInAs;

  const elLogoutBtn = document.getElementById('logout-btn');
  if (elLogoutBtn) elLogoutBtn.textContent = t.logoutBtn;

  const elStatusLabel = document.getElementById('t-status-label');
  if (elStatusLabel) elStatusLabel.textContent = t.statusLabel;

  const elStatusMsg = document.getElementById('status-msg');
  if (elStatusMsg && elStatusMsg.textContent !== t.statusSaved) {
    elStatusMsg.textContent = isSiteUsingEmbed ? t.statusPaused : t.statusReady;
  }

  const elEmbedNotice = document.getElementById('t-embed-notice');
  if (elEmbedNotice) elEmbedNotice.textContent = t.embedNotice;

  const elDisplayModeLabel = document.getElementById('t-display-mode-label');
  if (elDisplayModeLabel) elDisplayModeLabel.textContent = t.displayModeLabel;

  const elModePopup = document.getElementById('t-mode-popup');
  if (elModePopup) elModePopup.textContent = t.modePopup;

  const elModeButton = document.getElementById('t-mode-button');
  if (elModeButton) elModeButton.textContent = t.modeButton;

  const elAutoLogin = document.getElementById('t-auto-login');
  if (elAutoLogin) elAutoLogin.textContent = t.autoLogin;

  const elAutoOverlay = document.getElementById('t-auto-overlay');
  if (elAutoOverlay) elAutoOverlay.textContent = t.autoOverlay;

  const elEncryption = document.getElementById('t-encryption');
  if (elEncryption) elEncryption.textContent = t.encryption;

  const elFooter = document.getElementById('t-footer');
  if (elFooter) elFooter.textContent = t.footer;

  const langSelect = document.getElementById('ext-lang-select');
  if (langSelect) langSelect.value = currentLang;
}

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

  chrome.storage.local.get(['ext_theme'], (res) => {
    let activeTheme = res.ext_theme;
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
      chrome.storage.local.set({ ext_theme: nextTheme });
    });
  }

  chrome.storage.sync.get(['displayMode', 'autoLogin', 'autoOverlay', 'app_language'], (result) => {
    if (result.displayMode === 'button') {
      modeButton.checked = true;
    } else {
      modePopup.checked = true;
    }
    if (result.autoLogin !== undefined) autoLoginToggle.checked = result.autoLogin;
    if (result.autoOverlay !== undefined) autoOverlayToggle.checked = result.autoOverlay;

    const savedLang = result.app_language || (navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en');
    applyTranslations(savedLang);
  });

  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      const newLang = e.target.value;
      chrome.storage.sync.set({ app_language: newLang }, () => {
        applyTranslations(newLang);
        statusMsg.textContent = EXT_I18N[newLang].statusSaved;
        setTimeout(() => {
          statusMsg.textContent = isSiteUsingEmbed ? EXT_I18N[newLang].statusPaused : EXT_I18N[newLang].statusReady;
        }, 1800);
      });
    });
  }

  [modePopup, modeButton].forEach(radio => {
    radio.addEventListener('change', () => {
      chrome.storage.sync.set({
        displayMode: document.querySelector('input[name="display-mode"]:checked').value
      }, () => {
        const t = EXT_I18N[currentLang] || EXT_I18N.en;
        statusMsg.textContent = t.statusSaved;
        setTimeout(() => {
          statusMsg.textContent = isSiteUsingEmbed ? t.statusPaused : t.statusReady;
        }, 1800);
      });
    });
  });

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

  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) return;

      chrome.tabs.sendMessage(tab.id, { type: 'FS_CHECK_EMBED' }, (resp) => {
        if (!chrome.runtime.lastError && resp && resp.embedPresent) {
          showEmbedPausedUI();
          return;
        }
        if (chrome.scripting && chrome.scripting.executeScript) {
          chrome.scripting.executeScript({
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
            if (!chrome.runtime.lastError && results && results[0] && results[0].result) {
              showEmbedPausedUI();
            }
          });
        }
      });
    });
  }

  [autoLoginToggle, autoOverlayToggle].forEach(toggle => {
    toggle.addEventListener('change', () => {
      chrome.storage.sync.set({
        autoLogin: autoLoginToggle.checked,
        autoOverlay: autoOverlayToggle.checked
      });
    });
  });

  const loginView = document.getElementById('login-view');
  const userView = document.getElementById('user-view');
  const authUsername = document.getElementById('auth-username');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const loginIdentifier = document.getElementById('login-identifier');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');

  const API_URL = 'https://flakesecure.snowystudio.dev';

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

  function updateAuthUI(user) {
    if (user) {
      loginView.style.display = 'none';
      userView.style.display = 'flex';
      authUsername.textContent = user.username || user.email;
    } else {
      loginView.style.display = 'block';
      userView.style.display = 'none';
    }
  }

  chrome.storage.local.get(['authToken', 'authUser'], (res) => {
    updateAuthUI(res.authUser);
  });

  loginBtn.addEventListener('click', async () => {
    const identifier = loginIdentifier.value.trim().toLowerCase();
    const password = loginPassword.value;
    const t = EXT_I18N[currentLang] || EXT_I18N.en;

    if (!identifier || !password) {
      loginError.style.display = 'none';
      showExtToast(t.fillAllFields, 'error');
      return;
    }
    
    loginBtn.disabled = true;
    loginBtn.style.opacity = '0.5';
    loginError.style.display = 'none';
    
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
      
      chrome.storage.local.set({
        authToken: data.token,
        authUser: data.user
      }, () => {
        updateAuthUI(data.user);
        loginIdentifier.value = '';
        loginPassword.value = '';
        showExtToast(`${t.loggedInAs}: ${data.user.username || data.user.email}`, 'success');
      });
    } catch (err) {
      loginError.style.display = 'none';
      showExtToast(err.message || t.loginError, 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.style.opacity = '1';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      const { authToken } = await new Promise(r => chrome.storage.local.get(['authToken'], r));
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
      chrome.storage.local.remove(['authToken', 'authUser'], () => {
        updateAuthUI(null);
      });
    }
  });
});