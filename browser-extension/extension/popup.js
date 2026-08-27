/**
 * ============================================================================
 * FlakeSecure - Browser Extension Popup Script (Chrome / Chromium)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. SETTINGS MANAGEMENT:
 *    - Loads saved preferences (displayMode, autoLogin, autoOverlay) from chrome.storage.sync.
 *    - Persists changes to display modes (popup vs. button) and toggles with success feedback.
 * 
 * 2. AUTHENTICATION & SESSION HANDLING:
 *    - updateAuthUI(user): Dynamically toggles between login view and logged-in user profile view.
 *    - Login handler: Validates credentials (email/username and password), executes POST /api/auth/login, and saves JWT token and profile to chrome.storage.local.
 *    - Logout handler: Sends logout request to /api/auth/logout with Bearer token and clears local auth storage.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const modePopup = document.getElementById('mode-popup');
  const modeButton = document.getElementById('mode-button');
  const autoLoginToggle = document.getElementById('auto-login');
  const autoOverlayToggle = document.getElementById('auto-overlay');
  const statusMsg = document.getElementById('status-msg');

  chrome.storage.sync.get(['displayMode', 'autoLogin', 'autoOverlay'], (result) => {
    if (result.displayMode === 'button') {
      modeButton.checked = true;
    } else {
      modePopup.checked = true;
    }
    if (result.autoLogin !== undefined) autoLoginToggle.checked = result.autoLogin;
    if (result.autoOverlay !== undefined) autoOverlayToggle.checked = result.autoOverlay;
  });

  [modePopup, modeButton].forEach(radio => {
    radio.addEventListener('change', () => {
      chrome.storage.sync.set({
        displayMode: document.querySelector('input[name="display-mode"]:checked').value
      }, () => {
        statusMsg.textContent = 'Gespeichert ✓';
        setTimeout(() => { statusMsg.textContent = 'Bereit'; }, 2000);
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
    if (!identifier || !password) {
      loginError.textContent = 'Bitte alle Felder ausfüllen';
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
      
      if (res.ok) {
        chrome.storage.local.set({ authToken: data.token, authUser: data.user }, () => {
          updateAuthUI(data.user);
          loginIdentifier.value = '';
          loginPassword.value = '';
        });
      } else {
        loginError.textContent = data.message || 'Login fehlgeschlagen';
        loginError.style.display = 'block';
      }
    } catch (err) {
      loginError.textContent = 'Netzwerkfehler';
      loginError.style.display = 'block';
    } finally {
      loginBtn.disabled = false;
      loginBtn.style.opacity = '1';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    chrome.storage.local.get(['authToken'], async (res) => {
      if (res.authToken) {
        try {
          await fetch(`${API_URL}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${res.authToken}` }
          });
        } catch (e) {}
      }
      chrome.storage.local.remove(['authToken', 'authUser'], () => {
        updateAuthUI(null);
      });
    });
  });
});