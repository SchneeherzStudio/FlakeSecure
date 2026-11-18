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
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
    console.warn(
        '[DB Pool] Idle client connection closed (will reconnect automatically):',
        err.code || '',
        err.message
    );
});

const TRANSIENT_PG_CODES = new Set([
    '57P01',
    '57P02',
    '57P03',
    '08000',
    '08003',
    '08006',
    'ECONNRESET',
    'EPIPE',
    'ETIMEDOUT',
]);

function isTransientDbError(err) {
    if (!err) return false;
    if (err.code && TRANSIENT_PG_CODES.has(err.code)) return true;
    const msg = String(err.message || '');
    return msg.includes('terminating connection') || msg.includes('Connection terminated');
}

async function query(text, params) {
    const maxRetries = 2;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await pool.query(text, params);
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries && isTransientDbError(err)) {
                console.warn(
                    `[DB Pool] Transient query error (${err.code || err.message}), retrying (${attempt + 1}/${maxRetries})...`
                );
                await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
                continue;
            }
            throw err;
        }
    }
    throw lastError;
}

module.exports = {
    pool,
    query,
};
