// Local, idempotent cleanup of the manifest captured by the Studio reset migration.
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
const local = JSON.parse(
  execFileSync(
    process.execPath,
    ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  )
);
if (!['localhost', '127.0.0.1'].includes(new URL(local.API_URL).hostname))
  throw new Error('Local Supabase required');
const sql = postgres(local.DB_URL),
  client = createClient(local.API_URL, local.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
try {
  const manifest = await sql`select * from studio_reset_storage_manifest where removed_at is null`;
  for (const row of manifest) {
    const { error } = await client.storage.from(row.bucket_id).remove([row.storage_path]);
    if (error) throw error;
    await sql`update studio_reset_storage_manifest set removed_at=${Date.now()} where bucket_id=${row.bucket_id} and storage_path=${row.storage_path}`;
  }
  console.log(JSON.stringify({ removed: manifest.length }));
} finally {
  await sql.end();
}
