/**
 * ============================================================================
 * FlakeSecure - Browser Extension Content Script (Chrome / Chromium MV3) v2.0.3
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
 *    - setCachedCredentials(data): Stores credentials in isolated chrome.storage.local with 2-minute TTL.
 *    - getCachedCredentials(): Retrieves cached credentials across page reloads and step transitions.
 *    - checkAndAutoFillCachedCredentials(): Automatically applies username, password, or TOTP as soon as fields appear.
 *    - startPersistentStepWatcher(): High-frequency polling window ensuring multi-step forms auto-fill immediately.
 * 
 * 4. OVERLAY & UI:
 *    - createOverlay(): Mounts FlakeSecure QR modal with stylesheet and smooth CSS animations (no innerHTML).
 *    - removeOverlay(): Dismisses overlay and disconnects background port / relay socket.
 * ============================================================================
 */

(function () {
  'use strict';

  const SERVER_URL = 'https://flakesecure.snowystudio.dev';
  const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes retention for multi-step flows
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ext =
    typeof browser !== 'undefined' && browser.runtime
      ? browser
      : typeof chrome !== 'undefined' && chrome.runtime
        ? chrome
        : null;

  let uiInjected = false;
  let userCancelled = false;
  let currentSessionId = null;
  let currentOverlayLang = 'de';
  let isAutoFilling = false;
  let watcherTimer = null;
  let watcherEndTime = 0;
  let activePort = null;
  let portHeartbeat = null;
  let socket = null;
  let embedDetected = false;
  let scheduleCheckTimeout = null;

  function storageCall(area, method, arg) {
    return new Promise((resolve) => {
      try {
        const store = ext && ext.storage && ext.storage[area];
        if (!store || typeof store[method] !== 'function') {
          resolve(method === 'get' ? {} : undefined);
          return;
        }
        if (typeof browser !== 'undefined' && ext === browser) {
          store[method](arg)
            .then((res) => resolve(res || (method === 'get' ? {} : undefined)))
            .catch(() => resolve(method === 'get' ? {} : undefined));
        } else {
          store[method](arg, (res) => {
            if (ext.runtime && ext.runtime.lastError) {
              resolve(method === 'get' ? {} : undefined);
            } else {
              resolve(res || (method === 'get' ? {} : undefined));
            }
          });
        }
      } catch (e) {
        resolve(method === 'get' ? {} : undefined);
      }
    });
  }

  const storageGet = (area, keys) => storageCall(area, 'get', keys);
  const storageSet = (area, items) => storageCall(area, 'set', items);
  const storageRemove = (area, keys) => storageCall(area, 'remove', keys);

  function createEl(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'textContent') node.textContent = v;
        else if (k === 'style') node.style.cssText = v;
        else if (v !== undefined && v !== null) node.setAttribute(k, String(v));
      }
    }
    if (Array.isArray(children)) {
      for (const ch of children) {
        if (ch == null) continue;
        node.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
      }
    }
    return node;
  }

  function createSvgEl(tag, attrs, children) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v !== undefined && v !== null) node.setAttribute(k, String(v));
      }
    }
    if (Array.isArray(children)) {
      for (const ch of children) {
        if (ch) node.appendChild(ch);
      }
    }
    return node;
  }

  const EMBED_SELECTOR = [
    'html[data-flakesecure-embed]',
    'meta[name="flakesecure-embed"]',
    'script[src*="/embed.js"]',
    'iframe[src*="/embed/widget.html"]',
    '.flakesecure-login-button',
    '#flakesecure-modal-backdrop',
    '.flakesecure-auto-container'
  ].join(',');

  function disconnectRelay(hadSession = false) {
    if (portHeartbeat) {
      clearInterval(portHeartbeat);
      portHeartbeat = null;
    }
    if (activePort) {
      try {
        activePort.postMessage({ type: 'DISCONNECT' });
        activePort.disconnect();
      } catch (e) {}
      activePort = null;
    }
    if (socket) {
      try {
        socket.disconnect();
      } catch (e) {}
      socket = null;
    }
    if (hadSession && ext && ext.runtime && ext.runtime.sendMessage) {
      try {
        const res = ext.runtime.sendMessage({ type: 'DISCONNECT' }, () => {
          void ext.runtime.lastError;
        });
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch (e) {}
    }
  }

  function silenceForEmbed() {
    if (scheduleCheckTimeout) {
      clearTimeout(scheduleCheckTimeout);
      scheduleCheckTimeout = null;
    }
    if (watcherTimer) {
      clearInterval(watcherTimer);
      watcherTimer = null;
    }
    const btn = document.getElementById('fs-login-btn');
    if (btn) btn.remove();

    const overlay = document.getElementById('flakesecure-overlay');
    const hadSession = !!(overlay || activePort || socket || currentSessionId);
    if (overlay) overlay.remove();

    disconnectRelay(hadSession);
    uiInjected = false;
    currentSessionId = null;
  }

  function isEmbedPresent() {
    if (embedDetected) return true;
    try {
      if ((window.location.pathname || '').includes('/embed/widget.html')) {
        embedDetected = true;
        silenceForEmbed();
        return true;
      }
      if (document.documentElement && document.documentElement.hasAttribute('data-flakesecure-embed')) {
        embedDetected = true;
        silenceForEmbed();
        return true;
      }
      if (document.querySelector(EMBED_SELECTOR)) {
        embedDetected = true;
        silenceForEmbed();
        return true;
      }
    } catch (e) {}
    return false;
  }

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

    await storageSet('local', {
      [`fs_cache_${domain}`]: payload,
      fs_active_creds: payload
    });
  }

  function clearCachedCredentials() {
    const domain = getEffectiveDomain();
    storageRemove('local', [`fs_cache_${domain}`, 'fs_active_creds']);
  }

  async function getCachedCredentials() {
    const domain = getEffectiveDomain();
    const domainKey = `fs_cache_${domain}`;
    const stored = await storageGet('local', [domainKey, 'fs_active_creds']);
    const entry = stored ? (stored[domainKey] || stored.fs_active_creds) : null;
    if (entry && entry.expiresAt && entry.expiresAt > Date.now()) {
      return entry;
    } else if (entry && entry.expiresAt && entry.expiresAt <= Date.now()) {
      storageRemove('local', [domainKey, 'fs_active_creds']);
    }

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
    if (isEmbedPresent()) return;
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
        console.log('[FlakeSecure] Cached password auto-filled for domain:', cached.domain);
        simulateInput(pwField, cached.password);
        filledPassword = true;
        filledSomething = true;
      }
    }

    // 2. Fill username if visible and empty
    if (cached.username) {
      const uField = userFields[0] || (pwFields[0] ? findPrecedingTextInput(pwFields[0]) : null);
      if (uField && !uField.value) {
        console.log('[FlakeSecure] Cached username auto-filled for domain:', cached.domain);
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
            console.log('[FlakeSecure] Auto-submitting after cached password fill');
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
    if (isEmbedPresent()) return;
    if (watcherTimer) clearInterval(watcherTimer);
    watcherEndTime = Date.now() + 20000; // Watch for 20 seconds during multi-step navigation

    watcherTimer = setInterval(() => {
      if (isEmbedPresent() || Date.now() > watcherEndTime) {
        clearInterval(watcherTimer);
        watcherTimer = null;
        return;
      }
      checkAndAutoFillCachedCredentials();
    }, 250);
  }

  function fillRegistrationFields(fields) {
    if (!fields) return;
    const email = fields.email || '';
    const username = fields.username || '';
    const password = fields.password || '';
    const firstName = fields.firstName || fields.first_name || '';
    const lastName = fields.lastName || fields.last_name || '';

    if (email) {
      const emailField = document.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]');
      if (emailField) simulateInput(emailField, email);
    }
    if (username) {
      const userField = document.querySelector('input[name*="user" i], input[id*="user" i], input[name*="login" i]');
      if (userField && userField.type !== 'email') simulateInput(userField, username);
    }
    if (firstName) {
      const fnField = document.querySelector('input[name*="first" i], input[id*="first" i], input[name*="vorname" i]');
      if (fnField) simulateInput(fnField, firstName);
    }
    if (lastName) {
      const lnField = document.querySelector('input[name*="last" i], input[id*="last" i], input[name*="nachname" i]');
      if (lnField) simulateInput(lnField, lastName);
    }
    if (password) {
      const pwFields = findPasswordFields();
      pwFields.forEach(pField => simulateInput(pField, password));
    }
  }

  function handleQrScanned(msg) {
    const step1 = document.getElementById('fs-step-1');
    const step2 = document.getElementById('fs-step-2');
    if (step1) step1.classList.add('active');
    if (step2) step2.classList.add('active');

    const t = OVERLAY_I18N[currentOverlayLang] || OVERLAY_I18N.de || OVERLAY_I18N.en;
    const rawUser =
      msg && msg.username && String(msg.username).trim().toLowerCase() !== 'user'
        ? String(msg.username).trim()
        : '';

    const qrContainer = document.getElementById('flakesecure-qrcode');
    if (qrContainer && qrContainer.parentElement) {
      const parent = qrContainer.parentElement;
      parent.classList.add('is-scanned');
      parent.style.setProperty('background', '#080a12', 'important');

      if (!document.getElementById('fs-scanned-overlay')) {
        const scanTitleText = rawUser
          ? t.scannedBy.replace('{user}', rawUser)
          : t.scanned;
        const scanSubText = t.confirmOnPhone;

        const grad = createSvgEl(
          'linearGradient',
          { id: 'fsScannedLockGrad', x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
          [
            createSvgEl('stop', { offset: '0%', 'stop-color': '#FCD34D' }),
            createSvgEl('stop', { offset: '50%', 'stop-color': '#E8B020' }),
            createSvgEl('stop', { offset: '100%', 'stop-color': '#B45309' })
          ]
        );
        const lockSvg = createSvgEl(
          'svg',
          {
            viewBox: '0 0 100 100',
            width: '58',
            height: '58',
            style: 'display:block;margin:0 auto 10px auto;filter:drop-shadow(0 4px 14px rgba(232,176,32,0.35));'
          },
          [
            createSvgEl('defs', null, [grad]),
            createSvgEl('path', {
              d: 'M35 46 V32 A15 15 0 0 1 65 32 V46',
              fill: 'none',
              stroke: 'url(#fsScannedLockGrad)',
              'stroke-width': '9',
              'stroke-linecap': 'round'
            }),
            createSvgEl('rect', {
              x: '22',
              y: '44',
              width: '56',
              height: '44',
              rx: '9',
              fill: 'url(#fsScannedLockGrad)'
            }),
            createSvgEl('path', {
              d: 'M36 66 L45 75 L64 54',
              fill: 'none',
              stroke: '#080A12',
              'stroke-width': '6.5',
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round'
            })
          ]
        );

        const scannedOverlay = createEl('div', { id: 'fs-scanned-overlay' }, [
          lockSvg,
          createEl('div', {
            id: 'fs-scanned-title',
            textContent: scanTitleText,
            style: 'color:#ffffff;font-size:14px;font-weight:700;font-family:system-ui,-apple-system,sans-serif;letter-spacing:0.2px;margin-bottom:4px;text-align:center;'
          }),
          createEl('div', {
            id: 'fs-scanned-sub',
            textContent: scanSubText,
            style: 'color:#94a3b8;font-size:11.5px;font-weight:500;font-family:system-ui,-apple-system,sans-serif;text-align:center;'
          })
        ]);
        parent.appendChild(scannedOverlay);
      }
    }

    const statusMsg = rawUser
      ? t.userConfirming.replace('{user}', rawUser)
      : t.confirmOnPhone;
    updateOverlayStatus('waiting', statusMsg);
  }

  function connectDirectSocket(sessionId, keyHex, onData) {
    if (typeof io !== 'function') {
      updateOverlayStatus('error', 'Server nicht erreichbar');
      return;
    }

    if (portHeartbeat) {
      clearInterval(portHeartbeat);
      portHeartbeat = null;
    }
    if (activePort) {
      try { activePort.disconnect(); } catch (e) {}
      activePort = null;
    }
    if (socket) {
      try { socket.disconnect(); } catch (e) {}
      socket = null;
    }

    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000
    });

    socket.on('connect', async () => {
      const domain = window.location.hostname;
      const res = await storageGet('local', ['authToken']);
      socket.emit('join-session', { sid: sessionId, token: res?.authToken || null, domain });
    });

    socket.on('login-data', async (payload) => {
      const decrypted = await decryptData(payload, keyHex);
      if (decrypted) onData(decrypted);
    });

    socket.on('totp-data', async (payload) => {
      const decrypted = await decryptData(payload, keyHex);
      if (decrypted && decrypted.code) fillTotpCode(decrypted.code);
    });

    socket.on('session-expired', () => {
      removeOverlay();
    });

    socket.on('qr-scanned', (data) => {
      handleQrScanned(data);
    });

    socket.on('connect_error', () => {
      updateOverlayStatus('error', 'Server nicht erreichbar');
    });
  }

  function connectSocket(sessionId, keyHex, onData) {
    disconnectRelay(false);

    if (ext && ext.runtime && ext.runtime.connect) {
      let fellBackToDirect = false;
      try {
        activePort = ext.runtime.connect({ name: 'fs-socket-port' });

        storageGet('local', ['authToken']).then((res) => {
          if (activePort) {
            activePort.postMessage({
              type: 'CONNECT',
              sessionId,
              token: res?.authToken || null,
              domain: window.location.hostname
            });
          }
        });

        activePort.onMessage.addListener(async (msg) => {
          if (!msg || !msg.type) return;
          if (msg.type === 'LOGIN_DATA') {
            const decrypted = await decryptData(msg.payload, keyHex);
            if (decrypted) onData(decrypted);
          } else if (msg.type === 'TOTP_DATA') {
            const decrypted = await decryptData(msg.payload, keyHex);
            if (decrypted && decrypted.code) fillTotpCode(decrypted.code);
          } else if (msg.type === 'SESSION_EXPIRED') {
            removeOverlay();
          } else if (msg.type === 'QR_SCANNED') {
            handleQrScanned(msg);
          } else if (msg.type === 'SOCKET_ERROR' && !fellBackToDirect) {
            fellBackToDirect = true;
            connectDirectSocket(sessionId, keyHex, onData);
          }
        });

        activePort.onDisconnect.addListener(() => {
          const hadError = !!(ext.runtime && ext.runtime.lastError);
          activePort = null;
          if (portHeartbeat) {
            clearInterval(portHeartbeat);
            portHeartbeat = null;
          }
          if (hadError && !fellBackToDirect && currentSessionId === sessionId) {
            fellBackToDirect = true;
            connectDirectSocket(sessionId, keyHex, onData);
          }
        });

        // 10-second heartbeat to keep Chrome MV3 Service Worker active during session
        portHeartbeat = setInterval(() => {
          if (activePort) {
            try {
              activePort.postMessage({ type: 'PING' });
            } catch (e) {}
          }
        }, 10000);
        return;
      } catch (err) {
        console.log('[FlakeSecure] Port connection fallback:', err.message);
      }
    }

    connectDirectSocket(sessionId, keyHex, onData);
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

    disconnectRelay(true);
    uiInjected = false;
    currentSessionId = null;
  }

  const OVERLAY_I18N = {
    en: {
      regSubtitle: 'Secure Account Creation',
      loginSubtitle: 'Secure Biometric Login',
      regInstructions: 'Scan the QR code with the FlakeSecure App to automatically fill and securely save your account details.',
      loginInstructions: 'Scan the QR code with the FlakeSecure App and confirm with Face ID / Fingerprint.',
      step1: 'Scan',
      step2Reg: 'Customize',
      step2Login: 'Confirm',
      step3Reg: 'Filled',
      step3Login: 'Logged in',
      waiting: 'Waiting for scan…',
      fallback: 'App installed?',
      openDirectly: 'Open directly',
      scannedBy: 'Scanned by {user}',
      scanned: 'Scanned',
      confirmOnPhone: 'Confirm on phone…',
      userConfirming: '{user} confirming…'
    },
    de: {
      regSubtitle: 'Account sicher erstellen',
      loginSubtitle: 'Sichere biometrische Anmeldung',
      regInstructions: 'Scanne den QR-Code mit der FlakeSecure App, um deine Account-Daten automatisch auszufüllen und sicher zu speichern.',
      loginInstructions: 'Scanne den QR-Code mit der FlakeSecure App und bestätige mit Face ID / Fingerabdruck.',
      step1: 'Scannen',
      step2Reg: 'Anpassen',
      step2Login: 'Bestätigen',
      step3Reg: 'Ausgefüllt',
      step3Login: 'Eingeloggt',
      waiting: 'Warte auf Scan…',
      fallback: 'App installiert?',
      openDirectly: 'Direkt öffnen',
      scannedBy: 'Gescannt von {user}',
      scanned: 'Gescannt',
      confirmOnPhone: 'Auf Smartphone bestätigen…',
      userConfirming: '{user} bestätigt…'
    },
    fr: {
      regSubtitle: 'Création sécurisée de compte',
      loginSubtitle: 'Connexion biométrique sécurisée',
      regInstructions: 'Scannez le code QR avec l\'Application FlakeSecure pour remplir vos accès.',
      loginInstructions: 'Scannez le code QR avec l\'Application FlakeSecure et confirmez avec Face ID / Empreinte.',
      step1: 'Scanner',
      step2Reg: 'Personnaliser',
      step2Login: 'Confirmer',
      step3Reg: 'Rempli',
      step3Login: 'Connecté',
      waiting: 'En attente du scan…',
      fallback: 'App installée ?',
      openDirectly: 'Ouvrir directement',
      scannedBy: 'Scanné par {user}',
      scanned: 'Scanné',
      confirmOnPhone: 'Confirmez sur le smartphone…',
      userConfirming: '{user} confirme…'
    },
    es: {
      regSubtitle: 'Creación segura de cuenta',
      loginSubtitle: 'Inicio de sesión biométrico seguro',
      regInstructions: 'Escanea el código QR con la App FlakeSecure para rellenar tus credenciales.',
      loginInstructions: 'Escanea el código QR con la App FlakeSecure y confirma con Face ID / Huella.',
      step1: 'Escanear',
      step2Reg: 'Personalizar',
      step2Login: 'Confirmar',
      step3Reg: 'Completado',
      step3Login: 'Conectado',
      waiting: 'Esperando escaneo…',
      fallback: '¿App instalada?',
      openDirectly: 'Abrir directamente',
      scannedBy: 'Escaneado por {user}',
      scanned: 'Escaneado',
      confirmOnPhone: 'Confirmar en el móvil…',
      userConfirming: '{user} confirmando…'
    }
  };

  function createOverlay(sessionId, deepLink, domain, isRegister = false, lang = 'en') {
    if (document.getElementById('flakesecure-overlay')) return;

    currentOverlayLang = lang || 'de';
    const t = OVERLAY_I18N[currentOverlayLang] || OVERLAY_I18N.en;
    const cssUrl = ext && ext.runtime ? ext.runtime.getURL('styles/content.css') : '';

    const logoSvg = createSvgEl(
      'svg',
      { viewBox: '0 0 100 100', style: 'width:20px;height:20px;' },
      [
        createSvgEl('path', {
          d: 'M35 46 V34 A15 15 0 0 1 65 34 V46',
          fill: 'none',
          stroke: '#ffffff',
          'stroke-width': '9',
          'stroke-linecap': 'round'
        }),
        createSvgEl('rect', {
          x: '22',
          y: '44',
          width: '56',
          height: '44',
          rx: '8',
          fill: '#ffffff'
        })
      ]
    );

    const closeBtn = createEl('button', {
      id: 'fs-close',
      class: 'fs-close-btn',
      'aria-label': 'Schließen',
      textContent: '\u00d7'
    });

    const card = createEl(
      'div',
      { class: 'fs-card', role: 'dialog', 'aria-modal': 'true' },
      [
        closeBtn,
        createEl('div', { class: 'fs-logo' }, [
          createEl('div', { class: 'fs-logo-icon' }, [logoSvg]),
          createEl('h2', { class: 'fs-logo-text' }, [
            'Flake',
            createEl('span', { textContent: 'Secure' })
          ])
        ]),
        createEl('p', {
          class: 'fs-subtitle',
          textContent: isRegister ? t.regSubtitle : t.loginSubtitle
        }),
        createEl('div', { class: 'fs-domain-badge' }, [
          createEl('span', { class: 'fs-domain-dot' }),
          createEl('span', { class: 'fs-domain-text', textContent: domain })
        ]),
        createEl('div', { class: 'fs-qr-container' }, [
          createEl('div', { class: 'fs-qr-corner fs-qr-corner--tl' }),
          createEl('div', { class: 'fs-qr-corner fs-qr-corner--tr' }),
          createEl('div', { class: 'fs-qr-corner fs-qr-corner--bl' }),
          createEl('div', { class: 'fs-qr-corner fs-qr-corner--br' }),
          createEl('div', { id: 'flakesecure-qrcode' })
        ]),
        createEl('p', {
          class: 'fs-instructions',
          textContent: isRegister ? t.regInstructions : t.loginInstructions
        }),
        createEl('ul', { class: 'fs-steps' }, [
          createEl('li', { class: 'fs-step active', id: 'fs-step-1' }, [
            createEl('span', { class: 'fs-step-num', textContent: '1' }),
            createEl('span', { class: 'fs-step-label', textContent: t.step1 })
          ]),
          createEl('li', { class: 'fs-step', id: 'fs-step-2' }, [
            createEl('span', { class: 'fs-step-num', textContent: '2' }),
            createEl('span', {
              class: 'fs-step-label',
              textContent: isRegister ? t.step2Reg : t.step2Login
            })
          ]),
          createEl('li', { class: 'fs-step', id: 'fs-step-3' }, [
            createEl('span', { class: 'fs-step-num', textContent: '3' }),
            createEl('span', {
              class: 'fs-step-label',
              textContent: isRegister ? t.step3Reg : t.step3Login
            })
          ])
        ]),
        createEl('div', { class: 'fs-status-wrap' }, [
          createEl('div', {
            id: 'flakesecure-status',
            class: 'fs-status fs-status--waiting',
            textContent: t.waiting
          })
        ]),
        createEl('p', { class: 'fs-fallback-link' }, [
          createEl('span', { id: 'fs-fallback-prefix', textContent: t.fallback }),
          ' ',
          createEl('a', {
            id: 'fs-fallback-a',
            href: deepLink,
            target: '_blank',
            rel: 'noopener',
            textContent: t.openDirectly
          })
        ])
      ]
    );

    const children = [];
    if (cssUrl) {
      children.push(createEl('link', { rel: 'stylesheet', href: cssUrl }));
    }
    children.push(card);

    const overlay = createEl('div', { id: 'flakesecure-overlay' }, children);
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

    closeBtn.addEventListener('click', () => {
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
    if (isEmbedPresent()) return;
    if (document.getElementById('fs-login-btn') || !targetField || !targetField.parentNode) return;

    const iconSvg = createSvgEl(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: '14',
        height: '14',
        fill: 'none',
        stroke: '#07090e',
        'stroke-width': '2.5',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        style: 'display:inline-block;vertical-align:middle;margin-right:6px;'
      },
      [
        createSvgEl('path', {
          d: 'M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93'
        })
      ]
    );

    const btn = createEl(
      'button',
      {
        id: 'fs-login-btn',
        type: 'button',
        style: `
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #E8B020;
          color: #07090e;
          border: 1px solid #C9930A;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 6px;
          box-shadow: 0 3px 10px rgba(232, 176, 32, 0.3);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          z-index: 9999;
        `
      },
      [
        iconSvg,
        createEl('span', {
          textContent: 'FlakeSecure',
          style: 'vertical-align:middle;font-weight:700;'
        })
      ]
    );

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      btn.remove();
      showOverlay(targetField);
    });

    targetField.parentNode.insertBefore(btn, targetField.nextSibling);
  }

  async function getSettings() {
    const defaultLang = navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
    const res = await storageGet('sync', ['displayMode', 'autoLogin', 'autoOverlay', 'app_language']);
    return {
      displayMode: res?.displayMode || 'popup',
      autoLogin: res?.autoLogin !== false,
      autoOverlay: res?.autoOverlay !== false,
      app_language: res?.app_language || defaultLang
    };
  }

  async function handlePasswordField(field, settings) {
    if (isEmbedPresent()) return;
    if (uiInjected || userCancelled) return;

    const s = settings || await getSettings();
    if (isEmbedPresent()) return;
    if (s.displayMode === 'button') {
      injectLoginButton(field);
    } else {
      showOverlay(field);
    }
  }

  async function showOverlay(field) {
    if (isEmbedPresent()) return;
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
        updateOverlayStatus('success', 'Account-Daten erfolgreich eingetragen!');
        setTimeout(() => {
          removeOverlay();
        }, 1200);
      } else {
        updateOverlayStatus('success', 'Anmeldedaten empfangen: Logge ein...');

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
              // Password was filled and submitted: cache no longer needed
              clearCachedCredentials();
            } else {
              console.log('[FlakeSecure] Step 1 filled (username only). Watching for Step 2 password field...');
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

  function scheduleCheck(forceUserTrigger = false) {
    if (isEmbedPresent()) return;
    if (scheduleCheckTimeout) clearTimeout(scheduleCheckTimeout);
    scheduleCheckTimeout = setTimeout(() => {
      runSmartDetection(forceUserTrigger);
    }, 150);
  }

  async function runSmartDetection(forceUserTrigger = false) {
    if (isEmbedPresent()) return;

    // 1. Auto-fill from cache if credentials already exist
    await checkAndAutoFillCachedCredentials();

    if (isEmbedPresent() || userCancelled || uiInjected) return;

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

  window.addEventListener('flakesecure:embed-ready', () => {
    embedDetected = true;
    silenceForEmbed();
  });

  const runtimeAPI = ext && ext.runtime ? ext.runtime : null;
  if (runtimeAPI && runtimeAPI.onMessage) {
    runtimeAPI.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'FS_CHECK_EMBED') {
        sendResponse({ embedPresent: isEmbedPresent() });
      }
    });
  }

  // 1. Focused input listener: only trigger on genuine auth inputs
  document.addEventListener('focusin', (e) => {
    if (isEmbedPresent()) return;
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
  if (!isEmbedPresent()) {
    checkAndAutoFillCachedCredentials();
    startPersistentStepWatcher();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (isEmbedPresent()) return;
      scheduleCheck(false);
      startPersistentStepWatcher();
    });
  } else if (!isEmbedPresent()) {
    scheduleCheck(false);
    startPersistentStepWatcher();
  }

  window.addEventListener('load', () => {
    if (isEmbedPresent()) return;
    checkAndAutoFillCachedCredentials();
  });

  // 3. Mutation Observer: monitors DOM for dynamic password fields & late-mounted embeds
  const observer = new MutationObserver(() => {
    if (isEmbedPresent()) return;
    checkAndAutoFillCachedCredentials();
  });

  observer.observe(document.documentElement || document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'type', 'hidden', 'data-flakesecure-embed', 'src']
  });

})();