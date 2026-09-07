/**
 * Standalone Relay Service Runner
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const http = require('http');
const cors = require('cors');
const { createRelayService } = require('../services/relay/relayService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT_RELAY || 4001;

app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '2mb' }));

const relayService = createRelayService();
relayService.attachSocketIO(server, { origin: '*', methods: ['GET', 'POST'] });

app.use('/', relayService.router);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FlakeSecure Standalone Relay Service',
    uptime: Math.floor(process.uptime()),
    activeSessions: relayService.activeSessions.size
  });
});

server.listen(PORT, () => {
  console.log(`[Relay Service] Running standalone on port ${PORT}`);
});
