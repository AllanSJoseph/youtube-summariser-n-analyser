/**
 * Applies schema.sql against the DATABASE_URL.
 * Run once: `npm run migrate`
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pool from './client';

async function migrate() {
  // schema.sql lives alongside this file in src/db/
  const schemaPath = path.resolve('src', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    console.log('Running migration…');
    await client.query(sql);
    console.log('Migration complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
