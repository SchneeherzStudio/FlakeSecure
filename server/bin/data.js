/**
 * Standalone Data Service Runner
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createDataService } = require('../services/data/dataService');
const { globalLimiter } = require('../middleware/rateLimit');

const app = express();
const PORT = process.env.PORT_DATA || 4003;

app.use(helmet());
app.use(compression());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json({ limit: '5mb' })); // Allows large encrypted vaults
app.use(globalLimiter);

const dataService = createDataService();
app.use('/api', dataService.router);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FlakeSecure Standalone Data Service',
    uptime: Math.floor(process.uptime())
  });
});

app.listen(PORT, () => {
  console.log(`[Data Service] Running standalone on port ${PORT}`);
});
