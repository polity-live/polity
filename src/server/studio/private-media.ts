import { createClient, getSession } from '@/lib/supabase/server';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { getRequiredEnvVar } from '@/lib/env';
import { z } from 'zod';
import { studioSql } from './db';
import { assertCanvasWorkspace } from './workspace-access';
import { validMediaRange } from './media-range';

function exportMimeType(fileName: string) {
  const extension = fileName.toLowerCase().split('.').pop();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'pdf':
      return 'application/pdf';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'mp4':
      return 'video/mp4';
    case 'zip':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
}

/** Proxy bytes so previously issued image URLs cannot outlive their current ACL. */
export async function privateCanvasMedia(
  request: Request,
  id: string,
  kind: 'asset' | 'export' = 'asset'
) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!z.string().uuid().safeParse(id).success) return new Response(null, { status: 404, headers });
  let session = await getSession(request);
  if (!session && request.headers.has('cookie')) {
    const auth = createServerClient(
      getRequiredEnvVar(process.env.SUPABASE_URL, 'SUPABASE_URL'),
      getRequiredEnvVar(process.env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY'),
      {
        cookies: {
          getAll: () =>
            parseCookieHeader(request.headers.get('cookie') ?? '').map(c => ({
              name: c.name,
              value: c.value ?? '',
            })),
          setAll: () => {
            /* Auth provider owns renewal. */
          },
        },
      }
    );
    const { data } = await auth.auth.getUser();
    if (data.user) session = { user: data.user };
  }
  if (!session) return new Response(null, { status: 401, headers });
  const sql = studioSql();
  const [asset] =
    kind === 'asset'
      ? await sql`select * from studio_asset where id=${id} and ready=true`
      : await sql`select project_id,null::uuid as workspace_id,storage_path,file_name from studio_export where id=${id} and status='completed' and storage_path is not null`;
  if (!asset) return new Response(null, { status: 404, headers });
  try {
    await assertCanvasWorkspace(session.user.id, asset.project_id, asset.workspace_id, false, sql);
  } catch {
    return new Response(null, { status: 404, headers });
  }
  const range = request.headers.get('range');
  if (
    range &&
    (kind === 'asset'
      ? !validMediaRange(range, Number(asset.byte_size))
      : !/^bytes=\d*-\d*$/.test(range))
  )
    return new Response(null, { status: 416, headers });
  const { data, error } = await createClient()
    .storage.from('studio')
    .createSignedUrl(asset.storage_path, 30);
  if (error || !data) return new Response(null, { status: 502, headers });
  const upstream = await fetch(data.signedUrl, {
    headers: range ? { Range: range } : {},
    signal: request.signal,
  });
  if (!upstream.ok) return new Response(null, { status: 502, headers });
  const responseHeaders = new Headers({
    ...headers,
    'Content-Type': kind === 'export' ? exportMimeType(asset.file_name ?? '') : asset.mime_type,
    'Accept-Ranges': 'bytes',
  });
  if (kind === 'export') {
    const fileName = asset.file_name ?? 'Polity-export';
    const asciiName = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    responseHeaders.set(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
  }
  for (const header of ['content-range', 'content-length']) {
    const value = upstream.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
