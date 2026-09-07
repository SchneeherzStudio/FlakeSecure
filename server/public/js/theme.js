/**
 * FlakeSecure Theme Controller v2.0.4
 * Detects system color scheme preference (dark/light) as default,
 * supports manual user override, and persists selection in localStorage.
 */
(function () {
  const THEME_STORAGE_KEY = 'fs_theme';

  function getPreferredTheme() {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (_) {}

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  function applyTheme(theme) {
    const validTheme = (theme === 'light') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', validTheme);
    if (document.body) {
      document.body.setAttribute('data-theme', validTheme);
    }

    // Update meta theme-color for mobile browsers
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', validTheme === 'light' ? '#f8fafc' : '#07090e');
    }

    // Update all toggle buttons in DOM
    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    toggleBtns.forEach(btn => {
      btn.setAttribute('aria-label', validTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', validTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      const sun = btn.querySelector('.theme-icon-sun');
      const moon = btn.querySelector('.theme-icon-moon');
      if (sun && moon) {
        if (validTheme === 'dark') {
          sun.style.display = 'block';
          moon.style.display = 'none';
        } else {
          sun.style.display = 'none';
          moon.style.display = 'block';
        }
      }
    });

    try {
      window.dispatchEvent(new CustomEvent('fs_theme_changed', { detail: { theme: validTheme } }));
    } catch (_) {}
  }

  let lastToggleTime = 0;
  window.toggleTheme = function () {
    const now = Date.now();
    // Debounce guard: reject rapid successive invocations within 200ms
    if (now - lastToggleTime < 200) {
      return document.documentElement.getAttribute('data-theme') || 'dark';
    }
    lastToggleTime = now;

    const current = document.documentElement.getAttribute('data-theme');
    const next = (current === 'light') ? 'dark' : 'light';

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (_) {}

    applyTheme(next);
    return next;
  };

  // Immediate execution before DOM render to prevent flash of wrong theme
  const initialTheme = getPreferredTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);

  // Listen to OS system changes if no manual preference is saved
  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
        let saved = null;
        try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch (_) {}
        if (!saved) {
          applyTheme(e.matches ? 'light' : 'dark');
        }
      });
    } catch (_) {}
  }

  function bindButtons() {
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      if (!btn._fsThemeBound) {
        btn._fsThemeBound = true;
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          window.toggleTheme();
        });
      }
    });
  }

  // Delegated document-level click listener as fallback
  document.addEventListener('click', (e) => {
    try {
      let el = e.target;
      while (el && el !== document) {
        if (el.classList && el.classList.contains('theme-toggle-btn')) {
          e.preventDefault();
          window.toggleTheme();
          return;
        }
        el = el.parentElement || el.parentNode;
      }
    } catch (_) {}
  });

  // Re-apply when DOM is ready to ensure button icons reflect active theme
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bindButtons();
      applyTheme(document.documentElement.getAttribute('data-theme') || initialTheme);
    });
  } else {
    bindButtons();
    applyTheme(document.documentElement.getAttribute('data-theme') || initialTheme);
  }
})();
