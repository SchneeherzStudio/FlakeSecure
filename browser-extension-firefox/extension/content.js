/**
 * ============================================================================
 * FlakeSecure - Browser Extension Content Script (Firefox MV3) v2.0.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ARCHITECTURE:
 * 
 * 1. CRYPTOGRAPHY & SESSION GENERATION:
 *    - generateSessionId(): Generates a cryptographically secure 16-byte hex session ID.
 *    - generateAESKey(): Generates a random 32-byte (256-bit) AES key as hex string for the QR code.
 *    - hexToBytes(hex) / bytesToHex(bytes): Converts between hexadecimal strings and Uint8Array byte arrays.
 *    - decryptData(encryptedPayload, keyHex): Decrypts received data via AES-256-CTR and validates HMAC-SHA256.
 * 
 * 2. DOM ANALYSIS & AUTH DETECTION:
 *    - isVisible(el): Reliable visibility checker for animated or dynamically rendering form fields.
 *    - isNonAuthField(el): Filters out search boxes, chat/comment inputs, shipping/billing address inputs, quantity pickers.
 *    - findPasswordFields(): Comprehensive search for password inputs.
 *    - findUsernameFields(): Searches for authentic username/email fields.
 * 
 * 3. MULTI-STEP LOGIN & PERSISTENT DOMAIN CREDENTIAL CACHING:
 *    - setCachedCredentials(data): Stores credentials in isolated browser.storage.local with 10-minute TTL.
 *    - getCachedCredentials(): Retrieves cached credentials across page reloads and step transitions.
 *    - checkAndAutoFillCachedCredentials(): Automatically applies username, password, or TOTP as soon as fields appear.
 *    - startPersistentStepWatcher(): High-frequency polling window (15s) ensuring multi-step forms auto-fill immediately.
 * 
 * 4. OVERLAY & UI:
 *    - createOverlay(): Mounts pixel-perfect FlakeSecure QR modal with stylesheet and smooth CSS animations.
 *    - removeOverlay(): Dismisses overlay and signals background script to disconnect.
 * ============================================================================
 */

