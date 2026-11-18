/**
 * ============================================================================
 * FlakeSecure - Chrome MV3 Background Service Worker (Socket Bridge) v2.1.0
 * ============================================================================
 *
 * 1. PERSISTENT KEEPALIVE & PORT LIFECYCLE:
 *    - Loads lib/socket.io.min.js via importScripts inside the MV3 worker.
 *    - Maintains long-lived fs-socket-port connections from content scripts so
 *      CSP-restricted sites do not block WebSocket connections.
 *    - Uses chrome.alarms keepalive + PING/PONG heartbeat to prevent worker idle.
 *
 * 2. SOCKET.IO RELAY MANAGEMENT:
 *    - Joins session room (join-session) and forwards LOGIN_DATA, PAIRING_DATA,
 *      TOTP_DATA, SESSION_EXPIRED, QR_SCANNED, SOCKET_CONNECTED, SOCKET_ERROR.
 *
 * 3. FIRST-INSTALL ONBOARDING:
 *    - Opens hosted welcome page (with local welcome.html fallback) on install.
 * ============================================================================
 */

try {
  importScripts('lib/socket.io.min.js');
} catch (err) {
  console.error('[FlakeSecure Background] Failed to load socket.io:', err);
}

const SERVER_URL = 'https://flakesecure.snowystudio.dev';
const ext =
  typeof browser !== 'undefined' && browser.runtime
    ? browser
    : typeof chrome !== 'undefined'
      ? chrome
      : null;

let socket = null;
const activePorts = new Set();
let currentSession = null;

// 1. Alarms API keepalive setup
try {
  if (ext && ext.alarms) {
    ext.alarms.create('fs-keepalive-alarm', { periodInMinutes: 0.5 });
    ext.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'fs-keepalive-alarm') {
        if (activePorts.size > 0 && currentSession && (!socket || !socket.connected)) {
          initSocket(currentSession.sessionId, currentSession.token, currentSession.domain);
        }
      }
    });
  }
} catch (e) {
  console.log('[FlakeSecure Background] Alarms init note:', e.message);
}

// 2. Internal keepalive tick while a session port is open
setInterval(() => {
  if (activePorts.size > 0 && currentSession && socket && socket.connected) {
    socket.emit('ping-session', { sid: currentSession.sessionId });
  }
}, 15000);

function broadcastToPorts(msg) {
  for (const port of activePorts) {
    try {
      port.postMessage(msg);
    } catch (err) {
      activePorts.delete(port);
    }
  }
}

function closeSocket() {
  if (socket) {
    try {
      socket.disconnect();
    } catch (e) {}
    socket = null;
  }
  currentSession = null;
}

function initSocket(sessionId, token, domain) {
  currentSession = { sessionId, token, domain };
  if (socket) {
    try {
      socket.disconnect();
    } catch (e) {}
    socket = null;
  }

  if (typeof io !== 'function') {
    broadcastToPorts({ type: 'SOCKET_ERROR', message: 'Socket.IO unavailable in background worker' });
    return;
  }

  // Service Workers do not provide XMLHttpRequest; use WebSocket transport directly.
  socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 15000
  });

  socket.on('connect', () => {
    socket.emit('join-session', { sid: sessionId, token: token || null, domain });
    broadcastToPorts({ type: 'SOCKET_CONNECTED' });
  });

  socket.on('login-data', (payload) => {
    broadcastToPorts({ type: 'LOGIN_DATA', payload });
  });

  socket.on('pairing-data', (payload) => {
    broadcastToPorts({ type: 'PAIRING_DATA', payload });
    broadcastToPorts({ type: 'LOGIN_DATA', payload });
  });

  socket.on('totp-data', (payload) => {
    broadcastToPorts({ type: 'TOTP_DATA', payload });
  });

  socket.on('session-expired', () => {
    broadcastToPorts({ type: 'SESSION_EXPIRED' });
  });

  socket.on('qr-scanned', (data) => {
    broadcastToPorts({ type: 'QR_SCANNED', username: data?.username });
  });

  socket.on('disconnect', () => {
    broadcastToPorts({ type: 'SOCKET_DISCONNECTED' });
  });

  socket.on('connect_error', (err) => {
    broadcastToPorts({ type: 'SOCKET_ERROR', message: err?.message || 'Connection error' });
  });
}

// 3. Port-based persistent bridge for content scripts
if (ext && ext.runtime && ext.runtime.onConnect) {
  ext.runtime.onConnect.addListener((port) => {
    if (port.name !== 'fs-socket-port') return;
    activePorts.add(port);

    port.onMessage.addListener((msg) => {
      if (!msg || !msg.type) return;
      if (msg.type === 'CONNECT') {
        initSocket(msg.sessionId, msg.token, msg.domain);
      } else if (msg.type === 'PING') {
        try {
          port.postMessage({ type: 'PONG' });
        } catch (e) {}
      } else if (msg.type === 'DISCONNECT') {
        activePorts.delete(port);
        if (activePorts.size === 0) {
          closeSocket();
        }
      }
    });

    port.onDisconnect.addListener(() => {
      activePorts.delete(port);
      if (activePorts.size === 0) {
        closeSocket();
      }
    });
  });
}

// 4. One-shot message listener fallback
if (ext && ext.runtime && ext.runtime.onMessage) {
  ext.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;
    if (message.type === 'CONNECT') {
      initSocket(message.sessionId, message.token, message.domain);
    } else if (message.type === 'DISCONNECT') {
      if (activePorts.size === 0) {
        closeSocket();
      }
    }
  });
}

// 5. Onboarding / first-install landing page
if (ext && ext.runtime && ext.runtime.onInstalled && ext.tabs) {
  ext.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      const hostedWelcomeUrl = 'https://flakesecure.snowystudio.dev/welcome';
      const localWelcomeUrl = ext.runtime.getURL('welcome.html');
      try {
        const response = await fetch(hostedWelcomeUrl, { method: 'HEAD', cache: 'no-store' });
        if (response.ok) {
          ext.tabs.create({ url: hostedWelcomeUrl });
        } else {
          ext.tabs.create({ url: localWelcomeUrl });
        }
      } catch (e) {
        ext.tabs.create({ url: localWelcomeUrl });
      }
    }
  });
}
