/**
 * ============================================================================
 * FlakeSecure - Firefox MV3 Background Script
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. SOCKET.IO CONNECTION MANAGEMENT:
 *    - Listens for CONNECT messages from content scripts.
 *    - Establishes a Socket.IO connection to the relay server (SERVER_URL) and joins the session room (join-session).
 * 
 * 2. EVENT RELAYING TO TABS:
 *    - SOCKET_CONNECTED: Notifies the active content script of successful server connection.
 *    - LOGIN_DATA: Forwards the encrypted data payload from the mobile app directly to the tab for local decryption.
 *    - SESSION_EXPIRED / SOCKET_DISCONNECTED / SOCKET_ERROR: Notifies the tab of session expiry or connection issues.
 *    - DISCONNECT: Closes the socket connection when the overlay is closed.
 * ============================================================================
 */

const SERVER_URL = 'https://flakesecure.snowystudio.dev';
let socket = null;

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'CONNECT') {
    const { sessionId, token } = message;
    
    if (socket) {
      socket.disconnect();
    }

    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000
    });

    socket.on('connect', () => {
      console.log('[FlakeSecure Background] Connected to relay server');
      socket.emit('join-session', { sid: sessionId, token: token, domain: message.domain });
      if (sender.tab && sender.tab.id) {
        browser.tabs.sendMessage(sender.tab.id, { type: 'SOCKET_CONNECTED' }).catch(() => {});
      }
    });

    socket.on('login-data', (payload) => {
      console.log('[FlakeSecure Background] Received login data');
      if (sender.tab && sender.tab.id) {
        browser.tabs.sendMessage(sender.tab.id, { type: 'LOGIN_DATA', payload }).catch(() => {});
      }
    });

    socket.on('totp-data', (payload) => {
      console.log('[FlakeSecure Background] Received TOTP data');
      if (sender.tab && sender.tab.id) {
        browser.tabs.sendMessage(sender.tab.id, { type: 'TOTP_DATA', payload }).catch(() => {});
      }
    });

    socket.on('session-expired', () => {
      console.log('[FlakeSecure Background] Session expired');
      if (sender.tab && sender.tab.id) {
        browser.tabs.sendMessage(sender.tab.id, { type: 'SESSION_EXPIRED' }).catch(() => {});
      }
    });

    socket.on('disconnect', () => {
      console.log('[FlakeSecure Background] Disconnected from relay server');
      if (sender.tab && sender.tab.id) {
        browser.tabs.sendMessage(sender.tab.id, { type: 'SOCKET_DISCONNECTED' }).catch(() => {});
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[FlakeSecure Background] Connection error:', err.message);
      if (sender.tab && sender.tab.id) {
        browser.tabs.sendMessage(sender.tab.id, { type: 'SOCKET_ERROR', message: err.message }).catch(() => {});
      }
    });
  } else if (message.type === 'DISCONNECT') {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }
});
