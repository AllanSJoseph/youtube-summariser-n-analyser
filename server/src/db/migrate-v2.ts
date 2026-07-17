/**
 * One-time migration: change embedding column from VECTOR(768) to VECTOR(3072)
 * to match gemini-embedding-001's output dimension.
 *
 * Run once: npm run migrate:v2
 *
 * Safe to re-run — IF NOT EXISTS / column-type check guards are included.
 */
import 'dotenv/config';
import pool from './client';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Checking current embedding column type…');

    const { rows } = await client.query<{ data_type: string; udt_name: string }>(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'video_embeddings' AND column_name = 'embedding'
    `);

    if (rows.length === 0) {
      console.log('video_embeddings table not found — run npm run migrate first.');
      return;
    }

    // Truncate existing embeddings (they were generated with the old model — unusable)
    console.log('Dropping stale embeddings (wrong dimensions)…');
    await client.query('TRUNCATE TABLE video_embeddings');

    // Alter the column type
    console.log('Altering embedding column to VECTOR(3072)…');
    await client.query(`
      ALTER TABLE video_embeddings
        ALTER COLUMN embedding TYPE VECTOR(3072)
        USING embedding::text::vector(3072)
    `);

    // Also update the CHECK constraint for the status column (adds 'failed')
    console.log('Updating videos status constraint…');
    await client.query(`ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_status_check`);
    await client.query(`
      ALTER TABLE videos ADD CONSTRAINT videos_status_check
        CHECK (status IN ('ready', 'processing', 'no_captions', 'failed'))
    `);

    // Reset any stuck-processing rows
    const { rowCount } = await client.query(
      `UPDATE videos SET status = 'failed' WHERE status = 'processing'`
    );
    console.log(`Reset ${rowCount} stuck-processing video(s) to 'failed'.`);

    console.log('Migration v2 complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration v2 failed:', err);
  process.exit(1);
});
