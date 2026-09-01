/**
 * ============================================================================
 * FlakeSecure - Browser Extension Popup Script (Chrome / Chromium) v2.0.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. SETTINGS & LANGUAGE MANAGEMENT:
 *    - Loads and persists displayMode, autoLogin, autoOverlay, and app_language from chrome.storage.
 *    - Updates popup UI text dynamically based on selected language (EN, DE, FR, ES).
 * 
 * 2. AUTHENTICATION & SESSION HANDLING:
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
    statusSaved: "Saved ✓",
    displayModeLabel: "Display Mode",
    modePopup: "Open Popup directly",
    modeButton: 'Show "FlakeSecure" Button',
    autoLogin: "Auto-Login",
    autoOverlay: "Overlay on password field",
    encryption: "Encryption",
    footer: "FlakeSecure – Biometric Security",
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
    statusSaved: "Gespeichert ✓",
    displayModeLabel: "Anzeige-Modus",
    modePopup: "Direkt Popup öffnen",
    modeButton: '"FlakeSecure" Button anzeigen',
    autoLogin: "Auto-Login",
    autoOverlay: "Overlay bei Passwortfeld",
    encryption: "Verschlüsselung",
    footer: "FlakeSecure – Biometrische Sicherheit",
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
    statusSaved: "Enregistré ✓",
    displayModeLabel: "Mode d'affichage",
    modePopup: "Ouvrir directement le popup",
    modeButton: 'Afficher le bouton "FlakeSecure"',
    autoLogin: "Connexion automatique",
    autoOverlay: "Superposition sur le mot de passe",
    encryption: "Chiffrement",
    footer: "FlakeSecure – Sécurité Biométrique",
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
    statusSaved: "Guardado ✓",
    displayModeLabel: "Modo de visualización",
    modePopup: "Abrir ventana emergente directamente",
    modeButton: 'Mostrar botón "FlakeSecure"',
    autoLogin: "Auto-Login",
    autoOverlay: "Superposición en campo de contraseña",
    encryption: "Cifrado",
    footer: "FlakeSecure – Seguridad Biométrica",
    fillAllFields: "Por favor, completa todos los campos",
    loginError: "Error de inicio de sesión"
  }
};

let currentLang = 'en';

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
  if (elStatusMsg && elStatusMsg.textContent !== t.statusSaved) elStatusMsg.textContent = t.statusReady;

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
        setTimeout(() => { statusMsg.textContent = EXT_I18N[newLang].statusReady; }, 1800);
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
        setTimeout(() => { statusMsg.textContent = t.statusReady; }, 1800);
      });
    });
  });

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
      loginError.textContent = t.fillAllFields;
      loginError.style.display = 'block';
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
      });
    } catch (err) {
      loginError.textContent = err.message || t.loginError;
      loginError.style.display = 'block';
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