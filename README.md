# IP Threat Management System

A comprehensive, secure IP threat intelligence management system built with React, TypeScript, Node.js, and PostgreSQL.

## 🚀 Features

### Security Features
- ✅ **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- ✅ **Rate Limiting**: Configurable rate limiting for API endpoints
- ✅ **Input Validation**: Comprehensive input validation using Joi
- ✅ **Security Headers**: Helmet.js for security headers
- ✅ **Role-Based Access Control**: Admin, user, and readonly roles
- ✅ **Audit Logging**: Complete audit trail for all actions
- ✅ **Environment-based Configuration**: Secure configuration management

### Core Features
- 📊 **IP Management**: Add, categorize, and manage IP addresses
- 🔍 **Threat Intelligence**: Integration with AbuseIPDB and VirusTotal
- 📋 **Whitelist Management**: Maintain IP whitelists with expiration
- 🏷️ **Category Management**: Organize IPs by custom categories
- 📤 **EDL Feeds**: Export threat feeds in various formats
- 👥 **User Management**: Multi-user support with role-based permissions
- 📈 **Dashboard**: Real-time statistics and monitoring

## 🛡️ Security Improvements Made

### Critical Security Fixes
1. **Password Security**: Replaced plain text passwords with bcrypt hashing
2. **JWT Security**: Removed fallback secrets, enforced strong JWT secrets
3. **Input Validation**: Added comprehensive validation for all inputs
4. **Rate Limiting**: Implemented rate limiting to prevent abuse
5. **Security Headers**: Added Helmet.js for security headers
6. **CORS Configuration**: Proper CORS configuration with allowed origins
7. **Error Handling**: Secure error handling without information disclosure
8. **Logging**: Replaced console.log with structured logging

### Architecture Improvements
1. **Environment Configuration**: Centralized, secure configuration management
2. **API Service Layer**: Centralized API calls with error handling
3. **TypeScript**: Strict TypeScript configuration for better type safety
4. **Code Organization**: Modular structure with utilities and services
5. **Database Security**: Parameterized queries, connection pooling
6. **Graceful Shutdown**: Proper server shutdown handling

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- npm or yarn

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd ip-threat-management-system
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 3. Database Setup

```bash
# Create database
createdb ip_threat_management

# Run migrations (this will hash existing passwords)
node scripts/migrate-passwords.js
```

### 4. Generate JWT Secret

```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the generated secret to your `.env` file as `JWT_SECRET`.

### 5. Start Development

```bash
# Start both frontend and backend
npm run start:dev

# Or start separately
npm run start:backend  # Backend on :3000
npm run dev           # Frontend on :5173
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | No |
| `PORT` | Server port | `3000` | No |
| `DB_HOST` | Database host | `localhost` | Yes |
| `DB_PORT` | Database port | `5432` | No |
| `DB_NAME` | Database name | `postgres` | Yes |
| `DB_USER` | Database user | `postgres` | Yes |
| `DB_PASSWORD` | Database password | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | **Yes** |
| `JWT_EXPIRES_IN` | JWT expiration | `8h` | No |
| `ALLOWED_ORIGINS` | CORS origins | `http://localhost:5173` | No |

### Security Configuration

The system includes several security configurations:

- **Rate Limiting**: 100 requests per 15 minutes (configurable)
- **Auth Rate Limiting**: 5 login attempts per 15 minutes
- **Password Policy**: Minimum 8 characters with complexity requirements
- **JWT Expiration**: Configurable token expiration
- **CORS**: Configurable allowed origins

## 🏗️ Architecture

```
src/
├── components/          # React components
├── contexts/           # React contexts (Auth, Category, IP)
├── services/           # API service layer
├── utils/              # Utility functions
│   ├── logger.ts       # Structured logging
│   └── validation.ts   # Input validation
├── config/             # Configuration management
├── types/              # TypeScript type definitions
└── main.tsx           # Application entry point

server.js              # Express server with security
scripts/
└── migrate-passwords.js # Database migration script
```

## 🔐 Security Best Practices

### For Deployment

1. **Environment Variables**
   - Use strong, unique JWT secrets (32+ characters)
   - Use environment-specific database credentials
   - Set `NODE_ENV=production` in production

2. **Database Security**
   - Use SSL connections in production
   - Implement database user with minimal privileges
   - Regular backups and monitoring

3. **Network Security**
   - Use HTTPS in production
   - Configure firewall rules
   - Implement reverse proxy (nginx/Apache)

4. **Monitoring**
   - Monitor failed login attempts
   - Set up log aggregation
   - Implement alerting for suspicious activities

### Password Migration

If upgrading from an older version with plain text passwords:

```bash
# Run the migration script
node scripts/migrate-passwords.js
```

This script will:
- Check all user passwords
- Hash plain text passwords using bcrypt
- Update database schema with security improvements
- Add audit logging capabilities

## 📊 API Documentation

### Authentication

```bash
# Login
POST /api/auth/login
{
  "username": "admin",
  "password": "secure_password"
}

# Change Password
POST /api/auth/change-password
Authorization: Bearer <token>
{
  "currentPassword": "old_password",
  "newPassword": "new_secure_password"
}
```

### Rate Limits

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 requests per 15 minutes
- **Rate limit headers** included in responses

## 🧪 Testing

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check

# Security audit
npm run security:audit
```

## 📦 Building for Production

```bash
# Build frontend
npm run build

# Start production server
NODE_ENV=production npm start
```

## 🚀 Deployment Options

### Docker (Recommended)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit
```

## 🔍 Monitoring and Logging

The system includes comprehensive logging:

- **Structured Logging**: Winston-based logging with levels
- **Request Logging**: All HTTP requests logged
- **Security Events**: Failed logins, rate limit violations
- **Audit Trail**: All user actions logged to database

### Log Levels
- `error`: System errors, security violations
- `warn`: Security warnings, validation failures  
- `info`: General application info, successful operations
- `http`: HTTP request/response logging
- `debug`: Detailed debugging information

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run security audit: `npm run security:audit`
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## ⚠️ Security Notice

This system handles sensitive threat intelligence data. Please ensure:

- Regular security updates
- Secure deployment practices  
- Strong authentication policies
- Regular security audits
- Proper access controls

For security issues, please contact the maintainers directly rather than opening public issues.
