const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env if available
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || '',
  authSecret: process.env.AUTH_SECRET || '',
  
  // Database configuration
  databaseUrl: process.env.DATABASE_URL || '',
  mysqlUrl: process.env.MYSQL_URL || (/^mysql:\/\//i.test(process.env.DATABASE_URL || '') ? process.env.DATABASE_URL : ''),
  dbHost: process.env.DATABASE_HOST || process.env.DB_HOST || '',
  dbPort: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '3306', 10),
  dbUser: process.env.DATABASE_USER || process.env.DB_USER || '',
  dbPassword: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || '',
  dbName: process.env.DATABASE_NAME || process.env.DB_NAME || '',
  sqlitePath: process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'lbstimn.db'),

  // Optional one-time bootstrap account; never populated with demo credentials.
  defaultAdmin: {
    username: process.env.DEFAULT_ADMIN_USERNAME || '',
    password: process.env.DEFAULT_ADMIN_PASSWORD || '',
    fullName: process.env.DEFAULT_ADMIN_NAME || '',
    role: 'admin'
  },
  defaultCounselor: {
    username: process.env.DEFAULT_COUNSELLOR_USERNAME || '',
    password: process.env.DEFAULT_COUNSELLOR_PASSWORD || '',
    fullName: process.env.DEFAULT_COUNSELLOR_NAME || '',
    role: 'counselor'
  },
  defaultUser: {
    username: process.env.DEFAULT_USER_USERNAME || '',
    password: process.env.DEFAULT_USER_PASSWORD || '',
    fullName: process.env.DEFAULT_USER_NAME || '',
    role: 'user'
  }
};

module.exports = config;
