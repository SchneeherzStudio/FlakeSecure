/**
 * ============================================================================
 * FlakeSecure - Browser Extension Content Script (Firefox MV3)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ARCHITECTURE:
 * 
 * 1. CRYPTOGRAPHY & SESSION GENERATION:
 *    - generateSessionId(): Generates a cryptographically secure 16-byte hex session ID.
 *    - generateAESKey(): Generates a random 32-byte (256-bit) AES key as hex string for the QR code.
 *    - hexToBytes(hex) / bytesToHex(bytes): Converts between hexadecimal strings and Uint8Array byte arrays.
 *    - decryptData(encryptedPayload, keyHex): Decrypts received data via AES-256-CTR and validates integrity via HMAC-SHA256 (Encrypt-then-MAC).
 * 
 * 2. DOM ANALYSIS & FORM DETECTION:
 *    - isVisible(el): Checks if a DOM element is visible and rendered (BoundingRect, computed styles, opacity).
 *    - findPasswordFields(): Searches for all visible password input fields using comprehensive selectors.
 *    - findUsernameFields(): Searches for visible username, email, and identifier fields.
 *    - findPrecedingTextInput(passwordField): Finds the preceding text input field relative to a password field.
 *    - analyzeForm(targetField): Distinguishes between login and registration forms based on fields/keywords and extracts required registration fields.
 *    - encodeFieldsCompact(fields): Encodes detected registration fields into compact URL codes for the QR code.
 * 
 * 3. FORM FILLING & NATIVE EVENT SIMULATION:
 *    - simulateInput(element, value): Sets field values using native prototype setters and triggers input, change, and blur events.
 *    - fillRegistrationFields(fieldsData): Dynamically populates all account creation fields (firstName, lastName, email, username, password, phone).
 *    - fillLoginFields(username, password): Populates credentials (username and password) into login forms.
 * 
 * 4. DYNAMIC LOADING & MULTI-STEP LOGIN:
 *    - startDynamicPasswordWatcher(): Starts a polling window (15s) for forms with delayed password fields (e.g. gmx.net, SPAs).
 *    - checkAndFillPendingPassword(): Checks cached credentials in sessionStorage and fills passwords into dynamically rendered fields.
 * 
 * 5. SMART FORM SUBMISSION & SOCIAL BUTTON FILTERING:
 *    - isSocialOrNegativeButton(btn): Filters out third-party OAuth buttons (Google, Facebook, Apple, etc.) and cancel/forgot-password buttons.
 *    - findSubmitButton(form, targetField): Locates the primary submit/login button of the form excluding social login buttons.
 *    - submitForm(form, targetField): Executes safe form submission (button click, requestSubmit, submit, or Enter keydown).
 * 
 * 6. SOCKET.IO RELAY COMMUNICATION (VIA BACKGROUND SCRIPT):
 *    - connectSocket(sessionId, keyHex, onData): Sends CONNECT messages to the background script (Firefox MV3 WebSocket isolation) and receives decrypted payloads.
 * 
 * 7. USER INTERFACE (MODAL OVERLAY & BUTTON):
 *    - updateOverlayStatus(type, message): Updates the status message and visual feedback in the overlay.
 *    - createOverlay(sessionId, deepLink, domain, isRegister): Injects the FlakeSecure modal overlay with QR code and real-time status into the DOM.
 *    - removeOverlay(cancelled): Dismisses the overlay with exit animation, sends DISCONNECT to the background script, and resets state.
 *    - injectLoginButton(targetField): Injects the FlakeSecure button trigger when button display mode is active.
 *    - handlePasswordField(field): Checks saved display preferences (popup vs. button) and triggers display.
 *    - showOverlay(field): Initializes session, key, deep link, mounts overlay, and listens for incoming payload.
 * 
 * 8. ENTRY POINT & MUTATION OBSERVER:
 *    - checkForPasswordField(): Main detection loop to discover forms on the page.
 *    - Event listeners & MutationObserver: Initial execution on DOMContentLoaded, re-checks on focus/click, and continuous DOM observation.
 * ============================================================================
 */

