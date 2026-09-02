/**
 * ============================================================================
 * FlakeSecure - Firefox MV3 Background Script (Persistent & Keepalive) v2.1
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. PERSISTENT KEEPALIVE & LIFECYCLE MANAGEMENT:
 *    - Alarms-based heartbeat: browser.alarms wakes and keeps the background context active.
 *    - Port-based bidirectional bridge: Content scripts connect via long-lived Ports, preventing Firefox MV3 from idling out.
 *    - Periodic keepalive timer: Regularly verifies active sessions and socket health.
 * 
 * 2. SOCKET.IO CONNECTION MANAGEMENT:
 *    - Establishes and maintains Socket.IO connections to the relay server (SERVER_URL).
 *    - Automatically joins session rooms (join-session).
 *    - Auto-reconnects if connection drops unexpectedly during an active session.
 * 
 * 3. EVENT RELAYING TO TABS & PORTS:
 *    - Dispatches LOGIN_DATA, TOTP_DATA, SESSION_EXPIRED, SOCKET_CONNECTED, and SOCKET_ERROR.
 * ============================================================================
 */

const SERVER_URL = 'https://flakesecure.snowystudio.dev';
let socket = null;
let activePorts = new Set();
let currentSession = null;

// 1. Alarms API keepalive setup (fires periodically to prevent background script suspension)
try {
  if (typeof browser !== 'undefined' && browser.alarms) {
    browser.alarms.create('fs-keepalive-alarm', { periodInMinutes: 0.4 });
    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'fs-keepalive-alarm') {
        // Heartbeat tick keeps the service worker/background context alive
        if (activePorts.size > 0 && currentSession && (!socket || !socket.connected)) {
          console.log('[FlakeSecure Background] Alarm tick - reconnecting dropped socket for active session');
          initSocket(currentSession.sessionId, currentSession.token, currentSession.domain);
        }
      }
    });
  }
} catch (e) {
  console.log('[FlakeSecure Background] Alarms initialization note:', e.message);
}

// 2. Internal keepalive interval
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

function initSocket(sessionId, token, domain) {
  currentSession = { sessionId, token, domain };

  if (socket) {
    try {
      socket.disconnect();
    } catch (e) {}
    socket = null;
  }

  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 15000
  });

  socket.on('connect', () => {
    console.log('[FlakeSecure Background] Connected to relay server');
    socket.emit('join-session', { sid: sessionId, token: token, domain: domain });
    broadcastToPorts({ type: 'SOCKET_CONNECTED' });
  });

  socket.on('login-data', (payload) => {
    console.log('[FlakeSecure Background] Received login data from mobile app');
    broadcastToPorts({ type: 'LOGIN_DATA', payload });
  });

  socket.on('totp-data', (payload) => {
    console.log('[FlakeSecure Background] Received TOTP data');
    broadcastToPorts({ type: 'TOTP_DATA', payload });
  });

  socket.on('session-expired', () => {
    console.log('[FlakeSecure Background] Session expired');
    broadcastToPorts({ type: 'SESSION_EXPIRED' });
  });

  socket.on('disconnect', () => {
    console.log('[FlakeSecure Background] Disconnected from relay server');
    broadcastToPorts({ type: 'SOCKET_DISCONNECTED' });
  });

  socket.on('connect_error', (err) => {
    console.error('[FlakeSecure Background] Connection error:', err.message);
    broadcastToPorts({ type: 'SOCKET_ERROR', message: err.message });
  });
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

// 3. Port-based persistent connection for content scripts
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onConnect) {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === 'fs-socket-port') {
      activePorts.add(port);
      console.log('[FlakeSecure Background] Port connected. Total active ports:', activePorts.size);

      port.onMessage.addListener((msg) => {
        if (msg.type === 'CONNECT') {
          console.log('[FlakeSecure Background] CONNECT message received via Port');
          initSocket(msg.sessionId, msg.token, msg.domain);
        } else if (msg.type === 'PING') {
          // Acknowledge PING to keep port channel active
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
        console.log('[FlakeSecure Background] Port disconnected. Remaining active ports:', activePorts.size);
        if (activePorts.size === 0) {
          closeSocket();
        }
      });
    }
  });
}

// 4. One-shot runtime.onMessage listener (backwards compatibility)
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'CONNECT') {
      const { sessionId, token, domain } = message;
      initSocket(sessionId, token, domain);
    } else if (message.type === 'DISCONNECT') {
      if (activePorts.size === 0) {
        closeSocket();
      }
    }
  });
}
