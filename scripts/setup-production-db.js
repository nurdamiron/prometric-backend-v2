#!/usr/bin/env node

/**
 * 🏗️ PRODUCTION DATABASE SETUP SCRIPT
 * Создает и настраивает базу данных для production
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const config = {
  host: 'prometric.cde42ec8m1u7.eu-north-1.rds.amazonaws.com',
  port: 5432,
  user: 'prometric',
  password: 'prometric01',
  database: 'postgres', // Connect to default database first
  ssl: { rejectUnauthorized: false }
};

async function setupProductionDB() {
  console.log('🚀 Setting up Production Database...\n');

  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Connected to AWS RDS');

    // Check if database exists
    const dbResult = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'prometric_new'"
    );

    if (dbResult.rows.length === 0) {
      console.log('📦 Creating database prometric_new...');
      await client.query('CREATE DATABASE prometric_new');
      console.log('✅ Database created');
    } else {
      console.log('✅ Database prometric_new already exists');
    }

    await client.end();

    // Connect to the new database
    const appClient = new Client({
      ...config,
      database: 'prometric_new'
    });

    await appClient.connect();
    console.log('✅ Connected to prometric_new database');

    // Check if tables exist
    const tablesResult = await appClient.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);

    console.log('📊 Existing tables:', tablesResult.rows.map(r => r.table_name));

    // Check if users table exists
    const usersExists = tablesResult.rows.some(r => r.table_name === 'users');

    if (!usersExists) {
      console.log('🏗️ Creating users table...');
      await appClient.query(`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          phone VARCHAR(20) NULL,
          role VARCHAR(20) DEFAULT 'employee',
          status VARCHAR(20) DEFAULT 'pending',
          organization_id UUID NULL,
          onboarding_step VARCHAR(50) DEFAULT 'email_verification',
          verification_code VARCHAR(6) NULL,
          verification_expires_at TIMESTAMP NULL,
          registration_data JSONB NULL,
          ai_config JSONB NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Users table created');
    }

    // Check if organizations table exists
    const orgsExists = tablesResult.rows.some(r => r.table_name === 'organizations');

    if (!orgsExists) {
      console.log('🏢 Creating organizations table...');
      await appClient.query(`
        CREATE TABLE organizations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          bin VARCHAR(12) UNIQUE NOT NULL,
          industry VARCHAR(100) NOT NULL,
          owner_id UUID NOT NULL,
          ai_brain JSONB NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Organizations table created');
    }

    // Run session management migration
    console.log('🔐 Adding session management fields...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../database/migrations/001_session_management.sql'),
      'utf8'
    );

    await appClient.query(migrationSQL);
    console.log('✅ Session management migration completed');

    // Verify all tables exist
    const finalTables = await appClient.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('\n📊 Final database structure:');
    finalTables.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

    await appClient.end();
    console.log('\n🎉 Production database setup completed!');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('🔍 Details:', error);
    process.exit(1);
  }
}

// Run setup
setupProductionDB().catch(console.error);