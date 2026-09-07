/**
 * Standalone Auth Service Runner
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createAuthService } = require('../services/auth/authService');
const { globalLimiter } = require('../middleware/rateLimit');

const app = express();
const PORT = process.env.PORT_AUTH || 4002;

app.use(helmet());
app.use(compression());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json({ limit: '2mb' }));
app.use(globalLimiter);

const authService = createAuthService();
app.use('/api', authService.router);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FlakeSecure Standalone Auth Service',
    uptime: Math.floor(process.uptime())
  });
});

app.listen(PORT, () => {
  console.log(`[Auth Service] Running standalone on port ${PORT}`);
});
