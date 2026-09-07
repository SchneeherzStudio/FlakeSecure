/**
 * ============================================================================
 * FlakeSecure Data Service
 * ============================================================================
 * Handles database operations for zero-knowledge vault synchronization,
 * user account data & restrictions, activity logs, push tokens,
 * announcements, system status, and administrative telemetry/backups.
 */

const express = require('express');
const vaultRoutes = require('../../routes/vault');
const accountRoutes = require('../../routes/account');
const logsRoutes = require('../../routes/logs');
const systemRoutes = require('../../routes/system');
const { router: notificationRoutes } = require('../../routes/notifications');
const shareRoutes = require('../../routes/share');
const { router: adminRoutes } = require('../../routes/admin');
const { relayLimiter } = require('../../middleware/rateLimit');

function createDataService() {
  const router = express.Router();

  router.use('/vault', vaultRoutes);
  router.use('/account', accountRoutes);
  router.use('/logs', logsRoutes);
  router.use('/system', systemRoutes);
  router.use('/notifications', notificationRoutes);
  router.use('/share', relayLimiter, shareRoutes);
  router.use('/admin', adminRoutes);

  return { router };
}

module.exports = { createDataService };
