/**
 * ============================================================================
 * FlakeSecure Server - Database Migration & Schema Update Script v2.0.0
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
const { pool } = require('./db');

async function migrate() {
  console.log('[FlakeSecure Migration] Connecting to PostgreSQL database:', process.env.PGDATABASE || 'flakesecure');
  
  const schemaPath = path.join(__dirname, 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    const client = await pool.connect();
    console.log('[FlakeSecure Migration] Connected successfully. Applying schema updates...');
    
    await client.query(sql);
    client.release();
    
    console.log('[FlakeSecure Migration] ✅ Database successfully updated to v2.0.0 schema!');
  } catch (err) {
    console.error('[FlakeSecure Migration] ❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
