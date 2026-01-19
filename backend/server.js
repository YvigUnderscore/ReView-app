require('dotenv').config();
require('./utils/bigint-patch'); // Apply BigInt JSON serialization patch
const express = require('express');
console.log('[DEBUG] server.js starting...');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { init: initSocket, getIo } = require('./services/socketService');
const { runCleanup } = require('./services/cleanupService');
const { initEmailService } = require('./services/emailService');
const { initCron } = require('./services/cronService');
const { initSystemStats } = require('./services/systemStatsService');
const { rateLimit } = require('./utils/rateLimiter');

// Ensure storage directory exists
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'storage');
if (!fs.existsSync(DATA_PATH)) {
  fs.mkdirSync(DATA_PATH, { recursive: true });
}

// Routes
const authRoutes = require('./auth.routes');
const projectRoutes = require('./project.routes');
const inviteRoutes = require('./invite.routes');
const teamRoutes = require('./team.routes');
const adminRoutes = require('./admin.routes');
const clientRoutes = require('./client.routes');
const settingsRoutes = require('./settings.routes');
const roleRoutes = require('./role.routes');
const notificationRoutes = require('./notification.routes');
const userRoutes = require('./user.routes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.io
const io = initSocket(server);

// Initialize Email Service
initEmailService();

// Initialize Cron Jobs
initCron();

// Initialize System Stats
initSystemStats(io);

// Run Cleanup (every hour)
runCleanup();
setInterval(runCleanup, 60 * 60 * 1000);

// Middleware
app.set('trust proxy', 1); // Trust first proxy (Nginx) for Rate Limiting
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());

// Limit JSON body size:
// - Increase limit for project routes (comments with screenshots) and client routes
app.use(['/api/projects', '/api/client'], express.json({ limit: '10mb' }));
app.use(['/api/projects', '/api/client'], express.urlencoded({ extended: true, limit: '10mb' }));

// - Default strict limit for everything else (e.g. auth, admin) to prevent DoS
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Static files (uploaded media)
app.use('/api/media', express.static(path.join(DATA_PATH, 'media')));
app.use('/api/thumbnails', express.static(path.join(DATA_PATH, 'thumbnails')));
app.use('/api/media/avatars', express.static(path.join(DATA_PATH, 'avatars')));
app.use('/api/media/system', express.static(path.join(DATA_PATH, 'system')));

// Global API Rate Limit: 300 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

// Apply global rate limit to all /api routes
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/teams/:teamId/roles', roleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin/settings', settingsRoutes); // For admin updates
app.use('/api/system', settingsRoutes); // For public config

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  console.log(`[DEBUG] Attempting to listen on port ${PORT}...`);
  server.listen(PORT, () => {
    console.info(`Server running on port ${PORT}`);
  });
}

module.exports = app;
