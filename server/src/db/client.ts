import { Pool } from 'pg';

// Neon (and most managed Postgres providers) use a real CA-signed TLS cert.
// rejectUnauthorized: true is correct and secure — do NOT set it to false.
// In development against a local Postgres (no SSL), set DATABASE_SSL=false.
const useSsl = process.env.DATABASE_SSL !== 'false';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: true } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

export default pool;
