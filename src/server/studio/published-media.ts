import { createClient, getSession } from '@/lib/supabase/server';
import { executeZeroRead } from '@/server/zero-mutate';
import { applyStatementQueryAccess } from '@/zero/rbac/query-access';
import { zql } from '@/zero/schema';
import { z } from 'zod';
import { studioSql, assertStudioAccess } from './db';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { getRequiredEnvVar } from '@/lib/env';
import { validMediaRange } from './media-range';
export async function publishedStudioMedia(request: Request, id: string) {
  if (!z.string().uuid().safeParse(id).success) return new Response(null, { status: 404 });
  let session = await getSession(request);
  const cookieHeader = request.headers.get('cookie');
  if (!session && cookieHeader !== null) {
    // Native image/video elements send the same-origin session cookies, not bearer headers.
    const client = createServerClient(
      getRequiredEnvVar(process.env.SUPABASE_URL, 'SUPABASE_URL'),
      getRequiredEnvVar(process.env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY'),
      {
        cookies: {
          getAll: () =>
            parseCookieHeader(cookieHeader).map(c => ({
              name: c.name,
              value: c.value || '',
            })),
          setAll: () => {
            /* Session renewal belongs to the app's auth provider. */
          },
        },
      }
    );
    const { data } = await client.auth.getUser();
    if (data.user) session = { user: data.user };
  }
  const sql = studioSql();
  const [job] = await sql`select * from studio_export where id=${id} and status='completed'`;
  if (!job || !job.storage_path || !['.png', '.mp4'].some(ext => job.file_name?.endsWith(ext)))
    return new Response(null, { status: 404 });
  const url = '/api/studio/published-media/' + id;
  let allowed = false;
  if (session?.user)
    try {
      await assertStudioAccess(session.user.id, job.project_id);
      allowed = true;
    } catch {
      /* Published visibility is checked below. */
    }
  if (!allowed) {
    const rows = await executeZeroRead(tx =>
      tx.run(
        applyStatementQueryAccess(zql.statement, session?.user.id, Date.now())
          .where(({ or, cmp }) => or(cmp('image_url', url), cmp('video_url', url)))
          .limit(1)
      )
    );
    allowed = rows.length > 0;
  }
  if (!allowed) return new Response(null, { status: 404 });
  const storage = createClient().storage.from('studio');
  const range = request.headers.get('range');
  if (range) {
    // Storage owns its metadata. A protected application database copy must not
    // rely on a stale copy of storage.objects when checking a newly exported file.
    const { data: object, error } = await storage.info(job.storage_path);
    if (error || !object) return new Response(null, { status: 404 });
    const size = Number(object.size);
    if (!validMediaRange(range, size))
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}`, 'Cache-Control': 'private, no-store' },
      });
  }
  const { data, error } = await storage.createSignedUrl(job.storage_path, 30);
  if (error || !data) return new Response(null, { status: 404 });
  // The private storage service handles video ranges and files beyond serverless response limits.
  return new Response(null, {
    status: 307,
    headers: {
      Location: data.signedUrl,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
