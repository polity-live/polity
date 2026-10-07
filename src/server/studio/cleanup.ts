import { studioSql } from './db';
import { createClient } from '@/lib/supabase/server';

/** Keep upload reservations until signed tokens have expired; never remove referenced media. */
export async function cleanupStudioStorage(now = Date.now()) {
  const sql = studioSql();
  const storage = createClient().storage.from('studio');
  await sql`update studio_command_receipt set result='null'::jsonb where expires_at<=${now} and result<>'null'::jsonb`;
  await sql`delete from studio_asset where ready=false and created_at<${now - 3 * 60 * 60_000}`;
  const candidates =
    await sql`select name from storage.objects where bucket_id='studio' and created_at<to_timestamp(${(now - 3 * 60 * 60_000) / 1000})`;
  for (const object of candidates) {
    await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(1886351981)`;
      const [referenced] = await tx`select 1 from studio_asset where storage_path=${object.name}
        union all select 1 from studio_element_set_asset where storage_path=${object.name}
        union all select 1 from studio_export where storage_path=${object.name} limit 1`;
      if (!referenced) {
        const { error } = await storage.remove([object.name]);
        if (error) throw new Error('Studio storage cleanup failed');
      }
    });
  }
}
