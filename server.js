import express from 'express';
import path from 'path';
import { Pool } from 'pg';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import compression from 'compression';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { validate, schemas, validateQuery } from './src/utils/validation.js';
import Logger from './src/utils/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

Logger.info('🚀 Starting IP Threat Management System...');

// Security Configuration
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  Logger.error('JWT_SECRET environment variable is required');
  process.exit(1);
}

// Database connection with enhanced configuration
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 60000,
  statement_timeout: 30000,
  query_timeout: 30000,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    Logger.error('Database connection failed:', err.stack);
    process.exit(1);
  } else {
    Logger.info('✅ Connected to PostgreSQL database');
    release();
  }
});

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Slow down repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: 500, // add 500ms delay per request after delayAfter
});

// Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/api', limiter);
app.use(speedLimiter);

// General Middleware
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  Logger.http(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      Logger.warn(`Invalid token attempt from ${req.ip}`);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      Logger.warn(`Unauthorized access attempt by ${req.user?.username} (${req.user?.role}) to ${req.path}`);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  Logger.error(`Error in ${req.method} ${req.path}:`, err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Authentication Routes
app.post('/api/auth/login', validate(schemas.login), async (req, res) => {
  try {
    const { username, password } = req.body;
    
    Logger.info(`Login attempt for username: ${username}`);
    
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1) AND is_active = true',
      [username]
    );
    
    if (result.rows.length === 0) {
      Logger.warn(`Failed login attempt - user not found: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Use bcrypt to compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      Logger.warn(`Failed login attempt - invalid password for user: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );
    
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role,
        assignedCategories: user.assigned_categories 
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
    
    const { password: _, ...userResponse } = user;
    Logger.info(`Successful login for user: ${username}`);
    
    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    Logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User Routes
app.get('/api/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, role, is_active, assigned_categories, created_at, last_login FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    Logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', authenticateToken, requireRole(['admin']), validate(schemas.createUser), async (req, res) => {
  try {
    const { username, password, email, role, assignedCategories } = req.body;
    
    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const result = await pool.query(
      `INSERT INTO users (username, password, email, role, assigned_categories, is_active, created_at) 
       VALUES ($1, $2, $3, $4, $5, true, NOW()) 
       RETURNING id, username, email, role, is_active, assigned_categories, created_at`,
      [username, hashedPassword, email, role, assignedCategories]
    );
    
    Logger.info(`New user created: ${username} by ${req.user.username}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    Logger.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', authenticateToken, requireRole(['admin']), validate(schemas.updateUser), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic query
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    const result = await pool.query(
      `UPDATE users SET ${setClause}, updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, username, email, role, is_active, assigned_categories, created_at, updated_at`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    Logger.info(`User updated: ${result.rows[0].username} by ${req.user.username}`);
    res.json(result.rows[0]);
  } catch (error) {
    Logger.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent self-deletion
    if (id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING username', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    Logger.info(`User deleted: ${result.rows[0].username} by ${req.user.username}`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    Logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Password change endpoint
app.post('/api/auth/change-password', authenticateToken, validate(schemas.changePassword), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;
    
    // Get current user
    const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password
    await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedNewPassword, userId]
    );
    
    Logger.info(`Password changed for user: ${req.user.username}`);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    Logger.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Static file serving (production)
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handling
app.use(errorHandler);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  Logger.info(`Received ${signal}, shutting down gracefully`);
  
  server.close(() => {
    Logger.info('HTTP server closed');
    
    pool.end(() => {
      Logger.info('Database connection pool closed');
      process.exit(0);
    });
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    Logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

const server = app.listen(port, () => {
  Logger.info(`🚀 Server running on port ${port}`);
  Logger.info(`🌐 Application: http://localhost:${port}`);
  Logger.info(`📡 API: http://localhost:${port}/api`);
  Logger.info(`🔒 Security: Helmet, Rate Limiting, and CORS enabled`);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;