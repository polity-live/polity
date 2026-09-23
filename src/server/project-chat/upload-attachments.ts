import type { AiChatAttachment } from '@/lib/ai/schemas';
import { createClient } from '@/lib/supabase/server';
import { studioSql } from '@/server/studio/db';

const UPLOAD_BUCKET = 'uploads';
const MAX_TEXT_BYTES = 80_000;

interface StorageObjectRow {
  name: string;
  owner_id: string | null;
  metadata: Record<string, unknown> | null;
}

function metadataString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
}

function metadataNumber(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function displayName(path: string) {
  const encodedName = path.split('/').at(-1) ?? 'Datei';
  try {
    return decodeURIComponent(encodedName).replace(/^\d+-/, '') || 'Datei';
  } catch {
    return encodedName.replace(/^\d+-/, '') || 'Datei';
  }
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isTextMimeType(mimeType: string) {
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/rtf'
  );
}

/** Resolve an uploaded composer file from Storage metadata owned by the sender.
 * Browser supplied titles, URLs, MIME types and sizes are never reused. */
export async function resolveOwnedUploadAttachment(
  actorId: string,
  objectPath: string
): Promise<AiChatAttachment | null> {
  if (!objectPath.startsWith('editor-uploads/') || objectPath.includes('..')) return null;

  const [row] = await studioSql()<StorageObjectRow[]>`
    select name, owner_id::text, metadata
    from storage.objects
    where bucket_id = ${UPLOAD_BUCKET}
      and name = ${objectPath}
    limit 1
  `;
  if (!row || row.owner_id !== actorId) return null;

  const supabase = createClient();
  const storage = supabase.storage.from(UPLOAD_BUCKET);
  const fileName = displayName(row.name);
  const mimeType = metadataString(row.metadata, 'mimetype') || 'application/octet-stream';
  const size = metadataNumber(row.metadata, 'size');
  const { data: publicUrl } = storage.getPublicUrl(row.name);
  let extractedText = '';

  if (isTextMimeType(mimeType) && size <= MAX_TEXT_BYTES) {
    const { data } = await storage.download(row.name);
    if (data) extractedText = (await data.text()).slice(0, MAX_TEXT_BYTES);
  }

  const promptContext = [
    `Server-verified upload: ${fileName}`,
    `MIME type: ${mimeType}`,
    `Size: ${formatBytes(size)}`,
    extractedText ? `Content:\n${extractedText}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

  return {
    entityType: 'document',
    entityId: row.name,
    title: fileName,
    subtitle: `${mimeType} · ${formatBytes(size)}`,
    prompt_context: promptContext,
    card_data_json: JSON.stringify({
      kind: 'upload',
      fileUrl: publicUrl.publicUrl,
      fileName,
      fileType: mimeType,
      fileSize: size,
      previewType: mimeType.startsWith('image/') ? 'image' : 'file',
    }),
  };
}
