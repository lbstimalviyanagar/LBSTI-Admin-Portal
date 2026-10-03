const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const config = require('./config/env');
const corsMiddleware = require('./middleware/cors');
const errorHandler = require('./middleware/errorHandler');
const db = require('./models/db');

// Route imports
const authRoutes = require('./routes/authRoutes');
const enquiryRoutes = require('./routes/enquiryRoutes');
const feeRoutes = require('./routes/feeRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

if (!config.authSecret && config.nodeEnv !== 'production') {
  config.authSecret = crypto.randomBytes(48).toString('base64url');
  console.warn('[AUTH] Using an ephemeral development signing key; sessions reset after restart.');
}
if (!config.authSecret || config.authSecret.length < 32) {
  throw new Error('Set AUTH_SECRET to a unique value of at least 32 characters.');
}

// Security & Parsing Middleware
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(corsMiddleware);
app.options('*', corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
  });
}

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'LBSTIMN Admissions CRM Backend is running',
    timestamp: new Date().toISOString(),
    database: db.getDbType(),
    environment: config.nodeEnv
  });
});

// API Routes
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth', authRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/users', userRoutes);

// Optional: Serve frontend static build if frontend/dist exists
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ ok: false, message: `API endpoint '${req.path}' not found` });
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      ok: true,
      service: 'LBSTIMN Admissions CRM API',
      health: '/api/health',
      docs: 'API is ready to receive requests from React frontend.'
    });
  });
}

// Global Error Handler
app.use(errorHandler);

// Start Server after Database Initialization
async function startServer() {
  try {
    await db.initDb();
    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`LBSTIMN API listening on port ${config.port}; use the public URL assigned by the hosting provider.`);
      console.log(`📡 Environment: ${config.nodeEnv}`);
      console.log(`🗄️ Database: ${db.getDbType()}`);
      console.log(`====================================================`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down server gracefully...');
      server.close(async () => {
        try {
          const client = db.getClient();
          if (client && client.close) await client.close();
        } catch (e) {
          console.error(e);
        }
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
