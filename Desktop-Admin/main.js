/**
 * ============================================================================
 * FlakeSecure Desktop Admin - Electron Main Process v2.0
 * ============================================================================
 * 
 * Cross-platform desktop management application for FlakeSecure.
 * Supports Windows and Linux desktop environments.
 * ============================================================================
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Set Application User Model ID for Windows notification toasts & taskbar grouping
if (process.platform === 'win32') {
  app.setAppUserModelId('dev.snowystudio.flakesecure.admin');
}

let mainWindow = null;
const configPath = path.join(app.getPath('userData'), 'admin-config.json');

// Default configuration
const defaultConfig = {
  serverUrl: 'https://flakesecure.snowystudio.dev',
  adminSecret: '',
  autoRefresh: true,
  refreshInterval: 10
};

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      return { ...defaultConfig, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('[Main] Failed to load config:', err.message);
  }
  return { ...defaultConfig };
}

function saveConfig(newConfig) {
  try {
    const current = loadConfig();
    const updated = { ...current, ...newConfig };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
    return { success: true, config: updated };
  } catch (err) {
    console.error('[Main] Failed to save config:', err.message);
    return { success: false, error: err.message };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: '#090b14',
    title: 'FlakeSecure Admin Dashboard',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Remove default menu bar for clean modern appearance
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open target links externally
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Config management
ipcMain.handle('config:get', async () => {
  return loadConfig();
});

ipcMain.handle('config:save', async (_, newConfig) => {
  return saveConfig(newConfig);
});

// Universal API request handler (runs in main process to avoid CORS)
ipcMain.handle('api:request', async (_, { endpoint, method = 'GET', body = null }) => {
  const config = loadConfig();
  const base = (config.serverUrl || 'https://flakesecure.snowystudio.dev').replace(/\/+$/, '');
  const url = `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = {
    'Accept': 'application/json'
  };

  if (config.adminSecret) {
    headers['x-admin-secret'] = config.adminSecret;
  }

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    headers['Content-Type'] = 'application/json';
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const startTime = Date.now();
  try {
    const response = await fetch(url, options);
    const latency = Date.now() - startTime;
    const text = await response.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = text;
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
      latency
    };
  } catch (err) {
    const latency = Date.now() - startTime;
    return {
      ok: false,
      status: 0,
      statusText: 'Network Error',
      error: err.message,
      latency
    };
  }
});

// Shell open external link
ipcMain.handle('system:open-external', async (_, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
