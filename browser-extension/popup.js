// FlakeSecure Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('server-url');
  const saveBtn = document.getElementById('save-btn');
  const autoLoginToggle = document.getElementById('auto-login');
  const autoOverlayToggle = document.getElementById('auto-overlay');
  const statusMsg = document.getElementById('status-msg');

  // Load saved settings
  chrome.storage.sync.get(['serverUrl', 'autoLogin', 'autoOverlay'], (result) => {
    if (result.serverUrl) serverUrlInput.value = result.serverUrl;
    if (result.autoLogin !== undefined) autoLoginToggle.checked = result.autoLogin;
    if (result.autoOverlay !== undefined) autoOverlayToggle.checked = result.autoOverlay;
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const url = serverUrlInput.value.trim();
    chrome.storage.sync.set({
      serverUrl: url,
      autoLogin: autoLoginToggle.checked,
      autoOverlay: autoOverlayToggle.checked
    }, () => {
      statusMsg.textContent = 'Gespeichert ✓';
      setTimeout(() => { statusMsg.textContent = 'Bereit'; }, 2000);
    });
  });

  // Toggle listeners
  [autoLoginToggle, autoOverlayToggle].forEach(toggle => {
    toggle.addEventListener('change', () => {
      chrome.storage.sync.set({
        autoLogin: autoLoginToggle.checked,
        autoOverlay: autoOverlayToggle.checked
      });
    });
  });
});