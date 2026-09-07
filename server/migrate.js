/**
 * ============================================================================
 * FlakeSecure Server - Database Migration & Schema Update Script v2.0.1
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 1. Reads server/db/schema.sql.
 * 2. Connects to PostgreSQL using credentials configured in server/.env.
 * 3. Executes the full schema idempotently (creates missing tables, adds missing columns).
 * 4. Logs success and closes database connection pool.
 * ============================================================================
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { pool } = require('./db');

async function ensureDatabaseExists() {
  const targetDb = process.env.PGDATABASE || 'flakesecure';
  const defaultPool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: 'postgres',
  });

  try {
    const res = await defaultPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);
    if (res.rowCount === 0) {
      console.log(`[FlakeSecure Migration] Database "${targetDb}" does not exist. Creating it...`);
      await defaultPool.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`[FlakeSecure Migration] Database "${targetDb}" created successfully.`);
    }
  } catch (err) {
    console.warn('[FlakeSecure Migration] Note on database check:', err.message);
  } finally {
    await defaultPool.end();
  }
}

async function migrate() {
  await ensureDatabaseExists();

  console.log('[FlakeSecure Migration] Connecting to PostgreSQL database:', process.env.PGDATABASE || 'flakesecure');
  
  const schemaPath = path.join(__dirname, 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    const client = await pool.connect();
    console.log('[FlakeSecure Migration] Connected successfully. Applying schema updates...');
    
    await client.query(sql);
    client.release();
    
    console.log('[FlakeSecure Migration] [OK] Database successfully updated to schema!');
  } catch (err) {
    console.error('[FlakeSecure Migration] [ERROR] Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