(function () {
  'use strict';

  const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes retention for multi-step flows

  let uiInjected = false;
  let userCancelled = false;
  let currentSessionId = null;
  let isAutoFilling = false;
  let watcherTimer = null;
  let watcherEndTime = 0;

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

  const NON_AUTH_NAME_REGEX = /search|suche|query|filter|find|comment|kommentar|message|nachricht|chat|address|adresse|street|strasse|city|stadt|zip|plz|country|land|phone|telefon|mobile|handy|qty|quantity|amount|menge|anzahl|coupon|gutschein|promo|discount|rabatt|tag|title|titel|subject|betreff|searchbox|searchinput/i;

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

  function getEffectiveDomain() {
    const hostname = (window.location.hostname || '').toLowerCase();
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    const secondLast = parts[parts.length - 2];
    if (['co', 'com', 'org', 'net', 'edu', 'gov'].includes(secondLast) && parts.length >= 3) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }

  async function setCachedCredentials(data) {
    const domain = getEffectiveDomain();
    const payload = {
      domain,
      hostname: window.location.hostname,
      username: data.username || '',
      password: data.password || '',
      totp: data.totp || data.code || null,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS
    };

    try {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        browser.storage.local.set({
          [`fs_cache_${domain}`]: payload,
          fs_active_creds: payload
        });
      }
    } catch (e) {}
  }

  function clearCachedCredentials() {
    const domain = getEffectiveDomain();
    try {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        browser.storage.local.remove([`fs_cache_${domain}`, 'fs_active_creds']);
      }
    } catch (e) {}
  }

  async function getCachedCredentials() {
    const domain = getEffectiveDomain();

    try {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        const domainKey = `fs_cache_${domain}`;
        const stored = await browser.storage.local.get([domainKey, 'fs_active_creds']);
        const entry = stored ? (stored[domainKey] || stored.fs_active_creds) : null;
        if (entry && entry.expiresAt && entry.expiresAt > Date.now()) {
          return entry;
        } else if (entry && entry.expiresAt && entry.expiresAt <= Date.now()) {
          browser.storage.local.remove([domainKey, 'fs_active_creds']);
        }
      }
    } catch (e) {}

    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0 && !el.matches(':focus')) return false;
    const rect = el.getBoundingClientRect();
    return (rect.width > 0 && rect.height > 0) || el.offsetParent !== null || style.position === 'fixed' || style.position === 'absolute';
  }

  function isNonAuthField(el) {
    if (!el) return true;
    const type = (el.type || '').toLowerCase();
    if (['search', 'number', 'tel', 'date', 'time', 'datetime-local', 'month', 'week', 'range', 'color', 'checkbox', 'radio', 'file', 'hidden', 'submit', 'button', 'reset', 'image'].includes(type)) {
      return true;
    }
    if (el.readOnly || el.disabled) return true;

    const role = (el.getAttribute('role') || '').toLowerCase();
    if (role === 'searchbox' || role === 'search' || role === 'combobox') return true;

    const name = el.getAttribute('name') || '';
    const id = el.getAttribute('id') || '';
    const placeholder = el.getAttribute('placeholder') || '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    const className = typeof el.className === 'string' ? el.className : '';

    const combined = `${name} ${id} ${placeholder} ${ariaLabel} ${className}`;
    if (NON_AUTH_NAME_REGEX.test(combined)) {
      return true;
    }

    const form = el.closest('form');
    if (form) {
      const formRole = (form.getAttribute('role') || '').toLowerCase();
      const formAction = (form.getAttribute('action') || '').toLowerCase();
      const formName = `${form.getAttribute('name') || ''} ${form.getAttribute('id') || ''} ${form.className || ''}`.toLowerCase();
      if (formRole === 'search' || formAction.includes('search') || formAction.includes('suche') || formName.includes('search') || formName.includes('suche')) {
        return true;
      }
    }

    return false;
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
    return elements.filter(el => isVisible(el) && !el.disabled && !el.readOnly && !isNonAuthField(el));
  }

  function findUsernameFields() {
    const selectors = [
      'input[type="email"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]',
      'input[name*="username" i]',
      'input[name*="user_name" i]',
      'input[name*="userid" i]',
      'input[name*="user_id" i]',
      'input[name*="login_id" i]',
      'input[name*="login_email" i]',
      'input[name*="identifier" i]',
      'input[id*="username" i]',
      'input[id*="user_name" i]',
      'input[id*="userid" i]',
      'input[id*="user_id" i]',
      'input[id*="login_id" i]',
      'input[id*="login_email" i]',
      'input[id*="identifier" i]'
    ];
    const elements = Array.from(document.querySelectorAll(selectors.join(',')));
    return elements.filter(el => {
      if (!isVisible(el) || el.disabled || el.readOnly) return false;
      if (isNonAuthField(el)) return false;
      return true;
    });
  }

  function findPrecedingTextInput(passwordField) {
    if (!passwordField) return null;
    const form = passwordField.closest('form') || passwordField.closest('.login-container, .auth-container, [role="main"]') || document;
    const allInputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="password"])'));
    for (const inp of allInputs) {
      if (isVisible(inp) && !isNonAuthField(inp)) {
        if (passwordField.compareDocumentPosition(inp) & Node.DOCUMENT_POSITION_PRECEDING) {
          return inp;
        }
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
      element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13 }));
      element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', keyCode: 13 }));
    } catch (e) {
      try {
        element.value = value;
      } catch (err) {}
    }
  }

  function analyzeForm(targetField) {
    const pwFields = findPasswordFields();
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
      }

      fields.push({ key: 'password', label: 'Passwort', type: 'password', required: true });
      if (pwFields.length >= 2 || formScope.querySelector('input[name*="confirm" i], input[name*="repeat" i], input[name*="wiederhol" i]')) {
        fields.push({ key: 'confirmPassword', label: 'Passwort wiederholen', type: 'password', required: true });
      }

      return {
        action: 'register',
        fields: fields.length > 0 ? fields : [
          { key: 'email', label: 'E-Mail', type: 'email', required: true },
          { key: 'username', label: 'Benutzername', type: 'text', required: true },
          { key: 'password', label: 'Passwort', type: 'password', required: true }
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

    const combined = `${text} ${aria} ${title} ${name} ${id} ${className}`;
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
      const combined = `${text} ${aria}`;
      if (POSITIVE_SUBMIT_KEYWORDS.some(kw => combined.includes(kw))) {
        return btn;
      }
    }

    return null;
  }

  function submitForm(form, targetField) {
    const submitBtn = findSubmitButton(form, targetField);
    if (submitBtn) {
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

  function fillTotpCode(code) {
    if (!code) return false;
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
      'input[placeholder*="otp" i]'
    ];

    for (const selector of totpSelectors) {
      const fields = Array.from(document.querySelectorAll(selector)).filter(el => isVisible(el) && !isNonAuthField(el));
      if (fields.length > 0) {
        simulateInput(fields[0], code);
        setTimeout(() => {
          submitForm(fields[0].closest('form'), fields[0]);
        }, 300);
        return true;
      }
    }
    return false;
  }

  async function checkAndAutoFillCachedCredentials() {
    if (isAutoFilling) return;
    const cached = await getCachedCredentials();
    if (!cached || !cached.password) return;

    const pwFields = findPasswordFields();
    const userFields = findUsernameFields();
    let filledPassword = false;
    let filledSomething = false;

    // 1. Fill password if visible and not matching cached password
    if (pwFields.length > 0) {
      const pwField = pwFields[0];
      if (pwField.value !== cached.password) {
        console.log('[FlakeSecure Firefox] Cached password auto-filled for domain:', cached.domain);
        simulateInput(pwField, cached.password);
        filledPassword = true;
        filledSomething = true;
      }
    }

    // 2. Fill username if visible and empty
    if (cached.username) {
      const uField = userFields[0] || (pwFields[0] ? findPrecedingTextInput(pwFields[0]) : null);
      if (uField && !uField.value) {
        console.log('[FlakeSecure Firefox] Cached username auto-filled for domain:', cached.domain);
        simulateInput(uField, cached.username);
        filledSomething = true;
      }
    }

    // 3. Fill TOTP if present
    if (cached.totp) {
      const totpFilled = fillTotpCode(cached.totp);
      if (totpFilled) filledSomething = true;
    }

    if (filledSomething) {
      isAutoFilling = true;
      setTimeout(() => { isAutoFilling = false; }, 1000);

      // 4. Auto-submit after filling password (multi-step login, e.g. ionos.de)
      if (filledPassword) {
        const settings = await getSettings();
        if (settings.autoLogin) {
          setTimeout(() => {
            const target = pwFields[0];
            const form = target ? target.closest('form') : null;
            console.log('[FlakeSecure Firefox] Auto-submitting after cached password fill');
            submitForm(form, target);
            clearCachedCredentials();
          }, 500);
        } else {
          clearCachedCredentials();
        }
      }
    }
  }

  function startPersistentStepWatcher() {
    if (watcherTimer) clearInterval(watcherTimer);
    watcherEndTime = Date.now() + 20000; // Watch for 20 seconds during multi-step navigation

    watcherTimer = setInterval(() => {
      if (Date.now() > watcherEndTime) {
        clearInterval(watcherTimer);
        watcherTimer = null;
        return;
      }
      checkAndAutoFillCachedCredentials();
    }, 250);
  }

  function connectSocket(sessionId, keyHex, onData) {
    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.storage.local.get(['authToken']).then((res) => {
        browser.runtime.sendMessage({
          type: 'CONNECT',
          sessionId,
          token: res ? res.authToken : null,
          domain: window.location.hostname
        }).catch(() => {});
      });

      const messageListener = async (msg) => {
        if (msg.type === 'LOGIN_DATA') {
          const decrypted = await decryptData(msg.payload, keyHex);
          if (decrypted) onData(decrypted);
        } else if (msg.type === 'TOTP_DATA') {
          const decrypted = await decryptData(msg.payload, keyHex);
          if (decrypted && decrypted.code) fillTotpCode(decrypted.code);
        } else if (msg.type === 'SESSION_EXPIRED') {
          removeOverlay();
        } else if (msg.type === 'SOCKET_ERROR') {
          updateOverlayStatus('error', 'Server nicht erreichbar');
        }
      };

      browser.runtime.onMessage.addListener(messageListener);
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
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }

    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.sendMessage({ type: 'DISCONNECT' }).catch(() => {});
    }

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
      regInstructions: 'Scannez le code QR avec l\'<strong>Application FlakeSecure</strong> pour remplir vos accès.',
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
      regInstructions: 'Escanea el código QR con la <strong>App FlakeSecure</strong> para rellenar tus credenciales.',
      loginInstructions: 'Escanea el código QR mit der <strong>App FlakeSecure</strong> y confirma con Face ID / Huella.',
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
      <div class="fs-card" role="dialog" aria-modal="true">
        <button id="fs-close" class="fs-close-btn" aria-label="Schließen">&times;</button>
        <div class="fs-logo">
          <div class="fs-logo-icon">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;">
              <path d="M35 46 V34 A15 15 0 0 1 65 34 V46" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round"/>
              <rect x="22" y="44" width="56" height="44" rx="8" fill="#ffffff"/>
            </svg>
          </div>
          <h2 class="fs-logo-text">Flake<span>Secure</span></h2>
        </div>
        <p class="fs-subtitle">${isRegister ? t.regSubtitle : t.loginSubtitle}</p>
        <div class="fs-domain-badge">
          <span class="fs-domain-dot"></span>
          <span class="fs-domain-text">${domain}</span>
        </div>
        <div class="fs-qr-container">
          <div class="fs-qr-corner fs-qr-corner--tl"></div>
          <div class="fs-qr-corner fs-qr-corner--tr"></div>
          <div class="fs-qr-corner fs-qr-corner--bl"></div>
          <div class="fs-qr-corner fs-qr-corner--br"></div>
          <div id="flakesecure-qrcode"></div>
        </div>
        <p class="fs-instructions">
          ${isRegister ? t.regInstructions : t.loginInstructions}
        </p>
        <ul class="fs-steps">
          <li class="fs-step active" id="fs-step-1">
            <span class="fs-step-num">1</span>
            <span class="fs-step-label">${t.step1}</span>
          </li>
          <li class="fs-step" id="fs-step-2">
            <span class="fs-step-num">2</span>
            <span class="fs-step-label">${isRegister ? t.step2Reg : t.step2Login}</span>
          </li>
          <li class="fs-step" id="fs-step-3">
            <span class="fs-step-num">3</span>
            <span class="fs-step-label">${isRegister ? t.step3Reg : t.step3Login}</span>
          </li>
        </ul>
        <div class="fs-status-wrap">
          <div id="flakesecure-status" class="fs-status fs-status--waiting">${t.waiting}</div>
        </div>
        <p class="fs-fallback-link">
          ${t.fallback} <a href="${deepLink}" target="_blank">${t.openDirectly}</a>
        </p>
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
    if (document.getElementById('fs-login-btn') || !targetField || !targetField.parentNode) return;

    const btn = document.createElement('button');
    btn.id = 'fs-login-btn';
    btn.type = 'button';
    btn.innerHTML = '❄️ FlakeSecure';
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #6391ff, #7c6aff);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 6px;
      box-shadow: 0 4px 12px rgba(99, 145, 255, 0.3);
      font-family: -apple-system, sans-serif;
      z-index: 9999;
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      btn.remove();
      showOverlay(targetField);
    });

    targetField.parentNode.insertBefore(btn, targetField.nextSibling);
  }

  async function getSettings() {
    return new Promise(resolve => {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.sync) {
        browser.storage.sync.get(['displayMode', 'autoLogin', 'autoOverlay', 'app_language']).then(res => {
          resolve({
            displayMode: res?.displayMode || 'popup',
            autoLogin: res?.autoLogin !== false,
            autoOverlay: res?.autoOverlay !== false,
            app_language: res?.app_language || (navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en')
          });
        }).catch(() => {
          resolve({ displayMode: 'popup', autoLogin: true, autoOverlay: true, app_language: 'en' });
        });
      } else {
        resolve({
          displayMode: 'popup',
          autoLogin: true,
          autoOverlay: true,
          app_language: navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en'
        });
      }
    });
  }

  async function handlePasswordField(field, settings) {
    if (uiInjected || userCancelled) return;

    const s = settings || await getSettings();
    if (s.displayMode === 'button') {
      injectLoginButton(field);
    } else {
      showOverlay(field);
    }
  }

  async function showOverlay(field) {
    if (uiInjected) return;
    uiInjected = true;

    const domain = window.location.hostname;
    const sessionId = generateSessionId();
    const { keyHex } = await generateAESKey();
    currentSessionId = sessionId;

    const formInfo = analyzeForm(field);
    const isRegister = formInfo.action === 'register';

    let deepLink = '';
    if (isRegister) {
      deepLink = `flakesecure://register?s=${sessionId}&k=${keyHex}&d=${encodeURIComponent(domain)}`;
    } else {
      deepLink = `flakesecure://auth?s=${sessionId}&k=${keyHex}&d=${encodeURIComponent(domain)}`;
    }

    const settings = await getSettings();
    createOverlay(sessionId, deepLink, domain, isRegister, settings.app_language);

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

        // Persist in cache for multi-step reload (password step after page transition)
        setCachedCredentials(data);

        setTimeout(() => {
          const { filledUsername, filledPassword } = fillLoginFields(data.username, data.password);
          
          setTimeout(() => {
            removeOverlay();

            const pwFields = findPasswordFields();
            const target = pwFields[0] || field;
            const form = target ? target.closest('form') : null;

            if (filledPassword || pwFields.length > 0) {
              if (settings.autoLogin) {
                submitForm(form, target);
              }
              // Password was filled and submitted — cache no longer needed
              clearCachedCredentials();
            } else {
              console.log('[FlakeSecure Firefox] Step 1 filled (username only). Watching for Step 2 password field...');
              if (settings.autoLogin) {
                submitForm(form, target);
              }
              startPersistentStepWatcher();
            }
          }, 400);
        }, 400);
      }
    });
  }

  let scheduleCheckTimeout = null;

  function scheduleCheck(forceUserTrigger = false) {
    if (scheduleCheckTimeout) clearTimeout(scheduleCheckTimeout);
    scheduleCheckTimeout = setTimeout(() => {
      runSmartDetection(forceUserTrigger);
    }, 150);
  }

  async function runSmartDetection(forceUserTrigger = false) {
    // 1. Auto-fill from cache if credentials already exist
    await checkAndAutoFillCachedCredentials();

    if (userCancelled || uiInjected) return;

    const settings = await getSettings();

    // If autoOverlay is disabled and user didn't explicitly focus an auth field, do nothing
    if (!settings.autoOverlay && !forceUserTrigger && settings.displayMode !== 'button') {
      return;
    }

    const pwFields = findPasswordFields();
    const userFields = findUsernameFields();

    let targetField = null;

    if (pwFields.length > 0) {
      targetField = pwFields[0];
    } else if (userFields.length > 0) {
      for (const uf of userFields) {
        const isAuthType = uf.type === 'email' || uf.getAttribute('autocomplete') === 'username' || uf.getAttribute('autocomplete') === 'email';
        if (isAuthType || !isNonAuthField(uf)) {
          targetField = uf;
          break;
        }
      }
    }

    if (!targetField) return;

    if (!forceUserTrigger && settings.displayMode === 'popup' && (!settings.autoOverlay || pwFields.length === 0)) {
      return;
    }

    handlePasswordField(targetField, settings);
  }

  // --- EVENT LISTENERS ---

  // 1. Focused input listener: only trigger on genuine auth inputs
  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (!target || target.tagName !== 'INPUT') return;
    if (isNonAuthField(target)) return;

    const type = (target.type || '').toLowerCase();
    const isPw = type === 'password';
    const isAuthUser = type === 'email' || target.getAttribute('autocomplete') === 'username' || /username|user_name|userid|login/i.test(target.name || target.id || '');

    if (isPw || isAuthUser) {
      scheduleCheck(true);
    }
  }, { passive: true });

  // 2. Initial load & multi-step check
  checkAndAutoFillCachedCredentials();
  startPersistentStepWatcher();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scheduleCheck(false);
      startPersistentStepWatcher();
    });
  } else {
    scheduleCheck(false);
    startPersistentStepWatcher();
  }

  window.addEventListener('load', () => {
    checkAndAutoFillCachedCredentials();
  });

  // 3. Mutation Observer: monitors DOM for dynamic password fields
  const observer = new MutationObserver(() => {
    checkAndAutoFillCachedCredentials();
  });

  observer.observe(document.documentElement || document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'type', 'hidden']
  });

})();