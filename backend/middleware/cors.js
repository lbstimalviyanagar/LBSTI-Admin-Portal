const cors = require('cors');
const config = require('../config/env');

const allowedOrigins = (config.frontendUrl || '').split(',').map((origin) => origin.trim().replace(/\/+$/, '')).filter(Boolean);
if (config.nodeEnv !== 'production') allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    const error = new Error('Origin is not allowed by CORS.');
    error.status = 403;
    return callback(error);
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

module.exports = cors(corsOptions);
