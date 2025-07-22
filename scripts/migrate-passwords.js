#!/usr/bin/env node

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migratePasswords() {
  console.log('🔄 Starting password migration...');
  
  try {
    // Get all users with potentially plain text passwords
    const result = await pool.query('SELECT id, username, password FROM users');
    
    console.log(`📊 Found ${result.rows.length} users to check`);
    
    let migratedCount = 0;
    
    for (const user of result.rows) {
      // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
        console.log(`✅ User ${user.username}: Password already hashed`);
        continue;
      }
      
      // Hash the plain text password
      console.log(`🔐 Hashing password for user: ${user.username}`);
      const hashedPassword = await bcrypt.hash(user.password, 12);
      
      // Update the user's password
      await pool.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, user.id]
      );
      
      migratedCount++;
      console.log(`✅ User ${user.username}: Password migrated successfully`);
    }
    
    console.log(`\n🎉 Migration completed successfully!`);
    console.log(`📈 Total users migrated: ${migratedCount}`);
    console.log(`📈 Total users checked: ${result.rows.length}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Add database schema improvements
async function updateSchema() {
  console.log('🔄 Updating database schema...');
  
  try {
    // Add missing columns if they don't exist
    const schemaUpdates = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP`,
      
      // Create indexes for better performance
      `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
      `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
      `CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)`,
      
      // Add audit trail table
      `CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(100),
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      
      `CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)`,
    ];
    
    for (const query of schemaUpdates) {
      try {
        await pool.query(query);
        console.log(`✅ Schema update executed: ${query.substring(0, 50)}...`);
      } catch (error) {
        if (error.code !== '42701') { // Ignore "column already exists" errors
          console.warn(`⚠️  Schema update warning: ${error.message}`);
        }
      }
    }
    
    console.log('✅ Schema updates completed');
    
  } catch (error) {
    console.error('❌ Schema update failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting database migration and schema update...\n');
  
  try {
    await updateSchema();
    await migratePasswords();
    
    console.log('\n🎉 All migrations completed successfully!');
    console.log('\n⚠️  IMPORTANT: Please update your .env file with a secure JWT_SECRET');
    console.log('💡 Generate a secure JWT secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}