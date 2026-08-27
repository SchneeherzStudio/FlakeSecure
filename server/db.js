/**
 * ============================================================================
 * FlakeSecure Server - PostgreSQL Database Connection Pool
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. DATABASE POOL INITIALIZATION:
 *    - Configures the PostgreSQL connection pool using environment variables (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD).
 *    - Handles unexpected idle client errors gracefully.
 * 
 * 2. EXPORTED METHODS:
 *    - pool: Direct access to the pg.Pool instance.
 *    - query(text, params): Helper function to execute parameterized SQL queries.
 * ============================================================================
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
};
