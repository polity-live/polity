import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const databaseUrl = process.env.STUDIO_DATABASE_URL || process.env.ZERO_UPSTREAM_DB;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!databaseUrl || !supabaseUrl || !serviceKey)
  throw new Error('STUDIO_DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

const sql = postgres(databaseUrl, { max: 1 });
const storage = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }).storage;
try {
  for (;;) {
    const pending = await sql`
      select bucket_id,storage_path from public.studio_whiteboard_storage_manifest
      where removed_at is null order by storage_path limit 100`;
    if (!pending.length) break;
    for (const item of pending) {
      const [published] = await sql`
        select id from public.studio_published_media_archive where storage_path=${item.storage_path} limit 1`;
      if (published)
        throw new Error(`Published media is in the cleanup manifest: ${item.storage_path}`);
      const { error } = await storage.from(item.bucket_id).remove([item.storage_path]);
      if (error) throw error;
      await sql`
        update public.studio_whiteboard_storage_manifest set removed_at=${Date.now()}
        where bucket_id=${item.bucket_id} and storage_path=${item.storage_path} and removed_at is null`;
    }
  }
} finally {
  await sql.end();
}
