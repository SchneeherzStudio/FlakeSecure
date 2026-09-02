/**
 * ============================================================================
 * FlakeSecure - Embeddable Iframe & Drop-In SDK v2.0
 * ============================================================================
 * 
 * Allows website providers to embed Zero-Knowledge biometric QR login directly
 * into any web page. The provider's backend receives credentials through
 * standard form submissions, while the FlakeSecure relay server never sees
 * plaintext credentials.
 * ============================================================================
 */

(function (window, document) {
  'use strict';

  if (window.FlakeSecure) {
    return; // Prevent duplicate instantiation
  }

  // Detect script source to resolve FlakeSecure server URL automatically
  let defaultServerUrl = 'https://flakesecure.snowystudio.dev';
  const currentScript = document.currentScript;
  if (currentScript && currentScript.src) {
    try {
      const url = new URL(currentScript.src);
      defaultServerUrl = url.origin;
    } catch (e) {}
  }

  // Universal input simulation for React, Vue, Angular, Svelte & Vanilla HTML
  function simulateInput(element, value) {
    if (!element) return;
    try {
      element.focus();
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
    } catch (err) {
      element.value = value;
    }
  }

  // Find password and username fields
  function findAuthFields(root = document) {
    const passwordInputs = Array.from(
      root.querySelectorAll('input[type="password"]')
    ).filter(el => el.offsetParent !== null); // only visible inputs

    let targetPw = passwordInputs[0] || null;
    let targetUser = null;

    if (targetPw) {
      const form = targetPw.closest('form') || root;
      const textInputs = Array.from(
        form.querySelectorAll('input[type="text"], input[type="email"], input[name*="user" i], input[id*="user" i], input[autocomplete="username"], input[autocomplete="email"]')
      ).filter(el => el.offsetParent !== null && el !== targetPw);

      targetUser = textInputs[0] || null;
    } else {
      const genericUser = root.querySelector('input[type="email"], input[autocomplete="username"], input[name*="username" i]');
      if (genericUser && genericUser.offsetParent !== null) {
        targetUser = genericUser;
      }
    }

    return {
      passwordField: targetPw,
      usernameField: targetUser,
      form: targetPw ? targetPw.closest('form') : (targetUser ? targetUser.closest('form') : null)
    };
  }

  // Submit the form
  function submitForm(form, targetElement) {
    if (!form) {
      if (targetElement) {
        targetElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        targetElement.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        targetElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      }
      return;
    }

    // Try finding submit button first
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]') ||
      Array.from(form.querySelectorAll('button')).find(b => /log\s*in|sign\s*in|anmelden|submit|weiter/i.test(b.innerText || ''));

    if (submitBtn) {
      submitBtn.click();
      return;
    }

    if (typeof form.requestSubmit === 'function') {
      try {
        form.requestSubmit();
        return;
      } catch (e) {}
    }

    if (typeof form.submit === 'function') {
      try {
        form.submit();
        return;
      } catch (e) {}
    }
  }

  // FlakeSecure Client SDK
  const FlakeSecure = {
    version: '2.0.0',
    serverUrl: defaultServerUrl,
    activeInstances: [],

    /**
     * Mounts the FlakeSecure QR login widget inside a container element.
     * 
     * @param {string|HTMLElement} container Target container selector or element
     * @param {Object} options Configuration options
     * @returns {HTMLElement} The created iframe element
     */
    mount: function (container, options = {}) {
      const target = typeof container === 'string' ? document.querySelector(container) : container;
      if (!target) {
        console.error('[FlakeSecure] Container element not found:', container);
        return null;
      }

      const server = options.serverUrl || this.serverUrl;
      const domain = options.domain || window.location.hostname;
      const theme = options.theme || 'dark';
      const compact = options.compact ? 'true' : 'false';
      const lang = options.lang || (navigator.language ? navigator.language.substring(0, 2) : 'de');

      const iframe = document.createElement('iframe');
      const widgetUrl = `${server}/embed/widget.html?domain=${encodeURIComponent(domain)}&theme=${encodeURIComponent(theme)}&compact=${compact}&lang=${encodeURIComponent(lang)}`;

      iframe.src = widgetUrl;
      iframe.title = 'FlakeSecure Biometric Login';
      iframe.style.width = options.width || (options.compact ? '260px' : '320px');
      iframe.style.height = options.height || (options.compact ? '360px' : '440px');
      iframe.style.border = 'none';
      iframe.style.borderRadius = options.borderRadius || '20px';
      iframe.style.overflow = 'hidden';
      iframe.style.background = 'transparent';
      iframe.style.display = 'block';
      iframe.style.margin = '0 auto';
      iframe.setAttribute('allow', 'clipboard-write');
      iframe.setAttribute('loading', 'lazy');

      target.innerHTML = '';
      target.appendChild(iframe);

      const instance = {
        container: target,
        iframe: iframe,
        options: options
      };
      this.activeInstances.push(instance);

      return iframe;
    },

    /**
     * Mounts a sleek "Sign in with FlakeSecure" button that opens a modal popup.
     * 
     * @param {string|HTMLElement} container Target button container
     * @param {Object} options Configuration options
     */
    mountButton: function (container, options = {}) {
      const target = typeof container === 'string' ? document.querySelector(container) : container;
      if (!target) return null;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flakesecure-login-button';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" style="margin-right:8px;vertical-align:middle;">
          <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        </svg>
        <span>${options.text || 'Mit FlakeSecure anmelden'}</span>
      `;
      btn.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #6391ff, #7c6aff);
        color: #ffffff;
        border: none;
        border-radius: 12px;
        padding: 10px 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(99, 145, 255, 0.35);
        transition: transform 0.15s, box-shadow 0.15s;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      `;

      btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateY(-1px)'; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = 'translateY(0)'; });
      btn.addEventListener('click', () => {
        this.openModal(options);
      });

      target.appendChild(btn);
      return btn;
    },

    /**
     * Opens the FlakeSecure QR login inside a stylish lightbox modal.
     * 
     * @param {Object} options Configuration options
     */
    openModal: function (options = {}) {
      const existing = document.getElementById('flakesecure-modal-backdrop');
      if (existing) existing.remove();

      const backdrop = document.createElement('div');
      backdrop.id = 'flakesecure-modal-backdrop';
      backdrop.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(8, 10, 18, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        padding: 16px;
        animation: fsFadeIn 0.25s ease-out;
      `;

      const modalWrapper = document.createElement('div');
      modalWrapper.style.cssText = `
        position: relative;
        max-width: 360px;
        width: 100%;
      `;

      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.style.cssText = `
        position: absolute;
        top: -12px;
        right: -12px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #1e293b;
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        z-index: 1000000;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      `;
      closeBtn.onclick = () => backdrop.remove();

      backdrop.onclick = (e) => {
        if (e.target === backdrop) backdrop.remove();
      };

      modalWrapper.appendChild(closeBtn);
      backdrop.appendChild(modalWrapper);
      document.body.appendChild(backdrop);

      const modalOptions = {
        ...options,
        onSuccess: (data) => {
          setTimeout(() => backdrop.remove(), 1200);
          if (options.onSuccess) options.onSuccess(data);
        }
      };

      this.mount(modalWrapper, modalOptions);
    },

    /**
     * Automatically handles incoming credentials: fills the login form
     * and submits it via standard web semantics.
     */
    handleCredentials: function (data, options = {}) {
      const autoSubmit = options.autoSubmit !== false;
      const fields = findAuthFields(document);

      let usernameField = options.usernameField ? document.querySelector(options.usernameField) : fields.usernameField;
      let passwordField = options.passwordField ? document.querySelector(options.passwordField) : fields.passwordField;
      let form = options.targetForm ? document.querySelector(options.targetForm) : fields.form;

      if (usernameField && data.username) {
        simulateInput(usernameField, data.username);
      }
      if (passwordField && data.password) {
        simulateInput(passwordField, data.password);
      }

      // If TOTP code is included, attempt filling 2FA inputs
      if (data.totp) {
        const totpInput = document.querySelector('input[name*="otp" i], input[name*="totp" i], input[autocomplete="one-time-code"]');
        if (totpInput) {
          simulateInput(totpInput, data.totp);
        }
      }

      // Fire developer success callback if provided
      if (typeof options.onSuccess === 'function') {
        try {
          options.onSuccess(data);
        } catch (err) {
          console.error('[FlakeSecure] Developer onSuccess callback error:', err);
        }
      }

      // Auto-submit the form so the provider's server receives credentials normally
      if (autoSubmit && (passwordField || form)) {
        setTimeout(() => {
          submitForm(form, passwordField);
        }, 500);
      }
    }
  };

  // Cross-Window PostMessage Receiver (Zero-Knowledge Bridge)
  window.addEventListener('message', function (event) {
    if (!event.data || event.data.source !== 'flakesecure-embed') {
      return;
    }

    if (event.data.type === 'FLAKESECURE_LOGIN_DATA') {
      const payload = event.data;

      // Find matched instance options if any
      let matchingOptions = {};
      for (const inst of FlakeSecure.activeInstances) {
        if (inst.iframe && inst.iframe.contentWindow === event.source) {
          matchingOptions = inst.options || {};
          break;
        }
      }

      FlakeSecure.handleCredentials(payload, matchingOptions);
    }
  });

  // Auto-mount handler for declarative script tags
  if (currentScript) {
    const autoMount = currentScript.getAttribute('data-auto-mount');
    const containerSelector = currentScript.getAttribute('data-container');
    const buttonSelector = currentScript.getAttribute('data-button-container');
    const theme = currentScript.getAttribute('data-theme') || 'dark';
    const autoSubmit = currentScript.getAttribute('data-auto-submit') !== 'false';
    const compact = currentScript.getAttribute('data-compact') === 'true';

    const scriptOptions = { theme, autoSubmit, compact };

    const runAutoMount = () => {
      if (containerSelector) {
        FlakeSecure.mount(containerSelector, scriptOptions);
      } else if (buttonSelector) {
        FlakeSecure.mountButton(buttonSelector, scriptOptions);
      } else if (autoMount === 'true') {
        // Automatically find login container or form
        const targetForm = document.querySelector('form');
        if (targetForm) {
          const wrapper = document.createElement('div');
          wrapper.className = 'flakesecure-auto-container';
          wrapper.style.margin = '16px auto';
          targetForm.appendChild(wrapper);
          FlakeSecure.mount(wrapper, scriptOptions);
        }
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runAutoMount);
    } else {
      runAutoMount();
    }
  }

  // Inject standard CSS keyframes for modal animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fsFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);

  window.FlakeSecure = FlakeSecure;
})(window, document);
