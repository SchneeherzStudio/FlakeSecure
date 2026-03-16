// FlakeSecure Content Script
// Detects password fields and injects the secure login overlay

(function () {
  'use strict';

  const SERVER_URL = 'https://flakesecure.snowystudio.dev';
  let overlayInjected = false;
  let userCancelled = false;   // set on manual cancel – prevents re-trigger on same page
  let socket = null;
  let currentSessionId = null;

  // ─── Utility: Generate cryptographically random values ───────────────────────
  function generateSessionId() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  // Generate a random 32-byte AES key, returned as hex for embedding in the QR code.
  async function generateAESKey() {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const keyHex = Array.from(raw, b => b.toString(16).padStart(2, '0')).join('');
    return { keyHex };
  }

  // ─── AES-256-CTR + HMAC-SHA256 decrypt (mirrors mobile app crypto.js) ─────
  // Wire format: { iv: number[16], data: number[ciphertext + 32-byte SHA-256 tag] }
  // HMAC input: SHA-256( hex(iv) + hex(ciphertext) )

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
      const ivBytes   = new Uint8Array(iv);
      const dataBytes = new Uint8Array(data);

      // Split: last 32 bytes are the HMAC-SHA256 tag
      const TAG_LEN    = 32;
      const ciphertext = dataBytes.slice(0, dataBytes.length - TAG_LEN);
      const tagBytes   = dataBytes.slice(dataBytes.length - TAG_LEN);

      // Verify tag: SHA-256( hex(iv) + hex(ciphertext) )
      const macInputHex = bytesToHex(ivBytes) + bytesToHex(ciphertext);
      const hashBuffer  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(macInputHex));
      const expected    = new Uint8Array(hashBuffer);

      let diff = 0;
      for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ tagBytes[i];
      if (diff !== 0) throw new Error('HMAC verification failed – payload may be tampered');

      // AES-256-CTR decrypt
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

  // ─── Fill login fields ────────────────────────────────────────────────────────
  function fillLoginFields(username, password) {
    // Find password field
    const passwordFields = document.querySelectorAll('input[type="password"]');
    
    // Find username/email field (usually the field before the password field, or type=email/text)
    const usernameField = document.querySelector(
      'input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="email"], input[type="text"][id*="user"], input[type="text"][id*="email"], input[autocomplete="username"], input[autocomplete="email"]'
    ) || (passwordFields[0] ? findPrecedingTextInput(passwordFields[0]) : null);

    if (usernameField && username) {
      simulateInput(usernameField, username);
    }

    if (passwordFields[0] && password) {
      simulateInput(passwordFields[0], password);
    }
  }

  function findPrecedingTextInput(passwordField) {
    const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'));
    const idx = allInputs.indexOf(passwordField);
    if (idx > 0) {
      for (let i = idx - 1; i >= 0; i--) {
        if (allInputs[i].type !== 'password') return allInputs[i];
      }
    }
    return null;
  }

  function simulateInput(element, value) {
    // Trigger React/Vue/Angular synthetic events
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // ─── Socket connection ────────────────────────────────────────────────────────
  function connectSocket(sessionId, keyHex, onData) {
    if (socket) {
      socket.disconnect();
    }

    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000
    });

    socket.on('connect', () => {
      console.log('[FlakeSecure] Connected to relay server');
      socket.emit('join-session', { sid: sessionId });
    });

    socket.on('login-data', async (payload) => {
      console.log('[FlakeSecure] Received login data');
      const decrypted = await decryptData(payload, keyHex);
      if (decrypted) {
        onData(decrypted);
      }
    });

    socket.on('session-expired', () => {
      console.log('[FlakeSecure] Session expired');
      removeOverlay();
    });

    socket.on('disconnect', () => {
      console.log('[FlakeSecure] Disconnected from relay server');
    });

    socket.on('connect_error', (err) => {
      console.error('[FlakeSecure] Connection error:', err.message);
      updateOverlayStatus('error', 'Server nicht erreichbar');
    });
  }

  // ─── Overlay UI ───────────────────────────────────────────────────────────────
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
      overlay.style.animation = 'fsOverlayOut 0.4s ease-in forwards';
      // Disconnect observer during animation so the fading overlay's
      // own DOM removals don't re-trigger checkForPasswordField
      observer.disconnect();
      setTimeout(() => {
        overlay.remove();
        // Only resume observer if not cancelled
        if (!cancelled) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
      }, 420);
    }
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    overlayInjected = false;
    currentSessionId = null;
  }

  function createOverlay(sessionId, deepLink, domain) {
    // Prevent duplicate overlays
    if (document.getElementById('flakesecure-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'flakesecure-overlay';
    overlay.innerHTML = `
      <style>
        #flakesecure-overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          background: rgba(8, 10, 18, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fsOverlayIn 0.35s ease-out forwards;
          font-family: -apple-system, 'SF Pro Display', 'Segoe UI', sans-serif;
        }
        @keyframes fsOverlayIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(12px); }
        }
        @keyframes fsOverlayOut {
          from { opacity: 1; backdrop-filter: blur(12px); }
          to { opacity: 0; backdrop-filter: blur(0px); }
        }
        .fs-card {
          background: linear-gradient(145deg, #0f1117, #161b2e);
          border: 1px solid rgba(99, 145, 255, 0.2);
          border-radius: 24px;
          padding: 40px;
          width: 380px;
          box-shadow: 0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08);
          text-align: center;
          animation: fsCardIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          position: relative;
          overflow: hidden;
        }
        .fs-card::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(ellipse at 60% 0%, rgba(99, 145, 255, 0.06) 0%, transparent 60%);
          pointer-events: none;
        }
        @keyframes fsCardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .fs-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 6px;
        }
        .fs-logo-icon {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #6391ff, #a78bfa);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 4px 12px rgba(99, 145, 255, 0.4);
        }
        .fs-logo-text {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.5px;
        }
        .fs-logo-text span {
          color: #6391ff;
        }
        .fs-subtitle {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          margin-bottom: 28px;
          letter-spacing: 0.02em;
        }
        .fs-domain-badge {
          display: flex;
          width: fit-content;
          margin: auto;
          align-items: center;
          gap: 6px;
          background: rgba(99, 145, 255, 0.1);
          border: 1px solid rgba(99, 145, 255, 0.25);
          border-radius: 20px;
          padding: 4px 12px 4px 8px;
          font-size: 12px;
          color: #8eb0ff;
          margin-bottom: 24px;
        }
        .fs-domain-dot {
          width: 6px; height: 6px;
          background: #6391ff;
          border-radius: 50%;
          animation: fsPulse 2s ease-in-out infinite;
        }
        @keyframes fsPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        .fs-qr-wrapper {
          background: #fff;
          border-radius: 16px;
          padding: 16px;
          display: inline-block;
          margin-bottom: 20px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          position: relative;
        }
        .fs-qr-wrapper::after {
          content: '🔒';
          position: absolute;
          bottom: -8px;
          right: -8px;
          background: #161b2e;
          border: 1px solid rgba(99,145,255,0.3);
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          display: grid;
          place-items: center;
        }
        #flakesecure-qr canvas, #flakesecure-qr img {
          display: block;
          border-radius: 4px;
        }
        .fs-instruction {
          font-size: 14px;
          color: rgba(255,255,255,0.65);
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .fs-instruction strong {
          color: #fff;
          font-weight: 600;
        }
        .fs-status {
          font-size: 12px;
          padding: 8px 16px;
          border-radius: 20px;
          margin-bottom: 20px;
          font-weight: 500;
          transition: all 0.3s ease;
        }
        .fs-status--waiting {
          background: rgba(99, 145, 255, 0.1);
          color: #8eb0ff;
          border: 1px solid rgba(99, 145, 255, 0.2);
        }
        .fs-status--success {
          background: rgba(34, 197, 94, 0.1);
          color: #86efac;
          border: 1px solid rgba(34, 197, 94, 0.2);
        }
        .fs-status--error {
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .fs-cancel {
          background: none;
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.4);
          border-radius: 10px;
          padding: 8px 20px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        .fs-cancel:hover {
          border-color: rgba(255,255,255,0.25);
          color: rgba(255,255,255,0.7);
          background: rgba(255,255,255,0.05);
        }
        .fs-steps {
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-bottom: 16px;
        }
        .fs-step {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: rgba(255,255,255,0.35);
        }
        .fs-step-num {
          width: 18px; height: 18px;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
          display: grid;
          place-items: center;
          font-size: 10px;
          font-weight: 600;
        }
        .fs-step-num.active {
          background: #6391ff;
          color: #fff;
        }
        .fs-step-line {
          width: 16px;
          height: 1px;
          background: rgba(255,255,255,0.1);
        }
      </style>
      <div class="fs-card">
        <div class="fs-logo">
          <div class="fs-logo-icon">❄️</div>
          <div class="fs-logo-text">Flake<span>Secure</span></div>
        </div>
        <div class="fs-subtitle">Biometrische Anmeldung</div>
        <div class="fs-domain-badge">
          <div class="fs-domain-dot"></div>
          ${domain}
        </div>
        <div class="fs-qr-wrapper">
          <div id="flakesecure-qr"></div>
        </div>
        <div class="fs-steps">
          <div class="fs-step">
            <div class="fs-step-num active">1</div>
          </div>
          <div class="fs-step-line"></div>
          <div class="fs-step">
            <div class="fs-step-num" id="fs-step-2">2</div>
          </div>
          <div class="fs-step-line"></div>
          <div class="fs-step">
            <div class="fs-step-num" id="fs-step-3">3</div>
          </div>
        </div>
        <p class="fs-instruction">
          Öffne die <strong>FlakeSecure App</strong> und<br>scanne diesen QR-Code
        </p>
        <div id="flakesecure-status" class="fs-status fs-status--waiting">
          ⏳ Warte auf dein Smartphone…
        </div>
        <button class="fs-cancel" id="flakesecure-cancel">Abbrechen</button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Cancel button
    document.getElementById('flakesecure-cancel').addEventListener('click', () => removeOverlay(true));

    // Generate QR code
    generateQRCode(deepLink, 'flakesecure-qr');
  }

  function generateQRCode(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Use QRCode.js if available, else draw a placeholder
    if (typeof QRCode !== 'undefined') {
      new QRCode(container, {
        text: data,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      // Fallback: show URL as text for testing
      const pre = document.createElement('div');
      pre.style.cssText = 'width:200px;height:200px;display:flex;align-items:center;justify-content:center;font-size:10px;word-break:break-all;padding:8px;box-sizing:border-box;color:#000;text-align:center;';
      pre.textContent = data;
      container.appendChild(pre);
    }
  }

  // ─── Main: Detect password fields ────────────────────────────────────────────
  async function handlePasswordField() {
    if (overlayInjected) return;
    overlayInjected = true;

    const domain = window.location.hostname;
    const sessionId = generateSessionId();
    const { keyHex } = await generateAESKey();
    currentSessionId = sessionId;

    const deepLink = `flakesecure://auth?sid=${sessionId}&key=${keyHex}&domain=${encodeURIComponent(domain)}`;

    createOverlay(sessionId, deepLink, domain);

    connectSocket(sessionId, keyHex, (credentials) => {
      updateOverlayStatus('success', '✅ Anmeldedaten empfangen – logge dich ein…');
      
      const step2 = document.getElementById('fs-step-2');
      const step3 = document.getElementById('fs-step-3');
      if (step2) step2.classList.add('active');
      if (step3) step3.classList.add('active');

      setTimeout(() => {
        fillLoginFields(credentials.username, credentials.password);
        setTimeout(() => {
          removeOverlay();
          // Attempt form submit
          const form = document.querySelector('input[type="password"]')?.closest('form');
          if (form) {
            const submitBtn = form.querySelector('[type="submit"], button:not([type="button"])');
            if (submitBtn) submitBtn.click();
          }
        }, 800);
      }, 600);
    });
  }

  // ─── MutationObserver: Watch for password fields ──────────────────────────────
  function checkForPasswordField() {
    if (userCancelled) return;      // user dismissed on this page – don't re-open
    if (overlayInjected) return;
    const pwField = document.querySelector('input[type="password"]');
    if (pwField) {
      handlePasswordField();
    }
  }

  // Initial check
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkForPasswordField);
  } else {
    checkForPasswordField();
  }

  // Watch for dynamically added fields (SPAs).
  // Declared with `var` so removeOverlay() can reference it before this line runs.
  var observer = new MutationObserver(() => {
    checkForPasswordField();
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();