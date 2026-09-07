/**
 * ============================================================================
 * FlakeSecure Desktop Admin - Preload Script
 * ============================================================================
 * 
 * Secure Context Bridge between Electron Main Process and Renderer UI.
 * ============================================================================
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adminAPI', {
  // Configuration
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),

  // Generic API request
  request: (options) => ipcRenderer.invoke('api:request', options),

  // Specific FlakeSecure API helpers
  getStatus: () => ipcRenderer.invoke('api:request', {
    endpoint: '/api/system/status',
    method: 'GET'
  }),

  getHealth: () => ipcRenderer.invoke('api:request', {
    endpoint: '/health',
    method: 'GET'
  }),

  getAnnouncements: () => ipcRenderer.invoke('api:request', {
    endpoint: '/api/system/announcements',
    method: 'GET'
  }),

  createAnnouncement: (payload) => ipcRenderer.invoke('api:request', {
    endpoint: '/api/system/announcement',
    method: 'POST',
    body: payload
  }),

  updateAnnouncement: (id, payload) => ipcRenderer.invoke('api:request', {
    endpoint: `/api/system/announcement/${encodeURIComponent(id)}`,
    method: 'PUT',
    body: payload
  }),

  deleteAnnouncement: (id) => ipcRenderer.invoke('api:request', {
    endpoint: `/api/system/announcement/${encodeURIComponent(id)}`,
    method: 'DELETE'
  }),

  setMaintenance: (payload) => ipcRenderer.invoke('api:request', {
    endpoint: '/api/system/maintenance',
    method: 'POST',
    body: payload
  }),

  // External Links
  openExternal: (url) => ipcRenderer.invoke('system:open-external', url)
});