(function () {
  'use strict';

  let uiInjected = false;
  let userCancelled = false;
  let currentSessionId = null;
  let activeWatcherTimer = null;
  let activeWatcherEnd = 0;

  const SOCIAL_OR_NEGATIVE_KEYWORDS = [
    'facebook', 'google', 'apple', 'xbox', 'playstation', 'psn', 'nintendo',
    'riot', 'twitter', 'x.com', 'github', 'steam', 'battlenet', 'discord',
    'amazon', 'vk', 'wechat', 'line', 'yahoo', 'qr', 'passkey', 'magic link',
    'sso', 'saml', 'authenticator', 'switch account', 'create account',
    'register', 'sign up', 'registrieren', 'konto erstellen', 'forgot',
    'vergessen', 'help', 'hilfe', 'back', 'zurück', 'cancel', 'abbrechen', 'close', 'schließen'
  ];

  const POSITIVE_SUBMIT_KEYWORDS = [
    'sign in', 'log in', 'signin', 'login', 'submit', 'anmelden', 'einloggen',
    'weiter', 'next', 'continue', 'connexion', 'iniciar sesión', 'entrar',
    'iniciar sesion', 'acceder', 'submit-btn', 'auth-submit', 'login-button',
    'btn-submit', 'arrow-button', 'btn-login', 'arrow', 'proceed'
  ];

  function generateSessionId() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  async function generateAESKey() {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const keyHex = Array.from(raw, b => b.toString(16).padStart(2, '0')).join('');
    return { keyHex };
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
      console.error('[FlakeSecure] Decryption failed:', e);
      return null;
    }
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return (rect.width > 0 && rect.height > 0) || el.offsetParent !== null || style.position === 'fixed';
  }

  function findPasswordFields() {
    const selectors = [
      'input[type="password"]',
      'input[name*="password" i]',
      'input[name*="passwort" i]',
      'input[name*="passwd" i]',
      'input[id*="password" i]',
      'input[id*="passwort" i]',
      'input[id*="passwd" i]',
      'input[autocomplete="current-password"]',
      'input[autocomplete="new-password"]'
    ];
    const elements = Array.from(document.querySelectorAll(selectors.join(',')));
    return elements.filter(isVisible);
  }

  function findUsernameFields() {
    const selectors = [
      'input[type="email"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]',
      'input[name*="user" i]',
      'input[name*="email" i]',
      'input[name*="login" i]',
      'input[name*="userid" i]',
      'input[name*="identifier" i]',
      'input[name*="account" i]',
      'input[id*="user" i]',
      'input[id*="email" i]',
      'input[id*="login" i]',
      'input[id*="identifier" i]',
      'input[id*="account" i]',
      'input[type="text"]'
    ];
    const elements = Array.from(document.querySelectorAll(selectors.join(',')));
    return elements.filter(el => {
      if (!isVisible(el)) return false;
      const type = (el.type || '').toLowerCase();
      if (type === 'password' || type === 'hidden' || type === 'submit' || type === 'button' || type === 'checkbox' || type === 'radio') return false;
      return true;
    });
  }

  function findPrecedingTextInput(passwordField) {
    const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'));
    const idx = allInputs.indexOf(passwordField);
    if (idx > 0) {
      for (let i = idx - 1; i >= 0; i--) {
        if (allInputs[i].type !== 'password' && isVisible(allInputs[i])) return allInputs[i];
      }
    }
    return null;
  }

  function simulateInput(element, value) {
    if (!element || value === undefined || value === null) return;
    try {
      element.focus();
      const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
    } catch (e) {
      try {
        element.value = value;
      } catch (err) {}
    }
  }

  function analyzeForm(targetField) {
    const pwFields = findPasswordFields();
    const userFields = findUsernameFields();
    const form = targetField?.closest('form') || document;

    const pageUrl = window.location.href.toLowerCase();
    const pageTitle = (document.title || '').toLowerCase();
    const formText = (form.innerText || form.textContent || '').toLowerCase();
    const hasNewPassword = !!document.querySelector('input[autocomplete="new-password"]');
    const hasMultiplePasswords = pwFields.length >= 2;

    const registerKeywords = [
      'register', 'sign up', 'signup', 'sign-up', 'registrieren',
      'registrierung', 'konto erstellen', 'create account', 'join',
      'crear cuenta', 'créer un compte', 'inscription', 'neuer benutzer'
    ];

    const hasRegisterKeyword = registerKeywords.some(kw => 
      pageUrl.includes(kw) || pageTitle.includes(kw) || formText.includes(kw)
    );

    const isRegistration = hasMultiplePasswords || hasNewPassword || (hasRegisterKeyword && !formText.includes('password vergessen'));

    if (isRegistration) {
      const fields = [];
      const formScope = targetField?.closest('form') || targetField?.closest('.login-container, .auth-container, [role="main"], main') || document;

      const emailField = formScope.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i], input[autocomplete="email"]');
      if (emailField && isVisible(emailField)) {
        fields.push({ key: 'email', label: 'E-Mail', type: 'email', required: true });
      }

      const usernameField = formScope.querySelector('input[autocomplete="username"], input[name*="username" i], input[name*="user" i], input[name*="benutzer" i], input[id*="username" i], input[id*="user" i]');
      if (usernameField && isVisible(usernameField) && usernameField !== emailField) {
        fields.push({ key: 'username', label: 'Benutzername', type: 'text', required: true });
      } else if (!emailField && userFields.length > 0) {
        fields.push({ key: 'username', label: 'Benutzername / E-Mail', type: 'text', required: true });
      }

      fields.push({ key: 'password', label: 'Passwort', type: 'password', required: true });
      if (pwFields.length >= 2 || formScope.querySelector('input[name*="confirm" i], input[name*="repeat" i], input[name*="wiederhol" i]')) {
        fields.push({ key: 'confirmPassword', label: 'Passwort wiederholen', type: 'password', required: true });
      }

      const firstNameField = formScope.querySelector('input[name*="first" i], input[name*="vorname" i], input[id*="first" i], input[id*="vorname" i], input[autocomplete="given-name"]');
      if (firstNameField && isVisible(firstNameField)) {
        fields.push({ key: 'firstName', label: 'Vorname', type: 'text', required: false });
      }

      const lastNameField = formScope.querySelector('input[name*="last" i], input[name*="nachname" i], input[id*="last" i], input[id*="nachname" i], input[autocomplete="family-name"]');
      if (lastNameField && isVisible(lastNameField)) {
        fields.push({ key: 'lastName', label: 'Nachname', type: 'text', required: false });
      }

      const fullNameField = formScope.querySelector('input[name*="fullname" i], input[name="name" i], input[id*="fullname" i], input[autocomplete="name"]');
      if (fullNameField && isVisible(fullNameField) && !firstNameField && !lastNameField) {
        fields.push({ key: 'fullName', label: 'Vollständiger Name', type: 'text', required: false });
      }

      const phoneField = formScope.querySelector('input[type="tel"], input[name*="phone" i], input[name*="telefon" i], input[name*="mobil" i], input[autocomplete="tel"]');
      if (phoneField && isVisible(phoneField)) {
        fields.push({ key: 'phone', label: 'Telefonnummer', type: 'tel', required: false });
      }

      return {
        action: 'register',
        fields: fields.length > 0 ? fields : [
          { key: 'email', label: 'E-Mail', type: 'email', required: true },
          { key: 'username', label: 'Benutzername', type: 'text', required: true },
          { key: 'password', label: 'Passwort', type: 'password', required: true },
          { key: 'confirmPassword', label: 'Passwort wiederholen', type: 'password', required: true }
        ]
      };
    }

    return { action: 'login', fields: [] };
  }

  function isSocialOrNegativeButton(btn) {
    if (!btn) return true;
    const text = (btn.innerText || btn.textContent || '').toLowerCase().trim();
    const aria = (btn.getAttribute('aria-label') || '').toLowerCase().trim();
    const title = (btn.getAttribute('title') || '').toLowerCase().trim();
    const name = (btn.getAttribute('name') || '').toLowerCase().trim();
    const id = (btn.getAttribute('id') || '').toLowerCase().trim();
    const className = (typeof btn.className === 'string' ? btn.className : '').toLowerCase();
    const dataTestId = (btn.getAttribute('data-testid') || '').toLowerCase();
    const dataProvider = (btn.getAttribute('data-provider') || '').toLowerCase();

    const combined = `${text} ${aria} ${title} ${name} ${id} ${className} ${dataTestId} ${dataProvider}`;
    return SOCIAL_OR_NEGATIVE_KEYWORDS.some(kw => combined.includes(kw));
  }

  function findSubmitButton(form, targetField) {
    const container = form || targetField?.closest('form') || targetField?.closest('.login-container, .auth-container, [role="main"], body') || document;

    const inputSubmits = Array.from(container.querySelectorAll('input[type="submit"]')).filter(isVisible);
    for (const btn of inputSubmits) {
      if (!isSocialOrNegativeButton(btn)) return btn;
    }

    const typeSubmitButtons = Array.from(container.querySelectorAll('button[type="submit"]')).filter(isVisible);
    for (const btn of typeSubmitButtons) {
      if (!isSocialOrNegativeButton(btn)) return btn;
    }

    const allButtons = Array.from(container.querySelectorAll('button, input[type="button"], [role="button"]')).filter(isVisible);
    for (const btn of allButtons) {
      if (isSocialOrNegativeButton(btn)) continue;
      const text = (btn.innerText || btn.textContent || '').toLowerCase().trim();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase().trim();
      const className = (typeof btn.className === 'string' ? btn.className : '').toLowerCase();
      const id = (btn.getAttribute('id') || '').toLowerCase();
      const combined = `${text} ${aria} ${className} ${id}`;
      if (POSITIVE_SUBMIT_KEYWORDS.some(kw => combined.includes(kw))) {
        return btn;
      }
    }

    if (targetField) {
      const followingButtons = allButtons.filter(btn => {
        if (isSocialOrNegativeButton(btn)) return false;
        return targetField.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING;
      });
      if (followingButtons.length > 0) {
        return followingButtons[0];
      }
    }

    for (const btn of allButtons) {
      if (!isSocialOrNegativeButton(btn)) return btn;
    }

    return null;
  }

  function submitForm(form, targetField) {
    const submitBtn = findSubmitButton(form, targetField);
    if (submitBtn) {
      console.log('[FlakeSecure] Triggering submit button:', submitBtn);
      submitBtn.click();
      return;
    }

    if (form && typeof form.requestSubmit === 'function') {
      try {
        form.requestSubmit();
        return;
      } catch (e) {}
    }

    if (form && typeof form.submit === 'function') {
      try {
        form.submit();
        return;
      } catch (e) {}
    }

    if (targetField) {
      targetField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      targetField.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      targetField.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    }
  }

  function fillRegistrationFields(fieldsData) {
    console.log('[FlakeSecure] Filling registration fields:', fieldsData);

    const pwFields = findPasswordFields();
    const password = fieldsData.password;
    const confirmPassword = fieldsData.confirmPassword || fieldsData.password;

    if (pwFields.length >= 2) {
      if (password) simulateInput(pwFields[0], password);
      if (confirmPassword) simulateInput(pwFields[1], confirmPassword);
    } else if (pwFields.length === 1) {
      if (password) simulateInput(pwFields[0], password);
      const confirmInput = document.querySelector('input[name*="confirm" i], input[name*="repeat" i], input[name*="wiederhol" i], input[id*="confirm" i]');
      if (confirmInput && isVisible(confirmInput)) {
        simulateInput(confirmInput, confirmPassword);
      }
    }

    if (fieldsData.email) {
      const emailInput = document.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i], input[autocomplete="email"]');
      if (emailInput && isVisible(emailInput)) {
        simulateInput(emailInput, fieldsData.email);
      }
    }

    if (fieldsData.username) {
      const usernameInput = document.querySelector('input[autocomplete="username"], input[name*="username" i], input[name*="user" i], input[name*="benutzer" i], input[id*="username" i], input[id*="user" i]');
      if (usernameInput && isVisible(usernameInput)) {
        simulateInput(usernameInput, fieldsData.username);
      }
    }

    if (fieldsData.firstName) {
      const fnInput = document.querySelector('input[name*="first" i], input[name*="vorname" i], input[id*="first" i], input[id*="vorname" i], input[autocomplete="given-name"]');
      if (fnInput && isVisible(fnInput)) {
        simulateInput(fnInput, fieldsData.firstName);
      }
    }
    if (fieldsData.lastName) {
      const lnInput = document.querySelector('input[name*="last" i], input[name*="nachname" i], input[id*="last" i], input[id*="nachname" i], input[autocomplete="family-name"]');
      if (lnInput && isVisible(lnInput)) {
        simulateInput(lnInput, fieldsData.lastName);
      }
    }
    if (fieldsData.fullName) {
      const fnInput = document.querySelector('input[name*="fullname" i], input[name="name" i], input[id*="fullname" i], input[autocomplete="name"]');
      if (fnInput && isVisible(fnInput)) {
        simulateInput(fnInput, fieldsData.fullName);
      }
    }

    if (fieldsData.phone) {
      const phoneInput = document.querySelector('input[type="tel"], input[name*="phone" i], input[name*="telefon" i], input[name*="mobil" i], input[autocomplete="tel"]');
      if (phoneInput && isVisible(phoneInput)) {
        simulateInput(phoneInput, fieldsData.phone);
      }
    }
  }

  function fillLoginFields(username, password) {
    const pwFields = findPasswordFields();
    const userFields = findUsernameFields();
    const usernameField = userFields[0] || (pwFields[0] ? findPrecedingTextInput(pwFields[0]) : null);

    let filledUsername = false;
    let filledPassword = false;

    if (usernameField && username) {
      simulateInput(usernameField, username);
      filledUsername = true;
    }

    if (pwFields[0] && password) {
      simulateInput(pwFields[0], password);
      filledPassword = true;
    }

    return { filledUsername, filledPassword };
  }

  function startDynamicPasswordWatcher() {
    if (activeWatcherTimer) clearInterval(activeWatcherTimer);
    activeWatcherEnd = Date.now() + 15000;

    activeWatcherTimer = setInterval(() => {
      if (Date.now() > activeWatcherEnd) {
        clearInterval(activeWatcherTimer);
        activeWatcherTimer = null;
        return;
      }
      checkAndFillPendingPassword();
    }, 150);
  }

  function checkAndFillPendingPassword() {
    const cached = sessionStorage.getItem('fs_temp_cred');
    if (!cached) return;

    try {
      const creds = JSON.parse(cached);
      if (Date.now() - creds.timestamp > 5 * 60 * 1000) {
        sessionStorage.removeItem('fs_temp_cred');
        return;
      }

      const pwFields = findPasswordFields();
      if (pwFields.length > 0) {
        const pwField = pwFields[0];
        if (pwField.value !== creds.password) {
          console.log('[FlakeSecure] Dynamic password field detected, auto-filling...');
          simulateInput(pwField, creds.password);
          sessionStorage.removeItem('fs_temp_cred');
          if (activeWatcherTimer) {
            clearInterval(activeWatcherTimer);
            activeWatcherTimer = null;
          }
          setTimeout(() => {
            submitForm(pwField.closest('form'), pwField);
          }, 350);
        }
      }
    } catch (e) {}
  }

  function fillTotpCode(code) {
    const totpSelectors = [
      'input[autocomplete="one-time-code"]',
      'input[name*="totp" i]',
      'input[name*="otp" i]',
      'input[name*="2fa" i]',
      'input[name*="code" i]',
      'input[id*="totp" i]',
      'input[id*="otp" i]',
      'input[id*="2fa" i]',
      'input[id*="code" i]',
      'input[placeholder*="code" i]',
      'input[placeholder*="token" i]',
      'input[placeholder*="2fa" i]',
      'input[placeholder*="otp" i]',
      'input[type="tel"]',
      'input[type="number"]'
    ];

    for (const selector of totpSelectors) {
      const fields = Array.from(document.querySelectorAll(selector)).filter(isVisible);
      if (fields.length > 0) {
        simulateInput(fields[0], code);
        updateOverlayStatus('success', '2FA-Code automatisch eingefügt ✓');
        setTimeout(() => {
          submitForm(fields[0].closest('form'), fields[0]);
        }, 300);
        return true;
      }
    }
    return false;
  }

  function connectSocket(sessionId, keyHex, onData) {
    const currentDomain = window.location.hostname;
    try {
      if (typeof browser !== 'undefined' && browser.runtime) {
        browser.storage.local.get(['authToken']).then(res => {
          browser.runtime.sendMessage({
            type: 'CONNECT',
            sessionId: sessionId,
            token: res.authToken,
            domain: currentDomain
          }).catch(err => console.error('[FlakeSecure] CONNECT error:', err));
        });
      } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.storage.local.get(['authToken'], (res) => {
          chrome.runtime.sendMessage({
            type: 'CONNECT',
            sessionId: sessionId,
            token: res.authToken,
            domain: currentDomain
          });
        });
      }
    } catch (e) {
      console.error('[FlakeSecure] Failed to send CONNECT message', e);
    }

    if (!window.fsMessageListenerAdded) {
      const listener = async (message) => {
        if (message.type === 'SOCKET_CONNECTED') {
          console.log('[FlakeSecure] Connected to relay server (via background)');
        } else if (message.type === 'LOGIN_DATA') {
          console.log('[FlakeSecure] Received payload (via background)');
          const decrypted = await decryptData(message.payload, keyHex);
          if (decrypted) {
            onData(decrypted);
          }
        } else if (message.type === 'TOTP_DATA') {
          console.log('[FlakeSecure] Received TOTP data (via background)');
          const decrypted = await decryptData(message.payload, keyHex);
          if (decrypted && decrypted.code) {
            fillTotpCode(decrypted.code);
          }
        } else if (message.type === 'SESSION_EXPIRED') {
          console.log('[FlakeSecure] Session expired (via background)');
          removeOverlay();
        } else if (message.type === 'SOCKET_DISCONNECTED') {
          console.log('[FlakeSecure] Disconnected from relay server (via background)');
        } else if (message.type === 'SOCKET_ERROR') {
          console.error('[FlakeSecure] Connection error (via background):', message.message);
          updateOverlayStatus('error', 'Server nicht erreichbar');
        }
      };

      if (typeof browser !== 'undefined' && browser.runtime) {
        browser.runtime.onMessage.addListener(listener);
      } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener(listener);
      }
      
      window.fsMessageListenerAdded = true;
    }
  }

  function updateOverlayStatus(type, message) {
    const statusEl = document.getElementById('flakesecure-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `fs-status fs-status--${type}`;
    }
  }

  function removeOverlay(cancelled = false) {
    if (cancelled) userCancelled = true;
    const overlay = document.getElementById('flakesecure-overlay');
    if (overlay) {
      const card = overlay.querySelector('.fs-card');
      if (card) {
        card.style.animation = 'fsCardOut 0.25s cubic-bezier(0.4, 0, 1, 1) forwards';
      }
      overlay.style.animation = 'fsOverlayOut 0.3s ease-in forwards';
      observer.disconnect();
      setTimeout(() => {
        overlay.remove();
        if (!cancelled) {
          observer.observe(document.documentElement || document.body, { 
            childList: true, 
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'type', 'hidden']
          });
        }
      }, 300);
    }
    try {
      if (typeof browser !== 'undefined' && browser.runtime) {
        browser.runtime.sendMessage({ type: 'DISCONNECT' }).catch(() => {});
      } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'DISCONNECT' });
      }
    } catch (e) {}

    uiInjected = false;
    currentSessionId = null;
  }

  const OVERLAY_I18N = {
    en: {
      regSubtitle: 'Secure Account Creation',
      loginSubtitle: 'Secure Biometric Login',
      regInstructions: 'Scan the QR code with the <strong>FlakeSecure App</strong> to automatically fill and securely save your account details.',
      loginInstructions: 'Scan the QR code with the <strong>FlakeSecure App</strong> and confirm with Face ID / Fingerprint.',
      step1: 'Scan',
      step2Reg: 'Customize',
      step2Login: 'Confirm',
      step3Reg: 'Filled',
      step3Login: 'Logged in',
      waiting: 'Waiting for scan…',
      fallback: 'App installed?',
      openDirectly: 'Open directly'
    },
    de: {
      regSubtitle: 'Account sicher erstellen',
      loginSubtitle: 'Sichere biometrische Anmeldung',
      regInstructions: 'Scanne den QR-Code mit der <strong>FlakeSecure App</strong>, um deine Account-Daten automatisch auszufüllen und sicher zu speichern.',
      loginInstructions: 'Scanne den QR-Code mit der <strong>FlakeSecure App</strong> und bestätige mit Face ID / Fingerabdruck.',
      step1: 'Scannen',
      step2Reg: 'Anpassen',
      step2Login: 'Bestätigen',
      step3Reg: 'Ausgefüllt',
      step3Login: 'Eingeloggt',
      waiting: 'Warte auf Scan…',
      fallback: 'App installiert?',
      openDirectly: 'Direkt öffnen'
    },
    fr: {
      regSubtitle: 'Création sécurisée de compte',
      loginSubtitle: 'Connexion biométrique sécurisée',
      regInstructions: 'Scannez le code QR avec l\'<strong>Application FlakeSecure</strong> pour remplir et sauvegarder vos accès en toute sécurité.',
      loginInstructions: 'Scannez le code QR avec l\'<strong>Application FlakeSecure</strong> et confirmez avec Face ID / Empreinte.',
      step1: 'Scanner',
      step2Reg: 'Personnaliser',
      step2Login: 'Confirmer',
      step3Reg: 'Rempli',
      step3Login: 'Connecté',
      waiting: 'En attente du scan…',
      fallback: 'App installée ?',
      openDirectly: 'Ouvrir directement'
    },
    es: {
      regSubtitle: 'Creación segura de cuenta',
      loginSubtitle: 'Inicio de sesión biométrico seguro',
      regInstructions: 'Escanea el código QR con la <strong>App FlakeSecure</strong> para rellenar y guardar tus datos de forma segura.',
      loginInstructions: 'Escanea el código QR con la <strong>App FlakeSecure</strong> y confirma con Face ID / Huella dactilar.',
      step1: 'Escanear',
      step2Reg: 'Personalizar',
      step2Login: 'Confirmar',
      step3Reg: 'Completado',
      step3Login: 'Conectado',
      waiting: 'Esperando escaneo…',
      fallback: '¿App instalada?',
      openDirectly: 'Abrir directamente'
    }
  };

  function createOverlay(sessionId, deepLink, domain, isRegister = false, lang = 'en') {
    if (document.getElementById('flakesecure-overlay')) return;

    const t = OVERLAY_I18N[lang] || OVERLAY_I18N.en;
    const overlay = document.createElement('div');
    overlay.id = 'flakesecure-overlay';

    const cssUrl = (typeof browser !== 'undefined' && browser.runtime ? browser.runtime : chrome.runtime).getURL('styles/content.css');

    overlay.innerHTML = `
      <link rel="stylesheet" href="${cssUrl}">
      <div class="fs-card">
        <button class="fs-close-btn" id="fs-close" title="Close">✕</button>

        <div class="fs-logo">
          <div class="fs-logo-icon">❄️</div>
          <div class="fs-logo-text">Flake<span>Secure</span></div>
        </div>
        <div class="fs-subtitle">${isRegister ? t.regSubtitle : t.loginSubtitle}</div>

        <div class="fs-qr-container">
          <div class="fs-qr-corner fs-qr-corner--tl"></div>
          <div class="fs-qr-corner fs-qr-corner--tr"></div>
          <div class="fs-qr-corner fs-qr-corner--bl"></div>
          <div class="fs-qr-corner fs-qr-corner--br"></div>
          <div id="flakesecure-qrcode"></div>
        </div>

        <div class="fs-domain-badge">
          <div class="fs-domain-dot"></div>
          ${domain}
        </div>

        <div class="fs-instructions">
          ${isRegister ? t.regInstructions : t.loginInstructions}
        </div>

        <div class="fs-steps">
          <div class="fs-step active" id="fs-step-1">
            <div class="fs-step-num">1</div>
            ${t.step1}
          </div>
          <div class="fs-step" id="fs-step-2">
            <div class="fs-step-num">2</div>
            ${isRegister ? t.step2Reg : t.step2Login}
          </div>
          <div class="fs-step" id="fs-step-3">
            <div class="fs-step-num">3</div>
            ${isRegister ? t.step3Reg : t.step3Login}
          </div>
        </div>

        <div>
          <span class="fs-status fs-status--waiting" id="flakesecure-status">
            ${t.waiting}
          </span>
        </div>

        <div class="fs-fallback-link">
          ${t.fallback} <a href="${deepLink}" target="_blank">${t.openDirectly}</a>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const qrContainer = document.getElementById('flakesecure-qrcode');
    if (qrContainer && typeof QRCode !== 'undefined') {
      new QRCode(qrContainer, {
        text: deepLink,
        width: 220,
        height: 220,
        colorDark: '#080a12',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.L
      });
    }

    document.getElementById('fs-close')?.addEventListener('click', () => {
      removeOverlay(true);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        removeOverlay(true);
      }
    });

    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        removeOverlay(true);
        document.removeEventListener('keydown', onKeydown);
      }
    };
    document.addEventListener('keydown', onKeydown);
  }

  function injectLoginButton(targetField) {
    if (document.getElementById('fs-login-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'fs-login-btn';
    btn.type = 'button';
    btn.innerHTML = '❄️ FlakeSecure';
    btn.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #6391ff, #7c6aff);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
      box-shadow: 0 4px 12px rgba(99, 145, 255, 0.3);
      font-family: -apple-system, 'SF Pro Display', 'Segoe UI', sans-serif;
      z-index: 9999;
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      btn.remove();
      showOverlay(targetField);
    });

    targetField.parentNode.insertBefore(btn, targetField.nextSibling);
  }

  const FIELD_TO_COMPACT = {
    email: 'e',
    username: 'u',
    password: 'p',
    confirmPassword: 'cp',
    firstName: 'fn',
    lastName: 'ln',
    fullName: 'name',
    phone: 'ph'
  };

  function encodeFieldsCompact(fields) {
    if (!fields || !Array.isArray(fields)) return '';
    return fields.map(f => FIELD_TO_COMPACT[f.key] || f.key).join(',');
  }

  async function handlePasswordField(field) {
    if (uiInjected) return;
    uiInjected = true;

    const mode = await new Promise(resolve => {
      if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.sync.get(['displayMode']).then(res => resolve(res.displayMode || 'popup'));
      } else if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['displayMode'], res => resolve(res.displayMode || 'popup'));
      } else {
        resolve('popup');
      }
    });

    if (mode === 'button') {
      injectLoginButton(field);
    } else {
      showOverlay(field);
    }
  }

  async function showOverlay(field) {
    const domain = window.location.hostname;
    const sessionId = generateSessionId();
    const { keyHex } = await generateAESKey();
    currentSessionId = sessionId;

    const formInfo = analyzeForm(field);
    const isRegister = formInfo.action === 'register';

    let deepLink = '';
    if (isRegister) {
      const compactFields = encodeFieldsCompact(formInfo.fields);
      deepLink = `flakesecure://register?s=${sessionId}&k=${keyHex}&d=${encodeURIComponent(domain)}&f=${compactFields}`;
    } else {
      deepLink = `flakesecure://auth?s=${sessionId}&k=${keyHex}&d=${encodeURIComponent(domain)}`;
    }

    const lang = await new Promise(resolve => {
      if (typeof browser !== 'undefined' && browser.storage) {
        browser.storage.sync.get(['app_language']).then(res => resolve(res.app_language || (navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en')));
      } else if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['app_language'], res => resolve(res.app_language || (navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en')));
      } else {
        resolve('en');
      }
    });

    createOverlay(sessionId, deepLink, domain, isRegister, lang);

    connectSocket(sessionId, keyHex, (data) => {
      const step2 = document.getElementById('fs-step-2');
      const step3 = document.getElementById('fs-step-3');
      if (step2) step2.classList.add('active');
      if (step3) step3.classList.add('active');

      if (data.action === 'register' || data.type === 'register' || data.fields) {
        const fieldsData = data.fields || data;
        fillRegistrationFields(fieldsData);
        updateOverlayStatus('success', '✅ Account-Daten erfolgreich eingetragen!');
        setTimeout(() => {
          removeOverlay();
        }, 1200);
      } else {
        updateOverlayStatus('success', '✅ Anmeldedaten empfangen – logge dich ein…');

        sessionStorage.setItem('fs_temp_cred', JSON.stringify({
          username: data.username,
          password: data.password,
          timestamp: Date.now()
        }));

        setTimeout(() => {
          const { filledUsername, filledPassword } = fillLoginFields(data.username, data.password);
          
          setTimeout(() => {
            removeOverlay();

            const pwFields = findPasswordFields();
            const target = pwFields[0] || field;
            const form = target ? target.closest('form') : null;

            if (filledPassword || pwFields.length > 0) {
              sessionStorage.removeItem('fs_temp_cred');
              submitForm(form, target);
            } else {
              console.log('[FlakeSecure] Step 1 filled (username only). Submitting step 1 and starting dynamic password watcher...');
              submitForm(form, target);
              startDynamicPasswordWatcher();
            }
          }, 500);
        }, 500);
      }
    });
  }

  function checkForPasswordField() {
    if (userCancelled) return;
    
    checkAndFillPendingPassword();

    if (uiInjected) return;
    
    const pwFields = findPasswordFields();
    const userFields = findUsernameFields();

    let targetField = null;
    if (pwFields.length > 0) {
      targetField = pwFields[0];
    } else if (userFields.length > 0) {
      for (const uf of userFields) {
        const form = uf.closest('form');
        const isUsername = uf.getAttribute('autocomplete') === 'username' || uf.getAttribute('type') === 'email';
        if (form) {
          const text = form.textContent.toLowerCase();
          if (text.includes('login') || text.includes('sign in') || text.includes('anmelden') || text.includes('einloggen') || text.includes('weiter') || text.includes('next') || text.includes('register') || text.includes('registrieren') || text.includes('konto erstellen') || isUsername) {
            targetField = uf;
            break;
          }
        } else if (isUsername) {
          targetField = uf;
          break;
        }
      }
    }

    if (targetField) {
      handlePasswordField(targetField);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkForPasswordField);
  } else {
    setTimeout(checkForPasswordField, 400);
  }

  document.addEventListener('focusin', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON')) {
      checkForPasswordField();
    }
  }, { passive: true });

  document.addEventListener('click', () => {
    setTimeout(checkForPasswordField, 300);
  }, { passive: true });

  var observer = new MutationObserver(() => {
    checkForPasswordField();
  });
  observer.observe(document.documentElement || document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'type', 'hidden']
  });

})();