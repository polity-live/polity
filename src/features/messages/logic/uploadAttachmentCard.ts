import type { AiChatAttachment } from '@/lib/ai/schemas';

export const MESSAGE_ATTACHMENT_ACCEPT =
  'image/*,.pdf,.doc,.docx,.txt,.rtf,.odt,.md,.csv,.xls,.xlsx,.ppt,.pptx';

export interface UploadAttachmentDescriptor {
  key: string;
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface UploadAttachmentCardPayload {
  kind: 'upload';
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  previewType: 'image' | 'file';
}

export function isImageUploadMimeType(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.toLowerCase().startsWith('image/');
}

export function formatUploadFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let normalizedSize = size;

  while (normalizedSize >= 1024 && unitIndex < units.length - 1) {
    normalizedSize /= 1024;
    unitIndex += 1;
  }

  const formattedSize =
    normalizedSize >= 10 || unitIndex === 0
      ? Math.round(normalizedSize).toString()
      : normalizedSize.toFixed(1);

  return `${formattedSize} ${units[unitIndex]}`;
}

function buildUploadSubtitle(file: UploadAttachmentDescriptor): string {
  const fileTypeLabel = isImageUploadMimeType(file.type)
    ? 'Image'
    : file.type.trim().length > 0
      ? file.type
      : 'File';

  return [fileTypeLabel, formatUploadFileSize(file.size)].filter(Boolean).join(' · ');
}

export function buildUploadAttachmentCardPayload(
  file: UploadAttachmentDescriptor
): UploadAttachmentCardPayload {
  return {
    kind: 'upload',
    fileUrl: file.url,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    previewType: isImageUploadMimeType(file.type) ? 'image' : 'file',
  };
}

export function isUploadAttachmentCardPayload(
  value: unknown
): value is UploadAttachmentCardPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.kind === 'upload' &&
    typeof record.fileUrl === 'string' &&
    typeof record.fileName === 'string' &&
    typeof record.fileType === 'string' &&
    typeof record.fileSize === 'number' &&
    (record.previewType === 'image' || record.previewType === 'file')
  );
}

export function buildUploadAttachment(file: UploadAttachmentDescriptor): AiChatAttachment {
  const promptContext = [
    `URL: ${file.url}`,
    file.type.trim().length > 0 ? `MIME type: ${file.type}` : null,
    `Size: ${formatUploadFileSize(file.size)}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

  return {
    entityType: 'document',
    entityId: file.key,
    title: file.name,
    subtitle: buildUploadSubtitle(file),
    prompt_context: promptContext,
    card_data_json: JSON.stringify(buildUploadAttachmentCardPayload(file)),
  };
}
