import { Pool } from 'pg';

// Neon (and most managed Postgres providers) use a real CA-signed TLS cert.
// When the connection string already contains ?sslmode=require, pg respects it.
// We only need to add the ssl object when DATABASE_SSL=true AND the URL doesn't
// already carry sslmode — so we detect and avoid double-configuring SSL.
const dbUrl = process.env.DATABASE_URL ?? '';
const urlHasSsl = dbUrl.includes('sslmode=');
const sslEnv = process.env.DATABASE_SSL;

function getSslConfig(): boolean | { rejectUnauthorized: boolean } {
  // Explicit opt-out for local dev
  if (sslEnv === 'false') return false;
  // If the URL already declares sslmode (e.g. Neon), let pg handle it via the URL
  if (urlHasSsl) return true;
  // Explicit opt-in without URL param (e.g. plain cloud Postgres)
  if (sslEnv === 'true') return { rejectUnauthorized: true };
  // Default: no SSL (local dev without flag)
  return false;
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: getSslConfig(),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

export default pool;
